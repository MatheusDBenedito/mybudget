export type AmortizationSystem = 'SAC' | 'PRICE';
export type FinancingIndexer = 'TR' | 'IPCA' | 'POUPANCA' | 'FIXO';
export type FinancingInstallmentStatus = 'PAID' | 'PENDING';
export type ExtraAmortizationStrategy = 'REDUCE_TERM' | 'REDUCE_INSTALLMENT';
export type ExtraAmortizationSource = 'OWN_FUNDS' | 'FGTS';
export type InvestmentBenchmarkType = 'CDB' | 'LCI_LCA' | 'CUSTOM';

export interface FgtsEligibility {
  canUse: boolean;
  lastUsageDate: string | null;
  nextEligibleDate: string | null;
  remainingDays: number;
  statusLabel: string;
}

export interface FinancingRecord {
  id: string;
  workspaceId: string;
  name: string;
  bankName: string;
  contractNumber: string | null;
  propertyAddress: string | null;
  system: AmortizationSystem;
  indexer: FinancingIndexer;
  propertyValue: number;
  downPayment: number;
  financedAmount: number;
  currentBalance: number;
  nominalRateAnnual: number;
  effectiveRateAnnual: number | null;
  cetAnnual: number | null;
  totalMonths: number;
  dueDay: number;
  contractDate: string;
  releaseDate: string | null;
  monthlyAdminFee: number;
  monthlyInsurance: number;
  fgtsBalance: number;
  lastFgtsUsageDate: string | null;
  linkedFixedDescription?: string | null;
  notes: string | null;
  fgtsEligibility?: FgtsEligibility;
}

export interface FixedExpenseOption {
  description: string;
  amount: number;
  categoryName: string | null;
  accountId: string | null;
  lastDate: string;
}

export interface FinancingInstallmentRecord {
  id: string;
  financingId: string;
  installmentCode: string;
  installmentNumber: number | null;
  dueDate: string;
  paidDate: string | null;
  status: FinancingInstallmentStatus;
  totalAmount: number;
  principalAmount: number;
  interestAmount: number;
  mipAmount: number;
  dfiAmount: number;
  tsaAmount: number;
  fineAmount: number;
  monetaryCorrection: number;
  paidAmount: number;
  balanceAfter: number;
}

export interface FinancingExtraAmortizationRecord {
  id: string;
  financingId: string;
  date: string;
  amount: number;
  strategy: ExtraAmortizationStrategy;
  source: ExtraAmortizationSource;
  installmentsReduced: number;
  notes: string | null;
}

export interface FinancingEvolutionPoint {
  id: string;
  code: string;
  installmentNumber: number | null;
  month: string;
  dueDate: string;
  principal: number;
  interest: number;
  fees: number;
  total: number;
  balance: number;
  status: FinancingInstallmentStatus;
  trRatePct?: number;
  trAmount?: number;
}

export interface FinancingDashboardSummary {
  financing: FinancingRecord & {
    installments: FinancingInstallmentRecord[];
    extraAmortizations: FinancingExtraAmortizationRecord[];
  };
  kpis: {
    currentBalance: number;
    financedAmount: number;
    realAmortizationPaid: number;
    installmentPrincipalPaid: number;
    totalExtraAmortized: number;
    totalInterestPaid: number;
    totalFeesPaid: number;
    totalTrPaid?: number;
    totalPaidOverall: number;
    paidInstallmentsCount: number;
    totalMonths: number;
    remainingMonths: number;
    monthsReducedByExtra: number;
    progressPct: number;
  };
  fgtsEligibility: FgtsEligibility;
  cdiAnnualRatePct: number;
  evolutionSeries: FinancingEvolutionPoint[];
}

export interface ScheduleSummary {
  months: number;
  totalPrincipal: number;
  totalInterest: number;
  totalFees: number;
  totalPaid: number;
  firstInstallment: number;
  payoffDate: string;
}

export interface AmortizationSimulationResult {
  baseline: ScheduleSummary;
  reduceTerm: ScheduleSummary & {
    monthsSaved: number;
    interestSaved: number;
    effectiveExtraAmount?: number;
    unusedExtraAmount?: number;
  };
  reduceInstallment: ScheduleSummary & {
    monthsSaved: number;
    interestSaved: number;
    installmentDrop: number;
  };
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
  netDifference: number;
  recommendation: 'AMORTIZE' | 'INVEST' | 'TIE';
  series: AmortizeVsInvestPoint[];
}

