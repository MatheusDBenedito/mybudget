import { bcbDateToYmd, CdiDayRate, toUtcYmd } from './cdi-calculation.helper';

export type AnalyticsRange = '30d' | '90d' | '180d' | '1y';

export interface DailyPricePoint {
    date: string; // YYYY-MM-DD
    close: number;
}

export interface MonthlyRatePoint {
    date: string; // YYYY-MM-DD (first day of month)
    rate: number; // decimal monthly rate (e.g. 0.0045 for 0.45%)
}

export interface AnalyticsInvestmentInput {
    id: string;
    type: string;
    investedAmount: number;
    currentValue: number;
    investmentDate: Date | null;
    cdiPercentage: number | null;
    tickerCode: string | null;
    quantity: number | null;
}

export interface DailyGainPoint {
    date: string;
    fixedIncomeGain: number;
    variableIncomeGain: number;
    totalGain: number;
    cumulativeGain: number;
}

export interface BenchmarkPoint {
    date: string;
    portfolioPct: number | null;
    cdiPct: number | null;
    ipcaPct: number | null;
    ibovPct: number | null;
    sp500Pct: number | null;
}

export interface InvestmentsAnalyticsSummary {
    totalGain: number;
    fixedIncomeGain: number;
    variableIncomeGain: number;
    averageDailyGain: number;
    bestDay: { date: string; totalGain: number } | null;
    worstDay: { date: string; totalGain: number } | null;
}

export function resolveAnalyticsRangeDays(range: AnalyticsRange): number {
    switch (range) {
        case '30d':
            return 30;
        case '180d':
            return 180;
        case '1y':
            return 365;
        case '90d':
        default:
            return 90;
    }
}

export function normalizeAnalyticsRange(raw?: string): AnalyticsRange {
    if (raw === '30d' || raw === '90d' || raw === '180d' || raw === '1y') {
        return raw;
    }
    return '90d';
}

function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Builds daily gain series (Fixed Income CDI + Variable Income mark-to-market)
 * and summary stats for the requested date window [startYmd, endYmd].
 */
