"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Calculator,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileUp,
  Home,
  Pencil,
  Percent,
  PiggyBank,
  Plus,
  Scale,
  Trash2,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Panel } from "@/components/Panel";
import { Money } from "@/components/Money";
import { API_BASE_URL } from "@/lib/auth";
import {
  type AmortizationSimulationResult,
  type AmortizeVsInvestResult,
  type ExtraAmortizationSource,
  type ExtraAmortizationStrategy,
  type FinancingDashboardSummary,
  type FinancingRecord,
  type FixedExpenseOption,
  type InvestmentBenchmarkType,
  formatMonthsAsYearsAndMonths,
} from "@/lib/financings";
import { FinancingFormModal } from "@/components/financings/FinancingFormModal";
import { FinancingImportModal } from "@/components/financings/FinancingImportModal";
import { FinancingInsuranceCard } from "@/components/financings/FinancingInsuranceCard";
import { BuyVsRentPanel } from "@/components/financings/BuyVsRentPanel";
import {
  AmortizeVsInvestChart,
  BalanceCurveChart,
  PaymentEvolutionChart,
  TrImpactChart,
} from "@/components/financings/FinancingCharts";

type ActiveTab = "reports" | "simulator" | "rentVsBuy" | "installments" | "fgts";

export default function FinanciamentosPage() {
  const [financings, setFinancings] = useState<FinancingRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<FinancingDashboardSummary | null>(null);
  const [fixedOptions, setFixedOptions] = useState<FixedExpenseOption[]>([]);
  const [savingLink, setSavingLink] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("reports");

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancingRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Simulator & Amortize vs Invest state
  const [extraAmount, setExtraAmount] = useState("20000");
  const [monthlyExtra, setMonthlyExtra] = useState("500");
  const [cdiAnnualRatePct, setCdiAnnualRatePct] = useState("14.65");
  const [cdiPercentage, setCdiPercentage] = useState("100");
  const [investmentType, setInvestmentType] =
    useState<InvestmentBenchmarkType>("CDB");
  const [customAnnualRatePct, setCustomAnnualRatePct] = useState("12");
  const [horizonMonths, setHorizonMonths] = useState("36");
  const [simResult, setSimResult] = useState<{
    simulation: AmortizationSimulationResult;
    comparison: AmortizeVsInvestResult;
  } | null>(null);
  const [simulating, setSimulating] = useState(false);

  // Installment filter
  const [instFilter, setInstFilter] = useState<"ALL" | "PAID" | "PENDING">("ALL");

  // Extra amortization form
  const [extraDate, setExtraDate] = useState(new Date().toISOString().slice(0, 10));
  const [extraVal, setExtraVal] = useState("");
  const [extraStrategy, setExtraStrategy] =
    useState<ExtraAmortizationStrategy>("REDUCE_TERM");
  const [extraSource, setExtraSource] =
    useState<ExtraAmortizationSource>("OWN_FUNDS");
  const [extraMonthsReduced, setExtraMonthsReduced] = useState("0");
  const [extraNotes, setExtraNotes] = useState("");
  const [savingExtra, setSavingExtra] = useState(false);

  // FGTS PDF import
  const [fgtsUploading, setFgtsUploading] = useState(false);

  const loadList = useCallback(async (preferId?: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/financings`);
      if (!res.ok) return;
      const list: FinancingRecord[] = await res.json();
      setFinancings(list);
      if (preferId) {
        setSelectedId(preferId);
      } else if (list.length > 0) {
        setSelectedId((prev) =>
          prev && list.some((f) => f.id === prev) ? prev : list[0].id
        );
      } else {
        setSelectedId(null);
        setSummary(null);
      }
    } catch (err) {
      console.error("Failed to list financings", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/financings/${id}/summary`);
      if (!res.ok) return;
      const data: FinancingDashboardSummary = await res.json();
      setSummary(data);
      if (data.cdiAnnualRatePct) {
        setCdiAnnualRatePct(String(data.cdiAnnualRatePct));
      }
    } catch (err) {
      console.error("Failed to load financing summary", err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`${API_BASE_URL}/financings`).then((res) => (res.ok ? res.json() : [])),
      fetch(`${API_BASE_URL}/financings/fixed-expenses`).then((res) =>
        res.ok ? res.json() : []
      ),
    ])
      .then(([list, fixed]: [FinancingRecord[], FixedExpenseOption[]]) => {
        if (!active) return;
        setFinancings(list);
        setFixedOptions(fixed);
        if (list.length > 0) {
          setSelectedId((prev) =>
            prev && list.some((f) => f.id === prev) ? prev : list[0].id
          );
        }
      })
      .catch((err) => console.error("Failed to list financings", err))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleLinkFixedExpense = useCallback(
    async (nextDescription: string) => {
      if (!selectedId) return;
      setSavingLink(true);
      try {
        const res = await fetch(`${API_BASE_URL}/financings/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            linkedFixedDescription: nextDescription || null,
          }),
        });
        if (!res.ok) {
          toast.error("Não foi possível atualizar o vínculo com o Fluxo de Caixa.");
          return;
        }
        toast.success(
          nextDescription
            ? `Financiamento vinculado à conta fixa "${nextDescription}" no Fluxo de Caixa.`
            : "Vínculo com o Fluxo de Caixa removido."
        );
        await loadSummary(selectedId);
      } catch {
        toast.error("Erro ao salvar vínculo com o Fluxo de Caixa.");
      } finally {
        setSavingLink(false);
      }
    },
    [loadSummary, selectedId]
  );

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    fetch(`${API_BASE_URL}/financings/${selectedId}/summary`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: FinancingDashboardSummary | null) => {
        if (!active || !data) return;
        setSummary(data);
        if (data.cdiAnnualRatePct) {
          setCdiAnnualRatePct(String(data.cdiAnnualRatePct));
        }
      })
      .catch((err) => console.error("Failed to load financing summary", err));
    return () => {
      active = false;
    };
  }, [selectedId]);

  const runSimulation = useCallback(async () => {
    if (!selectedId) return;
    setSimulating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/financings/${selectedId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extraAmount: Number(extraAmount || 0),
          monthlyExtra: Number(monthlyExtra || 0),
          cdiAnnualRatePct: Number(cdiAnnualRatePct || 14.65),
          cdiPercentage: Number(cdiPercentage || 100),
          investmentType,
          customAnnualRatePct:
            investmentType === "CUSTOM" ? Number(customAnnualRatePct || 12) : undefined,
          horizonMonths: Number(horizonMonths || 36),
        }),
      });
      if (res.ok) {
        setSimResult(await res.json());
      }
    } catch (err) {
      console.error("Simulation error", err);
    } finally {
      setSimulating(false);
    }
  }, [
    selectedId,
    extraAmount,
    monthlyExtra,
    cdiAnnualRatePct,
    cdiPercentage,
    investmentType,
    customAnnualRatePct,
    horizonMonths,
  ]);

  useEffect(() => {
    if (!selectedId || activeTab !== "simulator") return;
    let active = true;
    fetch(`${API_BASE_URL}/financings/${selectedId}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        extraAmount: Number(extraAmount || 0),
        monthlyExtra: Number(monthlyExtra || 0),
        cdiAnnualRatePct: Number(cdiAnnualRatePct || 14.65),
        cdiPercentage: Number(cdiPercentage || 100),
        investmentType,
        customAnnualRatePct:
          investmentType === "CUSTOM" ? Number(customAnnualRatePct || 12) : undefined,
        horizonMonths: Number(horizonMonths || 36),
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) setSimResult(data);
      })
      .catch((err) => console.error("Simulation error", err));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, activeTab]);

  const handleDeleteFinancing = async () => {
    if (!summary) return;
    if (!window.confirm(`Excluir o financiamento "${summary.financing.name}"?`)) {
      return;
    }
    const res = await fetch(`${API_BASE_URL}/financings/${summary.financing.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Financiamento removido.");
      loadList();
    } else {
      toast.error("Não foi possível remover o financiamento.");
    }
  };

  const handleToggleInstallment = async (
    installmentId: string,
    currentStatus: "PAID" | "PENDING"
  ) => {
    if (!summary) return;
    const nextStatus = currentStatus === "PAID" ? "PENDING" : "PAID";
    const res = await fetch(
      `${API_BASE_URL}/financings/${summary.financing.id}/installments/${installmentId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      }
    );
    if (res.ok) {
      toast.success(
        nextStatus === "PAID"
          ? "Parcela marcada como paga."
          : "Parcela marcada como pendente."
      );
      loadSummary(summary.financing.id);
    }
  };

  const handleAddExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary || !extraVal) return;
    setSavingExtra(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/financings/${summary.financing.id}/extra-amortizations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: extraDate,
            amount: Number(extraVal),
            strategy: extraStrategy,
            source: extraSource,
            installmentsReduced: Number(extraMonthsReduced || 0),
            notes: extraNotes.trim() || undefined,
          }),
        }
      );
      if (!res.ok) throw new Error("Falha ao registrar amortização extra");
      toast.success("Amortização extra registrada!");
      setExtraVal("");
      setExtraNotes("");
      loadSummary(summary.financing.id);
      loadList(summary.financing.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSavingExtra(false);
    }
  };

  const handleDeleteExtra = async (extraId: string) => {
    if (!summary) return;
    const res = await fetch(
      `${API_BASE_URL}/financings/${summary.financing.id}/extra-amortizations/${extraId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      toast.success("Amortização removida.");
      loadSummary(summary.financing.id);
    }
  };

  const handleFgtsFileUpload = async (file: File) => {
    if (!summary) return;
    setFgtsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const previewRes = await fetch(`${API_BASE_URL}/financings/fgts/preview`, {
        method: "POST",
        body: formData,
      });
      if (!previewRes.ok) throw new Error("Falha ao ler extrato do FGTS");
      const fgts = await previewRes.json();

      const updateRes = await fetch(
        `${API_BASE_URL}/financings/${summary.financing.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(fgts.currentBalance !== null
              ? { fgtsBalance: fgts.currentBalance }
              : {}),
            ...(fgts.lastUsageDate
              ? { lastFgtsUsageDate: fgts.lastUsageDate }
              : {}),
          }),
        }
      );
      if (!updateRes.ok) throw new Error("Falha ao atualizar dados de FGTS");
      toast.success("Dados do FGTS atualizados a partir do extrato!");
      loadSummary(summary.financing.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar FGTS");
    } finally {
      setFgtsUploading(false);
    }
  };

  const filteredInstallments =
    summary?.financing.installments.filter((i) =>
      instFilter === "ALL" ? true : i.status === instFilter
    ) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financiamento Imobiliário"
        description="Acompanhe parcelas pagas, juros, amortização real, simulações vs CDI e elegibilidade do FGTS."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="gap-2"
            >
              <FileUp className="h-4 w-4" />
              Importar Extrato (PDF/CSV)
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Novo Financiamento
            </Button>
          </div>
        }
      />

      {loading ? (
        <Panel title="Carregando">
          <div className="py-10 text-center text-sm text-muted-foreground">
            Carregando financiamentos...
          </div>
        </Panel>
      ) : financings.length === 0 ? (
        <Panel title="Comece seu acompanhamento">
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Home className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-base font-semibold">
              Nenhum financiamento cadastrado
            </h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Cadastre manualmente seu contrato (Bradesco, Caixa, Itaú,
              Santander, BB) ou importe o PDF do extrato financeiro para carregar
              todas as parcelas automaticamente.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                Importar PDF / CSV
              </Button>
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Cadastrar Manualmente
              </Button>
            </div>
          </div>
        </Panel>
      ) : (
        <>
          {/* Contract selector bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <select
                value={selectedId ?? ""}
                onChange={(e) => setSelectedId(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium"
              >
                {financings.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} — {f.bankName} ({f.system}/{f.indexer})
                  </option>
                ))}
              </select>
              {summary?.financing.contractNumber && (
                <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  Contrato {summary.financing.contractNumber}
                </span>
              )}
            </div>

            {summary && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs">
                  <span className="text-muted-foreground">Conta fixa:</span>
                  <select
                    value={summary.financing.linkedFixedDescription ?? ""}
                    disabled={savingLink}
                    onChange={(e) => handleLinkFixedExpense(e.target.value)}
                    title="Vincular parcelas do financiamento a uma conta fixa do Fluxo de Caixa"
                    className="bg-transparent font-medium text-foreground outline-none"
                  >
                    <option value="">Sem vínculo</option>
                    {fixedOptions.map((opt) => (
                      <option key={opt.description} value={opt.description}>
                        {opt.description}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(summary.financing);
                    setFormOpen(true);
                  }}
                  className="gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteFinancing}
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </Button>
              </div>
            )}
          </div>

          {summary && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Saldo Devedor Atual"
                  icon={Home}
                  info="Saldo devedor remanescente do contrato."
                >
                  <p className="text-2xl font-bold tracking-tight">
                    <Money value={summary.kpis.currentBalance} />
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {summary.kpis.progressPct}% quitado de{" "}
                    <Money value={summary.kpis.financedAmount} />
                  </p>
                </StatCard>

                <StatCard
                  title="Amortização Real Paga"
                  icon={TrendingDown}
                  info="Principal amortizado nas parcelas + amortizações extras."
                >
                  <p className="text-2xl font-bold tracking-tight text-emerald-500">
                    <Money value={summary.kpis.realAmortizationPaid} />
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Parcelas + extras (<Money value={summary.kpis.totalExtraAmortized} />)
                  </p>
                </StatCard>

                <StatCard
                  title="Juros + Taxas Pagos"
                  icon={Percent}
                  info="Soma de juros, seguros MIP/DFI e taxa administrativa já pagos."
                >
                  <p className="text-2xl font-bold tracking-tight text-amber-500">
                    <Money
                      value={
                        summary.kpis.totalInterestPaid + summary.kpis.totalFeesPaid
                      }
                    />
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Juros: <Money value={summary.kpis.totalInterestPaid} />
                    {summary.kpis.totalTrPaid !== undefined && summary.kpis.totalTrPaid > 0 && (
                      <> • TR: <Money value={summary.kpis.totalTrPaid} /></>
                    )}
                  </p>
                </StatCard>

                <StatCard
                  title="Tempo Restante"
                  icon={Clock}
                  info="Meses restantes considerando parcelas pagas e reduções de prazo."
                >
                  <p className="text-2xl font-bold tracking-tight">
                    {summary.kpis.remainingMonths} meses
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatMonthsAsYearsAndMonths(summary.kpis.remainingMonths)} •{" "}
                    {summary.kpis.monthsReducedByExtra}m reduzidos
                  </p>
                </StatCard>
              </div>

              {/* FGTS Banner */}
              <div
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                  summary.fgtsEligibility.canUse
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {summary.fgtsEligibility.canUse ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <CalendarClock className="h-4 w-4 shrink-0" />
                  )}
                  <div>
                    <strong>FGTS:</strong> {summary.fgtsEligibility.statusLabel}
                    {summary.fgtsEligibility.nextEligibleDate && (
                      <span className="ml-2 text-xs opacity-85">
                        (Próxima liberação:{" "}
                        {summary.fgtsEligibility.nextEligibleDate
                          .split("-")
                          .reverse()
                          .join("/")}
                        )
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs font-medium">
                  Saldo FGTS informado:{" "}
                  <Money value={summary.financing.fgtsBalance} />
                </div>
              </div>

              {/* Tabs */}
              <div className="flex flex-wrap gap-2 border-b border-border pb-2">
                {(
                  [
                    ["reports", "Relatórios & Evolução"],
                    ["simulator", "Simulador & Amortizar × CDI"],
                    ["rentVsBuy", "Financiamento × Aluguel"],
                    ["installments", "Parcelas & Extrato"],
                    ["fgts", "FGTS & Amortizações Extras"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                      activeTab === key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* TAB 1: REPORTS & EVOLUTION */}
              {activeTab === "reports" && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <Panel title="Evolução Mensal (Amortização × Juros × Seguros)">
                    <PaymentEvolutionChart data={summary.evolutionSeries} />
                  </Panel>

                  <Panel title="Curva do Saldo Devedor">
                    <BalanceCurveChart data={summary.evolutionSeries} />
                  </Panel>

                  <Panel
                    title="Impacto da TR no Saldo (Amortização Real × Correção TR)"
                    className="lg:col-span-2"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>
                        Compara o valor amortizado da dívida (verde) com o acréscimo monetário da TR (laranja) e a taxa percentual do indexador (linha azul).
                      </span>
                      {summary.kpis.totalTrPaid !== undefined && (
                        <span className="font-semibold text-foreground">
                          Total de correção TR já absorvida:{" "}
                          <span className="text-orange-500">
                            <Money value={summary.kpis.totalTrPaid} />
                          </span>
                        </span>
                      )}
                    </div>
                    <TrImpactChart data={summary.evolutionSeries} />
                  </Panel>

                  <FinancingInsuranceCard financing={summary.financing} />

                  <Panel title="Resumo Financeiro do Contrato" className="lg:col-span-2">
                    <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
                      <div>
                        <p className="text-xs text-muted-foreground">Valor do Imóvel</p>
                        <p className="font-semibold">
                          <Money value={summary.financing.propertyValue} />
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Valor Financiado</p>
                        <p className="font-semibold">
                          <Money value={summary.financing.financedAmount} />
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Total Pago até Hoje
                        </p>
                        <p className="font-semibold">
                          <Money value={summary.kpis.totalPaidOverall} />
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Correção TR Acumulada
                        </p>
                        <p className="font-semibold text-orange-500">
                          <Money value={summary.kpis.totalTrPaid ?? 0} />
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Taxas (Nominal / Efetiva / CET)
                        </p>
                        <p className="font-semibold">
                          {summary.financing.nominalRateAnnual.toFixed(2)}% /{" "}
                          {(
                            summary.financing.effectiveRateAnnual ??
                            summary.financing.nominalRateAnnual
                          ).toFixed(2)}
                          % / {(summary.financing.cetAnnual ?? 0).toFixed(2)}% a.a.
                        </p>
                      </div>
                    </div>
                  </Panel>
                </div>
              )}

              {/* TAB 2: SIMULATOR & AMORTIZE VS INVEST */}
              {activeTab === "simulator" && (
                <div className="space-y-6">
                  <Panel title="Simulador de Amortização & Comparador CDI">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">
                          Aporte Extra (R$)
                        </label>
                        <input
                          type="number"
                          value={extraAmount}
                          onChange={(e) => setExtraAmount(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">
                          Extra Mensal (R$)
                        </label>
                        <input
                          type="number"
                          value={monthlyExtra}
                          onChange={(e) => setMonthlyExtra(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">
                          CDI Atual (% a.a.)
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          value={cdiAnnualRatePct}
                          onChange={(e) => setCdiAnnualRatePct(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">
                          Aplicação
                        </label>
                        <select
                          value={investmentType}
                          onChange={(e) =>
                            setInvestmentType(e.target.value as InvestmentBenchmarkType)
                          }
                          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                        >
                          <option value="CDB">CDB (IR Regressivo)</option>
                          <option value="LCI_LCA">LCI / LCA (Isento IR)</option>
                          <option value="CUSTOM">Taxa Personalizada</option>
                        </select>
                      </div>
                      {investmentType === "CUSTOM" ? (
                        <div>
                          <label className="mb-1 block text-xs text-muted-foreground">
                            Taxa Líquida (% a.a.)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={customAnnualRatePct}
                            onChange={(e) => setCustomAnnualRatePct(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="mb-1 block text-xs text-muted-foreground">
                            % do CDI
                          </label>
                          <input
                            type="number"
                            value={cdiPercentage}
                            onChange={(e) => setCdiPercentage(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                          />
                        </div>
                      )}
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">
                          Horizonte (meses)
                        </label>
                        <input
                          type="number"
                          value={horizonMonths}
                          onChange={(e) => setHorizonMonths(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <Button
                        onClick={runSimulation}
                        disabled={simulating}
                        className="gap-2"
                      >
                        <Calculator className="h-4 w-4" />
                        {simulating ? "Calculando..." : "Recalcular Simulação"}
                      </Button>
                    </div>
                  </Panel>

                  {simResult && (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      <Panel title="Reduzir Prazo vs Reduzir Parcela">
                        <div className="space-y-3 text-sm">
                          <div className="rounded-lg border border-border p-3">
                            <p className="text-xs text-muted-foreground">
                              Cenário Atual (sem aporte)
                            </p>
                            <div className="mt-1 flex flex-wrap justify-between gap-2">
                              <span>Prazo: {simResult.simulation.baseline.months}m</span>
                              <span>
                                Parcela:{" "}
                                <Money value={simResult.simulation.baseline.firstInstallment} />
                              </span>
                              <span>
                                Juros totais:{" "}
                                <Money value={simResult.simulation.baseline.totalInterest} />
                              </span>
                            </div>
                          </div>

                          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                            <p className="text-xs font-semibold text-emerald-400">
                              Reduzir Prazo (Recomendado para economizar juros)
                            </p>
                            <div className="mt-1 flex flex-wrap justify-between gap-2">
                              <span>
                                Novo prazo: {simResult.simulation.reduceTerm.months}m (
                                <strong>
                                  -{simResult.simulation.reduceTerm.monthsSaved} meses
                                </strong>
                                )
                              </span>
                              <span>
                                Nova parcela:{" "}
                                <Money value={simResult.simulation.reduceTerm.firstInstallment} />
                              </span>
                              <span>
                                Economia de juros:{" "}
                                <strong className="text-emerald-400">
                                  <Money
                                    value={simResult.simulation.reduceTerm.interestSaved}
                                  />
                                </strong>
                              </span>
                            </div>
                            {typeof simResult.simulation.reduceTerm.effectiveExtraAmount === "number" && (
                              <div className="mt-2 flex flex-wrap justify-between gap-2 border-t border-emerald-500/20 pt-2 text-xs text-muted-foreground">
                                <span>
                                  Amortização efetiva (parcelas inteiras):{" "}
                                  <strong className="text-foreground">
                                    <Money
                                      value={simResult.simulation.reduceTerm.effectiveExtraAmount}
                                    />
                                  </strong>
                                </span>
                                {(simResult.simulation.reduceTerm.unusedExtraAmount ?? 0) > 0 && (
                                  <span>
                                    Sobra:{" "}
                                    <Money
                                      value={simResult.simulation.reduceTerm.unusedExtraAmount ?? 0}
                                    />
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="rounded-lg border border-border p-3">
                            <p className="text-xs font-semibold text-blue-400">
                              Reduzir Valor da Parcela
                            </p>
                            <div className="mt-1 flex flex-wrap justify-between gap-2">
                              <span>
                                Nova parcela:{" "}
                                <Money
                                  value={simResult.simulation.reduceInstallment.firstInstallment}
                                />{" "}
                                (queda de{" "}
                                <strong>
                                  <Money
                                    value={
                                      simResult.simulation.reduceInstallment
                                        .installmentDrop
                                    }
                                  />
                                </strong>
                                )
                              </span>
                              <span>
                                Economia de juros:{" "}
                                <Money
                                  value={
                                    simResult.simulation.reduceInstallment.interestSaved
                                  }
                                />
                              </span>
                            </div>
                          </div>
                        </div>
                      </Panel>

                      <Panel
                        title={`Amortizar × Investir (Break-even: ${simResult.comparison.breakEvenCdiPct}% CDI)`}
                      >
                        <div
                          className={`mb-4 flex items-center justify-between rounded-lg border p-3 text-sm ${
                            simResult.comparison.recommendation === "AMORTIZE"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border-violet-500/30 bg-violet-500/10 text-violet-300"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Scale className="h-4 w-4" />
                            <strong>
                              {simResult.comparison.recommendation === "AMORTIZE"
                                ? "Vale mais AMORTIZAR o financiamento"
                                : simResult.comparison.recommendation === "INVEST"
                                  ? "Vale mais DEIXAR RENDENDO no investimento"
                                  : "Empate técnico"}
                            </strong>
                          </div>
                          <span className="text-xs">
                            Líquido invest.:{" "}
                            {simResult.comparison.netInvestmentAnnualRatePct}% a.a. vs
                            Financ.: {simResult.comparison.financingAnnualRatePct}% a.a.
                          </span>
                        </div>

                        <AmortizeVsInvestChart series={simResult.comparison.series} />
                      </Panel>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: FINANCIAMENTO x ALUGUEL */}
              {activeTab === "rentVsBuy" && (
                <BuyVsRentPanel key={summary.financing.id} summary={summary} />
              )}

              {/* TAB 3: INSTALLMENTS */}
              {activeTab === "installments" && (
                <Panel
                  title={`Parcelas do Contrato (${summary.financing.installments.length})`}
                  actions={
                    <div className="flex gap-1.5">
                      {(["ALL", "PAID", "PENDING"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setInstFilter(f)}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                            instFilter === f
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {f === "ALL" ? "Todas" : f === "PAID" ? "Pagas" : "A Vencer"}
                        </button>
                      ))}
                    </div>
                  }
                >
                  <div className="max-h-[480px] overflow-auto rounded-lg border border-border">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-muted text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Nº</th>
                          <th className="px-3 py-2">Vencimento</th>
                          <th className="px-3 py-2">Amortização</th>
                          <th className="px-3 py-2">Juros</th>
                          <th className="px-3 py-2">Seguros/Taxas</th>
                          <th className="px-3 py-2">Total</th>
                          <th className="px-3 py-2">Saldo Devedor</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInstallments.map((inst) => (
                          <tr key={inst.id} className="border-t border-border/60">
                            <td className="px-3 py-2 font-medium">
                              {inst.installmentCode}
                            </td>
                            <td className="px-3 py-2">
                              {inst.dueDate.slice(0, 10).split("-").reverse().join("/")}
                            </td>
                            <td className="px-3 py-2 text-emerald-500">
                              <Money value={inst.principalAmount} />
                            </td>
                            <td className="px-3 py-2 text-amber-500">
                              <Money value={inst.interestAmount} />
                            </td>
                            <td className="px-3 py-2">
                              <Money
                                value={
                                  inst.mipAmount + inst.dfiAmount + inst.tsaAmount
                                }
                              />
                            </td>
                            <td className="px-3 py-2 font-semibold">
                              <Money value={inst.totalAmount} />
                            </td>
                            <td className="px-3 py-2">
                              <Money value={inst.balanceAfter} />
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleInstallment(inst.id, inst.status)
                                }
                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                  inst.status === "PAID"
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : "bg-amber-500/15 text-amber-400"
                                }`}
                              >
                                {inst.status === "PAID" ? "Paga" : "A Vencer"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              )}

              {/* TAB 4: FGTS & EXTRA AMORTIZATIONS */}
              {activeTab === "fgts" && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <Panel title="FGTS & Regra de 2 Anos">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/20 p-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Saldo FGTS</p>
                          <p className="text-lg font-bold">
                            <Money value={summary.financing.fgtsBalance} />
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Último Uso FGTS
                          </p>
                          <p className="text-lg font-bold">
                            {summary.fgtsEligibility.lastUsageDate
                              ? summary.fgtsEligibility.lastUsageDate
                                  .split("-")
                                  .reverse()
                                  .join("/")
                              : "Não registrado"}
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                          Importar Extrato PDF do FGTS (Caixa)
                        </label>
                        <input
                          type="file"
                          accept=".pdf,.txt"
                          disabled={fgtsUploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFgtsFileUpload(f);
                          }}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
                        />
                      </div>

                      <form onSubmit={handleAddExtra} className="space-y-3 border-t border-border pt-4">
                        <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                          <PiggyBank className="h-4 w-4 text-primary" />
                          Registrar Nova Amortização Extra
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            value={extraDate}
                            onChange={(e) => setExtraDate(e.target.value)}
                            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                            required
                          />
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Valor (R$)"
                            value={extraVal}
                            onChange={(e) => setExtraVal(e.target.value)}
                            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                            required
                          />
                          <select
                            value={extraSource}
                            onChange={(e) =>
                              setExtraSource(
                                e.target.value as ExtraAmortizationSource
                              )
                            }
                            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                          >
                            <option value="OWN_FUNDS">Recursos Próprios</option>
                            <option value="FGTS">FGTS</option>
                          </select>
                          <select
                            value={extraStrategy}
                            onChange={(e) =>
                              setExtraStrategy(
                                e.target.value as ExtraAmortizationStrategy
                              )
                            }
                            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                          >
                            <option value="REDUCE_TERM">Reduzir Prazo</option>
                            <option value="REDUCE_INSTALLMENT">
                              Reduzir Parcela
                            </option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            placeholder="Meses reduzidos"
                            value={extraMonthsReduced}
                            onChange={(e) => setExtraMonthsReduced(e.target.value)}
                            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Observação"
                            value={extraNotes}
                            onChange={(e) => setExtraNotes(e.target.value)}
                            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                          />
                        </div>
                        <Button type="submit" disabled={savingExtra} className="w-full">
                          {savingExtra ? "Salvando..." : "Registrar Amortização"}
                        </Button>
                      </form>
                    </div>
                  </Panel>

                  <Panel
                    title={`Histórico de Amortizações Extras (${summary.financing.extraAmortizations.length})`}
                  >
                    {summary.financing.extraAmortizations.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        Nenhuma amortização extra registrada ainda.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {summary.financing.extraAmortizations.map((extra) => (
                          <div
                            key={extra.id}
                            className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                          >
                            <div>
                              <div className="font-semibold">
                                <Money value={extra.amount} />{" "}
                                <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-normal">
                                  {extra.source === "FGTS" ? "FGTS" : "Próprio"}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {extra.date.slice(0, 10).split("-").reverse().join("/")} •{" "}
                                {extra.strategy === "REDUCE_TERM"
                                  ? `Reduziu ${extra.installmentsReduced}m`
                                  : "Reduziu parcela"}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteExtra(extra.id)}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </Panel>
                </div>
              )}
            </>
          )}
        </>
      )}

      <FinancingFormModal
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(id) => loadList(id)}
      />

      <FinancingImportModal
        open={importOpen}
        targetFinancingId={selectedId ?? undefined}
        onClose={() => setImportOpen(false)}
        onImported={(id) => {
          loadList(id);
          loadSummary(id);
        }}
      />
    </div>
  );
}
