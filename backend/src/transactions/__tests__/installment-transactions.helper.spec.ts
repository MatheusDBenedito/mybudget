import {
    addMonthsClamped,
    buildTransactionInstallments,
    shouldAdjustAccountBalanceForInstallment,
} from '../helpers/installment-transactions.helper';

describe('installment-transactions.helper', () => {
    it('clamps month-end dates when advancing months (e.g., Jan 31 -> Feb 28)', () => {
        const jan31 = new Date(2026, 0, 31, 12, 0, 0);
        const feb = addMonthsClamped(jan31, 1);
        const mar = addMonthsClamped(jan31, 2);

        expect(feb.getFullYear()).toBe(2026);
        expect(feb.getMonth()).toBe(1);
        expect(feb.getDate()).toBe(28);

        expect(mar.getFullYear()).toBe(2026);
        expect(mar.getMonth()).toBe(2);
        expect(mar.getDate()).toBe(31);
    });

    it('builds up to 12 installments with exact cent distribution and per-parcel status', () => {
        const today = new Date(2026, 10, 12, 14, 0, 0); // 2026-11-12
        const startDate = new Date(2026, 10, 12, 12, 0, 0); // 2026-11-12

        const drafts = buildTransactionInstallments({
            description: 'IPTU 2026',
            amount: 1000,
            date: startDate,
            installments: 3,
            today,
        });

        expect(drafts).toHaveLength(3);
        expect(drafts[0]).toMatchObject({
            description: 'IPTU 2026 (1/3)',
            amount: 333.34,
            status: 'PAID',
            installments: 3,
            installmentNumber: 1,
        });
        expect(drafts[1]).toMatchObject({
            description: 'IPTU 2026 (2/3)',
            amount: 333.33,
            status: 'PENDING',
            installments: 3,
            installmentNumber: 2,
        });
        expect(drafts[2]).toMatchObject({
            description: 'IPTU 2026 (3/3)',
            amount: 333.33,
            status: 'PENDING',
            installments: 3,
            installmentNumber: 3,
        });
        expect(drafts[1].date.getMonth()).toBe(11); // Dec 2026
        expect(drafts[2].date.getFullYear()).toBe(2027);
        expect(drafts[2].date.getMonth()).toBe(0); // Jan 2027
    });

    it('supports long-term financing like 48x and keeps 1x without suffix', () => {
        const today = new Date(2026, 10, 12, 12, 0, 0);
        const single = buildTransactionInstallments({
            description: 'IPVA',
            amount: 500,
            date: today,
            installments: 1,
            today,
        });
        expect(single).toHaveLength(1);
        expect(single[0].description).toBe('IPVA');

        const fortyEight = buildTransactionInstallments({
            description: 'Financiamento Carro',
            amount: 48000,
            date: today,
            installments: 48,
            today,
        });
        expect(fortyEight).toHaveLength(48);
        expect(fortyEight[0].description).toBe('Financiamento Carro (1/48)');
        expect(fortyEight[0].status).toBe('PAID');
        expect(fortyEight[47].description).toBe('Financiamento Carro (48/48)');
        expect(fortyEight[47].status).toBe('PENDING');
        expect(fortyEight[47].amount).toBe(1000);
        expect(fortyEight[47].date.getFullYear()).toBe(2030);
        expect(fortyEight[47].date.getMonth()).toBe(9); // Oct 2030
    });

    it('marks retroactive installments as PAID without deducting from the account balance', () => {
        const today = new Date(2026, 10, 12, 23, 58, 0); // 12/11/2026
        const startDate = new Date(2026, 9, 10, 12, 0, 0); // 10/10/2026

        const drafts = buildTransactionInstallments({
            description: 'Compra Parcelada',
            amount: 2000,
            date: startDate,
            installments: 20,
            today,
        });

        expect(drafts).toHaveLength(20);
        // 10/10/2026 and 10/11/2026 are already PAID, but retroactive -> do not adjust account balance
        expect(drafts[0].status).toBe('PAID');
        expect(drafts[1].status).toBe('PAID');
        expect(shouldAdjustAccountBalanceForInstallment(drafts[0].date, drafts[0].status, today)).toBe(false);
        expect(shouldAdjustAccountBalanceForInstallment(drafts[1].date, drafts[1].status, today)).toBe(false);

        // 10/12/2026 onwards are PENDING
        expect(drafts[2].status).toBe('PENDING');
        expect(shouldAdjustAccountBalanceForInstallment(drafts[2].date, drafts[2].status, today)).toBe(false);

        // An installment dated today IS deducted
        expect(shouldAdjustAccountBalanceForInstallment(new Date(2026, 10, 12, 12, 0, 0), 'PAID', today)).toBe(true);
    });
});

