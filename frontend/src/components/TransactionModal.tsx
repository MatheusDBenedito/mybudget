"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { type AccountLike, defaultSettlementAccount } from "@/lib/accounts";
import { API_BASE_URL } from "@/lib/auth";

const transactionSchema = z.object({
    description: z.string().min(3, "A descrição deve ter pelo menos 3 caracteres."),
    amount: z.number({ message: "Insira um valor válido." }).positive("O valor deve ser maior que zero."),
    categoryId: z.string().optional(),
    accountId: z.string().min(1, "Selecione uma conta."),
    type: z.enum(["INCOME", "EXPENSE"]),
    isFixed: z.boolean(),
    installments: z.number().int().min(1, "Mínimo de 1 parcela.").max(480, "Máximo de 480 parcelas."),
    date: z.date({ message: "A data é obrigatória." }),
});

type TransactionData = z.infer<typeof transactionSchema>;

type ApiCategory = {
    id: string;
    name: string;
    color: string | null;
};

type ApiAccount = AccountLike;

export type EditableTransaction = {
    id: string;
    description: string;
    amount: number;
    date: string;
    type: "INCOME" | "EXPENSE";
    status?: "PAID" | "PENDING" | "CANCELLED";
    isFixed?: boolean;
    installments?: number;
    installmentGroupId?: string | null;
    accountId?: string;
    categoryId?: string | null;
};

interface TransactionModalProps {
    children: React.ReactNode;
    initialData?: EditableTransaction;
    /** Called after saving; when omitted the page reloads */
    onSuccess?: () => void;
}

