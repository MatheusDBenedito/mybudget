"use client";

import { Money } from "@/components/Money";

import { Clock, CheckCircle2, Check, ArrowDownCircle, ArrowUpCircle, Repeat, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Panel } from "@/components/Panel";
import { ICONS_MAP } from "@/components/CreateCategoryModal";
import { formatDate } from "@/lib/format";

export type ApiTransaction = {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: "INCOME" | "EXPENSE";
    status: "PAID" | "PENDING" | "CANCELLED";
    isFixed?: boolean;
    accountId?: string;
    category?: { name: string; color: string | null; icon?: string } | null;
};

interface MonthTransactionsProps {
    transactions: ApiTransaction[];
    isLoading: boolean;
    onToggleStatus: (transaction: ApiTransaction, status: "PAID" | "PENDING") => void;
    onDelete?: (transaction: ApiTransaction) => void;
}

function CategoryChip({ category }: { category?: ApiTransaction["category"] }) {
    if (!category) return <span className="text-sm text-muted-foreground">Sem categoria</span>;
    const IconComponent = category.icon && ICONS_MAP[category.icon] ? ICONS_MAP[category.icon] : null;
    return (
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-white ${category.color || "bg-slate-400"}`}>
                {IconComponent ? <IconComponent className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            </span>
            {category.name}
        </span>
    );
}

function StatusToggle({ transaction, paidLabel, onToggle }: { transaction: ApiTransaction; paidLabel: string; onToggle: () => void }) {
    const paid = transaction.status === "PAID";
    return (
        <button
            type="button"
            onClick={onToggle}
            title={paid ? "Clique para marcar como pendente" : `Clique para marcar como ${paidLabel.toLowerCase()}`}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${paid
                ? "bg-positive-soft text-positive hover:brightness-95"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                }`}
        >
            {paid ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Clock className="h-3.5 w-3.5" aria-hidden="true" />}
            {paid ? paidLabel : "Pendente"}
        </button>
    );
}

/** Pending items plus income/expense tables for one month, with paid/pending toggles. */
export function MonthTransactions({ transactions, isLoading, onToggleStatus, onDelete }: MonthTransactionsProps) {
    const columns = onDelete ? 6 : 5;
    const active = transactions.filter(t => t.status !== "CANCELLED");
    const expenses = active.filter(t => t.type === "EXPENSE");
    const incomes = active.filter(t => t.type === "INCOME");
    const pendingExpenses = expenses.filter(t => t.status === "PENDING");
    const pendingIncomes = incomes.filter(t => t.status === "PENDING");
    const sum = (rows: ApiTransaction[]) => rows.reduce((acc, t) => acc + t.amount, 0);

    const renderPendingList = (rows: ApiTransaction[], kind: "EXPENSE" | "INCOME") => rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {isLoading ? "Carregando..." : kind === "EXPENSE" ? "Nada a pagar neste mês." : "Nada a receber neste mês."}
        </p>
    ) : (
        <ul className="divide-y">
            {rows.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => onToggleStatus(t, "PAID")}
                            aria-label={`Marcar "${t.description}" como ${kind === "EXPENSE" ? "pago" : "recebido"}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-input text-muted-foreground transition-colors hover:border-positive hover:bg-positive-soft hover:text-positive focus-visible:outline-2 focus-visible:outline-ring"
                        >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <div>
                            <p className="text-sm font-medium">{t.description}</p>
                            <p className="text-xs text-muted-foreground tabular-nums">{formatDate(t.date)}</p>
                        </div>
                    </div>
                    <span className={`text-sm font-medium tabular-nums ${kind === "EXPENSE" ? "text-negative" : "text-positive"}`}>
                        {kind === "EXPENSE" ? "-" : "+"}<Money value={t.amount} />
                    </span>
                </li>
            ))}
        </ul>
    );

    const renderTable = (rows: ApiTransaction[], kind: "EXPENSE" | "INCOME") => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    {onDelete && <TableHead className="w-10"><span className="sr-only">Ações</span></TableHead>}
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((t) => (
                    <TableRow key={t.id}>
                        <TableCell className="text-muted-foreground tabular-nums">{formatDate(t.date)}</TableCell>
                        <TableCell>
                            <span className="inline-flex items-center gap-1.5">
                                {t.description}
                                {t.isFixed && <Repeat className="h-3.5 w-3.5 text-muted-foreground" aria-label="Fixa" />}
                            </span>
                        </TableCell>
                        <TableCell><CategoryChip category={t.category} /></TableCell>
                        <TableCell>
                            <StatusToggle
                                transaction={t}
                                paidLabel={kind === "EXPENSE" ? "Pago" : "Recebido"}
                                onToggle={() => onToggleStatus(t, t.status === "PAID" ? "PENDING" : "PAID")}
                            />
                        </TableCell>
                        <TableCell className={`text-right font-medium tabular-nums ${kind === "EXPENSE" ? "text-negative" : "text-positive"}`}>
                            {kind === "EXPENSE" ? "-" : "+"}<Money value={t.amount} />
                        </TableCell>
                        {onDelete && (
                            <TableCell className="w-10 pl-0 text-right">
                                <button
                                    type="button"
                                    onClick={() => onDelete(t)}
                                    title="Excluir"
                                    aria-label={`Excluir "${t.description}"`}
                                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-negative-soft hover:text-negative focus-visible:outline-2 focus-visible:outline-ring"
                                >
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                            </TableCell>
                        )}
                    </TableRow>
                ))}
                {rows.length === 0 && !isLoading && (
                    <TableRow><TableCell colSpan={columns} className="h-20 text-center text-muted-foreground">
                        {kind === "EXPENSE" ? "Nenhuma despesa neste mês." : "Nenhum recebimento neste mês."}
                    </TableCell></TableRow>
                )}
                {isLoading && (
                    <TableRow><TableCell colSpan={columns} className="h-20 text-center text-muted-foreground animate-pulse">Carregando...</TableCell></TableRow>
                )}
            </TableBody>
        </Table>
    );

    return (
        <div className="space-y-4">
            {/* Always rendered so "A receber" stays on the left and "A pagar" on the right */}
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                <Panel
                    title="A receber"
                    icon={Clock}
                    count={pendingIncomes.length}
                    flush
                    actions={<span className="rounded-md bg-positive-soft px-2 py-0.5 text-sm font-medium text-positive tabular-nums"><Money value={sum(pendingIncomes)} /></span>}
                >
                    {renderPendingList(pendingIncomes, "INCOME")}
                </Panel>
                <Panel
                    title="A pagar"
                    icon={Clock}
                    count={pendingExpenses.length}
                    flush
                    actions={<span className="rounded-md bg-negative-soft px-2 py-0.5 text-sm font-medium text-negative tabular-nums"><Money value={sum(pendingExpenses)} /></span>}
                >
                    {renderPendingList(pendingExpenses, "EXPENSE")}
                </Panel>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Panel title="Recebimentos do mês" icon={ArrowUpCircle} count={incomes.length} flush>
                    {renderTable(incomes, "INCOME")}
                </Panel>
                <Panel title="Despesas do mês" icon={ArrowDownCircle} count={expenses.length} flush>
                    {renderTable(expenses, "EXPENSE")}
                </Panel>
            </div>
        </div>
    );
}
