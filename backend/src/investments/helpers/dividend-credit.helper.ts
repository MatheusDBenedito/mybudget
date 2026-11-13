export interface DividendRowInput {
    date: Date;
    amountPerShare: number;
    totalOriginal: number;
    currency: string;
    totalBrl: number;
}

export interface ExistingDividendCredit {
    creditedAccountId: string | null;
    creditedAt: Date | null;
}

export interface LinkedAccountInfo {
    id: string;
    currency: string;
}

export interface PlannedDividendRow<T extends DividendRowInput> {
    row: T & {
        creditedAccountId: string | null;
        creditedAt: Date | null;
    };
    newlyCredited: boolean;
}

export interface DividendCreditPlan<T extends DividendRowInput> {
    rows: Array<
        T & {
            creditedAccountId: string | null;
            creditedAt: Date | null;
        }
    >;
    newlyCreditedCount: number;
    brlDelta: number;
    usdDelta: number;
}

function round2(value: number): number {
    return Number(value.toFixed(2));
}

export function startOfUtcDay(date: Date): Date {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
    );
}

export function endOfUtcDay(date: Date): Date {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
    );
}

export function dividendKey(date: Date, amountPerShare: number): string {
    return `${date.toISOString()}_${amountPerShare.toFixed(6)}`;
}

export function resolveAccountLinkUpdate(
    newAccountId: string | null | undefined,
    existingAccountId: string | null,
    existingLinkedAt: Date | null,
    now: Date = new Date(),
): { accountId: string | null; accountLinkedAt: Date | null } | undefined {
    if (newAccountId === undefined) {
        return undefined;
    }

    const normalized = newAccountId && newAccountId.trim().length > 0 ? newAccountId.trim() : null;
    if (!normalized) {
        return { accountId: null, accountLinkedAt: null };
    }

    if (normalized === existingAccountId) {
        return {
            accountId: existingAccountId,
            accountLinkedAt: existingLinkedAt ?? startOfUtcDay(now),
        };
    }

    return {
        accountId: normalized,
        accountLinkedAt: startOfUtcDay(now),
    };
}

export function planDividendCredits<T extends DividendRowInput>(params: {
    rows: T[];
    existingByKey: Map<string, ExistingDividendCredit>;
    account: LinkedAccountInfo | null;
    accountLinkedAt: Date | null;
    usdRate: number;
    now?: Date;
}): DividendCreditPlan<T> {
    const now = params.now ?? new Date();
    const endToday = endOfUtcDay(now);
    const fxRate = params.usdRate > 0 ? params.usdRate : 5.6;

    let newlyCreditedCount = 0;
    let brlDelta = 0;
    let usdDelta = 0;

    const rows = params.rows.map(row => {
        const key = dividendKey(row.date, row.amountPerShare);
        const existing = params.existingByKey.get(key);

        if (existing?.creditedAt) {
            return {
                ...row,
                creditedAccountId: existing.creditedAccountId,
                creditedAt: existing.creditedAt,
            };
        }

        const isEligibleForCredit =
            Boolean(params.account) &&
            Boolean(params.accountLinkedAt) &&
            row.date >= params.accountLinkedAt! &&
            row.date <= endToday &&
            row.totalOriginal > 0;

        if (!isEligibleForCredit || !params.account) {
            return {
                ...row,
                creditedAccountId: null,
                creditedAt: null,
            };
        }

        newlyCreditedCount += 1;
        if (params.account.currency === 'USD') {
            if (row.currency === 'USD') {
                usdDelta += row.totalOriginal;
                brlDelta += row.totalBrl;
            } else {
                usdDelta += round2(row.totalBrl / fxRate);
                brlDelta += row.totalBrl;
            }
        } else {
            brlDelta += row.totalBrl;
        }

        return {
            ...row,
            creditedAccountId: params.account.id,
            creditedAt: now,
        };
    });

    return {
        rows,
        newlyCreditedCount,
        brlDelta: round2(brlDelta),
        usdDelta: round2(usdDelta),
    };
}

