import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCdiIrMatrix,
  irRateForElapsedMonths,
  simulateInvestmentGoal,
} from './investment-goals.ts';

describe('investment-goals', () => {
  it('applies regressive IR brackets as months progress', () => {
    assert.equal(irRateForElapsedMonths(1), 0.225);
    assert.equal(irRateForElapsedMonths(6), 0.225);
    assert.equal(irRateForElapsedMonths(7), 0.20);
    assert.equal(irRateForElapsedMonths(12), 0.20);
    assert.equal(irRateForElapsedMonths(13), 0.175);
    assert.equal(irRateForElapsedMonths(24), 0.175);
    assert.equal(irRateForElapsedMonths(25), 0.15);
    assert.equal(irRateForElapsedMonths(120), 0.15);
  });

  it('matches the spreadsheet baseline calculation for month 1 and reduces IR over 10 years', () => {
    const sim = simulateInvestmentGoal({
      initialAmount: 57795.23,
      monthlySalary: 14733,
      monthlyExpense: 9000,
      emergencyReserveMonths: 6,
      savingsRatePct: 15,
      cdiPercentage: 100,
      cdiAnnualRatePct: 13.65,
      horizonMonths: 120,
      startMonth: 6,
      startYear: 2026,
      targetAmount: 500000,
    });

    assert.equal(sim.monthlySavingsBrl, 2209.95);
    assert.equal(sim.emergencyReserveTargetBrl, 54000);
    assert.equal(sim.months.length, 120);

    // Month 1: 57,795.23 with 100% of 13.65% CDI and 22.5% IR => ~480.16 net yield
    const m1 = sim.months[0];
    assert.equal(m1.contribution, 0);
    assert.equal(m1.irRatePct, 22.5);
    assert.ok(Math.abs(m1.netYield - 480.16) <= 0.05);

    // Month 2 adds monthlySavingsBrl
    const m2 = sim.months[1];
    assert.equal(m2.contribution, 2209.95);
    assert.equal(m2.irRatePct, 22.5);

    // Year 3+ (month 25+) drops IR to 15%
    const m25 = sim.months[24];
    assert.equal(m25.irRatePct, 15);
    assert.ok(sim.totalIrPaid > 0);
    assert.ok(sim.finalNetBalance > sim.totalContributed);
    assert.equal(sim.emergencyReserveReachedMonth?.ref, 1);
    assert.ok(sim.targetReachedMonth && sim.targetReachedMonth.ref < 120);
  });

  it('builds CDI x IR comparison matrix including custom CDI percentage', () => {
    const matrix = buildCdiIrMatrix(13.65, 57795.23, 110);
    assert.deepEqual(
      matrix.map((r) => r.cdiPercentage),
      [100, 103, 105, 110, 120],
    );
    assert.equal(matrix[0].byIrBracket.length, 4);
  });
});
