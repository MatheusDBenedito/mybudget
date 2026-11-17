"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Plus, ArrowRight, ChartColumn, ChartPie, Check, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { TransactionModal } from "@/components/TransactionModal";
import { Panel } from "@/components/Panel";
import { PageHeader, MonthNavigator } from "@/components/PageHeader";
import { IncomeVsExpensesChart } from "@/components/cash-flow/IncomeVsExpensesChart";
import { DonutChart, type DonutSlice } from "@/components/dashboard/DonutChart";
import { BillsCard } from "@/components/dashboard/BillsCard";
import { CardsCard, type DashCreditCard } from "@/components/dashboard/CardsCard";
import { MoneyWhereCard, type DashAccount } from "@/components/dashboard/MoneyWhereCard";
import { YieldsProjectionCard, type InvestmentsProjectionData } from "@/components/dashboard/YieldsProjectionCard";
import { InvestmentsDailyGainChart } from "@/components/investments/InvestmentsDailyGainChart";
import { InvestmentsBenchmarkChart } from "@/components/investments/InvestmentsBenchmarkChart";
import { VariableIncomeComparisonCard } from "@/components/investments/VariableIncomeComparisonCard";
import type { AnalyticsRange, InvestmentsAnalyticsResponse } from "@/components/investments/analytics-types";
import { type ApiInvestmentDividend, enrichDividendsWithStatus } from "@/lib/investments-dividends";
import { type ApiInvestment, INVESTMENT_CLASSES, CLASS_ORDER, currentValueOf, grossValueOf, taxAmountOf } from "@/lib/investments";
import { CHART_PALETTE } from "@/lib/charts";
import type { CashFlowData } from "@/lib/cash-flow";
import { billsByDay, defaultBillDay } from "@/lib/dashboard";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { useDashboardLayout } from "@/components/dashboard/useDashboardLayout";
import type { DashboardBlockId, DashboardLayoutItem } from "@/lib/dashboard-layout";
import { API_BASE_URL } from "@/lib/auth";

type ApiTransaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  status: "PAID" | "PENDING" | "CANCELLED";
};


const linkPill = "inline-flex h-8 items-center gap-1.5 rounded-full border px-4 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