export function TransactionModal({ children, initialData, onSuccess }: TransactionModalProps) {
    const [open, setOpen] = useState(false);
    const [categories, setCategories] = useState<ApiCategory[]>([]);
    const [accounts, setAccounts] = useState<ApiAccount[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [editScope, setEditScope] = useState<"single" | "series">("single");
    const isEditing = !!initialData;

    const form = useForm<TransactionData>({
        resolver: zodResolver(transactionSchema),
        defaultValues: {
            description: initialData?.description ?? "",
            amount: initialData?.amount ?? 0,
            categoryId: initialData?.categoryId ?? "",
            accountId: initialData?.accountId ?? "",
            type: initialData?.type ?? "EXPENSE",
            isFixed: initialData?.isFixed ?? false,
            installments: initialData?.installments ?? 1,
            date: initialData ? new Date(initialData.date) : new Date(),
        },
    });

    useEffect(() => {
        if (!open) return;
        let cancelled = false;

        const fetchData = async () => {
            try {
                const [catRes, accRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/categories`),
                    fetch(`${API_BASE_URL}/accounts`),
                ]);
                if (cancelled) return;
                const catData: ApiCategory[] = catRes.ok ? await catRes.json() : [];
                const accData: ApiAccount[] = accRes.ok ? await accRes.json() : [];
                setCategories(catData);
                setAccounts(accData);

                const defaultAccId = initialData?.accountId
                    || defaultSettlementAccount(accData, initialData?.type ?? "EXPENSE")?.id
                    || accData[0]?.id
                    || "";

                form.reset({
                    description: initialData?.description ?? "",
                    amount: initialData?.amount ?? 0,
                    categoryId: initialData?.categoryId ?? "",
                    accountId: defaultAccId,
                    type: initialData?.type ?? "EXPENSE",
                    isFixed: initialData?.isFixed ?? false,
                    installments: initialData?.installments ?? 1,
                    date: initialData ? new Date(initialData.date) : new Date(),
                });
                setEditScope("single");
            } catch (error) {
                console.error("Failed to load data:", error);
            }
        };

        void fetchData();
        return () => { cancelled = true; };
    }, [open, initialData, form]);

    const onSubmit = async (data: TransactionData) => {
        if (!isEditing && !data.categoryId) {
            form.setError("categoryId", { message: "Selecione uma categoria." });
            return;
        }

        setIsSaving(true);
        try {
            const url = isEditing
                ? `${API_BASE_URL}/transactions/${initialData.id}`
                : `${API_BASE_URL}/transactions`;
            const method = isEditing ? "PATCH" : "POST";

            const payload: Record<string, unknown> = {
                description: data.description,
                amount: Number(data.amount),
                date: data.date.toISOString(),
                type: data.type,
                accountId: data.accountId,
                isFixed: data.isFixed,
                ...(!isEditing && !data.isFixed ? { installments: data.installments } : {}),
                ...(data.categoryId ? { categoryId: data.categoryId } : {}),
                ...(isEditing && initialData?.isFixed ? { scope: editScope } : {}),
            };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setOpen(false);
                if (!isEditing) {
                    form.reset({
                        description: "",
                        amount: 0,
                        categoryId: "",
                        accountId: defaultSettlementAccount(accounts, "EXPENSE")?.id ?? "",
                        type: "EXPENSE",
                        isFixed: false,
                        installments: 1,
                        date: new Date(),
                    });
                }
                if (onSuccess) {
                    toast.success(isEditing ? "Lançamento atualizado." : "Lançamento salvo.");
                    onSuccess();
                } else {
                    window.location.reload();
                }
            } else {
                const error = await res.json();
                toast.error(`Erro: ${error.message}`);
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
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[440px]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Editar Transação" : "Nova Transação"}</DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? "Ajuste o valor estimado ou os dados deste lançamento."
                            : "Adicione uma nova transação financeira ao seu fluxo de caixa."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descrição</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: Mercado Assaí" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className={cn("grid gap-4", !isEditing ? "grid-cols-2" : "grid-cols-1")}>
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {!isEditing && form.watch("installments") > 1 ? "Valor total (R$)" : "Valor (R$)"}
                                        </FormLabel>
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

                            {!isEditing && (
                                <FormField
                                    control={form.control}
                                    name="installments"
                                    render={({ field }) => {
                                        const isFixed = form.watch("isFixed");
                                        const amount = form.watch("amount") || 0;
                                        const count = field.value || 1;
                                        return (
                                            <FormItem>
                                                <FormLabel>Qtd. Parcelas</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            max={480}
                                                            step={1}
                                                            disabled={isFixed}
                                                            className={isFixed ? "bg-muted cursor-not-allowed" : ""}
                                                            value={field.value ?? 1}
                                                            onChange={(e) => {
                                                                const raw = parseInt(e.target.value, 10);
                                                                const n = Number.isFinite(raw) ? Math.max(1, raw) : 1;
                                                                field.onChange(n);
                                                                if (n > 1) form.setValue("isFixed", false);
                                                            }}
                                                        />
                                                        {isFixed && (
                                                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                                                                Fixo
                                                            </span>
                                                        )}
                                                    </div>
                                                </FormControl>
                                                {count > 1 && amount > 0 && (
                                                    <p className="text-[11px] text-muted-foreground tabular-nums">
                                                        {count}x de{" "}
                                                        {new Intl.NumberFormat("pt-BR", {
                                                            style: "currency",
                                                            currency: "BRL",
                                                        }).format(amount / count)}
                                                    </p>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        );
                                    }}
                                />
                            )}
                        </div>

                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Tipo</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            className="flex space-x-4"
                                        >
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl>
                                                    <RadioGroupItem value="EXPENSE" />
                                                </FormControl>
                                                <FormLabel className="font-normal text-red-600">
                                                    Despesa
                                                </FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl>
                                                    <RadioGroupItem value="INCOME" />
                                                </FormControl>
                                                <FormLabel className="font-normal text-emerald-600">
                                                    Receita
                                                </FormLabel>
                                            </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="isFixed"
                            render={({ field }) => {
                                const isInstallment = !isEditing && form.watch("installments") > 1;
                                return (
                                    <FormItem className={cn("flex items-center gap-3 rounded-lg border p-3", isInstallment && "opacity-60")}>
                                        <FormControl>
                                            <input
                                                type="checkbox"
                                                checked={field.value}
                                                disabled={isInstallment}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    field.onChange(checked);
                                                    if (checked) form.setValue("installments", 1);
                                                }}
                                                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600 disabled:cursor-not-allowed"
                                            />
                                        </FormControl>
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-sm font-medium cursor-pointer">
                                                Conta fixa
                                            </FormLabel>
                                            <p className="text-xs text-gray-500">
                                                {isInstallment
                                                    ? "Desabilitado para compras/contas parceladas (ex.: IPTU, IPVA)"
                                                    : "Será projetada automaticamente nos próximos meses"}
                                            </p>
                                        </div>
                                    </FormItem>
                                );
                            }}
                        />

                        {isEditing && initialData?.isFixed && (
                            <fieldset className="space-y-2 rounded-lg border bg-muted/30 p-3">
                                <legend className="px-1 text-xs font-medium text-muted-foreground">Aplicar alteração em</legend>
                                <label className="flex cursor-pointer items-center gap-2 text-sm">
                                    <input
                                        type="radio"
                                        name="edit-scope"
                                        checked={editScope === "single"}
                                        onChange={() => setEditScope("single")}
                                        className="h-4 w-4 accent-foreground"
                                    />
                                    <span>Só este mês <span className="text-xs text-muted-foreground">(próximos mantêm a estimativa)</span></span>
                                </label>
                                <label className="flex cursor-pointer items-center gap-2 text-sm">
                                    <input
                                        type="radio"
                                        name="edit-scope"
                                        checked={editScope === "series"}
                                        onChange={() => setEditScope("series")}
                                        className="h-4 w-4 accent-foreground"
                                    />
                                    <span>Este mês e os próximos <span className="text-xs text-muted-foreground">(atualiza a estimativa)</span></span>
                                </label>
                            </fieldset>
                        )}

                        <FormField
                            control={form.control}
                            name="categoryId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Categoria</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || ""}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {categories.map((cat) => (
                                                <SelectItem key={cat.id} value={cat.id}>
                                                    {cat.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="accountId"
                            render={({ field }) => {
                                const selectedAccount = accounts.find((a) => a.id === field.value);
                                const currentAmount = form.watch("amount") || 0;
                                const currentInstallments = isEditing || form.watch("isFixed") ? 1 : (form.watch("installments") || 1);
                                const currentType = form.watch("type");
                                const currentDate = form.watch("date");
                                const endOfToday = new Date();
                                endOfToday.setHours(23, 59, 59, 999);
                                const firstParcelIsPaid = !currentDate || currentDate <= endOfToday;
                                const immediateAmount = currentInstallments > 1
                                    ? (firstParcelIsPaid ? currentAmount / currentInstallments : 0)
                                    : (firstParcelIsPaid ? currentAmount : 0);

                                let newBalance = selectedAccount?.balance || 0;
                                if (!isEditing && immediateAmount > 0) {
                                    newBalance += currentType === "INCOME" ? immediateAmount : -immediateAmount;
                                } else if (isEditing && initialData?.status === "PAID") {
                                    const prevImpact = initialData.type === "INCOME" ? initialData.amount : -initialData.amount;
                                    const nextImpact = currentType === "INCOME" ? currentAmount : -currentAmount;
                                    if (field.value === initialData.accountId) {
                                        newBalance += nextImpact - prevImpact;
                                    } else {
                                        newBalance += nextImpact;
                                    }
                                }

                                return (
                                    <FormItem>
                                        <FormLabel>Conta</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ""}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione a conta..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {accounts.map((acc) => (
                                                    <SelectItem key={acc.id} value={acc.id}>
                                                        {acc.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {selectedAccount && (!isEditing || initialData?.status === "PAID") && (
                                            <div className="mt-2 text-sm text-gray-500 bg-gray-50/50 p-3 rounded-md border border-gray-100 flex justify-between items-center">
                                                <span>Saldo após transação:</span>
                                                <span className={cn(
                                                    "font-medium",
                                                    newBalance < 0 ? "text-red-600" : "text-emerald-600"
                                                )}>
                                                    {new Intl.NumberFormat("pt-BR", {
                                                        style: "currency",
                                                        currency: "BRL",
                                                    }).format(newBalance)}
                                                </span>
                                            </div>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                );
                            }}
                        />

                        <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Data</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full pl-3 text-left font-normal",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, "PP", { locale: ptBR })
                                                    ) : (
                                                        <span>Escolha uma data</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                initialFocus
                                                locale={ptBR}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end pt-4">
                            <Button type="button" variant="outline" className="mr-2" onClick={() => setOpen(false)} disabled={isSaving}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Salvar Transação"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
