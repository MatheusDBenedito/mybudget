"use client";

import { Money } from "@/components/Money";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Wallet, ChartPie } from "lucide-react";
import { PageHeader, MonthNavigator } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { TrendText } from "@/components/ui/trend";
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { API_BASE_URL } from "@/lib/auth";

interface Transaction {
    id: string;
    description: string;
    amount: number;
    date: string;
    type: "INCOME" | "EXPENSE";
    status: "PAID" | "PENDING";
    isFixed: boolean;
    accountId: string;
    categoryId: string | null;
    category: { id: string; name: string; color: string } | null;
}

type ApiInvestment = {
    id: string;
    name: string;
    type: "FIXED_INCOME" | "VARIABLE_INCOME" | "FII" | "CRYPTO" | "US_STOCK" | "OTHER";
    investedAmount: number;
    currentValue: number;
    currentPrice?: number;
    quantity?: number;
    netValue?: number;
};

const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type TooltipEntry = { name?: string; value?: number; color?: string };

const CHART_COLORS = [
    "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
    "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
    "#84cc16", "#e11d48", "#0ea5e9", "#d946ef", "#a3e635",
];

export default function RelatoriosPage() {
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [investments, setInvestments] = useState<ApiInvestment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // For annual comparison chart
    const [annualData, setAnnualData] = useState<
        { month: string; receitas: number; despesas: number }[]
    >([]);

    const goToPrevMonth = () => {
        if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear((y) => y - 1); }
        else { setSelectedMonth((m) => m - 1); }
    };

    const goToNextMonth = () => {
        if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear((y) => y + 1); }
        else { setSelectedMonth((m) => m + 1); }
    };

    // Fetch monthly transactions + investments
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [transRes, invRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/transactions?month=${selectedMonth}&year=${selectedYear}`),
                    fetch(`${API_BASE_URL}/investments`),
                ]);
                if (transRes.ok) setTransactions(await transRes.json());
                if (invRes.ok) setInvestments(await invRes.json());
            } catch (error) {
                console.error("Failed to load report data", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [selectedMonth, selectedYear]);

    // Fetch annual data for bar chart
    useEffect(() => {
        const fetchAnnual = async () => {
            try {
                const promises = Array.from({ length: 12 }, (_, i) =>
                    fetch(`${API_BASE_URL}/transactions?month=${i + 1}&year=${selectedYear}`)
                );
                const results = await Promise.all(promises);
                const data: { month: string; receitas: number; despesas: number }[] = [];
                for (let i = 0; i < 12; i++) {
                    if (results[i].ok) {
                        const monthTransactions: Transaction[] = await results[i].json();
                        const receitas = monthTransactions
                            .filter((t) => t.type === "INCOME" && t.status === "PAID")
                            .reduce((acc, t) => acc + t.amount, 0);
                        const despesas = monthTransactions
                            .filter((t) => t.type === "EXPENSE" && t.status === "PAID")
                            .reduce((acc, t) => acc + t.amount, 0);
                        data.push({ month: MONTHS[i].substring(0, 3), receitas, despesas });
                    } else {
                        data.push({ month: MONTHS[i].substring(0, 3), receitas: 0, despesas: 0 });
                    }
                }
                setAnnualData(data);
            } catch (error) {
                console.error("Failed to load annual data", error);
            }
        };
        fetchAnnual();
    }, [selectedYear]);

    // Calculations
    const paidExpenses = transactions.filter((t) => t.type === "EXPENSE" && t.status === "PAID");
    const pendingExpenses = transactions.filter((t) => t.type === "EXPENSE" && t.status === "PENDING");
    const paidIncome = transactions.filter((t) => t.type === "INCOME" && t.status === "PAID");
    const pendingIncome = transactions.filter((t) => t.type === "INCOME" && t.status === "PENDING");

    const totalPaidExpense = paidExpenses.reduce((acc, t) => acc + t.amount, 0);
    const totalPendingExpense = pendingExpenses.reduce((acc, t) => acc + t.amount, 0);
    const totalPaidIncome = paidIncome.reduce((acc, t) => acc + t.amount, 0);
    const totalPendingIncome = pendingIncome.reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = totalPaidExpense + totalPendingExpense;

    // Investment profit (net)
    const investmentProfit = investments.reduce((acc, inv) => {
        let netVal: number;
        if (inv.type === "VARIABLE_INCOME" || inv.type === "FII" || inv.type === "CRYPTO") {
            netVal = (inv.currentPrice ?? 0) * (inv.quantity ?? 0);
        } else {
            netVal = inv.netValue ?? inv.currentValue;
        }
        return acc + (netVal - inv.investedAmount);
    }, 0);

    const totalIncome = totalPaidIncome + totalPendingIncome;
    const totalIncomeWithInvestments = totalIncome + (investmentProfit > 0 ? investmentProfit : 0);
    const saldo = totalIncomeWithInvestments - totalExpense;

    // Category breakdown (expenses)
    const expenseByCategory = new Map<string, { name: string; color: string; total: number }>();
    transactions
        .filter((t) => t.type === "EXPENSE")
        .forEach((t) => {
            const catName = t.category?.name ?? "Sem categoria";
            const catColor = t.category?.color ?? "#9ca3af";
            const existing = expenseByCategory.get(catName);
            if (existing) {
                existing.total += t.amount;
            } else {
                expenseByCategory.set(catName, { name: catName, color: catColor, total: t.amount });
            }
        });

    const categoryData = Array.from(expenseByCategory.values()).sort((a, b) => b.total - a.total);
    const pieData = categoryData.map((c, idx) => ({
        name: c.name,
        value: c.total,
        color: CHART_COLORS[idx % CHART_COLORS.length],
    }));

    // Category breakdown (income)
    const incomeByCategory = new Map<string, { name: string; color: string; total: number }>();
    transactions
        .filter((t) => t.type === "INCOME")
        .forEach((t) => {
            const catName = t.category?.name ?? "Sem categoria";
            const catColor = t.category?.color ?? "#9ca3af";
            const existing = incomeByCategory.get(catName);
            if (existing) {
                existing.total += t.amount;
            } else {
                incomeByCategory.set(catName, { name: catName, color: catColor, total: t.amount });
            }
        });

    // Add investment profit to income category breakdown
    if (investmentProfit > 0) {
        incomeByCategory.set("Rentabilidade Líquida", {
            name: "Rentabilidade Líquida",
            color: "#8b5cf6",
            total: investmentProfit,
        });
    }

    const incomeCategoryData = Array.from(incomeByCategory.values()).sort((a, b) => b.total - a.total);
    const incomePieData = incomeCategoryData.map((c, idx) => ({
        name: c.name,
        value: c.total,
        color: CHART_COLORS[idx % CHART_COLORS.length],
    }));

    // Top expenses
    const topExpenses = [...transactions]
        .filter((t) => t.type === "EXPENSE")
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

    // Fixed vs Variable expenses
    const fixedExpenses = transactions
        .filter((t) => t.type === "EXPENSE" && t.isFixed)
        .reduce((acc, t) => acc + t.amount, 0);
    const variableExpenses = totalExpense - fixedExpenses;

    const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) => {
        if (active && payload && payload.length) {
            const entry = payload[0];
            const value = entry.value ?? 0;
            return (
                <div className="bg-white shadow-lg rounded-lg border p-3">
                    <p className="text-sm font-medium text-gray-900">{entry.name}</p>
                    <p className="text-sm text-gray-600"><Money value={value} /></p>
                    {totalExpense > 0 && (
                        <p className="text-xs text-gray-400">
                            {((value / totalExpense) * 100).toFixed(1)}%
                        </p>
                    )}
                </div>
            );
        }
        return null;
    };

    const BarTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string | number }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white shadow-lg rounded-lg border p-3">
                    <p className="text-sm font-semibold text-gray-900 mb-1">{label}</p>
                    {payload.map((entry, idx) => (
                        <p key={idx} className="text-sm" style={{ color: entry.color }}>
                            {entry.name}: <Money value={entry.value ?? 0} />
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Relatórios"
                actions={<MonthNavigator month={selectedMonth} year={selectedYear} onPrev={goToPrevMonth} onNext={goToNextMonth} />}
            />

            {isLoading ? (
                <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground animate-pulse">
                    Carregando relatórios...
                </div>
            ) : (
                <>
                    {/* Summary KPIs */}
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard title="Total de receitas" icon={TrendingUp} info="Receitas do mês somadas ao lucro líquido dos investimentos, quando positivo.">
                            <div className="text-xl font-medium tabular-nums text-positive"><Money value={totalIncomeWithInvestments} /></div>
                            <dl className="mt-3 space-y-0.5 text-sm">
                                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Recebido</dt><dd className="tabular-nums"><Money value={totalPaidIncome} /></dd></div>
                                {totalPendingIncome > 0 && (
                                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Pendente</dt><dd className="tabular-nums"><Money value={totalPendingIncome} /></dd></div>
                                )}
                                {investmentProfit > 0 && (
                                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Investimentos</dt><dd className="tabular-nums"><Money value={investmentProfit} /></dd></div>
                                )}
                            </dl>
                        </StatCard>

                        <StatCard title="Total de despesas" icon={TrendingDown}>
                            <div className="text-xl font-medium tabular-nums text-negative"><Money value={totalExpense} /></div>
                            <dl className="mt-3 space-y-0.5 text-sm">
                                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Pago</dt><dd className="tabular-nums"><Money value={totalPaidExpense} /></dd></div>
                                {totalPendingExpense > 0 && (
                                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Pendente</dt><dd className="tabular-nums"><Money value={totalPendingExpense} /></dd></div>
                                )}
                            </dl>
                        </StatCard>

                        <StatCard title="Saldo do mês" icon={Wallet} info="Receitas menos despesas do mês selecionado.">
                            <TrendText value={saldo} label={<Money value={saldo} />} className="text-xl" />
                            <p className="mt-3 text-sm text-muted-foreground">Receitas − Despesas</p>
                        </StatCard>

                        <StatCard title="Fixas vs variáveis" icon={ChartPie}>
                            <dl className="space-y-0.5 text-sm">
                                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Fixas</dt><dd className="font-medium tabular-nums"><Money value={fixedExpenses} /></dd></div>
                                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Variáveis</dt><dd className="font-medium tabular-nums"><Money value={variableExpenses} /></dd></div>
                            </dl>
                            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label="Proporção entre despesas fixas e variáveis">
                                <div className="bg-foreground" style={{ width: `${totalExpense > 0 ? (fixedExpenses / totalExpense) * 100 : 0}%` }} />
                                <div className="bg-muted-foreground/40" style={{ width: `${totalExpense > 0 ? (variableExpenses / totalExpense) * 100 : 0}%` }} />
                            </div>
                        </StatCard>
                    </div>

                    {/* Charts Row: Category Pie + Income Pie */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Expense by Category Pie */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-[15px] font-medium">
                                    Despesas por Categoria
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {pieData.length > 0 ? (
                                    <div className="flex flex-col lg:flex-row items-center gap-4">
                                        <ResponsiveContainer width="100%" height={280}>
                                            <PieChart>
                                                <Pie
                                                    data={pieData}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={100}
                                                    innerRadius={50}
                                                    paddingAngle={2}
                                                    stroke="none"
                                                >
                                                    {pieData.map((entry, idx) => (
                                                        <Cell key={idx} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<CustomTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="space-y-2 w-full lg:w-auto">
                                            {categoryData.map((cat, idx) => (
                                                <div key={cat.name} className="flex items-center justify-between gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-3 h-3 rounded-full flex-shrink-0"
                                                            style={{
                                                                backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                                                            }}
                                                        />
                                                        <span className="text-sm text-gray-700 whitespace-nowrap">{cat.name}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-sm font-semibold text-gray-900">
                                                            <Money value={cat.total} />
                                                        </span>
                                                        <span className="text-xs text-gray-400 ml-2">
                                                            {totalExpense > 0
                                                                ? `${((cat.total / totalExpense) * 100).toFixed(1)}%`
                                                                : "0%"}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-center text-gray-500 py-8">Nenhuma despesa encontrada.</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Income by Category Pie */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-[15px] font-medium">
                                    Receitas por Categoria
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {incomePieData.length > 0 ? (
                                    <div className="flex flex-col lg:flex-row items-center gap-4">
                                        <ResponsiveContainer width="100%" height={280}>
                                            <PieChart>
                                                <Pie
                                                    data={incomePieData}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={100}
                                                    innerRadius={50}
                                                    paddingAngle={2}
                                                    stroke="none"
                                                >
                                                    {incomePieData.map((entry, idx) => (
                                                        <Cell key={idx} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<CustomTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="space-y-2 w-full lg:w-auto">
                                            {incomeCategoryData.map((cat, idx) => (
                                                <div key={cat.name} className="flex items-center justify-between gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-3 h-3 rounded-full flex-shrink-0"
                                                            style={{
                                                                backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                                                            }}
                                                        />
                                                        <span className="text-sm text-gray-700 whitespace-nowrap">{cat.name}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-sm font-semibold text-gray-900">
                                                            <Money value={cat.total} />
                                                        </span>
                                                        <span className="text-xs text-gray-400 ml-2">
                                                            {totalIncomeWithInvestments > 0
                                                                ? `${((cat.total / totalIncomeWithInvestments) * 100).toFixed(1)}%`
                                                                : "0%"}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-center text-gray-500 py-8">Nenhuma receita encontrada.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Annual Bar Chart */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-[15px] font-medium">
                                Receitas vs Despesas — {selectedYear}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {annualData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={320}>
                                    <BarChart data={annualData} barCategoryGap="20%">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6b7280" }} />
                                        <YAxis
                                            tick={{ fontSize: 12, fill: "#6b7280" }}
                                            tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                                        />
                                        <Tooltip content={<BarTooltip />} />
                                        <Legend
                                            wrapperStyle={{ fontSize: 13 }}
                                            formatter={(value) => (
                                                <span className="text-gray-700">{value}</span>
                                            )}
                                        />
                                        <Bar dataKey="receitas" name="Receitas" fill="#12b886" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="despesas" name="Despesas" fill="#f0476a" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-center text-gray-500 py-8">Carregando dados anuais...</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Top Expenses + Category Ranking Table */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Top 5 Expenses */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-[15px] font-medium">
                                    Top 5 Maiores Despesas
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {topExpenses.length > 0 ? (
                                    topExpenses.map((t, idx) => (
                                        <div
                                            key={t.id}
                                            className="flex items-center justify-between rounded-lg border px-4 py-3 bg-white"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg font-bold text-gray-300 w-6 text-center">
                                                    {idx + 1}
                                                </span>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{t.description}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {t.category && (
                                                            <Badge
                                                                variant="secondary"
                                                                className="text-[10px] px-1.5 py-0"
                                                                style={{
                                                                    backgroundColor: `${t.category.color}20`,
                                                                    color: t.category.color,
                                                                }}
                                                            >
                                                                {t.category.name}
                                                            </Badge>
                                                        )}
                                                        <span className="text-xs text-gray-400">
                                                            {new Date(t.date).toLocaleDateString("pt-BR")}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-sm font-medium text-negative tabular-nums">
                                                -<Money value={t.amount} />
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-gray-500 py-4">Nenhuma despesa encontrada.</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Category Ranking */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-[15px] font-medium">
                                    Ranking de Categorias (Despesas)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {categoryData.length > 0 ? (
                                    categoryData.map((cat, idx) => {
                                        const percentage = totalExpense > 0 ? (cat.total / totalExpense) * 100 : 0;
                                        return (
                                            <div key={cat.name} className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-3 h-3 rounded-full flex-shrink-0"
                                                            style={{
                                                                backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                                                            }}
                                                        />
                                                        <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                                                    </div>
                                                    <span className="text-sm font-semibold text-gray-900">
                                                        <Money value={cat.total} />
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-2">
                                                    <div
                                                        className="h-2 rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${percentage}%`,
                                                            backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                                                        }}
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-400 text-right">
                                                    {percentage.toFixed(1)}% do total
                                                </p>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-center text-gray-500 py-4">Nenhuma despesa por categoria.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