export function buildDailyGainsSeries(params: {
    investments: AnalyticsInvestmentInput[];
    cdiRates: CdiDayRate[];
    priceHistoryByTicker: Map<string, DailyPricePoint[]>;
    usdRate: number;
    startYmd: string;
    endYmd: string;
}): {
    dailyGains: DailyGainPoint[];
    summary: InvestmentsAnalyticsSummary;
    startingPortfolioValue: number;
} {
    const { investments, cdiRates, priceHistoryByTicker, usdRate, startYmd, endYmd } = params;

    // 1. Index CDI rates by YYYY-MM-DD sorted ascending
    const cdiByDate = new Map<string, number>();
    for (const r of cdiRates) {
        const ymd = bcbDateToYmd(r.date);
        if (Number.isFinite(r.rate)) {
            cdiByDate.set(ymd, r.rate);
        }
    }
    const sortedCdiDates = [...cdiByDate.keys()].sort();

    // 2. Collect all active dates inside [startYmd, endYmd]
    const activeDateSet = new Set<string>();
    for (const d of sortedCdiDates) {
        if (d >= startYmd && d <= endYmd) activeDateSet.add(d);
    }

    // Index price histories by ticker -> Map<YYYY-MM-DD, close>
    const priceMaps = new Map<string, { dates: string[]; byDate: Map<string, number> }>();
    for (const [ticker, points] of priceHistoryByTicker.entries()) {
        const byDate = new Map<string, number>();
        for (const p of points) {
            if (p.close > 0) byDate.set(p.date, p.close);
        }
        const dates = [...byDate.keys()].sort();
        priceMaps.set(ticker.toUpperCase(), { dates, byDate });
        for (const d of dates) {
            if (d >= startYmd && d <= endYmd) activeDateSet.add(d);
        }
    }

    const activeDates = [...activeDateSet].sort();
    const fixedGainByDate = new Map<string, number>();
    const varGainByDate = new Map<string, number>();

    let startingPortfolioValue = 0;

    // 3. Fixed Income daily compounded gain
    const fixedLots = investments.filter(
        i => i.type === 'FIXED_INCOME' && i.investmentDate && i.cdiPercentage && i.investedAmount > 0,
    );
    for (const lot of fixedLots) {
        const lotStartYmd = toUtcYmd(new Date(lot.investmentDate!));
        const factor = (lot.cdiPercentage ?? 100) / 100;
        let balance = lot.investedAmount;
        let countedStart = false;

        for (const d of sortedCdiDates) {
            if (d < lotStartYmd) continue;
            if (d > endYmd) break;

            if (d >= startYmd && !countedStart) {
                startingPortfolioValue += balance;
                countedStart = true;
            }

            const dayRate = cdiByDate.get(d) ?? 0;
            const dayGain = balance * (dayRate * factor);
            balance += dayGain;

            if (d >= startYmd) {
                fixedGainByDate.set(d, (fixedGainByDate.get(d) ?? 0) + dayGain);
            }
        }
        if (!countedStart && lotStartYmd <= startYmd) {
            startingPortfolioValue += balance;
        }
    }

    // 4. Variable Income daily mark-to-market gain
    const varLots = investments.filter(
        i =>
            (i.type === 'VARIABLE_INCOME' || i.type === 'FII' || i.type === 'US_STOCK' || i.type === 'CRYPTO') &&
            i.tickerCode &&
            (i.quantity ?? 0) > 0,
    );

    for (const lot of varLots) {
        const ticker = lot.tickerCode!.trim().toUpperCase();
        const qty = lot.quantity ?? 0;
        const lotStartYmd = lot.investmentDate ? toUtcYmd(new Date(lot.investmentDate)) : startYmd;
        const fx = lot.type === 'US_STOCK' || lot.type === 'CRYPTO' ? (usdRate > 0 ? usdRate : 5.75) : 1;

        const hist = priceMaps.get(ticker);
        if (!hist || hist.dates.length < 2) {
            if (lotStartYmd <= startYmd) {
                startingPortfolioValue += lot.currentValue > 0 ? lot.currentValue : lot.investedAmount;
            }
            continue;
        }

        let prevClose: number | null = null;
        let countedStart = false;

        for (const d of hist.dates) {
            const close = hist.byDate.get(d)!;
            if (d > endYmd) break;

            if (d >= startYmd && !countedStart && lotStartYmd <= d) {
                startingPortfolioValue += (prevClose ?? close) * qty * fx;
                countedStart = true;
            }

            if (d >= startYmd && d >= lotStartYmd && prevClose != null) {
                const dayGain = (close - prevClose) * qty * fx;
                varGainByDate.set(d, (varGainByDate.get(d) ?? 0) + dayGain);
            }

            prevClose = close;
        }
    }

    // 5. Assemble daily series
    const dailyGains: DailyGainPoint[] = [];
    let cumulativeGain = 0;
    let totalFixed = 0;
    let totalVar = 0;
    let bestDay: { date: string; totalGain: number } | null = null;
    let worstDay: { date: string; totalGain: number } | null = null;

    for (const date of activeDates) {
        const fixedIncomeGain = round2(fixedGainByDate.get(date) ?? 0);
        const variableIncomeGain = round2(varGainByDate.get(date) ?? 0);
        const totalGain = round2(fixedIncomeGain + variableIncomeGain);
        cumulativeGain = round2(cumulativeGain + totalGain);
        totalFixed = round2(totalFixed + fixedIncomeGain);
        totalVar = round2(totalVar + variableIncomeGain);

        const point: DailyGainPoint = {
            date,
            fixedIncomeGain,
            variableIncomeGain,
            totalGain,
            cumulativeGain,
        };
        dailyGains.push(point);

        if (!bestDay || totalGain > bestDay.totalGain) {
            bestDay = { date, totalGain };
        }
        if (!worstDay || totalGain < worstDay.totalGain) {
            worstDay = { date, totalGain };
        }
    }

    const totalGain = round2(totalFixed + totalVar);
    const averageDailyGain = dailyGains.length > 0 ? round2(totalGain / dailyGains.length) : 0;

    return {
        dailyGains,
        startingPortfolioValue: round2(startingPortfolioValue),
        summary: {
            totalGain,
            fixedIncomeGain: totalFixed,
            variableIncomeGain: totalVar,
            averageDailyGain,
            bestDay,
            worstDay,
        },
    };
}

