import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
    buildTransferSummary,
    calculateTransferBonus,
    calculateTripMilesPlan,
    daysUntil,
    estimatePointsFromSpend,
    fromApiDate,
    getTransferInputError,
    getTripPlanInputError,
    isOverdue,
    parseCurrencyRateInput,
    parsePercentInput,
    parsePointsInput,
    resolveProgramRate,
    suggestExpectedCreditDate,
    toDateInputValue,
} from "./miles.ts";

describe("calculateTransferBonus", () => {
    test("applies the bonus percentage on top of the transferred points", () => {
        const r = calculateTransferBonus(10_000, 80);
        assert.equal(r.bonusMiles, 8_000);
        assert.equal(r.totalMiles, 18_000);
        assert.equal(r.milesPerPoint, 1.8);
    });

    test("0% bonus keeps 1:1 parity", () => {
        const r = calculateTransferBonus(5_000, 0);
        assert.equal(r.bonusMiles, 0);
        assert.equal(r.totalMiles, 5_000);
    });

    test("does not lose a mile to floating point error", () => {
        // 10000 * 0.7 = 6999.999... in floating point
        assert.equal(calculateTransferBonus(10_000, 70).bonusMiles, 7_000);
        assert.equal(calculateTransferBonus(1_000, 0.1 * 3 * 100).bonusMiles, 300);
    });

    test("rounds fractional bonus down (programs credit whole miles)", () => {
        assert.equal(calculateTransferBonus(1_001, 50).bonusMiles, 500);
        assert.equal(calculateTransferBonus(333, 33.33).bonusMiles, 110);
    });

    test("supports fractional percentages", () => {
        assert.equal(calculateTransferBonus(20_000, 12.5).bonusMiles, 2_500);
    });

    test("throws RangeError on invalid input", () => {
        assert.throws(() => calculateTransferBonus(0, 50), RangeError);
        assert.throws(() => calculateTransferBonus(-10, 50), RangeError);
        assert.throws(() => calculateTransferBonus(10.5, 50), RangeError);
        assert.throws(() => calculateTransferBonus(1000, -1), RangeError);
        assert.throws(() => calculateTransferBonus(1000, Number.NaN), RangeError);
        assert.throws(() => calculateTransferBonus(1000, 1001), RangeError);
    });
});

describe("getTransferInputError", () => {
    test("returns null for valid input", () => {
        assert.equal(getTransferInputError(1000, 100), null);
    });

    test("returns a message for each invalid case", () => {
        assert.match(getTransferInputError(0, 10)!, /maior que zero/);
        assert.match(getTransferInputError(1.5, 10)!, /inteiro/);
        assert.match(getTransferInputError(10, -5)!, /negativo/);
        assert.match(getTransferInputError(10, 5000)!, /1000%/);
    });
});

describe("input parsing", () => {
    test("parsePointsInput accepts pt-BR thousand separators", () => {
        assert.equal(parsePointsInput("10.000"), 10_000);
        assert.equal(parsePointsInput("1 500"), 1_500);
        assert.equal(parsePointsInput("250"), 250);
    });

    test("parsePointsInput rejects empty, decimals and text", () => {
        assert.ok(Number.isNaN(parsePointsInput("")));
        assert.ok(Number.isNaN(parsePointsInput("10,5")));
        assert.ok(Number.isNaN(parsePointsInput("abc")));
        assert.ok(Number.isNaN(parsePointsInput("-100")));
    });

    test("parsePercentInput accepts comma decimals and a percent sign", () => {
        assert.equal(parsePercentInput("12,5"), 12.5);
        assert.equal(parsePercentInput("80%"), 80);
        assert.equal(parsePercentInput("100"), 100);
    });

    test("parsePercentInput rejects empty and invalid values", () => {
        assert.ok(Number.isNaN(parsePercentInput("")));
        assert.ok(Number.isNaN(parsePercentInput("-10")));
        assert.ok(Number.isNaN(parsePercentInput("1,2,3")));
    });
});

describe("buildTransferSummary", () => {
    test("describes the operation with bonus", () => {
        const summary = buildTransferSummary("Livelo", "Smiles", calculateTransferBonus(10_000, 100));
        assert.match(summary, /10\.000 pontos de Livelo para Smiles com 100% de bônus/);
        assert.match(summary, /20\.000 milhas/);
        assert.match(summary, /10\.000 delas de bônus/);
        assert.match(summary, /2,00 milhas por ponto/);
    });

    test("describes a transfer without bonus", () => {
        const summary = buildTransferSummary("Esfera", "LATAM Pass", calculateTransferBonus(3_000, 0));
        assert.match(summary, /sem bônus/);
        assert.doesNotMatch(summary, /delas de bônus/);
    });

    test("falls back to generic program names", () => {
        const summary = buildTransferSummary("  ", "", calculateTransferBonus(100, 10));
        assert.match(summary, /o programa de origem para o programa de destino/);
    });
});

