import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
    type ApiDividendInvestment,
    type ApiInvestmentDividend,
    buildAnnualMonthlyMatrix,
    buildMonthlyDividendsSeries,
    buildYearlyDividendsSeries,
    computeDividendsSummary,
    enrichDividendsWithStatus,
    filterDividendsData,
    groupPendingDividends,
} from "./investments-dividends.ts";

describe("investments-dividends", () => {
    const investments: ApiDividendInvestment[] = [
        {
            id: "inv-mxrf",
            name: "MXRF11",
            type: "FII",
            tickerCode: "MXRF11",
            investmentDate: "2024-01-10T12:00:00.000Z",
            quantity: 37,
            investedAmount: 389.61,
        },
        {
            id: "inv-b3",
            name: "B3",
            type: "VARIABLE_INCOME",
            tickerCode: "B3SA3",
            investmentDate: "2024-02-05T12:00:00.000Z",
            quantity: 30,
            investedAmount: 448.04,
        },
    ];

    const dividends: ApiInvestmentDividend[] = [
        {
            id: "d1",
            investmentId: "inv-mxrf",
            tickerCode: "MXRF11",
            date: "2024-01-31T00:00:00.000Z",
            amountPerShare: 0.1,
            quantity: 37,
            totalOriginal: 3.7,
            currency: "BRL",
            totalBrl: 3.7,
            investment: investments[0],
        },
        {
            id: "d2",
            investmentId: "inv-mxrf",
            tickerCode: "MXRF11",
            date: "2024-03-28T00:00:00.000Z",
            amountPerShare: 0.1,
            quantity: 37,
            totalOriginal: 3.7,
            currency: "BRL",
            totalBrl: 3.7,
            investment: investments[0],
        },
        {
            id: "d3",
            investmentId: "inv-b3",
            tickerCode: "B3SA3",
            date: "2024-03-15T00:00:00.000Z",
            amountPerShare: 0.25,
            quantity: 30,
            totalOriginal: 7.5,
            currency: "BRL",
            totalBrl: 7.5,
            investment: investments[1],
        },
    ];

    test("gera linha do tempo contínua mês a mês desde a data de compra incluindo meses sem provento", () => {
        const refDate = new Date("2024-03-31T12:00:00.000Z");
        const series = buildMonthlyDividendsSeries(dividends, investments, refDate);

        assert.deepEqual(
            series.map(m => [m.monthKey, m.fiiBrl, m.stocksBrl, m.totalBrl, m.paymentsCount]),
            [
                ["2024-01", 3.7, 0, 3.7, 1],
                ["2024-02", 0, 0, 0, 0],
                ["2024-03", 3.7, 7.5, 11.2, 2],
            ],
        );
    });

    test("computeDividendsSummary calcula total acumulado, média mensal, YoC e ranking por ativo", () => {
        const refDate = new Date("2024-03-31T12:00:00.000Z");
        const series = buildMonthlyDividendsSeries(dividends, investments, refDate);
        const summary = computeDividendsSummary(series, dividends, investments);

        assert.equal(summary.totalBrl, 14.9);
        assert.equal(summary.fiiTotalBrl, 7.4);
        assert.equal(summary.stocksTotalBrl, 7.5);
        assert.equal(summary.monthsSinceStart, 3);
        assert.equal(summary.monthsWithPayments, 2);
        assert.equal(summary.monthlyAverageBrl, 4.97);
        assert.equal(summary.bestMonth?.monthKey, "2024-03");
        assert.equal(summary.topAsset?.tickerCode, "B3SA3");
        assert.equal(summary.byAsset.length, 2);
    });

    test("buildYearlyDividendsSeries agrega os meses por ano", () => {
        const refDate = new Date("2024-03-31T12:00:00.000Z");
        const series = buildMonthlyDividendsSeries(dividends, investments, refDate);
        const yearly = buildYearlyDividendsSeries(series);

        assert.equal(yearly.length, 1);
        assert.equal(yearly[0].year, 2024);
        assert.equal(yearly[0].totalBrl, 14.9);
        assert.equal(yearly[0].paymentsCount, 3);
    });

    test("filterDividendsData filtra por classe e ticker", () => {
        const fiiOnly = filterDividendsData(dividends, investments, "FII", "ALL");
        assert.equal(fiiOnly.investments.length, 1);
        assert.equal(fiiOnly.dividends.length, 2);

        const b3Only = filterDividendsData(dividends, investments, "ALL", "b3sa3");
        assert.equal(b3Only.investments.length, 1);
        assert.equal(b3Only.dividends.length, 1);
    });

    test("buildAnnualMonthlyMatrix gera matriz Ano x 12 meses com média proporcional no ano parcial e /12 nos anos fechados", () => {
        const refDate = new Date("2024-03-31T12:00:00.000Z");
        const matrix = buildAnnualMonthlyMatrix(dividends, investments, refDate);

        assert.equal(matrix.length, 1);
        const row2024 = matrix[0];
        assert.equal(row2024.year, 2024);
        assert.equal(row2024.months.length, 12);
        assert.equal(row2024.months[0], 3.7); // Jan
        assert.equal(row2024.months[1], 0);   // Fev
        assert.equal(row2024.months[2], 11.2); // Mar
        assert.equal(row2024.months[3], 0);   // Abr
        assert.equal(row2024.total, 14.9);
        assert.equal(row2024.isPartialYear, true);
        assert.equal(row2024.monthsDivisor, 3);
        assert.equal(row2024.average, 4.97);
    });

    test("identifica proventos a receber (PENDING) quando a data de pagamento é posterior à data de referência e consolida por ativo", () => {
        const novDivs: ApiInvestmentDividend[] = [
            {
                id: "m1",
                investmentId: "inv-mxrf-1",
                tickerCode: "MXRF11",
                date: "2026-11-03T13:00:00.000Z",
                amountPerShare: 0.095,
                quantity: 37,
                totalOriginal: 3.52,
                currency: "BRL",
                totalBrl: 3.52,
                investment: investments[0],
            },
            {
                id: "m2",
                investmentId: "inv-mxrf-2",
                tickerCode: "MXRF11",
                date: "2026-11-03T13:00:00.000Z",
                amountPerShare: 0.095,
                quantity: 8,
                totalOriginal: 0.76,
                currency: "BRL",
                totalBrl: 0.76,
                investment: investments[0],
            },
        ];

        const refDate = new Date("2026-11-12T12:00:00.000Z");
        const enriched = enrichDividendsWithStatus(novDivs, refDate);
        assert.equal(enriched[0].status, "PENDING");
        assert.equal(enriched[1].status, "PENDING");

        const pendingGroups = groupPendingDividends(enriched);
        assert.equal(pendingGroups.length, 1);
        assert.equal(pendingGroups[0].tickerCode, "MXRF11");
        assert.equal(pendingGroups[0].quantity, 45);
        assert.equal(pendingGroups[0].totalBrl, 4.28);
    });

    test("calcula 10º dia útil ANBIMA (com Finados em 02/11) para BTHF11, HGLG11, MXRF11 e HGBS11 em nov/2026 como 2026-11-16 (PAID)", () => {
        const refDate = new Date("2026-11-16T12:00:00.000Z");
        const novFiiDivs: ApiInvestmentDividend[] = [
            {
                id: "b1",
                investmentId: "inv-bthf",
                tickerCode: "BTHF11",
                date: "2026-11-10T13:00:00.000Z",
                amountPerShare: 0.101,
                quantity: 100,
                totalOriginal: 10.1,
                currency: "BRL",
                totalBrl: 10.1,
                investment: { id: "inv-bthf", name: "BTHF11", type: "FII", tickerCode: "BTHF11", sector: "FII", investmentDate: null, quantity: 100, investedAmount: 900 },
            },
            {
                id: "h1",
                investmentId: "inv-hglg",
                tickerCode: "HGLG11",
                date: "2026-11-03T13:00:00.000Z",
                amountPerShare: 1.17,
                quantity: 10,
                totalOriginal: 11.7,
                currency: "BRL",
                totalBrl: 11.7,
                investment: { id: "inv-hglg", name: "HGLG11", type: "FII", tickerCode: "HGLG11", sector: "FII", investmentDate: null, quantity: 10, investedAmount: 1600 },
            },
        ];

        const enriched = enrichDividendsWithStatus(novFiiDivs, refDate);
        assert.equal(enriched[0]?.paymentDate?.slice(0, 10), "2026-11-16");
        assert.equal(enriched[0]?.status, "PAID");
        assert.equal(enriched[1]?.paymentDate?.slice(0, 10), "2026-11-16");
        assert.equal(enriched[1]?.status, "PAID");
    });
});

