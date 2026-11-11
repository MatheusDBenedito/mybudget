// Chart helpers. Pure functions (no React/aliases) so they can run under `node --test`.

/** Tailwind classes used by the category color picker, mapped to hex for SVG charts. */
const TAILWIND_HEX: Record<string, string> = {
    "bg-red-500": "#ef4444",
    "bg-orange-500": "#f97316",
    "bg-amber-500": "#f59e0b",
    "bg-yellow-500": "#eab308",
    "bg-lime-500": "#84cc16",
    "bg-green-500": "#22c55e",
    "bg-emerald-500": "#10b981",
    "bg-teal-500": "#14b8a6",
    "bg-cyan-500": "#06b6d4",
    "bg-sky-500": "#0ea5e9",
    "bg-blue-500": "#3b82f6",
    "bg-indigo-500": "#6366f1",
    "bg-violet-500": "#8b5cf6",
    "bg-purple-500": "#a855f7",
    "bg-fuchsia-500": "#d946ef",
    "bg-pink-500": "#ec4899",
    "bg-rose-500": "#f43f5e",
    "bg-stone-500": "#78716c",
    "bg-neutral-800": "#262626",
    "bg-slate-400": "#94a3b8",
};

/** Neutral palette for series without their own color (e.g. investment classes). */
export const CHART_PALETTE = ["#1c1f24", "#12b886", "#3b82f6", "#f59e0b", "#a855f7", "#f0476a", "#14b8a6", "#78716c"];

/** Resolves a stored color (hex or Tailwind bg class) to hex, falling back to the palette. */
export function colorToHex(color: string | null | undefined, fallbackIndex: number): string {
    if (color?.startsWith("#")) return color;
    if (color && TAILWIND_HEX[color]) return TAILWIND_HEX[color];
    return CHART_PALETTE[fallbackIndex % CHART_PALETTE.length];
}
