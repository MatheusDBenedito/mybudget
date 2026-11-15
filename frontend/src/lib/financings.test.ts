import test from 'node:test';
import assert from 'node:assert/strict';
import {
  annualPctToMonthlyRate,
  compareBuyVsRent,
  computeFgtsEligibilityClient,
  computeInsuranceSummary,
  formatMonthsAsYearsAndMonths,
  irRateForDays,
} from './financings.ts';

test('annualPctToMonthlyRate converts annual rate to monthly compound rate', () => {
  const monthly = annualPctToMonthlyRate(12.6825);
  assert.ok(Math.abs(monthly - 0.01) < 0.0005);
  assert.equal(annualPctToMonthlyRate(0), 0);
});

test('irRateForDays follows Brazilian regressive IR table', () => {
  assert.equal(irRateForDays(90), 0.225);
  assert.equal(irRateForDays(200), 0.2);
  assert.equal(irRateForDays(500), 0.175);
  assert.equal(irRateForDays(900), 0.15);
});

test('computeFgtsEligibilityClient enforces 2-year interval', () => {
  const now = new Date('2026-11-14T12:00:00Z');
  const blocked = computeFgtsEligibilityClient('2025-10-28', now);
  assert.equal(blocked.canUse, false);
  assert.equal(blocked.nextEligibleDate, '2027-10-28');
  assert.ok(blocked.remainingDays > 300);

  const eligible = computeFgtsEligibilityClient('2023-08-21', now);
  assert.equal(eligible.canUse, true);
  assert.equal(eligible.remainingDays, 0);
});

test('formatMonthsAsYearsAndMonths formats cleanly', () => {
  assert.equal(formatMonthsAsYearsAndMonths(295), '24a 7m');
  assert.equal(formatMonthsAsYearsAndMonths(24), '2a');
  assert.equal(formatMonthsAsYearsAndMonths(7), '7m');
});

test('computeInsuranceSummary aggregates MIP, DFI and TSA from installments', () => {
  const result = computeInsuranceSummary({
    currentBalance: 227035.68,
    propertyValue: 450000,
    monthlyInsurance: 58.06,
    monthlyAdminFee: 25,
    installments: [
      {
        id: '1',
        financingId: 'f1',
        installmentCode: '1',
        installmentNumber: 1,
        dueDate: '2023-09-21T00:00:00.000Z',
        paidDate: '2023-09-21T00:00:00.000Z',
        status: 'PAID',
        totalAmount: 3006.76,
        principalAmount: 729.77,
        interestAmount: 2193.04,
        mipAmount: 34.16,
        dfiAmount: 24.79,
        tsaAmount: 25,
        fineAmount: 0,
        monetaryCorrection: 1.001778,
        paidAmount: 3006.76,
        balanceAfter: 261986.51,
      },
      {
        id: '2',
        financingId: 'f1',
        installmentCode: '2',
        installmentNumber: 2,
        dueDate: '2026-11-21T00:00:00.000Z',
        paidDate: null,
        status: 'PENDING',
        totalAmount: 2900.0,
        principalAmount: 750.0,
        interestAmount: 2065.0,
        mipAmount: 30.0,
        dfiAmount: 25.0,
        tsaAmount: 25,
        fineAmount: 0,
        monetaryCorrection: 1,
        paidAmount: 0,
        balanceAfter: 226285.68,
      },
    ],
  });

  assert.equal(result.hasInstallments, true);
  assert.equal(result.currentMip, 30);
  assert.equal(result.currentDfi, 25);
  assert.equal(result.currentTsa, 25);
  assert.equal(result.currentInsuranceTotal, 55);
  assert.equal(result.mipPaid, 34.16);
  assert.equal(result.mipPending, 30);
  assert.equal(result.dfiPaid, 24.79);
  assert.equal(result.dfiPending, 25);
  assert.equal(result.insurancePaidTotal, 58.95);
  assert.equal(result.insurancePendingTotal, 55);
  assert.equal(result.insuranceContractTotal, 113.95);
  assert.equal(result.mipCoverageAmount, 227035.68);
  assert.equal(result.dfiCoverageAmount, 450000);
  assert.ok(result.mipMonthlyRatePct > 0);
  assert.ok(result.dfiMonthlyRatePct > 0);
});

test('computeInsuranceSummary falls back gracefully when there are no installments', () => {
  const result = computeInsuranceSummary({
    currentBalance: 200000,
    propertyValue: 400000,
    monthlyInsurance: 60,
    monthlyAdminFee: 25,
    installments: [],
  });

  assert.equal(result.hasInstallments, false);
  assert.equal(result.currentInsuranceTotal, 60);
  assert.equal(result.currentTsa, 25);
  assert.equal(result.insuranceContractTotal, 0);
});

test('compareBuyVsRent favors RENT when investment return far exceeds financing + appreciation', () => {
  const res = compareBuyVsRent({
    propertyValue: 450000,
    downPayment: 187750,
    closingCostsPct: 4,
    financedAmount: 262250,
    annualInterestRatePct: 10.49,
    totalMonths: 333,
    system: 'SAC',
    monthlyFees: 85,
    monthlyRent: 2000,
    rentAnnualAdjustmentPct: 4.5,
    propertyAppreciationPct: 2.0,
    investmentNetAnnualRatePct: 12.5,
    ownerMaintenanceAnnualPct: 0.5,
    horizonMonths: 120,
  });

  assert.equal(res.horizonMonths, 120);
  assert.equal(res.series.length, 120);
  assert.equal(res.winner, 'RENT');
  assert.ok(res.finalRentNetWorth > res.finalBuyNetWorth);
  assert.ok(res.initialCapitalInvestedInRent > 187750);
});

test('compareBuyVsRent favors BUY when rent is high and property appreciates strongly', () => {
  const res = compareBuyVsRent({
    propertyValue: 450000,
    downPayment: 90000,
    closingCostsPct: 3,
    financedAmount: 360000,
    annualInterestRatePct: 8.5,
    totalMonths: 360,
    system: 'SAC',
    monthlyFees: 80,
    monthlyRent: 3800,
    rentAnnualAdjustmentPct: 6.0,
    propertyAppreciationPct: 7.0,
    investmentNetAnnualRatePct: 8.0,
    ownerMaintenanceAnnualPct: 0,
    horizonMonths: 240,
  });

  assert.equal(res.winner, 'BUY');
  assert.ok(res.finalBuyNetWorth > res.finalRentNetWorth);
  assert.ok(res.rentOvertakesInstallmentMonth !== null);
});

test('compareBuyVsRent KEEP_OR_SELL calculates net sale equity after selling costs and debt', () => {
  const res = compareBuyVsRent({
    mode: 'KEEP_OR_SELL',
    propertyValue: 900000,
    purchasePrice: 445000,
    renovationCost: 150000,
    sellingCostsPct: 5,
    downPayment: 0,
    closingCostsPct: 0,
    financedAmount: 227000,
    annualInterestRatePct: 10.49,
    totalMonths: 295,
    system: 'SAC',
    monthlyFees: 85,
    monthlyRent: 4500,
    rentAnnualAdjustmentPct: 4.5,
    propertyAppreciationPct: 4.5,
    investmentNetAnnualRatePct: 12.0,
    ownerMaintenanceAnnualPct: 0.5,
    horizonMonths: 120,
  });

  // 900000 - 5% (45000) - 227000 = 628000
  assert.equal(res.mode, 'KEEP_OR_SELL');
  assert.equal(res.initialCapitalInvestedInRent, 628000);
  // 900000 - 445000 - 150000 = 305000
  assert.equal(res.equityGainFromRenovation, 305000);
});
