"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlusCircle, ArrowUpCircle, ArrowDownCircle, DollarSign, Clock, CheckCircle2, ChevronLeft, ChevronRight, TrendingUp, PiggyBank } from "lucide-react";
import { TransactionModal } from "@/components/TransactionModal";
import { ICONS_MAP } from "@/components/CreateCategoryModal";

// Intl formatter to BRL
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

// Formatting Date
const formatDate = (dateString: string) => {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateString));
};

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

type ApiTransaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  status: "PAID" | "PENDING" | "CANCELLED";
  category?: {
    name: string;
    color: string | null;
    icon?: string;
  };
};

type ApiAccount = {
  id: string;
  name: string;
  balance: number;
};

type ApiInvestment = {
  id: string;
  name: string;
  type: "FIXED_INCOME" | "VARIABLE_INCOME" | "CRYPTO" | "OTHER";
  investedAmount: number;
  currentValue: number;
  cdiPercentage?: number;
  investmentDate?: string;
  sector?: string;
  tickerCode?: string;
  averagePrice?: number;
  currentPrice?: number;
  quantity?: number;
  daysInvested?: number;
  grossValue?: number;
  taxAmount?: number;
  netValue?: number;
  irTaxRate?: number;
};

const formatPercent = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 2,
  }).format(value / 100);
};

