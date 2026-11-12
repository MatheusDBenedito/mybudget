// Dashboard layout helpers. Pure functions (no React/aliases) so they can run under `node --test`.

export const DASHBOARD_BLOCK_IDS = [
    "forecast",
    "bills",
    "moneywhere",
    "cards",
    "spending",
    "cashflow-chart",
    "investments-chart",
    "yields-projection",
] as const;

export type DashboardBlockId = (typeof DASHBOARD_BLOCK_IDS)[number];

export const MIN_DASHBOARD_WIDTH_PCT = 20;
export const MAX_DASHBOARD_WIDTH_PCT = 100;

export const MIN_DASHBOARD_HEIGHT_PX = 260;
export const MAX_DASHBOARD_HEIGHT_PX = 760;
export const DEFAULT_DASHBOARD_HEIGHT_PX = 460;

export type DashboardLayoutItem = {
    id: DashboardBlockId;
    /** Width percentage (20..100). 33 and 67 render as exact thirds (33.3333% / 66.6667%). */
    width: number;
    height: number;
};

export const DASHBOARD_BLOCK_TITLES: Record<DashboardBlockId, string> = {
    forecast: "Previsão do mês",
    bills: "Contas a pagar",
    moneywhere: "Onde está meu dinheiro",
    cards: "Cartões",
    spending: "Gastos por categoria",
    "cashflow-chart": "Recebimentos x Despesas",
    "investments-chart": "Investimentos",
    "yields-projection": "Projeção de Rendimentos (12m)",
};

export const DEFAULT_LAYOUT: DashboardLayoutItem[] = [
    { id: "forecast", width: 67, height: DEFAULT_DASHBOARD_HEIGHT_PX },
    { id: "bills", width: 33, height: DEFAULT_DASHBOARD_HEIGHT_PX },
    { id: "moneywhere", width: 33, height: DEFAULT_DASHBOARD_HEIGHT_PX },
    { id: "cards", width: 33, height: DEFAULT_DASHBOARD_HEIGHT_PX },
    { id: "spending", width: 33, height: DEFAULT_DASHBOARD_HEIGHT_PX },
    { id: "yields-projection", width: 100, height: DEFAULT_DASHBOARD_HEIGHT_PX },
    { id: "cashflow-chart", width: 67, height: DEFAULT_DASHBOARD_HEIGHT_PX },
    { id: "investments-chart", width: 33, height: DEFAULT_DASHBOARD_HEIGHT_PX },
];

export const DASHBOARD_LAYOUT_CACHE_KEY = "mybudget:dashboard-layout:v1";

const LEGACY_HEIGHT_MAP: Record<string, number> = {
    sm: 340,
    md: 460,
    lg: 580,
};

const isBlockId = (value: unknown): value is DashboardBlockId =>
    typeof value === "string" && (DASHBOARD_BLOCK_IDS as readonly string[]).includes(value);

export const clampWidthPct = (value: number): number =>
    Math.max(MIN_DASHBOARD_WIDTH_PCT, Math.min(MAX_DASHBOARD_WIDTH_PCT, Math.round(value)));

export const clampHeightPx = (value: number): number =>
    Math.max(MIN_DASHBOARD_HEIGHT_PX, Math.min(MAX_DASHBOARD_HEIGHT_PX, Math.round(value)));

export const widthCssPercent = (width: number): string => {
    const clamped = clampWidthPct(width);
    if (clamped === 33) return "33.33%";
    if (clamped === 67) return "66.66%";
    return `${clamped}%`;
};

const defaultWidthOf = (id: DashboardBlockId): number =>
    DEFAULT_LAYOUT.find(item => item.id === id)?.width ?? 33;

const defaultHeightOf = (id: DashboardBlockId): number =>
    DEFAULT_LAYOUT.find(item => item.id === id)?.height ?? DEFAULT_DASHBOARD_HEIGHT_PX;

const parseWidth = (value: unknown, fallback: number): number => {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    // Migrate legacy 12-column values (3..12) to percentage widths
    if (value >= 3 && value <= 12) {
        return clampWidthPct(Math.round((value / 12) * 100));
    }
    if (value < MIN_DASHBOARD_WIDTH_PCT || value > MAX_DASHBOARD_WIDTH_PCT) return fallback;
    return Math.round(value);
};

const parseHeight = (value: unknown, fallback: number): number => {
    if (typeof value === "string" && value in LEGACY_HEIGHT_MAP) {
        return LEGACY_HEIGHT_MAP[value];
    }
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return clampHeightPx(value);
};

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
        const candidate = raw as { id?: unknown; width?: unknown; height?: unknown };
        if (!isBlockId(candidate.id) || seen.has(candidate.id)) continue;
        seen.add(candidate.id);
        items.push({
            id: candidate.id,
            width: parseWidth(candidate.width, defaultWidthOf(candidate.id)),
            height: parseHeight(candidate.height, defaultHeightOf(candidate.id)),
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

/** Updates the width (20..100%) and/or height (px) of a single block, clamping to bounds. */
export function setBlockSize(
    layout: DashboardLayoutItem[],
    id: DashboardBlockId,
    size: { width?: number; height?: number },
): DashboardLayoutItem[] {
    return layout.map(item => {
        if (item.id !== id) return item;
        return {
            ...item,
            width: size.width !== undefined ? clampWidthPct(size.width) : item.width,
            height: size.height !== undefined ? clampHeightPx(size.height) : item.height,
        };
    });
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
