"use client";

import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    type ApiMilesEntry, type MilesCard, type MilesEntryDraft,
    DESTINATION_PROGRAMS, MILES_STATUS_LABELS, MILES_STATUS_ORDER, ORIGIN_PROGRAMS,
    fromApiDate, toDateInputValue,
} from "@/lib/miles";
import { API_BASE_URL } from "@/lib/auth";

const OTHER_ORIGIN = "__other";

const entrySchema = z.object({
    originChoice: z.string().min(1, "Selecione a origem."),
    origin: z.string().max(80).optional(),
    program: z.string().trim().min(1, "Informe o programa de fidelidade.").max(60),
    points: z.number({ message: "Informe a quantidade de pontos." }).int("Use um número inteiro.").positive("A quantidade deve ser maior que zero."),
    status: z.enum(["PENDING", "TRANSFERRED", "CREDITED"]),
    expectedCreditDate: z.string().min(1, "Informe a data de previsão."),
    notes: z.string().max(500).optional(),
}).superRefine((data, ctx) => {
    if (data.originChoice === OTHER_ORIGIN && !data.origin?.trim()) {
        ctx.addIssue({ code: "custom", message: "Descreva a origem dos pontos.", path: ["origin"] });
    }
});

type EntryForm = z.infer<typeof entrySchema>;

interface MilesEntryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    cards: MilesCard[];
    /** Entry being edited; when absent the form creates a new entry */
    entry?: ApiMilesEntry | null;
    /** Pre-filled values for a new entry */
    draft?: MilesEntryDraft | null;
    onSaved: () => void;
}

const toFormValues = (cards: MilesCard[], entry?: ApiMilesEntry | null, draft?: MilesEntryDraft | null): Partial<EntryForm> => {
    if (entry) {
        return {
            originChoice: entry.creditCardId ?? OTHER_ORIGIN,
            origin: entry.origin ?? "",
            program: entry.program,
            points: entry.points,
            status: entry.status,
            expectedCreditDate: toDateInputValue(fromApiDate(entry.expectedCreditDate)),
            notes: entry.notes ?? "",
        };
    }
    const cardId = draft?.creditCardId ?? (draft?.origin ? undefined : cards[0]?.id);
    return {
        originChoice: cardId ?? OTHER_ORIGIN,
        origin: draft?.origin ?? "",
        program: draft?.program ?? cards.find(c => c.id === cardId)?.loyaltyProgram ?? "",
        points: draft?.points,
        status: draft?.status ?? "PENDING",
        expectedCreditDate: draft?.expectedCreditDate ?? toDateInputValue(new Date()),
        notes: draft?.notes ?? "",
    };
};

export function MilesEntryModal({ open, onOpenChange, cards, entry, draft, onSaved }: MilesEntryModalProps) {
    const [isSaving, setIsSaving] = useState(false);
    const programListId = useId();

    const form = useForm<EntryForm>({
        resolver: zodResolver(entrySchema),
        defaultValues: toFormValues(cards, entry, draft),
    });

    useEffect(() => {
        if (open) form.reset(toFormValues(cards, entry, draft));
    }, [open, entry, draft, cards, form]);

    const originChoice = form.watch("originChoice");

    // Picking a card suggests its program, without overwriting what the user typed
    const handleOriginChange = (value: string) => {
        form.setValue("originChoice", value, { shouldValidate: true });
        const card = cards.find(c => c.id === value);
        if (card?.loyaltyProgram && !form.getValues("program")) {
            form.setValue("program", card.loyaltyProgram, { shouldValidate: true });
        }
    };

    const onSubmit = async (data: EntryForm) => {
        setIsSaving(true);
        const isCard = data.originChoice !== OTHER_ORIGIN;
        const body = {
            creditCardId: isCard ? data.originChoice : null,
            origin: isCard ? null : data.origin?.trim(),
            program: data.program.trim(),
            points: data.points,
            status: data.status,
            expectedCreditDate: data.expectedCreditDate,
            notes: data.notes?.trim() || null,
            ...(!entry && draft?.referenceMonth ? { referenceMonth: draft.referenceMonth, referenceYear: draft.referenceYear } : {}),
        };

        try {
            const res = await fetch(entry ? `${API_BASE_URL}/miles/${entry.id}` : `${API_BASE_URL}/miles`, {
                method: entry ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                const message = Array.isArray(error.message) ? error.message.join(", ") : error.message;
                toast.error(`Erro: ${message || "não foi possível salvar o lançamento."}`);
                return;
            }
            toast.success(entry ? "Lançamento atualizado." : "Lançamento de pontos registrado.");
            onOpenChange(false);
            onSaved();
        } catch (error) {
            console.error(error);
            toast.error("Erro de conexão com o servidor.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>{entry ? "Editar lançamento de pontos" : "Novo lançamento de pontos"}</DialogTitle>
                    <DialogDescription>Registre de onde vieram os pontos, para qual programa vão e quando devem ser creditados.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="originChoice"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Origem</FormLabel>
                                        <Select value={field.value} onValueChange={handleOriginChange}>
                                            <FormControl>
                                                <SelectTrigger className="w-full"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {cards.map(c => <SelectItem key={c.id} value={c.id}>Cartão {c.name}</SelectItem>)}
                                                <SelectItem value={OTHER_ORIGIN}>Outra origem…</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="program"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Programa de fidelidade</FormLabel>
                                        <FormControl>
                                            <Input list={programListId} placeholder="Ex: Livelo, Smiles" autoComplete="off" {...field} />
                                        </FormControl>
                                        <datalist id={programListId}>
                                            {[...ORIGIN_PROGRAMS, ...DESTINATION_PROGRAMS].map(p => <option key={p} value={p} />)}
                                        </datalist>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {originChoice === OTHER_ORIGIN && (
                            <FormField
                                control={form.control}
                                name="origin"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Descrição da origem</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ex: Compra bonificada, Transferência Livelo" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <div className="grid gap-4 sm:grid-cols-3">
                            <FormField
                                control={form.control}
                                name="points"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Pontos</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                inputMode="numeric"
                                                min={1}
                                                step={1}
                                                placeholder="0"
                                                value={field.value ?? ""}
                                                onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Status</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {MILES_STATUS_ORDER.map(s => <SelectItem key={s} value={s}>{MILES_STATUS_LABELS[s]}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="expectedCreditDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Previsão de crédito</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Observações (opcional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: promoção 100% de bônus até 30/11" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
                            <Button type="submit" disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar"}</Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