export default function DashboardPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [investments, setInvestments] = useState<ApiInvestment[]>([]);
  const [cumulativePendingFromPriorMonths, setCumulativePendingFromPriorMonths] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const goToPrevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else { setSelectedMonth(m => m - 1); }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else { setSelectedMonth(m => m + 1); }
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [transRes, accRes, invRes] = await Promise.all([
          fetch(`http://localhost:3333/transactions?month=${selectedMonth}&year=${selectedYear}`),
          fetch("http://localhost:3333/accounts"),
          fetch("http://localhost:3333/investments"),
        ]);

        if (transRes.ok) setTransactions(await transRes.json());
        if (accRes.ok) setAccounts(await accRes.json());
        if (invRes.ok) setInvestments(await invRes.json());

        // For future months, fetch all intermediate months to compute cumulative projected balance
        const currentMonth = now.getMonth() + 1; // 1-indexed
        const currentYear = now.getFullYear();
        const selectedAbsolute = selectedYear * 12 + selectedMonth;
        const currentAbsolute = currentYear * 12 + currentMonth;

        if (selectedAbsolute > currentAbsolute) {
          // Fetch all months from current through selected (exclusive of selected since we already fetched it)
          const intermediatePromises: Promise<Response>[] = [];
          let m = currentMonth;
          let y = currentYear;
          while (y * 12 + m < selectedAbsolute) {
            intermediatePromises.push(
              fetch(`http://localhost:3333/transactions?month=${m}&year=${y}`)
            );
            m++;
            if (m > 12) { m = 1; y++; }
          }

          const intermediateResults = await Promise.all(intermediatePromises);
          let cumulativePending = 0;
          for (const res of intermediateResults) {
            if (res.ok) {
              const monthTrans: ApiTransaction[] = await res.json();
              const pendingIncome = monthTrans.filter(t => t.status === "PENDING" && t.type === "INCOME").reduce((acc, t) => acc + t.amount, 0);
              const pendingExpense = monthTrans.filter(t => t.status === "PENDING" && t.type === "EXPENSE").reduce((acc, t) => acc + t.amount, 0);
              cumulativePending += pendingIncome - pendingExpense;
            }
          }
          setCumulativePendingFromPriorMonths(cumulativePending);
        } else {
          setCumulativePendingFromPriorMonths(0);
        }
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [selectedMonth, selectedYear]);

  const totalIncome = transactions.filter((t) => t.type === "INCOME").reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "EXPENSE").reduce((acc, curr) => acc + curr.amount, 0);

  // Real balance is the sum of all bank accounts
  const balance = accounts.reduce((acc, curr) => acc + curr.balance, 0);

  // Pending transactions for the selected month
  const pendingThisMonth = transactions.filter((t) => t.status === "PENDING");

  const totalPendingIncome = pendingThisMonth.filter(t => t.type === "INCOME").reduce((acc, curr) => acc + curr.amount, 0);
  const totalPendingExpense = pendingThisMonth.filter(t => t.type === "EXPENSE").reduce((acc, curr) => acc + curr.amount, 0);


  const totalPending = pendingThisMonth.reduce((acc, t) => acc + t.amount, 0);

  // Investment stats per type
  const computeTypeStats = (invs: ApiInvestment[]) => {
    const invested = invs.reduce((acc, i) => acc + i.investedAmount, 0);
    const net = invs.reduce((acc, i) => {
      if (i.type === "VARIABLE_INCOME" || i.type === "CRYPTO") {
        const qty = i.quantity ?? 0;
        const curPrice = i.currentPrice ?? 0;
        return acc + curPrice * qty;
      }
      return acc + (i.netValue ?? i.currentValue);
    }, 0);
    const profit = net - invested;
    const pct = invested > 0 ? (profit / invested) * 100 : 0;
    return { invested, net, profit, pct };
  };

  const fixedIncomeInvs = investments.filter(i => i.type === "FIXED_INCOME");
  const variableIncomeInvs = investments.filter(i => i.type === "VARIABLE_INCOME");
  const cryptoInvs = investments.filter(i => i.type === "CRYPTO");

  const fixedStats = computeTypeStats(fixedIncomeInvs);
  const variableStats = computeTypeStats(variableIncomeInvs);
  const cryptoStats = computeTypeStats(cryptoInvs);
  const totalInvStats = computeTypeStats(investments);

  // Projected Balance logic considering pending scenarios + cumulative prior months + investments
  const projectedBalance = balance + totalInvStats.net + totalPendingIncome - totalPendingExpense + cumulativePendingFromPriorMonths;

  const invTypeCards = [
    { label: "CDB / Renda Fixa", stats: fixedStats, count: fixedIncomeInvs.length, color: "blue" },
    { label: "Renda Variável", stats: variableStats, count: variableIncomeInvs.length, color: "indigo" },
    { label: "Criptomoedas", stats: cryptoStats, count: cryptoInvs.length, color: "orange" },
  ].filter(c => c.count > 0);

  const toggleStatus = async (id: string, newStatus: "PAID" | "PENDING") => {
    try {
      const res = await fetch(`http://localhost:3333/transactions/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        // Full refresh of transactions and accounts to update all derived values
        const [transRes, accRes] = await Promise.all([
          fetch(`http://localhost:3333/transactions?month=${selectedMonth}&year=${selectedYear}`),
          fetch("http://localhost:3333/accounts"),
        ]);
        if (transRes.ok) setTransactions(await transRes.json());
        if (accRes.ok) setAccounts(await accRes.json());
      }
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h2>
          <div className="mt-2 flex items-center gap-2">
            <button onClick={goToPrevMonth} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors cursor-pointer">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <span className="text-base font-medium text-gray-700 min-w-[160px] text-center">
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </span>
            <button onClick={goToNextMonth} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors cursor-pointer">
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>
        <TransactionModal>
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nova Transação
          </Button>
        </TransactionModal>
      </div>

      {/* 1. Accounts Mini-Cards + Global Patrimony */}
      {accounts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Saldo por Conta</h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {accounts.map(acc => (
              <div key={acc.id} className="min-w-[200px] border rounded-lg p-4 bg-white shadow-sm flex flex-col justify-between">
                <span className="text-sm font-medium text-gray-600">{acc.name}</span>
                <span className="text-lg font-bold text-gray-900 mt-2">{formatCurrency(acc.balance)}</span>
              </div>
            ))}
            {investments.length > 0 && (
              <div className="min-w-[200px] border border-emerald-200 rounded-lg p-4 bg-emerald-50/50 shadow-sm flex flex-col justify-between">
                <span className="text-sm font-medium text-emerald-700">Investimentos</span>
                <span className="text-lg font-bold text-gray-900 mt-2">{formatCurrency(totalInvStats.net)}</span>
              </div>
            )}
            <div className="min-w-[220px] border-2 border-gray-300 rounded-lg p-4 bg-gray-50 shadow-sm flex flex-col justify-between">
              <span className="text-sm font-bold text-gray-700">Patrimônio Global</span>
              <span className="text-xl font-bold text-gray-900 mt-2">{formatCurrency(balance + totalInvStats.net)}</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Entradas</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalIncome)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Saídas</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalExpense)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Saldo Projetado</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${projectedBalance < 0 ? "text-red-600" : "text-gray-900"}`}>
              {formatCurrency(projectedBalance)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Saldo atual: <span className="font-semibold text-gray-700">{formatCurrency(balance + totalInvStats.net)}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Investments Summary */}
      {investments.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-gray-900">Meus Investimentos</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-sm font-semibold text-emerald-700">Patrimônio Total</CardTitle>
                  <span className="text-[10px] text-gray-500">{investments.length} {investments.length === 1 ? "ativo" : "ativos"}</span>
                </div>
                <PiggyBank className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-gray-900">{formatCurrency(totalInvStats.net)}</div>
                <div className={`text-xs mt-1 font-semibold ${totalInvStats.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {totalInvStats.profit > 0 ? "+" : ""}{formatCurrency(totalInvStats.profit)} ({totalInvStats.pct > 0 ? "+" : ""}{formatPercent(totalInvStats.pct)})
                </div>
              </CardContent>
            </Card>

            {invTypeCards.map(({ label, stats, count, color }) => {
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
                    <div className="text-lg font-bold text-gray-900">{formatCurrency(stats.net)}</div>
                    <div className={`text-xs mt-1 font-semibold ${profitColor}`}>
                      {stats.profit > 0 ? "+" : ""}{formatCurrency(stats.profit)} ({stats.pct > 0 ? "+" : ""}{formatPercent(stats.pct)})
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Pending Expenses + Pending Income (side by side) */}
      {pendingThisMonth.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Pending Expenses */}
          {pendingThisMonth.filter(t => t.type === "EXPENSE").length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-base font-semibold text-gray-900">
                    Despesas Pendentes
                  </CardTitle>
                </div>
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-sm">
                  {formatCurrency(totalPendingExpense)}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingThisMonth.filter(t => t.type === "EXPENSE").map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-4 py-3 transition-all hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleStatus(t.id, "PAID")}
                        className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-amber-400 text-amber-400 transition-colors hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer"
                        title="Marcar como pago"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{t.description}</p>
                        <p className="text-xs text-gray-500">{formatDate(t.date)}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-red-600">
                      -{formatCurrency(t.amount)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Pending Income */}
          {pendingThisMonth.filter(t => t.type === "INCOME").length > 0 && (
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-emerald-600" />
                  <CardTitle className="text-base font-semibold text-gray-900">
                    Receitas Pendentes
                  </CardTitle>
                </div>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-sm">
                  {formatCurrency(totalPendingIncome)}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingThisMonth.filter(t => t.type === "INCOME").map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border border-emerald-200 bg-white px-4 py-3 transition-all hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleStatus(t.id, "PAID")}
                        className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-emerald-400 text-emerald-400 transition-colors hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                        title="Marcar como recebido"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{t.description}</p>
                        <p className="text-xs text-gray-500">{formatDate(t.date)}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600">
                      +{formatCurrency(t.amount)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
      {/* Expenses and Income Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Expenses Table */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5 text-red-600" />
            <h3 className="text-base font-semibold text-gray-900">Despesas</h3>
          </div>
          <div className="rounded-md border bg-white overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow className="bg-red-50/50">
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.filter(t => t.type === "EXPENSE").map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium text-gray-600">{formatDate(transaction.date)}</TableCell>
                    <TableCell className="text-gray-900">{transaction.description}</TableCell>
                    <TableCell>
                      {transaction.category ? (
                        (() => {
                          const IconComponent = transaction.category.icon && ICONS_MAP[transaction.category.icon] ? ICONS_MAP[transaction.category.icon] : null;
                          return (
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold text-white shadow-sm border border-black/10 ${transaction.category.color || 'bg-slate-400'}`}>
                              {IconComponent && <IconComponent className="h-3.5 w-3.5" />}
                              <span>{transaction.category.name}</span>
                            </div>
                          );
                        })()
                      ) : (<span className="text-gray-400 text-sm">Sem categoria</span>)}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => toggleStatus(transaction.id, transaction.status === "PAID" ? "PENDING" : "PAID")}
                        className={`inline-flex items-center gap-1.5 min-w-[100px] min-h-[36px] px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer border active:scale-95 ${transaction.status === "PAID" ? "bg-emerald-100 text-emerald-800 border-emerald-200 hover:shadow-md hover:border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-200 hover:shadow-md hover:border-amber-300"}`}
                        title={transaction.status === "PAID" ? "Clique para marcar como pendente" : "Clique para marcar como pago"}
                      >
                        {transaction.status === "PAID" ? (<><CheckCircle2 className="h-4 w-4" /><span>Pago</span></>) : (<><Clock className="h-4 w-4" /><span>Pendente</span></>)}
                      </button>
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-600">-{formatCurrency(transaction.amount)}</TableCell>
                  </TableRow>
                ))}
                {transactions.filter(t => t.type === "EXPENSE").length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={5} className="h-20 text-center text-gray-500">Nenhuma despesa encontrada.</TableCell></TableRow>
                )}
                {isLoading && (
                  <TableRow><TableCell colSpan={5} className="h-20 text-center text-gray-500 animate-pulse">Carregando...</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Income Table */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-gray-900">Receitas</h3>
          </div>
          <div className="rounded-md border bg-white overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow className="bg-emerald-50/50">
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.filter(t => t.type === "INCOME").map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium text-gray-600">{formatDate(transaction.date)}</TableCell>
                    <TableCell className="text-gray-900">{transaction.description}</TableCell>
                    <TableCell>
                      {transaction.category ? (
                        (() => {
                          const IconComponent = transaction.category.icon && ICONS_MAP[transaction.category.icon] ? ICONS_MAP[transaction.category.icon] : null;
                          return (
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold text-white shadow-sm border border-black/10 ${transaction.category.color || 'bg-slate-400'}`}>
                              {IconComponent && <IconComponent className="h-3.5 w-3.5" />}
                              <span>{transaction.category.name}</span>
                            </div>
                          );
                        })()
                      ) : (<span className="text-gray-400 text-sm">Sem categoria</span>)}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => toggleStatus(transaction.id, transaction.status === "PAID" ? "PENDING" : "PAID")}
                        className={`inline-flex items-center gap-1.5 min-w-[100px] min-h-[36px] px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer border active:scale-95 ${transaction.status === "PAID" ? "bg-emerald-100 text-emerald-800 border-emerald-200 hover:shadow-md hover:border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-200 hover:shadow-md hover:border-amber-300"}`}
                        title={transaction.status === "PAID" ? "Clique para marcar como pendente" : "Clique para marcar como recebido"}
                      >
                        {transaction.status === "PAID" ? (<><CheckCircle2 className="h-4 w-4" /><span>Recebido</span></>) : (<><Clock className="h-4 w-4" /><span>Pendente</span></>)}
                      </button>
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-600">+{formatCurrency(transaction.amount)}</TableCell>
                  </TableRow>
                ))}
                {transactions.filter(t => t.type === "INCOME").length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={5} className="h-20 text-center text-gray-500">Nenhuma receita encontrada.</TableCell></TableRow>
                )}
                {isLoading && (
                  <TableRow><TableCell colSpan={5} className="h-20 text-center text-gray-500 animate-pulse">Carregando...</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
