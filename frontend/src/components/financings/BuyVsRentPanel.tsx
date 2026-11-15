"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  Home,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { Panel } from "@/components/Panel";
import { Money } from "@/components/Money";
import { Button } from "@/components/ui/button";
import {
  type AmortizationSystem,
  type BuyVsRentMode,
  compareBuyVsRent,
  computeInsuranceSummary,
  formatMonthsAsYearsAndMonths,
  type FinancingDashboardSummary,
} from "@/lib/financings";

interface BuyVsRentPanelProps {
  summary: FinancingDashboardSummary;
}

const formatCompactBrl = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);

const formatFullBrl = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(v);

function getDefaults(summary: FinancingDashboardSummary) {
  const { financing, kpis, cdiAnnualRatePct } = summary;
  const ins = computeInsuranceSummary(financing);
  const effectiveRate =
    financing.effectiveRateAnnual ?? financing.nominalRateAnnual;
  const equityOrDownPayment =
    financing.propertyValue > financing.currentBalance
      ? Math.round(financing.propertyValue - financing.currentBalance)
      : Math.round(financing.downPayment || 0);
  const monthlyFees = Number(
    (
      (ins.currentInsuranceTotal || financing.monthlyInsurance || 0) +
      (ins.currentTsa || financing.monthlyAdminFee || 0)
    ).toFixed(2)
  );
  const remainingMonths = Math.max(
    12,
    kpis.remainingMonths || financing.totalMonths
  );
  const netCdi = Number(((cdiAnnualRatePct || 14.65) * 0.85).toFixed(2));

  return {
    mode: "KEEP_OR_SELL" as BuyVsRentMode,
    propertyValue: String(Math.round(financing.propertyValue)),
    purchasePrice: String(Math.round(financing.propertyValue)),
    renovationCost: "0",
    sellingCostsPct: "5",
    downPayment: String(equityOrDownPayment),
    closingCostsPct: "4",
    financedAmount: String(Math.round(financing.currentBalance)),
    annualInterestRatePct: effectiveRate.toFixed(2),
    totalMonths: String(remainingMonths),
    system: financing.system as AmortizationSystem,
    monthlyFees: String(monthlyFees),
    monthlyRent: String(Math.round(financing.propertyValue * 0.005)),
    rentAnnualAdjustmentPct: "4.5",
    propertyAppreciationPct: "4.5",
    investmentNetAnnualRatePct: String(netCdi),
    ownerMaintenanceAnnualPct: "0.5",
    horizonMonths: String(Math.min(240, remainingMonths)),
  };
}

