// Dashboard (Resumo) helpers. Pure functions (no React/aliases) so they can run under `node --test`.
import type { CashFlowData } from "./cash-flow.ts";

const round2 = (v: number) => Math.round(v * 100) / 100;

export type BudgetSegmentKey = "FIXED" | "CARDS" | "VARIABLE" | "LEFTOVER";

export type BudgetSegment = { key: BudgetSegmentKey; label: string; value: number; pct: number };

export type BudgetBreakdown = {
    income: number;
    expenses: number;
    /** Income minus every expense of the month (negative when expenses exceed income) */
    leftover: number;
    /** Leftover as a share of income (0 when there is no income) */
    leftoverPct: number;
    /** Where the income goes: fixed bills, card invoices, other expenses and what is left (only when positive) */
    segments: BudgetSegment[];
};

const SEGMENT_LABELS: Record<BudgetSegmentKey, string> = {
    FIXED: "Contas fixas",
    CARDS: "Cartões",
    VARIABLE: "Outras despesas",
    LEFTOVER: "Sobra",
};

/**
 * Splits the month (column `index` of the cash flow) into fixed bills, card invoices, other expenses and the leftover.
 * Percentages are of the income; when expenses exceed income they are of the expenses, so the bar still adds up.
 */
export function budgetBreakdown(data: CashFlowData, index = 0): BudgetBreakdown {
    const section = (key: string) => data.sections.find(s => s.key === key)?.totals[index] ?? 0;
    const income = data.summary.income[index] ?? 0;
    const expenses = data.summary.expenses[index] ?? 0;
    const leftover = round2(income - expenses);
    const base = Math.max(income, expenses);
    const pct = (v: number) => (base > 0 ? Math.round((v / base) * 1000) / 10 : 0);

    const parts: [BudgetSegmentKey, number][] = [
        ["FIXED", section("FIXED")],
        ["CARDS", section("CARDS")],
        ["VARIABLE", section("VARIABLE")],
        ["LEFTOVER", Math.max(leftover, 0)],
    ];
    return {
        income,
        expenses,
        leftover,
        leftoverPct: income > 0 ? Math.round((leftover / income) * 1000) / 10 : 0,
        segments: parts.map(([key, value]) => ({ key, label: SEGMENT_LABELS[key], value: round2(value), pct: pct(value) })),
    };
}

export type BillItem = {
    id: string;
    label: string;
    amount: number;
    day: number;
    paid: boolean;
    kind: "bill" | "card";
};

export type BillDay = { day: number; items: BillItem[]; total: number; paidCount: number };

type TxLike = { id: string; description: string; amount: number; date: string; type: string; status: string };
type CardLike = { id: string; name: string; dueDay: number };

/**
 * Everything to pay in a month, grouped by due day: expense lançamentos (by their date) and card invoices
 * (on the card's due day; an invoice counts as paid once nothing of it is open in the cash flow).
 */
export function billsByDay(
    transactions: TxLike[],
    cards: CardLike[],
    data: CashFlowData | null,
    month: { year: number; month: number },
    index = 0,
): BillDay[] {
    const lastDay = new Date(month.year, month.month, 0).getDate();
    const items: BillItem[] = transactions
        .filter(t => t.type === "EXPENSE" && t.status !== "CANCELLED")
        .map(t => ({ id: t.id, label: t.description, amount: t.amount, day: new Date(t.date).getDate(), paid: t.status === "PAID", kind: "bill" as const }));

    const cardRows = data?.sections.find(s => s.key === "CARDS")?.rows ?? [];
    for (const card of cards) {
        const row = cardRows.find(r => r.key === card.id);
        const amount = row?.values[index] ?? 0;
        if (!(amount > 0)) continue;
        items.push({
            id: `card-${card.id}`,
            label: `Fatura ${card.name}`,
            amount,
            day: Math.min(card.dueDay, lastDay),
            paid: (row?.open[index] ?? 0) <= 0,
            kind: "card",
        });
    }

    const byDay = new Map<number, BillItem[]>();
    for (const item of items) byDay.set(item.day, [...(byDay.get(item.day) ?? []), item]);
    return [...byDay.entries()]
        .sort(([a], [b]) => a - b)
        .map(([day, dayItems]) => ({
            day,
            items: [...dayItems].sort((a, b) => b.amount - a.amount),
            total: round2(dayItems.reduce((acc, i) => acc + i.amount, 0)),
            paidCount: dayItems.filter(i => i.paid).length,
        }));
}

/** Day shown first: in the current month, the next day with something still open; otherwise the first day. */
export function defaultBillDay(days: BillDay[], month: { year: number; month: number }, today = new Date()): number | null {
    if (days.length === 0) return null;
    const isCurrent = today.getFullYear() === month.year && today.getMonth() + 1 === month.month;
    if (isCurrent) {
        const next = days.find(d => d.day >= today.getDate() && d.paidCount < d.items.length)
            ?? days.find(d => d.paidCount < d.items.length);
        if (next) return next.day;
    }
    return days[0].day;
}

/** "hoje", "em 3 dias", "há 2 dias" for a day of the given month. */
export function relativeDay(day: number, month: { year: number; month: number }, today = new Date()): string {
    const target = new Date(month.year, month.month - 1, day);
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diff = Math.round((target.getTime() - base.getTime()) / 86_400_000);
    if (diff === 0) return "hoje";
    if (diff === 1) return "amanhã";
    if (diff > 0) return `em ${diff} dias`;
    return diff === -1 ? "ontem" : `há ${-diff} dias`;
}

/** Splits a value into "R$ 5.304" and ",28" so the cents can be rendered smaller. */
export function splitMoney(value: number): { whole: string; cents: string } {
    const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    const comma = formatted.lastIndexOf(",");
    return comma < 0 ? { whole: formatted, cents: "" } : { whole: formatted.slice(0, comma), cents: formatted.slice(comma) };
}
