"use client";

import { Money } from "@/components/Money";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Nfc, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CashFlowData } from "@/lib/cash-flow";
import { BigMoney, DashCard } from "./DashCard";
import { openInvoiceMonth } from "@/lib/credit-cards";

export type DashCreditCard = {
    id: string;
    name: string;
    limit: number;
    dueDay: number;
    invoiceClosingOffset?: number;
    isPrimary?: boolean | null;
    color?: string | null;
};

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const pad = (d: number) => String(d).padStart(2, "0");

/** The favorite card's invoice for the month; the arrows switch which card is shown. */
export function CardsCard({ cards, data, className }: { cards: DashCreditCard[]; data: CashFlowData | null; className?: string }) {
    // Starts on the favorite (the list already comes with it first); arrows change the card being viewed
    const [index, setIndex] = useState(() => Math.max(cards.findIndex(c => c.isPrimary), 0));
    const current = Math.min(index, Math.max(cards.length - 1, 0));
    const card = cards[current];
    const row = data?.sections.find(s => s.key === "CARDS")?.rows.find(r => r.key === card?.id);
    const allMonths = data?.months ?? [];
    const allInvoices = allMonths.map((m, i) => ({ ...m, value: row?.values[i] ?? 0, open: (row?.open[i] ?? 0) > 0 }));

    // On the current month, start at the invoice that is open today (where new purchases go)
    const now = new Date();
    const firstMonth = allMonths[0];
    const isCurrentMonth = !!firstMonth && firstMonth.year === now.getFullYear() && firstMonth.month === now.getMonth() + 1;
    const open = card ? openInvoiceMonth(now, card.invoiceClosingOffset ?? 7, card.dueDay) : null;
    const openIndex = open ? allInvoices.findIndex(inv => inv.year === open.year && inv.month === open.month) : -1;
    const start = isCurrentMonth && openIndex >= 0 ? openIndex : 0;
    const invoices = allInvoices.slice(start, start + 3);
    const first = invoices[0];
    const invoice = first?.value ?? 0;
    const usage = card && card.limit > 0 ? Math.min((invoice / card.limit) * 100, 100) : 0;

    return (
        <DashCard
            title="Meus cartões"
            subtitle={first ? `Fatura de ${MONTHS[first.month - 1]}` : undefined}
            className={className}
            actions={cards.length > 1 ? (
                <div className="flex gap-1">
                    <button type="button" onClick={() => setIndex(Math.max(current - 1, 0))} disabled={current === 0}
                        className="flex h-8 w-8 items-center justify-center rounded-full border hover:bg-muted disabled:opacity-40" aria-label="Cartão anterior">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setIndex(Math.min(current + 1, cards.length - 1))} disabled={current === cards.length - 1}
                        className="flex h-8 w-8 items-center justify-center rounded-full border hover:bg-muted disabled:opacity-40" aria-label="Próximo cartão">
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            ) : undefined}
        >
            {card ? (
                <>
                    {/* Only one card at a time, in the user's chosen color */}
                    <div
                        className={cn(
                            "flex aspect-[1.65] w-full flex-col justify-between rounded-2xl bg-gradient-to-br p-4 text-white shadow-md",
                            card.color || "from-neutral-800 to-neutral-950",
                        )}
                        aria-label={`Cartão ${card.name}`}
                    >
                        <span className="flex items-start justify-between gap-2">
                            <span className="truncate text-base font-semibold">{card.name}</span>
                            <span className="flex shrink-0 items-center gap-1">
                                {card.isPrimary && (
                                    <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium" title="Cartão principal">
                                        <Star className="h-3 w-3 fill-amber-300 text-amber-300" aria-hidden /> Principal
                                    </span>
                                )}
                                {invoices[0]?.open && (
                                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">Aberta</span>
                                )}
                            </span>
                        </span>
                        <span className="flex items-center gap-2" aria-hidden>
                            <span className="h-6 w-8 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 opacity-90" />
                            <Nfc className="h-4 w-4 opacity-70" />
                        </span>
                        <span className="flex items-end justify-between text-[10px] uppercase tracking-wide text-white/70">
                            <span>Vence<span className="block text-xs font-semibold normal-case text-white">dia {pad(card.dueDay)}</span></span>
                            <span className="text-right">Limite<span className="block text-xs font-semibold normal-case text-white"><Money value={card.limit} /></span></span>
                        </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <p className="text-xs text-muted-foreground">Total da fatura</p>
                            <div className="flex items-center gap-2">
                                <BigMoney value={invoice} size="md" />
                                {invoices[0] && invoice > 0 && (
                                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", invoices[0].open ? "bg-blue-100 text-blue-700" : "bg-positive-soft text-positive")}>
                                        {invoices[0].open ? "Aberta" : "Paga"}
                                    </span>
                                )}
                            </div>
                        </div>
                        <Link href="/cartoes" className="inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium hover:bg-muted">Ver fatura</Link>
                    </div>

                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Uso do limite" aria-valuenow={Math.round(usage)} aria-valuemin={0} aria-valuemax={100}>
                        <span className={cn("block h-full rounded-full", usage >= 90 ? "bg-negative-fill" : usage >= 70 ? "bg-amber-400" : "bg-positive-fill")} style={{ width: `${usage}%` }} />
                    </div>
                    <p className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                        <span>Disponível <Money value={card.limit - invoice} /></span>
                        <span>{usage.toFixed(0)}% do limite</span>
                    </p>

                    {invoices.length > 0 && <NextInvoices invoices={invoices} />}
                </>
            ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>
            )}
        </DashCard>
    );
}

function NextInvoices({ invoices }: { invoices: { year: number; month: number; value: number; open: boolean }[] }) {
    const max = Math.max(...invoices.map(i => i.value), 1);
    // Points of the dashed trend line, one per column (viewBox 0..300 × 0..60)
    const points = invoices.map((inv, i) => ({ x: 50 + i * 100, y: 50 - (inv.value / max) * 40 }));

    return (
        <div className="mt-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Próximas faturas</p>
            <div className="relative grid grid-cols-3 gap-2">
                <svg className="pointer-events-none absolute inset-x-0 top-7 h-[60px] w-full" viewBox="0 0 300 60" preserveAspectRatio="none" aria-hidden>
                    <polyline points={points.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="currentColor" strokeDasharray="4 4" className="text-muted-foreground/60" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                </svg>
                {invoices.map((inv, i) => (
                    <div key={`${inv.year}-${inv.month}`}
                        className={cn("relative flex h-32 flex-col items-center justify-between overflow-hidden rounded-xl border p-2 text-center", i === 0 ? "border-blue-500 bg-blue-50/60" : "bg-muted/40")}>
                        <span className="z-10 text-xs font-semibold">{SHORT[inv.month - 1]}{i > 0 ? ` ${String(inv.year).slice(2)}` : ""}</span>
                        {i === 0 && inv.value > 0 && (
                            <span className={cn("z-10 rounded-full px-1.5 text-[10px] font-medium", inv.open ? "bg-blue-100 text-blue-700" : "bg-positive-soft text-positive")}>
                                {inv.open ? "Aberta" : "Paga"}
                            </span>
                        )}
                        {/* Area under the trend */}
                        <span className={cn("absolute inset-x-0 bottom-0", i === 0 ? "bg-blue-200/60" : "bg-muted")} style={{ height: `${10 + (inv.value / max) * 45}%` }} aria-hidden />
                        <span className={cn("z-10 text-xs font-semibold tabular-nums", i === 0 ? "text-blue-700" : "text-muted-foreground")}><Money value={inv.value} /></span>
                    </div>
                ))}
            </div>
        </div>
    );
}
