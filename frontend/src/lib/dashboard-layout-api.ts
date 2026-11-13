import {
    normalizeLayout,
    type DashboardLayoutItem,
} from "@/lib/dashboard-layout";
import { API_BASE_URL } from "@/lib/auth";


type LayoutResponse = {
    items?: unknown;
    updatedAt?: string | null;
};

export async function fetchDashboardLayout(): Promise<DashboardLayoutItem[]> {
    const res = await fetch(`${API_BASE_URL}/dashboard-layout`, { cache: "no-store" });
    if (!res.ok) throw new Error("Falha ao carregar a personalização do Resumo.");

    const data = (await res.json()) as LayoutResponse;
    return normalizeLayout(data.items);
}

export async function saveDashboardLayout(
    items: DashboardLayoutItem[],
): Promise<DashboardLayoutItem[]> {
    const res = await fetch(`${API_BASE_URL}/dashboard-layout`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
    });

    if (!res.ok) throw new Error("Falha ao salvar a personalização do Resumo.");

    const data = (await res.json()) as LayoutResponse;
    return normalizeLayout(data.items);
}
