"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Legend,
} from "recharts";
import {
    HandCoins,
    CalendarRange,
    Trophy,
    RefreshCw,
    ChartColumn,
    ArrowUpDown,
    Calendar,
    CircleDollarSign,
    Info,
    ChevronUp,
    ChevronDown,
    Clock,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { Money } from "@/components/Money";
import { InvestmentsSubnav } from "@/components/InvestmentsSubnav";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, formatPercent, formatUsd } from "@/lib/format";
import {
    type ApiDividendInvestment,
    type ApiInvestmentDividend,
    type DividendClassFilter,
    buildAnnualMonthlyMatrix,
    buildMonthlyDividendsSeries,
    buildYearlyDividendsSeries,
    computeDividendsSummary,
    filterDividendsData,
    fullMonthLabel,
} from "@/lib/investments-dividends";
import { API_BASE_URL } from "@/lib/auth";


const MONTH_HEADERS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const TYPE_LABELS: Record<string, string> = {
    VARIABLE_INCOME: "Ações",
    FII: "FII",
    US_STOCK: "Exterior",
};

const formatDecimal = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);

type TooltipPayloadItem = {
    name?: string;
    value?: number;
    color?: string;
};

type MatrixSortKey = "year" | "average" | "total";

function DividendsTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: TooltipPayloadItem[];
    label?: string;
}) {
    if (!active || !payload || payload.length === 0) return null;
    const total = payload.reduce((acc, p) => acc + Number(p.value ?? 0), 0);

    return (
        <div className="rounded-lg border bg-card p-3 text-xs shadow-md">
            <div className="mb-1.5 font-semibold text-foreground">{label}</div>
            <div className="space-y-1">
                {payload.map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span
                                className="h-2.5 w-2.5 rounded-xs"
                                style={{ backgroundColor: entry.color }}
                            />
                            {entry.name}
                        </span>
                        <span className="font-medium tabular-nums text-foreground">
                            <Money value={Number(entry.value ?? 0)} />
                        </span>
                    </div>
                ))}
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-1.5 font-semibold text-foreground">
                <span>Total</span>
                <span className="tabular-nums">
                    <Money value={total} />
                </span>
            </div>
        </div>
    );
}

