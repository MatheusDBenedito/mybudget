"use client";

import { Money } from "@/components/Money";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { type CashFlowData, shortMonthLabel } from "@/lib/cash-flow";

const compact = (v: number) =>
    new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);

type TooltipEntry = { name: string; value: number; color: string };

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
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

export function IncomeVsExpensesChart({ data }: { data: CashFlowData }) {
    const chartData = data.months.map((m, i) => ({
        label: shortMonthLabel(m),
        Recebimentos: data.summary.income[i],
        Despesas: data.summary.expenses[i],
        "Saldo projetado": data.summary.projectedBalance[i] ?? undefined,
    }));

    return (
        <div className="h-[300px] w-full" role="img" aria-label="Gráfico de recebimentos e despesas nos próximos 12 meses, com o saldo projetado">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e3e5e9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#646a73" }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="flow" tick={{ fontSize: 12, fill: "#646a73" }} tickFormatter={compact} tickLine={false} axisLine={false} width={48} />
                    <YAxis yAxisId="balance" orientation="right" tick={{ fontSize: 12, fill: "#646a73" }} tickFormatter={compact} tickLine={false} axisLine={false} width={48} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f2f4" }} />
                    <Legend wrapperStyle={{ fontSize: 13 }} iconType="circle" iconSize={9} />
                    <Bar yAxisId="flow" dataKey="Recebimentos" fill="#12b886" radius={[3, 3, 0, 0]} maxBarSize={28} />
                    <Bar yAxisId="flow" dataKey="Despesas" fill="#f0476a" radius={[3, 3, 0, 0]} maxBarSize={28} />
                    <Line yAxisId="balance" type="monotone" dataKey="Saldo projetado" stroke="#1c1f24" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
