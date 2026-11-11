"use client";

import { useId, useState } from "react";
import { Calculator, ArrowRight, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/Panel";
import { cn } from "@/lib/utils";
import {
    type MilesEntryDraft,
    DESTINATION_PROGRAMS, ORIGIN_PROGRAMS,
    buildTransferSummary, calculateTransferBonus, formatPoints, getTransferInputError,
    parsePercentInput, parsePointsInput, toDateInputValue,
} from "@/lib/miles";

const QUICK_BONUSES = [30, 50, 80, 100];

interface TransferBonusCalculatorProps {
    /** When provided, shows a button to record the simulated transfer in the control table */
    onRegister?: (draft: MilesEntryDraft) => void;
}

export function TransferBonusCalculator({ onRegister }: TransferBonusCalculatorProps) {
    const id = useId();
    const [origin, setOrigin] = useState("Livelo");
    const [destination, setDestination] = useState("Smiles");
    const [pointsText, setPointsText] = useState("");
    const [bonusText, setBonusText] = useState("");

    const points = parsePointsInput(pointsText);
    const bonus = bonusText.trim() === "" ? 0 : parsePercentInput(bonusText);
    const hasInput = pointsText.trim() !== "";
    const error = hasInput ? getTransferInputError(points, bonus) : null;
    const result = hasInput && !error ? calculateTransferBonus(points, bonus) : null;

    const register = () => {
        if (!result || !onRegister) return;
        onRegister({
            origin: `Transferência ${origin.trim() || "de pontos"}`,
            program: destination.trim(),
            points: result.totalMiles,
            status: "TRANSFERRED",
            expectedCreditDate: toDateInputValue(new Date()),
            notes: result.bonusMiles > 0 ? `${formatPoints(result.transferredPoints)} pts + ${result.bonusPercent}% de bônus` : undefined,
        });
    };

    return (
        <Panel title="Calculadora de transferência bonificada" icon={Calculator}>
            <div className="space-y-4">
                <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                    <div className="space-y-1.5">
                        <Label htmlFor={`${id}-origin`}>Programa de origem</Label>
                        <Input id={`${id}-origin`} list={`${id}-origins`} value={origin} onChange={e => setOrigin(e.target.value)} autoComplete="off" />
                        <datalist id={`${id}-origins`}>{ORIGIN_PROGRAMS.map(p => <option key={p} value={p} />)}</datalist>
                    </div>
                    <ArrowRight className="mb-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <div className="space-y-1.5">
                        <Label htmlFor={`${id}-destination`}>Programa de destino</Label>
                        <Input id={`${id}-destination`} list={`${id}-destinations`} value={destination} onChange={e => setDestination(e.target.value)} autoComplete="off" />
                        <datalist id={`${id}-destinations`}>{DESTINATION_PROGRAMS.map(p => <option key={p} value={p} />)}</datalist>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label htmlFor={`${id}-points`}>Pontos a transferir</Label>
                        <Input
                            id={`${id}-points`}
                            inputMode="numeric"
                            placeholder="Ex: 10.000"
                            value={pointsText}
                            onChange={e => setPointsText(e.target.value)}
                            aria-invalid={!!error && !Number.isFinite(points)}
                            aria-describedby={error ? `${id}-error` : undefined}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor={`${id}-bonus`}>Bônus da promoção (%)</Label>
                        <Input
                            id={`${id}-bonus`}
                            inputMode="decimal"
                            placeholder="Ex: 80"
                            value={bonusText}
                            onChange={e => setBonusText(e.target.value)}
                            aria-describedby={error ? `${id}-error` : undefined}
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Bônus comuns">
                    <span className="text-xs text-muted-foreground">Bônus comuns:</span>
                    {QUICK_BONUSES.map(b => (
                        <button
                            key={b}
                            type="button"
                            onClick={() => setBonusText(String(b))}
                            aria-pressed={bonus === b}
                            className={cn(
                                "h-7 rounded-full border px-3 text-xs tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                                bonus === b && bonusText !== "" ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
                            )}
                        >
                            {b}%
                        </button>
                    ))}
                </div>

                {error && (
                    <p id={`${id}-error`} role="alert" className="text-sm text-negative">{error}</p>
                )}

                <div className="rounded-lg border bg-muted/40 p-4" aria-live="polite">
                    <div className="text-sm text-muted-foreground">Milhas no destino</div>
                    <div className="text-2xl font-medium tabular-nums">{result ? formatPoints(result.totalMiles) : "—"}</div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <dt className="text-muted-foreground">Bônus gerado</dt>
                            <dd className={cn("font-medium tabular-nums", result && result.bonusMiles > 0 && "text-positive")}>
                                {result ? `+${formatPoints(result.bonusMiles)}` : "—"}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">Milhas por ponto</dt>
                            <dd className="font-medium tabular-nums">
                                {result ? result.milesPerPoint.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                            </dd>
                        </div>
                    </dl>
                    <p className="mt-3 border-t pt-3 text-sm">
                        {result
                            ? buildTransferSummary(origin, destination, result)
                            : "Informe os pontos e o bônus para ver o resumo da operação. Considera paridade 1:1 entre os programas."}
                    </p>
                </div>

                {onRegister && (
                    <Button type="button" variant="outline" className="w-full" disabled={!result} onClick={register}>
                        <Plus className="h-4 w-4" />
                        Registrar transferência no controle
                    </Button>
                )}
            </div>
        </Panel>
    );
}
