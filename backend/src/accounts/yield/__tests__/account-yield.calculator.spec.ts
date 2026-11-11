import {
    bcbDateToKey, daysBetween, firstYieldDay, irRateForDays, openingBalanceFor, simulateBucket, toDateKey, type DailyCdi,
} from '../account-yield.calculator';

/** One CDI business day per weekday between two dates (inclusive). */
function businessDays(from: string, to: string, ratePercent = 0.05): DailyCdi[] {
    const out: DailyCdi[] = [];
    for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
        const d = new Date(t);
        if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push({ date: d.toISOString().slice(0, 10), ratePercent });
    }
    return out;
}

describe('account yield calculator (lots)', () => {
    describe('irRateForDays', () => {
        it('follows the regressive table counted from each deposit', () => {
            expect(irRateForDays(0)).toBe(0.225);
            expect(irRateForDays(180)).toBe(0.225);
            expect(irRateForDays(181)).toBe(0.2);
            expect(irRateForDays(360)).toBe(0.2);
            expect(irRateForDays(361)).toBe(0.175);
            expect(irRateForDays(720)).toBe(0.175);
            expect(irRateForDays(721)).toBe(0.15);
        });
    });

    describe('simulateBucket', () => {
        const cdiDays = businessDays('2026-11-02', '2026-11-10');

        it('credits each business day until yesterday with IR, compounding', () => {
            const { credits } = simulateBucket({
                startKey: '2026-11-05', todayKey: '2026-11-10', cdiPercentage: 100, cdiDays,
                openingBalance: 10_000, movements: [], creditedKeys: new Set(),
            });
            expect(credits.map(c => c.date)).toEqual(['2026-11-05', '2026-11-06', '2026-11-09']);
            // 10.000 × 0,05% = 5,00 bruto; IR 22,5% = 1,13; líquido 3,87
            expect(credits[0]).toMatchObject({ balanceBefore: 10_000, grossAmount: 5, taxAmount: 1.13, netAmount: 3.87, taxRefund: 0, irRate: 0.225 });
            expect(credits[1].balanceBefore).toBeCloseTo(10_003.88, 1);
        });

        it('a deposit earns from the day it settles; weekends and holidays move it to the next business day', () => {
            const days = businessDays('2026-04-06', '2026-04-24').filter(d => d.date !== '2026-04-21'); // Tiradentes
            const keys = days.map(d => d.date);
            // Sunday 12/04 -> earns the CDI of Monday 13/04 (Mercado Pago posts it on 14/04)
            expect(firstYieldDay('2026-04-12', keys)).toBe('2026-04-13');
            expect(firstYieldDay('2026-04-14', keys)).toBe('2026-04-14');
            expect(firstYieldDay('2026-04-21', keys)).toBe('2026-04-22'); // on the holiday -> next business day
            expect(firstYieldDay('2026-04-25', keys)).toBe('9999-12-31'); // not published yet

            const { credits } = simulateBucket({
                startKey: '2026-04-12', todayKey: '2026-04-25', cdiPercentage: 120, cdiDays: days,
                openingBalance: 100, movements: [], creditedKeys: new Set(),
            });
            expect(credits[0]).toMatchObject({ date: '2026-04-13', balanceBefore: 100 });
            expect(credits[0].grossAmount).toBeGreaterThan(0);
            expect(credits.find(c => c.date === '2026-04-21')).toBeUndefined(); // no CDI on holidays
        });

        it('uses the deposits and withdrawals of each day (system off for days)', () => {
            const { credits } = simulateBucket({
                startKey: '2026-11-03', todayKey: '2026-11-10', cdiPercentage: 100, cdiDays,
                openingBalance: 10_000,
                movements: [{ date: '2026-11-05', delta: 2000 }, { date: '2026-11-06', delta: -500 }],
                creditedKeys: new Set(),
            });
            expect(credits[0].balanceBefore).toBe(10_000);              // 03
            expect(credits[2].balanceBefore).toBeCloseTo(12_007.75, 1); // 05: deposit + 2 days of yield
            expect(credits[3].balanceBefore).toBeCloseTo(11_512.4, 0);  // 06: after the 500 withdrawal
        });

        it('each deposit has its own IR clock: the older lot changes bracket, the newer one does not', () => {
            // R$ 1.000 on 2026-01-01 and R$ 500 on 2026-04-11 (100 days later); look at 2026-07-01 (day 181 of the first lot)
            const { credits, lots } = simulateBucket({
                startKey: '2026-01-01', todayKey: '2026-07-02', cdiPercentage: 100,
                cdiDays: businessDays('2026-01-01', '2026-07-01'),
                openingBalance: 1000,
                movements: [{ date: '2026-04-11', delta: 500 }],
                creditedKeys: new Set(),
            });
            const before = credits.find(c => c.date === '2026-06-30')!;
            const crossing = credits.find(c => c.date === '2026-07-01')!;
            expect(daysBetween('2026-01-01', '2026-07-01')).toBe(181);
            expect(before.irRate).toBeCloseTo(0.225, 2);              // both lots still at 22,5%
            expect(crossing.irRate).toBeGreaterThan(0.2);             // weighted: 1.000 now at 20%, 500 still at 22,5%
            expect(crossing.irRate).toBeLessThan(0.224);

            expect(lots).toHaveLength(2);
            expect(lots[0]).toMatchObject({ date: '2026-01-01', irRate: 0.2 });
            expect(lots[1]).toMatchObject({ date: '2026-04-11', irRate: 0.225 });
        });

        it('keeps IR already withheld when a lot reaches a lower bracket (Mercado Pago)', () => {
            const { credits, lots } = simulateBucket({
                startKey: '2026-01-01', todayKey: '2026-07-10', cdiPercentage: 100,
                cdiDays: businessDays('2026-01-01', '2026-07-09'),
                openingBalance: 1000, movements: [], creditedKeys: new Set(),
            });
            expect(credits.every(c => c.taxRefund === 0)).toBe(true);
            // 180 days withheld at 22,5% and the last days at 20%: overall above 20% of everything earned
            expect(lots[0].tax / lots[0].gross).toBeGreaterThan(0.22);
            expect(credits.find(c => c.date === '2026-07-02')!.irRate).toBeCloseTo(0.2, 2);
        });

        it('truncates each day\'s gross yield to the cent, like Mercado Pago (R$ 100 a 120% desde 12/04)', () => {
            const { credits, lots } = simulateBucket({
                startKey: '2026-04-12', todayKey: '2026-11-10', cdiPercentage: 120,
                cdiDays: businessDays('2026-04-13', '2026-11-09', 0.054266),
                openingBalance: 100, movements: [], creditedKeys: new Set(),
            });
            const credited = credits.reduce((acc, c) => acc + c.netAmount + c.taxRefund, 0);
            // What was credited matches the exact value of the deposit to the cent
            expect(Math.abs(100 + credited - lots[0].value)).toBeLessThanOrEqual(0.01);
            // R$ 100 × 0,054266% × 120% = R$ 0,0651 gross -> credited as R$ 0,06; IR 22,5% rounded over the running total
            expect(credits.slice(0, 5).map(c => c.grossAmount)).toEqual([0.06, 0.06, 0.06, 0.06, 0.06]);
            expect(credits.slice(0, 5).map(c => c.netAmount)).toEqual([0.05, 0.04, 0.05, 0.05, 0.04]);
            // Never more than the exact daily rate
            expect(credits.every(c => c.grossAmount <= c.balanceBefore * 0.054266 / 100 * 1.2 + 1e-9)).toBe(true);
        });

        it('withdrawals consume the oldest lots first (PEPS)', () => {
            const { lots } = simulateBucket({
                startKey: '2026-11-02', todayKey: '2026-11-10', cdiPercentage: 100, cdiDays: [],
                openingBalance: 1000,
                movements: [{ date: '2026-11-03', delta: 500 }, { date: '2026-11-04', delta: -1200 }],
                creditedKeys: new Set(),
            });
            // 1.000 lot fully withdrawn, 200 taken from the 500 lot
            expect(lots).toHaveLength(1);
            expect(lots[0]).toMatchObject({ date: '2026-11-03', principal: 300, value: 300 });
        });

        it('never re-credits days already credited, but still evolves the lots through them', () => {
            const all = simulateBucket({
                startKey: '2026-11-03', todayKey: '2026-11-10', cdiPercentage: 100, cdiDays,
                openingBalance: 10_000, movements: [], creditedKeys: new Set(),
            });
            const rest = simulateBucket({
                startKey: '2026-11-03', todayKey: '2026-11-10', cdiPercentage: 100, cdiDays,
                openingBalance: 10_000, movements: [], creditedKeys: new Set(['2026-11-03', '2026-11-04', '2026-11-05']),
            });
            expect(rest.credits.map(c => c.date)).toEqual(['2026-11-06', '2026-11-09']);
            expect(rest.credits).toEqual(all.credits.slice(3));
        });

        it('returns nothing before the bucket started and keeps zero-yield days', () => {
            expect(simulateBucket({
                startKey: '2026-11-10', todayKey: '2026-11-10', cdiPercentage: 100, cdiDays,
                openingBalance: 10_000, movements: [], creditedKeys: new Set(),
            }).credits).toEqual([]);

            const empty = simulateBucket({
                startKey: '2026-11-09', todayKey: '2026-11-10', cdiPercentage: 100, cdiDays,
                openingBalance: 0, movements: [], creditedKeys: new Set(),
            });
            expect(empty.credits).toHaveLength(1);
            expect(empty.credits[0].netAmount).toBe(0);
        });

        it('includes today\'s movements in the lots snapshot', () => {
            const { lots } = simulateBucket({
                startKey: '2026-11-03', todayKey: '2026-11-10', cdiPercentage: 100, cdiDays: [],
                openingBalance: 100, movements: [{ date: '2026-11-10', delta: 50 }], creditedKeys: new Set(),
            });
            expect(lots.map(l => [l.date, l.value])).toEqual([['2026-11-03', 100], ['2026-11-10', 50]]);
        });
    });

    describe('openingBalanceFor', () => {
        it('undoes later movements and credited yields from the current balance', () => {
            expect(openingBalanceFor('2026-11-03', 11_520, [
                { date: '2026-11-01', delta: 999 }, // before start: ignored
                { date: '2026-11-05', delta: 2000 },
                { date: '2026-11-06', delta: -500 },
            ], 20)).toBe(10_000);
        });
    });

    describe('date helpers', () => {
        it('converts BCB dates and local dates to yyyy-mm-dd keys', () => {
            expect(bcbDateToKey('05/11/2026')).toBe('2026-11-05');
            expect(toDateKey(new Date(2026, 10, 5, 23, 59))).toBe('2026-11-05');
            expect(daysBetween('2026-05-13', '2026-11-09')).toBe(180);
        });
    });
});
