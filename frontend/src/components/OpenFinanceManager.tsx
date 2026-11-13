"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Trash2, Link2, ExternalLink, CheckCircle2, AlertCircle, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { API_BASE_URL } from "@/lib/auth";
import { formatDate } from "@/lib/format";

type OpenFinanceStatus = {
    provider: string;
    configured: boolean;
    sandbox: boolean;
    workspaceAllowed: boolean;
    restrictedWorkspaceId: string | null;
};

type AccountMap = {
    id: string;
    externalAccountId: string;
    externalName: string;
    externalType: "BANK" | "CREDIT";
    externalSubtype: string | null;
    localAccountId: string | null;
    localCreditCardId: string | null;
    syncEnabled: boolean;
    lastSyncedAt: string | null;
    localAccount?: { id: string; name: string; currency: string } | null;
    localCreditCard?: { id: string; name: string } | null;
};

type OpenFinanceConnection = {
    id: string;
    itemId: string;
    institutionName: string;
    status: string;
    consentExpiresAt: string | null;
    lastSyncedAt: string | null;
    accountMaps: AccountMap[];
};

type LocalAccount = { id: string; name: string; currency: string };
type LocalCard = { id: string; name: string };

export function OpenFinanceManager() {
    const [status, setStatus] = useState<OpenFinanceStatus | null>(null);
    const [connections, setConnections] = useState<OpenFinanceConnection[]>([]);
    const [localAccounts, setLocalAccounts] = useState<LocalAccount[]>([]);
    const [localCards, setLocalCards] = useState<LocalCard[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [itemIdInput, setItemIdInput] = useState("");
    const [institutionInput, setInstitutionInput] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [syncingId, setSyncingId] = useState<string | null>(null);

    const fetchOpenFinanceData = useCallback(async () => {
        const [statusRes, connRes, accRes, cardRes] = await Promise.all([
            fetch(`${API_BASE_URL}/open-finance/status`),
            fetch(`${API_BASE_URL}/open-finance/connections`),
            fetch(`${API_BASE_URL}/accounts`),
            fetch(`${API_BASE_URL}/credit-cards`),
        ]);

        return {
            status: statusRes.ok ? ((await statusRes.json()) as OpenFinanceStatus) : null,
            connections: connRes.ok ? ((await connRes.json()) as OpenFinanceConnection[]) : null,
            localAccounts: accRes.ok ? ((await accRes.json()) as LocalAccount[]) : null,
            localCards: cardRes.ok ? ((await cardRes.json()) as LocalCard[]) : null,
        };
    }, []);

    const loadAll = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await fetchOpenFinanceData();
            if (data.status) setStatus(data.status);
            if (data.connections) setConnections(data.connections);
            if (data.localAccounts) setLocalAccounts(data.localAccounts);
            if (data.localCards) setLocalCards(data.localCards);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar configurações do Open Finance.");
        } finally {
            setIsLoading(false);
        }
    }, [fetchOpenFinanceData]);

    useEffect(() => {
        let active = true;
        fetchOpenFinanceData()
            .then((data) => {
                if (!active) return;
                if (data.status) setStatus(data.status);
                if (data.connections) setConnections(data.connections);
                if (data.localAccounts) setLocalAccounts(data.localAccounts);
                if (data.localCards) setLocalCards(data.localCards);
            })
            .catch((error) => {
                if (!active) return;
                console.error(error);
                toast.error("Erro ao carregar configurações do Open Finance.");
            })
            .finally(() => {
                if (active) setIsLoading(false);
            });

        return () => {
            active = false;
        };
    }, [fetchOpenFinanceData]);

    const handleOpenConnectWidget = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/open-finance/connect-token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message ?? "Não foi possível gerar o Connect Token.");
            }
            const data = (await res.json()) as { accessToken: string };
            const url = `https://connect.pluggy.ai/?connect_token=${encodeURIComponent(data.accessToken)}`;
            window.open(url, "_blank", "noopener,noreferrer");
            toast.success("Pluggy Connect aberto em nova aba. Após concluir, cole o Item ID abaixo.");
        } catch (error) {
            toast.error((error as Error).message);
        }
    };

    const handleRegisterItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!itemIdInput.trim()) {
            toast.error("Informe o Item ID da conexão Pluggy.");
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/open-finance/connections`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    itemId: itemIdInput.trim(),
                    institutionName: institutionInput.trim() || undefined,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message ?? "Erro ao vincular conexão.");
            }
            setItemIdInput("");
            setInstitutionInput("");
            await loadAll();
            toast.success("Conexão Open Finance vinculada com sucesso!");
        } catch (error) {
            toast.error((error as Error).message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleMappingChange = async (
        map: AccountMap,
        targetId: string,
    ) => {
        const normalized = targetId === "NONE" ? null : targetId;
        const body =
            map.externalType === "BANK"
                ? { localAccountId: normalized }
                : { localCreditCardId: normalized };

        try {
            const res = await fetch(`${API_BASE_URL}/open-finance/mappings/${map.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message ?? "Erro ao atualizar vínculo.");
            }
            await loadAll();
            toast.success("Vínculo atualizado!");
        } catch (error) {
            toast.error((error as Error).message);
        }
    };

    const handleSync = async (connectionId: string) => {
        setSyncingId(connectionId);
        try {
            const res = await fetch(`${API_BASE_URL}/open-finance/connections/${connectionId}/sync`, {
                method: "POST",
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message ?? "Erro ao sincronizar.");
            }
            const result = (await res.json()) as { importedCount: number; skippedCount: number };
            await loadAll();
            toast.success(
                `Sincronização concluída: ${result.importedCount} novos lançamentos (${result.skippedCount} já existentes/ignorados).`,
            );
        } catch (error) {
            toast.error((error as Error).message);
        } finally {
            setSyncingId(null);
        }
    };

    const handleDelete = async (connectionId: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/open-finance/connections/${connectionId}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Erro ao remover conexão.");
            await loadAll();
            toast.success("Conexão removida.");
        } catch (error) {
            toast.error((error as Error).message);
        }
    };

    if (isLoading) {
        return <p className="text-sm text-muted-foreground">Carregando status do Open Finance...</p>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                    {status?.configured ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 text-positive" aria-hidden="true" />
                    ) : (
                        <AlertCircle className="mt-0.5 h-5 w-5 text-amber-500" aria-hidden="true" />
                    )}
                    <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 font-medium">
                            <span>Pluggy Open Finance</span>
                            <span className="rounded bg-muted px-2 py-0.5 text-xs">
                                {status?.sandbox ? "Sandbox" : "Produção / Meu Pluggy"}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {status?.configured
                                ? "Credenciais configuradas no backend. Recurso restrito ao Super Admin."
                                : "Adicione PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no .env do backend (e opcionalmente OPEN_FINANCE_WORKSPACE_ID para travar no seu workspace pessoal)."}
                        </p>
                    </div>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!status?.configured || !status?.workspaceAllowed}
                    onClick={handleOpenConnectWidget}
                >
                    <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                    Conectar via Pluggy Connect
                </Button>
            </div>

            {status && !status.workspaceAllowed && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                    Este workspace não corresponde ao <code>OPEN_FINANCE_WORKSPACE_ID</code> configurado. Troque para o seu workspace pessoal no cabeçalho para gerenciar conexões.
                </div>
            )}

            <form onSubmit={handleRegisterItem} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div className="space-y-1.5">
                    <Label htmlFor="pluggy-item-id">Item ID (Meu Pluggy / Sandbox)</Label>
                    <Input
                        id="pluggy-item-id"
                        placeholder="Ex: 8e4d1234-..."
                        value={itemIdInput}
                        onChange={(e) => setItemIdInput(e.target.value)}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="pluggy-institution">Nome da instituição (opcional)</Label>
                    <Input
                        id="pluggy-institution"
                        placeholder="Ex: Mercado Pago, C6 Bank"
                        value={institutionInput}
                        onChange={(e) => setInstitutionInput(e.target.value)}
                    />
                </div>
                <Button type="submit" disabled={isSubmitting || !status?.configured || !status?.workspaceAllowed}>
                    <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    {isSubmitting ? "Vinculando..." : "Vincular Item"}
                </Button>
            </form>

            {connections.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nenhuma conexão Open Finance vinculada neste workspace ainda.
                </div>
            ) : (
                <div className="space-y-4">
                    {connections.map((conn) => (
                        <div key={conn.id} className="rounded-lg border bg-card p-4 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                                        <Building2 className="h-4 w-4" aria-hidden="true" />
                                    </span>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-medium text-sm">{conn.institutionName}</h3>
                                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                                                {conn.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Item: <span className="font-mono">{conn.itemId}</span>
                                            {conn.lastSyncedAt && ` • Último sync: ${formatDate(conn.lastSyncedAt)}`}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={syncingId === conn.id || !status?.configured}
                                        onClick={() => handleSync(conn.id)}
                                    >
                                        <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncingId === conn.id ? "animate-spin" : ""}`} aria-hidden="true" />
                                        {syncingId === conn.id ? "Sincronizando..." : "Sincronizar"}
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => handleDelete(conn.id)}
                                        aria-label={`Remover conexão ${conn.institutionName}`}
                                    >
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                </div>
                            </div>

                            {conn.accountMaps.length > 0 && (
                                <div className="space-y-2 border-t pt-3">
                                    <p className="text-xs font-medium text-muted-foreground">Contas e cartões encontrados</p>
                                    <div className="space-y-2">
                                        {conn.accountMaps.map((map) => (
                                            <div
                                                key={map.id}
                                                className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2 text-xs"
                                            >
                                                <div>
                                                    <span className="font-medium">{map.externalName}</span>
                                                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                                                        {map.externalType === "BANK" ? "Conta" : "Cartão"}
                                                    </span>
                                                </div>

                                                <div className="w-full sm:w-64">
                                                    {map.externalType === "BANK" ? (
                                                        <Select
                                                            value={map.localAccountId ?? "NONE"}
                                                            onValueChange={(val) => handleMappingChange(map, val)}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue placeholder="Vincular à conta local" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="NONE">Não sincronizar</SelectItem>
                                                                {localAccounts.map((acc) => (
                                                                    <SelectItem key={acc.id} value={acc.id}>
                                                                        {acc.name} ({acc.currency})
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <Select
                                                            value={map.localCreditCardId ?? "NONE"}
                                                            onValueChange={(val) => handleMappingChange(map, val)}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue placeholder="Vincular ao cartão local" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="NONE">Não sincronizar</SelectItem>
                                                                {localCards.map((card) => (
                                                                    <SelectItem key={card.id} value={card.id}>
                                                                        {card.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