export const MAJOR_BANKS = [
  'Bradesco',
  'Caixa Econômica Federal',
  'Itaú',
  'Santander',
  'Banco do Brasil',
] as const;

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

export function computeFgtsEligibilityClient(
  lastUsageDate: Date | string | null | undefined,
  now = new Date()
): FgtsEligibility {
  if (!lastUsageDate) {
    return {
      canUse: true,
      lastUsageDate: null,
      nextEligibleDate: null,
      remainingDays: 0,
      statusLabel: 'Elegível agora (sem uso anterior registrado)',
    };
  }

  const parsed =
    typeof lastUsageDate === 'string'
      ? new Date(lastUsageDate.includes('T') ? lastUsageDate : `${lastUsageDate}T12:00:00Z`)
      : new Date(lastUsageDate);

  if (Number.isNaN(parsed.getTime())) {
    return {
      canUse: true,
      lastUsageDate: null,
      nextEligibleDate: null,
      remainingDays: 0,
      statusLabel: 'Elegível agora',
    };
  }

  const eligible = new Date(parsed);
  eligible.setUTCFullYear(eligible.getUTCFullYear() + 2);

  const msDiff = eligible.getTime() - now.getTime();
  const remainingDays = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
  const canUse = remainingDays === 0;

  return {
    canUse,
    lastUsageDate: parsed.toISOString().slice(0, 10),
    nextEligibleDate: eligible.toISOString().slice(0, 10),
    remainingDays,
    statusLabel: canUse
      ? 'Elegível para uso do FGTS'
      : `Aguardando carência de 2 anos (${remainingDays} dias restantes)`,
  };
}

export function formatMonthsAsYearsAndMonths(totalMonths: number): string {
  const safe = Math.max(0, Math.round(totalMonths));
  const years = Math.floor(safe / 12);
  const months = safe % 12;
  if (years === 0) return `${months}m`;
  if (months === 0) return `${years}a`;
  return `${years}a ${months}m`;
}

