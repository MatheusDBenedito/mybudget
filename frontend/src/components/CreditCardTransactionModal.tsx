"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, CreditCard, Repeat, Info, AlertTriangle, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { holdersOf, mainHolder } from "@/lib/credit-cards";
import { API_BASE_URL } from "@/lib/auth";

const cardTransactionSchema = z.object({
    description: z.string().min(3, "A descrição deve ter pelo menos 3 caracteres."),
    amount: z.number({ message: "Insira um valor válido." }).positive("O valor deve ser maior que zero."),
    categoryId: z.string().optional(),
    creditCardId: z.string().min(1, "Selecione um cartão de crédito."),
    cardHolderId: z.string().optional(),
    installments: z.number({ message: "Insira um valor válido." }).min(1),
    date: z.date({ message: "A data da compra é obrigatória." }),
    isFixed: z.boolean(),
});
type CardTransactionData = z.infer<typeof cardTransactionSchema>;

type ApiCategory = {
    id: string;
    name: string;
    color: string | null;
};

type ApiCardHolder = {
    id: string;
    name: string;
    last4?: string | null;
    isMain: boolean;
};

type ApiCreditCard = {
    id: string;
    name: string;
    limit: number;
    holders?: ApiCardHolder[];
};

interface CreditCardTransactionModalProps {
    children: React.ReactNode;
    /** Item being edited; the API sends the date as an ISO string and may omit isFixed */
    initialData?: Omit<CardTransactionData, "date" | "isFixed"> & { id: string; date: Date | string; isFixed?: boolean; cardHolderId?: string };
    onSuccess?: () => void;
}

