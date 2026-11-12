"use client";

import { Money } from "@/components/Money";

import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, PiggyBank, Trophy, ChartNoAxesColumn, ChevronRight, Layers } from "lucide-react";
import { InvestmentModal } from "@/components/InvestmentModal";
import { InvestmentSection } from "@/components/InvestmentSection";
import { InvestmentsSubnav } from "@/components/InvestmentsSubnav";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { TrendPill, TrendText, trendTextClass } from "@/components/ui/trend";
import { formatCryptoPrice, formatCryptoUsdPrice, formatDate, formatPercent, formatQuantity, formatRate, formatUsd } from "@/lib/format";
import {
    type ApiInvestment, type ConsolidatedInvestment, type InvestmentType,
    INVESTMENT_CLASSES, CLASS_ORDER, currentValueOf, grossValueOf, taxAmountOf, profitPctOf, computeClassStats, consolidateInvestments,
} from "@/lib/investments";

const SECTION_STORAGE_KEY = "investimentos:openSections";

const signed = (value: number, formatted: React.ReactNode) => <>{value > 0 ? "+" : ""}{formatted}</>;

function MarketChip({ label, value, loading }: { label: string; value: React.ReactNode; loading: boolean }) {
    return (
        <div className="flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm">
            <span className="text-muted-foreground">{label}</span>
            {loading ? (
                <span className="h-4 w-14 animate-pulse rounded bg-muted" aria-label="Carregando" />
            ) : (
                <span className="font-medium tabular-nums text-foreground">{value}</span>
            )}
        </div>
    );
}

