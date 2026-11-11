"use client";

import { Money } from "@/components/Money";

import type { LucideIcon } from "lucide-react";
import { ChevronDown, ChartPie } from "lucide-react";
import { TrendPill, TrendText } from "@/components/ui/trend";
import { formatPercent } from "@/lib/format";
import type { ClassStats } from "@/lib/investments";

interface InvestmentSectionProps {
    title: string;
    icon: LucideIcon;
    stats: ClassStats;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

function Metric({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={`text-left sm:text-right ${className}`}>
            <div className="text-[13px] text-muted-foreground">{label}</div>
            <div className="mt-0.5 text-[15px] text-foreground tabular-nums">{children}</div>
        </div>
    );
}

function Chevron({ isOpen, className }: { isOpen: boolean; className: string }) {
    return (
        <span className={`h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground ${className}`}>
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            <span className="sr-only">{isOpen ? "Recolher seção" : "Expandir seção"}</span>
        </span>
    );
}

export function InvestmentSection({ title, icon: Icon, stats, isOpen, onToggle, children }: InvestmentSectionProps) {
    const contentId = `section-${title.replace(/\W+/g, "-").toLowerCase()}`;

    return (
        <section className="overflow-hidden rounded-lg border bg-card">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isOpen}
                aria-controls={contentId}
                className="flex w-full flex-wrap items-center gap-x-10 gap-y-3 py-4 pl-4 pr-5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
                <div className="flex min-w-[220px] flex-1 items-center gap-3">
                    {/* Decorative grip, mirrors the reference layout */}
                    <span className="grid grid-cols-2 gap-[3px] opacity-40" aria-hidden="true">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <span key={i} className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />
                        ))}
                    </span>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-asset-icon-border bg-asset-icon-soft text-asset-icon">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-xl font-medium text-foreground">{title}</span>
                    <Chevron isOpen={isOpen} className="ml-auto flex sm:hidden" />
                </div>

                <div className="grid w-full grid-cols-2 gap-x-6 gap-y-3 pl-[30px] sm:flex sm:w-auto sm:gap-x-10 sm:pl-0">
                    <Metric label="Ativos" className="sm:min-w-[48px]">{stats.count}</Metric>
                    <Metric label="Valor total" className="sm:min-w-[120px]"><Money value={stats.current} /></Metric>
                    <Metric label="Variação" className="sm:min-w-[110px]">
                        <TrendText value={stats.profit} label=<Money value={stats.profit} /> />
                    </Metric>
                    <Metric label="Rentabilidade" className="sm:min-w-[110px]">
                        <TrendPill value={stats.profitPct} className="text-[15px]" />
                    </Metric>
                    <Metric label="% na carteira" className="sm:min-w-[96px]">
                        <span className="inline-flex items-center gap-1">
                            <ChartPie className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                            {formatPercent(stats.portfolioPct)}
                        </span>
                    </Metric>
                </div>

                <Chevron isOpen={isOpen} className="hidden sm:flex" />
            </button>

            {isOpen && (
                <div id={contentId} className="border-t">
                    {children}
                </div>
            )}
        </section>
    );
}
