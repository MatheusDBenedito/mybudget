"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  Gauge,
  CreditCard,
  LayoutGrid,
  ChartColumn,
  Settings,
  CircleDollarSign,
  Plane,
  ArrowLeftRight,
  Eye,
  EyeOff,
  ChevronDown,
  Briefcase,
  HandCoins,
  Shield,
  LogOut,
  Building2,
  Tags,
  Landmark,
  Link2,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrivacy } from "@/lib/privacy";
import { useAuth } from "@/components/AuthProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type NavChildItem = {
  href: string;
  label: string;
  icon: typeof Gauge;
  exact?: boolean;
  tab?: string;
  superAdminOnly?: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof Gauge;
  requiredAny?: string[];
  superAdminOnly?: boolean;
  children?: NavChildItem[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Resumo", icon: Gauge, requiredAny: ["view:resumo"] },
  {
    href: "/fluxo-de-caixa",
    label: "Fluxo de Caixa",
    icon: ArrowLeftRight,
    requiredAny: ["view:fluxo_caixa", "view:despesa", "view:receita"],
  },
  {
    href: "/investimentos",
    label: "Investimentos",
    icon: LayoutGrid,
    requiredAny: ["view:investimentos"],
    children: [
      { href: "/investimentos", label: "Carteira", icon: Briefcase, exact: true },
      { href: "/investimentos/proventos", label: "Proventos", icon: HandCoins },
    ],
  },
  { href: "/cartoes", label: "Cartões", icon: CreditCard, requiredAny: ["view:cartao"] },
  { href: "/financiamentos", label: "Financiamentos", icon: Home, requiredAny: ["view:financiamentos"] },
  { href: "/milhas", label: "Milhas", icon: Plane, requiredAny: ["view:milhas"] },
  { href: "/relatorios", label: "Relatórios", icon: ChartColumn, requiredAny: ["view:fluxo_caixa"] },
  {
    href: "/configuracoes",
    label: "Configurações",
    icon: Settings,
    children: [
      { href: "/configuracoes?tab=workspaces", label: "Workspaces", icon: Building2, tab: "workspaces" },
      { href: "/configuracoes?tab=categorias", label: "Categorias", icon: Tags, tab: "categorias" },
      { href: "/configuracoes?tab=cartoes", label: "Cartões", icon: CreditCard, tab: "cartoes" },
      { href: "/configuracoes?tab=contas", label: "Contas", icon: Landmark, tab: "contas" },
      { href: "/configuracoes?tab=integracoes", label: "Integrações", icon: Link2, tab: "integracoes", superAdminOnly: true },
    ],
  },
  { href: "/admin", label: "Super Admin", icon: Shield, superAdminOnly: true },
];

function HeaderSubmenu({
  childrenItems,
  pathname,
  isSuperAdmin,
}: {
  childrenItems: NavChildItem[];
  pathname: string;
  isSuperAdmin?: boolean;
}) {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") ?? "workspaces";
  const visibleChildren = childrenItems.filter((sub) => !sub.superAdminOnly || isSuperAdmin);

  return (
    <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 absolute left-0 top-full z-40 pt-1 transition-all duration-150">
      <div className="min-w-[190px] rounded-lg border bg-card p-1.5 shadow-lg">
        {visibleChildren.map((sub) => {
          const SubIcon = sub.icon;
          const subActive = sub.tab
            ? pathname === "/configuracoes" && currentTab === sub.tab
            : sub.exact
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
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const { hidden, toggle } = usePrivacy();
  const {
    user,
    workspaces,
    activeWorkspace,
    pendingInvitesCount,
    hasAnyPermission,
    switchWorkspace,
    logout,
  } = useAuth();

  if (pathname === "/login" || pathname === "/register" || !user) {
    return null;
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.superAdminOnly) return user.isSuperAdmin;
    if (item.requiredAny) return hasAnyPermission(item.requiredAny);
    return true;
  });

  return (
    <header className="sticky top-0 z-30">
      <div className="bg-header text-header-foreground">
        <div className="mx-auto flex h-14 max-w-[1680px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <span className="text-xl font-semibold tracking-tight">MyFinance</span>
            <CircleDollarSign className="h-5 w-5 text-positive-fill" aria-hidden="true" />
          </Link>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {workspaces.length > 0 && activeWorkspace && (
              <Select value={activeWorkspace.id} onValueChange={switchWorkspace}>
                <SelectTrigger
                  size="sm"
                  aria-label="Workspace ativo"
                  className="h-9 max-w-[175px] border-white/20 bg-white/5 px-2.5 text-xs font-medium text-white shadow-none hover:bg-white/10 focus-visible:border-white/40 focus-visible:ring-white/20 sm:max-w-[230px] sm:text-sm [&>svg]:text-white/75"
                >
                  <Building2 className="hidden h-3.5 w-3.5 shrink-0 text-white/75 sm:block" aria-hidden="true" />
                  <SelectValue>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{activeWorkspace.name}</span>
                      <span className="shrink-0 rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">
                        {activeWorkspace.roleCode}
                      </span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={6} align="end" className="min-w-[220px]">
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">{ws.name}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                          {ws.roleCode}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="hidden min-w-0 items-center gap-1.5 text-xs text-white/80 md:flex">
              <span className="max-w-[140px] truncate">{user.name}</span>
              {user.isSuperAdmin && (
                <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                  Admin
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={toggle}
              aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
              aria-pressed={hidden}
              title={hidden ? "Mostrar valores" : "Ocultar valores"}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-white/20 text-white/90 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
            >
              {hidden ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>

            <Link
              href="/configuracoes"
              aria-label="Configurações"
              className="relative flex h-9 w-9 items-center justify-center rounded-md border border-white/20 text-white/90 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              {pendingInvitesCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-950">
                  {pendingInvitesCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={logout}
              aria-label="Sair"
              title="Sair"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-white/20 text-white/90 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <nav className="border-b bg-card" aria-label="Navegação principal">
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
          <ul className="-mb-px flex gap-6 overflow-x-auto sm:flex-wrap sm:gap-x-5 sm:gap-y-0 sm:overflow-visible lg:flex-nowrap lg:gap-6 [scrollbar-width:none]">
            {visibleItems.map(({ href, label, icon: Icon, children }) => {
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
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                    {href === "/configuracoes" && pendingInvitesCount > 0 && (
                      <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                        {pendingInvitesCount}
                      </span>
                    )}
                    {children && (
                      <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:rotate-180" aria-hidden="true" />
                    )}
                  </Link>
                  {children && (
                    <Suspense fallback={null}>
                      <HeaderSubmenu
                        childrenItems={children}
                        pathname={pathname}
                        isSuperAdmin={user.isSuperAdmin}
                      />
                    </Suspense>
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