export function BuyVsRentPanel({ summary }: BuyVsRentPanelProps) {
  const defaults = useMemo(() => getDefaults(summary), [summary]);

  const [mode, setMode] = useState<BuyVsRentMode>(defaults.mode);
  const [propertyValue, setPropertyValue] = useState(defaults.propertyValue);
  const [purchasePrice, setPurchasePrice] = useState(defaults.purchasePrice);
  const [renovationCost, setRenovationCost] = useState(defaults.renovationCost);
  const [sellingCostsPct, setSellingCostsPct] = useState(
    defaults.sellingCostsPct
  );
  const [downPayment, setDownPayment] = useState(defaults.downPayment);
  const [closingCostsPct, setClosingCostsPct] = useState(
    defaults.closingCostsPct
  );
  const [financedAmount, setFinancedAmount] = useState(defaults.financedAmount);
  const [annualInterestRatePct, setAnnualInterestRatePct] = useState(
    defaults.annualInterestRatePct
  );
  const [totalMonths, setTotalMonths] = useState(defaults.totalMonths);
  const [system, setSystem] = useState<AmortizationSystem>(defaults.system);
  const [monthlyFees, setMonthlyFees] = useState(defaults.monthlyFees);
  const [monthlyRent, setMonthlyRent] = useState(defaults.monthlyRent);
  const [rentAnnualAdjustmentPct, setRentAnnualAdjustmentPct] = useState(
    defaults.rentAnnualAdjustmentPct
  );
  const [propertyAppreciationPct, setPropertyAppreciationPct] = useState(
    defaults.propertyAppreciationPct
  );
  const [investmentNetAnnualRatePct, setInvestmentNetAnnualRatePct] = useState(
    defaults.investmentNetAnnualRatePct
  );
  const [ownerMaintenanceAnnualPct, setOwnerMaintenanceAnnualPct] = useState(
    defaults.ownerMaintenanceAnnualPct
  );
  const [horizonMonths, setHorizonMonths] = useState(defaults.horizonMonths);

  const resetToContract = () => {
    setMode(defaults.mode);
    setPropertyValue(defaults.propertyValue);
    setPurchasePrice(defaults.purchasePrice);
    setRenovationCost(defaults.renovationCost);
    setSellingCostsPct(defaults.sellingCostsPct);
    setDownPayment(defaults.downPayment);
    setClosingCostsPct(defaults.closingCostsPct);
    setFinancedAmount(defaults.financedAmount);
    setAnnualInterestRatePct(defaults.annualInterestRatePct);
    setTotalMonths(defaults.totalMonths);
    setSystem(defaults.system);
    setMonthlyFees(defaults.monthlyFees);
    setMonthlyRent(defaults.monthlyRent);
    setRentAnnualAdjustmentPct(defaults.rentAnnualAdjustmentPct);
    setPropertyAppreciationPct(defaults.propertyAppreciationPct);
    setInvestmentNetAnnualRatePct(defaults.investmentNetAnnualRatePct);
    setOwnerMaintenanceAnnualPct(defaults.ownerMaintenanceAnnualPct);
    setHorizonMonths(defaults.horizonMonths);
  };

  const result = useMemo(
    () =>
      compareBuyVsRent({
        mode,
        propertyValue: Number(propertyValue || 0),
        purchasePrice: Number(purchasePrice || 0),
        renovationCost: Number(renovationCost || 0),
        sellingCostsPct: Number(sellingCostsPct || 0),
        downPayment: Number(downPayment || 0),
        closingCostsPct: Number(closingCostsPct || 0),
        financedAmount: Number(financedAmount || 0),
        annualInterestRatePct: Number(annualInterestRatePct || 0),
        totalMonths: Number(totalMonths || 1),
        system,
        monthlyFees: Number(monthlyFees || 0),
        monthlyRent: Number(monthlyRent || 0),
        rentAnnualAdjustmentPct: Number(rentAnnualAdjustmentPct || 0),
        propertyAppreciationPct: Number(propertyAppreciationPct || 0),
        investmentNetAnnualRatePct: Number(investmentNetAnnualRatePct || 0),
        ownerMaintenanceAnnualPct: Number(ownerMaintenanceAnnualPct || 0),
        horizonMonths: Number(horizonMonths || 12),
      }),
    [
      annualInterestRatePct,
      closingCostsPct,
      downPayment,
      financedAmount,
      horizonMonths,
      investmentNetAnnualRatePct,
      mode,
      monthlyFees,
      monthlyRent,
      ownerMaintenanceAnnualPct,
      propertyAppreciationPct,
      propertyValue,
      purchasePrice,
      renovationCost,
      rentAnnualAdjustmentPct,
      sellingCostsPct,
      system,
      totalMonths,
    ]
  );

  const chartSeries = useMemo(() => {
    const step =
      result.series.length > 120 ? 6 : result.series.length > 48 ? 3 : 1;
    return result.series
      .filter(
        (pt, idx) =>
          idx === 0 || idx === result.series.length - 1 || pt.month % step === 0
      )
      .map((pt) => ({
        label: `M${pt.month}`,
        month: pt.month,
        buyNetWorth: pt.buyNetWorth,
        rentNetWorth: pt.rentNetWorth,
        buyOutflow: pt.buyOutflow,
        rentOutflow: pt.rentOutflow,
      }));
  }, [result.series]);

  const milestones = useMemo(() => {
    const targetYears = new Set([1, 2, 3, 5, 10, 15, 20, 25, 30]);
    return result.series.filter(
      (pt) =>
        (pt.month % 12 === 0 && targetYears.has(pt.month / 12)) ||
        pt.month === result.series.length
    );
  }, [result.series]);

  const isKeepMode = mode === "KEEP_OR_SELL";
  const buyLabel = isKeepMode ? "Manter Imóvel" : "Comprar (Financiamento)";
  const rentLabel = isKeepMode ? "Vender Hoje e Alugar" : "Alugar e Investir";

  return (
    <div className="space-y-6">
      <Panel
        title="Parâmetros: Financiamento × Aluguel"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetToContract}
            className="gap-1.5 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar dados do contrato
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode("KEEP_OR_SELL")}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                isKeepMode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Já possuo o imóvel (Manter × Vender e Alugar)
            </button>
            <button
              type="button"
              onClick={() => setMode("BUY_FROM_SCRATCH")}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                !isKeepMode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Simulação do zero (Comprar × Alugar)
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            {isKeepMode
              ? "Compara manter o imóvel no valor atual de mercado contra vendê-lo hoje, quitar a dívida e investir o saldo líquido morando de aluguel."
              : "Compara comprar do zero (Entrada + ITBI/Cartório) contra alugar investindo a entrada e a diferença mensal."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              {isKeepMode
                ? "Valor de Mercado Atual (R$)"
                : "Valor do Imóvel (R$)"}
            </label>
            <input
              type="number"
              value={propertyValue}
              onChange={(e) => setPropertyValue(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
            />
          </div>

          {isKeepMode ? (
            <>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Valor Compra Original (R$)
                </label>
                <input
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Custo de Reformas (R$)
                </label>
                <input
                  type="number"
                  value={renovationCost}
                  onChange={(e) => setRenovationCost(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Custos Venda / Corretagem (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={sellingCostsPct}
                  onChange={(e) => setSellingCostsPct(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Entrada / Capital Próprio (R$)
                </label>
                <input
                  type="number"
                  value={downPayment}
                  onChange={(e) => setDownPayment(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  ITBI + Cartório (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={closingCostsPct}
                  onChange={(e) => setClosingCostsPct(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              {isKeepMode
                ? "Saldo Devedor Atual (R$)"
                : "Valor Financiado (R$)"}
            </label>
            <input
              type="number"
              value={financedAmount}
              onChange={(e) => setFinancedAmount(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Juros Financ. (% a.a.)
            </label>
            <input
              type="number"
              step="0.1"
              value={annualInterestRatePct}
              onChange={(e) => setAnnualInterestRatePct(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Sistema
            </label>
            <select
              value={system}
              onChange={(e) => setSystem(e.target.value as AmortizationSystem)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
            >
              <option value="SAC">SAC</option>
              <option value="PRICE">PRICE</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Prazo Restante (meses)
            </label>
            <input
              type="number"
              min="1"
              value={totalMonths}
              onChange={(e) => setTotalMonths(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Seguros + TSA (R$/mês)
            </label>
            <input
              type="number"
              step="1"
              value={monthlyFees}
              onChange={(e) => setMonthlyFees(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Aluguel Comparado (R$/mês)
            </label>
            <input
              type="number"
              step="50"
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(e.target.value)}
              className="w-full rounded-lg border border-primary/50 bg-background px-2.5 py-1.5 text-sm font-medium"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Reajuste Aluguel (% a.a.)
            </label>
            <input
              type="number"
              step="0.5"
              value={rentAnnualAdjustmentPct}
              onChange={(e) => setRentAnnualAdjustmentPct(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Valorização Imóvel (% a.a.)
            </label>
            <input
              type="number"
              step="0.5"
              value={propertyAppreciationPct}
              onChange={(e) => setPropertyAppreciationPct(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Rentab. Líquida Invest. (% a.a.)
            </label>
            <input
              type="number"
              step="0.25"
              value={investmentNetAnnualRatePct}
              onChange={(e) => setInvestmentNetAnnualRatePct(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Manutenção Dono (% a.a.)
            </label>
            <input
              type="number"
              step="0.1"
              value={ownerMaintenanceAnnualPct}
              onChange={(e) => setOwnerMaintenanceAnnualPct(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground">
              Horizonte da Comparação (meses)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min="12"
                max="480"
                value={horizonMonths}
                onChange={(e) => setHorizonMonths(e.target.value)}
                className="w-28 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
              />
              {[
                { label: "5a", months: 60 },
                { label: "10a", months: 120 },
                { label: "20a", months: 240 },
                {
                  label: "Prazo total",
                  months: Math.max(12, Number(totalMonths || 12)),
                },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setHorizonMonths(String(preset.months))}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    Number(horizonMonths) === preset.months
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      {/* Verdict Banner */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
          result.winner === "BUY"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : result.winner === "RENT"
              ? "border-sky-500/30 bg-sky-500/10 text-sky-400"
              : "border-border bg-muted/30 text-foreground"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <strong>
              {result.winner === "BUY"
                ? `${buyLabel} vence em ${formatMonthsAsYearsAndMonths(result.horizonMonths)}`
                : result.winner === "RENT"
                  ? `${rentLabel} vence em ${formatMonthsAsYearsAndMonths(result.horizonMonths)}`
                  : "Empate técnico no horizonte selecionado"}
            </strong>
            <p className="text-xs opacity-90">
              Diferença de patrimônio líquido:{" "}
              <strong>
                <Money value={Math.abs(result.netWorthDifference)} />
              </strong>{" "}
              a favor de {result.winner === "BUY" ? buyLabel : rentLabel}.
              {result.rentOvertakesInstallmentMonth && (
                <>
                  {" "}
                  • Aluguel ultrapassa a parcela no{" "}
                  <strong>mês {result.rentOvertakesInstallmentMonth}</strong> (
                  {formatMonthsAsYearsAndMonths(
                    result.rentOvertakesInstallmentMonth
                  )}
                  ).
                </>
              )}
            </p>
          </div>
        </div>
        <div className="text-right text-xs font-medium">
          <div>
            {isKeepMode
              ? "Capital líquido liberado na venda:"
              : "Capital inicial investido no Aluguel:"}{" "}
            <Money value={result.initialCapitalInvestedInRent} />
          </div>
          {isKeepMode && result.equityGainFromRenovation !== 0 && (
            <div className="mt-0.5 text-[11px] opacity-85">
              Ganho patrimonial já obtido (Valor Atual - Compra - Reformas):{" "}
              <Money value={result.equityGainFromRenovation} />
            </div>
          )}
        </div>
      </div>

      {/* KPI Comparison Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Home className="h-4 w-4 text-emerald-500" />
            <span>Patrimônio Final ({buyLabel})</span>
          </div>
          <p className="mt-2 text-xl font-bold text-emerald-500">
            <Money value={result.finalBuyNetWorth} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Imóvel valorizado menos dívida restante
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-sky-500" />
            <span>Patrimônio Final ({rentLabel})</span>
          </div>
          <p className="mt-2 text-xl font-bold text-sky-500">
            <Money value={result.finalRentNetWorth} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Capital inicial + diferenças mensais investidas
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ArrowRightLeft className="h-4 w-4 text-amber-500" />
            <span>Desembolso no 1º Mês</span>
          </div>
          <p className="mt-2 text-sm font-semibold">
            {buyLabel}: <Money value={result.firstMonthBuyOutflow} />
          </p>
          <p className="mt-0.5 text-sm font-semibold text-sky-500">
            Aluguel: <Money value={result.firstMonthRentOutflow} />
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="h-4 w-4 text-rose-500" />
            <span>Custo Perdido no Horizonte</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-amber-500">
            Juros/Taxas: <Money value={result.totalInterestAndFeesPaid} />
          </p>
          <p className="mt-0.5 text-sm font-semibold text-rose-500">
            Aluguéis: <Money value={result.totalRentPaid} />
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title={`Evolução do Patrimônio Líquido (${buyLabel} × Alugar)`}>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartSeries}
                margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="buyNwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rentNwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={formatCompactBrl}
                  width={72}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatFullBrl(Number(value ?? 0)),
                    String(name ?? ""),
                  ]}
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    borderColor: "var(--border)",
                    color: "var(--popover-foreground)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="buyNetWorth"
                  name={`${buyLabel} (Patrimônio Líquido)`}
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#buyNwGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="rentNetWorth"
                  name={`${rentLabel} (Carteira Investida)`}
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fill="url(#rentNwGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Desembolso Mensal (Parcela + Manutenção × Aluguel)">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartSeries}
                margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={formatCompactBrl}
                  width={72}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatFullBrl(Number(value ?? 0)),
                    String(name ?? ""),
                  ]}
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    borderColor: "var(--border)",
                    color: "var(--popover-foreground)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="buyOutflow"
                  name={`Desembolso (${buyLabel})`}
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="rentOutflow"
                  name="Aluguel Mensal"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Milestones Table */}
      <Panel title="Marcos Comparativos ao Longo do Tempo" flush>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Marco</th>
                <th className="px-4 py-2.5 font-medium">Parcela Imóvel</th>
                <th className="px-4 py-2.5 font-medium">Aluguel</th>
                <th className="px-4 py-2.5 font-medium">Valor Imóvel</th>
                <th className="px-4 py-2.5 font-medium">Dívida Restante</th>
                <th className="px-4 py-2.5 font-medium">Patrimônio {buyLabel}</th>
                <th className="px-4 py-2.5 font-medium">Patrimônio Alugar</th>
                <th className="px-4 py-2.5 font-medium">Vantagem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {milestones.map((row) => {
                const diff = row.buyNetWorth - row.rentNetWorth;
                return (
                  <tr key={row.month} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">
                      Mês {row.month} ({formatMonthsAsYearsAndMonths(row.month)})
                    </td>
                    <td className="px-4 py-2.5">
                      <Money value={row.buyOutflow} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Money value={row.rentOutflow} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Money value={row.propertyValue} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Money value={row.remainingDebt} />
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-emerald-500">
                      <Money value={row.buyNetWorth} />
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-sky-500">
                      <Money value={row.rentNetWorth} />
                    </td>
                    <td
                      className={`px-4 py-2.5 font-semibold ${
                        diff >= 0 ? "text-emerald-500" : "text-sky-500"
                      }`}
                    >
                      {diff >= 0 ? `${buyLabel} +` : "Alugar +"}
                      <Money value={Math.abs(diff)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
