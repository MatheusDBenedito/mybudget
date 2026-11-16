import {
    extractInstallmentNumber,
    planInstallmentGroupSchedule,
} from '../installment-group-update.helper';

describe('installment-group-update.helper', () => {
    it('extracts installment number from (k/N) suffix and falls back otherwise', () => {
        expect(extractInstallmentNumber('Seguro (6/10)', 1)).toBe(6);
        expect(extractInstallmentNumber('Havan (1/5)', 3)).toBe(1);
        expect(extractInstallmentNumber('Sem sufixo', 4)).toBe(4);
    });

    it('recalculates all sibling installments (6/10..10/10) when purchase date is corrected to 2026-05-05', () => {
        // Simulates Seguro (6/10..10/10) imported on 2026-11-10, corrected to purchase date 2026-05-05
        // Card: dueDay = 5, invoiceClosingOffset = 7
        const siblings = [
            { id: '6', description: 'Seguro (6/10)', date: new Date(2026, 10, 10), invoiceDate: new Date(2026, 11, 5) },
            { id: '7', description: 'Seguro (7/10)', date: new Date(2026, 10, 10), invoiceDate: new Date(2027, 0, 5) },
            { id: '8', description: 'Seguro (8/10)', date: new Date(2026, 10, 10), invoiceDate: new Date(2027, 1, 5) },
            { id: '9', description: 'Seguro (9/10)', date: new Date(2026, 10, 10), invoiceDate: new Date(2027, 2, 5) },
            { id: '10', description: 'Seguro (10/10)', date: new Date(2026, 10, 10), invoiceDate: new Date(2027, 3, 5) },
        ];

        const newPurchaseDate = new Date(2026, 4, 5); // 2026-05-05
        const plan = planInstallmentGroupSchedule({
            siblings,
            newPurchaseDate,
            invoiceClosingOffset: 7,
            dueDay: 5,
        });

        expect(plan.map(p => ({ id: p.id, year: p.invoiceDate.getFullYear(), month: p.invoiceDate.getMonth() + 1 }))).toEqual([
            { id: '6', year: 2026, month: 11 }, // 6/10 -> Nov/2026
            { id: '7', year: 2026, month: 12 }, // 7/10 -> Dec/2026
            { id: '8', year: 2027, month: 1 },  // 8/10 -> Jan/2027
            { id: '9', year: 2027, month: 2 },  // 9/10 -> Feb/2027
            { id: '10', year: 2027, month: 3 }, // 10/10 -> Mar/2027
        ]);
        expect(plan.every(p => p.date.getTime() === newPurchaseDate.getTime())).toBe(true);
    });
});
