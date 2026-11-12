"use client";

import { Money } from "@/components/Money";

import { useId, useState } from "react";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { ApiTransaction } from "@/components/cash-flow/MonthTransactions";

export type DeleteScope = "single" | "series";

interface DeleteTransactionDialogProps {
    transaction: ApiTransaction | null;
    onCancel: () => void;
    onConfirm: (scope: DeleteScope) => void;
}

/** Confirms removing a lançamento; fixed ones choose between this month only or this and the next months. */
export function DeleteTransactionDialog({ transaction, onCancel, onConfirm }: DeleteTransactionDialogProps) {
    const groupId = useId();
    const [scope, setScope] = useState<DeleteScope>("single");
    const isIncome = transaction?.type === "INCOME";
    const paid = transaction?.status === "PAID";
    const isFixed = !!transaction?.isFixed;
    const isInstallment = !isFixed && !!transaction?.installmentGroupId;
    const hasSeriesScope = isFixed || isInstallment;

    const options: { value: DeleteScope; label: string; hint: string }[] = isInstallment
        ? [
            { value: "single", label: "Só esta parcela", hint: "As demais parcelas continuam programadas." },
            { value: "series", label: "Esta e as próximas parcelas", hint: "Remove esta parcela e todas as parcelas futuras." },
        ]
        : [
            { value: "single", label: "Só este mês", hint: "Os outros meses continuam com este lançamento." },
            { value: "series", label: "Este e os próximos meses", hint: "Deixa de ser projetado daqui para frente." },
        ];

    return (
        <AlertDialog open={!!transaction} onOpenChange={(open) => { if (!open) { onCancel(); setScope("single"); } }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Excluir lançamento</AlertDialogTitle>
                    <AlertDialogDescription>
                        {transaction && (
                            <>
                                {transaction.description} · {formatDate(transaction.date)} ·{" "}
                                <span className={cn("font-medium", isIncome ? "text-positive" : "text-negative")}>
                                    {isIncome ? "+" : "-"}<Money value={transaction.amount} />
                                </span>
                                {paid && (
                                    <span className="mt-2 block">
                                        Como já foi {isIncome ? "recebido" : "pago"}, o valor {isIncome ? "sai da" : "volta para a"} conta.
                                    </span>
                                )}
                            </>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {hasSeriesScope && (
                    <fieldset className="space-y-2">
                        <legend className="mb-2 text-sm font-medium">
                            {isInstallment ? "Este lançamento é parcelado. Excluir:" : "Este lançamento é fixo. Excluir:"}
                        </legend>
                        {options.map(option => (
                            <label
                                key={option.value}
                                className={cn(
                                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                                    scope === option.value ? "border-foreground bg-muted/50" : "hover:bg-muted/40",
                                )}
                            >
                                <input
                                    type="radio"
                                    name={groupId}
                                    value={option.value}
                                    checked={scope === option.value}
                                    onChange={() => setScope(option.value)}
                                    className="mt-0.5 h-4 w-4 accent-foreground"
                                />
                                <span>
                                    <span className="block text-sm font-medium">{option.label}</span>
                                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                                </span>
                            </label>
                        ))}
                    </fieldset>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-red-600 text-white hover:bg-red-700"
                        onClick={() => { onConfirm(hasSeriesScope ? scope : "single"); setScope("single"); }}
                    >
                        Excluir
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
