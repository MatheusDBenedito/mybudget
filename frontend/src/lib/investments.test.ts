import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
    type ApiInvestment,
    assetGroupKey,
    consolidateInvestments,
    computeClassStats,
    computeVariableIncomeComparison,
    currentValueOf,
    extractVariableIncomeAccounts,
    grossValueOf,
    taxAmountOf,
} from "./investments.ts";

describe("consolidateInvestments", () => {
    test("agrupa lotes duplicados do mesmo ticker em VARIABLE_INCOME e calcula preço médio ponderado", () => {
        const raw: ApiInvestment[] = [
            {
                id: "lot-2",
                name: "B3",
                type: "VARIABLE_INCOME",
                tickerCode: "B3SA3",
                sector: "Tecnologia",
                investmentDate: "2026-10-27T12:00:00.000Z",
                quantity: 26,
                averagePrice: 15.22,
                currentPrice: 14.66,
                investedAmount: 395.72,
                currentValue: 381.16,
            },
            {
                id: "lot-1",
                name: "B3",
                type: "VARIABLE_INCOME",
                tickerCode: "b3sa3",
                sector: "Tecnologia",
                investmentDate: "2021-10-20T12:00:00.000Z",
                quantity: 4,
                averagePrice: 13.08,
                currentPrice: 14.66,
                investedAmount: 52.32,
                currentValue: 58.64,
            },
        ];

        const consolidated = consolidateInvestments(raw);
        assert.equal(consolidated.length, 1);

        const b3 = consolidated[0];
        assert.equal(b3.groupKey, "VARIABLE_INCOME:B3SA3");
        assert.equal(b3.contributionsCount, 2);
        assert.equal(b3.quantity, 30);
        assert.equal(b3.investedAmount, 448.04);
        assert.equal(b3.currentValue, 439.8);
        assert.equal(Number((b3.averagePrice ?? 0).toFixed(4)), Number((448.04 / 30).toFixed(4)));
        // Lotes ordenados cronologicamente (mais antigo primeiro)
        assert.deepEqual(b3.lots.map(l => l.id), ["lot-1", "lot-2"]);
    });

    test("agrupa lotes de US_STOCK somando quantidades, valores em USD/BRL e ganhos de ativo/câmbio", () => {
        const raw: ApiInvestment[] = [
            {
                id: "qqq-1",
                name: "QQQ",
                type: "US_STOCK",
                tickerCode: "QQQ",
                investmentDate: "2025-03-27T12:00:00.000Z",
                quantity: 0.205715,
                averagePrice: 486.11,
                currentPrice: 690.38,
                purchaseExchangeRate: 5.602,
                currentExchangeRate: 5.8,
                investedUsd: 100.0,
                currentValueUsd: 142.02,
                investedAmount: 560.2,
                currentValue: 823.72,
                assetGainBrl: 235.4,
                fxGainBrl: 28.12,
                priceIsLive: true,
            },
            {
                id: "qqq-2",
                name: "QQQ",
                type: "US_STOCK",
                tickerCode: "QQQ",
                investmentDate: "2025-08-11T12:00:00.000Z",
                quantity: 0.09218,
                averagePrice: 576.21,
                currentPrice: 690.38,
                purchaseExchangeRate: 5.602,
                currentExchangeRate: 5.8,
                investedUsd: 53.12,
                currentValueUsd: 63.64,
                investedAmount: 297.55,
                currentValue: 369.11,
                assetGainBrl: 58.93,
                fxGainBrl: 12.63,
                priceIsLive: true,
            },
        ];

        const consolidated = consolidateInvestments(raw);
        assert.equal(consolidated.length, 1);

        const qqq = consolidated[0];
        assert.equal(qqq.contributionsCount, 2);
        assert.equal(qqq.quantity, 0.297895);
        assert.equal(qqq.investedUsd, 153.12);
        assert.equal(qqq.currentValueUsd, 205.66);
        assert.equal(qqq.investedAmount, 857.75);
        assert.equal(qqq.currentValue, 1192.83);
        assert.equal(qqq.assetGainBrl, 294.33);
        assert.equal(qqq.fxGainBrl, 40.75);
    });

    test("computeClassStats conta ativos consolidados e preserva soma financeira e total de aportes", () => {
        const raw: ApiInvestment[] = [
            { id: "1", name: "VOO", type: "US_STOCK", tickerCode: "VOO", investedAmount: 500, currentValue: 600 },
            { id: "2", name: "VOO", type: "US_STOCK", tickerCode: "VOO", investedAmount: 300, currentValue: 350 },
            { id: "3", name: "SMH", type: "US_STOCK", tickerCode: "SMH", investedAmount: 200, currentValue: 250 },
        ];

        const stats = computeClassStats(raw, 1200);
        assert.equal(stats.count, 2);
        assert.equal(stats.contributionsCount, 3);
        assert.equal(stats.invested, 1000);
        assert.equal(stats.gross, 1200);
        assert.equal(stats.current, 1200);
        assert.equal(stats.profit, 200);
    });

    test("computeClassStats soma grossValueOf para renda fixa com IR", () => {
        const raw: ApiInvestment[] = [
            { id: "rf1", name: "CDB A", type: "FIXED_INCOME", investedAmount: 1000, currentValue: 1085, grossValue: 1100, netValue: 1085, taxAmount: 15 },
            { id: "rf2", name: "CDB B", type: "FIXED_INCOME", investedAmount: 2000, currentValue: 2170, grossValue: 2200, netValue: 2170, taxAmount: 30 },
        ];
        const stats = computeClassStats(raw, 3255);
        assert.equal(stats.gross, 3300);
        assert.equal(stats.current, 3255);
        assert.equal(stats.invested, 3000);
    });

    test("assetGroupKey usa o nome normalizado quando não há tickerCode", () => {
        assert.equal(
            assetGroupKey({ type: "FIXED_INCOME", name: "  CDB Banco Inter  " }),
            "FIXED_INCOME:CDB BANCO INTER",
        );
    });

    test("separa FII de VARIABLE_INCOME e consolida lotes de FII com preço médio ponderado", () => {
        const raw: ApiInvestment[] = [
            {
                id: "fii-1",
                name: "HGLG11",
                type: "FII",
                tickerCode: "HGLG11",
                sector: "FII",
                investmentDate: "2024-02-08T12:00:00.000Z",
                quantity: 1,
                averagePrice: 164.8,
                currentPrice: 145.51,
                investedAmount: 164.8,
                currentValue: 145.51,
            },
            {
                id: "fii-2",
                name: "HGLG11",
                type: "FII",
                tickerCode: "HGLG11",
                sector: "FII",
                investmentDate: "2026-07-10T12:00:00.000Z",
                quantity: 6,
                averagePrice: 149.48,
                currentPrice: 145.51,
                investedAmount: 896.88,
                currentValue: 873.06,
            },
        ];

        const consolidated = consolidateInvestments(raw);
        assert.equal(consolidated.length, 1);
        assert.equal(consolidated[0].groupKey, "FII:HGLG11");
        assert.equal(consolidated[0].contributionsCount, 2);
        assert.equal(consolidated[0].quantity, 7);
        assert.equal(consolidated[0].investedAmount, 1061.68);
        assert.equal(consolidated[0].currentValue, 1018.57);
    });

    test("grossValueOf, taxAmountOf e currentValueOf retornam bruto, IR e líquido para renda fixa", () => {
        const cdb: ApiInvestment = {
            id: "cdb-1",
            name: "CDB 100% CDI",
            type: "FIXED_INCOME",
            investedAmount: 1000,
            currentValue: 1000,
            grossValue: 1100,
            taxAmount: 22.5,
            netValue: 1077.5,
        };

        assert.equal(grossValueOf(cdb), 1100);
        assert.equal(taxAmountOf(cdb), 22.5);
        assert.equal(currentValueOf(cdb), 1077.5);
    });

    test("computeVariableIncomeComparison compara aporte real vs valor atual com ou sem dividendos e saldo das contas", () => {
        const invs: ApiInvestment[] = [
            { id: "1", name: "CDB", type: "FIXED_INCOME", investedAmount: 40000, currentValue: 45000, netValue: 44000, accountId: "acc-cdb" },
            { id: "2", name: "PETR4", type: "VARIABLE_INCOME", investedAmount: 3000, currentValue: 3500, currentPrice: 35, quantity: 100, accountId: "acc-clear" },
            { id: "3", name: "MXRF11", type: "FII", investedAmount: 3000, currentValue: 3200, currentPrice: 10, quantity: 320, accountId: "acc-clear" },
            { id: "4", name: "VOO", type: "US_STOCK", investedAmount: 3000, currentValue: 3300, accountId: "acc-c6g" },
            { id: "5", name: "SOL", type: "CRYPTO", investedAmount: 500, currentValue: 300, currentPrice: 300, quantity: 1, accountId: "acc-bin" },
        ];

        const accounts = [
            { id: "acc-cdb", name: "C6", balance: 800 },
            { id: "acc-clear", name: "Clear", balance: 150 },
            { id: "acc-c6g", name: "C6 Global", balance: 3000 },
            { id: "acc-bin", name: "Binance", balance: 0 },
        ];

        const linked = extractVariableIncomeAccounts(invs, accounts);
        assert.deepEqual(linked.map(a => a.id), ["acc-clear", "acc-c6g", "acc-bin"]);
        const accountsBalance = linked.reduce((s, a) => s + a.balance, 0);
        assert.equal(accountsBalance, 3150);

        const withoutDivs = computeVariableIncomeComparison({
            investments: invs,
            realContributedAmount: 11038.42,
            receivedDividends: 654.68,
            includeDividends: false,
            accountsBalance,
            includeAccounts: true,
        });
        assert.equal(withoutDivs.currentValue, 10300);
        assert.equal(withoutDivs.accountsBalance, 3150);
        assert.equal(withoutDivs.effectiveValue, 13450);
        assert.equal(withoutDivs.profitBrl, 2411.58);

        const withDivs = computeVariableIncomeComparison({
            investments: invs,
            realContributedAmount: 11038.42,
            receivedDividends: 654.68,
            includeDividends: true,
            accountsBalance,
            includeAccounts: true,
        });
        assert.equal(withDivs.effectiveValue, 14104.68);
        assert.equal(withDivs.profitBrl, 3066.26);
    });
});

