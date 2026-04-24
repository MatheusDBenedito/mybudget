"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

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

const investmentSchema = z.object({
    name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres."),
    type: z.enum(["FIXED_INCOME", "VARIABLE_INCOME", "CRYPTO", "OTHER"], {
        message: "Selecione um tipo válido."
    }),
    investedAmount: z.number().min(0, "O valor não pode ser negativo."),
    currentValue: z.number().min(0, "O valor não pode ser negativo."),
    cdiPercentage: z.number().optional(),
    investmentDate: z.string().optional(),
    // Variable income fields
    sector: z.string().optional(),
    tickerCode: z.string().optional(),
    averagePrice: z.number().optional(),
    currentPrice: z.number().optional(),
    quantity: z.number().optional(),
}).superRefine((data, ctx) => {
    if (data.type === "FIXED_INCOME") {
        if (!data.investmentDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "A data de aplicação é obrigatória para Renda Fixa.",
                path: ["investmentDate"],
            });
        }
        if (!data.cdiPercentage || data.cdiPercentage <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "A % do CDI é obrigatória para Renda Fixa.",
                path: ["cdiPercentage"],
            });
        }
    }
    if (data.type === "VARIABLE_INCOME" || data.type === "CRYPTO") {
        if (!data.tickerCode || data.tickerCode.trim() === "") {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: data.type === "CRYPTO"
                    ? "O código é obrigatório (ex: BTC, ETH)."
                    : "O código é obrigatório para Renda Variável.",
                path: ["tickerCode"],
            });
        }
        if (!data.averagePrice || data.averagePrice <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "O preço médio é obrigatório.",
                path: ["averagePrice"],
            });
        }

        if (!data.quantity || data.quantity <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "A quantidade é obrigatória.",
                path: ["quantity"],
            });
        }
    }
});

type InvestmentData = z.infer<typeof investmentSchema>;

import { useEffect } from "react";

interface InvestmentModalProps {
    children?: React.ReactNode;
    investmentToEdit?: any; // the API investment object
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onSuccess?: () => void;
}

