import {
    mapExternalCardTransactionsToLocal,
    mapExternalTransactionsToLocal,
} from '../helpers/open-finance-sync.helper';

describe('open-finance-sync.helper', () => {
    it('maps CREDIT to INCOME, DEBIT to EXPENSE, and computes net balanceDelta', () => {
        const plan = mapExternalTransactionsToLocal({
            existingExternalIds: new Set(),
            transactions: [
                {
                    id: 'tx-1',
                    description: 'Salário Empresa',
                    amount: 5000,
                    date: '2026-11-05T12:00:00.000Z',
                    type: 'CREDIT',
                },
                {
                    id: 'tx-2',
                    description: 'Supermercado',
                    amount: -320.45,
                    date: '2026-11-06T12:00:00.000Z',
                    type: 'DEBIT',
                },
            ],
        });

        expect(plan.skippedCount).toBe(0);
        expect(plan.toLink).toHaveLength(0);
        expect(plan.toCreate).toHaveLength(2);
        expect(plan.toCreate[0]).toMatchObject({
            externalId: 'tx-1',
            type: 'INCOME',
            amount: 5000,
            status: 'PAID',
        });
        expect(plan.toCreate[1]).toMatchObject({
            externalId: 'tx-2',
            type: 'EXPENSE',
            amount: 320.45,
            status: 'PAID',
        });
        expect(plan.balanceDelta).toBe(4679.55);
    });

    it('deduplicates against existingExternalIds and duplicates inside the same batch', () => {
        const plan = mapExternalTransactionsToLocal({
            existingExternalIds: new Set(['tx-existing']),
            transactions: [
                {
                    id: 'tx-existing',
                    description: 'Já sincronizado',
                    amount: 100,
                    date: '2026-11-01T12:00:00.000Z',
                    type: 'DEBIT',
                },
                {
                    id: 'tx-new',
                    description: 'Novo gasto',
                    amount: 50,
                    date: '2026-11-02T12:00:00.000Z',
                    type: 'DEBIT',
                },
                {
                    id: 'tx-new',
                    description: 'Duplicado no lote',
                    amount: 50,
                    date: '2026-11-02T12:00:00.000Z',
                    type: 'DEBIT',
                },
            ],
        });

        expect(plan.toCreate).toHaveLength(1);
        expect(plan.skippedCount).toBe(2);
        expect(plan.balanceDelta).toBe(-50);
    });

    it('links already-registered manual bank transactions instead of duplicating them or changing balance', () => {
        const plan = mapExternalTransactionsToLocal({
            existingExternalIds: new Set(),
            unlinkedCandidates: [
                {
                    id: 'local-tx-1',
                    amount: 120.5,
                    date: new Date('2026-11-10T12:00:00.000Z'),
                    type: 'EXPENSE',
                },
            ],
            transactions: [
                {
                    id: 'pluggy-tx-1',
                    description: 'PIX Padaria',
                    amount: -120.5,
                    date: '2026-11-11T10:00:00.000Z',
                    type: 'DEBIT',
                },
                {
                    id: 'pluggy-tx-2',
                    description: 'Uber',
                    amount: -25,
                    date: '2026-11-11T15:00:00.000Z',
                    type: 'DEBIT',
                },
            ],
        });

        expect(plan.toLink).toEqual([{ localId: 'local-tx-1', externalId: 'pluggy-tx-1' }]);
        expect(plan.toCreate).toHaveLength(1);
        expect(plan.toCreate[0].externalId).toBe('pluggy-tx-2');
        expect(plan.balanceDelta).toBe(-25);
        expect(plan.skippedCount).toBe(1);
    });

    it('maps credit card purchases, installments, refunds, skips bill payments, and links existing manual entries', () => {
        const plan = mapExternalCardTransactionsToLocal({
            existingExternalIds: new Set(),
            invoiceClosingOffset: 7,
            dueDay: 10,
            unlinkedCandidates: [
                {
                    id: 'manual-card-1',
                    amount: 89.9,
                    date: new Date('2026-11-04T12:00:00.000Z'),
                    invoiceDate: new Date(2026, 10, 10), // Nov 2026
                },
            ],
            transactions: [
                {
                    id: 'cc-manual-match',
                    description: 'Streaming',
                    amount: 89.9,
                    date: '2026-11-04T12:00:00.000Z',
                    type: 'DEBIT',
                    creditCardMetadata: {
                        billForecastDate: '2026-11',
                    },
                },
                {
                    id: 'cc-installment',
                    description: 'Loja Eletrônicos',
                    amount: 250,
                    date: '2026-10-15T12:00:00.000Z',
                    type: 'DEBIT',
                    creditCardMetadata: {
                        installmentNumber: 2,
                        totalInstallments: 5,
                        billForecastDate: '2026-11',
                        cardNumber: '****9988',
                    },
                },
                {
                    id: 'cc-bill-payment',
                    description: 'Pagamento de fatura',
                    amount: 1500,
                    date: '2026-11-05T12:00:00.000Z',
                    type: 'CREDIT',
                },
                {
                    id: 'cc-refund',
                    description: 'Estorno Loja',
                    amount: 40,
                    date: '2026-11-06T12:00:00.000Z',
                    type: 'CREDIT',
                    creditCardMetadata: {
                        billForecastDate: '2026-11',
                    },
                },
            ],
        });

        expect(plan.toLink).toEqual([{ localId: 'manual-card-1', externalId: 'cc-manual-match' }]);
        expect(plan.skippedCount).toBe(2); // 1 linked + 1 bill payment skipped
        expect(plan.toCreate).toHaveLength(2);
        expect(plan.toCreate[0]).toMatchObject({
            externalId: 'cc-installment',
            description: 'Loja Eletrônicos (2/5)',
            amount: 250,
            installments: 5,
            cardLast4: '9988',
        });
        expect(plan.toCreate[0].invoiceDate.getFullYear()).toBe(2026);
        expect(plan.toCreate[0].invoiceDate.getMonth()).toBe(10); // Nov (0-indexed)
        expect(plan.toCreate[1]).toMatchObject({
            externalId: 'cc-refund',
            amount: -40,
        });
    });
});
