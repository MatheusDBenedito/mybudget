"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, CircleCheck, Clock, Send, CalendarClock, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Panel } from "@/components/Panel";
import { MilesEntriesTable } from "@/components/miles/MilesEntriesTable";
import { MilesEntryModal } from "@/components/miles/MilesEntryModal";
import { TransferBonusCalculator } from "@/components/miles/TransferBonusCalculator";
import { CardPointsEstimate } from "@/components/miles/CardPointsEstimate";
import {
    type ApiMilesEntry, type MilesCard, type MilesEntryDraft, type MilesStatus,
    MILES_STATUS_LABELS, daysUntil, formatPoints, fromApiDate, isOverdue,
} from "@/lib/miles";

export default function MilhasPage() {
    const [entries, setEntries] = useState<ApiMilesEntry[]>([]);
    const [cards, setCards] = useState<MilesCard[]>([]);
    const [usdRate, setUsdRate] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<ApiMilesEntry | null>(null);
    const [draft, setDraft] = useState<MilesEntryDraft | null>(null);

    const loadEntries = useCallback(async () => {
        try {
            const res = await fetch("http://localhost:3333/miles");
            if (res.ok) setEntries(await res.json());
        } catch (error) {
            console.error("Failed to load miles entries", error);
        }
    }, []);

    useEffect(() => {
        const loadAll = async () => {
            try {
                const [cardsRes] = await Promise.all([
                    fetch("http://localhost:3333/credit-cards"),
                    loadEntries(),
                ]);
                if (cardsRes.ok) setCards(await cardsRes.json());
            } catch (error) {
                console.error("Failed to load miles page", error);
            } finally {
                setIsLoading(false);
            }

            try {
                const usdRes = await fetch("https://economia.awesomeapi.com.br/last/USD-BRL");
                if (usdRes.ok) {
                    const data = await usdRes.json();
                    const bid = Number(data?.USDBRL?.bid);
                    if (bid > 0) setUsdRate(bid);
                }
            } catch (error) {
                console.error("Failed to load USD rate", error);
            }
        };
        loadAll();
    }, [loadEntries]);

    const openNew = (prefill: MilesEntryDraft | null = null) => {
        setEditingEntry(null);
        setDraft(prefill);
        setModalOpen(true);
    };

    const openEdit = (entry: ApiMilesEntry) => {
        setDraft(null);
        setEditingEntry(entry);
        setModalOpen(true);
    };

    const handleDelete = async (entry: ApiMilesEntry) => {
        if (!window.confirm(`Excluir o lançamento de ${formatPoints(entry.points)} pontos ${entry.program}?`)) return;
        try {
            const res = await fetch(`http://localhost:3333/miles/${entry.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setEntries(prev => prev.filter(e => e.id !== entry.id));
            toast.success("Lançamento excluído.");
        } catch (error) {
            console.error(error);
            toast.error("Não foi possível excluir o lançamento.");
        }
    };

    const handleStatusChange = async (entry: ApiMilesEntry, status: MilesStatus) => {
        if (status === entry.status) return;
        // Optimistic update, reverted if the request fails
        setEntries(prev => prev.map(e => (e.id === entry.id ? { ...e, status } : e)));
        try {
            const res = await fetch(`http://localhost:3333/miles/${entry.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            toast.success(`Status alterado para ${MILES_STATUS_LABELS[status]}.`);
        } catch (error) {
            console.error(error);
            setEntries(prev => prev.map(e => (e.id === entry.id ? { ...e, status: entry.status } : e)));
            toast.error("Não foi possível alterar o status.");
        }
    };

    const sumBy = (status: MilesStatus) => entries.filter(e => e.status === status).reduce((acc, e) => acc + e.points, 0);
    const countBy = (status: MilesStatus) => {
        const n = entries.filter(e => e.status === status).length;
        return `${n} ${n === 1 ? "lançamento" : "lançamentos"}`;
    };

    const notCredited = entries.filter(e => e.status !== "CREDITED");
    const overdueCount = notCredited.filter(e => isOverdue(e.status, fromApiDate(e.expectedCreditDate))).length;
    const nextCredit = notCredited
        .map(e => ({ entry: e, date: fromApiDate(e.expectedCreditDate) }))
        .filter(({ date }) => daysUntil(date) >= 0)
        .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Gestão de Milhas"
                description="Acompanhe os pontos gerados pelos cartões e simule transferências bonificadas."
                actions={
                    <Button onClick={() => openNew()}>
                        <Plus className="h-4 w-4" />
                        Novo Lançamento
                    </Button>
                }
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard title="Creditados" icon={CircleCheck} info="Pontos e milhas já disponíveis nas contas dos programas.">
                    <div className="text-xl font-medium tabular-nums text-positive">{formatPoints(sumBy("CREDITED"))}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{countBy("CREDITED")}</div>
                </StatCard>
                <StatCard title="Pendentes" icon={Clock} info="Pontos gerados que ainda não caíram no programa.">
                    <div className="text-xl font-medium tabular-nums">{formatPoints(sumBy("PENDING"))}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{countBy("PENDING")}</div>
                </StatCard>
                <StatCard title="Transferidos" icon={Send} info="Pontos enviados para outro programa, aguardando crédito.">
                    <div className="text-xl font-medium tabular-nums">{formatPoints(sumBy("TRANSFERRED"))}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{countBy("TRANSFERRED")}</div>
                </StatCard>
                <StatCard title="Próximo crédito" icon={CalendarClock}>
                    {nextCredit ? (
                        <>
                            <div className="text-xl font-medium tabular-nums">{formatPoints(nextCredit.entry.points)}</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                                {nextCredit.entry.program} · {nextCredit.date.toLocaleDateString("pt-BR")}
                            </div>
                        </>
                    ) : (
                        <div className="text-sm text-muted-foreground">Nenhum crédito previsto.</div>
                    )}
                    {overdueCount > 0 && (
                        <div className="mt-1 text-sm font-medium text-negative">{overdueCount} atrasado{overdueCount > 1 ? "s" : ""}</div>
                    )}
                </StatCard>
            </div>

            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
                <div className="min-w-0 space-y-4 xl:col-span-2">
                    <CardPointsEstimate cards={cards} usdRate={usdRate} entries={entries} onRegister={openNew} />

                    <Panel title="Controle de pontos" icon={ListChecks} count={entries.length} flush>
                        <MilesEntriesTable
                            entries={entries}
                            isLoading={isLoading}
                            onEdit={openEdit}
                            onDelete={handleDelete}
                            onStatusChange={handleStatusChange}
                        />
                    </Panel>
                </div>

                <div className="min-w-0 xl:sticky xl:top-[120px]">
                    <TransferBonusCalculator onRegister={openNew} />
                </div>
            </div>

            <MilesEntryModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                cards={cards}
                entry={editingEntry}
                draft={draft}
                onSaved={loadEntries}
            />
        </div>
    );
}
