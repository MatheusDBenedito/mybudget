"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CreditCard, Settings, TrendingUp, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed inset-y-0 left-0 w-64 border-r bg-white flex flex-col z-10">
            <div className="flex h-16 items-center px-6">
                <h1 className="text-xl font-bold text-emerald-600">MyFinance</h1>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-1">
                <Link
                    href="/"
                    className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                        pathname === "/"
                            ? "bg-emerald-50 text-emerald-700 font-medium"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                >
                    <LayoutDashboard className="h-5 w-5" />
                    Dashboard
                </Link>
                <Link
                    href="/cartoes"
                    className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                        pathname === "/cartoes"
                            ? "bg-emerald-50 text-emerald-700 font-medium"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                >
                    <CreditCard className="h-5 w-5" />
                    Cartões
                </Link>
                <Link
                    href="/investimentos"
                    className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                        pathname === "/investimentos"
                            ? "bg-emerald-50 text-emerald-700 font-medium"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                >
                    <TrendingUp className="h-5 w-5" />
                    Investimentos
                </Link>
                <Link
                    href="/relatorios"
                    className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                        pathname === "/relatorios"
                            ? "bg-emerald-50 text-emerald-700 font-medium"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                >
                    <BarChart3 className="h-5 w-5" />
                    Relatórios
                </Link>
                <Link
                    href="/configuracoes"
                    className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                        pathname === "/configuracoes"
                            ? "bg-emerald-50 text-emerald-700 font-medium"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                >
                    <Settings className="h-5 w-5" />
                    Configurações
                </Link>
            </nav>
        </aside>
    );
}
