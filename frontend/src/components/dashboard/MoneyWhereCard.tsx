import { Money } from "@/components/Money";
import Link from "next/link";
import { Landmark, PiggyBank, ChartPie, Wallet, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { BigMoney, DashCard } from "./DashCard";

export type DashAccount = {
    id: string;
    name: string;
    balance: number;
    grossBalance?: number;
    taxAmount?: number;
    currency?: "BRL" | "USD";
    balanceUsd?: number | null;
    investedBrl?: number | null;
    purchaseExchangeRate?: number | null;
    currentExchangeRate?: number | null;
    variationBrl?: number;
    type?: "CHECKING" | "YIELDING";
    freeBalance?: number;
    freeGrossBalance?: number;
    freeTaxAmount?: number;
    pots?: { id: string; name: string; balance: number; grossBalance?: number; taxAmount?: number }[];
};

const formatUSD = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(value);

const PARTS = [
    { key: "checking", label: "Conta corrente", color: "bg-blue-900", icon: Landmark },
    { key: "free", label: "Rendendo na conta", color: "bg-blue-500", icon: Wallet },
    { key: "pots", label: "Cofrinhos", color: "bg-sky-300", icon: PiggyBank },
    { key: "investments", label: "Investimentos", color: "bg-positive-fill", icon: ChartPie },
] as const;

/**
 * Total wealth and how it is split between checking accounts, yielding balances, pots and investments.
 * Shows GROSS values in the main card body, with a top-right tooltip and a bottom summary row
 * detailing estimated taxes (IR) and the resulting NET value.
 */
export function MoneyWhereCard({
    accounts,
    investments,
    investmentsTax = 0,
    height = 460,
    className,
}: {
    accounts: DashAccount[];
    /** Gross BRL value of investments */
    investments: number;
    /** Estimated IR tax on fixed-income investments */
    investmentsTax?: number;
    height?: number;
    className?: string;
}) {
    const accountFree = (a: DashAccount) => a.freeBalance ?? a.balance;
    const potBalance = (p: { balance: number }) => p.balance;
    const accountTotal = (a: DashAccount) =>
        a.type === "YIELDING"
            ? accountFree(a) + (a.pots ?? []).reduce((s, p) => s + potBalance(p), 0)
            : a.balance;

    const sums = {
        checking: accounts.filter(a => a.type !== "YIELDING").reduce((acc, a) => acc + accountTotal(a), 0),
        free: accounts.filter(a => a.type === "YIELDING").reduce((acc, a) => acc + accountFree(a), 0),
        pots: accounts.reduce((acc, a) => acc + (a.pots ?? []).reduce((s, p) => s + potBalance(p), 0), 0),
        investments,
    };

    const grossTotal = sums.checking + sums.free + sums.pots + sums.investments;
    const totalTax = investmentsTax;
    const netTotal = grossTotal - totalTax;

    const pct = (v: number) => (grossTotal > 0 ? Math.max((v / grossTotal) * 100, 0) : 0);
    const isCompact = height < 380;
    const cardSize = isCompact ? "p-4" : undefined;

    const topRightActions = (
        <div className="flex items-start gap-2">
            <div className="group relative">
                <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    aria-label="Ver cálculo do valor líquido descontando impostos"
                >
                    <Info className="h-3.5 w-3.5 text-violet-600" aria-hidden="true" />
                    <span>Líquido: <strong className="font-semibold text-foreground tabular-nums"><Money value={netTotal} /></strong></span>
                </button>

                <div
                    role="tooltip"
                    className="pointer-events-none invisible absolute top-full right-0 z-30 mt-2 w-64 rounded-xl border bg-popover p-3 text-xs text-popover-foreground opacity-0 shadow-lg transition-all group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100"
                >
                    <p className="mb-2 font-semibold text-foreground">Resumo Bruto vs. Líquido</p>
                    <dl className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <dt className="text-muted-foreground">Total (contas + invest. bruto)</dt>
                            <dd className="font-medium tabular-nums"><Money value={grossTotal} /></dd>
                        </div>
                        {investmentsTax > 0 && (
                            <div className="flex items-center justify-between text-[11px]">
                                <dt className="text-muted-foreground">(-) IR Investimentos</dt>
                                <dd className="text-negative tabular-nums">-<Money value={investmentsTax} /></dd>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <dt className="text-muted-foreground">(-) Total de impostos</dt>
                            <dd className="font-medium text-negative tabular-nums">-<Money value={totalTax} /></dd>
                        </div>
                        <div className="flex items-center justify-between border-t pt-1.5 font-semibold text-foreground">
                            <dt>(=) Valor líquido</dt>
                            <dd className="text-positive tabular-nums"><Money value={netTotal} /></dd>
                        </div>
                    </dl>
                </div>
            </div>

            <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 -rotate-6 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-50 text-violet-600 shadow-sm ring-1 ring-violet-200/70"
            >
                <PiggyBank className="h-5 w-5" strokeWidth={1.8} />
            </span>
        </div>
    );

    return (
        <DashCard
            title="Onde está o dinheiro"
            subtitle="Saldos em contas, cofrinhos e investimentos"
            actions={topRightActions}
            className={cn(cardSize, className)}
        >
            <div className="shrink-0">
                <div className="flex flex-wrap items-baseline gap-2">
                    <BigMoney value={grossTotal} size={isCompact ? "md" : "lg"} />
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Bruto
                    </span>
                </div>

                <div className="mt-3 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label="Divisão do patrimônio bruto">
                    {PARTS.filter(p => sums[p.key] > 0).map(p => (
                        <span key={p.key} className={cn("h-full", p.color)} style={{ width: `${pct(sums[p.key])}%` }} />
                    ))}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {PARTS.map(p => (
                        <div key={p.key} className="flex items-center justify-between gap-2">
                            <dt className="flex items-center gap-1.5 text-muted-foreground">
                                <span className={cn("h-2 w-2 rounded-full", p.color)} aria-hidden />{p.label}
                            </dt>
                            <dd className="tabular-nums text-muted-foreground">{Math.round(pct(sums[p.key]))}%</dd>
                        </div>
                    ))}
                </dl>

                <p className="mb-1 mt-3 text-xs font-semibold">Por conta</p>
            </div>
            <ul className="min-h-0 flex-1 divide-y overflow-y-auto pr-1 text-sm">
                {accounts.map(a => {
                    const total = accountTotal(a);
                    return (
                        <li key={a.id} className="py-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2 truncate">
                                    <span className={cn("h-2 w-2 shrink-0 rounded-full", a.type === "YIELDING" ? "bg-blue-500" : "bg-blue-900")} aria-hidden />
                                    {a.name.trim()}
                                    {a.currency === "USD" && a.balanceUsd != null && (
                                        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                                            <Money value={a.balanceUsd} format={formatUSD} />
                                        </span>
                                    )}
                                </span>
                                <span className={cn("font-semibold tabular-nums", total < 0 && "text-negative")}>
                                    <Money value={total} />
                                </span>
                            </div>
                            {a.currency === "USD" && a.investedBrl != null && (
                                <div className="mt-0.5 flex items-center justify-between gap-2 pl-4 text-xs text-muted-foreground">
                                    <span>Gasto na compra</span>
                                    <span className="tabular-nums">
                                        <Money value={a.investedBrl} />
                                        {a.variationBrl != null && (
                                            <span className={cn("ml-1.5 font-medium", a.variationBrl >= 0 ? "text-positive" : "text-negative")}>
                                                ({a.variationBrl >= 0 ? "+" : ""}<Money value={a.variationBrl} />)
                                            </span>
                                        )}
                                    </span>
                                </div>
                            )}
                            {a.type === "YIELDING" && (a.pots ?? []).length > 0 && (
                                <div className="mt-1 flex items-center justify-between gap-2 pl-4 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1.5 truncate"><Wallet className="h-3 w-3" aria-hidden />Saldo livre</span>
                                    <span className="tabular-nums"><Money value={accountFree(a)} /></span>
                                </div>
                            )}
                            {(a.pots ?? []).map(p => (
                                <div key={p.id} className="mt-1 flex items-center justify-between gap-2 pl-4 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1.5 truncate"><PiggyBank className="h-3 w-3" aria-hidden />{p.name}</span>
                                    <span className="tabular-nums"><Money value={potBalance(p)} /></span>
                                </div>
                            ))}
                        </li>
                    );
                })}
                <li className="flex items-center justify-between gap-2 py-2">
                    <Link href="/investimentos" className="flex items-center gap-2 hover:underline">
                        <span className="h-2 w-2 rounded-full bg-positive-fill" aria-hidden />Investimentos
                    </Link>
                    <span className="font-semibold tabular-nums"><Money value={investments} /></span>
                </li>
            </ul>

            {/* Footer with tax deduction and net total */}
            <div className="mt-2 shrink-0 rounded-xl border bg-muted/30 px-3 py-2 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                    <span>(-) Impostos retidos / estimados (IR)</span>
                    <span className="font-medium text-negative tabular-nums">
                        -<Money value={totalTax} />
                    </span>
                </div>
                <div className="mt-1 flex items-center justify-between border-t pt-1 font-semibold text-foreground">
                    <span>Valor líquido disponível</span>
                    <span className="text-sm text-positive tabular-nums">
                        <Money value={netTotal} />
                    </span>
                </div>
            </div>
        </DashCard>
    );
}
