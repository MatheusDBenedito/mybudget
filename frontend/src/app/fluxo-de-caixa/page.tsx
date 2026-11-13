"use client";

import { Money } from "@/components/Money";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, TrendingUp, TrendingDown, Landmark, Table2, ArrowLeftRight } from "lucide-react";
import { TransferDialog } from "@/components/TransferDialog";
import { Button } from "@/components/ui/button";
import { PageHeader, MonthNavigator } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Panel } from "@/components/Panel";
import { TransactionModal } from "@/components/TransactionModal";
import { CashFlowSheet } from "@/components/cash-flow/CashFlowSheet";
import { MonthTransactions, type ApiTransaction } from "@/components/cash-flow/MonthTransactions";
import type { CashFlowData } from "@/lib/cash-flow";
import { SettleTransactionDialog } from "@/components/cash-flow/SettleTransactionDialog";
import { DeleteTransactionDialog, type DeleteScope } from "@/components/cash-flow/DeleteTransactionDialog";
import type { AccountLike } from "@/lib/accounts";
import { type ApiInvestment, grossValueOf } from "@/lib/investments";
import { API_BASE_URL } from "@/lib/auth";

type ApiAccount = AccountLike;

export default function FluxoDeCaixaPage() {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());

    const [cashFlow, setCashFlow] = useState<CashFlowData | null>(null);
    const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
    const [accounts, setAccounts] = useState<ApiAccount[]>([]);
    const [investments, setInvestments] = useState<ApiInvestment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Each load gets a sequence number so a slow, older response never overwrites newer data
    const loadSeq = useRef(0);

    /** silent: refresh in the background without the loading placeholders (used after a status toggle) */
    const load = useCallback(async ({ silent = false } = {}) => {
        const seq = ++loadSeq.current;
        if (!silent) setIsLoading(true);
        try {
            const [flowRes, txRes, accRes, invRes] = await Promise.all([
                fetch(`${API_BASE_URL}/cash-flow?month=${month}&year=${year}&months=12`),
                fetch(`${API_BASE_URL}/transactions?month=${month}&year=${year}`),
                fetch(`${API_BASE_URL}/accounts`),
                fetch(`${API_BASE_URL}/investments`),
            ]);
            const [flow, txs, accs, invs] = await Promise.all([
                flowRes.ok ? flowRes.json() : null,
                txRes.ok ? txRes.json() : null,
                accRes.ok ? accRes.json() : null,
                invRes.ok ? invRes.json() : null,
            ]);
            if (seq !== loadSeq.current) return;
            if (flow) setCashFlow(flow);
            if (txs) setTransactions(txs);
            if (accs) setAccounts(accs);
            if (invs) setInvestments(invs);
        } catch (error) {
            console.error("Failed to load cash flow", error);
            if (seq === loadSeq.current) toast.error("Não foi possível carregar o fluxo de caixa.");
        } finally {
            if (seq === loadSeq.current) setIsLoading(false);
        }
    }, [month, year]);

    useEffect(() => { load(); }, [load]);

    const goToPrevMonth = () => {
        if (month === 1) { setMonth(12); setYear(y => y - 1); }
        else setMonth(m => m - 1);
    };
    const goToNextMonth = () => {
        if (month === 12) { setMonth(1); setYear(y => y + 1); }
        else setMonth(m => m + 1);
    };

    // Transaction waiting for the user to pick the account that receives/pays it
    const [settling, setSettling] = useState<ApiTransaction | null>(null);

    const applyStatus = async (transaction: ApiTransaction, status: "PAID" | "PENDING", accountId?: string, amount?: number) => {
        const previousTransactions = transactions;
        const previousAccounts = accounts;
        const effectiveAmount = amount ?? transaction.amount;

        // Optimistic: the item leaves (or returns to) "A receber"/"A pagar" and the account balance moves immediately
        const delta = transaction.type === "INCOME" ? effectiveAmount : -effectiveAmount;
        const affectedAccount = status === "PAID" ? accountId ?? transaction.accountId : transaction.accountId;
        setTransactions(list => list.map(t => (t.id === transaction.id
            ? { ...t, status, amount: effectiveAmount, accountId: status === "PAID" ? affectedAccount : t.accountId }
            : t)));
        setAccounts(list => list.map(a => {
            if (a.id !== affectedAccount) return a;
            const d = status === "PAID" ? delta : -delta;
            return {
                ...a,
                balance: a.balance + d,
                grossBalance: (a.grossBalance ?? a.balance) + d,
            };
        }));

        try {
            const body: Record<string, unknown> = { status };
            if (status === "PAID" && accountId) body.accountId = accountId;
            if (status === "PAID" && amount !== undefined) body.amount = amount;

            const res = await fetch(`${API_BASE_URL}/transactions/${transaction.id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const account = accounts.find(a => a.id === affectedAccount)?.name.trim();
            toast.success(status === "PAID"
                ? `"${transaction.description}" ${transaction.type === "INCOME" ? "recebido em" : "pago com"} ${account ?? "sua conta"}.`
                : `"${transaction.description}" voltou para ${transaction.type === "INCOME" ? "a receber" : "a pagar"}.`);
            // Balances, the sheet and projected fixed items (which get a real id) come from the server
            await load({ silent: true });
        } catch (error) {
            console.error("Failed to update status", error);
            setTransactions(previousTransactions);
            setAccounts(previousAccounts);
            toast.error("Não foi possível alterar o status.");
        }
    };

    // Transaction waiting for delete confirmation
    const [deleting, setDeleting] = useState<ApiTransaction | null>(null);

    const removeTransaction = async (transaction: ApiTransaction, scope: DeleteScope) => {
        const previous = transactions;
        // Optimistic: leaves the month lists right away; the sheet, totals and balances come from the server
        setTransactions(list => list.filter(t => t.id !== transaction.id));
        try {
            const res = await fetch(`${API_BASE_URL}/transactions/${transaction.id}?scope=${scope}`, { method: "DELETE" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            toast.success(scope === "series"
                ? `"${transaction.description}" excluído deste mês em diante.`
                : `"${transaction.description}" excluído.`);
            await load({ silent: true });
        } catch (error) {
            console.error("Failed to delete transaction", error);
            setTransactions(previous);
            toast.error("Não foi possível excluir o lançamento.");
        }
    };

    const toggleStatus = (transaction: ApiTransaction, status: "PAID" | "PENDING") => {
        // With more than one account the user chooses where the money goes in/out
        if (status === "PAID" && accounts.length > 1) {
            setSettling(transaction);
            return;
        }
        applyStatus(transaction, status, status === "PAID" ? accounts[0]?.id : undefined);
    };

    // The sheet starts at the selected month, so column 0 is the month being viewed
    const section = (key: string) => cashFlow?.sections.find(s => s.key === key)?.totals[0] ?? 0;
    const income = cashFlow?.summary.income[0] ?? 0;
    const expenses = cashFlow?.summary.expenses[0] ?? 0;
    const openIncome = cashFlow?.summary.openIncome[0] ?? 0;
    const openExpenses = cashFlow?.summary.openExpenses[0] ?? 0;
    const accountGross = (a: ApiAccount) => a.grossBalance ?? a.balance;
    const investmentsTotal = investments.reduce((acc, inv) => acc + grossValueOf(inv), 0);
    const accountsTotal = accounts.reduce((acc, a) => acc + accountGross(a), 0) + investmentsTotal;
    const today = { year: now.getFullYear(), month: now.getMonth() + 1 };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Fluxo de Caixa"
                description="Recebimentos, contas fixas e faturas dos cartões mês a mês."
                actions={
                    <>
                        <MonthNavigator month={month} year={year} onPrev={goToPrevMonth} onNext={goToNextMonth} />
                        <TransferDialog accounts={accounts} onSuccess={() => load({ silent: true })}>
                            <Button variant="outline" disabled={accounts.length < 2}>
                                <ArrowLeftRight className="h-4 w-4" />
                                Transferir
                            </Button>
                        </TransferDialog>
                        <TransactionModal onSuccess={() => load({ silent: true })}>
                            <Button>
                                <Plus className="h-4 w-4" />
                                Adicionar Lançamento
                            </Button>
                        </TransactionModal>
                    </>
                }
            />

            {/* Recebimentos, Despesas and Contas; Contas is pinned to the right (below on small screens) */}
            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard title="Contas e Investimentos" icon={Landmark} info="Saldo bruto atual de cada conta bancária (incluindo cofrinhos) somado aos investimentos." className="sm:order-3">
                    <ul className="space-y-1 text-sm">
                        {accounts.map(acc => {
                            const gross = accountGross(acc);
                            return (
                                <li key={acc.id} className="flex justify-between gap-2">
                                    <span className="truncate text-muted-foreground">{acc.name}</span>
                                    <span className={`tabular-nums ${gross < 0 ? "text-negative" : ""}`}><Money value={gross} /></span>
                                </li>
                            );
                        })}
                        <li className="flex justify-between gap-2">
                            <span className="truncate text-muted-foreground">Investimentos</span>
                            <span className="tabular-nums"><Money value={investmentsTotal} /></span>
                        </li>
                    </ul>
                    <div className="mt-2 flex justify-between gap-2 border-t pt-2 text-sm">
                        <span className="text-muted-foreground">Total bruto</span>
                        <span className="font-medium tabular-nums"><Money value={accountsTotal} /></span>
                    </div>
                </StatCard>

                <StatCard title="Recebimentos" icon={TrendingUp} className="sm:order-1">
                    <div className="text-xl font-medium tabular-nums text-positive"><Money value={income} /></div>
                    <dl className="mt-3 space-y-0.5 text-sm">
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Recebido</dt><dd className="tabular-nums"><Money value={income - openIncome} /></dd></div>
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">A receber</dt><dd className="tabular-nums"><Money value={openIncome} /></dd></div>
                    </dl>
                </StatCard>

                <StatCard title="Despesas" icon={TrendingDown} info="Contas fixas + faturas dos cartões + demais despesas do mês." className="sm:order-2">
                    <div className="text-xl font-medium tabular-nums text-negative"><Money value={expenses} /></div>
                    <dl className="mt-3 space-y-0.5 text-sm">
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Contas fixas</dt><dd className="tabular-nums"><Money value={section("FIXED")} /></dd></div>
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Cartões</dt><dd className="tabular-nums"><Money value={section("CARDS")} /></dd></div>
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Outras</dt><dd className="tabular-nums"><Money value={section("VARIABLE")} /></dd></div>
                        <div className="flex justify-between gap-2 border-t pt-1"><dt className="text-muted-foreground">A pagar</dt><dd className="font-medium tabular-nums"><Money value={openExpenses} /></dd></div>
                    </dl>
                </StatCard>

            </div>

            <MonthTransactions transactions={transactions} isLoading={isLoading} onToggleStatus={toggleStatus} onDelete={setDeleting} onEditSuccess={() => load({ silent: true })} />

            <Panel title="Visão geral — próximos 12 meses" icon={Table2} flush>
                {cashFlow ? (
                    <>
                        <CashFlowSheet data={cashFlow} highlight={today} />
                        <p className="border-t bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
                            A planilha mostra o que ainda está em aberto; o que já foi recebido ou pago aparece marcado e o valor passa para a conta escolhida.
                            Contas e recebimentos fixos são projetados nos meses seguintes e as faturas dos cartões entram no mês de vencimento, atualizando
                            conforme você lança compras (após o vencimento, a fatura conta como paga). O saldo parte do saldo atual das contas e soma só o que está em aberto.
                            * parcialmente quitado.
                        </p>
                    </>
                ) : (
                    <div className="h-64 animate-pulse bg-muted/50" />
                )}
            </Panel>

            <DeleteTransactionDialog
                transaction={deleting}
                onCancel={() => setDeleting(null)}
                onConfirm={(scope) => {
                    const transaction = deleting;
                    setDeleting(null);
                    if (transaction) removeTransaction(transaction, scope);
                }}
            />

            <SettleTransactionDialog
                transaction={settling}
                accounts={accounts}
                onCancel={() => setSettling(null)}
                onConfirm={(accountId, amount) => {
                    const transaction = settling;
                    setSettling(null);
                    if (transaction) applyStatus(transaction, "PAID", accountId, amount);
                }}
            />
        </div>
    );
}
