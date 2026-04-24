"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    TrendingDown,
    Wallet,
    ArrowUpCircle,
    ArrowDownCircle,
} from "lucide-react";
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
    type: "FIXED_INCOME" | "VARIABLE_INCOME" | "CRYPTO" | "OTHER";
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

const CHART_COLORS = [
    "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
    "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
    "#84cc16", "#e11d48", "#0ea5e9", "#d946ef", "#a3e635",
];

const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
                    fetch(`http://localhost:3333/transactions?month=${selectedMonth}&year=${selectedYear}`),
                    fetch("http://localhost:3333/investments"),
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
                    fetch(`http://localhost:3333/transactions?month=${i + 1}&year=${selectedYear}`)
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
        if (inv.type === "VARIABLE_INCOME" || inv.type === "CRYPTO") {
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

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white shadow-lg rounded-lg border p-3">
                    <p className="text-sm font-medium text-gray-900">{payload[0].name}</p>
                    <p className="text-sm text-gray-600">{formatCurrency(payload[0].value)}</p>
                    {totalExpense > 0 && (
                        <p className="text-xs text-gray-400">
                            {((payload[0].value / totalExpense) * 100).toFixed(1)}%
                        </p>
                    )}
                </div>
            );
        }
        return null;
    };

    const BarTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white shadow-lg rounded-lg border p-3">
                    <p className="text-sm font-semibold text-gray-900 mb-1">{label}</p>
                    {payload.map((entry: any, idx: number) => (
                        <p key={idx} className="text-sm" style={{ color: entry.color }}>
                            {entry.name}: {formatCurrency(entry.value)}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Relatórios</h1>
                    <div className="flex items-center gap-3 mt-2">
                        <button onClick={goToPrevMonth} className="p-1 hover:bg-gray-200 rounded cursor-pointer">
                            <ChevronLeft className="h-5 w-5 text-gray-600" />
                        </button>
                        <span className="text-lg font-medium text-gray-700 min-w-[160px] text-center">
                            {MONTHS[selectedMonth - 1]} {selectedYear}
                        </span>
                        <button onClick={goToNextMonth} className="p-1 hover:bg-gray-200 rounded cursor-pointer">
                            <ChevronRight className="h-5 w-5 text-gray-600" />
                        </button>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <p className="text-gray-500 animate-pulse text-lg">Carregando relatórios...</p>
                </div>
            ) : (
                <>
                    {/* Summary KPIs */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card className="border-emerald-200 bg-emerald-50/50">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-emerald-700">Total Receitas</CardTitle>
                                <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalIncomeWithInvestments)}</div>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    <span className="text-xs text-emerald-600">Recebido: {formatCurrency(totalPaidIncome)}</span>
                                    {totalPendingIncome > 0 && (
                                        <span className="text-xs text-amber-600">Pendente: {formatCurrency(totalPendingIncome)}</span>
                                    )}
                                    {investmentProfit > 0 && (
                                        <span className="text-xs text-purple-600">Invest.: {formatCurrency(investmentProfit)}</span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-red-200 bg-red-50/50">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-red-700">Total Despesas</CardTitle>
                                <ArrowDownCircle className="h-4 w-4 text-red-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalExpense)}</div>
                                <div className="flex gap-2 mt-1">
                                    <span className="text-xs text-red-600">Pago: {formatCurrency(totalPaidExpense)}</span>
                                    {totalPendingExpense > 0 && (
                                        <span className="text-xs text-amber-600">Pendente: {formatCurrency(totalPendingExpense)}</span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className={`${saldo >= 0 ? "border-blue-200 bg-blue-50/50" : "border-red-200 bg-red-50/50"}`}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className={`text-sm font-medium ${saldo >= 0 ? "text-blue-700" : "text-red-700"}`}>
                                    Saldo do Mês
                                </CardTitle>
                                <Wallet className={`h-4 w-4 ${saldo >= 0 ? "text-blue-600" : "text-red-600"}`} />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                    {formatCurrency(saldo)}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Receitas - Despesas</p>
                            </CardContent>
                        </Card>

                        <Card className="border-purple-200 bg-purple-50/50">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-purple-700">Fixo vs Variável</CardTitle>
                                {fixedExpenses >= variableExpenses ? (
                                    <TrendingDown className="h-4 w-4 text-purple-600" />
                                ) : (
                                    <TrendingUp className="h-4 w-4 text-purple-600" />
                                )}
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm font-bold text-gray-900">
                                    <span className="text-purple-600">{formatCurrency(fixedExpenses)}</span>
                                    <span className="text-gray-400 mx-1">/</span>
                                    <span className="text-indigo-600">{formatCurrency(variableExpenses)}</span>
                                </div>
                                <div className="flex gap-2 mt-1">
                                    <span className="text-xs text-purple-600">Fixas</span>
                                    <span className="text-xs text-gray-400">/</span>
                                    <span className="text-xs text-indigo-600">Variáveis</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Row: Category Pie + Income Pie */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Expense by Category Pie */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base font-semibold text-gray-900">
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
                                                            {formatCurrency(cat.total)}
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
                                <CardTitle className="text-base font-semibold text-gray-900">
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
                                                            {formatCurrency(cat.total)}
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
                            <CardTitle className="text-base font-semibold text-gray-900">
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
                                        <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
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
                                <CardTitle className="text-base font-semibold text-gray-900">
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
                                            <span className="text-sm font-bold text-red-600">
                                                -{formatCurrency(t.amount)}
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
                                <CardTitle className="text-base font-semibold text-gray-900">
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
                                                        {formatCurrency(cat.total)}
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
