// Pure calculation for 12-month passive income projections:
// 1. Scheduled dividends to receive (PENDING dividends with paymentDate > today)
// 2. Projected monthly FII dividends based on per-share historical average and current share quantity
// 3. Projected monthly net yield from Fixed Income (CDB/Renda Fixa) after regressive IR tax

import { countBusinessDays } from '../business-days.util';

export type ProjectionInvestmentInput = {
    id: string;
    name: string;
    type: string;
    tickerCode?: string | null;
    quantity?: number | null;
    investedAmount: number;
    currentValue: number;
    grossValue?: number | null;
    investmentDate?: Date | string | null;
    cdiPercentage?: number | null;
};

export type ProjectionDividendInput = {
    id: string;
    investmentId: string;
    tickerCode: string;
    date: Date | string;
    amountPerShare: number;
    quantity: number;
    totalOriginal: number;
    currency: string;
    totalBrl: number;
    investment: {
        id: string;
        name: string;
        type: string;
    };
};

export type ScheduledDividendItem = {
    key: string;
    tickerCode: string;
    name: string;
    type: string;
    exDate: string;
    paymentDate: string;
    quantity: number;
    amountPerShare: number;
    currency: string;
    totalBrl: number;
};

export type FiiProjectionBreakdown = {
    tickerCode: string;
    name: string;
    quantity: number;
    avgPerShareBrl: number;
    monthlyExpectedBrl: number;
    annualExpectedBrl: number;
};

export type MonthlyProjectionPoint = {
    year: number;
    month: number; // 1..12
    monthKey: string; // "YYYY-MM"
    businessDaysTotal: number;
    businessDaysElapsed: number;
    businessDaysRemaining: number;
    scheduledDividends: number;
    projectedFiiDividends: number;
    fixedIncomeNetYield: number;
    fixedIncomeGrossYield: number;
    fixedIncomeTax: number;
    total: number;
};

export type InvestmentsProjectionResult = {
    months: MonthlyProjectionPoint[];
    scheduledItems: ScheduledDividendItem[];
    fiiBreakdown: FiiProjectionBreakdown[];
    summary: {
        total12m: number;
        monthlyAverage12m: number;
        scheduledTotalBrl: number;
        scheduledCount: number;
        fiiMonthlyAverageBrl: number;
        fiiProjected12mBrl: number;
        fiiTotal12mBrl: number;
        fixedIncomeNet12mBrl: number;
        fixedIncomeGross12mBrl: number;
        fixedIncomeTax12mBrl: number;
        fixedIncomeMonthlyAvgNetBrl: number;
        fixedIncomePrincipalGrossBrl: number;
    };
};

export type CalculateProjectionsInput = {
    investments: ProjectionInvestmentInput[];
    dividends: ProjectionDividendInput[];
    startMonth: number; // 1..12
    startYear: number;
    monthsCount?: number;
    today?: Date;
    /** Daily CDI rate as a decimal (e.g. 0.00055131 for ~14.9% p.a.) */
    cdiDailyRate?: number;
};

const DEFAULT_CDI_ANNUAL = 0.149;
const BUSINESS_DAYS_PER_YEAR = 252;
const DEFAULT_CDI_DAILY = Math.pow(1 + DEFAULT_CDI_ANNUAL, 1 / BUSINESS_DAYS_PER_YEAR) - 1;

function getMonthBusinessDaysInfo(year: number, month: number, today: Date): {
    total: number;
    elapsed: number;
    remaining: number;
} {
    const prevMonthEnd = new Date(year, month - 1, 0);
    const monthEnd = new Date(year, month, 0);
    const total = countBusinessDays(prevMonthEnd, monthEnd);
    const mIdx = monthIndex(year, month);
    const currentIdx = monthIndex(today.getFullYear(), today.getMonth() + 1);

    if (mIdx < currentIdx) {
        return { total, elapsed: total, remaining: 0 };
    }
    if (mIdx === currentIdx) {
        const elapsed = countBusinessDays(prevMonthEnd, today);
        const remaining = countBusinessDays(today, monthEnd);
        return { total, elapsed, remaining };
    }
    return { total, elapsed: 0, remaining: total };
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const round4 = (v: number) => Math.round(v * 10000) / 10000;
const monthIndex = (year: number, month: number) => year * 12 + (month - 1);
const fromIndex = (index: number) => ({ year: Math.floor(index / 12), month: (index % 12) + 1 });
const formatMonthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

function nthBusinessDayOfMonth(year: number, month0: number, n: number): Date {
    const d = new Date(Date.UTC(year, month0, 1, 13, 0, 0));
    let count = 0;
    while (count < n) {
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) {
            count++;
            if (count === n) break;
        }
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return d;
}

function addBusinessDays(start: Date, businessDays: number): Date {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 13, 0, 0));
    let added = 0;
    while (added < businessDays) {
        d.setUTCDate(d.getUTCDate() + 1);
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) {
            added++;
        }
    }
    return d;
}

