import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PanelProps {
    title: string;
    icon?: LucideIcon;
    count?: number;
    actions?: React.ReactNode;
    className?: string;
    /** Remove body padding, e.g. for edge-to-edge tables */
    flush?: boolean;
    children: React.ReactNode;
}

/** Titled white card used for lists, tables and charts. */
export function Panel({ title, icon: Icon, count, actions, className, flush, children }: PanelProps) {
    return (
        <section className={cn("flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card", className)} aria-label={title}>
            <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                <div className="flex items-center gap-3">
                    {Icon && (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                    )}
                    <h2 className="text-[15px] font-medium">
                        {title}
                        {count != null && <span className="ml-1.5 font-normal text-muted-foreground">({count})</span>}
                    </h2>
                </div>
                {actions}
            </header>
            <div className={cn("flex min-h-0 flex-1 flex-col", flush ? undefined : "p-4")}>{children}</div>
        </section>
    );
}
