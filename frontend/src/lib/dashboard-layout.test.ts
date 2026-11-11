import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
    DASHBOARD_LAYOUT_CACHE_KEY,
    DEFAULT_LAYOUT,
    moveBy,
    moveTo,
    normalizeLayout,
    readCachedLayout,
    setWidth,
    writeCachedLayout,
} from "./dashboard-layout.ts";

describe("normalizeLayout", () => {
    test("keeps the saved order and widths", () => {
        const layout = normalizeLayout([
            { id: "bills", width: 12 },
            { id: "forecast", width: 6 },
        ]);

        assert.deepEqual(layout.slice(0, 2), [
            { id: "bills", width: 12 },
            { id: "forecast", width: 6 },
        ]);
    });

    test("appends missing blocks in the default order", () => {
        const layout = normalizeLayout([{ id: "cards", width: 4 }]);

        assert.equal(layout.length, DEFAULT_LAYOUT.length);
        assert.equal(layout[0].id, "cards");
        assert.deepEqual(
            layout.slice(1).map(item => item.id),
            DEFAULT_LAYOUT.filter(item => item.id !== "cards").map(item => item.id),
        );
    });

    test("drops unknown and duplicated blocks", () => {
        const layout = normalizeLayout([
            { id: "forecast", width: 8 },
            { id: "forecast", width: 12 },
            { id: "nope", width: 4 },
        ]);

        assert.equal(layout.filter(item => item.id === "forecast").length, 1);
        assert.equal(layout[0].width, 8);
        assert.equal(layout.length, DEFAULT_LAYOUT.length);
    });

    test("replaces an invalid width with the default width", () => {
        const layout = normalizeLayout([{ id: "bills", width: 7 }]);

        assert.deepEqual(layout[0], DEFAULT_LAYOUT.find(item => item.id === "bills"));
    });

    test("falls back to the default layout for non-array input", () => {
        assert.deepEqual(normalizeLayout(null), DEFAULT_LAYOUT);
        assert.deepEqual(normalizeLayout({ id: "bills" }), DEFAULT_LAYOUT);
    });
});

describe("moveTo", () => {
    test("moves a block to the position of another one", () => {
        const moved = moveTo(DEFAULT_LAYOUT, "investments-chart", "forecast");

        assert.equal(moved[0].id, "investments-chart");
        assert.equal(moved.length, DEFAULT_LAYOUT.length);
        assert.equal(new Set(moved.map(item => item.id)).size, DEFAULT_LAYOUT.length);
    });

    test("ignores unknown ids or no-op moves", () => {
        assert.equal(moveTo(DEFAULT_LAYOUT, "nope" as never, "forecast"), DEFAULT_LAYOUT);
        assert.equal(moveTo(DEFAULT_LAYOUT, "forecast", "forecast"), DEFAULT_LAYOUT);
    });
});

describe("moveBy", () => {
    test("swaps with the previous and next blocks", () => {
        const right = moveBy(DEFAULT_LAYOUT, "forecast", 1);
        assert.deepEqual(right.slice(0, 2).map(item => item.id), ["bills", "forecast"]);

        const back = moveBy(right, "forecast", -1);
        assert.deepEqual(back.map(item => item.id), DEFAULT_LAYOUT.map(item => item.id));
    });

    test("does nothing at the edges", () => {
        assert.equal(moveBy(DEFAULT_LAYOUT, "forecast", -1), DEFAULT_LAYOUT);
        assert.equal(moveBy(DEFAULT_LAYOUT, "investments-chart", 1), DEFAULT_LAYOUT);
    });
});

describe("setWidth", () => {
    test("changes only the target block", () => {
        const resized = setWidth(DEFAULT_LAYOUT, "cards", 12);

        assert.equal(resized.find(item => item.id === "cards")?.width, 12);
        assert.deepEqual(
            resized.filter(item => item.id !== "cards"),
            DEFAULT_LAYOUT.filter(item => item.id !== "cards"),
        );
        assert.equal(DEFAULT_LAYOUT.find(item => item.id === "cards")?.width, 4);
    });
});

describe("layout cache", () => {
    const storage = () => {
        const data = new Map<string, string>();
        return {
            getItem: (key: string) => data.get(key) ?? null,
            setItem: (key: string, value: string) => { data.set(key, value); },
            removeItem: (key: string) => { data.delete(key); },
            clear: () => data.clear(),
            key: () => null,
            get length() { return data.size; },
        } as Storage;
    };

    test("round-trips a valid layout", () => {
        const target = storage();
        assert.equal(writeCachedLayout(DEFAULT_LAYOUT, target), true);
        assert.deepEqual(readCachedLayout(target), DEFAULT_LAYOUT);
        assert.ok(target.getItem(DASHBOARD_LAYOUT_CACHE_KEY));
    });

    test("returns null for missing or invalid cache", () => {
        const target = storage();
        assert.equal(readCachedLayout(target), null);

        target.setItem(DASHBOARD_LAYOUT_CACHE_KEY, "{not json");
        assert.equal(readCachedLayout(target), null);

        target.setItem(DASHBOARD_LAYOUT_CACHE_KEY, "{}");
        assert.equal(readCachedLayout(target), null);
    });

    test("normalizes a partial cached layout", () => {
        const target = storage();
        target.setItem(DASHBOARD_LAYOUT_CACHE_KEY, JSON.stringify([{ id: "cards", width: 6 }]));

        const cached = readCachedLayout(target);
        assert.equal(cached?.[0].id, "cards");
        assert.equal(cached?.length, DEFAULT_LAYOUT.length);
    });
});
