"use client";

import { Money } from "@/components/Money";

import { useId, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { ApiTransaction } from "@/components/cash-flow/MonthTransactions";
import { type AccountLike, defaultSettlementAccount, isYielding, sortForPayment, yieldLabel } from "@/lib/accounts";

export type SettleAccount = AccountLike;

interface SettleTransactionDialogProps {
    /** Transaction being marked as received/paid; null closes the dialog */
    transaction: ApiTransaction | null;
    accounts: SettleAccount[];
    onCancel: () => void;
    onConfirm: (accountId: string) => void;
}

/** Asks which account receives (income) or pays (expense) a transaction, previewing the new balance. */
export function SettleTransactionDialog({ transaction, accounts, onCancel, onConfirm }: SettleTransactionDialogProps) {
    const groupId = useId();
    // Only the user's explicit pick is stored, tied to the transaction it was made for;
    // otherwise default to the account the transaction was created with
    const [choice, setChoice] = useState<{ transactionId: string; accountId: string } | null>(null);
    // Payments default to (and list first) accounts that don't yield, so money in yielding accounts keeps earning
    const kind = transaction?.type === "INCOME" ? "INCOME" : "EXPENSE";
    const options = kind === "EXPENSE" ? sortForPayment(accounts) : accounts;
    const defaultAccountId = defaultSettlementAccount(accounts, kind, transaction?.accountId)?.id ?? "";
    const accountId = choice && choice.transactionId === transaction?.id ? choice.accountId : defaultAccountId;
    const setAccountId = (id: string) => transaction && setChoice({ transactionId: transaction.id, accountId: id });

    const isIncome = transaction?.type === "INCOME";
    const delta = transaction ? (isIncome ? transaction.amount : -transaction.amount) : 0;

    return (
        <Dialog open={!!transaction} onOpenChange={(open) => { if (!open) onCancel(); }}>
            <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                    <DialogTitle>{isIncome ? "Confirmar recebimento" : "Confirmar pagamento"}</DialogTitle>
                    <DialogDescription>
                        {transaction && (
                            <>
                                {transaction.description} · {formatDate(transaction.date)} ·{" "}
                                <span className={cn("font-medium", isIncome ? "text-positive" : "text-negative")}>
                                    {isIncome ? "+" : "-"}<Money value={transaction.amount} />
                                </span>
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <fieldset className="space-y-2">
                    <legend className="mb-2 text-sm font-medium">
                        {isIncome ? "Em qual conta o valor entrou?" : "De qual conta o valor saiu?"}
                    </legend>
                    {options.map(account => {
                        const selected = account.id === accountId;
                        const after = account.balance + delta;
                        return (
                            <label
                                key={account.id}
                                className={cn(
                                    "flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                                    selected ? "border-foreground bg-muted/50" : "hover:bg-muted/40",
                                )}
                            >
                                <span className="flex items-center gap-3">
                                    <input
                                        type="radio"
                                        name={groupId}
                                        value={account.id}
                                        checked={selected}
                                        onChange={() => setAccountId(account.id)}
                                        className="h-4 w-4 accent-foreground"
                                    />
                                    <span>
                                        <span className="block text-sm font-medium">{account.name}</span>
                                        <span className={cn("block text-[11px]", isYielding(account) ? "text-positive" : "text-muted-foreground")}>
                                            {isYielding(account) ? yieldLabel(account) : "Conta corrente"}
                                        </span>
                                    </span>
                                </span>
                                <span className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                                    <Money value={account.balance} />
                                    <ArrowRight className="h-3 w-3" aria-label="passa para" />
                                    <span className={cn("font-medium", after < 0 ? "text-negative" : "text-foreground")}><Money value={after} /></span>
                                </span>
                            </label>
                        );
                    })}
                </fieldset>

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
                    <Button type="button" disabled={!accountId} onClick={() => onConfirm(accountId)}>
                        {isIncome ? "Confirmar recebimento" : "Confirmar pagamento"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
