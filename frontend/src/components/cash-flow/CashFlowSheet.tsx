"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ArrowUpCircle, Repeat, CreditCard, ShoppingBag, Check, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { type CashFlowData, type CashFlowSectionKey, shortMonthLabel } from "@/lib/cash-flow";
import { usePrivacy } from "@/lib/privacy";

const SECTION_ICONS: Record<CashFlowSectionKey, LucideIcon> = {
    INCOME: ArrowUpCircle,
    FIXED: Repeat,
    CARDS: CreditCard,
    VARIABLE: ShoppingBag,
};

const number = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Kind = "income" | "expense";

/** Tag shown instead of the amount once everything in the cell was received/paid. */
function SettledTag({ kind, amount }: { kind: Kind; amount: number }) {
    const { hidden } = usePrivacy();
    const label = kind === "income" ? "Recebido" : "Pago";
    return (
        <span
            title={hidden ? undefined : `${label}: R$ ${number.format(amount)}`}
            className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
                kind === "income" ? "bg-positive-soft text-positive" : "bg-muted text-muted-foreground",
            )}
        >
            <Check className="h-3 w-3" aria-hidden="true" />
            {label}
        </span>
    );
}

/** Amount still open; settled cells show a tag, partially settled ones show the remainder. */
function OpenCell({ value, open, kind, strong }: { value: number; open: number; kind: Kind; strong?: boolean }) {
    const { hidden } = usePrivacy();
    if (value === 0) return <span className="text-muted-foreground/50">–</span>;
    if (open === 0) return <SettledTag kind={kind} amount={value} />;
    const partial = open < value;
    return (
        <span
            className={cn("privacy-value tabular-nums", strong && "font-medium")}
            title={!hidden && partial ? `R$ ${number.format(value - open)} já ${kind === "income" ? "recebido" : "pago"} de R$ ${number.format(value)}` : undefined}
        >
            {number.format(open)}
            {partial && <span className="ml-0.5 align-super text-[9px] text-muted-foreground">*</span>}
        </span>
    );
}

function Amount({ value, signed, strong }: { value: number | null; signed?: boolean; strong?: boolean }) {
    if (value === null) return <span className="text-muted-foreground/60">—</span>;
    if (value === 0 && !signed) return <span className="text-muted-foreground/50">–</span>;
    return (
        <span className={cn("privacy-value tabular-nums", strong && "font-medium", signed && (value < 0 ? "text-negative" : "text-positive"))}>
            {number.format(value)}
        </span>
    );
}

interface CashFlowSheetProps {
    data: CashFlowData;
    /** Current month: highlighted, and its balance is labeled "Saldo" */
    highlight?: { year: number; month: number };
}

