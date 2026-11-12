// Pure aggregation for the cash-flow spreadsheet. No Prisma/Nest here so it can be unit tested directly.

export type CashFlowTxInput = {
    description: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    status: 'PENDING' | 'PAID' | 'CANCELLED';
    isFixed: boolean;
    installmentGroupId?: string | null;
    category?: { name: string } | null;
};

export type CashFlowCardHolderInput = {
    id: string;
    name: string;
    total: number;
};

export type CashFlowCardInput = {
    id: string;
    name: string;
    dueDay: number;
    /** Invoice total for the month (purchases minus refunds) */
    total: number;
    /** Optional per-holder totals when the card has supplementary holders */
    holders?: CashFlowCardHolderInput[];
};

export type CashFlowPassiveIncomeInput = {
    scheduledDividends: number;
    projectedFiiDividends: number;
    fixedIncomeNetYield: number;
};

export type CashFlowMonthInput = {
    year: number;
    month: number; // 1-12
    transactions: CashFlowTxInput[];
    cards: CashFlowCardInput[];
    passiveIncome?: CashFlowPassiveIncomeInput;
};

export type CashFlowSectionKey = 'INCOME' | 'FIXED' | 'CARDS' | 'VARIABLE';

export type CashFlowRow = {
    key: string;
    label: string;
    /** Full amount per month */
    values: number[];
    /** Part still pending per month (0 once received/paid) */
    open: number[];
    total: number;
    /** Optional breakdown inside the same row (e.g. supplementary card holders) */
    subRows?: CashFlowRow[];
};

export type CashFlowSection = {
    key: CashFlowSectionKey;
    title: string;
    kind: 'income' | 'expense';
    rows: CashFlowRow[];
    totals: number[];
    openTotals: number[];
};

export type CashFlowResult = {
    months: { year: number; month: number }[];
    openingBalance: number;
    sections: CashFlowSection[];
    summary: {
        /** Full month totals (planned), regardless of status */
        income: number[];
        expenses: number[];
        net: number[];
        /** Only what is still pending in each month */
        openIncome: number[];
        openExpenses: number[];
        openNet: number[];
        /** Account balance expected at the end of each month; null for months already closed */
        projectedBalance: (number | null)[];
    };
};

export type BuildCashFlowInput = {
    /** Months shown in the spreadsheet, in chronological order */
    months: CashFlowMonthInput[];
    /** Months from the current month (inclusive) up to the first shown month (exclusive); used to carry the balance */
    leadIn?: CashFlowMonthInput[];
    /** Current sum of account balances (already includes everything marked as paid) */
    openingBalance: number;
    today: Date;
};

const SECTION_TITLES: Record<CashFlowSectionKey, string> = {
    INCOME: 'Recebimentos',
    FIXED: 'Contas fixas',
    CARDS: 'Cartões de crédito',
    VARIABLE: 'Outras despesas',
};

const round = (value: number) => Math.round(value * 100) / 100;

const isActive = (tx: CashFlowTxInput) => tx.status !== 'CANCELLED' && tx.type !== 'TRANSFER';

const monthIndex = (year: number, month: number) => year * 12 + (month - 1);

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * Card invoices have no paid flag: an invoice is treated as settled once its due date has passed
 * (the payment is expected to be already reflected in the account balance).
 */
export function isCardInvoiceOpen(m: CashFlowMonthInput, card: CashFlowCardInput, today: Date): boolean {
    const lastDay = new Date(m.year, m.month, 0).getDate();
    const due = new Date(m.year, m.month - 1, Math.min(card.dueDay, lastDay));
    return startOfDay(due) >= startOfDay(today);
}

const passiveTotal = (p?: CashFlowPassiveIncomeInput): number =>
    p ? Math.max(0, p.scheduledDividends) + Math.max(0, p.projectedFiiDividends) + Math.max(0, p.fixedIncomeNetYield) : 0;

