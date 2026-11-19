// Pure calculation helpers for 10-year investment goals & spreadsheet projection.
// No React or browser APIs so it runs directly under `node --test`.

export interface InvestmentGoalInput {
  initialAmount: number;
  monthlySalary: number;
  monthlyExpense: number;
  emergencyReserveMonths: number;
  savingsRatePct: number;
  cdiPercentage: number;
  cdiAnnualRatePct: number;
  horizonMonths: number;
  startMonth: number; // 1..12
  startYear: number;
  targetAmount?: number | null;
}

export interface CdiIrMatrixRow {
  cdiPercentage: number;
  annualGrossPct: number;
  monthlyGrossPct: number;
  byIrBracket: Array<{
    irRatePct: number;
    monthlyNetPct: number;
    monthlyNetOnInitialBrl: number;
  }>;
}

export interface GoalProjectionMonth {
  ref: number; // 1..N
  month: number; // 1..12
  year: number;
  label: string; // "Nov/2026"
  startingBalance: number;
  contribution: number;
  investedBase: number;
  irRatePct: number;
  monthlyNetRatePct: number;
  grossYield: number;
  irTax: number;
  netYield: number;
  endingBalance: number;
  cumulativeContributed: number;
  cumulativeNetYield: number;
  cumulativeIrTax: number;
}

export interface GoalProjectionSummary {
  monthlySavingsBrl: number;
  emergencyReserveTargetBrl: number;
  emergencyReserveReachedMonth: GoalProjectionMonth | null;
  targetReachedMonth: GoalProjectionMonth | null;
  finalNetBalance: number;
  totalContributed: number;
  totalNetYield: number;
  totalIrPaid: number;
  initialMonthlyNetRatePct: number;
  initialAnnualNetRatePct: number;
  finalMonthlyNetRatePct: number;
  finalAnnualNetRatePct: number;
  months: GoalProjectionMonth[];
  matrix: CdiIrMatrixRow[];
}

export const IR_BRACKETS = [
  { label: "0 a 6 meses", maxMonths: 6, rate: 0.225 },
  { label: "6 meses a 1 ano", maxMonths: 12, rate: 0.20 },
  { label: "1 ano a 2 anos", maxMonths: 24, rate: 0.175 },
  { label: "Acima de 2 anos", maxMonths: Infinity, rate: 0.15 },
] as const;

const SHORT_MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export function irRateForElapsedMonths(elapsedMonths: number): number {
  if (elapsedMonths <= 6) return 0.225;
  if (elapsedMonths <= 12) return 0.20;
  if (elapsedMonths <= 24) return 0.175;
  return 0.15;
}

export function computeMonthlyGrossRate(cdiAnnualRatePct: number, cdiPercentage: number): number {
  const annual = Math.max(0, cdiAnnualRatePct / 100) * Math.max(0, cdiPercentage / 100);
  if (annual <= 0) return 0;
  return Math.pow(1 + annual, 1 / 12) - 1;
}

export function buildCdiIrMatrix(
  cdiAnnualRatePct: number,
  initialAmount: number,
  selectedCdiPercentage: number,
): CdiIrMatrixRow[] {
  const presets = [100, 103, 105, 120];
  const list = presets.includes(selectedCdiPercentage)
    ? presets
    : [...presets, selectedCdiPercentage].sort((a, b) => a - b);

  return list.map((cdiPercentage) => {
    const annualGross = Math.max(0, cdiAnnualRatePct / 100) * (cdiPercentage / 100);
    const monthlyGross = computeMonthlyGrossRate(cdiAnnualRatePct, cdiPercentage);
    return {
      cdiPercentage,
      annualGrossPct: Math.round(annualGross * 10000) / 100,
      monthlyGrossPct: Math.round(monthlyGross * 10000) / 100,
      byIrBracket: IR_BRACKETS.map((b) => {
        const monthlyNet = monthlyGross * (1 - b.rate);
        return {
          irRatePct: b.rate * 100,
          monthlyNetPct: Math.round(monthlyNet * 100000) / 1000,
          monthlyNetOnInitialBrl: round2(Math.max(0, initialAmount) * monthlyNet),
        };
      }),
    };
  });
}

