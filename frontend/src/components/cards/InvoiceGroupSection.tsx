"use client";

import { Money } from "@/components/Money";

import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";

interface InvoiceGroupSectionProps {
    id: string;
    title: string;
    icon: LucideIcon;
    count: number;
    total: number;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

/** Collapsible group of an invoice (Fixos, Parcelados, À vista), same pattern as the investment sections. */
export function InvoiceGroupSection({ id, title, icon: Icon, count, total, isOpen, onToggle, children }: InvoiceGroupSectionProps) {
    const contentId = `invoice-group-${id}`;

    return (
        <section className="overflow-hidden rounded-lg border bg-card">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isOpen}
                aria-controls={contentId}
                className="flex w-full items-center gap-3 py-3 pl-4 pr-4 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-asset-icon-border bg-asset-icon-soft text-asset-icon">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-base font-medium text-foreground">{title}</span>
                <span className="text-sm text-muted-foreground tabular-nums">({count})</span>

                <span className="ml-auto text-right">
                    <span className="block text-[12px] text-muted-foreground">Total</span>
                    <span className="block text-[15px] font-medium tabular-nums text-foreground"><Money value={total} /></span>
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                    <span className="sr-only">{isOpen ? "Recolher seção" : "Expandir seção"}</span>
                </span>
            </button>

            {isOpen && (
                <div id={contentId} className="border-t">
                    {children}
                </div>
            )}
        </section>
    );
}
