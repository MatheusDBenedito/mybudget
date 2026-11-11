import { Money } from "@/components/Money";
import Link from "next/link";
import { Landmark, PiggyBank, ChartPie, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { BigMoney, DashCard } from "./DashCard";

export type DashAccount = {
    id: string;
    name: string;
    balance: number;
    type?: "CHECKING" | "YIELDING";
    freeBalance?: number;
    pots?: { id: string; name: string; balance: number }[];
};

const PARTS = [
    { key: "checking", label: "Conta corrente", color: "bg-blue-900", icon: Landmark },
    { key: "free", label: "Rendendo na conta", color: "bg-blue-500", icon: Wallet },
    { key: "pots", label: "Cofrinhos", color: "bg-sky-300", icon: PiggyBank },
    { key: "investments", label: "Investimentos", color: "bg-positive-fill", icon: ChartPie },
] as const;

/** Total wealth and how it is split between checking accounts, yielding balances, pots and investments. */
export function MoneyWhereCard({ accounts, investments, className }: { accounts: DashAccount[]; investments: number; className?: string }) {
    const sums = {
        checking: accounts.filter(a => a.type !== "YIELDING").reduce((acc, a) => acc + a.balance, 0),
        free: accounts.filter(a => a.type === "YIELDING").reduce((acc, a) => acc + (a.freeBalance ?? a.balance), 0),
        pots: accounts.reduce((acc, a) => acc + (a.pots ?? []).reduce((s, p) => s + p.balance, 0), 0),
        investments,
    };
    const total = sums.checking + sums.free + sums.pots + sums.investments;
    const pct = (v: number) => (total > 0 ? Math.max((v / total) * 100, 0) : 0);

    return (
        <DashCard title="Onde está o dinheiro" subtitle="Contas, cofrinhos e investimentos" art={{ icon: PiggyBank, tone: "violet" }} className={className}>
            <BigMoney value={total} />

            <div className="mt-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label="Divisão do patrimônio">
                {PARTS.filter(p => sums[p.key] > 0).map(p => (
                    <span key={p.key} className={cn("h-full", p.color)} style={{ width: `${pct(sums[p.key])}%` }} />
                ))}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {PARTS.map(p => (
                    <div key={p.key} className="flex items-center justify-between gap-2">
                        <dt className="flex items-center gap-1.5 text-muted-foreground">
                            <span className={cn("h-2 w-2 rounded-full", p.color)} aria-hidden />{p.label}
                        </dt>
                        <dd className="tabular-nums text-muted-foreground">{Math.round(pct(sums[p.key]))}%</dd>
                    </div>
                ))}
            </dl>

            <p className="mb-1 mt-4 text-xs font-semibold">Por conta</p>
            <ul className="divide-y text-sm">
                {accounts.map(a => (
                    <li key={a.id} className="py-2">
                        <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 truncate">
                                <span className={cn("h-2 w-2 shrink-0 rounded-full", a.type === "YIELDING" ? "bg-blue-500" : "bg-blue-900")} aria-hidden />
                                {a.name.trim()}
                            </span>
                            <span className={cn("font-semibold tabular-nums", a.balance < 0 && "text-negative")}><Money value={a.balance} /></span>
                        </div>
                        {(a.pots ?? []).map(p => (
                            <div key={p.id} className="mt-1 flex items-center justify-between gap-2 pl-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5 truncate"><PiggyBank className="h-3 w-3" aria-hidden />{p.name}</span>
                                <span className="tabular-nums"><Money value={p.balance} /></span>
                            </div>
                        ))}
                    </li>
                ))}
                <li className="flex items-center justify-between gap-2 py-2">
                    <Link href="/investimentos" className="flex items-center gap-2 hover:underline">
                        <span className="h-2 w-2 rounded-full bg-positive-fill" aria-hidden />Investimentos
                    </Link>
                    <span className="font-semibold tabular-nums"><Money value={investments} /></span>
                </li>
            </ul>
        </DashCard>
    );
}