/**
 * Computes normalized percentage return curves (starting at 0%) for the portfolio
 * against CDI, IPCA, IBOV, and S&P 500 over the daily series dates.
 */
export function buildBenchmarkComparisonSeries(params: {
    dailyGains: DailyGainPoint[];
    startingPortfolioValue: number;
    fallbackCapitalBase: number;
    cdiRates: CdiDayRate[];
    ipcaMonthlyRates: MonthlyRatePoint[];
    ibovHistory: DailyPricePoint[];
    sp500History: DailyPricePoint[];
}): BenchmarkPoint[] {
    const {
        dailyGains,
        startingPortfolioValue,
        fallbackCapitalBase,
        cdiRates,
        ipcaMonthlyRates,
        ibovHistory,
        sp500History,
    } = params;

    if (dailyGains.length === 0) return [];

    const dates = dailyGains.map(d => d.date);
    const firstDate = dates[0];

    // Portfolio base capital
    const capitalBase = startingPortfolioValue > 0 ? startingPortfolioValue : fallbackCapitalBase;

    // CDI map
    const cdiByDate = new Map<string, number>();
    for (const r of cdiRates) {
        cdiByDate.set(bcbDateToYmd(r.date), r.rate);
    }

    // IPCA daily equivalent rate per YYYY-MM
    const ipcaByMonth = new Map<string, number>();
    for (const m of ipcaMonthlyRates) {
        ipcaByMonth.set(m.date.slice(0, 7), m.rate);
    }

    // Index price histories with carry-forward lookup
    const buildPctLookup = (history: DailyPricePoint[]) => {
        const sorted = [...history].filter(p => p.close > 0).sort((a, b) => a.date.localeCompare(b.date));
        let baseClose: number | null = null;
        for (const p of sorted) {
            if (p.date >= firstDate) {
                baseClose = p.close;
                break;
            }
        }
        if (baseClose == null && sorted.length > 0) {
            baseClose = sorted[sorted.length - 1].close;
        }
        return (date: string): number | null => {
            if (baseClose == null || baseClose <= 0) return null;
            let latest: number | null = null;
            for (const p of sorted) {
                if (p.date <= date) latest = p.close;
                else break;
            }
            if (latest == null) return 0;
            return round2(((latest / baseClose) - 1) * 100);
        };
    };

    const getIbovPct = buildPctLookup(ibovHistory);
    const getSp500Pct = buildPctLookup(sp500History);

    let cdiAcc = 1;
    let ipcaAcc = 1;
    let lastIpcaMonth: string | null = null;

    return dailyGains.map((g, idx) => {
        if (idx > 0) {
            const cdiDay = cdiByDate.get(g.date) ?? 0;
            cdiAcc *= 1 + cdiDay;

            const monthKey = g.date.slice(0, 7);
            const monthRate = ipcaByMonth.get(monthKey);
            // Approximate daily IPCA compounding (~21 business days/month) on CDI/active days
            if (monthRate != null) {
                const approxDailyIpca = Math.pow(1 + monthRate, 1 / 21) - 1;
                ipcaAcc *= 1 + approxDailyIpca;
                lastIpcaMonth = monthKey;
            } else if (lastIpcaMonth && ipcaByMonth.has(lastIpcaMonth)) {
                const fallbackRate = ipcaByMonth.get(lastIpcaMonth)!;
                ipcaAcc *= 1 + (Math.pow(1 + fallbackRate, 1 / 21) - 1);
            }
        }

        const portfolioPct = capitalBase > 0 ? round2((g.cumulativeGain / capitalBase) * 100) : null;

        return {
            date: g.date,
            portfolioPct,
            cdiPct: round2((cdiAcc - 1) * 100),
            ipcaPct: round2((ipcaAcc - 1) * 100),
            ibovPct: getIbovPct(g.date),
            sp500Pct: getSp500Pct(g.date),
        };
    });
}
