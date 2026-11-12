"use client";

import { Money } from "@/components/Money";

import { useState } from "react";
import { Check, ShoppingBasket, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICONS_MAP } from "@/components/CreateCategoryModal";
import { BigMoney, DashCard } from "./DashCard";

export type CategorySpend = { category: string; color: string | null; total: number; icon?: string | null };

/** Biggest spending category as a share of income or of all expenses, plus the other categories. */
export function SpendingCard({ categories, income, height = 460, className }: { categories: CategorySpend[]; income: number; height?: number; className?: string }) {
    const [base, setBase] = useState<"income" | "expenses">("income");
    const expenses = categories.reduce((acc, c) => acc + c.total, 0);
    const [top, ...rest] = categories;
    const denominator = base === "income" ? income : expenses;
    const share = top && denominator > 0 ? (top.total / denominator) * 100 : 0;
    const isCompact = height < 380;
    const maxItems = isCompact ? 4 : height >= 540 ? 12 : 6;
    const cardSize = isCompact ? "p-4" : undefined;

    return (
        <DashCard title="Para onde vai o dinheiro" subtitle={top ? `Maior gasto: ${top.category}` : undefined} art={{ icon: ShoppingBasket, tone: "rose" }} className={cn(cardSize, className)}>
            {top ? (
                <>
                    <div className="shrink-0">
                        <BigMoney value={top.total} size={isCompact ? "md" : "lg"} />
                        <p className="mt-1 flex items-center gap-1 text-xs">
                            <Check className="h-3.5 w-3.5 text-positive" aria-hidden />
                            <span className="font-semibold">{share.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% {base === "income" ? "das receitas" : "das despesas"}</span>
                        </p>

                        <div className="mt-3 grid grid-cols-2 rounded-lg bg-muted p-1 text-xs font-medium" role="tablist" aria-label="Comparar com">
                            {([["income", "Das receitas"], ["expenses", "Das despesas"]] as const).map(([key, label]) => (
                                <button key={key} type="button" role="tab" aria-selected={base === key} onClick={() => setBase(key)}
                                    className={cn("rounded-md py-1.5 transition-colors", base === key ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(share)} aria-valuemin={0} aria-valuemax={100} aria-label={`${top.category} ${base === "income" ? "sobre as receitas" : "sobre as despesas"}`}>
                            <div className="h-full rounded-full bg-positive-fill transition-[width]" style={{ width: `${Math.min(share, 100)}%` }} />
                        </div>
                        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground"><span>0%</span><span>100%</span></div>
                    </div>

                    {rest.length > 0 && (
                        <div className="mt-3 flex min-h-0 flex-1 flex-col">
                            <p className="mb-2 shrink-0 text-xs font-semibold">Outras categorias</p>
                            <ul className="grid min-h-0 flex-1 grid-cols-2 content-start gap-x-3 gap-y-3 overflow-y-auto pr-1">
                                {rest.slice(0, maxItems).map(c => {
                                    const Icon = (c.icon && ICONS_MAP[c.icon]) || Tag;
                                    return (
                                        <li key={c.category} className="flex items-center gap-2 text-xs">
                                            <span
                                                className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white", c.color?.startsWith("#") ? "" : c.color || "bg-slate-400")}
                                                style={c.color?.startsWith("#") ? { backgroundColor: c.color } : undefined}
                                                aria-hidden
                                            >
                                                <Icon className="h-4 w-4" />
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-muted-foreground">{c.category}</span>
                                                <span className="block font-semibold tabular-nums"><Money value={c.total} /></span>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </>
            ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma despesa neste mês.</p>
            )}
        </DashCard>
    );
}
