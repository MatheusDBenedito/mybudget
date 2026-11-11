import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { checkTransfer, defaultSettlementAccount, sortForPayment, transferableBalance, yieldLabel, type AccountLike } from "./accounts.ts";

const c6: AccountLike = { id: "c6", name: "C6", balance: 100, type: "CHECKING" };
const bradesco: AccountLike = { id: "bradesco", name: "Bradesco", balance: 50, type: "CHECKING" };
const mp: AccountLike = { id: "mp", name: "Mercado Pago", balance: 5000, type: "YIELDING", cdiPercentage: 100 };

describe("defaultSettlementAccount", () => {
    test("expense keeps its own account when it is a checking account", () => {
        assert.equal(defaultSettlementAccount([mp, c6, bradesco], "EXPENSE", "bradesco")?.id, "bradesco");
    });

    test("expense linked to a yielding account defaults to the first checking account", () => {
        assert.equal(defaultSettlementAccount([mp, c6, bradesco], "EXPENSE", "mp")?.id, "c6");
    });

    test("expense without a preferred account picks a checking account", () => {
        assert.equal(defaultSettlementAccount([mp, c6], "EXPENSE")?.id, "c6");
    });

    test("expense falls back to a yielding account when there is no checking account", () => {
        assert.equal(defaultSettlementAccount([mp], "EXPENSE", "mp")?.id, "mp");
        assert.equal(defaultSettlementAccount([mp], "EXPENSE")?.id, "mp");
    });

    test("income keeps its own account, even if it yields", () => {
        assert.equal(defaultSettlementAccount([c6, mp], "INCOME", "mp")?.id, "mp");
        assert.equal(defaultSettlementAccount([c6, mp], "INCOME")?.id, "c6");
    });

    test("accounts without a type are treated as checking", () => {
        const legacy: AccountLike = { id: "legacy", name: "Antiga", balance: 0 };
        assert.equal(defaultSettlementAccount([mp, legacy], "EXPENSE", "mp")?.id, "legacy");
    });

    test("returns undefined when there are no accounts", () => {
        assert.equal(defaultSettlementAccount([], "EXPENSE"), undefined);
    });
});

describe("sortForPayment", () => {
    test("puts checking accounts first and keeps the original order within each group", () => {
        assert.deepEqual(sortForPayment([mp, c6, bradesco]).map(a => a.id), ["c6", "bradesco", "mp"]);
    });

    test("does not mutate the input", () => {
        const input = [mp, c6];
        sortForPayment(input);
        assert.deepEqual(input.map(a => a.id), ["mp", "c6"]);
    });
});

describe("yieldLabel", () => {
    test("describes yielding and checking accounts", () => {
        assert.equal(yieldLabel(mp), "Rende 100% do CDI");
        assert.equal(yieldLabel({ ...mp, cdiPercentage: 102.5 }), "Rende 102,5% do CDI");
        assert.equal(yieldLabel(c6), "Não rende");
    });
});

describe("transfers", () => {
    const mpWithPots: AccountLike = { ...mp, balance: 1000, freeBalance: 600 };

    test("transferable balance excludes cofrinhos", () => {
        assert.equal(transferableBalance(mpWithPots), 600);
        assert.equal(transferableBalance(c6), 100);
    });

    test("1000 no Mercado Pago, 500 para o C6: ok", () => {
        assert.deepEqual(checkTransfer([{ ...mp, balance: 1000 }, c6], { fromId: "mp", toId: "c6", amount: 500 }), { error: null, warning: null });
    });

    test("blocks same account and missing amount", () => {
        assert.match(checkTransfer([mp, c6], { fromId: "mp", toId: "mp", amount: 10 }).error ?? "", /diferentes/);
        assert.match(checkTransfer([mp, c6], { fromId: "mp", toId: "c6", amount: undefined }).error ?? "", /valor/);
    });

    test("blocks more than the free balance when the account has cofrinhos", () => {
        assert.match(checkTransfer([mpWithPots, c6], { fromId: "mp", toId: "c6", amount: 700 }).error ?? "", /cofrinho/);
        assert.equal(checkTransfer([mpWithPots, c6], { fromId: "mp", toId: "c6", amount: 600 }).error, null);
    });

    test("only warns when a checking account would go negative", () => {
        const result = checkTransfer([mp, c6], { fromId: "c6", toId: "mp", amount: 150 });
        assert.equal(result.error, null);
        assert.match(result.warning ?? "", /negativo/);
    });
});
