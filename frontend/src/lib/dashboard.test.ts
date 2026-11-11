import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { billsByDay, budgetBreakdown, defaultBillDay, relativeDay, splitMoney } from "./dashboard.ts";
import type { CashFlowData } from "./cash-flow.ts";

const flow = (over: Partial<Record<"income" | "fixed" | "cards" | "variable", number>> = {}, cardOpen = 500): CashFlowData => {
    const { income = 10_000, fixed = 2_000, cards = 3_000, variable = 1_000 } = over;
    return {
        months: [{ year: 2026, month: 12 }],
        openingBalance: 0,
        sections: [
            { key: "INCOME", title: "", kind: "income", rows: [], totals: [income], openTotals: [0] },
            { key: "FIXED", title: "", kind: "expense", rows: [], totals: [fixed], openTotals: [0] },
            {
                key: "CARDS", title: "", kind: "expense", totals: [cards], openTotals: [cardOpen],
                rows: [{ key: "c6", label: "C6", values: [cards], open: [cardOpen], total: cards }],
            },
            { key: "VARIABLE", title: "", kind: "expense", rows: [], totals: [variable], openTotals: [0] },
        ],
        summary: {
            income: [income], expenses: [fixed + cards + variable], net: [income - fixed - cards - variable],
            openIncome: [0], openExpenses: [0], openNet: [0], projectedBalance: [0],
        },
    };
};

describe("budgetBreakdown", () => {
    test("splits income into fixed bills, cards, other expenses and the leftover", () => {
        const b = budgetBreakdown(flow());
        assert.equal(b.leftover, 4_000);
        assert.equal(b.leftoverPct, 40);
        assert.deepEqual(b.segments.map(s => [s.key, s.value, s.pct]), [
            ["FIXED", 2_000, 20], ["CARDS", 3_000, 30], ["VARIABLE", 1_000, 10], ["LEFTOVER", 4_000, 40],
        ]);
    });

    test("when expenses exceed income the leftover is negative and the bar is relative to expenses", () => {
        const b = budgetBreakdown(flow({ income: 4_000 }));
        assert.equal(b.leftover, -2_000);
        assert.equal(b.leftoverPct, -50);
        assert.deepEqual(b.segments.map(s => s.pct), [33.3, 50, 16.7, 0]);
    });
});

describe("billsByDay", () => {
    const month = { year: 2026, month: 12 };
    const txs = [
        { id: "a", description: "Internet", amount: 120, date: "2026-12-15T12:00:00.000Z", type: "EXPENSE", status: "PENDING" },
        { id: "b", description: "Aluguel", amount: 2000, date: "2026-12-05T12:00:00.000Z", type: "EXPENSE", status: "PAID" },
        { id: "c", description: "Salário", amount: 5000, date: "2026-12-05T12:00:00.000Z", type: "INCOME", status: "PAID" },
        { id: "d", description: "Cancelada", amount: 99, date: "2026-12-05T12:00:00.000Z", type: "EXPENSE", status: "CANCELLED" },
    ];

    test("groups expenses and card invoices by due day, biggest first", () => {
        const days = billsByDay(txs, [{ id: "c6", name: "C6 Carbon", dueDay: 5 }], flow(), month);
        assert.deepEqual(days.map(d => [d.day, d.items.map(i => i.label), d.total, d.paidCount]), [
            [5, ["Fatura C6 Carbon", "Aluguel"], 5_000, 1],
            [15, ["Internet"], 120, 0],
        ]);
    });

    test("a card invoice is paid when nothing of it is open", () => {
        const days = billsByDay([], [{ id: "c6", name: "C6", dueDay: 31 }], flow({}, 0), { year: 2026, month: 2 });
        assert.deepEqual(days.map(d => [d.day, d.items[0].paid]), [[28, true]]); // due day capped at the end of February
    });

    test("default day is the next one with something open in the current month", () => {
        const days = billsByDay(txs, [], null, month);
        assert.equal(defaultBillDay(days, month, new Date(2026, 11, 1)), 15); // the 5th is already paid
        assert.equal(defaultBillDay(days, { year: 2027, month: 1 }, new Date(2026, 11, 1)), 5); // other month: first day
        assert.equal(defaultBillDay([], month), null);
    });
});

describe("relativeDay / splitMoney", () => {
    test("describes days relative to today", () => {
        const today = new Date(2026, 11, 10);
        assert.equal(relativeDay(10, { year: 2026, month: 12 }, today), "hoje");
        assert.equal(relativeDay(11, { year: 2026, month: 12 }, today), "amanhã");
        assert.equal(relativeDay(5, { year: 2027, month: 1 }, today), "em 26 dias");
        assert.equal(relativeDay(8, { year: 2026, month: 12 }, today), "há 2 dias");
    });

    test("separates the cents", () => {
        const { whole, cents } = splitMoney(5304.28);
        assert.equal(cents, ",28");
        assert.match(whole, /5\.304$/);
    });
});
