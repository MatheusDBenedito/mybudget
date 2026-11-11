import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { irRateForDays, monthlyGrowthFactor, projectFixedIncome } from "./fixed-income.ts";
import { colorToHex, CHART_PALETTE } from "./charts.ts";

describe("irRateForDays", () => {
    test("follows the regressive table boundaries", () => {
        assert.equal(irRateForDays(0), 0.225);
        assert.equal(irRateForDays(180), 0.225);
        assert.equal(irRateForDays(181), 0.2);
        assert.equal(irRateForDays(360), 0.2);
        assert.equal(irRateForDays(361), 0.175);
        assert.equal(irRateForDays(720), 0.175);
        assert.equal(irRateForDays(721), 0.15);
    });
});

describe("monthlyGrowthFactor", () => {
    test("compounds to the annual CDI over 12 months at 100% of CDI", () => {
        const yearly = Math.pow(monthlyGrowthFactor(14, 100), 12);
        assert.ok(Math.abs(yearly - 1.14) < 1e-9);
    });

    test("pays more above 100% of CDI and nothing at 0%", () => {
        assert.ok(monthlyGrowthFactor(14, 110) > monthlyGrowthFactor(14, 100));
        assert.equal(monthlyGrowthFactor(14, 0), 1);
    });
});

describe("projectFixedIncome", () => {
    const today = new Date(2026, 10, 10);
    const position = { investedAmount: 1000, grossValue: 1100, cdiPercentage: 100, investmentDate: new Date(2026, 4, 10) };

    test("starts at the current value and applies IR for the holding period", () => {
        const [now] = projectFixedIncome([position], 14, 0, today);
        // 184 days held -> 20% IR on R$ 100 of profit
        assert.equal(now.gross, 1100);
        assert.equal(now.net, 1080);
        assert.equal(now.netProfit, 80);
        assert.equal(now.invested, 1000);
    });

    test("grows month by month and returns months + 1 points", () => {
        const points = projectFixedIncome([position], 14, 12, today);
        assert.equal(points.length, 13);
        for (let i = 1; i < points.length; i++) assert.ok(points[i].gross > points[i - 1].gross);
        // After 12 months at 100% CDI the gross value grows by the annual CDI
        assert.ok(Math.abs(points[12].gross - 1100 * 1.14) < 0.01);
    });

    test("IR drops as the holding period crosses a bracket", () => {
        const points = projectFixedIncome([position], 0.0001, 7, today);
        // ~same gross, but at month 7 (> 360 days) the rate goes from 20% to 17.5%
        assert.ok(points[7].net > points[0].net);
    });

    test("sums positions and ignores invalid ones", () => {
        const [now] = projectFixedIncome([
            position,
            { ...position, grossValue: 0 },
            { ...position, cdiPercentage: 0 },
            { ...position, investmentDate: "not a date" },
        ], 14, 0, today);
        assert.equal(now.invested, 1000);
    });

    test("returns zeros for an empty portfolio", () => {
        const [now] = projectFixedIncome([], 14, 0, today);
        assert.deepEqual([now.invested, now.gross, now.net], [0, 0, 0]);
    });
});

describe("colorToHex", () => {
    test("keeps hex, maps Tailwind classes and falls back to the palette", () => {
        assert.equal(colorToHex("#123456", 0), "#123456");
        assert.equal(colorToHex("bg-violet-500", 0), "#8b5cf6");
        assert.equal(colorToHex(null, 1), CHART_PALETTE[1]);
        assert.equal(colorToHex("bg-unknown", CHART_PALETTE.length), CHART_PALETTE[0]);
    });
});
