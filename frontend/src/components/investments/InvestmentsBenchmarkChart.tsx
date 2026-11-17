"use client";

import { useState } from "react";
import { LineChart as LineChartIcon } from "lucide-react";
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    ANALYTICS_RANGES,
    type AnalyticsRange,
    type BenchmarkPoint,
    type InvestmentsAnalyticsResponse,
    formatShortBrDate,
} from "./analytics-types";

type BenchmarkKey = "portfolioPct" | "cdiPct" | "ipcaPct" | "ibovPct" | "sp500Pct";

const SERIES_CONFIG: Array<{ key: BenchmarkKey; label: string; color: string; defaultOn: boolean }> = [
    { key: "portfolioPct", label: "Sua Carteira", color: "#12b886", defaultOn: true },
    { key: "cdiPct", label: "CDI", color: "#3b82f6", defaultOn: true },
    { key: "ipcaPct", label: "IPCA", color: "#f59e0b", defaultOn: true },
    { key: "ibovPct", label: "IBOV", color: "#8b5cf6", defaultOn: true },
    { key: "sp500Pct", label: "S&P 500", color: "#ec4899", defaultOn: false },
];

interface InvestmentsBenchmarkChartProps {
    data: InvestmentsAnalyticsResponse | null;
    range: AnalyticsRange;
    onRangeChange: (next: AnalyticsRange) => void;
    isLoading?: boolean;
    height?: number;
    className?: string;
}

export function InvestmentsBenchmarkChart({
    data,
    range,
    onRangeChange,
    isLoading = false,
    height,
    className,
}: InvestmentsBenchmarkChartProps) {
    const [activeSeries, setActiveSeries] = useState<Record<BenchmarkKey, boolean>>({
        portfolioPct: true,
        cdiPct: true,
        ipcaPct: true,
        ibovPct: true,
        sp500Pct: false,
    });

    const benchmarks: BenchmarkPoint[] = data?.benchmarks ?? [];
    const latest = benchmarks.length > 0 ? benchmarks[benchmarks.length - 1] : null;
    const chartHeight = height ? Math.max(170, height - 185) : 260;

    const toggleSeries = (key: BenchmarkKey) => {
        setActiveSeries(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <Card className={className} style={height ? { height } : undefined}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
                <div className="flex items-center gap-2">
                    <LineChartIcon className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">Carteira vs. Índices</CardTitle>
                </div>
                <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-0.5">
                    {ANALYTICS_RANGES.map(item => (
                        <Button
                            key={item.value}
                            type="button"
                            size="xs"
                            variant={range === item.value ? "default" : "ghost"}
                            onClick={() => onRangeChange(item.value)}
                            className="h-6 px-2 text-xs"
                        >
                            {item.label}
                        </Button>
                    ))}
                </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                    {SERIES_CONFIG.map(s => {
                        const isOn = activeSeries[s.key];
                        const val = latest?.[s.key];
                        return (
                            <button
                                key={s.key}
                                type="button"
                                onClick={() => toggleSeries(s.key)}
                                className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-opacity",
                                    isOn ? "bg-card opacity-100" : "bg-muted/40 opacity-50",
                                )}
                            >
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                                <span>{s.label}</span>
                                {val != null && (
                                    <span className="tabular-nums text-muted-foreground">
                                        {val >= 0 ? `+${val.toFixed(2)}%` : `${val.toFixed(2)}%`}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {isLoading && benchmarks.length === 0 ? (
                    <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: chartHeight }}>
                        Carregando comparativo com índices...
                    </div>
                ) : benchmarks.length === 0 ? (
                    <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: chartHeight }}>
                        Sem dados de índices disponíveis no período.
                    </div>
                ) : (
                    <div style={{ width: "100%", height: chartHeight }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={benchmarks} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={formatShortBrDate}
                                    tick={{ fontSize: 11 }}
                                    minTickGap={20}
                                />
                                <YAxis
                                    tickFormatter={v => `${Number(v).toFixed(1)}%`}
                                    tick={{ fontSize: 11 }}
                                    width={48}
                                />
                                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                                <Tooltip
                                    formatter={(val, name) => [`${Number(val).toFixed(2)}%`, String(name)]}
                                    labelFormatter={label => formatShortBrDate(String(label))}
                                />
                                {SERIES_CONFIG.filter(s => activeSeries[s.key]).map(s => (
                                    <Line
                                        key={s.key}
                                        type="monotone"
                                        dataKey={s.key}
                                        name={s.label}
                                        stroke={s.color}
                                        strokeWidth={s.key === "portfolioPct" ? 2.5 : 1.75}
                                        dot={false}
                                        connectNulls
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