export default function InvestimentosPage() {
    const [investments, setInvestments] = useState<ApiInvestment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Market Indicators
    const [selicRate, setSelicRate] = useState<number | null>(null);
    const [cdiRate, setCdiRate] = useState<number | null>(null);
    const [usdRate, setUsdRate] = useState<number | null>(null);
    const [isLoadingMarket, setIsLoadingMarket] = useState(true);

    const [investmentToEdit, setInvestmentToEdit] = useState<ApiInvestment | null>(null);
    const [prefillAsset, setPrefillAsset] = useState<Partial<ApiInvestment> | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // All sections start open; the saved choice is restored after mount to avoid hydration mismatch
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
    const [expandedAssets, setExpandedAssets] = useState<Record<string, boolean>>({});

    useEffect(() => {
        try {
            const saved = localStorage.getItem(SECTION_STORAGE_KEY);
            if (saved) setOpenSections(JSON.parse(saved));
        } catch {
            // ignore corrupted storage
        }
    }, []);

    const isSectionOpen = (key: InvestmentType) => openSections[key] ?? true;

    const toggleSection = useCallback((key: InvestmentType) => {
        setOpenSections(prev => {
            const next = { ...prev, [key]: !(prev[key] ?? true) };
            try {
                localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(next));
            } catch {
                // storage unavailable (private mode) — keep in-memory state only
            }
            return next;
        });
    }, []);

    const toggleAsset = useCallback((groupKey: string) => {
        setExpandedAssets(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
    }, []);

    const fetchInvestments = useCallback(async () => {
        try {
            const res = await fetch("http://localhost:3333/investments");
            if (res.ok) {
                const data = await res.json();
                setInvestments(data);
                setLastUpdated(new Date());
            }
        } catch (error) {
            console.error("Failed to load investments", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleEdit = (inv: ApiInvestment) => {
        setPrefillAsset(null);
        setInvestmentToEdit(inv);
        setIsEditModalOpen(true);
    };

    const handleNewContribution = (inv: ConsolidatedInvestment) => {
        setInvestmentToEdit(null);
        setPrefillAsset({
            name: inv.name,
            type: inv.type,
            tickerCode: inv.tickerCode,
            sector: inv.sector,
            cdiPercentage: inv.cdiPercentage,
            currentPrice: inv.currentPrice,
            purchaseExchangeRate: inv.currentExchangeRate ?? inv.purchaseExchangeRate,
        });
        setIsEditModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja excluir este aporte?")) return;
        try {
            const res = await fetch(`http://localhost:3333/investments/${id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                setInvestments(prev => prev.filter(i => i.id !== id));
            } else {
                alert("Erro ao excluir aporte.");
            }
        } catch (error) {
            console.error("Failed to delete investment", error);
        }
    };

    useEffect(() => {
        const fetchMarketIndicators = async () => {
            try {
                const usdRes = await fetch("https://economia.awesomeapi.com.br/last/USD-BRL");
                if (usdRes.ok) {
                    const usdData = await usdRes.json();
                    setUsdRate(Number(usdData.USDBRL.bid));
                }

                const selicRes = await fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json");
                if (selicRes.ok) {
                    const selicData = await selicRes.json();
                    setSelicRate(Number(selicData[0].valor));
                }

                const cdiRes = await fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json");
                if (cdiRes.ok) {
                    const cdiData = await cdiRes.json();
                    setCdiRate(Number(cdiData[0].valor));
                }
            } catch (error) {
                console.error("Failed to load market indicators", error);
            } finally {
                setIsLoadingMarket(false);
            }
        };

        fetchInvestments();
        fetchMarketIndicators();

        const marketInterval = setInterval(() => {
            fetchMarketIndicators();
        }, 30000);

        // Auto-refresh investments every 20 minutes (B3 prices update)
        const investmentInterval = setInterval(() => {
            fetchInvestments();
        }, 20 * 60 * 1000);

        return () => {
            clearInterval(marketInterval);
            clearInterval(investmentInterval);
        };
    }, [fetchInvestments]);

    const consolidatedInvestments = useMemo(() => consolidateInvestments(investments), [investments]);

    const totalInvested = investments.reduce((acc, curr) => acc + curr.investedAmount, 0);
    const totalGross = investments.reduce((acc, curr) => acc + grossValueOf(curr), 0);
    const totalTax = investments.reduce((acc, curr) => acc + taxAmountOf(curr), 0);
    const totalCurrent = investments.reduce((acc, curr) => acc + currentValueOf(curr), 0);
    const totalGrossProfit = totalGross - totalInvested;
    const totalGrossProfitPercent = totalInvested > 0 ? (totalGrossProfit / totalInvested) * 100 : 0;
    const totalProfit = totalCurrent - totalInvested;
    const totalProfitPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    // Portfolio highlights (best/worst consolidated position and how many are in profit)
    const ranked = consolidatedInvestments
        .filter(i => i.investedAmount > 0)
        .map(i => ({ inv: i, pct: profitPctOf(i) }))
        .sort((a, b) => b.pct - a.pct);
    const best = ranked[0];
    const worst = ranked.length > 1 ? ranked[ranked.length - 1] : undefined;
    const inProfit = ranked.filter(r => r.pct > 0).length;
    const inLoss = ranked.filter(r => r.pct < 0).length;
    const inProfitPct = ranked.length > 0 ? (inProfit / ranked.length) * 100 : 0;
    const positionLabel = (inv: ApiInvestment) => inv.tickerCode || inv.name;

    const rawByType = (type: InvestmentType) => investments.filter(i => i.type === type);
    const consolidatedByType = (type: InvestmentType) => consolidatedInvestments.filter(i => i.type === type);

    const lotActionButtons = (lot: ApiInvestment) => (
        <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon-sm" aria-label={`Editar aporte de ${lot.name}`} onClick={() => handleEdit(lot)}>
                <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Excluir aporte de ${lot.name}`} className="text-negative hover:text-negative hover:bg-negative-soft" onClick={() => handleDelete(lot.id)}>
                <Trash2 className="h-3.5 w-3.5" />
            </Button>
        </div>
    );

    const rowActionButtons = (inv: ConsolidatedInvestment) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
            <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                title={`Registrar novo aporte em ${inv.tickerCode || inv.name}`}
                onClick={() => handleNewContribution(inv)}
            >
                <Plus className="h-3.5 w-3.5" />
                Aporte
            </Button>
            {inv.contributionsCount === 1 && inv.lots[0] && (
                <>
                    <Button variant="ghost" size="icon-sm" aria-label={`Editar ${inv.name}`} onClick={() => handleEdit(inv.lots[0])}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${inv.name}`} className="text-negative hover:text-negative hover:bg-negative-soft" onClick={() => handleDelete(inv.lots[0].id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </>
            )}
        </div>
    );

    const tickerBadge = (code?: string) => (
        <span className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground">{code || "—"}</span>
    );

    const contributionsBadge = (count: number) => (
        <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums ${count > 1
                    ? "border-asset-icon-border bg-asset-icon-soft text-asset-icon"
                    : "border-border bg-muted/60 text-muted-foreground"
                }`}
        >
            <Layers className="h-3 w-3" aria-hidden="true" />
            {count} {count === 1 ? "aporte" : "aportes"}
        </span>
    );

    const renderExpandedLots = (inv: ConsolidatedInvestment, colSpan: number) => (
        <TableRow className="bg-muted/25 hover:bg-muted/25">
            <TableCell colSpan={colSpan} className="p-0">
                <div className="border-l-2 border-asset-icon bg-muted/20 px-6 py-3.5">
                    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-foreground">
                                Histórico de aportes — {inv.tickerCode ? `${inv.tickerCode} (${inv.name})` : inv.name}
                            </span>
                            <span className="rounded-full bg-card px-2 py-0.5 font-medium text-muted-foreground border tabular-nums">
                                {inv.contributionsCount} {inv.contributionsCount === 1 ? "aporte realizado" : "aportes realizados"}
                            </span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 bg-card text-xs"
                            onClick={() => handleNewContribution(inv)}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Novo aporte
                        </Button>
                    </div>

                    <div className="overflow-hidden rounded-md border bg-card">
                        {inv.type === "VARIABLE_INCOME" || inv.type === "FII" || inv.type === "CRYPTO" ? (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/40 text-xs">
                                        <TableHead className="h-8">Aporte</TableHead>
                                        <TableHead className="h-8">Data</TableHead>
                                        <TableHead className="h-8 text-right">Quantidade</TableHead>
                                        <TableHead className="h-8 text-right">Preço de Compra</TableHead>
                                        <TableHead className="h-8 text-right">Valor Investido</TableHead>
                                        <TableHead className="h-8 text-right">Saldo Atual</TableHead>
                                        <TableHead className="h-8 text-right">Variação</TableHead>
                                        <TableHead className="h-8 text-right">Rentabilidade</TableHead>
                                        <TableHead className="h-8 text-right"><span className="sr-only">Ações</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {inv.lots.map((lot, idx) => {
                                        const lotQty = lot.quantity ?? 0;
                                        const lotAvg = lot.averagePrice ?? 0;
                                        const curPrice = lot.currentPrice ?? inv.currentPrice ?? 0;
                                        const lotInvested = lotQty > 0 && lotAvg > 0 ? lotAvg * lotQty : lot.investedAmount;
                                        const lotCurrent = curPrice * lotQty;
                                        const lotProfit = lotCurrent - lotInvested;
                                        const lotPct = lotInvested > 0 ? (lotProfit / lotInvested) * 100 : 0;

                                        return (
                                            <TableRow key={lot.id} className="text-xs">
                                                <TableCell className="py-2 font-medium text-muted-foreground">#{idx + 1}</TableCell>
                                                <TableCell className="py-2 tabular-nums">
                                                    {lot.investmentDate ? formatDate(lot.investmentDate) : "—"}
                                                </TableCell>
                                                <TableCell className="py-2 text-right tabular-nums">{formatQuantity(lotQty)}</TableCell>
                                                <TableCell className="py-2 text-right tabular-nums">
                                                    {inv.type === "CRYPTO" && lot.averagePriceUsd != null ? (
                                                        <>
                                                            <div><Money value={lot.averagePriceUsd} format={formatCryptoUsdPrice} /></div>
                                                            <div className="text-[11px] text-muted-foreground"><Money value={lotAvg} format={formatCryptoPrice} /></div>
                                                        </>
                                                    ) : (
                                                        <Money value={lotAvg} format={inv.type === "CRYPTO" ? formatCryptoPrice : undefined} />
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-2 text-right tabular-nums"><Money value={lotInvested} /></TableCell>
                                                <TableCell className="py-2 text-right font-medium tabular-nums"><Money value={lotCurrent} /></TableCell>
                                                <TableCell className="py-2 text-right">
                                                    <TrendText value={lotProfit} label={signed(lotProfit, <Money value={lotProfit} />)} />
                                                </TableCell>
                                                <TableCell className="py-2 text-right"><TrendPill value={lotPct} /></TableCell>
                                                <TableCell className="py-2 text-right">{lotActionButtons(lot)}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        ) : inv.type === "US_STOCK" ? (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/40 text-xs">
                                        <TableHead className="h-8">Aporte</TableHead>
                                        <TableHead className="h-8">Data</TableHead>
                                        <TableHead className="h-8 text-right">Quantidade</TableHead>
                                        <TableHead className="h-8 text-right">Preço Compra (US$)</TableHead>
                                        <TableHead className="h-8 text-right">Dólar Compra</TableHead>
                                        <TableHead className="h-8 text-right">Investido (US$ / R$)</TableHead>
                                        <TableHead className="h-8 text-right">Saldo (R$)</TableHead>
                                        <TableHead className="h-8 text-right">Rent. US$</TableHead>
                                        <TableHead className="h-8 text-right">Rent. R$</TableHead>
                                        <TableHead className="h-8 text-right"><span className="sr-only">Ações</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {inv.lots.map((lot, idx) => {
                                        const lotQty = lot.quantity ?? 0;
                                        const lotAvgUsd = lot.averagePrice ?? 0;
                                        const curUsd = lot.currentPrice ?? inv.currentPrice ?? lotAvgUsd;
                                        const lotInvestedUsd = lot.investedUsd ?? lotAvgUsd * lotQty;
                                        const lotCurrentUsd = lot.currentValueUsd ?? curUsd * lotQty;
                                        const lotUsdPct = lotInvestedUsd > 0 ? ((lotCurrentUsd - lotInvestedUsd) / lotInvestedUsd) * 100 : 0;
                                        const lotBrlProfit = lot.currentValue - lot.investedAmount;
                                        const lotBrlPct = lot.investedAmount > 0 ? (lotBrlProfit / lot.investedAmount) * 100 : 0;

                                        return (
                                            <TableRow key={lot.id} className="text-xs">
                                                <TableCell className="py-2 font-medium text-muted-foreground">#{idx + 1}</TableCell>
                                                <TableCell className="py-2 tabular-nums">
                                                    {lot.investmentDate ? formatDate(lot.investmentDate) : "—"}
                                                </TableCell>
                                                <TableCell className="py-2 text-right tabular-nums">{formatQuantity(lotQty)}</TableCell>
                                                <TableCell className="py-2 text-right tabular-nums">
                                                    <Money value={lotAvgUsd} format={formatUsd} />
                                                </TableCell>
                                                <TableCell className="py-2 text-right tabular-nums text-muted-foreground">
                                                    {lot.purchaseExchangeRate ? <Money value={lot.purchaseExchangeRate} format={formatRate} /> : "—"}
                                                </TableCell>
                                                <TableCell className="py-2 text-right tabular-nums">
                                                    <div><Money value={lot.investedAmount} /></div>
                                                    <div className="text-[11px] text-muted-foreground">
                                                        <Money value={lotInvestedUsd} format={formatUsd} />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-2 text-right font-medium tabular-nums">
                                                    <Money value={lot.currentValue} />
                                                </TableCell>
                                                <TableCell className="py-2 text-right"><TrendText value={lotUsdPct} /></TableCell>
                                                <TableCell className="py-2 text-right">
                                                    <TrendPill value={lotBrlPct} />
                                                </TableCell>
                                                <TableCell className="py-2 text-right">{lotActionButtons(lot)}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        ) : inv.type === "FIXED_INCOME" ? (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/40 text-xs">
                                        <TableHead className="h-8">Aporte</TableHead>
                                        <TableHead className="h-8">Data</TableHead>
                                        <TableHead className="h-8">Indexador</TableHead>
                                        <TableHead className="h-8 text-right">Aportado</TableHead>
                                        <TableHead className="h-8 text-right">Saldo Bruto</TableHead>
                                        <TableHead className="h-8 text-right">IR</TableHead>
                                        <TableHead className="h-8 text-right">Saldo Líquido</TableHead>
                                        <TableHead className="h-8 text-right">Rentabilidade</TableHead>
                                        <TableHead className="h-8 text-right"><span className="sr-only">Ações</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {inv.lots.map((lot, idx) => {
                                        const grossVal = lot.grossValue ?? lot.currentValue;
                                        const netVal = lot.netValue ?? lot.currentValue;
                                        const taxAmount = lot.taxAmount ?? 0;
                                        const netProfit = netVal - lot.investedAmount;
                                        const netPct = lot.investedAmount > 0 ? (netProfit / lot.investedAmount) * 100 : 0;

                                        return (
                                            <TableRow key={lot.id} className="text-xs">
                                                <TableCell className="py-2 font-medium text-muted-foreground">#{idx + 1}</TableCell>
                                                <TableCell className="py-2 tabular-nums">
                                                    {lot.investmentDate ? formatDate(lot.investmentDate) : "—"}
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    {lot.cdiPercentage ? `${lot.cdiPercentage}% CDI (${lot.daysInvested ?? 0}d úteis)` : "Manual"}
                                                </TableCell>
                                                <TableCell className="py-2 text-right tabular-nums"><Money value={lot.investedAmount} /></TableCell>
                                                <TableCell className="py-2 text-right tabular-nums"><Money value={grossVal} /></TableCell>
                                                <TableCell className="py-2 text-right tabular-nums text-negative">
                                                    {taxAmount > 0 ? <>-<Money value={taxAmount} /></> : "—"}
                                                </TableCell>
                                                <TableCell className="py-2 text-right font-medium tabular-nums"><Money value={netVal} /></TableCell>
                                                <TableCell className="py-2 text-right"><TrendPill value={netPct} /></TableCell>
                                                <TableCell className="py-2 text-right">{lotActionButtons(lot)}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/40 text-xs">
                                        <TableHead className="h-8">Aporte</TableHead>
                                        <TableHead className="h-8">Data</TableHead>
                                        <TableHead className="h-8 text-right">Aportado</TableHead>
                                        <TableHead className="h-8 text-right">Saldo</TableHead>
                                        <TableHead className="h-8 text-right">Variação</TableHead>
                                        <TableHead className="h-8 text-right">Rentabilidade</TableHead>
                                        <TableHead className="h-8 text-right"><span className="sr-only">Ações</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {inv.lots.map((lot, idx) => {
                                        const profit = lot.currentValue - lot.investedAmount;
                                        const pct = lot.investedAmount > 0 ? (profit / lot.investedAmount) * 100 : 0;
                                        return (
                                            <TableRow key={lot.id} className="text-xs">
                                                <TableCell className="py-2 font-medium text-muted-foreground">#{idx + 1}</TableCell>
                                                <TableCell className="py-2 tabular-nums">
                                                    {lot.investmentDate ? formatDate(lot.investmentDate) : "—"}
                                                </TableCell>
                                                <TableCell className="py-2 text-right tabular-nums"><Money value={lot.investedAmount} /></TableCell>
                                                <TableCell className="py-2 text-right font-medium tabular-nums"><Money value={lot.currentValue} /></TableCell>
                                                <TableCell className="py-2 text-right">
                                                    <TrendText value={profit} label={signed(profit, <Money value={profit} />)} />
                                                </TableCell>
                                                <TableCell className="py-2 text-right"><TrendPill value={pct} /></TableCell>
                                                <TableCell className="py-2 text-right">{lotActionButtons(lot)}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </div>
            </TableCell>
        </TableRow>
    );

    const renderFixedIncome = (invs: ConsolidatedInvestment[]) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Indexador</TableHead>
                    <TableHead className="text-right">Aportado</TableHead>
                    <TableHead className="text-right">Saldo Bruto</TableHead>
                    <TableHead className="text-right">Imposto (IR)</TableHead>
                    <TableHead className="text-right">Saldo Líquido</TableHead>
                    <TableHead className="text-right">Rentabilidade</TableHead>
                    <TableHead className="text-right"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {invs.map((inv) => {
                    const grossVal = inv.grossValue ?? inv.currentValue;
                    const netVal = inv.netValue ?? inv.currentValue;
                    const taxAmount = inv.taxAmount ?? 0;
                    const netProfit = netVal - inv.investedAmount;
                    const netPct = inv.investedAmount > 0 ? (netProfit / inv.investedAmount) * 100 : 0;
                    const isExpanded = !!expandedAssets[inv.groupKey];

                    return (
                        <Fragment key={inv.groupKey}>
                            <TableRow
                                className="cursor-pointer"
                                onClick={() => toggleAsset(inv.groupKey)}
                                aria-expanded={isExpanded}
                            >
                                <TableCell className="font-medium text-foreground">
                                    <div className="flex items-center gap-2">
                                        <ChevronRight
                                            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-90 text-foreground" : ""}`}
                                            aria-hidden="true"
                                        />
                                        <span>{inv.name}</span>
                                        {contributionsBadge(inv.contributionsCount)}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {inv.cdiPercentage ? (
                                        <div className="text-xs">
                                            <span className="font-medium text-foreground">{inv.cdiPercentage}% CDI</span>
                                            <div className="text-muted-foreground">{inv.daysInvested} dias úteis</div>
                                        </div>
                                    ) : (
                                        <span className="text-xs italic text-muted-foreground">Manual</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums"><Money value={inv.investedAmount} /></TableCell>
                                <TableCell className="text-right tabular-nums"><Money value={grossVal} /></TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {taxAmount > 0 ? (
                                        <div>
                                            <span className="text-negative">-<Money value={taxAmount} /></span>
                                            {inv.irTaxRate && <div className="text-[11px] text-muted-foreground">Alíquota {inv.irTaxRate}%</div>}
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground">—</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right font-medium tabular-nums"><Money value={netVal} /></TableCell>
                                <TableCell className="text-right"><TrendPill value={netPct} /></TableCell>
                                <TableCell className="text-right">{rowActionButtons(inv)}</TableCell>
                            </TableRow>
                            {isExpanded && renderExpandedLots(inv, 8)}
                        </Fragment>
                    );
                })}
            </TableBody>
        </Table>
    );

    const renderPricedAssets = (invs: ConsolidatedInvestment[], detailLabel: string) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Ativo</TableHead>
                    <TableHead>{detailLabel}</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Preço Médio</TableHead>
                    <TableHead className="text-right">Preço Atual</TableHead>
                    <TableHead className="text-right">Valor Investido</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Variação</TableHead>
                    <TableHead className="text-right">Rentabilidade</TableHead>
                    <TableHead className="text-right"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {invs.map((inv) => {
                    const qty = inv.quantity ?? 0;
                    const avgPrice = inv.averagePrice ?? 0;
                    const curPrice = inv.currentPrice ?? 0;
                    const totalCurrentValue = curPrice * qty;
                    const totalInvestedValue = avgPrice * qty;
                    const profitRs = totalCurrentValue - totalInvestedValue;
                    const profitPct = totalInvestedValue > 0 ? (profitRs / totalInvestedValue) * 100 : 0;
                    const isExpanded = !!expandedAssets[inv.groupKey];

                    return (
                        <Fragment key={inv.groupKey}>
                            <TableRow
                                className="cursor-pointer"
                                onClick={() => toggleAsset(inv.groupKey)}
                                aria-expanded={isExpanded}
                            >
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <ChevronRight
                                            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-90 text-foreground" : ""}`}
                                            aria-hidden="true"
                                        />
                                        {tickerBadge(inv.tickerCode)}
                                        <span className="font-medium text-foreground">{inv.name}</span>
                                        {contributionsBadge(inv.contributionsCount)}
                                    </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground">{inv.sector || "—"}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatQuantity(qty)}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {inv.type === "CRYPTO" && inv.averagePriceUsd != null ? (
                                        <>
                                            <div><Money value={inv.averagePriceUsd} format={formatCryptoUsdPrice} /></div>
                                            <div className="text-[11px] text-muted-foreground"><Money value={avgPrice} format={formatCryptoPrice} /></div>
                                        </>
                                    ) : (
                                        <Money value={avgPrice} format={inv.type === "CRYPTO" ? formatCryptoPrice : undefined} />
                                    )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {inv.type === "CRYPTO" && inv.averagePriceUsd != null && inv.currentPriceUsd != null ? (
                                        <>
                                            <div><Money value={inv.currentPriceUsd} format={formatCryptoUsdPrice} /></div>
                                            <div className="text-[11px] text-muted-foreground"><Money value={curPrice} format={formatCryptoPrice} /></div>
                                        </>
                                    ) : (
                                        <>
                                            <div><Money value={curPrice} format={inv.type === "CRYPTO" ? formatCryptoPrice : undefined} /></div>
                                            {inv.type === "CRYPTO" && inv.currentPriceUsd != null && (
                                                <div className="text-[11px] text-muted-foreground"><Money value={inv.currentPriceUsd} format={formatCryptoUsdPrice} /></div>
                                            )}
                                        </>
                                    )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums"><Money value={totalInvestedValue} /></TableCell>
                                <TableCell className="text-right font-medium tabular-nums"><Money value={totalCurrentValue} /></TableCell>
                                <TableCell className="text-right">
                                    <TrendText value={profitRs} label={signed(profitRs, <Money value={profitRs} />)} />
                                </TableCell>
                                <TableCell className="text-right"><TrendPill value={profitPct} /></TableCell>
                                <TableCell className="text-right">{rowActionButtons(inv)}</TableCell>
                            </TableRow>
                            {isExpanded && renderExpandedLots(inv, 10)}
                        </Fragment>
                    );
                })}
            </TableBody>
        </Table>
    );

    const renderUsStocks = (invs: ConsolidatedInvestment[]) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Preço Médio</TableHead>
                    <TableHead className="text-right">Preço Atual</TableHead>
                    <TableHead className="text-right">Dólar Compra → Atual</TableHead>
                    <TableHead className="text-right">Investido</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Rent. em US$</TableHead>
                    <TableHead className="text-right">Rent. em R$</TableHead>
                    <TableHead className="text-right"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {invs.map((inv) => {
                    const qty = inv.quantity ?? 0;
                    const avgUsd = inv.averagePrice ?? 0;
                    const curUsd = inv.currentPrice ?? avgUsd;
                    const investedUsd = inv.investedUsd ?? avgUsd * qty;
                    const currentUsd = inv.currentValueUsd ?? curUsd * qty;
                    const usdProfitPct = investedUsd > 0 ? ((currentUsd - investedUsd) / investedUsd) * 100 : 0;

                    const brlProfit = inv.currentValue - inv.investedAmount;
                    const brlProfitPct = inv.investedAmount > 0 ? (brlProfit / inv.investedAmount) * 100 : 0;
                    const assetGain = inv.assetGainBrl ?? 0;
                    const fxGain = inv.fxGainBrl ?? 0;
                    const isExpanded = !!expandedAssets[inv.groupKey];

                    return (
                        <Fragment key={inv.groupKey}>
                            <TableRow
                                className="cursor-pointer"
                                onClick={() => toggleAsset(inv.groupKey)}
                                aria-expanded={isExpanded}
                            >
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <ChevronRight
                                            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-90 text-foreground" : ""}`}
                                            aria-hidden="true"
                                        />
                                        {tickerBadge(inv.tickerCode)}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-foreground">{inv.name}</span>
                                                {contributionsBadge(inv.contributionsCount)}
                                            </div>
                                            {inv.sector && <div className="text-[11px] text-muted-foreground">{inv.sector}</div>}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{formatQuantity(qty)}</TableCell>
                                <TableCell className="text-right tabular-nums"><Money value={avgUsd} format={formatUsd} /></TableCell>
                                <TableCell className="text-right tabular-nums">
                                    <Money value={curUsd} format={formatUsd} />
                                    {inv.priceIsLive === false && (
                                        <div className="text-[11px] text-amber-700">cotação indisponível</div>
                                    )}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                    <div className="text-muted-foreground">{inv.purchaseExchangeRate ? <Money value={inv.purchaseExchangeRate} format={formatRate} /> : "—"}</div>
                                    <div className="font-medium text-foreground">
                                        {inv.currentExchangeRate ? <Money value={inv.currentExchangeRate} format={formatRate} /> : "—"}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums"><Money value={inv.investedAmount} /></TableCell>
                                <TableCell className="text-right font-medium tabular-nums"><Money value={inv.currentValue} /></TableCell>
                                <TableCell className="text-right"><TrendText value={usdProfitPct} /></TableCell>
                                <TableCell className="text-right">
                                    <TrendPill value={brlProfitPct} />
                                    <div className={`mt-1 text-xs tabular-nums ${trendTextClass(brlProfit)}`}>
                                        {signed(brlProfit, <Money value={brlProfit} />)}
                                    </div>
                                    <div className="mt-0.5 whitespace-nowrap text-[11px] text-muted-foreground">
                                        Ativo <span className={trendTextClass(assetGain)}>{signed(assetGain, <Money value={assetGain} />)}</span>
                                        {" · "}
                                        Câmbio <span className={trendTextClass(fxGain)}>{signed(fxGain, <Money value={fxGain} />)}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">{rowActionButtons(inv)}</TableCell>
                            </TableRow>
                            {isExpanded && renderExpandedLots(inv, 10)}
                        </Fragment>
                    );
                })}
            </TableBody>
        </Table>
    );

    const renderOther = (invs: ConsolidatedInvestment[]) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="text-right">Aportado</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Variação</TableHead>
                    <TableHead className="text-right">Rentabilidade</TableHead>
                    <TableHead className="text-right"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {invs.map((inv) => {
                    const profit = inv.currentValue - inv.investedAmount;
                    const profitPct = inv.investedAmount > 0 ? (profit / inv.investedAmount) * 100 : 0;
                    const isExpanded = !!expandedAssets[inv.groupKey];
                    return (
                        <Fragment key={inv.groupKey}>
                            <TableRow
                                className="cursor-pointer"
                                onClick={() => toggleAsset(inv.groupKey)}
                                aria-expanded={isExpanded}
                            >
                                <TableCell className="font-medium text-foreground">
                                    <div className="flex items-center gap-2">
                                        <ChevronRight
                                            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-90 text-foreground" : ""}`}
                                            aria-hidden="true"
                                        />
                                        <span>{inv.name}</span>
                                        {contributionsBadge(inv.contributionsCount)}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums"><Money value={inv.investedAmount} /></TableCell>
                                <TableCell className="text-right font-medium tabular-nums"><Money value={inv.currentValue} /></TableCell>
                                <TableCell className="text-right">
                                    <TrendText value={profit} label={signed(profit, <Money value={profit} />)} />
                                </TableCell>
                                <TableCell className="text-right"><TrendPill value={profitPct} /></TableCell>
                                <TableCell className="text-right">{rowActionButtons(inv)}</TableCell>
                            </TableRow>
                            {isExpanded && renderExpandedLots(inv, 6)}
                        </Fragment>
                    );
                })}
            </TableBody>
        </Table>
    );

    const renderSectionBody = (key: InvestmentType, invs: ConsolidatedInvestment[]) => {
        switch (key) {
            case "FIXED_INCOME":
                return renderFixedIncome(invs);
            case "VARIABLE_INCOME":
                return renderPricedAssets(invs, "Setor");
            case "FII":
                return renderPricedAssets(invs, "Segmento");
            case "US_STOCK":
                return renderUsStocks(invs);
            case "CRYPTO":
                return renderPricedAssets(invs, "Rede/Detalhe");
            case "OTHER":
                return renderOther(invs);
        }
    };

    return (
        <div className="space-y-6">
            <InvestmentModal
                open={isEditModalOpen}
                onOpenChange={(open) => {
                    setIsEditModalOpen(open);
                    if (!open) {
                        setInvestmentToEdit(null);
                        setPrefillAsset(null);
                    }
                }}
                investmentToEdit={investmentToEdit}
                prefillAsset={prefillAsset}
                onSuccess={fetchInvestments}
            />

            <InvestmentsSubnav />

            <PageHeader
                title="Carteira"
                description={lastUpdated
                    ? `Atualizado em ${lastUpdated.toLocaleDateString("pt-BR")} às ${lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                    : undefined}
                actions={
                    <>
                        <MarketChip label="Dólar" value={usdRate ? <Money value={usdRate} /> : "—"} loading={isLoadingMarket} />
                        <MarketChip label="Selic" value={selicRate ? `${formatPercent(selicRate)} a.a.` : "—"} loading={isLoadingMarket} />
                        <MarketChip label="CDI" value={cdiRate ? `${formatPercent(cdiRate)} a.a.` : "—"} loading={isLoadingMarket} />
                        <InvestmentModal onSuccess={fetchInvestments}>
                            <Button>
                                <Plus className="h-4 w-4" />
                                Adicionar Ativo
                            </Button>
                        </InvestmentModal>
                    </>
                }
            />

            {/* Summary cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                    title="Patrimônio total"
                    icon={PiggyBank}
                    info="Valor bruto total de todos os ativos e valor líquido ao lado (já descontado o IR estimado da renda fixa)."
                >
                    <div className="grid grid-cols-2 gap-4">
                        <div className="min-w-0">
                            <div className="text-xs text-muted-foreground">Valor bruto</div>
                            <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
                                <span className="text-xl font-medium tabular-nums">
                                    <Money value={totalGross} />
                                </span>
                                <TrendText value={totalGrossProfitPercent} className="text-xs" />
                            </div>
                        </div>
                        <div className="min-w-0 border-l pl-4">
                            <div className="text-xs text-muted-foreground">Valor líquido</div>
                            <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
                                <span className="text-xl font-medium text-positive tabular-nums">
                                    <Money value={totalCurrent} />
                                </span>
                                <TrendText value={totalProfitPercent} className="text-xs" />
                            </div>
                        </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-xs">
                        <div>
                            <span className="text-muted-foreground">Valor investido: </span>
                            <span className="font-medium tabular-nums"><Money value={totalInvested} /></span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">IR estimado: </span>
                            <span className="font-medium text-negative tabular-nums">-<Money value={totalTax} /></span>
                        </div>
                    </div>
                </StatCard>

                <StatCard title="Destaques da carteira" icon={Trophy} info="Ativos consolidados com a maior e a menor rentabilidade desde a compra.">
                    {best ? (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="min-w-0">
                                <div className="text-sm text-muted-foreground">Melhor posição</div>
                                <div className="mt-1.5 truncate font-medium" title={best.inv.name}>{positionLabel(best.inv)}</div>
                                <TrendPill value={best.pct} className="mt-1 text-[13px]" />
                            </div>
                            {worst && (
                                <div className="min-w-0">
                                    <div className="text-sm text-muted-foreground">Pior posição</div>
                                    <div className="mt-1.5 truncate font-medium" title={worst.inv.name}>{positionLabel(worst.inv)}</div>
                                    <TrendPill value={worst.pct} className="mt-1 text-[13px]" />
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">Sem posições ainda.</p>
                    )}
                </StatCard>

                <StatCard title="Posições no lucro" icon={ChartNoAxesColumn} info="Quantos ativos consolidados estão acima do valor investido.">
                    <div className="flex items-center gap-3">
                        <span className="text-xl font-medium tabular-nums">{inProfit} de {ranked.length}</span>
                        <span className="rounded-md bg-positive-soft px-2 py-0.5 text-[13px] font-medium text-positive tabular-nums">
                            {Math.round(inProfitPct)}%
                        </span>
                    </div>
                    <div
                        className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted"
                        role="img"
                        aria-label={`${inProfit} posições no lucro e ${inLoss} no prejuízo`}
                    >
                        <div className="bg-positive-fill" style={{ width: `${inProfitPct}%` }} />
                        <div className="bg-negative-fill" style={{ width: `${ranked.length > 0 ? (inLoss / ranked.length) * 100 : 0}%` }} />
                    </div>
                    <div className="mt-2.5 flex justify-between text-sm">
                        <TrendText value={1} label={`${inProfit} no lucro`} className="font-normal" />
                        <TrendText value={-1} label={`${inLoss} no prejuízo`} className="font-normal" />
                    </div>
                </StatCard>
            </div>

            {isLoading && (
                <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground animate-pulse">
                    Carregando carteira de investimentos...
                </div>
            )}

            {!isLoading && investments.length === 0 && (
                <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
                    Nenhum investimento cadastrado.
                </div>
            )}

            {!isLoading && investments.length > 0 && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2">
                        <h2 className="text-[22px] font-medium tracking-tight">
                            Meus Ativos{" "}
                            <span className="text-base font-normal text-muted-foreground">
                                ({consolidatedInvestments.length} {consolidatedInvestments.length === 1 ? "ativo" : "ativos"}
                                {investments.length !== consolidatedInvestments.length ? ` · ${investments.length} aportes` : ""})
                            </span>
                        </h2>
                        <span className="text-xs text-muted-foreground">
                            Clique em um ativo para abrir o histórico de aportes
                        </span>
                    </div>

                    {CLASS_ORDER.map((key) => {
                        const rawInvs = rawByType(key);
                        if (rawInvs.length === 0) return null;
                        const consolidatedInvs = consolidatedByType(key);
                        const meta = INVESTMENT_CLASSES[key];
                        return (
                            <InvestmentSection
                                key={key}
                                title={meta.title}
                                icon={meta.icon}
                                stats={computeClassStats(rawInvs, totalCurrent)}
                                isOpen={isSectionOpen(key)}
                                onToggle={() => toggleSection(key)}
                            >
                                {renderSectionBody(key, consolidatedInvs)}
                            </InvestmentSection>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
