// Pure functions for investment dividends (proventos) aggregation and monthly timeline.
// No React or @/ aliases so this module runs directly under `node --test`.

export type DividendClassFilter = "ALL" | "VARIABLE_INCOME" | "FII" | "US_STOCK";
export type DividendStatusFilter = "ALL" | "PAID" | "PENDING";
export type DividendStatus = "PAID" | "PENDING";

export type ApiDividendInvestment = {
    id: string;
    name: string;
    type: string;
    tickerCode?: string | null;
    sector?: string | null;
    investmentDate?: string | null;
    quantity?: number | null;
    investedAmount: number;
    accountId?: string | null;
    account?: { id: string; name: string; currency: string } | null;
};

export type ApiInvestmentDividend = {
    id: string;
    investmentId: string;
    tickerCode: string;
    date: string;
    paymentDate?: string;
    status?: DividendStatus;
    amountPerShare: number;
    quantity: number;
    totalOriginal: number;
    currency: string;
    totalBrl: number;
    creditedAccountId?: string | null;
    creditedAt?: string | null;
    investment: ApiDividendInvestment;
};

export type PendingDividendGroup = {
    key: string;
    tickerCode: string;
    name: string;
    type: string;
    exDate: string;
    paymentDate: string;
    quantity: number;
    amountPerShare: number;
    currency: string;
    totalOriginal: number;
    totalBrl: number;
};

export type MonthlyDividendEntry = {
    monthKey: string; // "YYYY-MM"
    year: number;
    month: number; // 1..12
    label: string; // "Mai/21"
    fullLabel: string; // "Maio de 2021"
    stocksBrl: number;
    fiiBrl: number;
    usBrl: number;
    totalBrl: number;
    paymentsCount: number;
    items: ApiInvestmentDividend[];
};

export type YearlyDividendEntry = {
    year: number;
    label: string;
    stocksBrl: number;
    fiiBrl: number;
    usBrl: number;
    totalBrl: number;
    paymentsCount: number;
};

export type AnnualMonthlyRow = {
    year: number;
    /** 12 values: index 0 = Jan, ..., index 11 = Dez */
    months: number[];
    /** Items grouped by month index (0..11) */
    monthItems: ApiInvestmentDividend[][];
    average: number;
    total: number;
    isPartialYear: boolean;
    monthsDivisor: number;
};

export type AssetDividendRank = {
    tickerCode: string;
    name: string;
    type: string;
    totalBrl: number;
    paymentsCount: number;
    investedBrl: number;
    yieldOnCostPct: number;
};

export type DividendsSummary = {
    totalBrl: number;
    stocksTotalBrl: number;
    fiiTotalBrl: number;
    usTotalBrl: number;
    pendingTotalBrl: number;
    pendingCount: number;
    pendingItems: PendingDividendGroup[];
    last12MonthsBrl: number;
    monthlyAverageBrl: number;
    monthsSinceStart: number;
    monthsWithPayments: number;
    yieldOnCostPct: number;
    bestMonth: MonthlyDividendEntry | null;
    topAsset: AssetDividendRank | null;
    byAsset: AssetDividendRank[];
    earliestPurchaseDate: string | null;
};

const SHORT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const FULL_MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const round2 = (v: number) => Math.round(v * 100) / 100;