export function InvestmentModal({ children, investmentToEdit, open: controlledOpen, onOpenChange, onSuccess }: InvestmentModalProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? (onOpenChange || setInternalOpen) : setInternalOpen;

    const form = useForm<InvestmentData>({
        resolver: zodResolver(investmentSchema),
        defaultValues: {
            name: "",
            type: "FIXED_INCOME",
            investedAmount: 0,
            currentValue: 0,
            cdiPercentage: 100,
            investmentDate: new Date().toISOString().split('T')[0],
            sector: "",
            tickerCode: "",
            averagePrice: 0,
            currentPrice: 0,
            quantity: 0,
        },
    });

    useEffect(() => {
        if (open && investmentToEdit) {
            form.reset({
                name: investmentToEdit.name,
                type: investmentToEdit.type as any,
                investedAmount: investmentToEdit.investedAmount,
                currentValue: investmentToEdit.currentValue,
                cdiPercentage: investmentToEdit.cdiPercentage || 100,
                investmentDate: investmentToEdit.investmentDate ? new Date(investmentToEdit.investmentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                sector: investmentToEdit.sector || "",
                tickerCode: investmentToEdit.tickerCode || "",
                averagePrice: investmentToEdit.averagePrice || 0,
                currentPrice: investmentToEdit.currentPrice || 0,
                quantity: investmentToEdit.quantity || 0,
            });
        } else if (open && !investmentToEdit) {
            form.reset({
                name: "",
                type: "FIXED_INCOME",
                investedAmount: 0,
                currentValue: 0,
                cdiPercentage: 100,
                investmentDate: new Date().toISOString().split('T')[0],
                sector: "",
                tickerCode: "",
                averagePrice: 0,
                currentPrice: 0,
                quantity: 0,
            });
        }
    }, [investmentToEdit, open, form]);

    const watchType = form.watch("type");

    const onSubmit = async (data: InvestmentData) => {
        setIsSaving(true);
        try {
            const bodyData: Record<string, unknown> = {
                name: data.name,
                type: data.type,
                investedAmount: Number(data.investedAmount),
                currentValue: Number(data.currentValue),
            };

            if (data.type === "FIXED_INCOME") {
                bodyData.cdiPercentage = Number(data.cdiPercentage);
                bodyData.investmentDate = new Date(data.investmentDate as string).toISOString();
            }

            if (data.type === "VARIABLE_INCOME") {
                bodyData.sector = data.sector || undefined;
                bodyData.tickerCode = data.tickerCode?.toUpperCase();
                bodyData.averagePrice = Number(data.averagePrice);
                bodyData.quantity = Number(data.quantity);
                // Auto-calculate investedAmount from avgPrice * qty
                bodyData.investedAmount = Number(data.averagePrice) * Number(data.quantity);
                bodyData.currentValue = bodyData.investedAmount as number; // Will be overridden by B3 live price
            }

            if (data.type === "CRYPTO") {
                bodyData.sector = data.sector || undefined;
                bodyData.tickerCode = data.tickerCode?.toUpperCase();
                bodyData.averagePrice = Number(data.averagePrice);
                bodyData.quantity = Number(data.quantity);
                bodyData.investedAmount = Number(data.averagePrice) * Number(data.quantity);
                bodyData.currentValue = bodyData.investedAmount as number; // Will be overridden by CoinGecko live price
            }

            const method = investmentToEdit ? "PATCH" : "POST";
            const url = investmentToEdit
                ? `http://localhost:3333/investments/${investmentToEdit.id}`
                : "http://localhost:3333/investments";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyData),
            });

            if (res.ok) {
                setOpen(false);
                form.reset();
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

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {children && (
                <DialogTrigger asChild>
                    {children}
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>{investmentToEdit ? "Editar Investimento" : "Novo Investimento"}</DialogTitle>
                    <DialogDescription>
                        {investmentToEdit ? "Atualize as informações do ativo." : "Cadastre um novo ativo em sua carteira."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome do Ativo</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: Tesouro Selic 2029" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Investimento</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione o tipo" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="FIXED_INCOME">CDB / Renda Fixa</SelectItem>
                                            <SelectItem value="VARIABLE_INCOME">Renda Variável</SelectItem>
                                            <SelectItem value="CRYPTO">Criptomoedas</SelectItem>
                                            <SelectItem value="OTHER">Outros</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* ── FIXED INCOME FIELDS ── */}
                        {watchType === "FIXED_INCOME" && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="investedAmount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Valor Aportado (R$)</FormLabel>
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
                                        name="cdiPercentage"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>% do CDI</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="100"
                                                        value={field.value || ""}
                                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="investmentDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Data de Aplicação</FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </>
                        )}

                        {/* ── VARIABLE INCOME FIELDS ── */}
                        {watchType === "VARIABLE_INCOME" && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="tickerCode"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Código (Ticker)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Ex: PETR4" className="uppercase" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="sector"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Ramo</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Ex: Energia" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="averagePrice"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Preço Médio</FormLabel>
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
                                        name="quantity"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Quantidade</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="0"
                                                        value={field.value || ""}
                                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </>
                        )}

                        {/* ── CRYPTO FIELDS ── */}
                        {watchType === "CRYPTO" && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="tickerCode"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Código (Symbol)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Ex: BTC, ETH, SOL" className="uppercase" {...field} />
                                                </FormControl>
                                                <p className="text-[10px] text-gray-400 mt-0.5">Use a sigla da moeda (BTC, ETH, SOL...)</p>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="sector"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Rede/Detalhe</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Ex: Layer 1" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="averagePrice"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Preço Médio (R$)</FormLabel>
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
                                        name="quantity"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Quantidade</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        step="0.00000001"
                                                        placeholder="0"
                                                        value={field.value || ""}
                                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </>
                        )}

                        {/* ── OTHER FIELDS ── */}
                        {watchType === "OTHER" && (
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="investedAmount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Valor Aportado (R$)</FormLabel>
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
                                    name="currentValue"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Saldo Atual (R$)</FormLabel>
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
                            </div>
                        )}

                        <div className="flex justify-end pt-4">
                            <Button type="button" variant="outline" className="mr-2" onClick={() => setOpen(false)} disabled={isSaving}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isSaving}>
                                {isSaving ? "Salvando..." : "Salvar"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
