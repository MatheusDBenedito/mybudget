import { calculateInvoiceDate } from '../../credit-cards/helpers/invoice-calculator.helper';

export interface ExternalCreditCardMetadata {
    installmentNumber?: number;
    totalInstallments?: number;
    billForecastDate?: string;
    billPostDate?: string | null;
    cardNumber?: string;
    purchaseDate?: string | Date;
    otherCreditsType?: string;
}

export interface ExternalTransaction {
    id: string;
    description: string;
    amount: number;
    date: string | Date;
    type: 'DEBIT' | 'CREDIT';
    creditCardMetadata?: ExternalCreditCardMetadata | null;
}

export type ExternalBankTransaction = ExternalTransaction;

export interface MappedLocalTransaction {
    externalId: string;
    description: string;
    amount: number;
    date: Date;
    type: 'INCOME' | 'EXPENSE';
    status: 'PAID';
}

export interface UnlinkedLocalTransactionCandidate {
    id: string;
    amount: number;
    date: Date;
    type: 'INCOME' | 'EXPENSE';
}

export interface ReconcileLink {
    localId: string;
    externalId: string;
}

export interface BankSyncPlan {
    toCreate: MappedLocalTransaction[];
    toLink: ReconcileLink[];
    skippedCount: number;
    balanceDelta: number;
}

export interface UnlinkedLocalCardTransactionCandidate {
    id: string;
    amount: number;
    date: Date;
    invoiceDate: Date;
}

export interface MappedLocalCardTransaction {
    externalId: string;
    description: string;
    amount: number;
    date: Date;
    invoiceDate: Date;
    installments: number;
    cardLast4: string | null;
}

export interface CardSyncPlan {
    toCreate: MappedLocalCardTransaction[];
    toLink: ReconcileLink[];
    skippedCount: number;
}

const TWO_DAYS_MS = 2 * 86_400_000;
const BILL_PAYMENT_REGEX = /pagamento\s*(de\s*)?fatura|pagto\s*fatura|pagamento\s*recebido|credit\s*card\s*payment|inclusao\s*de\s*pagamento/i;

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

function normalizeDescription(raw: string | undefined): string {
    return (raw || 'Lançamento Open Finance').trim().slice(0, 200);
}

function parseDateSafe(input: string | Date | undefined): Date | null {
    if (!input) return null;
    const d = input instanceof Date ? input : new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
}

function extractLast4(cardNumber: string | undefined): string | null {
    if (!cardNumber) return null;
    const digits = cardNumber.replace(/\D/g, '');
    return digits.length >= 4 ? digits.slice(-4) : null;
}

function invoiceDateFromYearMonth(yearMonth: string, dueDay: number): Date | null {
    const match = /^(\d{4})-(\d{2})/.exec(yearMonth.trim());
    if (!match) return null;
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) return null;
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const clampedDay = dueDay > lastDay ? lastDay : dueDay;
    return new Date(year, monthIndex, clampedDay);
}

export function mapExternalTransactionsToLocal(params: {
    transactions: ExternalTransaction[];
    existingExternalIds: Set<string>;
    unlinkedCandidates?: UnlinkedLocalTransactionCandidate[];
}): BankSyncPlan {
    const seen = new Set<string>(params.existingExternalIds);
    const consumedCandidateIds = new Set<string>();
    const candidates = params.unlinkedCandidates ?? [];
    const toCreate: MappedLocalTransaction[] = [];
    const toLink: ReconcileLink[] = [];
    let skippedCount = 0;
    let balanceDelta = 0;

    for (const tx of params.transactions) {
        if (!tx.id || seen.has(tx.id)) {
            skippedCount += 1;
            continue;
        }
        const absAmount = round2(Math.abs(Number(tx.amount)));
        if (!(absAmount > 0)) {
            skippedCount += 1;
            continue;
        }

        const parsedDate = parseDateSafe(tx.date);
        if (!parsedDate) {
            skippedCount += 1;
            continue;
        }

        const localType: 'INCOME' | 'EXPENSE' = tx.type === 'CREDIT' ? 'INCOME' : 'EXPENSE';
        seen.add(tx.id);

        const match = candidates.find(
            (c) =>
                !consumedCandidateIds.has(c.id) &&
                c.type === localType &&
                Math.abs(round2(c.amount) - absAmount) < 0.01 &&
                Math.abs(c.date.getTime() - parsedDate.getTime()) <= TWO_DAYS_MS,
        );

        if (match) {
            consumedCandidateIds.add(match.id);
            toLink.push({ localId: match.id, externalId: tx.id });
            skippedCount += 1;
            continue;
        }

        toCreate.push({
            externalId: tx.id,
            description: normalizeDescription(tx.description),
            amount: absAmount,
            date: parsedDate,
            type: localType,
            status: 'PAID',
        });

        balanceDelta += localType === 'INCOME' ? absAmount : -absAmount;
    }

    return {
        toCreate,
        toLink,
        skippedCount,
        balanceDelta: round2(balanceDelta),
    };
}

