"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  RotateCcw,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { usePrivacy } from "@/lib/privacy";
import type {
  AmortizeVsInvestPoint,
  FinancingEvolutionPoint,
} from "@/lib/financings";

function formatShortBrl(value: number, hidden: boolean): string {
  if (hidden) return "•••";
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}k`;
  }
  return `R$ ${value.toFixed(0)}`;
}

interface ChartTooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  hidden,
  labelPrefix = "",
}: {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string | number;
  hidden: boolean;
  labelPrefix?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs text-card-foreground shadow-xl">
      <p className="mb-1.5 font-semibold text-foreground">
        {labelPrefix}
        {String(label ?? "")}
      </p>
      <div className="space-y-1">
        {payload.map((entry, idx) => {
          const name = String(entry.name ?? entry.dataKey ?? "");
          const rawVal = Number(entry.value ?? 0);
          const formatted = hidden
            ? "••••••"
            : name.includes("%")
              ? `${rawVal.toFixed(4)}% a.m.`
              : formatCurrency(rawVal);

          return (
            <div key={idx} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color || "#6366f1" }}
                />
                {name}
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatted}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type PeriodPreset = "PAID" | "12M" | "24M" | "60M" | "ALL";

function useChartTimelineFilter(
  data: FinancingEvolutionPoint[],
  defaultPreset: PeriodPreset = "PAID"
) {
  const [preset, setPreset] = useState<PeriodPreset>(defaultPreset);
  const [zoomLevel, setZoomLevel] = useState(0); // -2 (zoom out) to +3 (zoom in)
  const [showBrush, setShowBrush] = useState(false);

  const currentMonth = useMemo(
    () => new Date().toISOString().slice(0, 7),
    []
  );

  const visibleData = useMemo(() => {
    const raw = data.filter((d) => d.installmentNumber !== 0);
    if (raw.length === 0) return [];

    let filtered = raw;

    if (preset === "PAID") {
      const paid = raw.filter(
        (d) => d.status === "PAID" || d.month <= currentMonth
      );
      filtered = paid.length > 0 ? paid : raw.slice(0, 36);
    } else if (preset === "12M") {
      const currentIndex = raw.findIndex((d) => d.month >= currentMonth);
      const center = currentIndex >= 0 ? currentIndex : raw.length - 1;
      const start = Math.max(0, center - 6);
      filtered = raw.slice(start, start + 12);
    } else if (preset === "24M") {
      const currentIndex = raw.findIndex((d) => d.month >= currentMonth);
      const center = currentIndex >= 0 ? currentIndex : raw.length - 1;
      const start = Math.max(0, center - 12);
      filtered = raw.slice(start, start + 24);
    } else if (preset === "60M") {
      const currentIndex = raw.findIndex((d) => d.month >= currentMonth);
      const center = currentIndex >= 0 ? currentIndex : 0;
      const start = Math.max(0, center - 12);
      filtered = raw.slice(start, start + 60);
    }

    if (zoomLevel !== 0 && filtered.length > 6) {
      const factor = Math.pow(0.75, zoomLevel);
      const newLen = Math.max(6, Math.min(raw.length, Math.round(filtered.length * factor)));
      const start = Math.max(0, Math.floor((filtered.length - newLen) / 2));
      filtered = filtered.slice(start, start + newLen);
    }

    return filtered;
  }, [currentMonth, data, preset, zoomLevel]);

  const currentMonthMarker = useMemo(() => {
    const hasCurrent = visibleData.some((d) => d.month === currentMonth);
    if (hasCurrent) return currentMonth;
    // Check if current month is in range between first and last
    if (visibleData.length > 0) {
      const first = visibleData[0].month;
      const last = visibleData[visibleData.length - 1].month;
      if (currentMonth >= first && currentMonth <= last) {
        return visibleData.find((d) => d.month >= currentMonth)?.month ?? null;
      }
    }
    return null;
  }, [currentMonth, visibleData]);

  const handleZoomIn = () => setZoomLevel((z) => Math.min(4, z + 1));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(-3, z - 1));
  const handleReset = () => {
    setPreset(defaultPreset);
    setZoomLevel(0);
  };

  return {
    preset,
    setPreset,
    zoomLevel,
    handleZoomIn,
    handleZoomOut,
    handleReset,
    showBrush,
    setShowBrush,
    currentMonth,
    currentMonthMarker,
    visibleData,
  };
}

interface ChartToolbarProps {
  preset: PeriodPreset;
  onSelectPreset: (p: PeriodPreset) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  showBrush: boolean;
  onToggleBrush: () => void;
  currentMonthMarker: string | null;
  currentMonth: string;
  totalPoints: number;
  visiblePoints: number;
  presets?: Array<{ id: PeriodPreset; label: string }>;
}

function ChartToolbar({
  preset,
  onSelectPreset,
  onZoomIn,
  onZoomOut,
  onReset,
  showBrush,
  onToggleBrush,
  currentMonthMarker,
  currentMonth,
  totalPoints,
  visiblePoints,
  presets = [
    { id: "PAID", label: "Realizado (Pagas)" },
    { id: "12M", label: "12m" },
    { id: "24M", label: "24m" },
    { id: "60M", label: "5 anos" },
    { id: "ALL", label: "Tudo" },
  ],
}: ChartToolbarProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
      {/* Presets */}
      <div className="flex flex-wrap items-center gap-1">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectPreset(p.id)}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              preset === p.id
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Controls & Badges */}
      <div className="flex flex-wrap items-center gap-2">
        {currentMonthMarker && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-medium text-rose-500">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            Mês atual: {currentMonth}
          </span>
        )}

        <span className="text-[11px] text-muted-foreground">
          {visiblePoints} de {totalPoints} meses
        </span>

        {/* Zoom Controls */}
        <div className="inline-flex items-center rounded-md border border-border bg-muted/30 p-0.5">
          <button
            type="button"
            onClick={onZoomIn}
            title="Aproximar (Zoom In)"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onZoomOut}
            title="Afastar (Zoom Out)"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onReset}
            title="Restaurar visualização"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggleBrush}
            title={showBrush ? "Ocultar controle deslizante" : "Ativar controle deslizante de zoom"}
            className={`rounded p-1 transition-colors ${
              showBrush
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function PaymentEvolutionChart({
  data,
}: {
  data: FinancingEvolutionPoint[];
}) {
  const { hidden } = usePrivacy();
  const timeline = useChartTimelineFilter(data, "24M");

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Importe um extrato ou cadastre parcelas para visualizar a evolução.
      </div>
    );
  }

  return (
    <div className="w-full">
      <ChartToolbar
        preset={timeline.preset}
        onSelectPreset={timeline.setPreset}
        onZoomIn={timeline.handleZoomIn}
        onZoomOut={timeline.handleZoomOut}
        onReset={timeline.handleReset}
        showBrush={timeline.showBrush}
        onToggleBrush={() => timeline.setShowBrush(!timeline.showBrush)}
        currentMonth={timeline.currentMonth}
        currentMonthMarker={timeline.currentMonthMarker}
        totalPoints={data.length}
        visiblePoints={timeline.visibleData.length}
      />

      <div className={timeline.showBrush ? "h-80 w-full" : "h-72 w-full"}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={timeline.visibleData}
            margin={{ top: 24, right: 12, left: 0, bottom: timeline.showBrush ? 10 : 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} minTickGap={20} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => formatShortBrl(v, hidden)}
              width={62}
            />
            {timeline.currentMonthMarker && (
              <ReferenceLine
                x={timeline.currentMonthMarker}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="3 3"
                label={{
                  value: "Mês Atual",
                  position: "top",
                  fill: "#ef4444",
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            )}
            <Tooltip content={<ChartTooltip hidden={hidden} />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="principal"
              name="Amortização Real"
              stackId="a"
              fill="#10b981"
              maxBarSize={48}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="interest"
              name="Juros"
              stackId="a"
              fill="#f59e0b"
              maxBarSize={48}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="fees"
              name="Seguros / Taxas"
              stackId="a"
              fill="#6366f1"
              maxBarSize={48}
              radius={[4, 4, 0, 0]}
            />
            {timeline.showBrush && (
              <Brush
                dataKey="month"
                height={26}
                stroke="#6366f1"
                fill="hsl(var(--muted))"
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function BalanceCurveChart({
  data,
}: {
  data: FinancingEvolutionPoint[];
}) {
  const { hidden } = usePrivacy();
  const timeline = useChartTimelineFilter(data, "ALL");

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Sem histórico de saldo devedor ainda.
      </div>
    );
  }

  return (
    <div className="w-full">
      <ChartToolbar
        preset={timeline.preset}
        onSelectPreset={timeline.setPreset}
        onZoomIn={timeline.handleZoomIn}
        onZoomOut={timeline.handleZoomOut}
        onReset={timeline.handleReset}
        showBrush={timeline.showBrush}
        onToggleBrush={() => timeline.setShowBrush(!timeline.showBrush)}
        currentMonth={timeline.currentMonth}
        currentMonthMarker={timeline.currentMonthMarker}
        totalPoints={data.length}
        visiblePoints={timeline.visibleData.length}
        presets={[
          { id: "PAID", label: "Realizado (Pagas)" },
          { id: "60M", label: "5 anos" },
          { id: "ALL", label: "Contrato Todo" },
        ]}
      />

      <div className={timeline.showBrush ? "h-80 w-full" : "h-72 w-full"}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={timeline.visibleData}
            margin={{ top: 24, right: 12, left: 0, bottom: timeline.showBrush ? 10 : 0 }}
          >
            <defs>
              <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} minTickGap={20} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => formatShortBrl(v, hidden)}
              width={68}
            />
            {timeline.currentMonthMarker && (
              <ReferenceLine
                x={timeline.currentMonthMarker}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="3 3"
                label={{
                  value: "Mês Atual",
                  position: "top",
                  fill: "#ef4444",
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            )}
            <Tooltip content={<ChartTooltip hidden={hidden} />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="balance"
              name="Saldo Devedor"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#balanceGrad)"
            />
            {timeline.showBrush && (
              <Brush
                dataKey="month"
                height={26}
                stroke="#3b82f6"
                fill="hsl(var(--muted))"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AmortizeVsInvestChart({
  series,
}: {
  series: AmortizeVsInvestPoint[];
}) {
  const { hidden } = usePrivacy();

  if (series.length === 0) return null;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11 }}
            tickFormatter={(m: number) => `${m}m`}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => formatShortBrl(v, hidden)}
            width={68}
          />
          <Tooltip content={<ChartTooltip hidden={hidden} labelPrefix="Mês " />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="debtSavedWithAmortization"
            name="Economia ao Amortizar"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="investBalanceNet"
            name="Valor Líquido Investido"
            stroke="#8b5cf6"
            strokeWidth={2.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrImpactChart({
  data,
}: {
  data: FinancingEvolutionPoint[];
}) {
  const { hidden } = usePrivacy();
  // For TR, default to "PAID" so user sees the real historical TR clearly without 300 empty future bars
  const timeline = useChartTimelineFilter(data, "PAID");

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Sem dados de parcelas para calcular a TR.
      </div>
    );
  }

  return (
    <div className="w-full">
      <ChartToolbar
        preset={timeline.preset}
        onSelectPreset={timeline.setPreset}
        onZoomIn={timeline.handleZoomIn}
        onZoomOut={timeline.handleZoomOut}
        onReset={timeline.handleReset}
        showBrush={timeline.showBrush}
        onToggleBrush={() => timeline.setShowBrush(!timeline.showBrush)}
        currentMonth={timeline.currentMonth}
        currentMonthMarker={timeline.currentMonthMarker}
        totalPoints={data.length}
        visiblePoints={timeline.visibleData.length}
        presets={[
          { id: "PAID", label: "Realizado (Pagas)" },
          { id: "12M", label: "12m" },
          { id: "24M", label: "24m" },
          { id: "60M", label: "5 anos" },
          { id: "ALL", label: "Contrato Todo (30a)" },
        ]}
      />

      <div className={timeline.showBrush ? "h-80 w-full" : "h-72 w-full"}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={timeline.visibleData}
            margin={{ top: 24, right: 16, left: 0, bottom: timeline.showBrush ? 10 : 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} minTickGap={20} />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => formatShortBrl(v, hidden)}
              width={62}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `${v.toFixed(2)}%`}
              width={52}
            />
            {timeline.currentMonthMarker && (
              <ReferenceLine
                yAxisId="left"
                x={timeline.currentMonthMarker}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="3 3"
                label={{
                  value: "Mês Atual",
                  position: "top",
                  fill: "#ef4444",
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            )}
            <Tooltip content={<ChartTooltip hidden={hidden} />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              yAxisId="left"
              dataKey="principal"
              name="Amortização Real (R$)"
              fill="#10b981"
              maxBarSize={48}
              radius={[3, 3, 0, 0]}
            />
            <Bar
              yAxisId="left"
              dataKey="trAmount"
              name="Acréscimo TR no Saldo (R$)"
              fill="#f97316"
              maxBarSize={48}
              radius={[3, 3, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="trRatePct"
              name="TR (% a.m.)"
              stroke="#0284c7"
              strokeWidth={2}
              dot={{ r: 2 }}
            />
            {timeline.showBrush && (
              <Brush
                dataKey="month"
                height={26}
                stroke="#f97316"
                fill="hsl(var(--muted))"
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
