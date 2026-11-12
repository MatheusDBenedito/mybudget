import Link from "next/link";
import { ArrowRight, Building2, CalendarClock, Landmark, Sparkles } from "lucide-react";
import { Money } from "@/components/Money";
import { cn } from "@/lib/utils";
import { shortMonthLabel } from "@/lib/investments-dividends";
import { BigMoney, DashCard } from "./DashCard";

export type ScheduledDividendItem = {
    key: string;
    tickerCode: string;
    name: string;
    type: string;
    exDate: string;
    paymentDate: string;
    quantity: number;
    amountPerShare: number;
    currency: string;
    totalBrl: number;
};

export type FiiProjectionBreakdown = {
    tickerCode: string;
    name: string;
    quantity: number;
    avgPerShareBrl: number;
    monthlyExpectedBrl: number;
    annualExpectedBrl: number;
};

export type MonthlyProjectionPoint = {
    year: number;
    month: number;
    monthKey: string;
    businessDaysTotal: number;
    businessDaysElapsed: number;
    businessDaysRemaining: number;
    scheduledDividends: number;
    projectedFiiDividends: number;
    fixedIncomeNetYield: number;
    fixedIncomeGrossYield: number;
    fixedIncomeTax: number;
    total: number;
};

export type InvestmentsProjectionData = {
    months: MonthlyProjectionPoint[];
    scheduledItems: ScheduledDividendItem[];
    fiiBreakdown: FiiProjectionBreakdown[];
    summary: {
        total12m: number;
        monthlyAverage12m: number;
        scheduledTotalBrl: number;
        scheduledCount: number;
        fiiMonthlyAverageBrl: number;
        fiiProjected12mBrl: number;
        fiiTotal12mBrl: number;
        fixedIncomeNet12mBrl: number;
        fixedIncomeGross12mBrl: number;
        fixedIncomeTax12mBrl: number;
        fixedIncomeMonthlyAvgNetBrl: number;
        fixedIncomePrincipalGrossBrl: number;
    };
};

const linkPill = "inline-flex h-8 items-center gap-1.5 rounded-full border px-4 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