/** Income minus every expense of the month (fixed, variable and card invoices), regardless of status. */
export function monthNet(m: CashFlowMonthInput): number {
    let net = passiveTotal(m.passiveIncome);
    for (const tx of m.transactions) {
        if (!isActive(tx)) continue;
        net += tx.type === 'INCOME' ? tx.amount : -tx.amount;
    }
    for (const card of m.cards) net -= Math.max(card.total, 0);
    return round(net);
}

/**
 * What still has to happen in a month: pending transactions (paid ones are already in the account
 * balance), projected passive income from the current month onward, and card invoices not yet due.
 */
export function openNet(m: CashFlowMonthInput, today: Date): number {
    const currentIdx = monthIndex(today.getFullYear(), today.getMonth() + 1);
    let net = monthIndex(m.year, m.month) >= currentIdx ? passiveTotal(m.passiveIncome) : 0;
    for (const tx of m.transactions) {
        if (!isActive(tx) || tx.status !== 'PENDING') continue;
        net += tx.type === 'INCOME' ? tx.amount : -tx.amount;
    }
    for (const card of m.cards) {
        if (isCardInvoiceOpen(m, card, today)) net -= Math.max(card.total, 0);
    }
    return round(net);
}

type RowItem = { key: string; label: string; amount: number; open: boolean };

function groupRows(months: CashFlowMonthInput[], pick: (m: CashFlowMonthInput) => RowItem[]): CashFlowRow[] {
    const rows = new Map<string, CashFlowRow>();
    months.forEach((m, i) => {
        for (const item of pick(m)) {
            let row = rows.get(item.key);
            if (!row) {
                row = { key: item.key, label: item.label, values: months.map(() => 0), open: months.map(() => 0), total: 0 };
                rows.set(item.key, row);
            }
            row.values[i] = round(row.values[i] + item.amount);
            if (item.open) row.open[i] = round(row.open[i] + item.amount);
        }
    });
    return [...rows.values()]
        .map(r => ({ ...r, total: round(r.values.reduce((a, b) => a + b, 0)) }))
        .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt-BR'));
}

const normalizeKey = (text: string) => text.trim().toLocaleLowerCase('pt-BR');

const stripInstallmentSuffix = (label: string) => label.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();

const sumColumn = (rows: CashFlowRow[], pick: (r: CashFlowRow) => number[], i: number) =>
    round(rows.reduce((acc, r) => acc + pick(r)[i], 0));