export interface FinancingInsuranceSummary {
  hasInstallments: boolean;
  currentMip: number;
  currentDfi: number;
  currentTsa: number;
  currentInsuranceTotal: number;
  currentInstallmentTotal: number;
  insuranceShareOfInstallmentPct: number;
  mipPaid: number;
  mipPending: number;
  mipTotal: number;
  dfiPaid: number;
  dfiPending: number;
  dfiTotal: number;
  tsaPaid: number;
  tsaPending: number;
  tsaTotal: number;
  insurancePaidTotal: number;
  insurancePendingTotal: number;
  insuranceContractTotal: number;
  mipMonthlyRatePct: number;
  dfiMonthlyRatePct: number;
  estimatedAnnualInsuranceRatePct: number;
  mipCoverageAmount: number;
  dfiCoverageAmount: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

export function computeInsuranceSummary(
  financing: Pick<
    FinancingRecord,
    'currentBalance' | 'propertyValue' | 'monthlyInsurance' | 'monthlyAdminFee'
  > & {
    installments: readonly FinancingInstallmentRecord[];
  }
): FinancingInsuranceSummary {
  const installments = financing.installments ?? [];
  const hasInstallments = installments.length > 0;

  if (!hasInstallments) {
    const currentInsuranceTotal = round2(Math.max(0, financing.monthlyInsurance || 0));
    const currentTsa = round2(Math.max(0, financing.monthlyAdminFee || 0));
    const estimatedAnnualInsuranceRatePct =
      financing.currentBalance > 0 && currentInsuranceTotal > 0
        ? Number((((currentInsuranceTotal * 12) / financing.currentBalance) * 100).toFixed(2))
        : 0;

    return {
      hasInstallments: false,
      currentMip: 0,
      currentDfi: 0,
      currentTsa,
      currentInsuranceTotal,
      currentInstallmentTotal: 0,
      insuranceShareOfInstallmentPct: 0,
      mipPaid: 0,
      mipPending: 0,
      mipTotal: 0,
      dfiPaid: 0,
      dfiPending: 0,
      dfiTotal: 0,
      tsaPaid: 0,
      tsaPending: 0,
      tsaTotal: 0,
      insurancePaidTotal: 0,
      insurancePendingTotal: 0,
      insuranceContractTotal: 0,
      mipMonthlyRatePct: 0,
      dfiMonthlyRatePct: 0,
      estimatedAnnualInsuranceRatePct,
      mipCoverageAmount: financing.currentBalance,
      dfiCoverageAmount: financing.propertyValue,
    };
  }

  let mipPaid = 0;
  let mipPending = 0;
  let dfiPaid = 0;
  let dfiPending = 0;
  let tsaPaid = 0;
  let tsaPending = 0;

  for (const inst of installments) {
    if (inst.status === 'PAID') {
      mipPaid += inst.mipAmount || 0;
      dfiPaid += inst.dfiAmount || 0;
      tsaPaid += inst.tsaAmount || 0;
    } else {
      mipPending += inst.mipAmount || 0;
      dfiPending += inst.dfiAmount || 0;
      tsaPending += inst.tsaAmount || 0;
    }
  }

  const nextPending = installments.find(
    (inst) => inst.status === 'PENDING' && (inst.installmentNumber ?? 0) > 0
  );
  const paidRegular = installments.filter(
    (inst) => inst.status === 'PAID' && (inst.installmentNumber ?? 0) > 0
  );
  const currentRef =
    nextPending ??
    paidRegular[paidRegular.length - 1] ??
    installments[installments.length - 1];

  const currentMip = round2(currentRef?.mipAmount || 0);
  const currentDfi = round2(currentRef?.dfiAmount || 0);
  const currentTsa = round2(currentRef?.tsaAmount || 0);
  const currentInsuranceTotal = round2(currentMip + currentDfi);
  const currentInstallmentTotal = round2(currentRef?.totalAmount || 0);

  const insuranceShareOfInstallmentPct =
    currentInstallmentTotal > 0
      ? Number(((currentInsuranceTotal / currentInstallmentTotal) * 100).toFixed(2))
      : 0;

  const mipMonthlyRatePct =
    financing.currentBalance > 0 && currentMip > 0
      ? Number(((currentMip / financing.currentBalance) * 100).toFixed(4))
      : 0;

  const dfiMonthlyRatePct =
    financing.propertyValue > 0 && currentDfi > 0
      ? Number(((currentDfi / financing.propertyValue) * 100).toFixed(4))
      : 0;

  const estimatedAnnualInsuranceRatePct =
    financing.currentBalance > 0 && currentInsuranceTotal > 0
      ? Number((((currentInsuranceTotal * 12) / financing.currentBalance) * 100).toFixed(2))
      : 0;

  const mipPaidR = round2(mipPaid);
  const mipPendingR = round2(mipPending);
  const dfiPaidR = round2(dfiPaid);
  const dfiPendingR = round2(dfiPending);
  const tsaPaidR = round2(tsaPaid);
  const tsaPendingR = round2(tsaPending);

  return {
    hasInstallments: true,
    currentMip,
    currentDfi,
    currentTsa,
    currentInsuranceTotal,
    currentInstallmentTotal,
    insuranceShareOfInstallmentPct,
    mipPaid: mipPaidR,
    mipPending: mipPendingR,
    mipTotal: round2(mipPaidR + mipPendingR),
    dfiPaid: dfiPaidR,
    dfiPending: dfiPendingR,
    dfiTotal: round2(dfiPaidR + dfiPendingR),
    tsaPaid: tsaPaidR,
    tsaPending: tsaPendingR,
    tsaTotal: round2(tsaPaidR + tsaPendingR),
    insurancePaidTotal: round2(mipPaidR + dfiPaidR),
    insurancePendingTotal: round2(mipPendingR + dfiPendingR),
    insuranceContractTotal: round2(mipPaidR + mipPendingR + dfiPaidR + dfiPendingR),
    mipMonthlyRatePct,
    dfiMonthlyRatePct,
    estimatedAnnualInsuranceRatePct,
    mipCoverageAmount: financing.currentBalance,
    dfiCoverageAmount: financing.propertyValue,
  };
}

export type BuyVsRentMode = 'KEEP_OR_SELL' | 'BUY_FROM_SCRATCH';

export interface BuyVsRentInput {
  mode?: BuyVsRentMode;
  propertyValue: number;
  purchasePrice?: number;
  renovationCost?: number;
  sellingCostsPct?: number;
  downPayment: number;
  closingCostsPct: number;
  financedAmount: number;
  annualInterestRatePct: number;
  totalMonths: number;
  system: AmortizationSystem;
  monthlyFees: number;
  monthlyRent: number;
  rentAnnualAdjustmentPct: number;
  propertyAppreciationPct: number;
  investmentNetAnnualRatePct: number;
  ownerMaintenanceAnnualPct: number;
  horizonMonths: number;
}

export interface BuyVsRentPoint {
  month: number;
  year: number;
  buyOutflow: number;
  rentOutflow: number;
  buyNetWorth: number;
  rentNetWorth: number;
  propertyValue: number;
  remainingDebt: number;
  cumulativeInterestAndFees: number;
  cumulativeRentPaid: number;
}

export interface BuyVsRentResult {
  mode: BuyVsRentMode;
  initialCapitalInvestedInRent: number;
  equityGainFromRenovation: number;
  horizonMonths: number;
  finalBuyNetWorth: number;
  finalRentNetWorth: number;
  netWorthDifference: number;
  winner: 'BUY' | 'RENT' | 'TIE';
  totalInterestAndFeesPaid: number;
  totalRentPaid: number;
  firstMonthBuyOutflow: number;
  firstMonthRentOutflow: number;
  rentOvertakesInstallmentMonth: number | null;
  buyOvertakesRentNetWorthMonth: number | null;
  series: BuyVsRentPoint[];
}

export function compareBuyVsRent(input: BuyVsRentInput): BuyVsRentResult {
  const mode: BuyVsRentMode = input.mode ?? 'BUY_FROM_SCRATCH';
  const safePropertyValue = Math.max(1, input.propertyValue || 1);
  const safeDownPayment = Math.max(0, input.downPayment || 0);
  const safeFinanced = Math.max(0, input.financedAmount || 0);

  const safeClosingCosts =
    safePropertyValue * (Math.max(0, input.closingCostsPct || 0) / 100);
  const safeSellingCosts =
    safePropertyValue * (Math.max(0, input.sellingCostsPct ?? 0) / 100);

  const initialCapital =
    mode === 'KEEP_OR_SELL'
      ? round2(Math.max(0, safePropertyValue - safeSellingCosts - safeFinanced))
      : round2(safeDownPayment + safeClosingCosts);

  const equityGainFromRenovation = round2(
    safePropertyValue -
      (input.purchasePrice ?? safePropertyValue) -
      (input.renovationCost ?? 0)
  );
  const safeTotalMonths = Math.max(1, Math.round(input.totalMonths || 1));
  const horizonMonths = Math.max(1, Math.round(input.horizonMonths || safeTotalMonths));
  const safeMonthlyFees = Math.max(0, input.monthlyFees || 0);

  const monthlyLoanRate = annualPctToMonthlyRate(input.annualInterestRatePct);
  const monthlyInvestRate = annualPctToMonthlyRate(input.investmentNetAnnualRatePct);
  const monthlyAppreciationRate = annualPctToMonthlyRate(
    input.propertyAppreciationPct
  );
  const rentAnnualFactor = 1 + Math.max(0, input.rentAnnualAdjustmentPct || 0) / 100;
  const monthlyMaintenanceRate =
    Math.max(0, input.ownerMaintenanceAnnualPct || 0) / 100 / 12;

  let priceInstallment = 0;
  if (input.system === 'PRICE' && safeFinanced > 0) {
    if (monthlyLoanRate > 0) {
      const factor = Math.pow(1 + monthlyLoanRate, safeTotalMonths);
      priceInstallment = (safeFinanced * (monthlyLoanRate * factor)) / (factor - 1);
    } else {
      priceInstallment = safeFinanced / safeTotalMonths;
    }
  }
  const sacPrincipal =
    input.system === 'SAC' && safeTotalMonths > 0
      ? safeFinanced / safeTotalMonths
      : 0;

  let remainingDebt = safeFinanced;
  let currentPropertyValue = safePropertyValue;
  let rentPortfolio = initialCapital;
  let cumulativeInterestAndFees = 0;
  let cumulativeRentPaid = 0;

  let firstMonthBuyOutflow = 0;
  let firstMonthRentOutflow = 0;
  let rentOvertakesInstallmentMonth: number | null = null;
  let buyOvertakesRentNetWorthMonth: number | null = null;

  const series: BuyVsRentPoint[] = [];

  for (let m = 1; m <= horizonMonths; m++) {
    // Property appreciates monthly
    currentPropertyValue = currentPropertyValue * (1 + monthlyAppreciationRate);

    // Loan payment in month m
    let loanPayment = 0;
    if (m <= safeTotalMonths && remainingDebt > 0.01) {
      const interest = remainingDebt * monthlyLoanRate;
      let principal = 0;
      if (input.system === 'SAC') {
        principal = Math.min(remainingDebt, sacPrincipal);
      } else {
        principal = Math.min(remainingDebt, Math.max(0, priceInstallment - interest));
      }
      remainingDebt = Math.max(0, remainingDebt - principal);
      loanPayment = principal + interest + safeMonthlyFees;
      cumulativeInterestAndFees += interest + safeMonthlyFees;
    }

    const maintenanceCost = currentPropertyValue * monthlyMaintenanceRate;
    const buyOutflow = loanPayment + maintenanceCost;

    // Rent adjusts once every 12 months
    const completedYears = Math.floor((m - 1) / 12);
    const rentOutflow =
      Math.max(0, input.monthlyRent || 0) * Math.pow(rentAnnualFactor, completedYears);
    cumulativeRentPaid += rentOutflow;

    if (m === 1) {
      firstMonthBuyOutflow = round2(buyOutflow);
      firstMonthRentOutflow = round2(rentOutflow);
    }

    if (
      rentOvertakesInstallmentMonth === null &&
      rentOutflow > buyOutflow
    ) {
      rentOvertakesInstallmentMonth = m;
    }

    // Rent scenario invests monthly savings (or withdraws if rent > buyOutflow)
    const monthlySavings = buyOutflow - rentOutflow;
    rentPortfolio = rentPortfolio * (1 + monthlyInvestRate) + monthlySavings;

    const buyNetWorth = currentPropertyValue - remainingDebt;
    const rentNetWorth = rentPortfolio;

    if (
      buyOvertakesRentNetWorthMonth === null &&
      buyNetWorth >= rentNetWorth
    ) {
      buyOvertakesRentNetWorthMonth = m;
    }

    series.push({
      month: m,
      year: Math.ceil(m / 12),
      buyOutflow: round2(buyOutflow),
      rentOutflow: round2(rentOutflow),
      buyNetWorth: round2(buyNetWorth),
      rentNetWorth: round2(rentNetWorth),
      propertyValue: round2(currentPropertyValue),
      remainingDebt: round2(remainingDebt),
      cumulativeInterestAndFees: round2(cumulativeInterestAndFees),
      cumulativeRentPaid: round2(cumulativeRentPaid),
    });
  }

  const last = series[series.length - 1];
  const finalBuyNetWorth = last ? last.buyNetWorth : round2(safePropertyValue - safeFinanced);
  const finalRentNetWorth = last ? last.rentNetWorth : initialCapital;
  const netWorthDifference = round2(finalBuyNetWorth - finalRentNetWorth);

  let winner: 'BUY' | 'RENT' | 'TIE' = 'TIE';
  if (netWorthDifference > 100) winner = 'BUY';
  else if (netWorthDifference < -100) winner = 'RENT';

  return {
    mode,
    initialCapitalInvestedInRent: initialCapital,
    equityGainFromRenovation,
    horizonMonths,
    finalBuyNetWorth,
    finalRentNetWorth,
    netWorthDifference,
    winner,
    totalInterestAndFeesPaid: round2(cumulativeInterestAndFees),
    totalRentPaid: round2(cumulativeRentPaid),
    firstMonthBuyOutflow,
    firstMonthRentOutflow,
    rentOvertakesInstallmentMonth,
    buyOvertakesRentNetWorthMonth,
    series,
  };
}
