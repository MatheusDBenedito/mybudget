import { distributeInstallments } from '../../common/helpers/penny-pinching.helper';

export type InstallmentDraftInput = {
    description: string;
    amount: number;
    date: Date;
    explicitStatus?: 'PAID' | 'PENDING' | 'CANCELLED';
    installments: number;
    today?: Date;
};

export type InstallmentDraft = {
    description: string;
    amount: number;
    date: Date;
    status: 'PAID' | 'PENDING' | 'CANCELLED';
    installments: number;
    installmentNumber: number;
};

/**
 * Advances `baseDate` by `monthsToAdd` months, clamping the day to the last valid day of the target month
 * (e.g., Jan 31 + 1 month -> Feb 28/29) while preserving the time-of-day.
 */
export function addMonthsClamped(baseDate: Date, monthsToAdd: number): Date {
    if (monthsToAdd === 0) return new Date(baseDate.getTime());
    const targetYear = baseDate.getFullYear();
    const targetMonthIndex = baseDate.getMonth() + monthsToAdd;
    const normalized = new Date(targetYear, targetMonthIndex, 1);
    const lastDay = new Date(normalized.getFullYear(), normalized.getMonth() + 1, 0).getDate();
    return new Date(
        normalized.getFullYear(),
        normalized.getMonth(),
        Math.min(baseDate.getDate(), lastDay),
        baseDate.getHours(),
        baseDate.getMinutes(),
        baseDate.getSeconds(),
        baseDate.getMilliseconds(),
    );
}

/**
 * Builds the flat installment drafts for a non-fixed account transaction (e.g. 10x IPTU, 48x car financing),
 * distributing remainder pennies across the first installments and resolving each installment's
 * initial status (`PAID` if `date <= end of today`, else `PENDING`) when no explicit status is provided.
 */
export function buildTransactionInstallments(input: InstallmentDraftInput): InstallmentDraft[] {
    const count = Math.min(480, Math.max(1, Math.trunc(input.installments || 1)));
    const amounts = distributeInstallments(input.amount, count);
    const baseDescription = input.description.trim();

    const endOfToday = input.today ? new Date(input.today.getTime()) : new Date();
    endOfToday.setHours(23, 59, 59, 999);

    return amounts.map((amount, index) => {
        const parcelDate = addMonthsClamped(input.date, index);
        const status =
            input.explicitStatus ?? (parcelDate <= endOfToday ? 'PAID' : 'PENDING');

        return {
            description: count > 1 ? `${baseDescription} (${index + 1}/${count})` : baseDescription,
            amount,
            date: parcelDate,
            status,
            installments: count,
            installmentNumber: index + 1,
        };
    });
}

