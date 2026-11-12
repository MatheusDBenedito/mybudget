// Shape of GET /cash-flow (see backend/src/cash-flow/cash-flow.builder.ts)

export type CashFlowSectionKey = "INCOME" | "FIXED" | "CARDS" | "VARIABLE";

export type CashFlowRow = {
    key: string;
    label: string;
    /** Full amount per month */
    values: number[];
    /** Part still pending per month (0 once received/paid) */
    open: number[];
    total: number;
    subRows?: CashFlowRow[];
};

export type CashFlowSection = {
    key: CashFlowSectionKey;
    title: string;
    kind: "income" | "expense";
    rows: CashFlowRow[];
    totals: number[];
    openTotals: number[];
};

export type CashFlowData = {
    months: { year: number; month: number }[];
    openingBalance: number;
    sections: CashFlowSection[];
    summary: {
        /** Full month totals, regardless of status */
        income: number[];
        expenses: number[];
        net: number[];
        /** Only what is still pending */
        openIncome: number[];
        openExpenses: number[];
        openNet: number[];
        projectedBalance: (number | null)[];
    };
};

/** "Saldo" for the current month (it is the real balance once the month ends), "Saldo projetado" for later ones. */
export function balanceLabel(month: { year: number; month: number }, today: Date = new Date()): "Saldo" | "Saldo projetado" | "Mês encerrado" {
    const index = month.year * 12 + month.month;
    const current = today.getFullYear() * 12 + today.getMonth() + 1;
    if (index === current) return "Saldo";
    return index > current ? "Saldo projetado" : "Mês encerrado";
}

const SHORT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const shortMonthLabel = ({ year, month }: { year: number; month: number }) =>
    `${SHORT_MONTHS[month - 1]}/${String(year).slice(-2)}`;
