"use client";

import { Money } from "@/components/Money";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

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
}

/** Donut with the total in the center and a legend listing value and share of each slice. */
export function DonutChart({ data, centerLabel, emptyMessage, ariaLabel, stacked }: DonutChartProps) {
    const slices = data.filter(d => d.value > 0);
    const total = slices.reduce((acc, d) => acc + d.value, 0);

    if (slices.length === 0) {
        return <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
    }

    return (
        <div className={stacked ? "flex flex-col items-center gap-4" : "flex flex-col items-center gap-4 sm:flex-row"}>
            <div className="relative h-[200px] w-[200px] shrink-0" role="img" aria-label={ariaLabel}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={slices} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={slices.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
                            {slices.map(s => <Cell key={s.name} fill={s.color} />)}
                        </Pie>
                        <Tooltip content={<SliceTooltip total={total} />} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-sm font-medium tabular-nums"><Money value={total} /></span>
                    <span className="text-[11px] text-muted-foreground">{centerLabel}</span>
                </div>
            </div>
            <ul className="w-full min-w-0 space-y-2 text-sm">
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
