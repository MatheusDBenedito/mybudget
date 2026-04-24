"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PlusCircle, TrendingUp, PiggyBank, PieChart, Pencil, Trash2 } from "lucide-react";
import { InvestmentModal } from "@/components/InvestmentModal";

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
};

const formatPercent = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
        style: "percent",
        minimumFractionDigits: 2,
    }).format(value / 100);
};

type ApiInvestment = {
    id: string;
    name: string;
    type: "FIXED_INCOME" | "VARIABLE_INCOME" | "CRYPTO" | "OTHER";
    investedAmount: number;
    currentValue: number;
    cdiPercentage?: number;
    investmentDate?: string;

    // Variable income fields
    sector?: string;
    tickerCode?: string;
    averagePrice?: number;
    currentPrice?: number;
    quantity?: number;

    // Calculated fields sent by backend (fixed income)
    daysInvested?: number;
    grossValue?: number;
    taxAmount?: number;
    netValue?: number;
    irTaxRate?: number;
};

const TYPE_TRANSLATIONS: Record<string, string> = {
    FIXED_INCOME: "CDB / Renda Fixa",
    VARIABLE_INCOME: "Renda Variável",
    CRYPTO: "Criptomoedas",
    OTHER: "Outros",
};

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
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const handleEdit = (inv: ApiInvestment) => {
        setInvestmentToEdit(inv);
        setIsEditModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja excluir este investimento?")) return;
        try {
            const res = await fetch(`http://localhost:3333/investments/${id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                setInvestments(prev => prev.filter(i => i.id !== id));
            } else {
                alert("Erro ao excluir investimento.");
            }
        } catch (error) {
            console.error("Failed to delete investment", error);
        }
    };

    useEffect(() => {
        const fetchInvestments = async () => {
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
        };

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
    }, []);

    const totalInvested = investments.reduce((acc, curr) => acc + curr.investedAmount, 0);
    const totalNetValue = investments.reduce((acc, curr) => acc + (curr.netValue ?? curr.currentValue), 0);
    const totalProfit = totalNetValue - totalInvested;
    const totalProfitPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    // Group investments by type
    const fixedIncomeInvs = investments.filter(i => i.type === "FIXED_INCOME");
    const variableIncomeInvs = investments.filter(i => i.type === "VARIABLE_INCOME");
    const cryptoInvs = investments.filter(i => i.type === "CRYPTO");
    const otherInvs = investments.filter(i => i.type === "OTHER");

    // Per-type profitability calculation
    const computeTypeStats = (invs: ApiInvestment[]) => {
        const invested = invs.reduce((acc, i) => acc + i.investedAmount, 0);
        const net = invs.reduce((acc, i) => {
            if (i.type === "VARIABLE_INCOME" || i.type === "CRYPTO") {
                const qty = i.quantity ?? 0;
                const avgPrice = i.averagePrice ?? 0;
                const curPrice = i.currentPrice ?? 0;
                return acc + curPrice * qty;
            }
            return acc + (i.netValue ?? i.currentValue);
        }, 0);
        const profit = net - invested;
        const pct = invested > 0 ? (profit / invested) * 100 : 0;
        return { invested, net, profit, pct };
    };

    const fixedStats = computeTypeStats(fixedIncomeInvs);
    const variableStats = computeTypeStats(variableIncomeInvs);
    const cryptoStats = computeTypeStats(cryptoInvs);

    const typeCards = [
        { label: "CDB / Renda Fixa", stats: fixedStats, count: fixedIncomeInvs.length, color: "blue" },
        { label: "Renda Variável", stats: variableStats, count: variableIncomeInvs.length, color: "indigo" },
        { label: "Criptomoedas", stats: cryptoStats, count: cryptoInvs.length, color: "orange" },
    ].filter(c => c.count > 0);

    return (
        <div className="space-y-8">
            <InvestmentModal
                open={isEditModalOpen}
                onOpenChange={setIsEditModalOpen}
                investmentToEdit={investmentToEdit}
            />
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900">Meus Investimentos</h2>
                    <p className="text-sm text-gray-500 mt-1">Acompanhe seu patrimônio e rentabilidade.</p>
                    {lastUpdated && (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            Atualizado em {lastUpdated.toLocaleDateString("pt-BR")} às {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <Card className="shadow-none border-gray-200 py-1.5 px-4 h-11 flex items-center bg-white">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Dólar (USD)</span>
                            {isLoadingMarket ? (
                                <div className="h-4 w-12 bg-gray-200 animate-pulse rounded mt-0.5" />
                            ) : (
                                <span className="text-sm font-semibold text-emerald-700">
                                    {usdRate ? formatCurrency(usdRate) : "---"}
                                </span>
                            )}
                        </div>
                    </Card>

                    <Card className="shadow-none border-gray-200 py-1.5 px-4 h-11 flex items-center bg-white">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Taxa Selic</span>
                            {isLoadingMarket ? (
                                <div className="h-4 w-12 bg-gray-200 animate-pulse rounded mt-0.5" />
                            ) : (
                                <span className="text-sm font-semibold text-blue-700">
                                    {selicRate ? formatPercent(selicRate) : "---"} a.a.
                                </span>
                            )}
                        </div>
                    </Card>

                    <Card className="shadow-none border-gray-200 py-1.5 px-4 h-11 flex items-center bg-white">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Taxa CDI</span>
                            {isLoadingMarket ? (
                                <div className="h-4 w-12 bg-gray-200 animate-pulse rounded mt-0.5" />
                            ) : (
                                <span className="text-sm font-semibold text-indigo-700">
                                    {cdiRate ? formatPercent(cdiRate) : "---"} a.a.
                                </span>
                            )}
                        </div>
                    </Card>

                    <InvestmentModal>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 ml-2">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Novo
                        </Button>
                    </InvestmentModal>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Total Aportado</CardTitle>
                        <PiggyBank className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalInvested)}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Saldo Líquido Atual</CardTitle>
                        <PieChart className="h-4 w-4 text-indigo-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalNetValue)}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Rentabilidade Líquida</CardTitle>
                        <TrendingUp className={`h-4 w-4 ${totalProfit >= 0 ? "text-emerald-600" : "text-red-600"}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${totalProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {totalProfit > 0 ? "+" : ""}{formatCurrency(totalProfit)}
                        </div>
                        <p className={`text-xs mt-1 ${totalProfit >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                            {totalProfitPercent > 0 ? "+" : ""}{formatPercent(totalProfitPercent)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Per-type profitability cards */}
            {typeCards.length > 0 && (
                <div className={`grid gap-4 md:grid-cols-${typeCards.length}`}>
                    {typeCards.map(({ label, stats, count, color }) => {
                        const borderColor = color === "blue" ? "border-blue-200" : color === "indigo" ? "border-indigo-200" : "border-orange-200";
                        const bgColor = color === "blue" ? "bg-blue-50/50" : color === "indigo" ? "bg-indigo-50/50" : "bg-orange-50/50";
                        const accentColor = color === "blue" ? "text-blue-700" : color === "indigo" ? "text-indigo-700" : "text-orange-700";
                        const profitColor = stats.profit >= 0 ? "text-emerald-600" : "text-red-600";

                        return (
                            <Card key={label} className={`${borderColor} ${bgColor}`}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <div>
                                        <CardTitle className={`text-sm font-semibold ${accentColor}`}>{label}</CardTitle>
                                        <span className="text-[10px] text-gray-500">{count} {count === 1 ? "ativo" : "ativos"}</span>
                                    </div>
                                    <TrendingUp className={`h-4 w-4 ${profitColor}`} />
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-500">Aportado</span>
                                            <span className="font-medium text-gray-700">{formatCurrency(stats.invested)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-500">Saldo Líquido</span>
                                            <span className="font-medium text-gray-900">{formatCurrency(stats.net)}</span>
                                        </div>
                                        <div className="border-t pt-1.5 mt-1.5 flex justify-between text-xs">
                                            <span className="text-gray-500">Rentabilidade</span>
                                            <div className="text-right">
                                                <span className={`font-bold ${profitColor}`}>
                                                    {stats.profit > 0 ? "+" : ""}{formatCurrency(stats.profit)}
                                                </span>
                                                <span className={`block text-[10px] font-semibold ${profitColor}`}>
                                                    {stats.pct > 0 ? "+" : ""}{formatPercent(stats.pct)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {isLoading && (
                <div className="bg-white border rounded-lg p-12 text-center text-gray-500 animate-pulse">
                    Carregando carteira de investimentos...
                </div>
            )}

            {!isLoading && investments.length === 0 && (
                <div className="bg-white border rounded-lg p-12 text-center text-gray-500">
                    Nenhum investimento cadastrado.
                </div>
            )}

            {/* ── RENDA FIXA ── */}
            {fixedIncomeInvs.length > 0 && (
                <div className="bg-white border rounded-lg overflow-x-auto">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-800">CDB / Renda Fixa</span>
                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                                {fixedIncomeInvs.length} {fixedIncomeInvs.length === 1 ? "ativo" : "ativos"}
                            </span>
                        </div>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/50">
                                <TableHead>Ativo</TableHead>
                                <TableHead>Rentabilidade</TableHead>
                                <TableHead className="text-right">Aportado</TableHead>
                                <TableHead className="text-right">Saldo Bruto</TableHead>
                                <TableHead className="text-right">Imposto (IR)</TableHead>
                                <TableHead className="text-right">Saldo Líquido</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fixedIncomeInvs.map((inv) => {
                                const grossVal = inv.grossValue ?? inv.currentValue;
                                const netVal = inv.netValue ?? inv.currentValue;
                                const taxAmount = inv.taxAmount ?? 0;
                                const netProfit = netVal - inv.investedAmount;
                                const netPct = inv.investedAmount > 0 ? (netProfit / inv.investedAmount) * 100 : 0;

                                return (
                                    <TableRow key={inv.id}>
                                        <TableCell>
                                            <div className="font-semibold text-gray-900">{inv.name}</div>
                                        </TableCell>
                                        <TableCell>
                                            {inv.cdiPercentage ? (
                                                <div className="text-xs">
                                                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">
                                                        {inv.cdiPercentage}% CDI
                                                    </span>
                                                    <div className="text-gray-500 mt-1">{inv.daysInvested} dias</div>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">Manual</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right text-gray-600 font-medium">
                                            {formatCurrency(inv.investedAmount)}
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-gray-900">
                                            {formatCurrency(grossVal)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {taxAmount > 0 ? (
                                                <div>
                                                    <span className="text-red-600 font-medium">-{formatCurrency(taxAmount)}</span>
                                                    {inv.irTaxRate && <div className="text-[10px] text-gray-500">Aliq. {inv.irTaxRate}%</div>}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="font-bold text-gray-900">{formatCurrency(netVal)}</div>
                                            <div className={`text-xs font-semibold ${netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                                {netProfit > 0 ? "+" : ""}{formatPercent(netPct)} líq.
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => handleEdit(inv)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50" onClick={() => handleDelete(inv.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* ── RENDA VARIÁVEL ── */}
            {variableIncomeInvs.length > 0 && (
                <div className="bg-white border rounded-lg overflow-x-auto">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-800">Renda Variável</span>
                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                                {variableIncomeInvs.length} {variableIncomeInvs.length === 1 ? "ativo" : "ativos"}
                            </span>
                        </div>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/50">
                                <TableHead>Ativo</TableHead>
                                <TableHead>Ramo</TableHead>
                                <TableHead>Código</TableHead>
                                <TableHead className="text-right">Preço Médio</TableHead>
                                <TableHead className="text-right">Preço Atual</TableHead>
                                <TableHead className="text-right">Qtd</TableHead>
                                <TableHead className="text-right">Valor Investido</TableHead>
                                <TableHead className="text-right">Valor + Rentabilidade</TableHead>
                                <TableHead className="text-right">Rentabilidade %</TableHead>
                                <TableHead className="text-right">Rentabilidade R$</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {variableIncomeInvs.map((inv) => {
                                const qty = inv.quantity ?? 0;
                                const avgPrice = inv.averagePrice ?? 0;
                                const curPrice = inv.currentPrice ?? 0;
                                const totalCurrentValue = curPrice * qty;
                                const totalInvestedValue = avgPrice * qty;
                                const profitRs = totalCurrentValue - totalInvestedValue;
                                const profitPct = totalInvestedValue > 0 ? (profitRs / totalInvestedValue) * 100 : 0;

                                return (
                                    <TableRow key={inv.id}>
                                        <TableCell>
                                            <div className="font-semibold text-gray-900">{inv.name}</div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs text-gray-600">{inv.sector || "—"}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                                {inv.tickerCode || "—"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right text-gray-600 font-medium">
                                            {formatCurrency(avgPrice)}
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-gray-900">
                                            {formatCurrency(curPrice)}
                                        </TableCell>
                                        <TableCell className="text-right text-gray-600">
                                            {qty}
                                        </TableCell>
                                        <TableCell className="text-right text-gray-600 font-medium">
                                            {formatCurrency(totalInvestedValue)}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-gray-900">
                                            {formatCurrency(totalCurrentValue)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={`text-xs font-bold ${profitPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                                {profitPct > 0 ? "+" : ""}{formatPercent(profitPct)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={`font-semibold ${profitRs >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                                {profitRs > 0 ? "+" : ""}{formatCurrency(profitRs)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => handleEdit(inv)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50" onClick={() => handleDelete(inv.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* ── CRIPTOMOEDAS ── */}
            {cryptoInvs.length > 0 && (
                <div className="bg-white border rounded-lg overflow-x-auto">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-800">Criptomoedas</span>
                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                                {cryptoInvs.length} {cryptoInvs.length === 1 ? "ativo" : "ativos"}
                            </span>
                        </div>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/50">
                                <TableHead>Ativo</TableHead>
                                <TableHead>Rede/Detalhe</TableHead>
                                <TableHead>Código (ID)</TableHead>
                                <TableHead className="text-right">Preço Médio</TableHead>
                                <TableHead className="text-right">Preço Atual</TableHead>
                                <TableHead className="text-right">Qtd</TableHead>
                                <TableHead className="text-right">Valor Investido</TableHead>
                                <TableHead className="text-right">Valor + Rentabilidade</TableHead>
                                <TableHead className="text-right">Rentabilidade %</TableHead>
                                <TableHead className="text-right">Rentabilidade R$</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {cryptoInvs.map((inv) => {
                                const qty = inv.quantity ?? 0;
                                const avgPrice = inv.averagePrice ?? 0;
                                const curPrice = inv.currentPrice ?? 0;
                                const totalCurrentValue = curPrice * qty;
                                const totalInvestedValue = avgPrice * qty;
                                const profitRs = totalCurrentValue - totalInvestedValue;
                                const profitPct = totalInvestedValue > 0 ? (profitRs / totalInvestedValue) * 100 : 0;

                                return (
                                    <TableRow key={inv.id}>
                                        <TableCell>
                                            <div className="font-semibold text-gray-900">{inv.name}</div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs text-gray-600">{inv.sector || "—"}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs font-mono font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded">
                                                {inv.tickerCode || "—"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right text-gray-600 font-medium">
                                            {formatCurrency(avgPrice)}
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-gray-900">
                                            {formatCurrency(curPrice)}
                                        </TableCell>
                                        <TableCell className="text-right text-gray-600">
                                            {qty}
                                        </TableCell>
                                        <TableCell className="text-right text-gray-600 font-medium">
                                            {formatCurrency(totalInvestedValue)}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-gray-900">
                                            {formatCurrency(totalCurrentValue)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={`text-xs font-bold ${profitPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                                {profitPct > 0 ? "+" : ""}{formatPercent(profitPct)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={`font-semibold ${profitRs >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                                {profitRs > 0 ? "+" : ""}{formatCurrency(profitRs)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => handleEdit(inv)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50" onClick={() => handleDelete(inv.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* ── OUTROS (Fundos, etc.) ── */}
            {otherInvs.length > 0 && (
                <div className="bg-white border rounded-lg overflow-x-auto">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-800">Outros</span>
                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                                {otherInvs.length} {otherInvs.length === 1 ? "ativo" : "ativos"}
                            </span>
                        </div>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/50">
                                <TableHead>Ativo</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead className="text-right">Aportado</TableHead>
                                <TableHead className="text-right">Saldo Atual</TableHead>
                                <TableHead className="text-right">Rent. %</TableHead>
                                <TableHead className="text-right">Rent. R$</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {otherInvs.map((inv) => {
                                const profit = inv.currentValue - inv.investedAmount;
                                const profitPct = inv.investedAmount > 0 ? (profit / inv.investedAmount) * 100 : 0;
                                return (
                                    <TableRow key={inv.id}>
                                        <TableCell>
                                            <div className="font-semibold text-gray-900">{inv.name}</div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs text-gray-500">{TYPE_TRANSLATIONS[inv.type]}</span>
                                        </TableCell>
                                        <TableCell className="text-right text-gray-600 font-medium">
                                            {formatCurrency(inv.investedAmount)}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-gray-900">
                                            {formatCurrency(inv.currentValue)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={`text-xs font-bold ${profitPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                                {profitPct > 0 ? "+" : ""}{formatPercent(profitPct)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={`font-semibold ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                                {profit > 0 ? "+" : ""}{formatCurrency(profit)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => handleEdit(inv)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50" onClick={() => handleDelete(inv.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
