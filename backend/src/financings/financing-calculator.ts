export type AmortizationSystemType = 'SAC' | 'PRICE';
export type ExtraStrategyType = 'REDUCE_TERM' | 'REDUCE_INSTALLMENT';
export type InvestmentBenchmarkType = 'CDB' | 'LCI_LCA' | 'CUSTOM';

export interface ScheduleInput {
  currentBalance: number;
  annualInterestRatePct: number; // e.g. 10.49
  remainingMonths: number;
  system: AmortizationSystemType;
  monthlyAdminFee?: number;
  monthlyInsurance?: number;
  extraAmount?: number;
  monthlyExtra?: number;
  strategy?: ExtraStrategyType;
  startDate?: Date;
}

export interface ProjectedInstallment {
  monthIndex: number;
  date: string; // YYYY-MM-DD
  principal: number;
  interest: number;
  fees: number;
  total: number;
  balanceAfter: number;
}

export interface ScheduleSummary {
  months: number;
  totalPrincipal: number;
  totalInterest: number;
  totalFees: number;
  totalPaid: number;
  firstInstallment: number;
  payoffDate: string;
  schedule: ProjectedInstallment[];
}

export interface AmortizationSimulationResult {
  baseline: ScheduleSummary;
  reduceTerm: ScheduleSummary & {
    monthsSaved: number;
    interestSaved: number;
    effectiveExtraAmount: number;
    unusedExtraAmount: number;
  };
  reduceInstallment: ScheduleSummary & {
    monthsSaved: number;
    interestSaved: number;
    installmentDrop: number;
  };
}

export interface AmortizeVsInvestInput {
  amount: number;
  currentBalance: number;
  financingAnnualRatePct: number;
  remainingMonths: number;
  system: AmortizationSystemType;
  cdiAnnualRatePct: number;
  cdiPercentage: number; // e.g. 100 for 100% CDI
  investmentType: InvestmentBenchmarkType;
  customAnnualRatePct?: number;
  horizonMonths?: number;
}

export interface AmortizeVsInvestPoint {
  month: number;
  amortizeAdvantageNet: number;
  investBalanceNet: number;
  debtSavedWithAmortization: number;
}

export interface AmortizeVsInvestResult {
  financingAnnualRatePct: number;
  grossInvestmentAnnualRatePct: number;
  netInvestmentAnnualRatePct: number;
  irRatePct: number;
  breakEvenCdiPct: number;
  horizonMonths: number;
  amortizeTotalBenefit: number;
  investNetFinalValue: number;
  netDifference: number; // positive = amortize is better; negative = invest is better
  recommendation: 'AMORTIZE' | 'INVEST' | 'TIE';
  series: AmortizeVsInvestPoint[];
}

export interface FgtsEligibilityResult {
  canUse: boolean;
  lastUsageDate: string | null;
  nextEligibleDate: string | null;
  remainingDays: number;
  statusLabel: string;
}

export function annualPctToMonthlyRate(annualPct: number): number {
  if (!Number.isFinite(annualPct) || annualPct <= 0) return 0;
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

export function irRateForDays(days: number): number {
  if (days <= 180) return 0.225;
  if (days <= 360) return 0.2;
  if (days <= 720) return 0.175;
  return 0.15;
}

function addMonthsIso(base: Date, months: number): string {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, Math.min(base.getUTCDate(), 28)));
  return d.toISOString().slice(0, 10);
}

/**
 * In Brazilian SAC contracts, lump-sum extra amortization under REDUCE_TERM
 * eliminates an integer number of monthly principal quotas.
 */
export function computeReduceTermExtra(
  currentBalance: number,
  remainingMonths: number,
  extraAmount: number,
): number {
  const safeBalance = Math.max(0, currentBalance);
  const safeExtra = Math.max(0, extraAmount);
  if (safeBalance <= 0 || safeExtra <= 0 || remainingMonths <= 0) {
    return 0;
  }
  if (safeExtra >= safeBalance) {
    return Number(safeBalance.toFixed(2));
  }
  const quota = safeBalance / remainingMonths;
  const monthsEliminated = Math.min(remainingMonths, Math.floor(safeExtra / quota));
  return Number((monthsEliminated * quota).toFixed(2));
}