describe("estimatePointsFromSpend", () => {
    test("converts BRL spend to USD and applies the factor", () => {
        // R$ 5.500 / 5,50 = US$ 1.000 × 2,2 = 2.200 pontos
        assert.equal(estimatePointsFromSpend(5_500, 5.5, 2.2), 2_200);
    });

    test("rounds down partial points", () => {
        assert.equal(estimatePointsFromSpend(100, 5.6, 2.2), 39); // 39.28...
    });

    test("does not lose a point to floating point error", () => {
        assert.equal(estimatePointsFromSpend(1_000, 5, 1.1), 220);
    });

    test("returns 0 for refunds, zero or invalid values", () => {
        assert.equal(estimatePointsFromSpend(-200, 5.5, 2), 0);
        assert.equal(estimatePointsFromSpend(0, 5.5, 2), 0);
        assert.equal(estimatePointsFromSpend(1000, 0, 2), 0);
        assert.equal(estimatePointsFromSpend(1000, 5.5, 0), 0);
        assert.equal(estimatePointsFromSpend(Number.NaN, 5.5, 2), 0);
    });
});

describe("dates", () => {
    test("suggestExpectedCreditDate adds days to the invoice due date", () => {
        const d = suggestExpectedCreditDate(11, 2026, 10, 30);
        assert.equal(toDateInputValue(d), "2026-12-10");
    });

    test("suggestExpectedCreditDate caps the due day to the month length", () => {
        const d = suggestExpectedCreditDate(2, 2026, 31, 0);
        assert.equal(toDateInputValue(d), "2026-02-28");
    });

    test("fromApiDate keeps the calendar day of a UTC date-only value", () => {
        assert.equal(toDateInputValue(fromApiDate("2026-12-10T00:00:00.000Z")), "2026-12-10");
    });

    test("daysUntil ignores time of day", () => {
        const today = new Date(2026, 10, 10, 23, 59);
        assert.equal(daysUntil(new Date(2026, 10, 11, 0, 1), today), 1);
        assert.equal(daysUntil(new Date(2026, 10, 10, 0, 0), today), 0);
        assert.equal(daysUntil(new Date(2026, 10, 1), today), -9);
    });

    test("isOverdue only flags late entries that are not credited", () => {
        const today = new Date(2026, 10, 10);
        const past = new Date(2026, 10, 1);
        assert.equal(isOverdue("PENDING", past, today), true);
        assert.equal(isOverdue("TRANSFERRED", past, today), true);
        assert.equal(isOverdue("CREDITED", past, today), false);
        assert.equal(isOverdue("PENDING", new Date(2026, 10, 20), today), false);
    });
});

describe("trip planner & milheiro valuation", () => {
    test("parseCurrencyRateInput parses pt-BR currency and rejects invalid values", () => {
        assert.equal(parseCurrencyRateInput("17,50"), 17.5);
        assert.equal(parseCurrencyRateInput("R$ 24,00"), 24);
        assert.equal(parseCurrencyRateInput("35"), 35);
        assert.ok(Number.isNaN(parseCurrencyRateInput("")));
        assert.ok(Number.isNaN(parseCurrencyRateInput("-5")));
        assert.ok(Number.isNaN(parseCurrencyRateInput("abc")));
    });

    test("resolveProgramRate finds configured rates case-insensitively and falls back to defaults", () => {
        const rates = { Smiles: 16.5, CustomAir: 50 };
        assert.equal(resolveProgramRate("smiles", rates), 16.5);
        assert.equal(resolveProgramRate("customair", rates), 50);
        assert.equal(resolveProgramRate("LATAM Pass", rates), 24.0);
        assert.equal(resolveProgramRate("Desconhecido", rates), 0);
    });

    test("calculateTripMilesPlan computes missing miles and purchase cost without bonus", () => {
        const plan = calculateTripMilesPlan({
            requiredMiles: 100_000,
            bankPoints: 40_000,
            transferBonusPercent: 0,
            costPerThousandBrl: 17.5,
        });
        assert.equal(plan.milesFromBank, 40_000);
        assert.equal(plan.missingMilesToBuy, 60_000);
        assert.equal(plan.surplusMiles, 0);
        assert.equal(plan.coveragePercent, 40);
        assert.equal(plan.estimatedPurchaseCostBrl, 1050);
        assert.equal(plan.totalTripEquivalentBrl, 1750);
    });

    test("calculateTripMilesPlan applies transfer bonus and handles surplus", () => {
        const plan = calculateTripMilesPlan({
            requiredMiles: 100_000,
            bankPoints: 60_000,
            transferBonusPercent: 80,
            costPerThousandBrl: 20,
        });
        assert.equal(plan.milesFromBank, 108_000);
        assert.equal(plan.missingMilesToBuy, 0);
        assert.equal(plan.surplusMiles, 8_000);
        assert.equal(plan.coveragePercent, 100);
        assert.equal(plan.estimatedPurchaseCostBrl, 0);
        assert.equal(plan.totalTripEquivalentBrl, 2000);
    });

    test("getTripPlanInputError validates required fields", () => {
        assert.ok(getTripPlanInputError(0, 10_000, 0, 17.5));
        assert.ok(getTripPlanInputError(10_000, -1, 0, 17.5));
        assert.ok(getTripPlanInputError(10_000, 5_000, -10, 17.5));
        assert.ok(getTripPlanInputError(10_000, 5_000, 0, -1));
        assert.equal(getTripPlanInputError(10_000, 0, 0, 17.5), null);
    });
});
