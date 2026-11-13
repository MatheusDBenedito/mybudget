import {
    dividendKey,
    planDividendCredits,
    resolveAccountLinkUpdate,
    startOfUtcDay,
} from '../helpers/dividend-credit.helper';

describe('dividend-credit.helper', () => {
    describe('resolveAccountLinkUpdate', () => {
        const now = new Date('2026-11-13T15:30:00.000Z');

        it('returns undefined when accountId is omitted in partial update', () => {
            expect(resolveAccountLinkUpdate(undefined, 'acc-1', now, now)).toBeUndefined();
        });

        it('clears accountId and accountLinkedAt when null or empty string is passed', () => {
            expect(resolveAccountLinkUpdate(null, 'acc-1', now, now)).toEqual({
                accountId: null,
                accountLinkedAt: null,
            });
            expect(resolveAccountLinkUpdate('', 'acc-1', now, now)).toEqual({
                accountId: null,
                accountLinkedAt: null,
            });
        });

        it('sets accountLinkedAt to start of UTC day when linking a new account', () => {
            expect(resolveAccountLinkUpdate('acc-2', null, null, now)).toEqual({
                accountId: 'acc-2',
                accountLinkedAt: startOfUtcDay(now),
            });
        });

        it('preserves existing accountLinkedAt when keeping the same account', () => {
            const oldLink = new Date('2026-10-01T00:00:00.000Z');
            expect(resolveAccountLinkUpdate('acc-1', 'acc-1', oldLink, now)).toEqual({
                accountId: 'acc-1',
                accountLinkedAt: oldLink,
            });
        });
    });

    describe('planDividendCredits', () => {
        const now = new Date('2026-11-13T14:00:00.000Z');
        const linkedAt = new Date('2026-11-10T00:00:00.000Z');

        it('credits USD dividends to a USD account (C6 Global) and skips historical pre-link dividends', () => {
            const rows = [
                {
                    date: new Date('2026-11-05T00:00:00.000Z'), // before linkedAt
                    amountPerShare: 0.5,
                    totalOriginal: 5.0,
                    currency: 'USD',
                    totalBrl: 28.0,
                },
                {
                    date: new Date('2026-11-13T00:00:00.000Z'), // eligible today
                    amountPerShare: 0.6,
                    totalOriginal: 6.0,
                    currency: 'USD',
                    totalBrl: 33.6,
                },
            ];

            const plan = planDividendCredits({
                rows,
                existingByKey: new Map(),
                account: { id: 'c6-global', currency: 'USD' },
                accountLinkedAt: linkedAt,
                usdRate: 5.6,
                now,
            });

            expect(plan.newlyCreditedCount).toBe(1);
            expect(plan.usdDelta).toBe(6.0);
            expect(plan.brlDelta).toBe(33.6);
            expect(plan.rows[0].creditedAt).toBeNull();
            expect(plan.rows[1].creditedAccountId).toBe('c6-global');
            expect(plan.rows[1].creditedAt).toEqual(now);
        });

        it('credits BRL dividends to a BRL account (Clear) and preserves idempotency on re-sync', () => {
            const d1 = new Date('2026-11-12T00:00:00.000Z');
            const d2 = new Date('2026-11-13T00:00:00.000Z');
            const prevCreditedAt = new Date('2026-11-12T18:00:00.000Z');

            const existingByKey = new Map([
                [
                    dividendKey(d1, 0.9),
                    { creditedAccountId: 'clear-brl', creditedAt: prevCreditedAt },
                ],
            ]);

            const plan = planDividendCredits({
                rows: [
                    {
                        date: d1,
                        amountPerShare: 0.9,
                        totalOriginal: 90,
                        currency: 'BRL',
                        totalBrl: 90,
                    },
                    {
                        date: d2,
                        amountPerShare: 1.1,
                        totalOriginal: 110,
                        currency: 'BRL',
                        totalBrl: 110,
                    },
                ],
                existingByKey,
                account: { id: 'clear-brl', currency: 'BRL' },
                accountLinkedAt: linkedAt,
                usdRate: 5.6,
                now,
            });

            expect(plan.newlyCreditedCount).toBe(1);
            expect(plan.brlDelta).toBe(110);
            expect(plan.usdDelta).toBe(0);
            expect(plan.rows[0].creditedAt).toEqual(prevCreditedAt);
            expect(plan.rows[1].creditedAccountId).toBe('clear-brl');
        });

        it('does not credit future-dated dividends or when no account is linked', () => {
            const futureRow = {
                date: new Date('2026-11-20T00:00:00.000Z'),
                amountPerShare: 1.0,
                totalOriginal: 50,
                currency: 'BRL',
                totalBrl: 50,
            };

            const planFuture = planDividendCredits({
                rows: [futureRow],
                existingByKey: new Map(),
                account: { id: 'clear-brl', currency: 'BRL' },
                accountLinkedAt: linkedAt,
                usdRate: 5.6,
                now,
            });
            expect(planFuture.newlyCreditedCount).toBe(0);

            const planNoAccount = planDividendCredits({
                rows: [
                    {
                        date: new Date('2026-11-13T00:00:00.000Z'),
                        amountPerShare: 1.0,
                        totalOriginal: 50,
                        currency: 'BRL',
                        totalBrl: 50,
                    },
                ],
                existingByKey: new Map(),
                account: null,
                accountLinkedAt: null,
                usdRate: 5.6,
                now,
            });
            expect(planNoAccount.newlyCreditedCount).toBe(0);
        });
    });
});

