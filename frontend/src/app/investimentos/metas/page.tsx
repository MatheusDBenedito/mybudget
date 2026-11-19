"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Target,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { InvestmentsSubnav } from "@/components/InvestmentsSubnav";
import { Money } from "@/components/Money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import {
  IR_BRACKETS,
  simulateInvestmentGoal,
  type InvestmentGoalInput,
} from "@/lib/investment-goals";
import { cn } from "@/lib/utils";

interface SavedInvestmentGoal {
  id: string;
  name: string;
  initialAmount: number;
  usePortfolioAsInitial: boolean;
  monthlySalary: number;
  monthlyExpense: number;
  emergencyReserveMonths: number;
  savingsRatePct: number;
  cdiPercentage: number;
  cdiAnnualRatePct: number | null;
  horizonMonths: number;
  targetAmount: number | null;
  startMonth: number | null;
  startYear: number | null;
  notes: string | null;
  createdAt: string;
}

interface GoalsContextInfo {
  cdiAnnualRatePct: number;
  portfolioNetBalance: number;
  fixedIncomeNetBalance: number;
  suggestedMonthlySalary: number;
  suggestedMonthlyExpense: number;
}

const DEFAULT_CONTEXT: GoalsContextInfo = {
  cdiAnnualRatePct: 14.9,
  portfolioNetBalance: 0,
  fixedIncomeNetBalance: 0,
  suggestedMonthlySalary: 0,
  suggestedMonthlyExpense: 0,
};

const nowDate = new Date();

function buildDefaultForm(ctx: GoalsContextInfo): InvestmentGoalInput & {
  name: string;
  usePortfolioAsInitial: boolean;
  notes: string;
} {
  return {
    name: "Meta 10 anos",
    initialAmount: ctx.fixedIncomeNetBalance > 0 ? ctx.fixedIncomeNetBalance : ctx.portfolioNetBalance,
    usePortfolioAsInitial: false,
    monthlySalary: ctx.suggestedMonthlySalary > 0 ? ctx.suggestedMonthlySalary : 10000,
    monthlyExpense: ctx.suggestedMonthlyExpense > 0 ? ctx.suggestedMonthlyExpense : 6000,
    emergencyReserveMonths: 6,
    savingsRatePct: 15,
    cdiPercentage: 100,
    cdiAnnualRatePct: ctx.cdiAnnualRatePct,
    horizonMonths: 120,
    startMonth: nowDate.getMonth() + 1,
    startYear: nowDate.getFullYear(),
    targetAmount: null,
    notes: "",
  };
}

