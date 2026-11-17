export interface CdiDayRate {
    date: string; // "DD/MM/YYYY" format from BCB API
    rate: number; // decimal (e.g. 0.0005)
}

/**
 * Converts a Date to "YYYY-MM-DD" based on UTC components to guarantee
 * consistent date boundaries across different server timezones (e.g. UTC vs UTC-3).
 */
export function toUtcYmd(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Converts a "DD/MM/YYYY" date string from BCB API to "YYYY-MM-DD".
 */
export function bcbDateToYmd(bcbDateStr: string): string {
    const [dd, mm, yyyy] = bcbDateStr.split('/');
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/**
 * Filters cached CDI rates to the given date range using YYYY-MM-DD comparison.
 * Compares calendar days in UTC to avoid timezone drift (e.g. UTC server vs UTC-3 Brazil)
 * and includes the investment date rate per Brazilian fixed income convention.
 */
export function filterCdiRatesByRange(rates: CdiDayRate[], startDate: Date, endDate: Date): CdiDayRate[] {
    const startStr = toUtcYmd(startDate);
    const endStr = toUtcYmd(endDate);

    return rates.filter(r => {
        const rStr = bcbDateToYmd(r.date);
        return rStr >= startStr && rStr <= endStr;
    });
}

/**
 * Compounds daily CDI rates from BCB data.
 * M = P * ∏(1 + CDI_dia * cdiPercentage/100) for each business day
 */
export function compoundWithRealRates(investedAmount: number, cdiPercentage: number, rates: CdiDayRate[]): number {
    let accumulated = 1;
    const factor = cdiPercentage / 100;
    for (const r of rates) {
        accumulated *= (1 + r.rate * factor);
    }
    return investedAmount * accumulated;
}
