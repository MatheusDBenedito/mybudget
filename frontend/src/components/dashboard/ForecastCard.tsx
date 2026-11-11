import { Money } from "@/components/Money";
import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BudgetBreakdown, BudgetSegmentKey } from "@/lib/dashboard";
import { BigMoney, DashCard } from "./DashCard";

const SEGMENT_COLORS: Record<BudgetSegmentKey, { bar: string; dot: string }> = {
    FIXED: { bar: "bg-blue-900", dot: "bg-blue-900" },
    CARDS: { bar: "bg-blue-500", dot: "bg-blue-500" },
    VARIABLE: { bar: "bg-sky-300", dot: "bg-sky-300" },
    LEFTOVER: { bar: "bg-positive-fill", dot: "bg-positive-fill" },
};

/** Income minus every expense of the month, with a bar of where the income goes. */
export function ForecastCard({ breakdown, projectedBalance, className }: {
    breakdown: BudgetBreakdown | null;
    /** Accounts balance expected at the end of the month (null for closed months) */
    projectedBalance: number | null;
    className?: string;
}) {
    const b = breakdown;
    const positive = (b?.leftover ?? 0) >= 0;
    const visible = b?.segments.filter(s => s.value > 0) ?? [];

    return (
        <DashCard title="Saldo previsto" art={{ icon: Wallet, tone: "green" }} className={className}>
            {b ? (
                <>
                    <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                        <BigMoney value={b.leftover} size="xl" className={positive ? "" : "text-negative"} />
                        <div className="pb-1.5 text-xs">
                            <p className={cn("flex items-center gap-1 font-semibold", positive ? "text-positive" : "text-negative")}>
                                {positive ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}
                                {b.income > 0
                                    ? `${Math.abs(b.leftoverPct).toLocaleString("pt-BR")}% das receitas ${positive ? "livre" : "acima"}`
                                    : "sem receitas no mês"}
                            </p>
                            <p className="text-muted-foreground">sobra estimada depois de pagar todas as contas</p>
                        </div>
                    </div>

                    <div className="mt-5 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label="Divisão das receitas do mês">
                        {visible.map(s => (
                            <span key={s.key} className={cn("h-full first:rounded-l-full last:rounded-r-full", SEGMENT_COLORS[s.key].bar)} style={{ width: `${s.pct}%` }} />
                        ))}
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-5">
                        <div>
                            <dt className="text-muted-foreground">Receitas</dt>
                            <dd className="mt-0.5 text-sm font-semibold tabular-nums"><Money value={b.income} /></dd>
                        </div>
                        {b.segments.map(s => (
                            <div key={s.key}>
                                <dt className="flex items-center gap-1.5 text-muted-foreground">
                                    <span className={cn("h-2 w-2 rounded-full", SEGMENT_COLORS[s.key].dot)} aria-hidden />
                                    {s.label}
                                </dt>
                                <dd className={cn("mt-0.5 text-sm font-semibold tabular-nums", s.key === "LEFTOVER" && "text-positive")}>
                                    {s.key === "LEFTOVER" ? "= " : "− "}<Money value={s.value} />
                                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">· {s.pct.toLocaleString("pt-BR")}%</span>
                                </dd>
                            </div>
                        ))}
                    </dl>

                    {projectedBalance !== null && (
                        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                            Saldo nas contas no fim do mês: <span className="font-semibold text-foreground tabular-nums"><Money value={projectedBalance} /></span>
                        </p>
                    )}
                </>
            ) : (
                <div className="h-36 animate-pulse rounded-xl bg-muted" />
            )}
        </DashCard>
    );
}
