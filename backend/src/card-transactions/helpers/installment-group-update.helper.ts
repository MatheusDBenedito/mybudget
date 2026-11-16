import { addMonths } from 'date-fns';
import { calculateInvoiceDate } from '../../credit-cards/helpers/invoice-calculator.helper';

export interface InstallmentSiblingInput {
    id: string;
    description: string;
    date: Date;
    invoiceDate: Date;
}

export interface InstallmentGroupUpdateItem {
    id: string;
    date: Date;
    invoiceDate: Date;
}

/**
 * Extracts the 1-based installment number from a description suffix like "(6/10)".
 * Falls back to `fallbackPosition` when no suffix is present.
 */
export function extractInstallmentNumber(description: string, fallbackPosition: number): number {
    const match = /\((\d+)\s*\/\s*\d+\)\s*$/.exec(description.trim());
    if (!match) return fallbackPosition;
    const parsed = parseInt(match[1], 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallbackPosition;
}

/**
 * Computes updated `date` and `invoiceDate` for all installments in a group when
 * the purchase date or target card changes, preserving each installment's `(k/N)` offset
 * relative to the original purchase date.
 */
export function planInstallmentGroupSchedule(params: {
    siblings: InstallmentSiblingInput[];
    newPurchaseDate?: Date;
    invoiceClosingOffset: number;
    dueDay: number;
}): InstallmentGroupUpdateItem[] {
    const sorted = [...params.siblings].sort(
        (a, b) =>
            extractInstallmentNumber(a.description, 0) - extractInstallmentNumber(b.description, 0) ||
            a.invoiceDate.getTime() - b.invoiceDate.getTime(),
    );

    return sorted.map((sib, idx) => {
        const installmentNumber = extractInstallmentNumber(sib.description, idx + 1);
        const offsetMonths = Math.max(0, installmentNumber - 1);
        const baseDate = params.newPurchaseDate ?? sib.date;
        const simulatedDate = addMonths(baseDate, offsetMonths);
        const invoiceDate = calculateInvoiceDate(
            simulatedDate,
            params.invoiceClosingOffset,
            params.dueDay,
        );

        return {
            id: sib.id,
            date: baseDate,
            invoiceDate,
        };
    });
}
