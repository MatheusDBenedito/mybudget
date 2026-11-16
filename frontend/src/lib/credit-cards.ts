// Credit card helpers. Pure functions (no React/aliases) so they can run under `node --test`.

export type InvoiceGroupKey = "fixed" | "installments" | "single";

export const INVOICE_GROUP_LABELS: Record<InvoiceGroupKey, string> = {
    fixed: "Fixos",
    installments: "Parcelados",
    single: "À vista",
};

type InvoiceItemLike = { amount: number; installments?: number | null; isFixed?: boolean | null };

export type InvoiceGroup<T> = { key: InvoiceGroupKey; label: string; items: T[]; total: number };

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Splits an invoice into Fixos (always first), Parcelados and À vista, keeping each item's order.
 * Refunds (negative amounts) stay with single purchases. Empty groups are kept so the layout is stable;
 * `total` is the sum of every group.
 */
export function groupInvoice<T extends InvoiceItemLike>(items: T[]): { groups: InvoiceGroup<T>[]; total: number } {
    const keyOf = (item: T): InvoiceGroupKey =>
        item.isFixed ? "fixed" : (item.installments ?? 1) > 1 ? "installments" : "single";
    const groups = (Object.keys(INVOICE_GROUP_LABELS) as InvoiceGroupKey[]).map(key => {
        const groupItems = items.filter(item => keyOf(item) === key);
        return { key, label: INVOICE_GROUP_LABELS[key], items: groupItems, total: round2(groupItems.reduce((a, i) => a + i.amount, 0)) };
    });
    return { groups, total: round2(groups.reduce((a, g) => a + g.total, 0)) };
}

/**
 * Invoice (identified by its due month) that is open today, i.e. where a purchase made today goes.
 * Same rule as the backend: an invoice closes `closingOffset` days before its due date; purchases on or
 * after the closing date go to the next month's invoice.
 */
export function openInvoiceMonth(today: Date, closingOffset: number, dueDay: number): { month: number; year: number } {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let year = day.getFullYear();
    let month0 = day.getMonth();

    for (let guard = 0; guard < 12; guard++) {
        const lastDay = new Date(year, month0 + 1, 0).getDate();
        const closing = new Date(year, month0, Math.min(dueDay, lastDay));
        closing.setDate(closing.getDate() - closingOffset);

        if (day < closing) {
            return { month: month0 + 1, year };
        }

        month0 += 1;
        if (month0 > 11) {
            month0 = 0;
            year += 1;
        }
    }

    return { month: month0 + 1, year };
}

type CardLike = { isPrimary?: boolean | null };

/**
 * Favorite card, i.e. the one featured on the summary. Falls back to the first card when none is
 * marked (legacy data) and returns null for an empty list.
 */
export function primaryCard<T extends CardLike>(cards: T[]): T | null {
    return cards.find(c => c.isPrimary) ?? cards[0] ?? null;
}

export type CardHolderLike = {
    id: string;
    name: string;
    last4?: string | null;
    isMain?: boolean | null;
};

/** Holders with the main one first, then alphabetical (same order as the API). */
export function holdersOf<T extends CardHolderLike>(holders?: readonly T[] | null): T[] {
    return [...(holders ?? [])].sort((a, b) =>
        Number(!!b.isMain) - Number(!!a.isMain) || a.name.localeCompare(b.name, "pt-BR"),
    );
}

export function mainHolder<T extends CardHolderLike>(holders?: readonly T[] | null): T | null {
    return holdersOf(holders)[0] ?? null;
}

/** "Matheus" or "Matheus ••1234" when the card final digits are known. */
export function holderLabel(holder: Pick<CardHolderLike, "name" | "last4">): string {
    return holder.last4 ? `${holder.name} ••${holder.last4}` : holder.name;
}

type InvoiceItemWithHolder = {
    amount: number;
    cardHolder?: Pick<CardHolderLike, "id" | "name" | "last4"> | null;
    cardHolderId?: string | null;
};

export type HolderTotal = {
    id: string;
    name: string;
    total: number;
    count: number;
};

/**
 * Totals per holder for an invoice. Every registered holder is returned (even with
 * zero), in the same order as the holder picker.
 */
export function holderTotals<T extends InvoiceItemWithHolder>(
    items: T[],
    holders?: readonly CardHolderLike[] | null,
): HolderTotal[] {
    const totals = new Map<string, HolderTotal>();

    for (const holder of holdersOf(holders)) {
        totals.set(holder.id, {
            id: holder.id,
            name: holderLabel(holder),
            total: 0,
            count: 0,
        });
    }

    for (const item of items) {
        const id = item.cardHolder?.id ?? item.cardHolderId ?? "unknown";
        const name = item.cardHolder ? holderLabel(item.cardHolder) : "Sem portador";
        const current = totals.get(id) ?? { id, name, total: 0, count: 0 };
        current.total += item.amount;
        current.count += 1;
        totals.set(id, current);
    }

    return [...totals.values()].map(item => ({ ...item, total: round2(item.total) }));
}

/** `null` means "all holders"; otherwise keeps only the selected holder's items. */
export function filterByHolder<T extends InvoiceItemWithHolder>(
    items: T[],
    holderId: string | null,
): T[] {
    if (!holderId) return items;
    return items.filter(item => (item.cardHolder?.id ?? item.cardHolderId) === holderId);
}

export type HolderSection<T> = {
    id: string;
    name: string;
    isMain: boolean;
    items: T[];
    total: number;
};

/**
 * Splits an invoice into one section per holder (titular first, then additional holders)
 * inside the same card. Holders without items in the month are kept so the user can see
 * R$ 0,00 on an unused additional card.
 */
export function groupInvoiceByHolder<T extends InvoiceItemWithHolder>(
    items: T[],
    holders?: readonly CardHolderLike[] | null,
): { sections: HolderSection<T>[]; total: number } {
    const ordered = holdersOf(holders);
    const sectionsMap = new Map<string, HolderSection<T>>();

    for (const holder of ordered) {
        sectionsMap.set(holder.id, {
            id: holder.id,
            name: holderLabel(holder),
            isMain: !!holder.isMain,
            items: [],
            total: 0,
        });
    }

    for (const item of items) {
        const id = item.cardHolder?.id ?? item.cardHolderId ?? "unknown";
        const name = item.cardHolder ? holderLabel(item.cardHolder) : "Sem portador";
        let section = sectionsMap.get(id);
        if (!section) {
            section = { id, name, isMain: false, items: [], total: 0 };
            sectionsMap.set(id, section);
        }
        section.items.push(item);
        section.total = round2(section.total + item.amount);
    }

    const sections = [...sectionsMap.values()];
    const total = round2(sections.reduce((acc, s) => acc + s.total, 0));
    return { sections, total };
}
