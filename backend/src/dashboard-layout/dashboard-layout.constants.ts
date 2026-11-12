export const DASHBOARD_BLOCK_IDS = [
    'forecast',
    'bills',
    'moneywhere',
    'cards',
    'spending',
    'cashflow-chart',
    'investments-chart',
    'yields-projection',
] as const;

export type DashboardBlockId = (typeof DASHBOARD_BLOCK_IDS)[number];

export const MIN_DASHBOARD_WIDTH_PCT = 20;
export const MAX_DASHBOARD_WIDTH_PCT = 100;

export const MIN_DASHBOARD_HEIGHT_PX = 260;
export const MAX_DASHBOARD_HEIGHT_PX = 760;
export const DEFAULT_DASHBOARD_HEIGHT_PX = 460;

export interface DashboardLayoutItem {
    id: DashboardBlockId;
    width: number;
    height?: number | 'sm' | 'md' | 'lg';
}
