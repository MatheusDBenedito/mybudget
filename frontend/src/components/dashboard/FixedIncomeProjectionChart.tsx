"use client";

import { Money } from "@/components/Money";

import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { shortMonthLabel } from "@/lib/cash-flow";
import type { FixedIncomeProjectionPoint } from "@/lib/fixed-income";

const compact = (v: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);

type TooltipEntry = { name: string; value: number; color: string };

function ProjectionTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border bg-card p-3 text-sm shadow-md">
            <p className="mb-1 font-medium">{label}</p>
            {payload.map(entry => (
                <p key={entry.name} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        {entry.name}
                    </span>
                    <span className="tabular-nums"><Money value={entry.value} /></span>
                </p>
            ))}
        </div>
    );
}

export function FixedIncomeProjectionChart({ points }: { points: FixedIncomeProjectionPoint[] }) {
    const data = points.map(p => ({
        label: p.monthOffset === 0 ? "Hoje" : shortMonthLabel({ year: p.date.getFullYear(), month: p.date.getMonth() + 1 }),
        "Valor bruto": p.gross,
        "Valor líquido": p.net,
        Aportado: p.invested,
    }));
    const min = Math.min(...points.map(p => p.invested)) * 0.98;

    return (
        <div className="h-[240px] min-w-0 w-full" role="img" aria-label="Projeção do valor bruto e líquido da renda fixa para os próximos 12 meses">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 240 }}>
                <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="fixedIncomeNet" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#12b886" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#12b886" stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e3e5e9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#646a73" }} tickLine={false} axisLine={false} />
                    <YAxis domain={[min, "auto"]} tick={{ fontSize: 12, fill: "#646a73" }} tickFormatter={compact} tickLine={false} axisLine={false} width={48} />
                    <Tooltip content={<ProjectionTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 13 }} iconType="circle" iconSize={9} />
                    <Area type="monotone" dataKey="Valor bruto" stroke="#1c1f24" strokeWidth={1.5} fill="none" />
                    <Area type="monotone" dataKey="Valor líquido" stroke="#12b886" strokeWidth={2} fill="url(#fixedIncomeNet)" />
                    <Line type="monotone" dataKey="Aportado" stroke="#94a3b8" strokeDasharray="4 4" dot={false} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
