export type AnalyticsRange = "30d" | "90d" | "180d" | "1y";

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

export interface InvestmentsAnalyticsResponse {
    range: AnalyticsRange;
    startDate: string;
    endDate: string;
    summary: {
        totalGain: number;
        fixedIncomeGain: number;
        variableIncomeGain: number;
        averageDailyGain: number;
        bestDay: { date: string; totalGain: number } | null;
        worstDay: { date: string; totalGain: number } | null;
    };
    dailyGains: DailyGainPoint[];
    benchmarks: BenchmarkPoint[];
}

export const ANALYTICS_RANGES: Array<{ value: AnalyticsRange; label: string }> = [
    { value: "30d", label: "30d" },
    { value: "90d", label: "90d" },
    { value: "180d", label: "6m" },
    { value: "1y", label: "1a" },
];

export function formatShortBrDate(ymd: string): string {
    const [, mm, dd] = ymd.split("-");
    return mm && dd ? `${dd}/${mm}` : ymd;
}