export default function InvestmentGoalsPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("create:investimentos");
  const canEdit = hasPermission("edit:investimentos");
  const canDelete = hasPermission("delete:investimentos");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [goals, setGoals] = useState<SavedInvestmentGoal[]>([]);
  const [contextInfo, setContextInfo] = useState<GoalsContextInfo>(DEFAULT_CONTEXT);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [form, setForm] = useState(() => buildDefaultForm(DEFAULT_CONTEXT));
  const [showAllMonths, setShowAllMonths] = useState(false);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/investment-goals`);
      if (!res.ok) throw new Error("Falha ao carregar metas");
      const data = (await res.json()) as {
        goals: SavedInvestmentGoal[];
        context: GoalsContextInfo;
      };
      setGoals(data.goals ?? []);
      const ctx = data.context ?? DEFAULT_CONTEXT;
      setContextInfo(ctx);
      setForm((prev) => {
        if (editingGoalId) return prev;
        return buildDefaultForm(ctx);
      });
    } catch {
      toast.error("Não foi possível carregar as metas de investimento.");
    } finally {
      setLoading(false);
    }
  }, [editingGoalId]);

  useEffect(() => {
    void loadGoals();
  }, [loadGoals]);

  const effectiveInitialAmount = form.usePortfolioAsInitial
    ? contextInfo.portfolioNetBalance
    : form.initialAmount;

  const simulation = useMemo(
    () =>
      simulateInvestmentGoal({
        ...form,
        initialAmount: effectiveInitialAmount,
      }),
    [effectiveInitialAmount, form],
  );

  const chartData = useMemo(() => {
    return simulation.months
      .filter((m) => m.ref === 1 || m.ref % 6 === 0 || m.ref === simulation.months.length)
      .map((m) => ({
        label: m.label,
        patrimonio: m.endingBalance,
        aportado: m.cumulativeContributed,
      }));
  }, [simulation.months]);

  const visibleMonths = showAllMonths ? simulation.months : simulation.months.slice(0, 24);

  const handleLoadGoal = (goal: SavedInvestmentGoal) => {
    setEditingGoalId(goal.id);
    setForm({
      name: goal.name,
      initialAmount: goal.usePortfolioAsInitial
        ? contextInfo.portfolioNetBalance
        : goal.initialAmount,
      usePortfolioAsInitial: goal.usePortfolioAsInitial,
      monthlySalary: goal.monthlySalary,
      monthlyExpense: goal.monthlyExpense,
      emergencyReserveMonths: goal.emergencyReserveMonths,
      savingsRatePct: goal.savingsRatePct,
      cdiPercentage: goal.cdiPercentage,
      cdiAnnualRatePct: goal.cdiAnnualRatePct ?? contextInfo.cdiAnnualRatePct,
      horizonMonths: goal.horizonMonths,
      startMonth: goal.startMonth ?? nowDate.getMonth() + 1,
      startYear: goal.startYear ?? nowDate.getFullYear(),
      targetAmount: goal.targetAmount,
      notes: goal.notes ?? "",
    });
    toast.info(`Meta "${goal.name}" carregada no simulador.`);
  };

  const handleResetNew = () => {
    setEditingGoalId(null);
    setForm(buildDefaultForm(contextInfo));
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Informe um nome para salvar a meta.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        initialAmount: Number(effectiveInitialAmount) || 0,
        usePortfolioAsInitial: Boolean(form.usePortfolioAsInitial),
        monthlySalary: Number(form.monthlySalary) || 0,
        monthlyExpense: Number(form.monthlyExpense) || 0,
        emergencyReserveMonths: Math.round(Number(form.emergencyReserveMonths) || 0),
        savingsRatePct: Number(form.savingsRatePct) || 0,
        cdiPercentage: Number(form.cdiPercentage) || 100,
        cdiAnnualRatePct: Number(form.cdiAnnualRatePct) || contextInfo.cdiAnnualRatePct,
        horizonMonths: Math.round(Number(form.horizonMonths) || 120),
        targetAmount: form.targetAmount && form.targetAmount > 0 ? Number(form.targetAmount) : null,
        startMonth: form.startMonth,
        startYear: form.startYear,
        notes: form.notes.trim() || null,
      };

      const isEdit = Boolean(editingGoalId);
      const url = isEdit
        ? `${API_BASE_URL}/investment-goals/${editingGoalId}`
        : `${API_BASE_URL}/investment-goals`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const saved = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(saved.message || "Falha ao salvar meta.");
        return;
      }

      toast.success(isEdit ? "Meta atualizada!" : "Meta criada e salva!");
      setEditingGoalId(saved.id ?? editingGoalId);
      await loadGoals();
    } catch {
      toast.error("Erro de conexão ao salvar meta.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGoal = async (goal: SavedInvestmentGoal) => {
    try {
      const res = await fetch(`${API_BASE_URL}/investment-goals/${goal.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Não foi possível excluir a meta.");
        return;
      }
      if (editingGoalId === goal.id) {
        handleResetNew();
      }
      toast.success(`Meta "${goal.name}" excluída.`);
      await loadGoals();
    } catch {
      toast.error("Erro de conexão ao excluir meta.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Metas de Investimento</h1>
          <p className="text-sm text-muted-foreground">
            Simule o patrimônio acumulado em até 10 anos poupando parte do salário, já descontando o IR regressivo.
          </p>
        </div>
        <InvestmentsSubnav />
      </div>

      {/* Saved Goals */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Metas Salvas ({goals.length})
          </h2>
          {editingGoalId && (
            <Button variant="outline" size="sm" onClick={handleResetNew}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nova simulação
            </Button>
          )}
        </div>

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando metas...
            </CardContent>
          </Card>
        ) : goals.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma meta salva ainda. Ajuste os parâmetros da planilha abaixo e clique em{" "}
              <strong>Salvar Meta</strong>.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((goal) => {
              const goalInitial = goal.usePortfolioAsInitial
                ? contextInfo.portfolioNetBalance
                : goal.initialAmount;
              const goalSim = simulateInvestmentGoal({
                initialAmount: goalInitial,
                monthlySalary: goal.monthlySalary,
                monthlyExpense: goal.monthlyExpense,
                emergencyReserveMonths: goal.emergencyReserveMonths,
                savingsRatePct: goal.savingsRatePct,
                cdiPercentage: goal.cdiPercentage,
                cdiAnnualRatePct: goal.cdiAnnualRatePct ?? contextInfo.cdiAnnualRatePct,
                horizonMonths: goal.horizonMonths,
                startMonth: goal.startMonth ?? nowDate.getMonth() + 1,
                startYear: goal.startYear ?? nowDate.getFullYear(),
                targetAmount: goal.targetAmount,
              });
              const target = goal.targetAmount && goal.targetAmount > 0 ? goal.targetAmount : goalSim.finalNetBalance;
              const progressPct = target > 0 ? Math.min(100, Math.max(0, (goalInitial / target) * 100)) : 0;
              const isSelected = editingGoalId === goal.id;

              return (
                <Card key={goal.id} className={cn("transition-colors", isSelected && "border-primary ring-1 ring-primary/30")}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{goal.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {goal.savingsRatePct}% de {formatCurrency(goal.monthlySalary)} ({formatCurrency(goalSim.monthlySavingsBrl)}/mês) •{" "}
                          {Math.round(goal.horizonMonths / 12)} anos ({goal.horizonMonths}m)
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Abrir no simulador"
                          onClick={() => handleLoadGoal(goal)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Excluir meta"
                            onClick={() => handleDeleteGoal(goal)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">Projetado líquido ({goal.horizonMonths}m)</span>
                      <span className="font-semibold text-positive">
                        <Money value={goalSim.finalNetBalance} />
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Atual: <Money value={goalInitial} />
                        </span>
                        <span>
                          Alvo: <Money value={target} /> ({progressPct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-positive-fill transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {goalSim.emergencyReserveTargetBrl > 0 && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                        <span className="inline-flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5 text-positive" />
                          Reserva ({goal.emergencyReserveMonths}m)
                        </span>
                        <span>
                          {goalSim.emergencyReserveReachedMonth
                            ? `Atingida em ${goalSim.emergencyReserveReachedMonth.label}`
                            : "Não atingida no prazo"}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Simulator + CDI Matrix */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle className="text-base">
              {editingGoalId ? `Editando: ${form.name}` : "Parâmetros da Planilha (Simulador)"}
            </CardTitle>
            <CardDescription>
              Baseado no salário, % de poupança, % do CDI e IR regressivo ao longo dos anos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveGoal} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="goal-name">Nome da Meta</Label>
                  <Input
                    id="goal-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Meta 10 anos"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="goal-salary">Salário Mensal (R$)</Label>
                  <Input
                    id="goal-salary"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.monthlySalary}
                    onChange={(e) => setForm((f) => ({ ...f, monthlySalary: Number(e.target.value) }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="goal-savings-pct">Poupança Mensal (%)</Label>
                  <Input
                    id="goal-savings-pct"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={form.savingsRatePct}
                    onChange={(e) => setForm((f) => ({ ...f, savingsRatePct: Number(e.target.value) }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="goal-expense">Custo Mensal (R$)</Label>
                  <Input
                    id="goal-expense"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.monthlyExpense}
                    onChange={(e) => setForm((f) => ({ ...f, monthlyExpense: Number(e.target.value) }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="goal-reserve-months">Meses Protegidos (Reserva)</Label>
                  <Input
                    id="goal-reserve-months"
                    type="number"
                    min="0"
                    max="60"
                    value={form.emergencyReserveMonths}
                    onChange={(e) => setForm((f) => ({ ...f, emergencyReserveMonths: Number(e.target.value) }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="goal-initial">Valor Inicial (R$)</Label>
                    {contextInfo.portfolioNetBalance > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            usePortfolioAsInitial: false,
                            initialAmount: contextInfo.portfolioNetBalance,
                          }))
                        }
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        Usar carteira ({formatCurrency(contextInfo.portfolioNetBalance)})
                      </button>
                    )}
                  </div>
                  <Input
                    id="goal-initial"
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={form.usePortfolioAsInitial}
                    value={effectiveInitialAmount}
                    onChange={(e) => setForm((f) => ({ ...f, initialAmount: Number(e.target.value) }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="goal-target">Meta Alvo Opcional (R$)</Label>
                  <Input
                    id="goal-target"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 500000"
                    value={form.targetAmount ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        targetAmount: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="goal-cdi-pct">% do CDI</Label>
                  <Input
                    id="goal-cdi-pct"
                    type="number"
                    step="1"
                    min="1"
                    max="500"
                    value={form.cdiPercentage}
                    onChange={(e) => setForm((f) => ({ ...f, cdiPercentage: Number(e.target.value) }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="goal-cdi-annual">CDI Anual (%)</Label>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, cdiAnnualRatePct: contextInfo.cdiAnnualRatePct }))
                      }
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      CDI atual ({contextInfo.cdiAnnualRatePct.toFixed(2)}%)
                    </button>
                  </div>
                  <Input
                    id="goal-cdi-annual"
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={form.cdiAnnualRatePct}
                    onChange={(e) => setForm((f) => ({ ...f, cdiAnnualRatePct: Number(e.target.value) }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="goal-horizon">Prazo (meses)</Label>
                  <Input
                    id="goal-horizon"
                    type="number"
                    min="1"
                    max="600"
                    value={form.horizonMonths}
                    onChange={(e) => setForm((f) => ({ ...f, horizonMonths: Number(e.target.value) }))}
                  />
                </div>

                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.usePortfolioAsInitial}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, usePortfolioAsInitial: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    Sincronizar valor inicial com saldo atual da carteira
                  </label>
                </div>
              </div>

              {(canCreate || (editingGoalId && canEdit)) && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {editingGoalId ? "Atualizar Meta" : "Salvar Meta"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleResetNew}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Resetar
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Right: CDI x IR Matrix + Summary KPIs */}
        <div className="space-y-4 lg:col-span-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-1">
                <CardDescription>Poupança Mensal ({form.savingsRatePct}%)</CardDescription>
                <CardTitle className="text-xl text-positive">
                  <Money value={simulation.monthlySavingsBrl} />
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Reserva de emergência ({form.emergencyReserveMonths}m):{" "}
                <span className="font-medium text-foreground">
                  <Money value={simulation.emergencyReserveTargetBrl} />
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <CardDescription>
                  Patrimônio Líquido Final ({form.horizonMonths}m / {(form.horizonMonths / 12).toFixed(1)}a)
                </CardDescription>
                <CardTitle className="text-xl text-positive">
                  <Money value={simulation.finalNetBalance} />
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Aportado: <Money value={simulation.totalContributed} /> • Rendimento líq.:{" "}
                <span className="text-positive font-medium">
                  <Money value={simulation.totalNetYield} />
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <CardDescription>Rentabilidade Líquida (Inicial → &gt;2 anos)</CardDescription>
                <CardTitle className="text-lg">
                  {simulation.initialMonthlyNetRatePct.toFixed(3)}% → {simulation.finalMonthlyNetRatePct.toFixed(3)}% a.m.
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Anual líq.: {simulation.initialAnnualNetRatePct.toFixed(2)}% → {simulation.finalAnnualNetRatePct.toFixed(2)}% a.a.
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <CardDescription>Imposto de Renda Descontado</CardDescription>
                <CardTitle className="text-lg text-negative">
                  <Money value={simulation.totalIrPaid} />
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {simulation.targetReachedMonth ? (
                  <span className="inline-flex items-center gap-1 text-positive font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Alvo atingido em {simulation.targetReachedMonth.label} (mês {simulation.targetReachedMonth.ref})
                  </span>
                ) : form.targetAmount ? (
                  <span>Alvo de {formatCurrency(form.targetAmount)} após o prazo</span>
                ) : (
                  <span>IR regressivo aplicado mês a mês (22,5% → 15%)</span>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Tabela Líquida CDI × Alíquota de IR (sobre {formatCurrency(effectiveInitialAmount)})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-1.5 text-left font-medium">CDI</th>
                    <th className="py-1.5 text-right font-medium">Anual</th>
                    <th className="py-1.5 text-right font-medium">Mês</th>
                    {IR_BRACKETS.map((b) => (
                      <th key={b.label} className="py-1.5 text-right font-medium">
                        {(b.rate * 100).toFixed(1).replace(".0", "")}%
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {simulation.matrix.map((row) => (
                    <tr
                      key={row.cdiPercentage}
                      className={cn(
                        "border-b last:border-0",
                        row.cdiPercentage === form.cdiPercentage && "bg-primary/5 font-medium",
                      )}
                    >
                      <td className="py-1.5">{row.cdiPercentage}%</td>
                      <td className="py-1.5 text-right tabular-nums">{row.annualGrossPct.toFixed(2)}%</td>
                      <td className="py-1.5 text-right tabular-nums">{row.monthlyGrossPct.toFixed(2)}%</td>
                      {row.byIrBracket.map((cell) => (
                        <td
                          key={cell.irRatePct}
                          className="py-1.5 text-right tabular-nums"
                          title={`Rendimento mensal líquido inicial: ${formatCurrency(cell.monthlyNetOnInitialBrl)}`}
                        >
                          <div>{cell.monthlyNetPct.toFixed(3)}%</div>
                          <div className="text-[10px] text-muted-foreground privacy-value">
                            {formatCurrency(cell.monthlyNetOnInitialBrl)}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Evolution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução Patrimonial (Líquido vs. Total Aportado)</CardTitle>
          <CardDescription>Projeção ao longo de {form.horizonMonths} meses já descontando o IR regressivo.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `R$ ${(Number(v) / 1000).toFixed(0)}k`}
                width={68}
              />
              <Tooltip
                formatter={(value: unknown, name: unknown) => [
                  formatCurrency(Number(value ?? 0)),
                  name === "patrimonio" ? "Patrimônio Líquido" : "Total Aportado",
                ]}
              />
              <Area
                type="monotone"
                dataKey="patrimonio"
                stroke="#16a34a"
                fill="#16a34a"
                fillOpacity={0.18}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="aportado"
                stroke="#64748b"
                fill="#64748b"
                fillOpacity={0.12}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Month-by-Month Spreadsheet */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Planilha Mês a Mês ({simulation.months.length} meses)</CardTitle>
            <CardDescription>
              Detalhamento mensal com mudança automática da alíquota de IR conforme o tempo.
            </CardDescription>
          </div>
          {simulation.months.length > 24 && (
            <Button variant="outline" size="sm" onClick={() => setShowAllMonths((v) => !v)}>
              {showAllMonths ? "Mostrar primeiros 24 meses" : `Ver todos os ${simulation.months.length} meses`}
            </Button>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="border-b bg-muted/50 text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Ref.</th>
                <th className="px-3 py-2 text-left font-medium">Mês</th>
                <th className="px-3 py-2 text-right font-medium">Valor Inicial</th>
                <th className="px-3 py-2 text-right font-medium">Poupança Mensal</th>
                <th className="px-3 py-2 text-right font-medium">IR</th>
                <th className="px-3 py-2 text-right font-medium">Rent. Líq.</th>
                <th className="px-3 py-2 text-right font-medium">Rendimento Líq.</th>
                <th className="px-3 py-2 text-right font-medium">Valor Final</th>
              </tr>
            </thead>
            <tbody>
              {visibleMonths.map((row) => (
                <tr key={row.ref} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{row.ref}</td>
                  <td className="px-3 py-1.5 font-medium">{row.label}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums"><Money value={row.startingBalance} /></td>
                  <td className="px-3 py-1.5 text-right tabular-nums"><Money value={row.contribution} /></td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{row.irRatePct}%</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{row.monthlyNetRatePct.toFixed(2)}%</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-positive">
                    +<Money value={row.netYield} />
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                    <Money value={row.endingBalance} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
