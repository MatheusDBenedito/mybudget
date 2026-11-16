import { calculateInvoiceDate } from '../invoice-calculator.helper';

describe('Invoice Calculator Helper', () => {
    it('should charge in the current month if purchase is before closing day', () => {
        // Compra dia 10 de Junho. Vence dia 25, fecha 10 dias antes (dia 15).
        const purchaseDate = new Date(2026, 5, 10); // Meses no JS são 0-indexed (5 = Junho)
        const result = calculateInvoiceDate(purchaseDate, 10, 25);

        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(5); // Junho
        expect(result.getDate()).toBe(25);
    });

    it('should charge in the next month if purchase is on or after closing day', () => {
        // Compra dia 15 de Junho. Fecha dia 15. Vence dia 25. (Cai para Julho)
        const purchaseDate = new Date(2026, 5, 15);
        const result = calculateInvoiceDate(purchaseDate, 15, 25);

        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(6); // Julho
        expect(result.getDate()).toBe(25);
    });

    it('should correctly rollover the year if purchase is in December after closing day', () => {
        // Compra 20 de Dezembro de 2026. Fecha dia 15. Vence dia 25. (Cai para Janeiro de 2027)
        const purchaseDate = new Date(2026, 11, 20); // 11 = Dezembro
        const result = calculateInvoiceDate(purchaseDate, 15, 25);

        expect(result.getFullYear()).toBe(2027);
        expect(result.getMonth()).toBe(0); // Janeiro
        expect(result.getDate()).toBe(25);
    });

    it('should cap due date to the last day of the month (e.g., February edge case)', () => {
        // Compra dia 10 de Fevereiro. Fecha dia 15. Vence dia 31.
        // O vencimento precisa ser o último dia de Fevereiro (28) para o respectivo ano.
        const purchaseDate = new Date(2026, 1, 10); // 1 = Fevereiro
        const result = calculateInvoiceDate(purchaseDate, 15, 31);

        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(1); // Fevereiro
        expect(result.getDate()).toBe(28); // Fevereiro não tem dia 31 em 2026
    });

    it('should handle leap years correctly for February due dates', () => {
        // Compra dia 10 de Fevereiro. Fecha dia 15. Vence dia 31.
        // Vencimento será dia 29 (Fevereiro em ano bissexto: 2024).
        const purchaseDate = new Date(2024, 1, 10);
        const result = calculateInvoiceDate(purchaseDate, 15, 31);

        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(1);
        expect(result.getDate()).toBe(29);
    });

    it('should skip past the next month invoice when dueDay <= invoiceClosingOffset and purchase is on/after next month closing date', () => {
        // Cartão vence dia 5, fecha 7 dias antes:
        // - Fatura de Set/2026 (vence 05/09) fecha em 29/08.
        // - Compra em 28/08 (< 29/08) -> Set/2026 (05/09)
        const beforeClosing = calculateInvoiceDate(new Date(2026, 7, 28), 7, 5);
        expect(beforeClosing.getFullYear()).toBe(2026);
        expect(beforeClosing.getMonth()).toBe(8); // Setembro
        expect(beforeClosing.getDate()).toBe(5);

        // - Compra em 30/08 (>= 29/08) -> Out/2026 (05/10), nunca Set/2026!
        const afterClosing = calculateInvoiceDate(new Date(2026, 7, 30), 7, 5);
        expect(afterClosing.getFullYear()).toBe(2026);
        expect(afterClosing.getMonth()).toBe(9); // Outubro
        expect(afterClosing.getDate()).toBe(5);
    });
});