/** Spreadsheet-like view of what is still open: rows grouped by section × one column per month. */
export function CashFlowSheet({ data, highlight }: CashFlowSheetProps) {
    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
    const toggleCard = (key: string) => setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }));

    const isHighlighted = (i: number) =>
        !!highlight && data.months[i].year === highlight.year && data.months[i].month === highlight.month;

    const cellClass = (i: number, extra?: string) =>
        cn("px-3 py-2 text-right whitespace-nowrap", isHighlighted(i) && "bg-foreground/[0.06]", extra);

    const stickyCell = "sticky left-0 z-10 bg-card px-4 py-2 text-left";
    const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

    return (
        <div className="relative overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-[13px]">
                <caption className="sr-only">Fluxo de caixa mês a mês: valores ainda em aberto, em reais. Itens quitados aparecem como Recebido ou Pago.</caption>
                <thead>
                    <tr className="border-b">
                        <th scope="col" className={cn(stickyCell, "min-w-[220px] text-xs font-medium text-muted-foreground")}>Em aberto (R$)</th>
                        {data.months.map((m, i) => (
                            <th
                                key={`${m.year}-${m.month}`}
                                scope="col"
                                className={cellClass(i, "text-xs font-medium text-muted-foreground")}
                                aria-current={isHighlighted(i) ? "date" : undefined}
                            >
                                {shortMonthLabel(m)}
                            </th>
                        ))}
                        <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {data.sections.map(section => {
                        const Icon = SECTION_ICONS[section.key];
                        return (
                            <Fragment key={section.key}>
                                <tr className="border-b bg-muted/60">
                                    <th scope="rowgroup" className={cn(stickyCell, "bg-muted font-medium")}>
                                        <span className="inline-flex items-center gap-2">
                                            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                            {section.title}
                                        </span>
                                    </th>
                                    {section.totals.map((v, i) => (
                                        <td key={i} className={cellClass(i)}>
                                            <OpenCell value={v} open={section.openTotals[i]} kind={section.kind} strong />
                                        </td>
                                    ))}
                                    <td className="px-4 py-2 text-right"><Amount value={sum(section.openTotals)} strong /></td>
                                </tr>
                                {section.rows.length === 0 && (
                                    <tr className="border-b">
                                        <td className={cn(stickyCell, "pl-10 italic text-muted-foreground")}>Nenhum lançamento</td>
                                        <td colSpan={data.months.length + 1} />
                                    </tr>
                                )}
                                {section.rows.map(row => {
                                    const hasHolders = section.key === "CARDS" && (row.subRows?.length ?? 0) > 1;
                                    const isExpanded = !!expandedCards[row.key];
                                    return (
                                        <Fragment key={row.key}>
                                            <tr className="border-b transition-colors hover:bg-muted/40">
                                                <th scope="row" className={cn(stickyCell, "pl-10 font-normal")}>
                                                    {section.key === "CARDS" ? (
                                                        <span className="inline-flex items-center gap-1.5">
                                                            {hasHolders && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleCard(row.key)}
                                                                    aria-expanded={isExpanded}
                                                                    aria-label={isExpanded ? `Recolher portadores de ${row.label}` : `Ver portadores de ${row.label}`}
                                                                    className="-ml-5 flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                                                                >
                                                                    <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")} aria-hidden="true" />
                                                                </button>
                                                            )}
                                                            <Link href="/cartoes" className="underline-offset-4 hover:underline">{row.label}</Link>
                                                        </span>
                                                    ) : row.label}
                                                </th>
                                                {row.values.map((v, i) => (
                                                    <td key={i} className={cellClass(i)}>
                                                        <OpenCell value={v} open={row.open[i]} kind={section.kind} />
                                                    </td>
                                                ))}
                                                <td className="px-4 py-2 text-right"><Amount value={sum(row.open)} /></td>
                                            </tr>
                                            {hasHolders && isExpanded && row.subRows?.map(sub => (
                                                <tr key={`${row.key}-${sub.key}`} className="border-b bg-muted/20 text-xs text-muted-foreground">
                                                    <th scope="row" className={cn(stickyCell, "bg-muted/20 pl-14 font-normal")}>
                                                        {sub.label}
                                                    </th>
                                                    {sub.values.map((v, i) => (
                                                        <td key={i} className={cellClass(i)}>
                                                            <OpenCell value={v} open={sub.open[i]} kind={section.kind} />
                                                        </td>
                                                    ))}
                                                    <td className="px-4 py-2 text-right"><Amount value={sum(sub.open)} /></td>
                                                </tr>
                                            ))}
                                        </Fragment>
                                    );
                                })}
                            </Fragment>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="border-b border-t-2 border-t-foreground/20">
                        <th scope="row" className={cn(stickyCell, "font-medium")}>A receber</th>
                        {data.summary.openIncome.map((v, i) => <td key={i} className={cellClass(i)}><Amount value={v} strong /></td>)}
                        <td className="px-4 py-2 text-right"><Amount value={sum(data.summary.openIncome)} strong /></td>
                    </tr>
                    <tr className="border-b">
                        <th scope="row" className={cn(stickyCell, "font-medium")}>A pagar</th>
                        {data.summary.openExpenses.map((v, i) => <td key={i} className={cellClass(i)}><Amount value={v} strong /></td>)}
                        <td className="px-4 py-2 text-right"><Amount value={sum(data.summary.openExpenses)} strong /></td>
                    </tr>
                    <tr className="border-b">
                        <th scope="row" className={cn(stickyCell, "font-medium")}>
                            Saldo do mês
                            <span className="block text-[11px] font-normal text-muted-foreground">a receber − a pagar</span>
                        </th>
                        {data.summary.openNet.map((v, i) => <td key={i} className={cellClass(i)}><Amount value={v} signed strong /></td>)}
                        <td className="px-4 py-2 text-right"><Amount value={sum(data.summary.openNet)} signed strong /></td>
                    </tr>
                    <tr className="bg-muted/60">
                        <th scope="row" className={cn(stickyCell, "bg-muted font-medium")}>
                            Saldo projetado
                            <span className="block text-[11px] font-normal text-muted-foreground">nas contas, fim do mês</span>
                        </th>
                        {data.summary.projectedBalance.map((v, i) => (
                            <td key={i} className={cellClass(i)}>
                                {isHighlighted(i) && v !== null && (
                                    <span className="block text-[10px] font-normal uppercase tracking-wide text-muted-foreground">Saldo</span>
                                )}
                                <Amount value={v} signed strong />
                            </td>
                        ))}
                        <td className="px-4 py-2" />
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}
