"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, Check, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/Panel";
import { MonthNavigator } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { Money } from "@/components/Money";
import { formatUsd } from "@/lib/format";
import {
    type ApiMilesEntry, type MilesCard, type MilesEntryDraft,
    estimatePointsFromSpend, formatPoints, suggestExpectedCreditDate, toDateInputValue,
} from "@/lib/miles";

interface CardPointsEstimateProps {
    cards: MilesCard[];
    /** Current USD -> BRL rate; null while loading or unavailable */
    usdRate: number | null;
    entries: ApiMilesEntry[];
    onRegister: (draft: MilesEntryDraft) => void;
}

export function CardPointsEstimate({ cards, usdRate, entries, onRegister }: CardPointsEstimateProps) {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [spendByCard, setSpendByCard] = useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = useState(false);

    const earningCards = cards.filter(c => (c.pointsPerDollar ?? 0) > 0);
    const otherCards = cards.filter(c => !((c.pointsPerDollar ?? 0) > 0));
    const earningIds = earningCards.map(c => c.id).join(",");

    useEffect(() => {
        if (!earningIds) return;
        let cancelled = false;
        const load = async () => {
            setIsLoading(true);
            try {
                const ids = earningIds.split(",");
                const totals = await Promise.all(ids.map(async (id) => {
                    const res = await fetch(`http://localhost:3333/card-transactions/${id}/invoice?month=${month}&year=${year}`);
                    if (!res.ok) return [id, 0] as const;
                    const items: { amount: number }[] = await res.json();
                    return [id, items.reduce((acc, i) => acc + i.amount, 0)] as const;
                }));
                if (!cancelled) setSpendByCard(Object.fromEntries(totals));
            } catch (error) {
                console.error("Failed to load invoices for points estimate", error);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [earningIds, month, year]);

    const prev = () => {
        if (month === 1) { setMonth(12); setYear(y => y - 1); }
        else setMonth(m => m - 1);
    };
    const next = () => {
        if (month === 12) { setMonth(1); setYear(y => y + 1); }
        else setMonth(m => m + 1);
    };

    const isRegistered = (cardId: string) =>
        entries.some(e => e.creditCardId === cardId && e.referenceMonth === month && e.referenceYear === year);

    return (
        <Panel
            title="Pontos estimados por fatura"
            icon={Sparkles}
            flush
            actions={<MonthNavigator month={month} year={year} onPrev={prev} onNext={next} />}
        >
            {cards.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                    Nenhum cartão cadastrado. <Link href="/configuracoes" className="font-medium underline underline-offset-4">Cadastre um cartão</Link> para estimar pontos.
                </p>
            ) : (
                <>
                    <ul className="divide-y">
                        {earningCards.map(card => {
                            const spend = spendByCard[card.id] ?? 0;
                            const points = usdRate ? estimatePointsFromSpend(spend, usdRate, card.pointsPerDollar!) : 0;
                            const registered = isRegistered(card.id);
                            return (
                                <li key={card.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
                                    <div className="flex min-w-[180px] flex-1 items-center gap-3">
                                        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white", card.color || "from-slate-600 to-slate-900")}>
                                            <CreditCard className="h-4 w-4" aria-hidden="true" />
                                        </span>
                                        <div>
                                            <div className="font-medium">{card.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {card.pointsPerDollar!.toLocaleString("pt-BR")} pts/US$ · {card.loyaltyProgram || "programa não definido"}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="min-w-[110px] text-right text-sm">
                                        <div className="text-muted-foreground">Fatura</div>
                                        <div className="tabular-nums">{isLoading ? "…" : <Money value={spend} />}</div>
                                    </div>
                                    <div className="min-w-[90px] text-right text-sm">
                                        <div className="text-muted-foreground">Em dólar</div>
                                        <div className="tabular-nums">{usdRate && !isLoading ? <Money value={Math.max(spend, 0) / usdRate} format={formatUsd} /> : "…"}</div>
                                    </div>
                                    <div className="min-w-[90px] text-right text-sm">
                                        <div className="text-muted-foreground">Pontos</div>
                                        <div className="font-medium tabular-nums">{isLoading || !usdRate ? "…" : formatPoints(points)}</div>
                                    </div>
                                    <div className="min-w-[116px] text-right">
                                        {registered ? (
                                            <span className="inline-flex h-8 items-center gap-1 text-xs font-medium text-positive">
                                                <Check className="h-3.5 w-3.5" aria-hidden="true" /> Registrado
                                            </span>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={isLoading || points <= 0}
                                                onClick={() => onRegister({
                                                    creditCardId: card.id,
                                                    program: card.loyaltyProgram ?? "",
                                                    points,
                                                    status: "PENDING",
                                                    expectedCreditDate: toDateInputValue(suggestExpectedCreditDate(month, year, card.dueDay)),
                                                    referenceMonth: month,
                                                    referenceYear: year,
                                                })}
                                            >
                                                <Plus className="h-3.5 w-3.5" /> Registrar
                                            </Button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    {earningCards.length === 0 && (
                        <p className="p-4 text-sm text-muted-foreground">
                            Nenhum cartão tem fator de conversão. Defina-o em{" "}
                            <Link href="/configuracoes" className="font-medium underline underline-offset-4">Configurações → Cartões</Link>.
                        </p>
                    )}

                    <p className="border-t bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
                        {usdRate ? <>Estimativa com o dólar atual (<Money value={usdRate} />); o banco usa a cotação do fechamento da fatura.</> : "Buscando cotação do dólar…"}
                        {" "}A previsão de crédito sugerida é 30 dias após o vencimento.
                        {otherCards.length > 0 && ` Cartões sem fator: ${otherCards.map(c => c.name).join(", ")}.`}
                    </p>
                </>
            )}
        </Panel>
    );
}