export function buildCashFlow({ months, leadIn = [], openingBalance, today }: BuildCashFlowInput): CashFlowResult {
    // Every section lists the lançamentos by description, so a new entry shows up as its own row.
    // Installments sharing an installmentGroupId are grouped into a single row across their months.
    const txRows = (m: CashFlowMonthInput, filter: (tx: CashFlowTxInput) => boolean): RowItem[] =>
        m.transactions.filter(tx => isActive(tx) && filter(tx)).map(tx => {
            const rawLabel = tx.description.trim();
            if (tx.installmentGroupId) {
                const label = stripInstallmentSuffix(rawLabel) || rawLabel;
                return { key: `installment:${tx.installmentGroupId}`, label, amount: tx.amount, open: tx.status === 'PENDING' };
            }
            return { key: normalizeKey(rawLabel), label: rawLabel, amount: tx.amount, open: tx.status === 'PENDING' };
        });

    const cardRows = groupRows(months, m => m.cards.map(c => ({
        key: c.id,
        label: c.name,
        amount: Math.max(c.total, 0),
        open: isCardInvoiceOpen(m, c, today),
    }))).map(row => {
        const subRows = groupRows(months, m => {
            const card = m.cards.find(c => c.id === row.key);
            if (!card?.holders?.length) return [];
            const isOpen = isCardInvoiceOpen(m, card, today);
            return card.holders.map(h => ({
                key: h.id,
                label: h.name,
                amount: Math.max(h.total, 0),
                open: isOpen,
            }));
        });
        return subRows.length > 1 ? { ...row, subRows } : row;
    });

    const currentIndex = monthIndex(today.getFullYear(), today.getMonth() + 1);

    const incomeRows = groupRows(months, m => txRows(m, tx => tx.type === 'INCOME'));
    const hasPassiveIncome = months.some(m => passiveTotal(m.passiveIncome) > 0);
    if (hasPassiveIncome) {
        const isMonthOpen = (m: CashFlowMonthInput) => monthIndex(m.year, m.month) >= currentIndex;
        const buildPassiveSubRow = (
            key: string,
            label: string,
            pickVal: (p: CashFlowPassiveIncomeInput) => number,
        ): CashFlowRow => {
            const values = months.map(m => round(m.passiveIncome ? Math.max(0, pickVal(m.passiveIncome)) : 0));
            const open = months.map((m, i) => (isMonthOpen(m) ? values[i] : 0));
            return {
                key,
                label,
                values,
                open,
                total: round(values.reduce((a, b) => a + b, 0)),
            };
        };

        const subRows: CashFlowRow[] = [
            buildPassiveSubRow('passive-scheduled', 'Dividendos programados a receber', p => p.scheduledDividends),
            buildPassiveSubRow('passive-fii', 'Projeção de dividendos (FIIs)', p => p.projectedFiiDividends),
            buildPassiveSubRow('passive-fixed-income', 'Retorno líquido de Renda Fixa', p => p.fixedIncomeNetYield),
        ];

        const values = months.map((_, i) => round(subRows.reduce((s, r) => s + r.values[i], 0)));
        const open = months.map((m, i) => (isMonthOpen(m) ? values[i] : 0));

        incomeRows.push({
            key: 'passive-income',
            label: 'Rendimentos e Dividendos',
            values,
            open,
            total: round(values.reduce((a, b) => a + b, 0)),
            subRows,
        });
    }

    const sectionRows: Record<CashFlowSectionKey, CashFlowRow[]> = {
        INCOME: incomeRows,
        FIXED: groupRows(months, m => txRows(m, tx => tx.type === 'EXPENSE' && tx.isFixed)),
        // Card rows are listed even when empty so every card shows up in the sheet
        CARDS: cardRows,
        VARIABLE: groupRows(months, m => txRows(m, tx => tx.type === 'EXPENSE' && !tx.isFixed)),
    };

    const sections: CashFlowSection[] = (Object.keys(sectionRows) as CashFlowSectionKey[]).map(key => ({
        key,
        title: SECTION_TITLES[key],
        kind: key === 'INCOME' ? 'income' : 'expense',
        rows: sectionRows[key],
        totals: months.map((_, i) => sumColumn(sectionRows[key], r => r.values, i)),
        openTotals: months.map((_, i) => sumColumn(sectionRows[key], r => r.open, i)),
    }));

    const incomeSection = sections.find(s => s.key === 'INCOME')!;
    const expenseSections = sections.filter(s => s.kind === 'expense');
    const sumSections = (list: CashFlowSection[], pick: (s: CashFlowSection) => number[], i: number) =>
        round(list.reduce((acc, s) => acc + pick(s)[i], 0));

    const income = incomeSection.totals;
    const expenses = months.map((_, i) => sumSections(expenseSections, s => s.totals, i));
    const net = months.map((_, i) => round(income[i] - expenses[i]));
    const openIncome = incomeSection.openTotals;
    const openExpenses = months.map((_, i) => sumSections(expenseSections, s => s.openTotals, i));
    const openNetByMonth = months.map((_, i) => round(openIncome[i] - openExpenses[i]));

    // Running balance starts from today's gross total (accounts + investments) and adds what is still open
    // (pending income minus pending expenses/open card invoices) from the current month onward.
    let running = round(openingBalance);

    for (const m of leadIn) {
        if (monthIndex(m.year, m.month) >= currentIndex) running = round(running + openNet(m, today));
    }
    const projectedBalance = months.map(m => {
        if (monthIndex(m.year, m.month) < currentIndex) return null;
        running = round(running + openNet(m, today));
        return running;
    });

    return {
        months: months.map(m => ({ year: m.year, month: m.month })),
        openingBalance: round(openingBalance),
        sections,
        summary: { income, expenses, net, openIncome, openExpenses, openNet: openNetByMonth, projectedBalance },
    };
}
