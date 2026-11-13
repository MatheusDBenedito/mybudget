"use client";

import { Money } from "@/components/Money";

import { useState, type ReactNode } from "react";
import { ArrowDownUp, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { cn } from "@/lib/utils";
import { type AccountLike, checkTransfer, transferableBalance } from "@/lib/accounts";
import { API_BASE_URL } from "@/lib/auth";

const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const selectClass =
    "border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

interface TransferDialogProps {
    accounts: AccountLike[];
    onSuccess: () => void | Promise<void>;
    children: ReactNode;
}

/** Moves money between two of the user's accounts (e.g. Mercado Pago → C6). Not an income nor an expense. */
export function TransferDialog({ accounts, onSuccess, children }: TransferDialogProps) {
    const [open, setOpen] = useState(false);
    const [fromId, setFromId] = useState("");
    const [toId, setToId] = useState("");
    const [amount, setAmount] = useState<number | undefined>(undefined);
    const [date, setDate] = useState(todayKey());
    const [description, setDescription] = useState("");
    const [saving, setSaving] = useState(false);

    const reset = () => {
        // Typical move: from a yielding account (where the money earns) to a checking account (where bills are paid)
        const from = accounts.find(a => a.type === "YIELDING") ?? accounts[0];
        const to = accounts.find(a => a.id !== from?.id && a.type !== from?.type) ?? accounts.find(a => a.id !== from?.id);
        setFromId(from?.id ?? "");
        setToId(to?.id ?? "");
        setAmount(undefined);
        setDate(todayKey());
        setDescription("");
    };

    const from = accounts.find(a => a.id === fromId);
    const to = accounts.find(a => a.id === toId);
    const check = checkTransfer(accounts, { fromId, toId, amount });
    const value = amount ?? 0;

    const swap = () => {
        setFromId(toId);
        setToId(fromId);
    };

    const submit = async () => {
        if (check.error) return toast.error(check.error);
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE_URL}/accounts/transfers`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fromAccountId: fromId, toAccountId: toId, amount, date, description: description || undefined }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(Array.isArray(err.message) ? err.message.join(", ") : err.message ?? "Erro ao transferir.");
            }
            toast.success(
                <span>
                    <Money value={value} /> transferido de {from?.name.trim()} para {to?.name.trim()}.
                </span>,
            );
            setOpen(false);
            await onSuccess();
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const preview = (account: AccountLike | undefined, delta: number) =>
        account && (
            <span className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                <Money value={account.balance} />
                <ArrowRight className="h-3 w-3" aria-label="passa para" />
                <span className={cn("font-medium", account.balance + delta < 0 ? "text-negative" : "text-foreground")}>
                    <Money value={account.balance + delta} />
                </span>
            </span>
        );

    return (
        <Dialog open={open} onOpenChange={next => { if (next) reset(); setOpen(next); }}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                    <DialogTitle>Transferir entre contas</DialogTitle>
                    <DialogDescription>Move dinheiro entre suas contas. Não conta como receita nem despesa.</DialogDescription>
                </DialogHeader>

                {accounts.length < 2 ? (
                    <p className="py-4 text-sm text-muted-foreground">Cadastre pelo menos duas contas para transferir.</p>
                ) : (
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="transfer-from">De</Label>
                                {preview(from, -value)}
                            </div>
                            <select id="transfer-from" className={selectClass} value={fromId} onChange={e => setFromId(e.target.value)}>
                                {accounts.map(a => <option key={a.id} value={a.id}>{a.name.trim()}</option>)}
                            </select>
                            {from && from.freeBalance !== undefined && from.freeBalance < from.balance - 0.005 && (
                                <p className="text-xs text-muted-foreground">
                                    Disponível fora dos cofrinhos: <Money value={transferableBalance(from)} />
                                </p>
                            )}
                        </div>

                        <div className="flex justify-center">
                            <Button type="button" variant="outline" size="sm" onClick={swap} aria-label="Inverter origem e destino">
                                <ArrowDownUp className="h-4 w-4" /> Inverter
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="transfer-to">Para</Label>
                                {preview(to, value)}
                            </div>
                            <select id="transfer-to" className={selectClass} value={toId} onChange={e => setToId(e.target.value)}>
                                {accounts.map(a => <option key={a.id} value={a.id}>{a.name.trim()}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="transfer-amount">Valor</Label>
                                <CurrencyInput id="transfer-amount" placeholder="R$ 0,00" value={amount ?? ""} onChange={setAmount} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="transfer-date">Data</Label>
                                <Input id="transfer-date" type="date" max={todayKey()} value={date} onChange={e => setDate(e.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="transfer-description">Descrição (opcional)</Label>
                            <Input id="transfer-description" placeholder="Ex: Pagar contas do mês" maxLength={120} value={description} onChange={e => setDescription(e.target.value)} />
                        </div>

                        {amount !== undefined && (check.error || check.warning) && (
                            <p className={cn("text-xs", check.error ? "text-negative" : "text-amber-600")}>{check.error ?? check.warning}</p>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button type="button" onClick={submit} disabled={saving || accounts.length < 2 || !!check.error}>
                        {saving ? "Transferindo..." : "Transferir"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