export function CreditCardTransactionModal({ children, initialData, onSuccess }: CreditCardTransactionModalProps) {
    const [open, setOpen] = useState(false);
    const [categories, setCategories] = useState<ApiCategory[]>([]);
    const [creditCards, setCreditCards] = useState<ApiCreditCard[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [catRes, cardRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/categories`),
                    fetch(`${API_BASE_URL}/credit-cards`)
                ]);

                if (catRes.ok) setCategories(await catRes.json());
                if (cardRes.ok) setCreditCards(await cardRes.json());
            } catch (error) {
                console.error("Failed to load select data:", error);
            }
        };
        fetchData();
    }, []);

    const form = useForm<CardTransactionData>({
        resolver: zodResolver(cardTransactionSchema),
        defaultValues: {
            description: initialData?.description || "",
            amount: initialData?.amount || 0,
            categoryId: initialData?.categoryId || undefined,
            creditCardId: initialData?.creditCardId || "",
            cardHolderId: initialData?.cardHolderId || undefined,
            installments: initialData?.installments || 1,
            isFixed: initialData?.isFixed ?? false,
            date: initialData?.date ? new Date(initialData.date) : new Date(),
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                description: initialData?.description || "",
                amount: initialData?.amount || 0,
                categoryId: initialData?.categoryId || undefined,
                creditCardId: initialData?.creditCardId || "",
                cardHolderId: initialData?.cardHolderId || undefined,
                installments: initialData?.installments || 1,
                isFixed: initialData?.isFixed ?? false,
                date: initialData?.date ? new Date(initialData.date) : new Date(),
            });
        }
    }, [open, initialData, form]);

    const selectedCardId = form.watch("creditCardId");
    const selectedCard = creditCards.find(card => card.id === selectedCardId);
    const selectedHolders = holdersOf(selectedCard?.holders);

    // Keep the holder valid when the card changes (or when the cards finish loading)
    useEffect(() => {
        if (!open) return;
        const current = form.getValues("cardHolderId");
        const holders = holdersOf(selectedCard?.holders);
        if (!current || !holders.some(holder => holder.id === current)) {
            form.setValue("cardHolderId", mainHolder(holders)?.id);
        }
    }, [open, selectedCardId, creditCards, form, selectedCard]);

    const onSubmit = async (data: CardTransactionData) => {
        setIsSaving(true);
        try {
            const isEditing = !!initialData;
            const url = isEditing
                ? `${API_BASE_URL}/card-transactions/${initialData.id}`
                : `${API_BASE_URL}/card-transactions`;

            const amountValue = data.amount;

            const payload = isEditing ? {
                description: data.description,
                amount: amountValue,
                date: data.date.toISOString(),
                categoryId: data.categoryId || undefined,
                creditCardId: data.creditCardId,
                cardHolderId: data.cardHolderId || undefined,
                isFixed: data.isFixed,
            } : {
                description: data.description,
                amount: amountValue,
                date: data.date.toISOString(),
                installments: data.installments > 1 ? data.installments : undefined,
                categoryId: data.categoryId || undefined,
                creditCardId: data.creditCardId,
                cardHolderId: data.cardHolderId || undefined,
                isFixed: data.isFixed,
            };

            const res = await fetch(url, {
                method: isEditing ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setOpen(false);
                form.reset();
                toast.success(initialData ? "Despesa atualizada com sucesso!" : "Despesa no cartão lançada com sucesso!");
                if (onSuccess) {
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

    const handleDelete = async () => {
        if (!initialData) return;
        setIsSaving(true);
        try {
            const res = await fetch(`${API_BASE_URL}/card-transactions/${initialData.id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                setIsDeleteDialogOpen(false);
                setOpen(false);
                toast.success("Despesa excluída com sucesso!");
                if (onSuccess) {
                    onSuccess();
                } else {
                    window.location.reload();
                }
            } else {
                const error = await res.json();
                toast.error(`Erro ao excluir: ${error.message}`);
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
                    <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-indigo-500" />
                        {initialData ? "Editar Despesa no Cartão" : "Nova Despesa no Cartão"}
                    </DialogTitle>
                    <DialogDescription>
                        Lance uma compra feita em seu cartão. As faturas e parcelas serão calculadas automaticamente.
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
                                        <Input placeholder="Ex: Roupas Renner, Celular..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Valor (R$)</FormLabel>
                                        <FormControl>
                                            <CurrencyInput
                                                placeholder="R$ 0,00"
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
                                name="installments"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Qtd. Parcelas</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    disabled={!!initialData || form.watch('isFixed')}
                                                    className={!!initialData || form.watch('isFixed') ? "bg-gray-100 cursor-not-allowed" : ""}
                                                    {...field}
                                                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 1)}
                                                />
                                                {form.watch('isFixed') && (
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-medium select-none pointer-events-none">
                                                        Fixo
                                                    </div>
                                                )}
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="isFixed"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5 text-left">
                                        <FormLabel className="flex items-center gap-2">
                                            <Repeat className="h-4 w-4 text-indigo-500" />
                                            Conta Fixa Recorrente
                                        </FormLabel>
                                        <p className="text-xs text-muted-foreground mr-4">
                                            Lança automaticamente nas faturas seguintes
                                        </p>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={(val) => {
                                                field.onChange(val);
                                                if (val) form.setValue('installments', 1);
                                            }}
                                        // removido disabled={!!initialData} para permitir edição e exceções
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        {/* Avisos explicativos para edição de contas fixas */}
                        {!!initialData && initialData.isFixed && form.watch('isFixed') && (
                            <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs p-3 rounded-md flex items-start gap-2 -mt-1 shadow-sm">
                                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <p>
                                    <strong>Modificando todas:</strong> Como a chave "Fixo" está ligada, suas edições de valor ou descrição vão alterar esta fatura <strong>e todas as próximas</strong>.<br />
                                    Se deseja alterar apenas neste mês, desligue a chave acima.
                                </p>
                            </div>
                        )}
                        {!!initialData && initialData.isFixed && !form.watch('isFixed') && (
                            <div className="bg-orange-50 border border-orange-200 text-orange-800 text-xs p-3 rounded-md flex items-start gap-2 -mt-1 shadow-sm">
                                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <p>
                                    <strong>Exceção Mensal:</strong> A chave "Fixo" foi desligada. Você está desvinculando esta despesa.
                                    Suas edições afetarão <strong>exclusivamente esta fatura</strong>. As demais continuarão iguais à original.
                                </p>
                            </div>
                        )}

                        <FormField
                            control={form.control}
                            name="creditCardId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cartão de Crédito</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione o Cartão" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {creditCards.map((card) => (
                                                <SelectItem key={card.id} value={card.id}>
                                                    {card.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {selectedHolders.length > 1 && (
                            <FormField
                                control={form.control}
                                name="cardHolderId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Portador</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione o portador" />
                                                </SelectTrigger>
                                            </FormControl>
                                                <SelectContent>
                                                    {selectedHolders.map(holder => (
                                                        <SelectItem key={holder.id} value={holder.id}>
                                                            {holder.name}{holder.last4 ? ` ••${holder.last4}` : ""}{holder.isMain ? " (titular)" : ""}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                )}
                            />
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="categoryId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Categoria</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione" />
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
                                name="date"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Data da Compra</FormLabel>
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
                                                            format(field.value, "dd/MM/yyyy", { locale: ptBR })
                                                        ) : (
                                                            <span>Escolha</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={(date) => { if (date) field.onChange(date) }}
                                                    initialFocus
                                                    locale={ptBR}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex justify-between pt-4">
                            {initialData ? (
                                <Button type="button" variant="destructive" onClick={() => setIsDeleteDialogOpen(true)} disabled={isSaving}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                </Button>
                            ) : (
                                <div></div>
                            )}
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving ? "Salvando..." : (initialData ? "Salvar Alterações" : "Lançar Despesa")}
                                </Button>
                            </div>
                        </div>
                    </form>
                </Form>
            </DialogContent>

            {/* Modal de Confirmação de Exclusão */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso excluirá permanentemente esta despesa.
                            {initialData?.isFixed && " Como esta é uma despesa fixa, uma exceção será criada para ignorar este mês, preservando o histórico original."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white"
                            disabled={isSaving}
                        >
                            {isSaving ? "Excluindo..." : "Sim, excluir"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
}