export default function DashboardPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [year, setYear] = useState(now.getFullYear());
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [accounts, setAccounts] = useState<DashAccount[]>([]);
  const [investments, setInvestments] = useState<ApiInvestment[]>([]);
  const [cards, setCards] = useState<DashCreditCard[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowData | null>(null);
  const [projections, setProjections] = useState<InvestmentsProjectionData | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>("90d");
  const [analytics, setAnalytics] = useState<InvestmentsAnalyticsResponse | null>(null);
  const analyticsLoading = analytics === null || analytics.range !== analyticsRange;
  const [dividends, setDividends] = useState<ApiInvestmentDividend[]>([]);
  const [contributedAmount, setContributedAmount] = useState<number>(11038.42);
  const [reloadKey, setReloadKey] = useState(0);
  const { hasPermission, hasAnyPermission } = useAuth();
  const canEditResumo = hasPermission("edit:resumo_layout");
  const canCreateTx = hasAnyPermission(["create:despesa", "create:receita"]);
  const {
    layout,
    editing,
    setEditing,
    reorder,
    resizeBlock,
    reset,
    finishEditing,
  } = useDashboardLayout();

  const goToPrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const goToNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  useEffect(() => {
    let cancelled = false;
    const get = async <T,>(path: string, set: (v: T) => void) => {
      try {
        const res = await fetch(`${API_BASE_URL}${path}`);
        if (res.ok && !cancelled) set(await res.json());
      } catch (error) {
        console.error(`Failed to load ${path}`, error);
      }
    };
    void Promise.all([
      get(`/transactions?month=${month}&year=${year}`, setTransactions),
      get(`/cash-flow?month=${month}&year=${year}&months=12`, setCashFlow),
      get(`/investments/projections?month=${month}&year=${year}&months=12`, setProjections),
      get("/accounts", setAccounts),
      get("/investments", setInvestments),
      get("/credit-cards", setCards),
      get<{ dividends: ApiInvestmentDividend[] }>("/investments/dividends", d => setDividends(d.dividends ?? [])),
      get<{ variableIncomeContributedAmount: number | null }>("/investments/settings", s => {
        if (s?.variableIncomeContributedAmount != null) setContributedAmount(s.variableIncomeContributedAmount);
      }),
    ]);
    return () => { cancelled = true; };
  }, [month, year, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/investments/analytics?range=${analyticsRange}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (data && !cancelled) setAnalytics(data); })
      .catch(err => console.error("Failed to load analytics", err));
    return () => { cancelled = true; };
  }, [analyticsRange, reloadKey]);

  const receivedDividendsBrl = useMemo(
    () => enrichDividendsWithStatus(dividends).filter(d => d.status === "PAID").reduce((acc, d) => acc + d.totalBrl, 0),
    [dividends],
  );

  const monthRef = { year, month };
  const days = useMemo(() => billsByDay(transactions, cards, cashFlow, { year, month }), [transactions, cards, cashFlow, year, month]);
  const investmentsGross = investments.reduce((acc, i) => acc + grossValueOf(i), 0);
  const investmentsTax = investments.reduce((acc, i) => acc + taxAmountOf(i), 0);

  // Favorite card first, so the card on the summary is the one marked on the cards page
  const orderedCards = useMemo(
    () => [...cards].sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary)),
    [cards],
  );


  const investmentSlices: DonutSlice[] = CLASS_ORDER.map((key, i) => ({
    name: INVESTMENT_CLASSES[key].title,
    value: investments.filter(inv => inv.type === key).reduce((acc, inv) => acc + currentValueOf(inv), 0),
    color: CHART_PALETTE[i],
  }));

  // One entry per configurable block; the grid decides order, width and height
  const renderWidget = (id: DashboardBlockId, item: DashboardLayoutItem): ReactNode => {
    switch (id) {
      case "bills":
        return <BillsCard days={days} defaultDay={defaultBillDay(days, monthRef)} month={monthRef} height={item.height} />;
      case "moneywhere":
        return <MoneyWhereCard accounts={accounts} investments={investmentsGross} investmentsTax={investmentsTax} height={item.height} />;
      case "cards":
        return <CardsCard key={`${year}-${month}`} cards={orderedCards} data={cashFlow} height={item.height} />;
      case "yields-projection":
        return <YieldsProjectionCard projection={projections} height={item.height} />;
      case "investments-daily-gain":
        return <InvestmentsDailyGainChart data={analytics} range={analyticsRange} onRangeChange={setAnalyticsRange} isLoading={analyticsLoading} height={item.height} className="h-full rounded-2xl" />;
      case "investments-benchmarks":
        return <InvestmentsBenchmarkChart data={analytics} range={analyticsRange} onRangeChange={setAnalyticsRange} isLoading={analyticsLoading} height={item.height} className="h-full rounded-2xl" />;
      case "variable-income-comparison":
        return <VariableIncomeComparisonCard investments={investments} receivedDividendsBrl={receivedDividendsBrl} contributedAmount={contributedAmount} onContributedAmountSaved={setContributedAmount} height={item.height} className="h-full rounded-2xl" />;
      case "cashflow-chart":
        return (
          <Panel
            title="Recebimentos x Despesas — próximos 12 meses"
            icon={ChartColumn}
            className="h-full rounded-2xl"
            actions={<Link href="/fluxo-de-caixa" className={linkPill}>Ver fluxo de caixa <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
          >
            {cashFlow ? <IncomeVsExpensesChart data={cashFlow} /> : <div className="h-full min-h-[180px] animate-pulse rounded-md bg-muted" />}
          </Panel>
        );
      case "investments-chart":
        return (
          <Panel
            title="Investimentos"
            icon={ChartPie}
            className="h-full rounded-2xl"
            actions={<Link href="/investimentos" className={linkPill}>Ver carteira <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
          >
            <DonutChart
              stacked={item.width < 50}
              height={item.height}
              data={investmentSlices}
              centerLabel="investido hoje"
              emptyMessage="Nenhum investimento cadastrado."
              ariaLabel="Distribuição dos investimentos por categoria"
            />
          </Panel>
        );
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Resumo"
        actions={
          <>
            <MonthNavigator month={month} year={year} onPrev={goToPrevMonth} onNext={goToNextMonth} />
            {canEditResumo && (editing ? (
              <>
                <Button
                  variant="outline"
                  className="bg-card"
                  onClick={() => {
                    if (window.confirm("Restaurar o layout padrão do Resumo?")) reset();
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Restaurar
                </Button>
                <Button onClick={finishEditing}>
                  <Check className="h-4 w-4" />
                  Concluir
                </Button>
              </>
            ) : (
              <Button variant="outline" className="bg-card" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
                Personalizar
              </Button>
            ))}
            {canCreateTx && (
              <TransactionModal onSuccess={() => setReloadKey(k => k + 1)}>
                <Button>
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </TransactionModal>
            )}
          </>
        }
      />

      {editing && (
        <p className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Arraste qualquer card para mudar de posição e passe o mouse no contorno direito, inferior ou canto para redimensionar livremente.
          As alterações são salvas automaticamente.
        </p>
      )}

      <DashboardGrid
        layout={layout}
        editing={editing}
        onReorder={reorder}
        onResizeBlock={resizeBlock}
        renderWidget={renderWidget}
      />
    </div>
  );
}
