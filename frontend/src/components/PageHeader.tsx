import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTH_NAMES } from "@/lib/format";

interface PageHeaderProps {
    title: string;
    count?: number;
    description?: string;
    actions?: React.ReactNode;
}

export function PageHeader({ title, count, description, actions }: PageHeaderProps) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 className="text-[22px] font-medium tracking-tight text-foreground">
                    {title}
                    {count != null && <span className="ml-2 text-base font-normal text-muted-foreground">({count})</span>}
                </h1>
                {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
    );
}

interface MonthNavigatorProps {
    month: number; // 1-indexed
    year: number;
    onPrev: () => void;
    onNext: () => void;
}

export function MonthNavigator({ month, year, onPrev, onNext }: MonthNavigatorProps) {
    return (
        <div className="inline-flex h-9 items-center rounded-md border bg-card">
            <button
                type="button"
                onClick={onPrev}
                aria-label="Mês anterior"
                className="flex h-full w-9 items-center justify-center rounded-l-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
                <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[140px] border-x px-3 text-center text-sm font-medium tabular-nums" aria-live="polite">
                {MONTH_NAMES[month - 1]} {year}
            </span>
            <button
                type="button"
                onClick={onNext}
                aria-label="Próximo mês"
                className="flex h-full w-9 items-center justify-center rounded-r-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    );
}
