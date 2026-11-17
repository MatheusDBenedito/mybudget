"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { API_BASE_URL } from "@/lib/auth";
import { DEFAULT_MILES_PROGRAM_RATES, parseCurrencyRateInput } from "@/lib/miles";

interface MilesValuationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rates: Record<string, number>;
    onSaved: (updatedRates: Record<string, number>) => void;
}

const formatRateForInput = (value: number) =>
    Number.isFinite(value) ? value.toFixed(2).replace(".", ",") : "";

function buildInitialTexts(rates: Record<string, number>): Record<string, string> {
    const merged = { ...DEFAULT_MILES_PROGRAM_RATES, ...rates };
    const texts: Record<string, string> = {};
    for (const [program, val] of Object.entries(merged)) {
        texts[program] = formatRateForInput(val);
    }
    return texts;
}

export function MilesValuationModal({ open, onOpenChange, rates, onSaved }: MilesValuationModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {open && (
                <MilesValuationModalBody
                    rates={rates}
                    onClose={() => onOpenChange(false)}
                    onSaved={onSaved}
                />
            )}
        </Dialog>
    );
}

function MilesValuationModalBody({
    rates,
    onClose,
    onSaved,
}: {
    rates: Record<string, number>;
    onClose: () => void;
    onSaved: (updatedRates: Record<string, number>) => void;
}) {
    const [draftTexts, setDraftTexts] = useState<Record<string, string>>(() => buildInitialTexts(rates));
    const [newProgramName, setNewProgramName] = useState("");
    const [newProgramRate, setNewProgramRate] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const handleAddCustomProgram = () => {
        const name = newProgramName.trim();
        if (!name) {
            toast.error("Informe o nome do programa.");
            return;
        }
        const parsed = newProgramRate.trim() === "" ? 0 : parseCurrencyRateInput(newProgramRate);
        if (!Number.isFinite(parsed) || parsed < 0) {
            toast.error("Informe um valor válido em reais (ex: 25,00).");
            return;
        }
        setDraftTexts(prev => ({ ...prev, [name]: formatRateForInput(parsed) }));
        setNewProgramName("");
        setNewProgramRate("");
    };

    const handleRemoveProgram = (program: string) => {
        setDraftTexts(prev => {
            const next = { ...prev };
            delete next[program];
            return next;
        });
    };

    const handleResetDefaults = () => {
        setDraftTexts(buildInitialTexts({}));
    };

    const handleSave = async () => {
        const payload: Record<string, number> = {};
        for (const [program, text] of Object.entries(draftTexts)) {
            const parsed = text.trim() === "" ? 0 : parseCurrencyRateInput(text);
            if (!Number.isFinite(parsed) || parsed < 0) {
                toast.error(`Valor inválido para ${program}. Use formato como 17,50.`);
                return;
            }
            payload[program] = Math.round(parsed * 100) / 100;
        }

        setIsSaving(true);
        try {
            const res = await fetch(`${API_BASE_URL}/miles/valuations`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rates: payload }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            onSaved(data.rates ?? payload);
            toast.success("Valores médios do milheiro salvos.");
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Não foi possível salvar os valores do milheiro.");
        } finally {
            setIsSaving(false);
        }
    };

    const programs = Object.keys(draftTexts);

    return (
        <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
                <DialogTitle>Valor médio do milheiro (R$ / 1.000 pts)</DialogTitle>
                <DialogDescription>
                    Configure quanto custa em média cada 1.000 milhas ou pontos por programa para estimar o custo da compra.
                </DialogDescription>
            </DialogHeader>

            <div className="max-h-[340px] space-y-2.5 overflow-y-auto pr-1">
                {programs.map(program => {
                    const isDefault = program in DEFAULT_MILES_PROGRAM_RATES;
                    return (
                        <div key={program} className="grid grid-cols-[1fr_130px_auto] items-center gap-2.5">
                            <Label htmlFor={`rate-${program}`} className="truncate font-medium">
                                {program}
                            </Label>
                            <div className="relative">
                                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                                    R$
                                </span>
                                <Input
                                    id={`rate-${program}`}
                                    inputMode="decimal"
                                    className="pl-8 text-right tabular-nums"
                                    value={draftTexts[program] ?? ""}
                                    onChange={e => setDraftTexts(prev => ({ ...prev, [program]: e.target.value }))}
                                />
                            </div>
                            {!isDefault ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Remover ${program}`}
                                    onClick={() => handleRemoveProgram(program)}
                                >
                                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                            ) : (
                                <div className="w-8" />
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="border-t pt-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Adicionar outro programa</p>
                <div className="grid grid-cols-[1fr_110px_auto] gap-2">
                    <Input
                        placeholder="Ex: AAdvantage"
                        value={newProgramName}
                        onChange={e => setNewProgramName(e.target.value)}
                    />
                    <Input
                        inputMode="decimal"
                        placeholder="R$ 45,00"
                        value={newProgramRate}
                        onChange={e => setNewProgramRate(e.target.value)}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={handleAddCustomProgram}>
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar
                    </Button>
                </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={handleResetDefaults}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restaurar padrão
                </Button>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Salvando..." : "Salvar valores"}
                    </Button>
                </div>
            </div>
        </DialogContent>
    );
}
