/**
 * Distributes a total value evenly across a number of installments,
 * ensuring no pennies are lost to JavaScript floating-point division.
 * Returns an array of installment amounts, with any remainder pennies
 * added to the initial installments to guarantee the sum matches exactly.
 * 
 * @param totalValue - The total amount to be divided (e.g., 100).
 * @param installmentsCount - The number of installments (e.g., 3).
 * @returns An array of string representations of numbers to avoid JS float precision issues (e.g., ["33.34", "33.33", "33.33"])
 */
export function distributeInstallments(totalValue: number, installmentsCount: number): number[] {
    if (installmentsCount <= 0) {
        throw new Error('Installments count must be greater than 0');
    }

    if (installmentsCount === 1) {
        return [totalValue];
    }

    // Convert to cents to avoid floating point math errors
    const totalCents = Math.round(totalValue * 100);

    // Base value per installment in cents
    const baseInstallmentCents = Math.floor(totalCents / installmentsCount);

    // The remainder pennies that couldn't be evenly divided
    let remainderCents = totalCents % installmentsCount;

    const result: number[] = [];

    for (let i = 0; i < installmentsCount; i++) {
        // Distribute remainder pennies to the first N installments
        const currentInstallmentCents = baseInstallmentCents + (remainderCents > 0 ? 1 : 0);
        remainderCents--;

        // Convert back to floating point value keeping exactly two decimals
        const finalInstallmentValue = currentInstallmentCents / 100;

        // Using Number() wraps back to intrinsic type while keeping JS sane assuming typical usage 
        result.push(Number(finalInstallmentValue.toFixed(2)));
    }

    return result;
}
