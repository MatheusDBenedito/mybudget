import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
    primaryCard,
    groupInvoice,
    openInvoiceMonth,
    holdersOf,
    mainHolder,
    holderLabel,
    holderTotals,
    filterByHolder,
} from "./credit-cards.ts";

describe("groupInvoice", () => {
    const items = [
        { id: "comida", amount: 181.26, installments: 1, isFixed: false },
        { id: "dizimo", amount: 1665.1, installments: 1, isFixed: true },
        { id: "seguro", amount: 310.96, installments: 10, isFixed: false },
        { id: "estorno", amount: -20, installments: 1, isFixed: false },
        { id: "spotify", amount: 40.9, installments: 1, isFixed: true },
    ];

    test("fixos primeiro, depois parcelados e à vista, com subtotal e total geral", () => {
        const { groups, total } = groupInvoice(items);
        assert.deepEqual(groups.map(g => [g.label, g.items.map(i => i.id), g.total]), [
            ["Fixos", ["dizimo", "spotify"], 1706],
            ["Parcelados", ["seguro"], 310.96],
            ["À vista", ["comida", "estorno"], 161.26],
        ]);
        assert.equal(total, 2178.22);
    });

    test("mantém grupos vazios e total zero sem lançamentos", () => {
        const { groups, total } = groupInvoice([]);
        assert.deepEqual(groups.map(g => g.items.length), [0, 0, 0]);
        assert.equal(total, 0);
    });
});

describe("openInvoiceMonth", () => {    test("em novembro, cartão que vence dia 5 (fecha ~29/out): a fatura aberta é dezembro", () => {
        assert.deepEqual(openInvoiceMonth(new Date(2026, 10, 10), 7, 5), { month: 12, year: 2026 });
    });

    test("cartão que vence dia 10 (fecha dia 3): depois do fechamento a aberta é a do mês seguinte", () => {
        assert.deepEqual(openInvoiceMonth(new Date(2026, 10, 10), 7, 10), { month: 12, year: 2026 });
        assert.deepEqual(openInvoiceMonth(new Date(2026, 10, 3), 7, 10), { month: 12, year: 2026 }); // closing day itself
        assert.deepEqual(openInvoiceMonth(new Date(2026, 10, 2), 7, 10), { month: 11, year: 2026 });
    });

    test("vencimento no fim do mês: a fatura do mês ainda está aberta antes do fechamento", () => {
        assert.deepEqual(openInvoiceMonth(new Date(2026, 10, 10), 7, 25), { month: 11, year: 2026 });
    });

    test("vira o ano em dezembro", () => {
        assert.deepEqual(openInvoiceMonth(new Date(2026, 11, 20), 7, 5), { month: 1, year: 2027 });
    });

    test("dia de vencimento maior que o mês (31 em fevereiro)", () => {
        // Fev/2026 has 28 days: due 28/02, closes 21/02
        assert.deepEqual(openInvoiceMonth(new Date(2026, 1, 20), 7, 31), { month: 2, year: 2026 });
        assert.deepEqual(openInvoiceMonth(new Date(2026, 1, 21), 7, 31), { month: 3, year: 2026 });
    });
});

describe("primaryCard", () => {
    test("returns the favorite card", () => {
        const cards = [{ id: "c6", isPrimary: false }, { id: "nubank", isPrimary: true }];
        assert.equal(primaryCard(cards)?.id, "nubank");
    });

    test("falls back to the first card when none is marked", () => {
        assert.equal(primaryCard([{ id: "c6", isPrimary: false }, { id: "nubank" }])?.id, "c6");
    });

    test("empty list has no primary", () => {
        assert.equal(primaryCard([]), null);
    });
});

const holders = [
    { id: "wife", name: "Adicional", last4: null, isMain: false },
    { id: "me", name: "Matheus", last4: "1234", isMain: true },
];

describe("holders", () => {
    test("puts the main holder first and sorts the rest by name", () => {
        assert.deepEqual(holdersOf(holders).map(h => h.id), ["me", "wife"]);
        assert.deepEqual(holdersOf([]), []);
    });

    test("mainHolder returns the main holder or null", () => {
        assert.equal(mainHolder(holders)?.id, "me");
        assert.equal(mainHolder([]), null);
    });

    test("holderLabel includes the last four digits when known", () => {
        assert.equal(holderLabel(holders[1]), "Matheus ••1234");
        assert.equal(holderLabel(holders[0]), "Adicional");
    });
});

describe("holderTotals", () => {
    const items = [
        { amount: 100, cardHolder: { id: "me", name: "Matheus", last4: "1234" } },
        { amount: 50.25, cardHolder: { id: "me", name: "Matheus", last4: "1234" } },
        { amount: 30, cardHolder: { id: "wife", name: "Adicional", last4: null } },
    ];

    test("sums per holder and keeps every registered holder", () => {
        const totals = holderTotals(items, [...holders, { id: "empty", name: "Sem compras", isMain: false }]);

        assert.deepEqual(totals.map(t => [t.id, t.total, t.count]), [
            ["me", 150.25, 2],
            ["wife", 30, 1],
            ["empty", 0, 0],
        ]);
    });

    test("groups items without a holder as Sem portador", () => {
        const totals = holderTotals([{ amount: 10 }], holders);

        assert.deepEqual(totals.find(t => t.id === "unknown"), {
            id: "unknown",
            name: "Sem portador",
            total: 10,
            count: 1,
        });
    });

    test("filters by holder and keeps all items when nothing is selected", () => {
        assert.equal(filterByHolder(items, null).length, 3);
        assert.deepEqual(filterByHolder(items, "wife").map(i => i.amount), [30]);
    });
});
