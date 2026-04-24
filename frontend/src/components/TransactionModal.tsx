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

const transactionSchema = z.object({
    description: z.string().min(3, "A descrição deve ter pelo menos 3 caracteres."),
    amount: z.number({ message: "Insira um valor válido." }).positive("O valor deve ser maior que zero."),
    categoryId: z.string().min(1, "Selecione uma categoria."),
    accountId: z.string().min(1, "Selecione uma conta."),
    type: z.enum(["INCOME", "EXPENSE"]),
    isFixed: z.boolean(),
    date: z.date({ message: "A data é obrigatória." }),
});

type TransactionData = z.infer<typeof transactionSchema>;

type ApiCategory = {
    id: string;
    name: string;
    color: string | null;
};

type ApiAccount = {
    id: string;
    name: string;
    balance: number;
};

interface TransactionModalProps {
    children: React.ReactNode;
}

export function TransactionModal({ children }: TransactionModalProps) {
    const [open, setOpen] = useState(false);
    const [categories, setCategories] = useState<ApiCategory[]>([]);
    const [accounts, setAccounts] = useState<ApiAccount[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<TransactionData>({
        resolver: zodResolver(transactionSchema),
        defaultValues: {
            description: "",
            amount: 0,
            categoryId: "",
            accountId: "",
            type: "EXPENSE",
            isFixed: false,
            date: new Date(),
        },
    });

    const amount = form.watch("amount") || 0;
    const type = form.watch("type");

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [catRes, accRes] = await Promise.all([
                    fetch("http://localhost:3333/categories"),
                    fetch("http://localhost:3333/accounts"),
                ]);
                if (catRes.ok) setCategories(await catRes.json());
                if (accRes.ok) {
                    const accData = await accRes.json();
                    setAccounts(accData);
                    if (accData.length > 0) {
                        form.setValue("accountId", accData[0].id);
                    }
                }
            } catch (error) {
                console.error("Failed to load data:", error);
            }
        };
        fetchData();
    }, []);




    const onSubmit = async (data: TransactionData) => {
        setIsSaving(true);
        try {
            const res = await fetch("http://localhost:3333/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    description: data.description,
                    amount: Number(data.amount),
                    date: data.date.toISOString(),
                    type: data.type,
                    categoryId: data.categoryId,
                    accountId: data.accountId,
                    isFixed: data.isFixed,
                }),
            });

            if (res.ok) {
                setOpen(false);
                form.reset();
                window.location.reload(); // Reload to fetch fresh data for Dashboard MVP
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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Nova Transação</DialogTitle>
                    <DialogDescription>
                        Adicione uma nova transação financeira ao seu fluxo de caixa.
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

                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Valor (R$)</FormLabel>
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
                            name="type"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Tipo</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
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
                            render={({ field }) => (
                                <FormItem className="flex items-center gap-3 rounded-lg border p-3">
                                    <FormControl>
                                        <input
                                            type="checkbox"
                                            checked={field.value}
                                            onChange={field.onChange}
                                            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                                        />
                                    </FormControl>
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-sm font-medium cursor-pointer">
                                            Conta fixa
                                        </FormLabel>
                                        <p className="text-xs text-gray-500">
                                            Será projetada automaticamente nos próximos meses
                                        </p>
                                    </div>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="categoryId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Categoria</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                const amount = form.watch("amount") || 0;
                                const type = form.watch("type");

                                let newBalance = selectedAccount?.balance || 0;
                                if (amount > 0) {
                                    newBalance += type === "INCOME" ? amount : -amount;
                                }

                                return (
                                    <FormItem>
                                        <FormLabel>Conta</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
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
                                        {selectedAccount && (
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
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isSaving}>
                                {isSaving ? "Salvando..." : "Salvar Transação"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
