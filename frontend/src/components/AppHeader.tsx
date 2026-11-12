"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gauge, CreditCard, LayoutGrid, ChartColumn, Settings, CircleDollarSign, Plane, ArrowLeftRight, Eye, EyeOff, ChevronDown, Briefcase, HandCoins } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrivacy } from "@/lib/privacy";

type NavItem = {
    href: string;
    label: string;
    icon: typeof Gauge;
    children?: Array<{ href: string; label: string; icon: typeof Gauge; exact?: boolean }>;
};

const NAV_ITEMS: NavItem[] = [
    { href: "/", label: "Resumo", icon: Gauge },
    { href: "/fluxo-de-caixa", label: "Fluxo de Caixa", icon: ArrowLeftRight },
    {
        href: "/investimentos",
        label: "Investimentos",
        icon: LayoutGrid,
        children: [
            { href: "/investimentos", label: "Carteira", icon: Briefcase, exact: true },
            { href: "/investimentos/proventos", label: "Proventos", icon: HandCoins },
        ],
    },
    { href: "/cartoes", label: "Cartões", icon: CreditCard },
    { href: "/milhas", label: "Milhas", icon: Plane },
    { href: "/relatorios", label: "Relatórios", icon: ChartColumn },
    { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppHeader() {
    const pathname = usePathname();
    const { hidden, toggle } = usePrivacy();
    const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

    return (
        <header className="sticky top-0 z-30">
            <div className="bg-header text-header-foreground">
                <div className="mx-auto flex h-14 max-w-[1680px] items-center justify-between px-4 sm:px-6 lg:px-8">
                    <Link href="/" className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                        <span className="text-xl font-semibold tracking-tight">MyFinance</span>
                        <CircleDollarSign className="h-5 w-5 text-positive-fill" aria-hidden="true" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={toggle}
                            aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
                            aria-pressed={hidden}
                            title={hidden ? "Mostrar valores" : "Ocultar valores"}
                            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/20 text-white/90 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
                        >
                            {hidden
                                ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                                : <Eye className="h-4 w-4" aria-hidden="true" />}
                        </button>
                        <Link
                            href="/configuracoes"
                            aria-label="Configurações"
                            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/20 text-white/90 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
                        >
                            <Settings className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </div>
                </div>
            </div>

            <nav className="border-b bg-card" aria-label="Navegação principal">
                <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
                    <ul className="-mb-px flex gap-6 overflow-x-auto sm:overflow-visible [scrollbar-width:none]">
                        {NAV_ITEMS.map(({ href, label, icon: Icon, children }) => {
                            const active = isActive(href);
                            return (
                                <li key={href} className="relative group">
                                    <Link
                                        href={href}
                                        aria-current={active ? "page" : undefined}
                                        className={cn(
                                            "flex h-12 items-center gap-2 whitespace-nowrap border-b-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                                            active
                                                ? "border-foreground font-medium text-foreground"
                                                : "border-transparent text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                        {label}
                                        {children && (
                                            <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:rotate-180" aria-hidden="true" />
                                        )}
                                    </Link>
                                    {children && (
                                        <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 absolute left-0 top-full z-40 pt-1 transition-all duration-150">
                                            <div className="min-w-[190px] rounded-lg border bg-card p-1.5 shadow-lg">
                                                {children.map((sub) => {
                                                    const SubIcon = sub.icon;
                                                    const subActive = sub.exact
                                                        ? pathname === sub.href
                                                        : pathname.startsWith(sub.href);
                                                    return (
                                                        <Link
                                                            key={sub.href}
                                                            href={sub.href}
                                                            className={cn(
                                                                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                                                                subActive
                                                                    ? "bg-muted font-medium text-foreground"
                                                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                                                            )}
                                                        >
                                                            <SubIcon className="h-4 w-4" aria-hidden="true" />
                                                            {sub.label}
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </nav>
        </header>
    );
}
