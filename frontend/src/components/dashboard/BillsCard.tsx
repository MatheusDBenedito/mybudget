"use client";

import { Money } from "@/components/Money";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, CreditCard, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { type BillDay, relativeDay } from "@/lib/dashboard";
import { BigMoney, DashCard } from "./DashCard";

const pad = (d: number) => String(d).padStart(2, "0");

/** Bills of the month by due day: day chips, the selected day's total and its items. */
export function BillsCard({ days, defaultDay, month, height = 460, className }: {
    days: BillDay[];
    defaultDay: number | null;
    month: { year: number; month: number };
    height?: number;
    className?: string;
}) {
    // Only the explicit choice is stored (tied to the month); otherwise the default day is shown
    const [choice, setChoice] = useState<{ key: string; day: number } | null>(null);
    const monthKey = `${month.year}-${month.month}`;
    const selectedDay = choice?.key === monthKey && days.some(d => d.day === choice.day) ? choice.day : defaultDay;
    const selected = days.find(d => d.day === selectedDay) ?? null;
    const monthTotal = days.reduce((acc, d) => acc + d.total, 0);
    const monthPaid = days.reduce((acc, d) => acc + d.paidCount, 0);
    const monthCount = days.reduce((acc, d) => acc + d.items.length, 0);
    const isCompact = height < 380;
    const cardSize = isCompact ? "p-4" : undefined;

    return (
        <DashCard
            title="Contas a pagar"
            subtitle={selected ? `dia ${pad(selected.day)}` : undefined}
            art={{ icon: CalendarDays, tone: "amber" }}
            className={cn(cardSize, className)}
        >
            {selected ? (
                <>
                    <div className="shrink-0">
                        <BigMoney value={selected.total} size={isCompact ? "md" : "lg"} />
                        <p className="mt-1 text-xs text-muted-foreground">
                            {relativeDay(selected.day, month)} · {selected.paidCount} de {selected.items.length} {selected.items.length === 1 ? "paga" : "pagas"}
                        </p>

                        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Dias de vencimento">
                            {days.map(d => {
                                const active = d.day === selected.day;
                                return (
                                    <button
                                        key={d.day}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        aria-label={`Dia ${d.day}: ${d.items.length} conta(s), ${formatCurrency(d.total)}`}
                                        onClick={() => setChoice({ key: monthKey, day: d.day })}
                                        className={cn(
                                            "flex min-w-14 flex-col items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                                            active ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "bg-card hover:bg-muted",
                                        )}
                                    >
                                        {pad(d.day)}
                                        <span className="flex gap-0.5" aria-hidden>
                                            {d.items.slice(0, 5).map(i => (
                                                <span key={i.id} className={cn("h-1 w-1 rounded-full", active ? (i.paid ? "bg-white/50" : "bg-white") : (i.paid ? "bg-positive-fill" : "bg-muted-foreground/40"))} />
                                            ))}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <ul className="mt-3 min-h-0 flex-1 divide-y overflow-y-auto pr-1" role="tabpanel">
                        {selected.items.map(item => (
                            <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                                <span className="flex min-w-0 items-center gap-3">
                                    <span
                                        className={cn(
                                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                                            item.paid ? "border-positive-fill bg-positive-fill text-white" : "border-muted-foreground/40",
                                        )}
                                        aria-label={item.paid ? "Paga" : "Pendente"}
                                    >
                                        {item.paid && <Check className="h-3 w-3" strokeWidth={3} />}
                                    </span>
                                    {item.kind === "card" && <CreditCard className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                                    <span className={cn("truncate", item.paid && "text-muted-foreground line-through")}>{item.label}</span>
                                </span>
                                <span className={cn("shrink-0 font-semibold tabular-nums", item.paid && "text-muted-foreground")}><Money value={item.amount} /></span>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-auto flex shrink-0 items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                        <span>No mês: <span className="font-semibold text-foreground tabular-nums"><Money value={monthTotal} /></span> · {monthPaid} de {monthCount} pagas</span>
                        <Link href="/fluxo-de-caixa" className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline">
                            Fluxo de caixa <ArrowRight className="h-3 w-3" aria-hidden />
                        </Link>
                    </div>
                </>
            ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma conta a pagar neste mês.</p>
            )}
        </DashCard>
    );
}
