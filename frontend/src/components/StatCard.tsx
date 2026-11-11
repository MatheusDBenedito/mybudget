import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
    title: string;
    icon: LucideIcon;
    /** Short explanation shown on hover/focus of the info icon */
    info?: string;
    className?: string;
    children: React.ReactNode;
}

/** Summary card in the Investidor10 style: round icon + label header, content indented under the label. */
export function StatCard({ title, icon: Icon, info, className, children }: StatCardProps) {
    return (
        <section className={cn("relative rounded-lg border bg-card p-4 pr-5", className)} aria-label={title}>
            <header className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <h2 className="text-sm font-medium text-foreground">{title}</h2>
            </header>
            {info && (
                <span
                    tabIndex={0}
                    title={info}
                    aria-label={info}
                    className="absolute right-3 top-3 rounded-full text-muted-foreground/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                    <Info className="h-4 w-4" aria-hidden="true" />
                </span>
            )}
            <div className="mt-3 pl-12">{children}</div>
        </section>
    );
}
