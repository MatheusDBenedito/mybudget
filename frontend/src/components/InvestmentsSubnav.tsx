"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, HandCoins, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const SUBNAV_ITEMS = [
    {
        href: "/investimentos",
        label: "Carteira",
        icon: Briefcase,
        exact: true,
    },
    {
        href: "/investimentos/proventos",
        label: "Proventos",
        icon: HandCoins,
        exact: false,
    },
    {
        href: "/investimentos/metas",
        label: "Metas",
        icon: Target,
        exact: false,
    },
];

export function InvestmentsSubnav() {
    const pathname = usePathname();

    return (
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1 w-fit">
            {SUBNAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                            active
                                ? "bg-foreground text-background shadow-xs"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                    >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {label}
                    </Link>
                );
            })}
        </div>
    );
}

