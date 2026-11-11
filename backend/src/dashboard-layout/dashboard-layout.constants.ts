export const DASHBOARD_BLOCK_IDS = [
    'forecast',
    'bills',
    'moneywhere',
    'cards',
    'spending',
    'cashflow-chart',
    'investments-chart',
] as const;

export type DashboardBlockId = (typeof DASHBOARD_BLOCK_IDS)[number];

export const DASHBOARD_WIDTHS = [4, 6, 8, 12] as const;

export type DashboardWidth = (typeof DASHBOARD_WIDTHS)[number];

export interface DashboardLayoutItem {
    id: DashboardBlockId;
    width: DashboardWidth;
}
