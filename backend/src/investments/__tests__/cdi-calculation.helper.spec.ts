import {
    bcbDateToYmd,
    CdiDayRate,
    compoundWithRealRates,
    filterCdiRatesByRange,
    toUtcYmd,
} from '../helpers/cdi-calculation.helper';

describe('cdi-calculation.helper', () => {
    describe('toUtcYmd', () => {
        it('formats Date to YYYY-MM-DD using UTC calendar values', () => {
            const d1 = new Date('2024-03-12T00:00:00.000Z');
            expect(toUtcYmd(d1)).toBe('2024-03-12');

            const d2 = new Date('2024-03-12T23:59:59.999Z');
            expect(toUtcYmd(d2)).toBe('2024-03-12');

            const d3 = new Date('2026-11-01T05:00:00.000Z');
            expect(toUtcYmd(d3)).toBe('2026-11-01');
        });
    });

    describe('bcbDateToYmd', () => {
        it('converts DD/MM/YYYY string to YYYY-MM-DD', () => {
            expect(bcbDateToYmd('12/03/2024')).toBe('2024-03-12');
            expect(bcbDateToYmd('01/11/2026')).toBe('2026-11-01');
            expect(bcbDateToYmd('5/4/2025')).toBe('2025-04-05');
        });
    });

    describe('filterCdiRatesByRange', () => {
        const sampleRates: CdiDayRate[] = [
            { date: '10/03/2024', rate: 0.0004 },
            { date: '11/03/2024', rate: 0.00041 },
            { date: '12/03/2024', rate: 0.00042 },
            { date: '13/03/2024', rate: 0.00043 },
            { date: '14/03/2024', rate: 0.00044 },
            { date: '15/03/2024', rate: 0.00045 },
        ];

        it('includes the start date rate and end date rate inclusive', () => {
            const start = new Date('2024-03-12T00:00:00.000Z');
            const end = new Date('2024-03-14T00:00:00.000Z');

            const filtered = filterCdiRatesByRange(sampleRates, start, end);
            expect(filtered.map(r => r.date)).toEqual(['12/03/2024', '13/03/2024', '14/03/2024']);
        });

        it('returns empty array when no rates fall within range', () => {
            const start = new Date('2025-01-01T00:00:00.000Z');
            const end = new Date('2025-01-10T00:00:00.000Z');

            const filtered = filterCdiRatesByRange(sampleRates, start, end);
            expect(filtered).toEqual([]);
        });

        it('yields identical results regardless of whether dates are instantiated at start or end of day', () => {
            const startAtStartOfDay = new Date('2024-03-12T00:00:00.000Z');
            const startAtEndOfDay = new Date('2024-03-12T23:59:59.000Z');
            const end = new Date('2024-03-13T12:00:00.000Z');

            const res1 = filterCdiRatesByRange(sampleRates, startAtStartOfDay, end);
            const res2 = filterCdiRatesByRange(sampleRates, startAtEndOfDay, end);

            expect(res1).toEqual(res2);
            expect(res1.map(r => r.date)).toEqual(['12/03/2024', '13/03/2024']);
        });
    });

    describe('compoundWithRealRates', () => {
        it('compounds correctly with 100% CDI', () => {
            const rates: CdiDayRate[] = [
                { date: '01/03/2024', rate: 0.0005 }, // 0.05%
                { date: '04/03/2024', rate: 0.0005 },
            ];

            const initial = 10000;
            // Expected: 10000 * (1 + 0.0005) * (1 + 0.0005) = 10000 * 1.0005 * 1.0005 = 10010.0025
            const result = compoundWithRealRates(initial, 100, rates);
            expect(result).toBeCloseTo(10010.0025, 4);
        });

        it('compounds correctly with 110% CDI', () => {
            const rates: CdiDayRate[] = [
                { date: '01/03/2024', rate: 0.001 }, // 0.1%
            ];

            const initial = 1000;
            // 110% of 0.001 = 0.0011 -> 1000 * 1.0011 = 1001.1
            const result = compoundWithRealRates(initial, 110, rates);
            expect(result).toBeCloseTo(1001.1, 4);
        });

        it('returns original amount when rates array is empty', () => {
            const result = compoundWithRealRates(5000, 100, []);
            expect(result).toBe(5000);
        });
    });
});
