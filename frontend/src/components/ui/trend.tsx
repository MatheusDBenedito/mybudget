import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";

/** Rounded pill with a diagonal arrow, used for profitability ("Rentabilidade"). */
export function TrendPill({ value, label, className }: { value: number; label?: React.ReactNode; className?: string }) {
    const positive = value >= 0;
    const Arrow = positive ? ArrowUpRight : ArrowDownRight;
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-medium tabular-nums",
                positive ? "bg-positive-soft text-positive" : "bg-negative-soft text-negative",
                className
            )}
        >
            {label ?? formatPercent(value)}
            <Arrow className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">{positive ? "alta" : "queda"}</span>
        </span>
    );
}

/** Colored text with a small triangle, used for variations ("Variação"). */
export function TrendText({ value, label, className }: { value: number; label?: React.ReactNode; className?: string }) {
    const positive = value >= 0;
    return (
        <span className={cn("inline-flex items-center gap-1 font-medium tabular-nums", positive ? "text-positive" : "text-negative", className)}>
            {label ?? formatPercent(value)}
            <svg viewBox="0 0 10 6" className={cn("h-1.5 w-2.5 fill-current", !positive && "rotate-180")} aria-hidden="true">
                <path d="M5 0 10 6H0z" />
            </svg>
            <span className="sr-only">{positive ? "alta" : "queda"}</span>
        </span>
    );
}

export const trendTextClass = (value: number) => (value >= 0 ? "text-positive" : "text-negative");
