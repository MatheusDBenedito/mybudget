"use client";

import { Money } from "@/components/Money";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

export type DonutSlice = { name: string; value: number; color: string };

function SliceTooltip({ active, payload, total }: { active?: boolean; payload?: { name: string; value: number }[]; total: number }) {
    if (!active || !payload?.length) return null;
    const { name, value } = payload[0];
    return (
        <div className="rounded-lg border bg-card p-2.5 text-sm shadow-md">
            <p className="font-medium">{name}</p>
            <p className="tabular-nums"><Money value={value} /> · {((value / total) * 100).toFixed(1).replace(".", ",")}%</p>
        </div>
    );
}

interface DonutChartProps {
    data: DonutSlice[];
    /** Text under the total in the center of the donut */
    centerLabel: string;
    emptyMessage: string;
    ariaLabel: string;
    /** Legend always below the donut (for narrow cards) */
    stacked?: boolean;
    height?: number;
}

/** Donut with the total in the center and a legend listing value and share of each slice. */
export function DonutChart({ data, centerLabel, emptyMessage, ariaLabel, stacked, height = 460 }: DonutChartProps) {
    const slices = data.filter(d => d.value > 0);
    const total = slices.reduce((acc, d) => acc + d.value, 0);
    const dims = height < 380
        ? { box: "h-[140px] w-[140px]", inner: 42, outer: 64 }
        : height >= 540
            ? { box: "h-[228px] w-[228px]", inner: 72, outer: 106 }
            : { box: "h-[180px] w-[180px]", inner: 56, outer: 84 };

    if (slices.length === 0) {
        return <p className="my-auto py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
    }

    return (
        <div className={cn("min-h-0 flex-1", stacked ? "flex flex-col items-center justify-between gap-3" : "flex flex-col items-center justify-center gap-4 sm:flex-row")}>
            <div className={cn("relative shrink-0", dims.box)} role="img" aria-label={ariaLabel}>
                <div className="relative z-10 h-full w-full min-w-0 min-h-0">
                    <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 180, height: 180 }}>
                        <PieChart>
                            <Pie data={slices} dataKey="value" nameKey="name" innerRadius={dims.inner} outerRadius={dims.outer} paddingAngle={slices.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
                                {slices.map(s => <Cell key={s.name} fill={s.color} />)}
                            </Pie>
                            <Tooltip content={<SliceTooltip total={total} />} wrapperStyle={{ zIndex: 30, pointerEvents: "none" }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center px-3 text-center">
                    <span className="text-sm font-medium tabular-nums"><Money value={total} /></span>
                    <span className="text-[11px] text-muted-foreground">{centerLabel}</span>
                </div>
            </div>
            <ul className="w-full min-w-0 flex-1 space-y-2 overflow-y-auto pr-1 text-sm">
                {slices.map(s => (
                    <li key={s.name} className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                            <span className="truncate">{s.name}</span>
                        </span>
                        <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                            <span><Money value={s.value} /></span>
                            <span className="w-12 text-right text-xs text-muted-foreground">{((s.value / total) * 100).toFixed(1).replace(".", ",")}%</span>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
