// Dashboard layout helpers. Pure functions (no React/aliases) so they can run under `node --test`.

export const DASHBOARD_BLOCK_IDS = [
    "forecast",
    "bills",
    "moneywhere",
    "cards",
    "spending",
    "cashflow-chart",
    "investments-chart",
] as const;

export type DashboardBlockId = (typeof DASHBOARD_BLOCK_IDS)[number];

export const DASHBOARD_WIDTHS = [4, 6, 8, 12] as const;

export type DashboardWidth = (typeof DASHBOARD_WIDTHS)[number];

export type DashboardLayoutItem = {
    id: DashboardBlockId;
    width: DashboardWidth;
};

export const DASHBOARD_BLOCK_TITLES: Record<DashboardBlockId, string> = {
    forecast: "Previsão do mês",
    bills: "Contas a pagar",
    moneywhere: "Onde está meu dinheiro",
    cards: "Cartões",
    spending: "Gastos por categoria",
    "cashflow-chart": "Recebimentos x Despesas",
    "investments-chart": "Investimentos",
};

export const DASHBOARD_WIDTH_LABELS: Record<DashboardWidth, string> = {
    4: "1/3",
    6: "1/2",
    8: "2/3",
    12: "100%",
};

export const DEFAULT_LAYOUT: DashboardLayoutItem[] = [
    { id: "forecast", width: 8 },
    { id: "bills", width: 4 },
    { id: "moneywhere", width: 4 },
    { id: "cards", width: 4 },
    { id: "spending", width: 4 },
    { id: "cashflow-chart", width: 8 },
    { id: "investments-chart", width: 4 },
];

export const DASHBOARD_LAYOUT_CACHE_KEY = "mybudget:dashboard-layout:v1";

const isBlockId = (value: unknown): value is DashboardBlockId =>
    typeof value === "string" && (DASHBOARD_BLOCK_IDS as readonly string[]).includes(value);

const isWidth = (value: unknown): value is DashboardWidth =>
    typeof value === "number" && (DASHBOARD_WIDTHS as readonly number[]).includes(value);

const defaultWidthOf = (id: DashboardBlockId): DashboardWidth =>
    DEFAULT_LAYOUT.find(item => item.id === id)?.width ?? 4;

/**
 * Keeps the saved order, drops unknown/duplicated blocks and appends missing ones
 * (in the default order) so a new block never disappears after an update.
 */
export function normalizeLayout(value: unknown): DashboardLayoutItem[] {
    const rawItems = Array.isArray(value) ? value : [];
    const seen = new Set<DashboardBlockId>();
    const items: DashboardLayoutItem[] = [];

    for (const raw of rawItems) {
        if (!raw || typeof raw !== "object") continue;
        const candidate = raw as { id?: unknown; width?: unknown };
        if (!isBlockId(candidate.id) || seen.has(candidate.id)) continue;
        seen.add(candidate.id);
        items.push({
            id: candidate.id,
            width: isWidth(candidate.width) ? candidate.width : defaultWidthOf(candidate.id),
        });
    }

    for (const item of DEFAULT_LAYOUT) {
        if (!seen.has(item.id)) items.push({ ...item });
    }

    return items;
}

/** Moves `activeId` to the position currently occupied by `overId` (drag and drop). */
export function moveTo(
    layout: DashboardLayoutItem[],
    activeId: DashboardBlockId,
    overId: DashboardBlockId,
): DashboardLayoutItem[] {
    const from = layout.findIndex(item => item.id === activeId);
    const to = layout.findIndex(item => item.id === overId);
    if (from < 0 || to < 0 || from === to) return layout;

    const next = [...layout];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
}

/** Moves a block one position left (-1) or right (+1) (arrow buttons). */
export function moveBy(
    layout: DashboardLayoutItem[],
    id: DashboardBlockId,
    direction: -1 | 1,
): DashboardLayoutItem[] {
    const from = layout.findIndex(item => item.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= layout.length) return layout;

    const next = [...layout];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
}

export function setWidth(
    layout: DashboardLayoutItem[],
    id: DashboardBlockId,
    width: DashboardWidth,
): DashboardLayoutItem[] {
    return layout.map(item => (item.id === id ? { ...item, width } : item));
}

export function readCachedLayout(storage?: Storage): DashboardLayoutItem[] | null {
    try {
        const target = storage ?? (typeof window === "undefined" ? null : window.localStorage);
        if (!target) return null;
        const raw = target.getItem(DASHBOARD_LAYOUT_CACHE_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        return normalizeLayout(parsed);
    } catch {
        return null;
    }
}

export function writeCachedLayout(
    layout: DashboardLayoutItem[],
    storage?: Storage,
): boolean {
    try {
        const target = storage ?? (typeof window === "undefined" ? null : window.localStorage);
        if (!target) return false;
        target.setItem(DASHBOARD_LAYOUT_CACHE_KEY, JSON.stringify(layout));
        return true;
    } catch {
        return false;
    }
}