export function formatMonthKey(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, "0")}`;
}

export function shortMonthLabel(year: number, month: number): string {
    return `${SHORT_MONTHS[month - 1]}/${String(year).slice(-2)}`;
}

export function fullMonthLabel(year: number, month: number): string {
    return `${FULL_MONTHS[month - 1]} de ${year}`;
}

const anbimaHolidayCache = new Map<number, Set<string>>();

function getAnbimaHolidaysUtc(year: number): Set<string> {
    const cached = anbimaHolidayCache.get(year);
    if (cached) return cached;

    const holidays = new Set<string>([
        `${year}-01-01`,
        `${year}-04-21`,
        `${year}-05-01`,
        `${year}-09-07`,
        `${year}-10-12`,
        `${year}-11-02`,
        `${year}-11-15`,
        `${year}-11-20`,
        `${year}-12-25`,
    ]);

    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    const easterUtc = Date.UTC(year, month - 1, day);

    for (const offset of [-48, -47, -2, 60]) {
        const dt = new Date(easterUtc + offset * 86_400_000);
        const y = dt.getUTCFullYear();
        const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
        const da = String(dt.getUTCDate()).padStart(2, "0");
        holidays.add(`${y}-${mo}-${da}`);
    }

    anbimaHolidayCache.set(year, holidays);
    return holidays;
}

function isAnbimaBusinessDayUtc(d: Date): boolean {
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) return false;
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    const da = String(d.getUTCDate()).padStart(2, "0");
    return !getAnbimaHolidaysUtc(y).has(`${y}-${mo}-${da}`);
}

function nthBusinessDayOfMonth(year: number, month0: number, n: number): Date {
    const d = new Date(Date.UTC(year, month0, 1, 13, 0, 0));
    let count = 0;
    while (count < n) {
        if (isAnbimaBusinessDayUtc(d)) {
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
        if (isAnbimaBusinessDayUtc(d)) {
            added++;
        }
    }
    return d;
}

/**
 * Estimates the payment date (`paymentDate`) from the Ex-Dividend date (`exDate`)
 * according to B3 FII / Stock and US ETF settlement schedules.
 */
export function estimateDividendPaymentDate(exDate: Date, type: string, tickerCode: string): Date {
    const ticker = tickerCode.trim().toUpperCase();
    const year = exDate.getUTCFullYear();
    const month0 = exDate.getUTCMonth();
    const day = exDate.getUTCDate();

    if (type === "FII") {
        // End-of-month Data-Com (Ex-Date >= 27) -> 10th business day of the next month
        if (day >= 27) {
            return nthBusinessDayOfMonth(year, month0 + 1, 10);
        }
        // Start-of-month Ex-Date (1..6, e.g. MXRF11, HGLG11, HGBS11) or BTHF11 (6th business day) -> 10th business day of the same month
        if (day <= 6 || (ticker === "BTHF11" && day <= 13)) {
            return nthBusinessDayOfMonth(year, month0, 10);
        }
        // Mid-month Ex-Date (7..13) -> +5 business days (around 17th-18th)
        if (day <= 13) {
            return addBusinessDays(exDate, 5);
        }
        // Ex-Date around 14..20 (e.g. BTLG11, XPIN11) -> 25th of the month (or next business day)
        const d25 = new Date(Date.UTC(year, month0, 25, 13, 0, 0));
        if (d25.getUTCDay() === 6) d25.setUTCDate(27);
        if (d25.getUTCDay() === 0) d25.setUTCDate(26);
        return d25 > exDate ? d25 : addBusinessDays(exDate, 5);
    }

    if (type === "US_STOCK") {
        return addBusinessDays(exDate, 4);
    }

    // Monthly JCP banks (BBDC4, BBDC3, ITUB4, ITUB3, ITSA4, SANB11) with start-of-month exDate
    if (["BBDC4", "BBDC3", "ITUB4", "ITUB3", "ITSA4", "SANB11"].includes(ticker) && day <= 5) {
        return addBusinessDays(exDate, 2);
    }

    return addBusinessDays(exDate, 10);
}

/**
 * Enriches dividends with `paymentDate` and `status` ("PAID" when paymentDate <= referenceDate,
 * "PENDING" / "A receber" when paymentDate > referenceDate).
 */
export function enrichDividendsWithStatus(
    dividends: ApiInvestmentDividend[],
    referenceDate: Date = new Date(),
): ApiInvestmentDividend[] {
    const refEnd = new Date(Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth(),
        referenceDate.getUTCDate(),
        23, 59, 59,
    )).getTime();

    return dividends.map(div => {
        if (div.paymentDate && div.status) return div;
        const exDate = new Date(div.date);
        const payDate = Number.isNaN(exDate.getTime())
            ? exDate
            : estimateDividendPaymentDate(exDate, div.investment.type, div.tickerCode);
        const isPending = !Number.isNaN(payDate.getTime()) && payDate.getTime() > refEnd;
        return {
            ...div,
            paymentDate: Number.isNaN(payDate.getTime()) ? div.date : payDate.toISOString(),
            status: isPending ? "PENDING" : "PAID",
        };
    });
}

/**
 * Consolidates pending ("A receber") dividends by (tickerCode, paymentDate) so multiple lots
 * of the same asset appear cleanly grouped with their total quantity and receivable amount.
 */
export function groupPendingDividends(dividends: ApiInvestmentDividend[]): PendingDividendGroup[] {
    const groups = new Map<string, PendingDividendGroup>();

    for (const div of dividends) {
        if (div.status !== "PENDING") continue;
        const payDateKey = (div.paymentDate || div.date).slice(0, 10);
        const ticker = div.tickerCode.trim().toUpperCase();
        const key = `${ticker}:${payDateKey}:${div.amountPerShare}`;

        const existing = groups.get(key);
        if (existing) {
            existing.quantity = round2(existing.quantity + div.quantity);
            existing.totalOriginal = round2(existing.totalOriginal + div.totalOriginal);
            existing.totalBrl = round2(existing.totalBrl + div.totalBrl);
        } else {
            groups.set(key, {
                key,
                tickerCode: ticker,
                name: div.investment.name,
                type: div.investment.type,
                exDate: div.date,
                paymentDate: div.paymentDate || div.date,
                quantity: div.quantity,
                amountPerShare: div.amountPerShare,
                currency: div.currency,
                totalOriginal: round2(div.totalOriginal),
                totalBrl: round2(div.totalBrl),
            });
        }
    }

    return [...groups.values()].sort(
        (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime() || a.tickerCode.localeCompare(b.tickerCode),
    );
}

export function filterDividendsData(
    dividends: ApiInvestmentDividend[],
    investments: ApiDividendInvestment[],
    classFilter: DividendClassFilter = "ALL",
    tickerFilter: string = "ALL",
    statusFilter: DividendStatusFilter = "ALL",
    referenceDate: Date = new Date(),
): {
    dividends: ApiInvestmentDividend[];
    allMatchingDividends: ApiInvestmentDividend[];
    investments: ApiDividendInvestment[];
} {
    const enriched = enrichDividendsWithStatus(dividends, referenceDate);
    const normalizedTicker = tickerFilter.trim().toUpperCase();

    const filteredInvestments = investments.filter(inv => {
        if (classFilter !== "ALL" && inv.type !== classFilter) return false;
        if (normalizedTicker !== "ALL" && (inv.tickerCode?.trim().toUpperCase() || "") !== normalizedTicker) {
            return false;
        }
        return true;
    });

    const allMatchingDividends = enriched.filter(div => {
        if (classFilter !== "ALL" && div.investment.type !== classFilter) return false;
        if (normalizedTicker !== "ALL" && div.tickerCode.trim().toUpperCase() !== normalizedTicker) {
            return false;
        }
        return true;
    });

    const filteredDividends = allMatchingDividends.filter(div => {
        if (statusFilter === "PAID") return div.status === "PAID";
        if (statusFilter === "PENDING") return div.status === "PENDING";
        return true;
    });

    return { dividends: filteredDividends, allMatchingDividends, investments: filteredInvestments };
}

/**
 * Builds a continuous month-by-month timeline from the earliest purchase date
 * (or earliest dividend date) up to `referenceDate` (or the latest dividend month).
 */
export function buildMonthlyDividendsSeries(
    dividends: ApiInvestmentDividend[],
    investments: ApiDividendInvestment[],
    referenceDate: Date = new Date(),
): MonthlyDividendEntry[] {
    const nowTime = referenceDate.getTime();

    const candidateDates: Date[] = [];

    for (const inv of investments) {
        if (!inv.investmentDate) continue;
        const d = new Date(inv.investmentDate);
        if (!Number.isNaN(d.getTime()) && d.getTime() <= nowTime) {
            candidateDates.push(d);
        }
    }

    for (const div of dividends) {
        const d = new Date(div.date);
        if (!Number.isNaN(d.getTime())) {
            candidateDates.push(d);
        }
    }

    if (candidateDates.length === 0) {
        return [];
    }

    const earliest = new Date(Math.min(...candidateDates.map(d => d.getTime())));
    const latestDivTime = dividends.length > 0
        ? Math.max(...dividends.map(d => new Date(d.date).getTime()).filter(t => !Number.isNaN(t)))
        : earliest.getTime();

    // End at the latest dividend month if all dividends are in the past (e.g. when system clock is ahead of market data),
    // or at referenceDate when referenceDate is within the active range.
    const endRef = latestDivTime > 0 && referenceDate.getUTCFullYear() > new Date(latestDivTime).getUTCFullYear()
        ? new Date(latestDivTime)
        : referenceDate;

    const startYear = earliest.getUTCFullYear();
    const startMonth = earliest.getUTCMonth() + 1;
    const endYear = Math.max(startYear, endRef.getUTCFullYear());
    const endMonth = endRef.getUTCFullYear() < startYear
        ? startMonth
        : endRef.getUTCFullYear() === startYear
            ? Math.max(startMonth, endRef.getUTCMonth() + 1)
            : endRef.getUTCMonth() + 1;

    const byMonth = new Map<string, MonthlyDividendEntry>();

    let y = startYear;
    let m = startMonth;
    while (y < endYear || (y === endYear && m <= endMonth)) {
        const key = formatMonthKey(y, m);
        byMonth.set(key, {
            monthKey: key,
            year: y,
            month: m,
            label: shortMonthLabel(y, m),
            fullLabel: fullMonthLabel(y, m),
            stocksBrl: 0,
            fiiBrl: 0,
            usBrl: 0,
            totalBrl: 0,
            paymentsCount: 0,
            items: [],
        });
        m++;
        if (m > 12) {
            m = 1;
            y++;
        }
    }

    for (const div of dividends) {
        const d = new Date(div.date);
        if (Number.isNaN(d.getTime())) continue;
        const yr = d.getUTCFullYear();
        const mo = d.getUTCMonth() + 1;
        const key = formatMonthKey(yr, mo);

        let bucket = byMonth.get(key);
        if (!bucket) {
            bucket = {
                monthKey: key,
                year: yr,
                month: mo,
                label: shortMonthLabel(yr, mo),
                fullLabel: fullMonthLabel(yr, mo),
                stocksBrl: 0,
                fiiBrl: 0,
                usBrl: 0,
                totalBrl: 0,
                paymentsCount: 0,
                items: [],
            };
            byMonth.set(key, bucket);
        }

        const t = div.investment.type;
        if (t === "FII") {
            bucket.fiiBrl = round2(bucket.fiiBrl + div.totalBrl);
        } else if (t === "US_STOCK") {
            bucket.usBrl = round2(bucket.usBrl + div.totalBrl);
        } else {
            bucket.stocksBrl = round2(bucket.stocksBrl + div.totalBrl);
        }

        bucket.totalBrl = round2(bucket.totalBrl + div.totalBrl);
        bucket.paymentsCount += 1;
        bucket.items.push(div);
    }

    const sorted = [...byMonth.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    for (const entry of sorted) {
        entry.items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return sorted;
}

export function buildYearlyDividendsSeries(monthly: MonthlyDividendEntry[]): YearlyDividendEntry[] {
    const byYear = new Map<number, YearlyDividendEntry>();

    for (const m of monthly) {
        let entry = byYear.get(m.year);
        if (!entry) {
            entry = {
                year: m.year,
                label: String(m.year),
                stocksBrl: 0,
                fiiBrl: 0,
                usBrl: 0,
                totalBrl: 0,
                paymentsCount: 0,
            };
            byYear.set(m.year, entry);
        }
        entry.stocksBrl = round2(entry.stocksBrl + m.stocksBrl);
        entry.fiiBrl = round2(entry.fiiBrl + m.fiiBrl);
        entry.usBrl = round2(entry.usBrl + m.usBrl);
        entry.totalBrl = round2(entry.totalBrl + m.totalBrl);
        entry.paymentsCount += m.paymentsCount;
    }

    return [...byYear.values()].sort((a, b) => a.year - b.year);
}

/**
 * Builds the Investidor10-style annual × monthly matrix ("Histórico mensal"),
 * with Jan..Dez columns, Average (total / 12 for full years, total / elapsedMonths for the current partial year)
 * and Total per year.
 */
export function buildAnnualMonthlyMatrix(
    dividends: ApiInvestmentDividend[],
    investments: ApiDividendInvestment[],
    referenceDate: Date = new Date(),
): AnnualMonthlyRow[] {
    const monthlySeries = buildMonthlyDividendsSeries(dividends, investments, referenceDate);
    if (monthlySeries.length === 0) return [];

    const startYear = monthlySeries[0].year;
    const endEntry = monthlySeries[monthlySeries.length - 1];
    const endYear = endEntry.year;
    const endMonthInLatestYear = endEntry.month; // 1..12

    const rowsByYear = new Map<number, AnnualMonthlyRow>();
    for (let y = startYear; y <= endYear; y++) {
        const isPartialYear = y === endYear && endMonthInLatestYear < 12;
        const monthsDivisor = isPartialYear ? Math.max(1, endMonthInLatestYear) : 12;
        rowsByYear.set(y, {
            year: y,
            months: Array.from({ length: 12 }, () => 0),
            monthItems: Array.from({ length: 12 }, () => []),
            average: 0,
            total: 0,
            isPartialYear,
            monthsDivisor,
        });
    }

    for (const m of monthlySeries) {
        const row = rowsByYear.get(m.year);
        if (!row) continue;
        const idx = m.month - 1;
        row.months[idx] = round2(m.totalBrl);
        row.monthItems[idx] = m.items;
    }

    for (const row of rowsByYear.values()) {
        row.total = round2(row.months.reduce((acc, v) => acc + v, 0));
        row.average = round2(row.total / row.monthsDivisor);
    }

    // Default order: newest year first (descending), matching the reference table
    return [...rowsByYear.values()].sort((a, b) => b.year - a.year);
}

export function computeDividendsSummary(
    monthlySeries: MonthlyDividendEntry[],
    dividends: ApiInvestmentDividend[],
    investments: ApiDividendInvestment[],
    allMatchingDividends?: ApiInvestmentDividend[],
): DividendsSummary {
    const stocksTotalBrl = round2(monthlySeries.reduce((s, m) => s + m.stocksBrl, 0));
    const fiiTotalBrl = round2(monthlySeries.reduce((s, m) => s + m.fiiBrl, 0));
    const usTotalBrl = round2(monthlySeries.reduce((s, m) => s + m.usBrl, 0));
    const totalBrl = round2(monthlySeries.reduce((s, m) => s + m.totalBrl, 0));

    const sourceForPending = enrichDividendsWithStatus(allMatchingDividends ?? dividends);
    const pendingItems = groupPendingDividends(sourceForPending);
    const pendingTotalBrl = round2(pendingItems.reduce((s, p) => s + p.totalBrl, 0));
    const pendingCount = pendingItems.length;

    const last12 = monthlySeries.slice(-12);
    const last12MonthsBrl = round2(last12.reduce((s, m) => s + m.totalBrl, 0));
    const monthsSinceStart = monthlySeries.length;
    const monthsWithPayments = monthlySeries.filter(m => m.totalBrl > 0).length;
    const monthlyAverageBrl = monthsSinceStart > 0 ? round2(totalBrl / monthsSinceStart) : 0;

    const totalInvested = investments.reduce((s, i) => s + i.investedAmount, 0);
    const yieldOnCostPct = totalInvested > 0 ? round2((totalBrl / totalInvested) * 100) : 0;

    const bestMonth = monthlySeries
        .filter(m => m.totalBrl > 0)
        .reduce<MonthlyDividendEntry | null>((best, cur) => (!best || cur.totalBrl > best.totalBrl ? cur : best), null);

    // Invested amount per ticker
    const investedByTicker = new Map<string, { name: string; type: string; investedBrl: number }>();
    for (const inv of investments) {
        const ticker = (inv.tickerCode || inv.name).trim().toUpperCase();
        const prev = investedByTicker.get(ticker);
        if (prev) {
            prev.investedBrl = round2(prev.investedBrl + inv.investedAmount);
        } else {
            investedByTicker.set(ticker, {
                name: inv.name,
                type: inv.type,
                investedBrl: round2(inv.investedAmount),
            });
        }
    }

    const divsByTicker = new Map<string, { totalBrl: number; count: number; name: string; type: string }>();
    for (const div of dividends) {
        const ticker = div.tickerCode.trim().toUpperCase();
        const prev = divsByTicker.get(ticker);
        if (prev) {
            prev.totalBrl = round2(prev.totalBrl + div.totalBrl);
            prev.count += 1;
        } else {
            divsByTicker.set(ticker, {
                totalBrl: round2(div.totalBrl),
                count: 1,
                name: div.investment.name,
                type: div.investment.type,
            });
        }
    }

    const byAsset: AssetDividendRank[] = [];
    for (const [tickerCode, info] of divsByTicker.entries()) {
        const invMeta = investedByTicker.get(tickerCode);
        const investedBrl = invMeta?.investedBrl ?? 0;
        byAsset.push({
            tickerCode,
            name: invMeta?.name ?? info.name,
            type: invMeta?.type ?? info.type,
            totalBrl: info.totalBrl,
            paymentsCount: info.count,
            investedBrl,
            yieldOnCostPct: investedBrl > 0 ? round2((info.totalBrl / investedBrl) * 100) : 0,
        });
    }
    byAsset.sort((a, b) => b.totalBrl - a.totalBrl);

    const earliestDates = investments
        .map(i => i.investmentDate)
        .filter((d): d is string => Boolean(d))
        .sort();

    return {
        totalBrl,
        stocksTotalBrl,
        fiiTotalBrl,
        usTotalBrl,
        pendingTotalBrl,
        pendingCount,
        pendingItems,
        last12MonthsBrl,
        monthlyAverageBrl,
        monthsSinceStart,
        monthsWithPayments,
        yieldOnCostPct,
        bestMonth,
        topAsset: byAsset[0] ?? null,
        byAsset,
        earliestPurchaseDate: earliestDates[0] ?? null,
    };
}