export function simulateInvestmentGoal(input: InvestmentGoalInput): GoalProjectionSummary {
  const initialAmount = Math.max(0, Number(input.initialAmount) || 0);
  const monthlySalary = Math.max(0, Number(input.monthlySalary) || 0);
  const monthlyExpense = Math.max(0, Number(input.monthlyExpense) || 0);
  const emergencyReserveMonths = Math.max(0, Math.round(Number(input.emergencyReserveMonths) || 0));
  const savingsRatePct = Math.max(0, Math.min(100, Number(input.savingsRatePct) || 0));
  const cdiPercentage = Math.max(0, Number(input.cdiPercentage) || 0);
  const cdiAnnualRatePct = Math.max(0, Number(input.cdiAnnualRatePct) || 0);
  const horizonMonths = Math.max(1, Math.min(600, Math.round(Number(input.horizonMonths) || 120)));

  const monthlySavingsBrl = round2(monthlySalary * (savingsRatePct / 100));
  const emergencyReserveTargetBrl = round2(monthlyExpense * emergencyReserveMonths);
  const monthlyGrossRate = computeMonthlyGrossRate(cdiAnnualRatePct, cdiPercentage);

  const months: GoalProjectionMonth[] = [];
  let runningBalance = initialAmount;
  let cumulativeContributed = initialAmount;
  let cumulativeNetYield = 0;
  let cumulativeIrTax = 0;
  let emergencyReserveReachedMonth: GoalProjectionMonth | null = null;
  let targetReachedMonth: GoalProjectionMonth | null = null;

  for (let i = 0; i < horizonMonths; i++) {
    const ref = i + 1;
    const totalMonthsIdx = input.startYear * 12 + (input.startMonth - 1) + i;
    const year = Math.floor(totalMonthsIdx / 12);
    const month = (totalMonthsIdx % 12) + 1;
    const label = `${SHORT_MONTHS[month - 1]}/${year}`;

    // Month 1 compounds initialAmount (matching spreadsheet); if initialAmount == 0, starts contributing on Month 1
    const contribution = i === 0 && initialAmount > 0 ? 0 : monthlySavingsBrl;
    const startingBalance = round2(runningBalance);
    const investedBase = round2(runningBalance + contribution);
    cumulativeContributed = round2(cumulativeContributed + contribution);

    const irRate = irRateForElapsedMonths(ref);
    const monthlyNetRate = monthlyGrossRate * (1 - irRate);

    const grossYield = round2(investedBase * monthlyGrossRate);
    const irTax = round2(grossYield * irRate);
    const netYield = round2(grossYield - irTax);
    const endingBalance = round2(investedBase + netYield);

    runningBalance = endingBalance;
    cumulativeNetYield = round2(cumulativeNetYield + netYield);
    cumulativeIrTax = round2(cumulativeIrTax + irTax);

    const point: GoalProjectionMonth = {
      ref,
      month,
      year,
      label,
      startingBalance,
      contribution,
      investedBase,
      irRatePct: irRate * 100,
      monthlyNetRatePct: Math.round(monthlyNetRate * 100000) / 1000,
      grossYield,
      irTax,
      netYield,
      endingBalance,
      cumulativeContributed,
      cumulativeNetYield,
      cumulativeIrTax,
    };
    months.push(point);

    if (!emergencyReserveReachedMonth && emergencyReserveTargetBrl > 0 && endingBalance >= emergencyReserveTargetBrl) {
      emergencyReserveReachedMonth = point;
    }
    if (!targetReachedMonth && input.targetAmount && input.targetAmount > 0 && endingBalance >= input.targetAmount) {
      targetReachedMonth = point;
    }
  }

  const first = months[0];
  const last = months[months.length - 1];
  const initialMonthlyNet = monthlyGrossRate * (1 - irRateForElapsedMonths(1));
  const finalMonthlyNet = monthlyGrossRate * (1 - irRateForElapsedMonths(horizonMonths));

  return {
    monthlySavingsBrl,
    emergencyReserveTargetBrl,
    emergencyReserveReachedMonth,
    targetReachedMonth,
    finalNetBalance: last ? last.endingBalance : initialAmount,
    totalContributed: cumulativeContributed,
    totalNetYield: cumulativeNetYield,
    totalIrPaid: cumulativeIrTax,
    initialMonthlyNetRatePct: first ? first.monthlyNetRatePct : 0,
    initialAnnualNetRatePct: Math.round((Math.pow(1 + initialMonthlyNet, 12) - 1) * 100000) / 1000,
    finalMonthlyNetRatePct: last ? last.monthlyNetRatePct : 0,
    finalAnnualNetRatePct: Math.round((Math.pow(1 + finalMonthlyNet, 12) - 1) * 100000) / 1000,
    months,
    matrix: buildCdiIrMatrix(cdiAnnualRatePct, initialAmount, cdiPercentage),
  };
}