export function mapExternalCardTransactionsToLocal(params: {
    transactions: ExternalTransaction[];
    existingExternalIds: Set<string>;
    invoiceClosingOffset: number;
    dueDay: number;
    unlinkedCandidates?: UnlinkedLocalCardTransactionCandidate[];
}): CardSyncPlan {
    const seen = new Set<string>(params.existingExternalIds);
    const consumedCandidateIds = new Set<string>();
    const candidates = params.unlinkedCandidates ?? [];
    const toCreate: MappedLocalCardTransaction[] = [];
    const toLink: ReconcileLink[] = [];
    let skippedCount = 0;

    for (const tx of params.transactions) {
        if (!tx.id || seen.has(tx.id)) {
            skippedCount += 1;
            continue;
        }

        const absAmount = round2(Math.abs(Number(tx.amount)));
        if (!(absAmount > 0)) {
            skippedCount += 1;
            continue;
        }

        const meta = tx.creditCardMetadata;
        if (
            tx.type === 'CREDIT' &&
            (meta?.otherCreditsType === 'CREDIT_CARD_PAYMENT' || BILL_PAYMENT_REGEX.test(tx.description || ''))
        ) {
            skippedCount += 1;
            continue;
        }

        const purchaseDate = parseDateSafe(meta?.purchaseDate) ?? parseDateSafe(tx.date);
        if (!purchaseDate) {
            skippedCount += 1;
            continue;
        }

        const invoiceDate =
            (meta?.billForecastDate && invoiceDateFromYearMonth(meta.billForecastDate, params.dueDay)) ||
            (meta?.billPostDate && invoiceDateFromYearMonth(meta.billPostDate, params.dueDay)) ||
            calculateInvoiceDate(purchaseDate, params.invoiceClosingOffset, params.dueDay);

        // Purchases (DEBIT) add to the invoice (+); refunds/estornos (CREDIT) reduce it (-)
        const signedAmount = tx.type === 'CREDIT' ? -absAmount : absAmount;

        const totalInstallments =
            meta?.totalInstallments && meta.totalInstallments > 1 ? Math.trunc(meta.totalInstallments) : 1;
        const installmentNumber =
            meta?.installmentNumber && meta.installmentNumber >= 1 ? Math.trunc(meta.installmentNumber) : 1;

        let description = normalizeDescription(tx.description);
        if (totalInstallments > 1 && !/\(\d+\/\d+\)\s*$/.test(description)) {
            description = `${description.slice(0, 185)} (${installmentNumber}/${totalInstallments})`;
        }

        seen.add(tx.id);

        const match = candidates.find(
            (c) =>
                !consumedCandidateIds.has(c.id) &&
                Math.abs(round2(c.amount) - signedAmount) < 0.01 &&
                c.invoiceDate.getFullYear() === invoiceDate.getFullYear() &&
                c.invoiceDate.getMonth() === invoiceDate.getMonth(),
        );

        if (match) {
            consumedCandidateIds.add(match.id);
            toLink.push({ localId: match.id, externalId: tx.id });
            skippedCount += 1;
            continue;
        }

        toCreate.push({
            externalId: tx.id,
            description,
            amount: signedAmount,
            date: purchaseDate,
            invoiceDate,
            installments: totalInstallments,
            cardLast4: extractLast4(meta?.cardNumber),
        });
    }

    return {
        toCreate,
        toLink,
        skippedCount,
    };
}
