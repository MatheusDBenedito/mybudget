"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";

const cardSchema = z.object({
    name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres."),
    limit: z.number({ message: "Insira um valor válido." }).positive("O limite deve ser maior que zero."),
    invoiceClosingOffset: z.number().min(1, "Dia inválido.").max(28, "Limite de antecedência irreal."),
    dueDay: z.number().min(1, "Dia inválido.").max(28, "Para evitar bugs em fevereiro, limite o dia até 28."),
    color: z.string().optional(),
});

type CardData = z.infer<typeof cardSchema>;

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

const CARD_COLORS = [
    { value: "from-purple-600 to-purple-900", label: "Roxo" },
    { value: "from-blue-600 to-blue-900", label: "Azul" },
    { value: "from-sky-400 to-sky-700", label: "Céu" },
    { value: "from-cyan-500 to-cyan-800", label: "Ciano" },
    { value: "from-teal-500 to-teal-800", label: "Azul Piscina" },
    { value: "from-emerald-600 to-emerald-900", label: "Verde Escuro" },
    { value: "from-green-400 to-green-700", label: "Verde Claro" },
    { value: "from-lime-400 to-lime-700", label: "Limão" },
    { value: "from-yellow-400 to-yellow-600", label: "Amarelo" },
    { value: "from-amber-500 to-amber-700", label: "Âmbar" },
    { value: "from-orange-400 to-orange-600", label: "Laranja" },
    { value: "from-red-600 to-red-900", label: "Vermelho" },
    { value: "from-rose-500 to-rose-800", label: "Rosa Escuro" },
    { value: "from-pink-400 to-pink-700", label: "Rosa Claro" },
    { value: "from-fuchsia-500 to-fuchsia-800", label: "Fúcsia" },
    { value: "from-violet-500 to-violet-800", label: "Violeta" },
    { value: "from-indigo-600 to-indigo-900", label: "Índigo" },
    { value: "from-slate-600 to-slate-900", label: "Cinza Metálico" },
    { value: "from-neutral-700 to-neutral-900", label: "Preto" }
];

interface ApiCard {
    id: string;
    name: string;
    limit: number;
    invoiceClosingOffset: number;
    dueDay: number;
    color?: string;
}

interface CreateCardModalProps {
    children: React.ReactNode;
    initialData?: ApiCard;
    onSuccess?: () => void;
}

export function CreateCardModal({ children, initialData, onSuccess }: CreateCardModalProps) {
    const [open, setOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<CardData>({
        resolver: zodResolver(cardSchema),
        defaultValues: {
            name: initialData?.name || "",
            limit: initialData?.limit || 0,
            invoiceClosingOffset: initialData?.invoiceClosingOffset || 7,
            dueDay: initialData?.dueDay || 10,
            color: initialData?.color || CARD_COLORS[0].value,
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                name: initialData?.name || "",
                limit: initialData?.limit || 0,
                invoiceClosingOffset: initialData?.invoiceClosingOffset || 7,
                dueDay: initialData?.dueDay || 10,
                color: initialData?.color || CARD_COLORS[0].value,
            });
        }
    }, [open, initialData, form]);

    const onSubmit = async (data: CardData) => {
        setIsSaving(true);
        try {
            const isEditing = !!initialData;
            const url = isEditing
                ? `http://localhost:3333/credit-cards/${initialData.id}`
                : "http://localhost:3333/credit-cards";
            const method = isEditing ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                setOpen(false);
                form.reset();
                toast.success(isEditing ? "Cartão atualizado com sucesso!" : "Cartão de crédito cadastrado!");
                if (onSuccess) {
                    onSuccess();
                } else {
                    window.location.reload();
                }
            } else {
                const error = await res.json();
                toast.error(`Erro: ${error.message || 'Falha ao salvar o cartão'}`);
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro de conexão com o servidor.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Cartão" : "Adicionar Cartão"}</DialogTitle>
                    <DialogDescription>
                        Configure os detalhes do seu cartão de crédito bancário.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome do Cartão</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: Nubank Mastecard" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="limit"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Limite Total (R$)</FormLabel>
                                    <FormControl>
                                        <CurrencyInput
                                            placeholder="0,00"
                                            value={field.value || ""}
                                            onChange={(val) => field.onChange(val || 0)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="color"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cor do Cartão</FormLabel>
                                    <FormControl>
                                        <div className="flex flex-wrap gap-3">
                                            {CARD_COLORS.map((c) => (
                                                <button
                                                    key={c.value}
                                                    type="button"
                                                    onClick={() => field.onChange(c.value)}
                                                    className={`w-8 h-8 rounded-full bg-gradient-to-br ${c.value} ${field.value === c.value ? 'ring-2 ring-offset-2 ring-slate-800' : 'ring-1 ring-slate-200'} transition-all`}
                                                    title={c.label}
                                                />
                                            ))}
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="invoiceClosingOffset"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Antecedência de Fechamento (Dias)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={28}
                                                {...field}
                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="dueDay"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Dia do Vencimento</FormLabel>
                                        <Select onValueChange={(val) => field.onChange(Number(val))} defaultValue={field.value.toString()}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {DAYS.map((day) => (
                                                    <SelectItem key={day} value={day.toString()}>
                                                        Dia {day}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button type="button" variant="outline" className="mr-2" onClick={() => setOpen(false)} disabled={isSaving}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isSaving}>
                                {isSaving ? "Salvando..." : (initialData ? "Salvar Alterações" : "Salvar Cartão")}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent >
        </Dialog >
    );
}

