"use client";

import { Activity } from "lucide-react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/Money";
import { formatCurrency } from "@/lib/format";
import {
    ANALYTICS_RANGES,
    type AnalyticsRange,
    type InvestmentsAnalyticsResponse,
    formatShortBrDate,
} from "./analytics-types";

interface InvestmentsDailyGainChartProps {
    data: InvestmentsAnalyticsResponse | null;
    range: AnalyticsRange;
    onRangeChange: (next: AnalyticsRange) => void;
    isLoading?: boolean;
    height?: number;
    className?: string;
}

export function InvestmentsDailyGainChart({
    data,
    range,
    onRangeChange,
    isLoading = false,
    height,
    className,
}: InvestmentsDailyGainChartProps) {
    const dailyGains = data?.dailyGains ?? [];
    const summary = data?.summary;
    const chartHeight = height ? Math.max(170, height - 185) : 260;

    return (
        <Card className={className} style={height ? { height } : undefined}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
                <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">Ganho diário dos investimentos</CardTitle>
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

            <CardContent className="flex flex-col justify-between gap-3">
                {summary && (
                    <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                        <div>
                            <div className="text-muted-foreground">Total ({range})</div>
                            <div className={`font-semibold tabular-nums ${summary.totalGain >= 0 ? "text-positive" : "text-negative"}`}>
                                <Money value={summary.totalGain} />
                            </div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">Média / dia</div>
                            <div className="font-medium tabular-nums">
                                <Money value={summary.averageDailyGain} />
                            </div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">Melhor dia</div>
                            <div className="font-medium tabular-nums text-positive">
                                {summary.bestDay ? <Money value={summary.bestDay.totalGain} /> : "—"}
                            </div>
                        </div>
                    </div>
                )}

                {isLoading && dailyGains.length === 0 ? (
                    <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: chartHeight }}>
                        Carregando rentabilidade diária...
                    </div>
                ) : dailyGains.length === 0 ? (
                    <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: chartHeight }}>
                        Sem dados diários suficientes no período.
                    </div>
                ) : (
                    <div style={{ width: "100%", height: chartHeight }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dailyGains} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={formatShortBrDate}
                                    tick={{ fontSize: 11 }}
                                    minTickGap={20}
                                />
                                <YAxis
                                    tickFormatter={v => `R$${Math.round(Number(v))}`}
                                    tick={{ fontSize: 11 }}
                                    width={56}
                                />
                                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const point = payload[0].payload as typeof dailyGains[number];
                                        return (
                                            <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                                                <div className="mb-1 font-semibold">{formatShortBrDate(point.date)} ({point.date})</div>
                                                <div className="flex justify-between gap-4">
                                                    <span className="text-muted-foreground">Renda Fixa:</span>
                                                    <span className="font-medium tabular-nums">{formatCurrency(point.fixedIncomeGain)}</span>
                                                </div>
                                                <div className="flex justify-between gap-4">
                                                    <span className="text-muted-foreground">Renda Variável:</span>
                                                    <span className="font-medium tabular-nums">{formatCurrency(point.variableIncomeGain)}</span>
                                                </div>
                                                <div className="mt-1 flex justify-between gap-4 border-t pt-1 font-semibold">
                                                    <span>Total do dia:</span>
                                                    <span className={point.totalGain >= 0 ? "text-positive" : "text-negative"}>
                                                        {formatCurrency(point.totalGain)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    }}
                                />
                                <Bar dataKey="totalGain" radius={[3, 3, 0, 0]}>
                                    {dailyGains.map((entry, idx) => (
                                        <Cell
                                            key={`${entry.date}-${idx}`}
                                            fill={entry.totalGain >= 0 ? "#12b886" : "#fa5252"}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
