"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Plus, ArrowRight, ChartColumn, ChartPie, Check, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionModal } from "@/components/TransactionModal";
import { Panel } from "@/components/Panel";
import { PageHeader, MonthNavigator } from "@/components/PageHeader";
import { IncomeVsExpensesChart } from "@/components/cash-flow/IncomeVsExpensesChart";
import { DonutChart, type DonutSlice } from "@/components/dashboard/DonutChart";
import { ForecastCard } from "@/components/dashboard/ForecastCard";
import { BillsCard } from "@/components/dashboard/BillsCard";
import { CardsCard, type DashCreditCard } from "@/components/dashboard/CardsCard";
import { MoneyWhereCard, type DashAccount } from "@/components/dashboard/MoneyWhereCard";
import { SpendingCard, type CategorySpend } from "@/components/dashboard/SpendingCard";
import { type ApiInvestment, INVESTMENT_CLASSES, CLASS_ORDER, currentValueOf } from "@/lib/investments";
import { CHART_PALETTE } from "@/lib/charts";
import type { CashFlowData } from "@/lib/cash-flow";
import { billsByDay, budgetBreakdown, defaultBillDay } from "@/lib/dashboard";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { useDashboardLayout } from "@/components/dashboard/useDashboardLayout";
import type { DashboardBlockId } from "@/lib/dashboard-layout";

type ApiTransaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  status: "PAID" | "PENDING" | "CANCELLED";
};

type ApiCategory = { id: string; name: string; icon?: string | null };
type ExpenseByCategory = { category: string; color: string | null; total: number };

const API = "http://localhost:3333";
const linkPill = "inline-flex h-8 items-center gap-1.5 rounded-full border px-4 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

export default function DashboardPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [year, setYear] = useState(now.getFullYear());
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [accounts, setAccounts] = useState<DashAccount[]>([]);
  const [investments, setInvestments] = useState<ApiInvestment[]>([]);
  const [cards, setCards] = useState<DashCreditCard[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<ExpenseByCategory[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowData | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const {
    layout,
    editing,
    setEditing,
    move,
    reorder,
    resize,
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
        const res = await fetch(`${API}${path}`);
        if (res.ok && !cancelled) set(await res.json());
      } catch (error) {
        console.error(`Failed to load ${path}`, error);
      }
    };
    void Promise.all([
      get(`/transactions?month=${month}&year=${year}`, setTransactions),
      get(`/reports/expenses-by-category?month=${month}&year=${year}`, setExpensesByCategory),
      get(`/cash-flow?month=${month}&year=${year}&months=12`, setCashFlow),
      get("/accounts", setAccounts),
      get("/investments", setInvestments),
      get("/credit-cards", setCards),
      get("/categories", setCategories),
    ]);
    return () => { cancelled = true; };
  }, [month, year, reloadKey]);

  const monthRef = { year, month };
  const breakdown = useMemo(() => (cashFlow ? budgetBreakdown(cashFlow) : null), [cashFlow]);
  const projectedBalance = cashFlow?.summary.projectedBalance[0] ?? null;
  const days = useMemo(() => billsByDay(transactions, cards, cashFlow, { year, month }), [transactions, cards, cashFlow, year, month]);
  const investmentsTotal = investments.reduce((acc, i) => acc + currentValueOf(i), 0);

  // Favorite card first, so the card on the summary is the one marked on the cards page
  const orderedCards = useMemo(
    () => [...cards].sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary)),
    [cards],
  );

  const spending: CategorySpend[] = expensesByCategory.map(c => ({
    ...c,
    icon: categories.find(cat => cat.name === c.category)?.icon ?? null,
  }));

  const investmentSlices: DonutSlice[] = CLASS_ORDER.map((key, i) => ({
    name: INVESTMENT_CLASSES[key].title,
    value: investments.filter(inv => inv.type === key).reduce((acc, inv) => acc + currentValueOf(inv), 0),
    color: CHART_PALETTE[i],
  }));

  // One entry per configurable block; the grid decides order and width
  const widgets: Record<DashboardBlockId, ReactNode> = {
    forecast: <ForecastCard breakdown={breakdown} projectedBalance={projectedBalance} />,
    bills: <BillsCard days={days} defaultDay={defaultBillDay(days, monthRef)} month={monthRef} />,
    moneywhere: <MoneyWhereCard accounts={accounts} investments={investmentsTotal} />,
    cards: <CardsCard key={`${year}-${month}`} cards={orderedCards} data={cashFlow} />,
    spending: <SpendingCard categories={spending} income={breakdown?.income ?? 0} />,
    "cashflow-chart": (
      <Panel
        title="Recebimentos x Despesas — próximos 12 meses"
        icon={ChartColumn}
        className="rounded-2xl"
        actions={<Link href="/fluxo-de-caixa" className={linkPill}>Ver fluxo de caixa <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
      >
        {cashFlow ? <IncomeVsExpensesChart data={cashFlow} /> : <div className="h-[300px] animate-pulse rounded-md bg-muted" />}
      </Panel>
    ),
    "investments-chart": (
      <Panel
        title="Investimentos"
        icon={ChartPie}
        className="rounded-2xl"
        actions={<Link href="/investimentos" className={linkPill}>Ver carteira <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
      >
        <DonutChart stacked data={investmentSlices} centerLabel="investido hoje" emptyMessage="Nenhum investimento cadastrado." ariaLabel="Distribuição dos investimentos por categoria" />
      </Panel>
    ),
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Resumo"
        actions={
          <>
            <MonthNavigator month={month} year={year} onPrev={goToPrevMonth} onNext={goToNextMonth} />
            {editing ? (
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
            )}
            <TransactionModal onSuccess={() => setReloadKey(k => k + 1)}>
              <Button>
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </TransactionModal>
          </>
        }
      />

      {editing && (
        <p className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Arraste pela alça, use as setas para ordenar e os botões 1/3 · 1/2 · 2/3 · 100% para redimensionar.
          As alterações são salvas automaticamente.
        </p>
      )}

      <DashboardGrid
        layout={layout}
        editing={editing}
        onMove={move}
        onReorder={reorder}
        onResize={resize}
        renderWidget={(id) => widgets[id]}
      />
    </div>
  );
}
