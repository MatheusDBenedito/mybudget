"use client";

import { Money } from "@/components/Money";

import { Clock, CheckCircle2, ArrowDownCircle, ArrowUpCircle, Repeat, Trash2, Pencil } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Panel } from "@/components/Panel";
import { ICONS_MAP } from "@/components/CreateCategoryModal";
import { TransactionModal } from "@/components/TransactionModal";
import { formatDate } from "@/lib/format";

export type ApiTransaction = {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: "INCOME" | "EXPENSE";
    status: "PAID" | "PENDING" | "CANCELLED";
    isFixed?: boolean;
    installments?: number;
    installmentGroupId?: string | null;
    accountId?: string;
    categoryId?: string | null;
    category?: { id?: string; name: string; color: string | null; icon?: string } | null;
    linkedFinancing?: {
        id: string;
        name: string;
        bankName: string;
        installmentNumber: number | null;
        totalMonths: number;
    } | null;
};

interface MonthTransactionsProps {
    transactions: ApiTransaction[];
    isLoading: boolean;
    onToggleStatus: (transaction: ApiTransaction, status: "PAID" | "PENDING") => void;
    onDelete?: (transaction: ApiTransaction) => void;
    onEditSuccess?: () => void;
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

/** Income and expense tables for one month, with paid/pending toggles, edit and delete actions. */
export function MonthTransactions({ transactions, isLoading, onToggleStatus, onDelete, onEditSuccess }: MonthTransactionsProps) {
    const showActions = !!(onDelete || onEditSuccess);
    const columns = showActions ? 6 : 5;
    const active = transactions.filter(t => t.status !== "CANCELLED");
    const expenses = active.filter(t => t.type === "EXPENSE");
    const incomes = active.filter(t => t.type === "INCOME");

    const renderTable = (rows: ApiTransaction[], kind: "EXPENSE" | "INCOME") => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    {showActions && <TableHead className="w-20"><span className="sr-only">Ações</span></TableHead>}
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((t) => (
                    <TableRow key={t.id}>
                        <TableCell className="text-muted-foreground tabular-nums">{formatDate(t.date)}</TableCell>
                        <TableCell>
                            <span className="inline-flex flex-wrap items-center gap-1.5">
                                {t.description}
                                {t.isFixed && <Repeat className="h-3.5 w-3.5 text-muted-foreground" aria-label="Fixa" />}
                                {t.linkedFinancing && (
                                    <span
                                        title={`Vinculado ao financiamento ${t.linkedFinancing.name} (${t.linkedFinancing.bankName})`}
                                        className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                                    >
                                        {t.linkedFinancing.installmentNumber
                                            ? `${t.linkedFinancing.name} • ${t.linkedFinancing.installmentNumber}/${t.linkedFinancing.totalMonths}`
                                            : t.linkedFinancing.name}
                                    </span>
                                )}
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
                        {showActions && (
                            <TableCell className="w-20 pl-0 text-right">
                                <span className="inline-flex items-center justify-end gap-0.5">
                                    {onEditSuccess && (
                                        <TransactionModal initialData={t} onSuccess={onEditSuccess}>
                                            <button
                                                type="button"
                                                title="Editar"
                                                aria-label={`Editar "${t.description}"`}
                                                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                                            >
                                                <Pencil className="h-4 w-4" aria-hidden="true" />
                                            </button>
                                        </TransactionModal>
                                    )}
                                    {onDelete && (
                                        <button
                                            type="button"
                                            onClick={() => onDelete(t)}
                                            title="Excluir"
                                            aria-label={`Excluir "${t.description}"`}
                                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-negative-soft hover:text-negative focus-visible:outline-2 focus-visible:outline-ring"
                                        >
                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                    )}
                                </span>
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
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel title="Recebimentos do mês" icon={ArrowUpCircle} count={incomes.length} flush>
                {renderTable(incomes, "INCOME")}
            </Panel>
            <Panel title="Despesas do mês" icon={ArrowDownCircle} count={expenses.length} flush>
                {renderTable(expenses, "EXPENSE")}
            </Panel>
        </div>
    );
}
