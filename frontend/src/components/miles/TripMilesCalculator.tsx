"use client";

import { useId, useState } from "react";
import { Plane, Settings2, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/Money";
import { cn } from "@/lib/utils";
import {
    DESTINATION_PROGRAMS,
    calculateTripMilesPlan,
    formatPoints,
    getTripPlanInputError,
    parseCurrencyRateInput,
    parsePercentInput,
    parsePointsInput,
    resolveProgramRate,
} from "@/lib/miles";

const QUICK_BONUSES = [0, 30, 50, 80, 100];

interface TripMilesCalculatorProps {
    rates: Record<string, number>;
    creditedPoints?: number;
    onOpenSettings: () => void;
    /** Optional wrapper-less mode when embedded inside a tabbed Panel */
    embedded?: boolean;
}

export function TripMilesCalculator({ rates, creditedPoints = 0, onOpenSettings }: TripMilesCalculatorProps) {
    const id = useId();
    const [program, setProgram] = useState("Smiles");
    const [requiredText, setRequiredText] = useState("");
    const [bankText, setBankText] = useState("");
    const [bonusText, setBonusText] = useState("0");
    const [overrideRateText, setOverrideRateText] = useState<string | null>(null);

    const configuredRate = resolveProgramRate(program, rates);
    const customRateText = overrideRateText ?? (configuredRate > 0 ? configuredRate.toFixed(2).replace(".", ",") : "0,00");

    const requiredMiles = parsePointsInput(requiredText);
    const bankPoints = bankText.trim() === "" ? 0 : parsePointsInput(bankText);
    const bonusPercent = bonusText.trim() === "" ? 0 : parsePercentInput(bonusText);
    const parsedRate = customRateText.trim() === "" ? 0 : parseCurrencyRateInput(customRateText);

    const hasInput = requiredText.trim() !== "";
    const error = hasInput ? getTripPlanInputError(requiredMiles, bankPoints, bonusPercent, parsedRate) : null;
    const result = hasInput && !error
        ? calculateTripMilesPlan({
            requiredMiles,
            bankPoints,
            transferBonusPercent: bonusPercent,
            costPerThousandBrl: parsedRate,
        })
        : null;

    const allPrograms = Array.from(new Set([...DESTINATION_PROGRAMS, ...Object.keys(rates)]));

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label htmlFor={`${id}-program`}>Programa da viagem</Label>
                    <Input
                        id={`${id}-program`}
                        list={`${id}-programs`}
                        value={program}
                        onChange={e => {
                            setProgram(e.target.value);
                            setOverrideRateText(null);
                        }}
                        autoComplete="off"
                    />
                    <datalist id={`${id}-programs`}>
                        {allPrograms.map(p => <option key={p} value={p} />)}
                    </datalist>
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                        <Label htmlFor={`${id}-milheiro`}>Valor do milheiro</Label>
                        <button
                            type="button"
                            onClick={onOpenSettings}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                            title="Configurar valores médios salvos"
                        >
                            <Settings2 className="h-3 w-3" />
                            Configurar médias
                        </button>
                    </div>
                    <div className="relative">
                        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                            R$
                        </span>
                        <Input
                            id={`${id}-milheiro`}
                            inputMode="decimal"
                            className="pl-8 text-right tabular-nums"
                            value={customRateText}
                            onChange={e => setOverrideRateText(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label htmlFor={`${id}-required`}>Milhas necessárias (viagem)</Label>
                    <Input
                        id={`${id}-required`}
                        inputMode="numeric"
                        placeholder="Ex: 120.000"
                        value={requiredText}
                        onChange={e => setRequiredText(e.target.value)}
                        aria-invalid={!!error && !Number.isFinite(requiredMiles)}
                    />
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                        <Label htmlFor={`${id}-bank`}>Pontos que já tenho</Label>
                        {creditedPoints > 0 && (
                            <button
                                type="button"
                                onClick={() => setBankText(formatPoints(creditedPoints))}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                                title="Preencher com seu saldo creditado"
                            >
                                <Wallet className="h-3 w-3" />
                                Usar saldo ({formatPoints(creditedPoints)})
                            </button>
                        )}
                    </div>
                    <Input
                        id={`${id}-bank`}
                        inputMode="numeric"
                        placeholder="Ex: 40.000"
                        value={bankText}
                        onChange={e => setBankText(e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={`${id}-bonus`}>Bônus de transferência (%)</Label>
                    <span className="text-[11px] text-muted-foreground">Opcional para pontos do banco</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    {QUICK_BONUSES.map(b => {
                        const active = bonusText.trim() === String(b);
                        return (
                            <Button
                                key={b}
                                type="button"
                                size="xs"
                                variant={active ? "default" : "outline"}
                                onClick={() => setBonusText(String(b))}
                            >
                                {b}%
                            </Button>
                        );
                    })}
                    <Input
                        id={`${id}-bonus`}
                        inputMode="decimal"
                        placeholder="Outro %"
                        className="h-7 w-20 text-right text-xs tabular-nums"
                        value={bonusText}
                        onChange={e => setBonusText(e.target.value)}
                    />
                </div>
            </div>

            {error && (
                <p role="alert" className="rounded-md bg-negative-soft px-3 py-2 text-xs text-negative">
                    {error}
                </p>
            )}

            {result ? (
                <div className="space-y-3 rounded-lg border bg-muted/40 p-3.5">
                    <div>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 font-medium text-foreground">
                                <Plane className="h-3.5 w-3.5 text-primary" />
                                Cobertura da viagem ({program || "Programa"})
                            </span>
                            <span className="font-semibold tabular-nums">{result.coveragePercent}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                                className={cn(
                                    "h-full transition-all duration-300",
                                    result.missingMilesToBuy === 0 ? "bg-positive" : "bg-primary",
                                )}
                                style={{ width: `${result.coveragePercent}%` }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 border-t pt-2.5 text-sm">
                        <div>
                            <div className="text-xs text-muted-foreground">
                                Geradas pelo banco {result.transferBonusPercent > 0 ? `(+${result.transferBonusPercent}%)` : ""}
                            </div>
                            <div className="font-medium tabular-nums">
                                {formatPoints(result.milesFromBank)} <span className="text-xs font-normal text-muted-foreground">milhas</span>
                            </div>
                        </div>

                        <div>
                            <div className="text-xs text-muted-foreground">
                                {result.missingMilesToBuy > 0 ? "Precisa comprar" : "Meta atingida!"}
                            </div>
                            <div
                                className={cn(
                                    "font-semibold tabular-nums",
                                    result.missingMilesToBuy > 0 ? "text-amber-600 dark:text-amber-400" : "text-positive",
                                )}
                            >
                                {result.missingMilesToBuy > 0
                                    ? `${formatPoints(result.missingMilesToBuy)} milhas`
                                    : result.surplusMiles > 0
                                        ? `Sobra ${formatPoints(result.surplusMiles)}`
                                        : "0 milhas"}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 border-t pt-2.5">
                        <div>
                            <div className="text-xs text-muted-foreground">Custo p/ comprar faltantes</div>
                            <div className="text-base font-semibold tabular-nums text-foreground">
                                <Money value={result.estimatedPurchaseCostBrl} />
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Valor equivalente da viagem</div>
                            <div className="text-base font-medium tabular-nums text-muted-foreground">
                                <Money value={result.totalTripEquivalentBrl} />
                            </div>
                        </div>
                    </div>
                </div>
            ) : !error ? (
                <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                    Informe quantas milhas a passagem exige e quantos pontos você já tem no banco para calcular quanto falta comprar.
                </p>
            ) : null}
        </div>
    );
}