export default function ProventosPage() {
    const [dividends, setDividends] = useState<ApiInvestmentDividend[]>([]);
    const [investments, setInvestments] = useState<ApiDividendInvestment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    const [statusFilter, setStatusFilter] = useState<"PAID" | "PENDING" | "ALL">("PAID");
    const [classFilter, setClassFilter] = useState<DividendClassFilter>("ALL");
    const [tickerFilter, setTickerFilter] = useState<string>("ALL");
    const [chartPeriod, setChartPeriod] = useState<"monthly" | "yearly">("monthly");

    // Matrix sorting & expand/collapse state
    const [matrixSortKey, setMatrixSortKey] = useState<MatrixSortKey>("year");
    const [matrixSortDir, setMatrixSortDir] = useState<"asc" | "desc">("desc");
    const [showAllYears, setShowAllYears] = useState<boolean>(true);
    const [selectedCell, setSelectedCell] = useState<{ year: number; monthIndex: number } | null>(null);

    const loadDividends = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/investments/dividends`);
            if (res.ok) {
                const data = await res.json();
                setDividends(data.dividends ?? []);
                setInvestments(data.investments ?? []);
            }
        } catch (error) {
            console.error("Failed to load dividends", error);
            toast.error("Não foi possível carregar os proventos.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadDividends();
    }, [loadDividends]);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const res = await fetch(`${API_BASE_URL}/investments/dividends/sync`, { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                setDividends(data.dividends ?? []);
                setInvestments(data.investments ?? []);
                toast.success("Proventos sincronizados com sucesso!");
            } else {
                toast.error("Erro ao sincronizar proventos.");
            }
        } catch (error) {
            console.error("Failed to sync dividends", error);
            toast.error("Erro de conexão ao sincronizar proventos.");
        } finally {
            setIsSyncing(false);
        }
    };

    const availableTickers = useMemo(() => {
        const set = new Set<string>();
        for (const inv of investments) {
            if (classFilter !== "ALL" && inv.type !== classFilter) continue;
            const code = inv.tickerCode?.trim().toUpperCase();
            if (code) set.add(code);
        }
        return [...set].sort();
    }, [investments, classFilter]);

    const effectiveTickerFilter = availableTickers.includes(tickerFilter) ? tickerFilter : "ALL";

    const filtered = useMemo(
        () => filterDividendsData(dividends, investments, classFilter, effectiveTickerFilter, statusFilter),
        [dividends, investments, classFilter, effectiveTickerFilter, statusFilter],
    );

    const monthlySeries = useMemo(
        () => buildMonthlyDividendsSeries(filtered.dividends, filtered.investments),
        [filtered],
    );

    const yearlySeries = useMemo(
        () => buildYearlyDividendsSeries(monthlySeries),
        [monthlySeries],
    );

    const summary = useMemo(
        () => computeDividendsSummary(monthlySeries, filtered.dividends, filtered.investments, filtered.allMatchingDividends),
        [monthlySeries, filtered],
    );

    const annualMatrix = useMemo(
        () => buildAnnualMonthlyMatrix(filtered.dividends, filtered.investments),
        [filtered],
    );

    const sortedMatrix = useMemo(() => {
        const copy = [...annualMatrix];
        copy.sort((a, b) => {
            const diff = a[matrixSortKey] - b[matrixSortKey];
            return matrixSortDir === "asc" ? diff : -diff;
        });
        return showAllYears ? copy : copy.slice(0, 3);
    }, [annualMatrix, matrixSortKey, matrixSortDir, showAllYears]);

    const handleSortColumn = (key: MatrixSortKey) => {
        if (matrixSortKey === key) {
            setMatrixSortDir(prev => (prev === "desc" ? "asc" : "desc"));
        } else {
            setMatrixSortKey(key);
            setMatrixSortDir("desc");
        }
    };

    const selectedCellItems = useMemo(() => {
        if (!selectedCell) return [];
        const row = annualMatrix.find(r => r.year === selectedCell.year);
        return row?.monthItems[selectedCell.monthIndex] ?? [];
    }, [annualMatrix, selectedCell]);

    const chartData = chartPeriod === "monthly" ? monthlySeries : yearlySeries;

    return (
        <div className="space-y-6">
            <InvestmentsSubnav />

            <PageHeader
                title="Proventos"
                description={
                    summary.earliestPurchaseDate
                        ? `Histórico de dividendos e rendimentos recebidos desde ${formatDate(summary.earliestPurchaseDate)}`
                        : "Histórico de dividendos e rendimentos recebidos desde a data de compra de cada ativo"
                }
                actions={
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 bg-card"
                        onClick={handleSync}
                        disabled={isSyncing}
                    >
                        <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                        {isSyncing ? "Sincronizando..." : "Atualizar Proventos"}
                    </Button>
                }
            />

            {/* Summary KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Total acumulado de proventos"
                    icon={HandCoins}
                    info="Soma de todos os dividendos, JCP e rendimentos recebidos desde a data de compra de cada aporte."
                >
                    <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-xl font-medium tabular-nums">
                            <Money value={summary.totalBrl} />
                        </span>
                        <span className="rounded-md bg-positive-soft px-2 py-0.5 text-xs font-medium text-positive tabular-nums">
                            YoC {formatPercent(summary.yieldOnCostPct)}
                        </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                            <div className="text-muted-foreground">Ações</div>
                            <div className="mt-0.5 font-medium tabular-nums">
                                <Money value={summary.stocksTotalBrl} />
                            </div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">FIIs</div>
                            <div className="mt-0.5 font-medium tabular-nums">
                                <Money value={summary.fiiTotalBrl} />
                            </div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">Exterior</div>
                            <div className="mt-0.5 font-medium tabular-nums">
                                <Money value={summary.usTotalBrl} />
                            </div>
                        </div>
                    </div>
                </StatCard>

                <StatCard
                    title="Proventos a receber"
                    icon={Clock}
                    info="Proventos já anunciados com Data-Com atingida e pagamento previsto para os próximos dias."
                >
                    <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-xl font-medium text-amber-500 tabular-nums">
                            <Money value={summary.pendingTotalBrl} />
                        </span>
                        <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 tabular-nums">
                            {summary.pendingCount} {summary.pendingCount === 1 ? "pagamento" : "pagamentos"}
                        </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                        <div>
                            <div className="text-muted-foreground">Próximo pagamento</div>
                            <div className="mt-0.5 text-sm font-medium tabular-nums">
                                {summary.pendingItems[0] ? formatDate(summary.pendingItems[0].paymentDate) : "—"}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-muted-foreground">Ativos provisionados</div>
                            <div className="mt-0.5 text-sm font-medium tabular-nums">
                                {summary.pendingItems.map(item => item.tickerCode).slice(0, 3).join(", ") || "Nenhum"}
                                {summary.pendingItems.length > 3 ? ` +${summary.pendingItems.length - 3}` : ""}
                            </div>
                        </div>
                    </div>
                </StatCard>

                <StatCard
                    title="Média mensal e últimos 12 meses"
                    icon={CalendarRange}
                    info="Média mensal desde o primeiro mês de compra e total recebido nos últimos 12 meses."
                >
                    <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-xl font-medium tabular-nums">
                            <Money value={summary.monthlyAverageBrl} />
                        </span>
                        <span className="text-xs text-muted-foreground">/ mês</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                        <div>
                            <div className="text-muted-foreground">Últimos 12 meses</div>
                            <div className="mt-0.5 text-sm font-medium tabular-nums">
                                <Money value={summary.last12MonthsBrl} />
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-muted-foreground">Meses com proventos</div>
                            <div className="mt-0.5 text-sm font-medium tabular-nums">
                                {summary.monthsWithPayments} de {summary.monthsSinceStart}
                            </div>
                        </div>
                    </div>
                </StatCard>

                <StatCard
                    title="Destaques de proventos"
                    icon={Trophy}
                    info="Ativo que mais pagou proventos e o mês de maior recebimento desde o início."
                >
                    <div className="grid grid-cols-2 gap-4">
                        <div className="min-w-0">
                            <div className="text-xs text-muted-foreground">Maior pagador</div>
                            {summary.topAsset ? (
                                <>
                                    <div className="mt-1 truncate font-medium text-foreground">
                                        {summary.topAsset.tickerCode}
                                    </div>
                                    <div className="mt-0.5 text-xs font-medium text-positive tabular-nums">
                                        <Money value={summary.topAsset.totalBrl} /> ({formatPercent(summary.topAsset.yieldOnCostPct)})
                                    </div>
                                </>
                            ) : (
                                <div className="mt-1 text-xs text-muted-foreground">—</div>
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs text-muted-foreground">Melhor mês</div>
                            {summary.bestMonth ? (
                                <>
                                    <div className="mt-1 truncate font-medium text-foreground">
                                        {summary.bestMonth.label}
                                    </div>
                                    <div className="mt-0.5 text-xs font-medium text-positive tabular-nums">
                                        <Money value={summary.bestMonth.totalBrl} />
                                    </div>
                                </>
                            ) : (
                                <div className="mt-1 text-xs text-muted-foreground">—</div>
                            )}
                        </div>
                    </div>
                </StatCard>
            </div>

            {isLoading ? (
                <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground animate-pulse">
                    Verificando histórico de proventos desde a data de compra dos ativos...
                </div>
            ) : (
                <>
                    {/* Proventos a receber Section */}
                    <section className="overflow-hidden rounded-xl border bg-card shadow-2xs">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                                    <Clock className="h-4 w-4" />
                                </div>
                                <div>
                                    <h2 className="text-base font-medium text-foreground">Proventos a receber</h2>
                                    <p className="text-xs text-muted-foreground">
                                        Dividendos e rendimentos com Data-Com confirmada aguardando liquidação na conta
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex h-9 items-center gap-1.5 rounded-md bg-amber-500/10 px-3.5 text-sm">
                                    <span className="font-medium text-foreground">A receber</span>
                                    <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                                        <Money value={summary.pendingTotalBrl} />
                                    </span>
                                </div>
                            </div>
                        </div>

                        {summary.pendingItems.length === 0 ? (
                            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                                Nenhum provento provisionado pendente de pagamento para os filtros selecionados.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/40 text-xs">
                                            <TableHead className="h-9 pl-6">Ativo</TableHead>
                                            <TableHead className="h-9">Tipo de Ativo</TableHead>
                                            <TableHead className="h-9 text-center">Data-Com / Ex</TableHead>
                                            <TableHead className="h-9 text-center">Data de Pagamento</TableHead>
                                            <TableHead className="h-9 text-right">Qtd. Elegível</TableHead>
                                            <TableHead className="h-9 text-right">Valor por Cota</TableHead>
                                            <TableHead className="h-9 text-right">Status</TableHead>
                                            <TableHead className="h-9 pr-6 text-right">Total a Receber</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {summary.pendingItems.map(item => (
                                            <TableRow key={`${item.tickerCode}-${item.exDate}`} className="text-xs">
                                                <TableCell className="py-3 pl-6">
                                                    <div className="flex items-center gap-2">
                                                        <span className="rounded border bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                                                            {item.tickerCode}
                                                        </span>
                                                        <span className="font-medium text-muted-foreground">
                                                            {item.name}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-3 text-muted-foreground">
                                                    {TYPE_LABELS[item.type] ?? item.type}
                                                </TableCell>
                                                <TableCell className="py-3 text-center tabular-nums text-muted-foreground">
                                                    {formatDate(item.exDate)}
                                                </TableCell>
                                                <TableCell className="py-3 text-center font-medium tabular-nums text-foreground">
                                                    {formatDate(item.paymentDate)}
                                                </TableCell>
                                                <TableCell className="py-3 text-right tabular-nums">
                                                    {item.quantity}
                                                </TableCell>
                                                <TableCell className="py-3 text-right tabular-nums">
                                                    {item.currency === "USD" ? (
                                                        <Money value={item.amountPerShare} format={formatUsd} />
                                                    ) : (
                                                        <Money value={item.amountPerShare} />
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-3 text-right">
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                        A receber
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-3 pr-6 text-right font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                                                    <div>
                                                        <Money value={item.totalBrl} />
                                                    </div>
                                                    {item.currency === "USD" && (
                                                        <div className="text-[11px] font-normal text-muted-foreground">
                                                            <Money value={item.totalOriginal} format={formatUsd} />
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </section>

                    {/* Histórico mensal (Investidor10 Matrix Pattern) */}
                    <section className="overflow-hidden rounded-xl border bg-card shadow-2xs">
                        {/* Top Header & Controls */}
                        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                            <h2 className="text-lg font-medium text-foreground">Histórico mensal</h2>

                            <div className="flex flex-wrap items-center gap-2.5">
                                <div className="flex h-9 items-center gap-1.5 rounded-md bg-muted/70 px-3.5 text-sm">
                                    <span className="font-medium text-foreground">Total</span>
                                    <span className="font-semibold text-positive tabular-nums">
                                        <Money value={summary.totalBrl} />
                                    </span>
                                </div>

                                <Select
                                    value={statusFilter}
                                    onValueChange={val => {
                                        setStatusFilter(val as "PAID" | "PENDING" | "ALL");
                                        setSelectedCell(null);
                                    }}
                                >
                                    <SelectTrigger className="h-9 w-[145px] bg-card text-xs font-medium">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                            <SelectValue placeholder="Recebidos" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PAID">Recebidos</SelectItem>
                                        <SelectItem value="PENDING">A receber</SelectItem>
                                        <SelectItem value="ALL">Todos</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={classFilter}
                                    onValueChange={val => {
                                        setClassFilter(val as DividendClassFilter);
                                        setSelectedCell(null);
                                    }}
                                >
                                    <SelectTrigger className="h-9 w-[160px] bg-card text-xs font-medium">
                                        <div className="flex items-center gap-1.5">
                                            <CircleDollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                            <SelectValue placeholder="Tipo de ativo" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Tipo de ativo</SelectItem>
                                        <SelectItem value="VARIABLE_INCOME">Ações</SelectItem>
                                        <SelectItem value="FII">FIIs</SelectItem>
                                        <SelectItem value="US_STOCK">Exterior (EUA)</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={effectiveTickerFilter}
                                    onValueChange={val => {
                                        setTickerFilter(val);
                                        setSelectedCell(null);
                                    }}
                                >
                                    <SelectTrigger className="h-9 w-[145px] bg-card text-xs font-medium">
                                        <div className="flex items-center gap-1.5">
                                            <CircleDollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                            <SelectValue placeholder="Ativos" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Ativos</SelectItem>
                                        {availableTickers.map(ticker => (
                                            <SelectItem key={ticker} value={ticker}>
                                                {ticker}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Matrix Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-y bg-muted/40 text-xs text-muted-foreground">
                                        <th className="py-3 pl-6 pr-3 text-left font-medium">
                                            <button
                                                type="button"
                                                onClick={() => handleSortColumn("year")}
                                                className="inline-flex items-center gap-1.5 hover:text-foreground"
                                            >
                                                <span>Ano</span>
                                                <ArrowUpDown className="h-3 w-3 opacity-60" />
                                            </button>
                                        </th>
                                        {MONTH_HEADERS.map(m => (
                                            <th key={m} className="px-2.5 py-3 text-right font-medium">
                                                {m}
                                            </th>
                                        ))}
                                        <th className="px-3 py-3 text-right font-medium">
                                            <button
                                                type="button"
                                                onClick={() => handleSortColumn("average")}
                                                className="inline-flex items-center justify-end gap-1 hover:text-foreground"
                                            >
                                                <span>Média</span>
                                                <ArrowUpDown className="h-3 w-3 opacity-60" />
                                            </button>
                                        </th>
                                        <th className="py-3 pl-3 pr-6 text-right font-medium">
                                            <button
                                                type="button"
                                                onClick={() => handleSortColumn("total")}
                                                className="inline-flex items-center justify-end gap-1 hover:text-foreground"
                                            >
                                                <span>Total</span>
                                                <ArrowUpDown className="h-3 w-3 opacity-60" />
                                            </button>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedMatrix.map((row, rowIdx) => (
                                        <tr
                                            key={row.year}
                                            className={`border-b last:border-b-0 transition-colors ${
                                                rowIdx % 2 === 1 ? "bg-muted/25" : "bg-card"
                                            }`}
                                        >
                                            <td className="py-3.5 pl-6 pr-3 font-semibold text-foreground tabular-nums">
                                                {row.year}
                                            </td>
                                            {row.months.map((val, monthIdx) => {
                                                const isSelected =
                                                    selectedCell?.year === row.year &&
                                                    selectedCell?.monthIndex === monthIdx;
                                                const hasItems = val > 0;
                                                return (
                                                    <td
                                                        key={monthIdx}
                                                        className="px-2.5 py-3.5 text-right tabular-nums"
                                                    >
                                                        {hasItems ? (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setSelectedCell(prev =>
                                                                        prev?.year === row.year &&
                                                                        prev?.monthIndex === monthIdx
                                                                            ? null
                                                                            : { year: row.year, monthIndex: monthIdx },
                                                                    )
                                                                }
                                                                title={`Ver pagamentos de ${MONTH_HEADERS[monthIdx]}/${row.year}`}
                                                                className={`rounded px-1.5 py-0.5 transition-colors ${
                                                                    isSelected
                                                                        ? "bg-foreground font-semibold text-background"
                                                                        : "text-foreground hover:bg-muted"
                                                                }`}
                                                            >
                                                                <Money value={val} format={formatDecimal} />
                                                            </button>
                                                        ) : (
                                                            <span className="text-muted-foreground">
                                                                <Money value={0} format={formatDecimal} />
                                                            </span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-3 py-3.5 text-right font-semibold text-foreground tabular-nums">
                                                <span className="inline-flex items-center justify-end gap-1">
                                                    {row.isPartialYear && (
                                                        <span
                                                            title={`Média proporcional considerando os ${row.monthsDivisor} meses decorridos em ${row.year}`}
                                                            className="inline-flex text-muted-foreground cursor-help"
                                                        >
                                                            <Info className="h-3.5 w-3.5" aria-hidden="true" />
                                                        </span>
                                                    )}
                                                    <Money value={row.average} format={formatDecimal} />
                                                </span>
                                            </td>
                                            <td className="py-3.5 pl-3 pr-6 text-right font-semibold text-foreground tabular-nums">
                                                <Money value={row.total} format={formatDecimal} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Drilldown panel when a month cell with payments is clicked */}
                        {selectedCell && selectedCellItems.length > 0 && (
                            <div className="border-t bg-muted/20 px-6 py-4">
                                <div className="mb-2.5 flex items-center justify-between">
                                    <div className="text-xs font-semibold text-foreground">
                                        Proventos em {fullMonthLabel(selectedCell.year, selectedCell.monthIndex + 1)} ({selectedCellItems.length})
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedCell(null)}
                                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                        Fechar
                                    </button>
                                </div>
                                <div className="overflow-hidden rounded-md border bg-card">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/40 text-xs">
                                                <TableHead className="h-8">Data-Com / Ex</TableHead>
                                                <TableHead className="h-8">Data Pagamento</TableHead>
                                                <TableHead className="h-8">Ativo</TableHead>
                                                <TableHead className="h-8">Classe</TableHead>
                                                <TableHead className="h-8">Status</TableHead>
                                                <TableHead className="h-8 text-right">Qtd. do Aporte</TableHead>
                                                <TableHead className="h-8 text-right">Valor por Cota</TableHead>
                                                <TableHead className="h-8 text-right">Valor Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedCellItems.map(div => (
                                                <TableRow key={div.id} className="text-xs">
                                                    <TableCell className="py-2 tabular-nums">
                                                        {formatDate(div.date)}
                                                    </TableCell>
                                                    <TableCell className="py-2 tabular-nums text-muted-foreground">
                                                        {formatDate(div.paymentDate ?? div.date)}
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground">
                                                                {div.tickerCode}
                                                            </span>
                                                            <span className="text-muted-foreground">
                                                                {div.investment.name}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-muted-foreground">
                                                        {TYPE_LABELS[div.investment.type] ?? div.investment.type}
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        {div.status === "PENDING" ? (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                                                A receber
                                                            </span>
                                                        ) : (
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-positive-soft px-2 py-0.5 text-[10px] font-medium text-positive">
                                                                    Recebido
                                                                </span>
                                                                {div.creditedAt && div.investment.account?.name && (
                                                                    <span className="text-[10px] text-muted-foreground">
                                                                        Creditado em {div.investment.account.name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right tabular-nums">
                                                        {div.quantity}
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right tabular-nums">
                                                        {div.currency === "USD" ? (
                                                            <Money value={div.amountPerShare} format={formatUsd} />
                                                        ) : (
                                                            <Money value={div.amountPerShare} />
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right font-medium tabular-nums text-positive">
                                                        <div>
                                                            <Money value={div.totalBrl} />
                                                        </div>
                                                        {div.currency === "USD" && (
                                                            <div className="text-[11px] font-normal text-muted-foreground">
                                                                <Money value={div.totalOriginal} format={formatUsd} />
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* Bottom Toggle ("Mostrar menos" / "Mostrar todos") */}
                        {annualMatrix.length > 3 && (
                            <div className="flex justify-center border-t py-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAllYears(prev => !prev)}
                                    className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                                >
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full border bg-card">
                                        {showAllYears ? (
                                            <ChevronUp className="h-3.5 w-3.5" />
                                        ) : (
                                            <ChevronDown className="h-3.5 w-3.5" />
                                        )}
                                    </span>
                                    {showAllYears ? "Mostrar menos" : `Mostrar todos (${annualMatrix.length} anos)`}
                                </button>
                            </div>
                        )}
                    </section>

                    {/* Evolution Chart */}
                    <Panel
                        title="Evolução dos Proventos"
                        icon={ChartColumn}
                        actions={
                            <div className="flex items-center rounded-md border bg-muted/50 p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setChartPeriod("monthly")}
                                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                        chartPeriod === "monthly"
                                            ? "bg-card text-foreground shadow-2xs"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    Mensal
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setChartPeriod("yearly")}
                                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                        chartPeriod === "yearly"
                                            ? "bg-card text-foreground shadow-2xs"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    Anual
                                </button>
                            </div>
                        }
                    >
                        <div className="h-[320px] min-w-0 w-full pt-2">
                            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 320 }}>
                                <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="label"
                                        tick={{ fontSize: 11, fill: "#6b7280" }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fill: "#6b7280" }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(v: number) => formatCurrency(v)}
                                        width={80}
                                    />
                                    <Tooltip content={<DividendsTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                                    <Bar
                                        dataKey="stocksBrl"
                                        name="Ações (B3)"
                                        stackId="dividends"
                                        fill="#3b82f6"
                                        radius={[0, 0, 0, 0]}
                                    />
                                    <Bar
                                        dataKey="fiiBrl"
                                        name="FIIs"
                                        stackId="dividends"
                                        fill="#10b981"
                                        radius={[0, 0, 0, 0]}
                                    />
                                    <Bar
                                        dataKey="usBrl"
                                        name="Exterior (EUA)"
                                        stackId="dividends"
                                        fill="#8b5cf6"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Panel>
                </>
            )}
        </div>
    );
}
