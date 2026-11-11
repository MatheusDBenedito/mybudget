"use client";

import { Money } from "@/components/Money";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";

interface EstornoModalProps {
    transactionId: string;
    description: string;
    amount: number;
    onSuccess?: () => void;
    children: React.ReactNode;
}

const today = () => new Date().toISOString().split("T")[0];

export function EstornoModal({ transactionId, description, amount, onSuccess, children }: EstornoModalProps) {
    const [open, setOpen] = useState(false);
    const [reverseAmount, setReverseAmount] = useState<number>(amount);
    const [date, setDate] = useState(today());
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!reverseAmount || reverseAmount <= 0) {
            toast.error("Valor do estorno deve ser maior que zero.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`http://localhost:3333/card-transactions/${transactionId}/estorno`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: reverseAmount, date }),
            });

            if (!res.ok) {
                const err = await res.json();
                toast.error(`Erro ao criar estorno: ${err.message}`);
                return;
            }

            toast.success("Estorno criado com sucesso! O crédito aparecerá na fatura do mês correspondente.");
            setOpen(false);
            if (onSuccess) onSuccess();
        } catch {
            toast.error("Erro de conexão com o servidor.");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenChange = (o: boolean) => {
        setOpen(o);
        if (o) {
            setReverseAmount(amount);
            setDate(today());
        }
    };

    const isPartial = reverseAmount < amount;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4 text-amber-500" />
                        Estorno de Transação
                    </DialogTitle>
                    <DialogDescription>
                        Um crédito será criado na fatura do mês correspondente à data informada.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-1">
                    {/* Original transaction info */}
                    <div className="rounded-lg bg-gray-50 border px-4 py-3 space-y-0.5">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Transação original</p>
                        <p className="font-medium text-gray-900 text-sm truncate">{description}</p>
                        <p className="text-emerald-700 font-semibold"><Money value={amount} /></p>
                    </div>

                    {/* Reverse amount */}
                    <div className="space-y-1.5">
                        <Label>Valor do estorno</Label>
                        <CurrencyInput
                            value={reverseAmount}
                            onChange={(v) => setReverseAmount(v ?? 0)}
                        />
                        {isPartial && (
                            <p className="text-xs text-amber-600">
                                ⚠ Estorno parcial — <Money value={amount - reverseAmount} /> permanece na fatura.
                            </p>
                        )}
                    </div>

                    {/* Reversal date */}
                    <div className="space-y-1.5">
                        <Label htmlFor="estorno-date">Data do estorno</Label>
                        <input
                            id="estorno-date"
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                        />
                        <p className="text-xs text-gray-400">
                            A data define em qual fatura o crédito será lançado.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || reverseAmount <= 0}
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                    >
                        {loading ? "Criando..." : <>Estornar <Money value={reverseAmount} /></>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
