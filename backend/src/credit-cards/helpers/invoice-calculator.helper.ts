export function calculateInvoiceDate(
    purchaseDate: Date,
    invoiceClosingOffset: number,
    dueDay: number,
): Date {
    let prospectiveInvoiceYear = purchaseDate.getFullYear();
    let prospectiveInvoiceMonth = purchaseDate.getMonth();

    const normalizedPurchaseDate = new Date(
        purchaseDate.getFullYear(),
        purchaseDate.getMonth(),
        purchaseDate.getDate(),
    );

    const buildDueDate = (year: number, month: number) => {
        const lastDay = new Date(year, month + 1, 0).getDate();
        const finalDueDay = dueDay > lastDay ? lastDay : dueDay;
        return new Date(year, month, finalDueDay);
    };

    // Advance while purchaseDate >= closingDate of the prospective invoice.
    // Handles cards where dueDay <= invoiceClosingOffset (e.g. dueDay=5, offset=7 ->
    // Sep 5 invoice closes Aug 29, so a purchase on Aug 30 belongs to Oct 5).
    for (let guard = 0; guard < 12; guard++) {
        const prospectiveDueDate = buildDueDate(prospectiveInvoiceYear, prospectiveInvoiceMonth);
        const prospectiveClosingDate = new Date(prospectiveDueDate);
        prospectiveClosingDate.setDate(prospectiveClosingDate.getDate() - invoiceClosingOffset);

        const normalizedClosingDate = new Date(
            prospectiveClosingDate.getFullYear(),
            prospectiveClosingDate.getMonth(),
            prospectiveClosingDate.getDate(),
        );

        if (normalizedPurchaseDate.getTime() < normalizedClosingDate.getTime()) {
            return prospectiveDueDate;
        }

        prospectiveInvoiceMonth += 1;
        if (prospectiveInvoiceMonth > 11) {
            prospectiveInvoiceMonth = 0;
            prospectiveInvoiceYear += 1;
        }
    }

    return buildDueDate(prospectiveInvoiceYear, prospectiveInvoiceMonth);
}