export function estimateDividendPaymentDate(exDate: Date, type: string, tickerCode: string): Date {
    const ticker = tickerCode.trim().toUpperCase();
    const year = exDate.getUTCFullYear();
    const month0 = exDate.getUTCMonth();
    const day = exDate.getUTCDate();

    if (type === 'FII') {
        if (day >= 27) return nthBusinessDayOfMonth(year, month0 + 1, 10);
        if (day <= 6) return nthBusinessDayOfMonth(year, month0, 10);
        if (day <= 13) return addBusinessDays(exDate, 5);
        const d25 = new Date(Date.UTC(year, month0, 25, 13, 0, 0));
        if (d25.getUTCDay() === 6) d25.setUTCDate(27);
        if (d25.getUTCDay() === 0) d25.setUTCDate(26);
        return d25 > exDate ? d25 : addBusinessDays(exDate, 5);
    }

    if (type === 'US_STOCK') {
        return addBusinessDays(exDate, 4);
    }

    if (['BBDC4', 'BBDC3', 'ITUB4', 'ITUB3', 'ITSA4', 'SANB11'].includes(ticker) && day <= 5) {
        return addBusinessDays(exDate, 2);
    }

    return addBusinessDays(exDate, 10);
}

export function irRateForCalendarDays(calendarDays: number): number {
    if (calendarDays <= 180) return 0.225;
    if (calendarDays <= 360) return 0.20;
    if (calendarDays <= 720) return 0.175;
    return 0.15;
}

