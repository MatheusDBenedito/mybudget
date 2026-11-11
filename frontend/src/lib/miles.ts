// Pure helpers for the miles/points module.
// Keep this file free of React, path aliases and browser APIs so it can be unit tested with `node --test`.

export type MilesStatus = "PENDING" | "TRANSFERRED" | "CREDITED";

export const MILES_STATUS_ORDER: MilesStatus[] = ["PENDING", "TRANSFERRED", "CREDITED"];

export const MILES_STATUS_LABELS: Record<MilesStatus, string> = {
    PENDING: "Pendente",
    TRANSFERRED: "Transferido",
    CREDITED: "Creditado",
};

/** Bank/card points programs (usual transfer origins). */
export const ORIGIN_PROGRAMS = ["Livelo", "Esfera", "Átomos", "Inter Loop", "Nubank Rewards"];

/** Airline programs (usual transfer destinations). */
export const DESTINATION_PROGRAMS = ["Smiles", "LATAM Pass", "TudoAzul", "TAP Miles&Go", "Iberia Plus"];

/** Card fields used by the miles module. */
export type MilesCard = {
    id: string;
    name: string;
    color?: string | null;
    dueDay: number;
    pointsPerDollar?: number | null;
    loyaltyProgram?: string | null;
};

export type ApiMilesEntry = {
    id: string;
    program: string;
    points: number;
    status: MilesStatus;
    /** ISO date; read with fromApiDate */
    expectedCreditDate: string;
    creditCardId: string | null;
    origin: string | null;
    referenceMonth: number | null;
    referenceYear: number | null;
    notes: string | null;
    creditCard: { id: string; name: string; color: string | null } | null;
};

/** Values used to open the entry form pre-filled (from an estimate or the calculator). */
export type MilesEntryDraft = {
    creditCardId?: string;
    origin?: string;
    program?: string;
    points?: number;
    status?: MilesStatus;
    expectedCreditDate?: string; // yyyy-mm-dd
    referenceMonth?: number;
    referenceYear?: number;
    notes?: string;
};

export const formatPoints = (value: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);

// ---------------------------------------------------------------------------
// Points earned on card spending
// ---------------------------------------------------------------------------

/**
 * Estimated points for a card invoice: (spend in BRL / dollar rate) × points per dollar.
 * Issuers credit whole points, so the result is rounded down.
 * Returns 0 for missing, invalid or non-positive inputs (e.g. invoices that net to a refund).
 */
export function estimatePointsFromSpend(spendBrl: number, usdRate: number, pointsPerDollar: number): number {
    if (![spendBrl, usdRate, pointsPerDollar].every(Number.isFinite)) return 0;
    if (spendBrl <= 0 || usdRate <= 0 || pointsPerDollar <= 0) return 0;
    // Round to cents first so float noise (e.g. 9.999999) doesn't drop a whole point
    const points = Math.round((spendBrl / usdRate) * pointsPerDollar * 100) / 100;
    return Math.floor(points);
}

// ---------------------------------------------------------------------------
// Bonus transfer calculator
// ---------------------------------------------------------------------------

export const MAX_BONUS_PERCENT = 1000;

/** Parses a points amount typed in pt-BR ("10.000", "10 000") into an integer. Empty/invalid -> NaN. */
export function parsePointsInput(value: string): number {
    const digits = value.replace(/[\s.]/g, "");
    return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
}

/** Parses a percentage typed in pt-BR ("12,5", "80%") into a number. Empty/invalid -> NaN. */
export function parsePercentInput(value: string): number {
    const normalized = value.replace(/[\s%]/g, "").replace(",", ".");
    return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

export type TransferBonusResult = {
    transferredPoints: number;
    bonusPercent: number;
    /** Absolute miles added by the promotion */
    bonusMiles: number;
    /** Miles credited at the destination (transferred + bonus), assuming 1:1 parity */
    totalMiles: number;
    /** Miles received per point sent, e.g. 1.8 for an 80% bonus */
    milesPerPoint: number;
};

/** Returns a user-facing error message, or null when the inputs are valid. */
export function getTransferInputError(points: number, bonusPercent: number): string | null {
    if (!Number.isFinite(points) || points <= 0) return "Informe uma quantidade de pontos maior que zero.";
    if (!Number.isInteger(points)) return "A quantidade de pontos deve ser um número inteiro.";
    if (!Number.isFinite(bonusPercent) || bonusPercent < 0) return "O bônus não pode ser negativo.";
    if (bonusPercent > MAX_BONUS_PERCENT) return `O bônus não pode passar de ${MAX_BONUS_PERCENT}%.`;
    return null;
}

/**
 * Miles credited in a bonus transfer (1:1 parity).
 * Programs credit whole miles, so the bonus is rounded down.
 * @throws RangeError when inputs are invalid (see getTransferInputError).
 */
export function calculateTransferBonus(points: number, bonusPercent: number): TransferBonusResult {
    const error = getTransferInputError(points, bonusPercent);
    if (error) throw new RangeError(error);

    // Integer math avoids float error (e.g. 10000 * 0.7 = 6999.999...)
    const bonusMiles = Math.floor((points * Math.round(bonusPercent * 100)) / 10000);
    const totalMiles = points + bonusMiles;
    return {
        transferredPoints: points,
        bonusPercent,
        bonusMiles,
        totalMiles,
        milesPerPoint: totalMiles / points,
    };
}

export function buildTransferSummary(originProgram: string, destinationProgram: string, result: TransferBonusResult): string {
    const origin = originProgram.trim() || "o programa de origem";
    const destination = destinationProgram.trim() || "o programa de destino";
    const bonus = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(result.bonusPercent);
    const ratio = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(result.milesPerPoint);

    if (result.bonusMiles === 0) {
        return `Transferindo ${formatPoints(result.transferredPoints)} pontos de ${origin} para ${destination} sem bônus, ` +
            `você recebe ${formatPoints(result.totalMiles)} milhas.`;
    }
    return `Transferindo ${formatPoints(result.transferredPoints)} pontos de ${origin} para ${destination} com ${bonus}% de bônus, ` +
        `você recebe ${formatPoints(result.totalMiles)} milhas — ${formatPoints(result.bonusMiles)} delas de bônus ` +
        `(${ratio} milhas por ponto).`;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Default number of days after the invoice due date until points are usually credited. */
export const DEFAULT_CREDIT_DAYS_AFTER_DUE = 30;

/** Suggested credit date for points of an invoice: due date of that month + N days. */
export function suggestExpectedCreditDate(month: number, year: number, dueDay: number, daysAfterDue = DEFAULT_CREDIT_DAYS_AFTER_DUE): Date {
    const lastDay = new Date(year, month, 0).getDate();
    const due = new Date(year, month - 1, Math.min(dueDay, lastDay));
    due.setDate(due.getDate() + daysAfterDue);
    return due;
}

/** yyyy-mm-dd in local time, for <input type="date">. */
export function toDateInputValue(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Date-only values are sent as "yyyy-mm-dd" and stored as UTC midnight.
 * Read them back by their UTC calendar day so UTC-3 doesn't show the previous day.
 */
export function fromApiDate(iso: string): Date {
    const d = new Date(iso);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Whole days from `today` until `date` (negative when in the past), ignoring time of day. */
export function daysUntil(date: Date, today: Date = new Date()): number {
    const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const b = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.round((b - a) / 86_400_000);
}

/** An entry is late when its points were expected already but are not credited yet. */
export function isOverdue(status: MilesStatus, expectedCreditDate: Date, today: Date = new Date()): boolean {
    return status !== "CREDITED" && daysUntil(expectedCreditDate, today) < 0;
}
