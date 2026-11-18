import { buildCashFlow, CashFlowMonthInput, CashFlowTxInput, computeCdbMaturityIrByMonth, isCardInvoiceOpen, monthNet, openNet } from '../cash-flow.builder';

const tx = (over: Partial<CashFlowTxInput>): CashFlowTxInput => ({
    description: 'Item',
    amount: 100,
    type: 'EXPENSE',
    status: 'PENDING',
    isFixed: false,
    category: null,
    ...over,
});

const month = (m: number, transactions: CashFlowTxInput[] = [], cards: CashFlowMonthInput['cards'] = [], year = 2026): CashFlowMonthInput =>
    ({ year, month: m, transactions, cards });

describe('cash-flow builder', () => {
    const today = new Date(2026, 10, 10); // 10 Nov 2026

    describe('monthNet', () => {
        it('subtracts expenses and card invoices from income, regardless of status', () => {
            const m = month(11, [
                tx({ type: 'INCOME', amount: 5000, status: 'PAID' }),
                tx({ type: 'EXPENSE', amount: 1200, isFixed: true }),
                tx({ type: 'EXPENSE', amount: 300 }),
            ], [{ id: 'c1', name: 'Nubank', dueDay: 15, total: 800 }]);
            expect(monthNet(m)).toBe(2700);
        });

        it('ignores cancelled items, transfers and card invoices in credit', () => {
            const m = month(11, [
                tx({ type: 'INCOME', amount: 1000 }),
                tx({ type: 'EXPENSE', amount: 500, status: 'CANCELLED' }),
                tx({ type: 'TRANSFER', amount: 999 }),
            ], [{ id: 'c1', name: 'Nubank', dueDay: 15, total: -50 }]);
            expect(monthNet(m)).toBe(1000);
        });
    });

    describe('isCardInvoiceOpen', () => {
        it('is open until the due date (inclusive) and settled afterwards', () => {
            const m = month(11);
            expect(isCardInvoiceOpen(m, { id: 'a', name: 'A', dueDay: 15, total: 1 }, today)).toBe(true);
            expect(isCardInvoiceOpen(m, { id: 'b', name: 'B', dueDay: 10, total: 1 }, today)).toBe(true);
            expect(isCardInvoiceOpen(m, { id: 'c', name: 'C', dueDay: 5, total: 1 }, today)).toBe(false);
            expect(isCardInvoiceOpen(month(12), { id: 'd', name: 'D', dueDay: 1, total: 1 }, today)).toBe(true);
        });
    });

    describe('openNet', () => {
        it('only counts pending items and invoices not yet due', () => {
            const m = month(11, [
                tx({ type: 'INCOME', amount: 5000, status: 'PAID' }), // already in balance
                tx({ type: 'INCOME', amount: 1000, status: 'PENDING' }),
                tx({ type: 'EXPENSE', amount: 200, status: 'PAID' }),
                tx({ type: 'EXPENSE', amount: 300, status: 'PENDING' }),
            ], [
                { id: 'due-later', name: 'A', dueDay: 15, total: 400 },
                { id: 'due-today', name: 'B', dueDay: 10, total: 100 },
                { id: 'already-due', name: 'C', dueDay: 5, total: 999 },
            ]);
            expect(openNet(m, today)).toBe(1000 - 300 - 400 - 100);
        });
    });

    describe('buildCashFlow', () => {
        it('groups rows by section and totals each month', () => {
            const result = buildCashFlow({
                months: [
                    month(11, [
                        tx({ type: 'INCOME', description: 'Salário', amount: 5000 }),
                        tx({ type: 'EXPENSE', description: 'Aluguel', amount: 1500, isFixed: true }),
                        tx({ type: 'EXPENSE', description: 'Padaria', amount: 30, category: { name: 'Mercado' } }),
                        tx({ type: 'EXPENSE', description: 'Feira', amount: 70, category: { name: 'Mercado' } }),
                    ], [{ id: 'c1', name: 'Nubank', dueDay: 15, total: 800 }]),
                    month(12, [
                        tx({ type: 'INCOME', description: 'Salário', amount: 5000 }),
                        tx({ type: 'INCOME', description: '13º salário', amount: 2500 }),
                        tx({ type: 'EXPENSE', description: 'Aluguel', amount: 1500, isFixed: true }),
                    ], [{ id: 'c1', name: 'Nubank', dueDay: 15, total: 650.5 }]),
                ],
                openingBalance: 1000,
                today,
            });

            const income = result.sections.find(s => s.key === 'INCOME')!;
            expect(income.rows.map(r => r.label)).toEqual(['Salário', '13º salário']);
            expect(income.rows[0].values).toEqual([5000, 5000]);
            expect(income.totals).toEqual([5000, 7500]);

            const variable = result.sections.find(s => s.key === 'VARIABLE')!;
            // Each lançamento is its own row (by description), not merged into its category
            expect(variable.rows).toEqual([
                { key: 'feira', label: 'Feira', values: [70, 0], open: [70, 0], total: 70 },
                { key: 'padaria', label: 'Padaria', values: [30, 0], open: [30, 0], total: 30 },
            ]);

            const cards = result.sections.find(s => s.key === 'CARDS')!;
            expect(cards.rows[0]).toMatchObject({ key: 'c1', label: 'Nubank', values: [800, 650.5] });

            expect(result.summary.income).toEqual([5000, 7500]);
            expect(result.summary.expenses).toEqual([2400, 2150.5]);
            expect(result.summary.net).toEqual([2600, 5349.5]);
        });

        it('keeps the full value but zeroes the open value of received/paid items', () => {
            const result = buildCashFlow({
                months: [month(11, [
                    tx({ type: 'INCOME', description: 'Salário', amount: 5000, status: 'PAID' }),
                    tx({ type: 'EXPENSE', description: 'Internet', amount: 120, isFixed: true, status: 'PAID' }),
                    tx({ type: 'EXPENSE', description: 'Luz', amount: 200, isFixed: true, status: 'PENDING' }),
                ], [{ id: 'c1', name: 'Nubank', dueDay: 5, total: 300 }])],
                openingBalance: 0,
                today,
            });
            const row = (section: string, key: string) =>
                result.sections.find(s => s.key === section)!.rows.find(r => r.key === key)!;

            expect(row('INCOME', 'salário')).toMatchObject({ values: [5000], open: [0] });
            expect(row('FIXED', 'internet')).toMatchObject({ values: [120], open: [0] });
            expect(row('FIXED', 'luz')).toMatchObject({ values: [200], open: [200] });
            expect(row('CARDS', 'c1')).toMatchObject({ values: [300], open: [0] }); // due on the 5th, already passed
            expect(result.summary.openIncome).toEqual([0]);
            expect(result.summary.openExpenses).toEqual([200]);
            expect(result.summary.openNet).toEqual([-200]);
        });

        it('merges rows with the same description regardless of case/spacing', () => {
            const result = buildCashFlow({
                months: [month(11, [tx({ type: 'INCOME', description: 'Salário ' }), tx({ type: 'INCOME', description: 'salário' })])],
                openingBalance: 0,
                today,
            });
            expect(result.sections.find(s => s.key === 'INCOME')!.rows).toHaveLength(1);
        });

        it('projects the balance from today using only open items', () => {
            const result = buildCashFlow({
                months: [
                    month(10, [tx({ type: 'INCOME', amount: 9999 })]), // past month
                    month(11, [
                        tx({ type: 'INCOME', amount: 5000, status: 'PAID' }),
                        tx({ type: 'EXPENSE', amount: 300, status: 'PENDING' }),
                    ], [{ id: 'c1', name: 'A', dueDay: 20, total: 700 }]),
                    month(12, [tx({ type: 'INCOME', amount: 5000 }), tx({ type: 'EXPENSE', amount: 1000 })]),
                ],
                openingBalance: 2000,
                today,
            });
            // Oct is closed; Nov: 2000 - 300 - 700; Dec: + 4000
            expect(result.summary.projectedBalance).toEqual([null, 1000, 5000]);
        });

        it('settling an item moves the account balance but not the projection', () => {
            const pending = buildCashFlow({
                months: [month(11, [tx({ type: 'INCOME', amount: 5000, status: 'PENDING' })])],
                openingBalance: 1000,
                today,
            });
            // After "Recebido" the amount is in the account and no longer open
            const received = buildCashFlow({
                months: [month(11, [tx({ type: 'INCOME', amount: 5000, status: 'PAID' })])],
                openingBalance: 6000,
                today,
            });
            expect(pending.summary.projectedBalance).toEqual([6000]);
            expect(received.summary.projectedBalance).toEqual([6000]);
        });

        it('does not double count a future item that was already paid', () => {
            const result = buildCashFlow({
                months: [
                    month(11),
                    month(12, [tx({ type: 'EXPENSE', amount: 500, status: 'PAID' })]), // paid early: already off the balance
                ],
                openingBalance: 1000,
                today,
            });
            expect(result.summary.projectedBalance).toEqual([1000, 1000]);
        });

        it('carries lead-in months when the sheet starts in the future', () => {
            const result = buildCashFlow({
                leadIn: [
                    month(11, [tx({ type: 'EXPENSE', amount: 500, status: 'PENDING' })]),
                    month(12, [tx({ type: 'INCOME', amount: 3000 })]),
                ],
                months: [month(1, [tx({ type: 'EXPENSE', amount: 1000 })], [], 2027)],
                openingBalance: 1000,
                today,
            });
            expect(result.summary.projectedBalance).toEqual([1000 - 500 + 3000 - 1000]);
        });

        it('rounds to cents to avoid floating point noise', () => {
            const result = buildCashFlow({
                months: [month(12, [tx({ amount: 0.1 }), tx({ amount: 0.2 })])],
                openingBalance: 0,
                today,
            });
            expect(result.summary.expenses).toEqual([0.3]);
        });

        it('keeps the card row consolidated and attaches per-holder subRows when there are multiple holders', () => {
            const result = buildCashFlow({
                months: [
                    month(11, [], [{
                        id: 'c6',
                        name: 'C6',
                        dueDay: 15,
                        total: 1500,
                        holders: [
                            { id: 'me', name: 'Matheus (titular)', total: 1000 },
                            { id: 'wife', name: 'Esposa', total: 500 },
                        ],
                    }]),
                ],
                openingBalance: 0,
                today,
            });

            const cardsSection = result.sections.find(s => s.key === 'CARDS');
            expect(cardsSection?.rows[0].values).toEqual([1500]);
            expect(cardsSection?.rows[0].subRows?.map(r => [r.label, r.values])).toEqual([
                ['Matheus (titular)', [1000]],
                ['Esposa', [500]],
            ]);
            expect(result.summary.expenses).toEqual([1500]);
        });

        it('includes passiveIncome in INCOME section with subRows and adds it to openIncome and projectedBalance', () => {
            const result = buildCashFlow({
                months: [
                    {
                        year: 2026,
                        month: 11,
                        transactions: [],
                        cards: [],
                        passiveIncome: {
                            scheduledDividends: 20,
                            projectedFiiDividends: 10,
                            fixedIncomeNetYield: 470,
                        },
                    },
                ],
                openingBalance: 1000,
                today,
            });

            const incomeSection = result.sections.find(s => s.key === 'INCOME');
            const passiveRow = incomeSection?.rows.find(r => r.key === 'passive-income');
            expect(passiveRow?.label).toBe('Rendimentos e Dividendos');
            expect(passiveRow?.values).toEqual([500]);
            expect(passiveRow?.open).toEqual([500]);
            expect(passiveRow?.subRows?.map(r => [r.label, r.values])).toEqual([
                ['Dividendos programados a receber', [20]],
                ['Projeção de dividendos (FIIs)', [10]],
                ['Retorno líquido de Renda Fixa', [470]],
            ]);
            expect(result.summary.income).toEqual([500]);
            expect(result.summary.openIncome).toEqual([500]);
            expect(result.summary.projectedBalance).toEqual([1500]);
        });

        it('groups installment transactions sharing installmentGroupId into a single row across months', () => {
            const result = buildCashFlow({
                months: [
                    month(11, [tx({ description: 'IPTU 2026 (1/2)', amount: 250, status: 'PAID', installmentGroupId: 'grp-iptu' })]),
                    month(12, [tx({ description: 'IPTU 2026 (2/2)', amount: 250, status: 'PENDING', installmentGroupId: 'grp-iptu' })]),
                ],
                openingBalance: 1000,
                today,
            });

            const variable = result.sections.find(s => s.key === 'VARIABLE')!;
            expect(variable.rows).toHaveLength(1);
            expect(variable.rows[0]).toMatchObject({
                label: 'IPTU 2026',
                values: [250, 250],
                open: [0, 250],
                total: 500,
            });
        });

        it('computes CDB IR at maturity using regressive rate and subtracts it from projectedBalance in maturity month', () => {
            const refToday = new Date(2026, 10, 18, 12, 0, 0); // 18/11/2026
            const byMonth = computeCdbMaturityIrByMonth([
                {
                    id: 'cdb-1',
                    name: 'CDB Banco X',
                    type: 'FIXED_INCOME',
                    investedAmount: 10000,
                    grossValue: 12000, // 2000 accumulated profit
                    investmentDate: '2024-01-01T12:00:00.000Z',
                    maturityDate: '2026-12-20T12:00:00.000Z', // > 720 days -> 15% IR => 300.00
                },
                {
                    id: 'cdb-2',
                    name: 'CDB Curto',
                    type: 'FIXED_INCOME',
                    investedAmount: 5000,
                    grossValue: 5500, // 500 accumulated profit
                    investmentDate: '2026-08-01T12:00:00.000Z',
                    maturityDate: '2026-12-10T12:00:00.000Z', // <= 180 days -> 22.5% IR => 112.50
                },
            ], refToday);

            const decTaxes = byMonth.get('2026-12')!;
            expect(decTaxes).toHaveLength(2);
            expect(decTaxes[0].amount).toBe(300);
            expect(decTaxes[1].amount).toBe(112.5);

            const result = buildCashFlow({
                months: [
                    { year: 2026, month: 11, transactions: [], cards: [] },
                    { year: 2026, month: 12, transactions: [], cards: [], cdbIrTaxes: decTaxes },
                    { year: 2027, month: 1, transactions: [], cards: [] },
                ],
                openingBalance: 17500,
                today: refToday,
            });

            const variable = result.sections.find(s => s.key === 'VARIABLE')!;
            const irRow = variable.rows.find(r => r.key === 'cdb-ir-maturity')!;
            expect(irRow.label).toBe('IR CDBs (vencimentos)');
            expect(irRow.values).toEqual([0, 412.5, 0]);
            expect(irRow.open).toEqual([0, 412.5, 0]);
            expect(irRow.subRows?.map(r => [r.label, r.values])).toEqual([
                ['CDB Banco X (venc. 20/12/26)', [0, 300, 0]],
                ['CDB Curto (venc. 10/12/26)', [0, 112.5, 0]],
            ]);
            expect(result.summary.openExpenses).toEqual([0, 412.5, 0]);
            expect(result.summary.projectedBalance).toEqual([17500, 17087.5, 17087.5]);
        });
    });
});
