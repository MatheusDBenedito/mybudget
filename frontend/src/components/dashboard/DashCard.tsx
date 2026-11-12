import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { splitMoney } from "@/lib/dashboard";

/** Rounded summary card used on the Resumo page. */
export function DashCard({ title, subtitle, art, actions, className, children }: {
    title: string;
    subtitle?: React.ReactNode;
    /** Decorative illustration in the top-right corner */
    art?: { icon: LucideIcon; tone: "green" | "blue" | "amber" | "violet" | "rose" | "slate" };
    /** Controls in the top-right corner (replaces the illustration) */
    actions?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <section className={cn("relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-card p-5", className)} aria-label={title}>
            <header className="mb-3 flex shrink-0 items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold">{title}</h2>
                    {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
                </div>
                {actions ?? (art && <Art {...art} />)}
            </header>
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </section>
    );
}

const TONES = {
    green: "from-emerald-100 to-emerald-50 text-emerald-600 ring-emerald-200/70",
    blue: "from-blue-100 to-sky-50 text-blue-600 ring-blue-200/70",
    amber: "from-amber-100 to-orange-50 text-amber-600 ring-amber-200/70",
    violet: "from-violet-100 to-fuchsia-50 text-violet-600 ring-violet-200/70",
    rose: "from-rose-100 to-pink-50 text-rose-600 ring-rose-200/70",
    slate: "from-slate-100 to-slate-50 text-slate-600 ring-slate-200/70",
};

function Art({ icon: Icon, tone }: { icon: LucideIcon; tone: keyof typeof TONES }) {
    return (
        <span
            aria-hidden="true"
            className={cn("flex h-14 w-14 shrink-0 -rotate-6 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm ring-1", TONES[tone])}
        >
            <Icon className="h-7 w-7" strokeWidth={1.8} />
        </span>
    );
}

/** Big amount with smaller cents, e.g. R$ 5.304,28. Blurred by the header eye through CSS. */
export function BigMoney({ value, size = "lg", className }: { value: number; size?: "xl" | "lg" | "md"; className?: string }) {
    const { whole, cents } = splitMoney(value);
    const sizes = { xl: "text-5xl", lg: "text-3xl", md: "text-2xl" };
    return (
        <span className={cn("privacy-value font-semibold tracking-tight tabular-nums", sizes[size], className)}>
            {whole}
            <span className="text-[0.5em] font-medium text-muted-foreground">{cents}</span>
        </span>
    );
}