export function calculateInvestmentsProjection({
    investments,
    dividends,
    startMonth,
    startYear,
    monthsCount = 12,
    today = new Date(),
    cdiDailyRate = DEFAULT_CDI_DAILY,
}: CalculateProjectionsInput): InvestmentsProjectionResult {
    const startIdx = monthIndex(startYear, startMonth);
    const currentIdx = monthIndex(today.getFullYear(), today.getMonth() + 1);
    const refEndTime = Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
        23, 59, 59,
    );

    const months: MonthlyProjectionPoint[] = Array.from({ length: monthsCount }, (_, i) => {
        const { year, month } = fromIndex(startIdx + i);
        const bDays = getMonthBusinessDaysInfo(year, month, today);
        return {
            year,
            month,
            monthKey: formatMonthKey(year, month),
            businessDaysTotal: bDays.total,
            businessDaysElapsed: bDays.elapsed,
            businessDaysRemaining: bDays.remaining,
            scheduledDividends: 0,
            projectedFiiDividends: 0,
            fixedIncomeNetYield: 0,
            fixedIncomeGrossYield: 0,
            fixedIncomeTax: 0,
            total: 0,
        };
    });

    const monthMap = new Map<string, MonthlyProjectionPoint>();
    for (const m of months) {
        monthMap.set(m.monthKey, m);
    }

    // 1. Scheduled (PENDING) dividends with paymentDate > today
    const scheduledGroups = new Map<string, ScheduledDividendItem>();
    const scheduledFiiTickersByMonth = new Map<string, Set<string>>();

    for (const div of dividends) {
        const exDate = new Date(div.date);
        if (Number.isNaN(exDate.getTime())) continue;
        const payDate = estimateDividendPaymentDate(exDate, div.investment.type, div.tickerCode);
        if (Number.isNaN(payDate.getTime()) || payDate.getTime() <= refEndTime) continue;

        const payYear = payDate.getUTCFullYear();
        const payMonth = payDate.getUTCMonth() + 1;
        const mKey = formatMonthKey(payYear, payMonth);
        const ticker = div.tickerCode.trim().toUpperCase();

        const bucket = monthMap.get(mKey);
        if (bucket) {
            bucket.scheduledDividends = round2(bucket.scheduledDividends + div.totalBrl);
        }

        if (div.investment.type === 'FII') {
            let set = scheduledFiiTickersByMonth.get(mKey);
            if (!set) {
                set = new Set<string>();
                scheduledFiiTickersByMonth.set(mKey, set);
            }
            set.add(ticker);
        }

        const groupKey = `${ticker}:${payDate.toISOString().slice(0, 10)}:${div.amountPerShare}`;
        const existing = scheduledGroups.get(groupKey);
        if (existing) {
            existing.quantity = round2(existing.quantity + div.quantity);
            existing.totalBrl = round2(existing.totalBrl + div.totalBrl);
        } else {
            scheduledGroups.set(groupKey, {
                key: groupKey,
                tickerCode: ticker,
                name: div.investment.name,
                type: div.investment.type,
                exDate: exDate.toISOString(),
                paymentDate: payDate.toISOString(),
                quantity: div.quantity,
                amountPerShare: div.amountPerShare,
                currency: div.currency,
                totalBrl: round2(div.totalBrl),
            });
        }
    }

    const scheduledItems = [...scheduledGroups.values()].sort(
        (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime() || a.tickerCode.localeCompare(b.tickerCode),
    );

    // 2. FII Monthly Average based on historical per-share dividends and current FII share quantities
    const fiiLots = investments.filter(i => i.type === 'FII' && i.tickerCode && Number(i.quantity) > 0);
    const fiiByTicker = new Map<string, { name: string; quantity: number }>();
    for (const lot of fiiLots) {
        const ticker = lot.tickerCode!.trim().toUpperCase();
        const prev = fiiByTicker.get(ticker);
        if (prev) {
            prev.quantity = round2(prev.quantity + Number(lot.quantity ?? 0));
        } else {
            fiiByTicker.set(ticker, {
                name: lot.name,
                quantity: round2(Number(lot.quantity ?? 0)),
            });
        }
    }

    // Group historical FII dividends per (ticker, exDate YYYY-MM-DD) so multiple lots on the same date aren't summed per share
    const fiiEventsByTicker = new Map<string, Map<string, { monthKey: string; amountPerShare: number }>>();
    for (const div of dividends) {
        if (div.investment.type !== 'FII') continue;
        const ticker = div.tickerCode.trim().toUpperCase();
        if (!fiiByTicker.has(ticker)) continue;
        const exDate = new Date(div.date);
        if (Number.isNaN(exDate.getTime())) continue;
        const dateKey = exDate.toISOString().slice(0, 10);
        const mKey = formatMonthKey(exDate.getUTCFullYear(), exDate.getUTCMonth() + 1);

        let byDate = fiiEventsByTicker.get(ticker);
        if (!byDate) {
            byDate = new Map();
            fiiEventsByTicker.set(ticker, byDate);
        }
        if (!byDate.has(dateKey)) {
            byDate.set(dateKey, { monthKey: mKey, amountPerShare: div.amountPerShare });
        }
    }

    const fiiBreakdown: FiiProjectionBreakdown[] = [];
    for (const [tickerCode, meta] of fiiByTicker.entries()) {
        const byDate = fiiEventsByTicker.get(tickerCode);
        const perMonth = new Map<string, number>();
        if (byDate) {
            for (const ev of byDate.values()) {
                perMonth.set(ev.monthKey, (perMonth.get(ev.monthKey) ?? 0) + ev.amountPerShare);
            }
        }
        const sortedMonthKeys = [...perMonth.keys()].sort();
        const recentMonths = sortedMonthKeys.slice(-6);
        const avgPerShareBrl = recentMonths.length > 0
            ? round4(recentMonths.reduce((s, k) => s + (perMonth.get(k) ?? 0), 0) / recentMonths.length)
            : 0;
        const monthlyExpectedBrl = round2(avgPerShareBrl * meta.quantity);

        fiiBreakdown.push({
            tickerCode,
            name: meta.name,
            quantity: meta.quantity,
            avgPerShareBrl,
            monthlyExpectedBrl,
            annualExpectedBrl: round2(monthlyExpectedBrl * 12),
        });
    }

    fiiBreakdown.sort((a, b) => b.monthlyExpectedBrl - a.monthlyExpectedBrl || a.tickerCode.localeCompare(b.tickerCode));
    const fiiMonthlyAverageBrl = round2(fiiBreakdown.reduce((s, f) => s + f.monthlyExpectedBrl, 0));

    // Populate projectedFiiDividends for each month >= currentIdx, skipping FIIs that already have a scheduled dividend in that month
    for (const m of months) {
        const mIdx = monthIndex(m.year, m.month);
        if (mIdx < currentIdx) continue;
        const alreadyScheduled = scheduledFiiTickersByMonth.get(m.monthKey);
        let projectedMonth = 0;
        for (const fii of fiiBreakdown) {
            if (alreadyScheduled?.has(fii.tickerCode)) continue;
            projectedMonth += fii.monthlyExpectedBrl;
        }
        m.projectedFiiDividends = round2(projectedMonth);
    }

    // 3. Fixed Income Net Return (CDB / Renda Fixa) over the 12-month window
    const fixedLots = investments.filter(
        i => i.type === 'FIXED_INCOME' && Number(i.cdiPercentage) > 0 && (i.grossValue ?? i.currentValue ?? i.investedAmount) > 0,
    );
    const fixedIncomePrincipalGrossBrl = round2(
        fixedLots.reduce((s, l) => s + Number(l.grossValue ?? l.currentValue ?? l.investedAmount), 0),
    );

    const msPerDay = 1000 * 60 * 60 * 24;
    const effectiveDailyCdi = cdiDailyRate > 0 ? cdiDailyRate : DEFAULT_CDI_DAILY;

    for (const lot of fixedLots) {
        const cdiPct = Number(lot.cdiPercentage ?? 100);
        const dailyRate = effectiveDailyCdi * (cdiPct / 100);
        let runningGross = Number(lot.grossValue ?? lot.currentValue ?? lot.investedAmount);
        const startDate = lot.investmentDate ? new Date(lot.investmentDate) : today;

        // If the window starts after the current month, advance runningGross through the lead-in months
        // using only the remaining business days in each lead-in month
        for (let idx = currentIdx; idx < startIdx; idx++) {
            const leadMonth = fromIndex(idx);
            const leadDays = getMonthBusinessDaysInfo(leadMonth.year, leadMonth.month, today);
            if (leadDays.remaining > 0) {
                runningGross = runningGross * Math.pow(1 + dailyRate, leadDays.remaining);
            }
        }

        for (const m of months) {
            const mIdx = monthIndex(m.year, m.month);
            if (mIdx < currentIdx || m.businessDaysRemaining <= 0) continue;

            const monthlyFactor = Math.pow(1 + dailyRate, m.businessDaysRemaining);
            const nextGross = runningGross * monthlyFactor;
            const grossGain = nextGross - runningGross;
            runningGross = nextGross;

            // End of month m for IR bracket calculation
            const monthEnd = new Date(Date.UTC(m.year, m.month, 0, 12, 0, 0));
            const calendarDays = Math.max(1, Math.floor((monthEnd.getTime() - startDate.getTime()) / msPerDay));
            const irRate = irRateForCalendarDays(calendarDays);
            const tax = grossGain * irRate;
            const netGain = grossGain - tax;

            m.fixedIncomeGrossYield = round2(m.fixedIncomeGrossYield + grossGain);
            m.fixedIncomeTax = round2(m.fixedIncomeTax + tax);
            m.fixedIncomeNetYield = round2(m.fixedIncomeNetYield + netGain);
        }
    }

    for (const m of months) {
        m.total = round2(m.scheduledDividends + m.projectedFiiDividends + m.fixedIncomeNetYield);
    }

    const scheduledTotalBrl = round2(months.reduce((s, m) => s + m.scheduledDividends, 0));
    const fiiProjected12mBrl = round2(months.reduce((s, m) => s + m.projectedFiiDividends, 0));
    const fixedIncomeNet12mBrl = round2(months.reduce((s, m) => s + m.fixedIncomeNetYield, 0));
    const fixedIncomeGross12mBrl = round2(months.reduce((s, m) => s + m.fixedIncomeGrossYield, 0));
    const fixedIncomeTax12mBrl = round2(months.reduce((s, m) => s + m.fixedIncomeTax, 0));
    const total12m = round2(months.reduce((s, m) => s + m.total, 0));

    // Scheduled FII dividends + Projected FII dividends over the 12 months
    const scheduledFii12m = round2(
        scheduledItems.filter(item => item.type === 'FII').reduce((s, item) => s + item.totalBrl, 0),
    );
    const fiiTotal12mBrl = round2(scheduledFii12m + fiiProjected12mBrl);

    return {
        months,
        scheduledItems,
        fiiBreakdown,
        summary: {
            total12m,
            monthlyAverage12m: monthsCount > 0 ? round2(total12m / monthsCount) : 0,
            scheduledTotalBrl,
            scheduledCount: scheduledItems.length,
            fiiMonthlyAverageBrl,
            fiiProjected12mBrl,
            fiiTotal12mBrl,
            fixedIncomeNet12mBrl,
            fixedIncomeGross12mBrl,
            fixedIncomeTax12mBrl,
            fixedIncomeMonthlyAvgNetBrl: monthsCount > 0 ? round2(fixedIncomeNet12mBrl / monthsCount) : 0,
            fixedIncomePrincipalGrossBrl,
        },
    };
}

