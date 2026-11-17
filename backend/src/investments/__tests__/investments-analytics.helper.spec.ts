import {
    buildBenchmarkComparisonSeries,
    buildDailyGainsSeries,
    normalizeAnalyticsRange,
    resolveAnalyticsRangeDays,
} from '../helpers/investments-analytics.helper';

describe('investments-analytics.helper', () => {
    it('normalizes analytics range with all as default', () => {
        expect(normalizeAnalyticsRange(undefined)).toBe('all');
        expect(normalizeAnalyticsRange('invalid')).toBe('all');
        expect(normalizeAnalyticsRange('all')).toBe('all');
        expect(normalizeAnalyticsRange('30d')).toBe('30d');
        expect(normalizeAnalyticsRange('90d')).toBe('90d');
        expect(normalizeAnalyticsRange('180d')).toBe('180d');
        expect(normalizeAnalyticsRange('1y')).toBe('1y');
        expect(resolveAnalyticsRangeDays('90d')).toBe(90);
    });

    it('computes daily gains combining fixed income CDI and variable income price variations', () => {
        const result = buildDailyGainsSeries({
            investments: [
                {
                    id: 'rf-1',
                    type: 'FIXED_INCOME',
                    investedAmount: 10000,
                    currentValue: 10000,
                    investmentDate: new Date('2026-11-02T00:00:00.000Z'),
                    cdiPercentage: 100,
                    tickerCode: null,
                    quantity: null,
                },
                {
                    id: 'vi-1',
                    type: 'VARIABLE_INCOME',
                    investedAmount: 1000,
                    currentValue: 1100,
                    investmentDate: new Date('2026-11-01T00:00:00.000Z'),
                    cdiPercentage: null,
                    tickerCode: 'PETR4',
                    quantity: 10,
                },
            ],
            cdiRates: [
                { date: '02/11/2026', rate: 0.0005 },
                { date: '03/11/2026', rate: 0.0005 },
            ],
            priceHistoryByTicker: new Map([
                [
                    'PETR4',
                    [
                        { date: '2026-11-01', close: 30 },
                        { date: '2026-11-02', close: 32 }, // +2 * 10 = +20
                        { date: '2026-11-03', close: 31 }, // -1 * 10 = -10
                    ],
                ],
            ]),
            usdRate: 5.75,
            startYmd: '2026-11-02',
            endYmd: '2026-11-03',
        });

        expect(result.dailyGains).toHaveLength(2);
        expect(result.dailyGains[0]).toEqual({
            date: '2026-11-02',
            fixedIncomeGain: 5,
            variableIncomeGain: 20,
            totalGain: 25,
            cumulativeGain: 25,
        });
        expect(result.dailyGains[1]).toEqual({
            date: '2026-11-03',
            fixedIncomeGain: 5,
            variableIncomeGain: -10,
            totalGain: -5,
            cumulativeGain: 20,
        });
        expect(result.summary.totalGain).toBe(20);
        expect(result.summary.bestDay).toEqual({ date: '2026-11-02', totalGain: 25 });
        expect(result.summary.worstDay).toEqual({ date: '2026-11-03', totalGain: -5 });
    });

    it('builds benchmark comparison starting at 0% on the first day', () => {
        const benchmarks = buildBenchmarkComparisonSeries({
            dailyGains: [
                { date: '2026-11-02', fixedIncomeGain: 5, variableIncomeGain: 15, totalGain: 20, cumulativeGain: 20 },
                { date: '2026-11-03', fixedIncomeGain: 5, variableIncomeGain: 25, totalGain: 30, cumulativeGain: 50 },
            ],
            startingPortfolioValue: 10000,
            fallbackCapitalBase: 10000,
            cdiRates: [
                { date: '02/11/2026', rate: 0.0005 },
                { date: '03/11/2026', rate: 0.0005 },
            ],
            ipcaMonthlyRates: [{ date: '2026-11-01', rate: 0.0042 }],
            ibovHistory: [
                { date: '2026-11-02', close: 130000 },
                { date: '2026-11-03', close: 131300 }, // +1%
            ],
            sp500History: [
                { date: '2026-11-02', close: 6000 },
                { date: '2026-11-03', close: 6030 }, // +0.5%
            ],
        });

        expect(benchmarks[0]).toEqual({
            date: '2026-11-02',
            portfolioPct: 0.2,
            cdiPct: 0,
            ipcaPct: 0,
            ibovPct: 0,
            sp500Pct: 0,
        });
        expect(benchmarks[1].portfolioPct).toBe(0.5);
        expect(benchmarks[1].cdiPct).toBe(0.05);
        expect(benchmarks[1].ibovPct).toBe(1);
        expect(benchmarks[1].sp500Pct).toBe(0.5);
        expect(benchmarks[1].ipcaPct).toBeGreaterThan(0);
    });
});
