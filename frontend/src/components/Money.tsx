"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { usePrivacy } from "@/lib/privacy";

/** BRL amount that is blurred while the header "eye" is off. */
export function Money({ value, className, format = formatCurrency }: { value: number; className?: string; format?: (value: number) => string }) {
    const { hidden } = usePrivacy();
    return (
        <span data-money className={cn("privacy-value", hidden && "privacy-blur", className)}>
            {format(value)}
        </span>
    );
}