export function YieldsProjectionCard({
    projection,
    height = 460,
    className,
}: {
    projection: InvestmentsProjectionData | null;
    height?: number;
    className?: string;
}) {
    const isCompact = height < 380;
    const s = projection?.summary;
    const months = projection?.months ?? [];
    const maxMonthTotal = Math.max(...months.map(m => m.total), 1);

    return (
        <DashCard
            title="Projeção de rendimentos — próximos 12 meses"
            art={{ icon: Sparkles, tone: "green" }}
            actions={
                <Link href="/investimentos/proventos" className={linkPill}>
                    Ver proventos <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
            }
            className={cn(isCompact && "p-4", className)}
        >
            {projection && s ? (
                <div className="flex flex-1 flex-col justify-between gap-4 overflow-y-auto pr-0.5">
                    <div className="space-y-4">
                        {/* Hero total + monthly average */}
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <BigMoney value={s.total12m} size={isCompact ? "lg" : "xl"} className="text-positive" />
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    ganho passivo líquido estimado nos próximos 12 meses · média de{" "}
                                    <span className="font-semibold text-foreground tabular-nums">
                                        <Money value={s.monthlyAverage12m} />/mês
                                    </span>
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
                                    Programados
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden />
                                    FIIs (média)
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-full bg-sky-500" aria-hidden />
                                    Renda Fixa (líquido)
                                </span>
                            </div>
                        </div>

                        {/* Three pillar cards */}
                        <div className="grid gap-3 sm:grid-cols-3">
                            {/* Pillar 1: Scheduled dividends */}
                            <div className="rounded-xl border bg-amber-500/5 border-amber-500/20 p-3">
                                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">Dividendos programados</span>
                                    <CalendarClock className="h-4 w-4 text-amber-600 shrink-0" aria-hidden />
                                </div>
                                <div className="mt-1.5 text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                                    <Money value={s.scheduledTotalBrl} />
                                </div>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                    {s.scheduledCount > 0
                                        ? `${s.scheduledCount} ${s.scheduledCount === 1 ? "pagamento anunciado a receber" : "pagamentos anunciados a receber"}`
                                        : "Nenhum anúncio pendente no momento"}
                                </p>
                                {projection.scheduledItems.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {projection.scheduledItems.slice(0, 4).map(item => (
                                            <span
                                                key={item.key}
                                                className="inline-flex items-center gap-1 rounded border border-amber-500/25 bg-background px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
                                            >
                                                <span className="font-mono font-semibold">{item.tickerCode}</span>
                                                <span className="text-muted-foreground"><Money value={item.totalBrl} /></span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Pillar 2: FIIs Monthly Average */}
                            <div className="rounded-xl border bg-emerald-500/5 border-emerald-500/20 p-3">
                                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">Média mensal de FIIs</span>
                                    <Building2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
                                </div>
                                <div className="mt-1.5 flex items-baseline gap-1.5">
                                    <span className="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                                        <Money value={s.fiiMonthlyAverageBrl} />
                                    </span>
                                    <span className="text-xs text-muted-foreground">/mês</span>
                                </div>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                    Projeção 12m:{" "}
                                    <span className="font-medium text-foreground tabular-nums">
                                        <Money value={s.fiiTotal12mBrl} />
                                    </span>{" "}
                                    ({projection.fiiBreakdown.length} FIIs)
                                </p>
                                {projection.fiiBreakdown.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {projection.fiiBreakdown.slice(0, 4).map(fii => (
                                            <span
                                                key={fii.tickerCode}
                                                className="inline-flex items-center gap-1 rounded border border-emerald-500/25 bg-background px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
                                                title={`${fii.quantity} cotas × média R$ ${fii.avgPerShareBrl.toLocaleString("pt-BR")}/cota`}
                                            >
                                                <span className="font-mono font-semibold">{fii.tickerCode}</span>
                                                <span className="text-muted-foreground"><Money value={fii.monthlyExpectedBrl} /></span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Pillar 3: Fixed Income Net Return */}
                            <div className="rounded-xl border bg-sky-500/5 border-sky-500/20 p-3">
                                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">Retorno líq. Renda Fixa</span>
                                    <Landmark className="h-4 w-4 text-sky-600 shrink-0" aria-hidden />
                                </div>
                                <div className="mt-1.5 text-lg font-semibold tabular-nums text-sky-700 dark:text-sky-400">
                                    <Money value={s.fixedIncomeNet12mBrl} />
                                </div>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                    Média líq.:{" "}
                                    <span className="font-medium text-foreground tabular-nums">
                                        <Money value={s.fixedIncomeMonthlyAvgNetBrl} />/mês
                                    </span>
                                </p>
                                <p className="mt-1.5 text-[10px] text-muted-foreground tabular-nums">
                                    Bruto 12m: <Money value={s.fixedIncomeGross12mBrl} /> · IR: −<Money value={s.fixedIncomeTax12mBrl} />
                                </p>
                                {months[0] && months[0].businessDaysElapsed > 0 && (
                                    <p className="mt-1 text-[10px] text-sky-700 dark:text-sky-400 tabular-nums">
                                        Mês atual ({shortMonthLabel(months[0].year, months[0].month)}): <Money value={months[0].fixedIncomeNetYield} /> ({months[0].businessDaysRemaining} de {months[0].businessDaysTotal} d.ú. restantes · {months[0].businessDaysElapsed} d.ú. corridos)
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* 12-month stacked visual timeline */}
                        {months.length > 0 && (
                            <div className="rounded-xl border bg-muted/20 p-3">
                                <div className="mb-2 flex items-center justify-between text-xs">
                                    <span className="font-medium text-foreground">Evolução mensal projetada (12 meses)</span>
                                    <span className="text-muted-foreground">Valores líquidos estimados por mês</span>
                                </div>
                                <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
                                    {months.map(m => {
                                        const schedPct = maxMonthTotal > 0 ? (m.scheduledDividends / maxMonthTotal) * 100 : 0;
                                        const fiiPct = maxMonthTotal > 0 ? (m.projectedFiiDividends / maxMonthTotal) * 100 : 0;
                                        const fixedPct = maxMonthTotal > 0 ? (m.fixedIncomeNetYield / maxMonthTotal) * 100 : 0;
                                        return (
                                            <div
                                                key={m.monthKey}
                                                className="flex flex-col items-center gap-1"
                                                title={`${shortMonthLabel(m.year, m.month)} (${m.businessDaysRemaining}/${m.businessDaysTotal} dias úteis a correr${m.businessDaysElapsed > 0 ? `, ${m.businessDaysElapsed} já corridos` : ""}) — Total: R$ ${m.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n• Programados: R$ ${m.scheduledDividends.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n• FIIs (média): R$ ${m.projectedFiiDividends.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n• Renda Fixa (líq.): R$ ${m.fixedIncomeNetYield.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                                            >
                                                <div className="flex h-16 w-full max-w-[28px] flex-col justify-end overflow-hidden rounded bg-muted">
                                                    {fixedPct > 0 && (
                                                        <div className="w-full bg-sky-500" style={{ height: `${fixedPct}%` }} />
                                                    )}
                                                    {fiiPct > 0 && (
                                                        <div className="w-full bg-emerald-500" style={{ height: `${fiiPct}%` }} />
                                                    )}
                                                    {schedPct > 0 && (
                                                        <div className="w-full bg-amber-500" style={{ height: `${schedPct}%` }} />
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-medium text-muted-foreground">
                                                    {shortMonthLabel(m.year, m.month)}
                                                </span>
                                                <span className="text-[10px] font-semibold tabular-nums text-foreground">
                                                    <Money value={m.total} />
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="h-44 animate-pulse rounded-xl bg-muted" />
            )}
        </DashCard>
    );
}
