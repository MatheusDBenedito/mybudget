// Fixed income (CDI) projection. Pure functions so they can run under `node --test`.

export type FixedIncomePosition = {
    investedAmount: number;
    /** Current gross value (before IR) */
    grossValue: number;
    /** % of CDI, e.g. 102.5 */
    cdiPercentage: number;
    investmentDate: string | Date;
};

export type FixedIncomeProjectionPoint = {
    /** Months from today (0 = now) */
    monthOffset: number;
    date: Date;
    invested: number;
    gross: number;
    /** After the regressive income tax for the holding period */
    net: number;
    netProfit: number;
};

export const BUSINESS_DAYS_PER_YEAR = 252;
const BUSINESS_DAYS_PER_MONTH = BUSINESS_DAYS_PER_YEAR / 12;
const MS_PER_DAY = 86_400_000;

/** Brazilian regressive IR table for fixed income, by calendar days held. */
export function irRateForDays(days: number): number {
    if (days <= 180) return 0.225;
    if (days <= 360) return 0.2;
    if (days <= 720) return 0.175;
    return 0.15;
}

/** Monthly growth factor for an investment paying `cdiPercentage`% of an annual CDI of `annualCdiPercent`%. */
export function monthlyGrowthFactor(annualCdiPercent: number, cdiPercentage: number): number {
    const dailyCdi = Math.pow(1 + annualCdiPercent / 100, 1 / BUSINESS_DAYS_PER_YEAR) - 1;
    return Math.pow(1 + dailyCdi * (cdiPercentage / 100), BUSINESS_DAYS_PER_MONTH);
}

const addMonths = (date: Date, months: number) => {
    const d = new Date(date.getFullYear(), date.getMonth() + months, 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(date.getDate(), lastDay));
    return d;
};

const round = (v: number) => Math.round(v * 100) / 100;

/**
 * Projects the portfolio value for the next `months` months assuming the CDI stays at `annualCdiPercent`.
 * Positions with invalid data are ignored.
 */
export function projectFixedIncome(
    positions: FixedIncomePosition[],
    annualCdiPercent: number,
    months: number,
    today: Date = new Date(),
): FixedIncomeProjectionPoint[] {
    const valid = positions.filter(p =>
        p.investedAmount > 0 && p.grossValue > 0 && p.cdiPercentage > 0 && !Number.isNaN(new Date(p.investmentDate).getTime()));

    return Array.from({ length: months + 1 }, (_, k) => {
        const date = addMonths(today, k);
        let invested = 0;
        let gross = 0;
        let net = 0;
        for (const p of valid) {
            const g = p.grossValue * Math.pow(monthlyGrowthFactor(annualCdiPercent, p.cdiPercentage), k);
            const days = Math.floor((date.getTime() - new Date(p.investmentDate).getTime()) / MS_PER_DAY);
            const profit = Math.max(g - p.investedAmount, 0);
            invested += p.investedAmount;
            gross += g;
            net += g - profit * irRateForDays(days);
        }
        return {
            monthOffset: k,
            date,
            invested: round(invested),
            gross: round(gross),
            net: round(net),
            netProfit: round(net - invested),
        };
    });
}
