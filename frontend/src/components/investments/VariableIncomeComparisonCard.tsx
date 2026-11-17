"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Pencil, Scale, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TrendPill } from "@/components/ui/trend";
import { Money } from "@/components/Money";
import { API_BASE_URL } from "@/lib/auth";
import {
    type ApiInvestment,
    type InvestmentType,
    VARIABLE_INCOME_CLASSES,
    computeVariableIncomeComparison,
} from "@/lib/investments";
import { cn } from "@/lib/utils";

const CLASS_SHORT_LABELS: Record<InvestmentType, string> = {
    VARIABLE_INCOME: "Ações B3",
    FII: "FIIs",
    US_STOCK: "EUA",
    CRYPTO: "Cripto",
    FIXED_INCOME: "Renda Fixa",
    OTHER: "Outros",
};

interface VariableIncomeComparisonCardProps {
    investments: ApiInvestment[];
    receivedDividendsBrl: number;
    contributedAmount: number;
    onContributedAmountSaved: (nextAmount: number) => void;
    height?: number;
    className?: string;
}

export function VariableIncomeComparisonCard({
    investments,
    receivedDividendsBrl,
    contributedAmount,
    onContributedAmountSaved,
    height,
    className,
}: VariableIncomeComparisonCardProps) {
    const [includeDividends, setIncludeDividends] = useState(true);
    const [selectedClasses, setSelectedClasses] = useState<InvestmentType[]>(VARIABLE_INCOME_CLASSES);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const comparison = computeVariableIncomeComparison({
        investments,
        realContributedAmount: contributedAmount,
        receivedDividends: receivedDividendsBrl,
        includeDividends,
        selectedClasses,
    });

    const toggleClass = (cls: InvestmentType) => {
        setSelectedClasses(prev => {
            if (prev.includes(cls)) {
                return prev.length > 1 ? prev.filter(c => c !== cls) : prev;
            }
            return [...prev, cls];
        });
    };

    const startEditing = () => {
        setEditText(contributedAmount > 0 ? contributedAmount.toFixed(2).replace(".", ",") : "");
        setIsEditing(true);
    };

    const saveContributedAmount = async () => {
        const cleaned = editText.replace(/[R$\s.]/g, "").replace(",", ".");
        const parsed = Number(cleaned);
        if (!Number.isFinite(parsed) || parsed < 0) {
            toast.error("Informe um valor de aporte válido (ex: 11038,42).");
            return;
        }
        const rounded = Math.round(parsed * 100) / 100;
        setIsSaving(true);
        try {
            const res = await fetch(`${API_BASE_URL}/investments/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ variableIncomeContributedAmount: rounded }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            onContributedAmountSaved(rounded);
            setIsEditing(false);
            toast.success("Valor de aporte atualizado.");
        } catch (error) {
            console.error(error);
            toast.error("Não foi possível salvar o valor de aporte.");
        } finally {
            setIsSaving(false);
        }
    };

    const maxBar = Math.max(comparison.realContributedAmount, comparison.effectiveValue, 1);
    const contributedBarPct = Math.min(100, (comparison.realContributedAmount / maxBar) * 100);
    const currentBarPct = Math.min(100, (comparison.effectiveValue / maxBar) * 100);

    return (
        <Card className={className} style={height ? { minHeight: height } : undefined}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
                <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">Aporte Real vs. Valor Atual (Renda Variável)</CardTitle>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-wrap items-center gap-1">
                        {VARIABLE_INCOME_CLASSES.map(cls => {
                            const active = selectedClasses.includes(cls);
                            return (
                                <button
                                    key={cls}
                                    type="button"
                                    onClick={() => toggleClass(cls)}
                                    className={cn(
                                        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                                        active
                                            ? "border-primary/40 bg-primary/10 text-primary"
                                            : "bg-muted/40 text-muted-foreground opacity-60",
                                    )}
                                >
                                    {CLASS_SHORT_LABELS[cls]}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1">
                        <Switch
                            id="include-dividends-switch"
                            checked={includeDividends}
                            onCheckedChange={setIncludeDividends}
                        />
                        <Label htmlFor="include-dividends-switch" className="cursor-pointer text-xs font-medium">
                            Incluir dividendos recebidos
                        </Label>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border bg-muted/30 p-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Aporte real informado</span>
                            {!isEditing && (
                                <button
                                    type="button"
                                    onClick={startEditing}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                                >
                                    <Pencil className="h-3 w-3" />
                                    Editar
                                </button>
                            )}
                        </div>
                        {isEditing ? (
                            <div className="mt-1.5 flex items-center gap-1.5">
                                <Input
                                    inputMode="decimal"
                                    className="h-8 text-sm tabular-nums"
                                    value={editText}
                                    onChange={e => setEditText(e.target.value)}
                                    placeholder="11038,42"
                                />
                                <Button size="icon-sm" onClick={saveContributedAmount} disabled={isSaving} aria-label="Salvar aporte">
                                    <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon-sm" variant="ghost" onClick={() => setIsEditing(false)} aria-label="Cancelar">
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ) : (
                            <div className="mt-1 text-lg font-semibold tabular-nums">
                                <Money value={comparison.realContributedAmount} />
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg border bg-muted/30 p-3">
                        <div className="text-xs text-muted-foreground">Valor atual em carteira</div>
                        <div className="mt-1 text-lg font-semibold tabular-nums">
                            <Money value={comparison.currentValue} />
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {selectedClasses.map(c => CLASS_SHORT_LABELS[c]).join(" + ")}
                        </div>
                    </div>

                    <div className="rounded-lg border bg-muted/30 p-3">
                        <div className="text-xs text-muted-foreground">
                            Dividendos recebidos ({includeDividends ? "inclusos" : "excluídos"})
                        </div>
                        <div className={cn("mt-1 text-lg font-semibold tabular-nums", includeDividends ? "text-positive" : "text-muted-foreground")}>
                            +<Money value={comparison.receivedDividends} />
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                            Total considerado: <Money value={comparison.effectiveValue} />
                        </div>
                    </div>

                    <div className="rounded-lg border bg-muted/30 p-3">
                        <div className="text-xs text-muted-foreground">Resultado geral</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className={cn("text-lg font-semibold tabular-nums", comparison.profitBrl >= 0 ? "text-positive" : "text-negative")}>
                                {comparison.profitBrl >= 0 ? "+" : ""}
                                <Money value={comparison.profitBrl} />
                            </span>
                            <TrendPill value={comparison.profitPct} />
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {comparison.profitBrl >= 0 ? "No lucro sobre os aportes" : "Abaixo do valor aportado"}
                        </div>
                    </div>
                </div>

                <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-xs">
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Aporte real</span>
                            <span className="font-medium tabular-nums"><Money value={comparison.realContributedAmount} /></span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div className="h-full bg-slate-500 transition-all duration-300" style={{ width: `${contributedBarPct}%` }} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">
                                Valor atual {includeDividends ? "(+ dividendos)" : "(sem dividendos)"}
                            </span>
                            <span className={cn("font-semibold tabular-nums", comparison.profitBrl >= 0 ? "text-positive" : "text-negative")}>
                                <Money value={comparison.effectiveValue} />
                            </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                                className={cn("h-full transition-all duration-300", comparison.profitBrl >= 0 ? "bg-positive" : "bg-negative")}
                                style={{ width: `${currentBarPct}%` }}
                            />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
