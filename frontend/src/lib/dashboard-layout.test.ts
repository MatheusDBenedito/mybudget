import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
    DASHBOARD_LAYOUT_CACHE_KEY,
    DEFAULT_DASHBOARD_HEIGHT_PX,
    DEFAULT_LAYOUT,
    MAX_DASHBOARD_HEIGHT_PX,
    MAX_DASHBOARD_WIDTH_PCT,
    MIN_DASHBOARD_HEIGHT_PX,
    MIN_DASHBOARD_WIDTH_PCT,
    moveTo,
    normalizeLayout,
    readCachedLayout,
    setBlockSize,
    widthCssPercent,
    writeCachedLayout,
} from "./dashboard-layout.ts";

describe("normalizeLayout", () => {
    test("keeps the saved order, widths and heights (migrating legacy 12-col widths and sm/md/lg)", () => {
        const layout = normalizeLayout([
            { id: "bills", width: 12, height: "lg" },
            { id: "forecast", width: 4, height: 385 },
            { id: "cards", width: 45 },
        ]);

        assert.deepEqual(layout.slice(0, 3), [
            { id: "bills", width: 100, height: 580 },
            { id: "forecast", width: 33, height: 385 },
            { id: "cards", width: 45, height: DEFAULT_DASHBOARD_HEIGHT_PX },
        ]);
    });

    test("appends missing blocks in the default order", () => {
        const layout = normalizeLayout([{ id: "cards", width: 33 }]);

        assert.equal(layout.length, DEFAULT_LAYOUT.length);
        assert.equal(layout[0].id, "cards");
        assert.deepEqual(
            layout.slice(1).map(item => item.id),
            DEFAULT_LAYOUT.filter(item => item.id !== "cards").map(item => item.id),
        );
    });

    test("drops unknown and duplicated blocks", () => {
        const layout = normalizeLayout([
            { id: "forecast", width: 67, height: 500 },
            { id: "forecast", width: 100, height: 600 },
            { id: "nope", width: 33, height: 400 },
        ]);

        assert.equal(layout.filter(item => item.id === "forecast").length, 1);
        assert.equal(layout[0].width, 67);
        assert.equal(layout[0].height, 500);
        assert.equal(layout.length, DEFAULT_LAYOUT.length);
    });

    test("replaces an out-of-range width with the default width", () => {
        const layout = normalizeLayout([{ id: "bills", width: 150, height: 400 }]);

        assert.equal(layout[0].width, DEFAULT_LAYOUT.find(item => item.id === "bills")?.width);
        assert.equal(layout[0].height, 400);
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

describe("setBlockSize", () => {
    test("resizes width (%) and height (px) freely within bounds", () => {
        const resized = setBlockSize(DEFAULT_LAYOUT, "cards", { width: 42, height: 515 });
        assert.deepEqual(resized.find(item => item.id === "cards"), {
            id: "cards",
            width: 42,
            height: 515,
        });

        const clampedMin = setBlockSize(DEFAULT_LAYOUT, "cards", { width: 5, height: 100 });
        assert.deepEqual(clampedMin.find(item => item.id === "cards"), {
            id: "cards",
            width: MIN_DASHBOARD_WIDTH_PCT,
            height: MIN_DASHBOARD_HEIGHT_PX,
        });

        const clampedMax = setBlockSize(DEFAULT_LAYOUT, "cards", { width: 140, height: 2000 });
        assert.deepEqual(clampedMax.find(item => item.id === "cards"), {
            id: "cards",
            width: MAX_DASHBOARD_WIDTH_PCT,
            height: MAX_DASHBOARD_HEIGHT_PX,
        });
    });

    test("formats thirds cleanly so 3 cards always fit side by side", () => {
        assert.equal(widthCssPercent(33), "33.33%");
        assert.equal(widthCssPercent(67), "66.66%");
        assert.equal(widthCssPercent(50), "50%");
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
        target.setItem(DASHBOARD_LAYOUT_CACHE_KEY, JSON.stringify([{ id: "cards", width: 50 }]));

        const cached = readCachedLayout(target);
        assert.equal(cached?.[0].id, "cards");
        assert.equal(cached?.[0].height, DEFAULT_DASHBOARD_HEIGHT_PX);
        assert.equal(cached?.length, DEFAULT_LAYOUT.length);
    });
});
