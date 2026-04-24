export function calculateInvoiceDate(
    purchaseDate: Date,
    invoiceClosingOffset: number,
    dueDay: number,
): Date {
    // We assume the initial prospective invoice is the same month as the purchase
    let prospectiveInvoiceYear = purchaseDate.getFullYear();
    let prospectiveInvoiceMonth = purchaseDate.getMonth();

    // 1) Find the actual due date for this prospective month.
    // If dueDay is 31 but the month has only 30 days, JS will spill over to the 1st of next month,
    // so we cap it to the last valid day of the prospective month.
    let lastDayOfProspectiveMonth = new Date(prospectiveInvoiceYear, prospectiveInvoiceMonth + 1, 0).getDate();
    let finalDueDay = dueDay > lastDayOfProspectiveMonth ? lastDayOfProspectiveMonth : dueDay;

    let prospectiveDueDate = new Date(prospectiveInvoiceYear, prospectiveInvoiceMonth, finalDueDay);

    // 2) The exact closing date for this prospective invoice is `invoiceClosingOffset` days before the due date.
    let prospectiveClosingDate = new Date(prospectiveDueDate);
    prospectiveClosingDate.setDate(prospectiveClosingDate.getDate() - invoiceClosingOffset);

    // Normalize both dates to midnight to ensure accurate >= comparison by exact date
    const normalizedPurchaseDate = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), purchaseDate.getDate());
    const normalizedClosingDate = new Date(prospectiveClosingDate.getFullYear(), prospectiveClosingDate.getMonth(), prospectiveClosingDate.getDate());

    // 3) Rule: if the purchase happens ON or AFTER the closing date, it belongs to the next month's invoice.
    if (normalizedPurchaseDate.getTime() >= normalizedClosingDate.getTime()) {
        prospectiveInvoiceMonth += 1;
        if (prospectiveInvoiceMonth > 11) {
            prospectiveInvoiceMonth = 0;
            prospectiveInvoiceYear += 1;
        }

        // Must recalculate the due date for this new final invoice month
        lastDayOfProspectiveMonth = new Date(prospectiveInvoiceYear, prospectiveInvoiceMonth + 1, 0).getDate();
        finalDueDay = dueDay > lastDayOfProspectiveMonth ? lastDayOfProspectiveMonth : dueDay;
    }

    return new Date(prospectiveInvoiceYear, prospectiveInvoiceMonth, finalDueDay);
}