export function projectSchedule(input: ScheduleInput): ScheduleSummary {
  const {
    currentBalance,
    annualInterestRatePct,
    remainingMonths,
    system,
    monthlyAdminFee = 0,
    monthlyInsurance = 0,
    extraAmount = 0,
    monthlyExtra = 0,
    strategy = 'REDUCE_TERM',
    startDate = new Date(),
  } = input;

  const monthlyRate = annualPctToMonthlyRate(annualInterestRatePct);
  const feesPerMonth = Math.max(0, monthlyAdminFee) + Math.max(0, monthlyInsurance);
  const appliedExtra =
    strategy === 'REDUCE_TERM' && system === 'SAC' && monthlyExtra === 0
      ? computeReduceTermExtra(currentBalance, remainingMonths, extraAmount)
      : Math.max(0, extraAmount);
  let balance = Math.max(0, currentBalance - appliedExtra);

  if (balance <= 0.01 || remainingMonths <= 0) {
    return {
      months: 0,
      totalPrincipal: 0,
      totalInterest: 0,
      totalFees: 0,
      totalPaid: 0,
      firstInstallment: 0,
      payoffDate: addMonthsIso(startDate, 0),
      schedule: [],
    };
  }

  // Reference base principal/payment for REDUCE_TERM vs REDUCE_INSTALLMENT
  const sacBasePrincipal =
    strategy === 'REDUCE_TERM'
      ? currentBalance / remainingMonths
      : balance / remainingMonths;

  const priceFactor = (r: number, n: number) =>
    r === 0 ? 1 / n : (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  const priceTargetPmt =
    strategy === 'REDUCE_TERM'
      ? currentBalance * priceFactor(monthlyRate, remainingMonths)
      : balance * priceFactor(monthlyRate, remainingMonths);

  const schedule: ProjectedInstallment[] = [];
  let totalPrincipal = 0;
  let totalInterest = 0;
  let totalFees = 0;

  for (let m = 1; m <= remainingMonths && balance > 0.01; m++) {
    const interest = balance * monthlyRate;
    let basePrincipal =
      system === 'SAC'
        ? sacBasePrincipal
        : Math.max(0, priceTargetPmt - interest);

    if (basePrincipal > balance) basePrincipal = balance;

    const extraThisMonth = Math.min(Math.max(0, monthlyExtra), Math.max(0, balance - basePrincipal));
    const principal = basePrincipal + extraThisMonth;
    balance = Math.max(0, balance - principal);

    const fees = balance > 0.01 ? feesPerMonth : Math.max(0, monthlyAdminFee);
    const total = principal + interest + fees;

    totalPrincipal += principal;
    totalInterest += interest;
    totalFees += fees;

    schedule.push({
      monthIndex: m,
      date: addMonthsIso(startDate, m),
      principal: Number(principal.toFixed(2)),
      interest: Number(interest.toFixed(2)),
      fees: Number(fees.toFixed(2)),
      total: Number(total.toFixed(2)),
      balanceAfter: Number(balance.toFixed(2)),
    });
  }

  return {
    months: schedule.length,
    totalPrincipal: Number(totalPrincipal.toFixed(2)),
    totalInterest: Number(totalInterest.toFixed(2)),
    totalFees: Number(totalFees.toFixed(2)),
    totalPaid: Number((totalPrincipal + totalInterest + totalFees).toFixed(2)),
    firstInstallment: schedule[0]?.total ?? 0,
    payoffDate: schedule[schedule.length - 1]?.date ?? addMonthsIso(startDate, 0),
    schedule,
  };
}

export function simulateAmortization(input: Omit<ScheduleInput, 'strategy'>): AmortizationSimulationResult {
  const baseline = projectSchedule({
    ...input,
    extraAmount: 0,
    monthlyExtra: 0,
    strategy: 'REDUCE_TERM',
  });

  const reduceTermRaw = projectSchedule({
    ...input,
    strategy: 'REDUCE_TERM',
  });

  const reduceInstallmentRaw = projectSchedule({
    ...input,
    strategy: 'REDUCE_INSTALLMENT',
  });

  const requestedExtra = Math.max(0, input.extraAmount ?? 0);
  const effectiveExtraAmount =
    input.system === 'SAC' && (input.monthlyExtra ?? 0) === 0
      ? computeReduceTermExtra(input.currentBalance, input.remainingMonths, requestedExtra)
      : Number(Math.min(Math.max(0, input.currentBalance), requestedExtra).toFixed(2));
  const unusedExtraAmount = Number(Math.max(0, requestedExtra - effectiveExtraAmount).toFixed(2));

  return {
    baseline,
    reduceTerm: {
      ...reduceTermRaw,
      monthsSaved: Math.max(0, baseline.months - reduceTermRaw.months),
      interestSaved: Number(Math.max(0, baseline.totalInterest - reduceTermRaw.totalInterest).toFixed(2)),
      effectiveExtraAmount,
      unusedExtraAmount,
    },
    reduceInstallment: {
      ...reduceInstallmentRaw,
      monthsSaved: Math.max(0, baseline.months - reduceInstallmentRaw.months),
      interestSaved: Number(Math.max(0, baseline.totalInterest - reduceInstallmentRaw.totalInterest).toFixed(2)),
      installmentDrop: Number(Math.max(0, baseline.firstInstallment - reduceInstallmentRaw.firstInstallment).toFixed(2)),
    },
  };
}

export function compareAmortizeVsInvest(input: AmortizeVsInvestInput): AmortizeVsInvestResult {
  const amount = Math.max(0, input.amount);
  const horizonMonths = Math.max(1, Math.min(input.horizonMonths ?? input.remainingMonths, input.remainingMonths || 1));
  const irRate =
    input.investmentType === 'LCI_LCA'
      ? 0
      : input.investmentType === 'CUSTOM'
        ? 0
        : irRateForDays(horizonMonths * 30);

  const grossAnnualPct =
    input.investmentType === 'CUSTOM'
      ? Math.max(0, input.customAnnualRatePct ?? 0)
      : Math.max(0, input.cdiAnnualRatePct) * (Math.max(0, input.cdiPercentage) / 100);

  const grossMonthlyRate = annualPctToMonthlyRate(grossAnnualPct);
  const netAnnualRatePct =
    grossAnnualPct > 0
      ? (Math.pow(1 + grossMonthlyRate * (1 - irRate), 12) - 1) * 100
      : 0;
  const netMonthlyRate = annualPctToMonthlyRate(netAnnualRatePct);

  const sim = simulateAmortization({
    currentBalance: input.currentBalance,
    annualInterestRatePct: input.financingAnnualRatePct,
    remainingMonths: input.remainingMonths,
    system: input.system,
    extraAmount: amount,
  });

  const series: AmortizeVsInvestPoint[] = [];
  const step = Math.max(1, Math.floor(horizonMonths / 24));
  let cumBaselineInterest = 0;
  let cumAmortInterest = 0;

  for (let m = 1; m <= horizonMonths; m++) {
    cumBaselineInterest += sim.baseline.schedule[m - 1]?.interest ?? 0;
    cumAmortInterest += sim.reduceTerm.schedule[m - 1]?.interest ?? 0;

    if (m % step === 0 || m === horizonMonths || m === 1) {
      const investGross = amount * Math.pow(1 + grossMonthlyRate, m);
      const investGain = Math.max(0, investGross - amount);
      const investNet = amount + investGain * (1 - irRate);
      const debtSaved = amount + (cumBaselineInterest - cumAmortInterest);

      series.push({
        month: m,
        amortizeAdvantageNet: Number((debtSaved - investNet).toFixed(2)),
        investBalanceNet: Number(investNet.toFixed(2)),
        debtSavedWithAmortization: Number(debtSaved.toFixed(2)),
      });
    }
  }

  const finalPoint = series[series.length - 1];
  const amortizeTotalBenefit = finalPoint?.debtSavedWithAmortization ?? amount + sim.reduceTerm.interestSaved;
  const investNetFinalValue = finalPoint?.investBalanceNet ?? amount;
  const netDifference = Number((amortizeTotalBenefit - investNetFinalValue).toFixed(2));

  const cdiMonthly = annualPctToMonthlyRate(Math.max(0.01, input.cdiAnnualRatePct));
  const finMonthly = annualPctToMonthlyRate(Math.max(0, input.financingAnnualRatePct));
  const breakEvenCdiPct =
    cdiMonthly > 0
      ? Number((((finMonthly / (1 - irRate)) / cdiMonthly) * 100).toFixed(1))
      : 0;

  const recommendation: 'AMORTIZE' | 'INVEST' | 'TIE' =
    Math.abs(netDifference) < 50 ? 'TIE' : netDifference > 0 ? 'AMORTIZE' : 'INVEST';

  return {
    financingAnnualRatePct: Number(input.financingAnnualRatePct.toFixed(2)),
    grossInvestmentAnnualRatePct: Number(grossAnnualPct.toFixed(2)),
    netInvestmentAnnualRatePct: Number(netAnnualRatePct.toFixed(2)),
    irRatePct: Number((irRate * 100).toFixed(1)),
    breakEvenCdiPct,
    horizonMonths,
    amortizeTotalBenefit: Number(amortizeTotalBenefit.toFixed(2)),
    investNetFinalValue: Number(investNetFinalValue.toFixed(2)),
    netDifference,
    recommendation,
    series,
  };
}

export function computeFgtsEligibility(lastUsageDate: Date | string | null | undefined, now = new Date()): FgtsEligibilityResult {
  if (!lastUsageDate) {
    return {
      canUse: true,
      lastUsageDate: null,
      nextEligibleDate: null,
      remainingDays: 0,
      statusLabel: 'Liberado para uso (nenhuma utilização anterior registrada)',
    };
  }

  const parsed = typeof lastUsageDate === 'string' ? new Date(lastUsageDate) : lastUsageDate;
  if (Number.isNaN(parsed.getTime())) {
    return {
      canUse: true,
      lastUsageDate: null,
      nextEligibleDate: null,
      remainingDays: 0,
      statusLabel: 'Liberado para uso',
    };
  }

  const nextEligible = new Date(
    Date.UTC(parsed.getUTCFullYear() + 2, parsed.getUTCMonth(), parsed.getUTCDate()),
  );
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diffMs = nextEligible.getTime() - todayUtc.getTime();
  const remainingDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const canUse = remainingDays === 0;

  return {
    canUse,
    lastUsageDate: parsed.toISOString().slice(0, 10),
    nextEligibleDate: nextEligible.toISOString().slice(0, 10),
    remainingDays,
    statusLabel: canUse
      ? 'Liberado para uso (interstício de 2 anos cumprido)'
      : `Disponível em ${nextEligible.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} (${remainingDays} dias restantes)`,
  };
}
