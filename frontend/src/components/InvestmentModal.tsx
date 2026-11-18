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
    type: z.enum(["FIXED_INCOME", "VARIABLE_INCOME", "FII", "CRYPTO", "US_STOCK", "OTHER"], {
        message: "Selecione um tipo válido."
    }),
    investedAmount: z.number().min(0, "O valor não pode ser negativo."),
    currentValue: z.number().min(0, "O valor não pode ser negativo."),
    cdiPercentage: z.number().optional(),
    investmentDate: z.string().optional(),
    maturityDate: z.string().optional(),
    // Variable income fields
    sector: z.string().optional(),
    tickerCode: z.string().optional(),
    averagePrice: z.number().optional(),
    currentPrice: z.number().optional(),
    quantity: z.number().optional(),
    purchaseExchangeRate: z.number().optional(),
    accountId: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.type === "FIXED_INCOME") {
        if (!data.investmentDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "A data de aplicação é obrigatória para Renda Fixa.",
                path: ["investmentDate"],
            });
        }
        if (!data.maturityDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "A data de vencimento é obrigatória para Renda Fixa.",
                path: ["maturityDate"],
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
    if (data.type === "US_STOCK" && (!data.purchaseExchangeRate || data.purchaseExchangeRate <= 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Informe a cotação do dólar na compra.",
            path: ["purchaseExchangeRate"],
        });
    }
    if (data.type === "VARIABLE_INCOME" || data.type === "FII" || data.type === "CRYPTO" || data.type === "US_STOCK") {
        if (!data.tickerCode || data.tickerCode.trim() === "") {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: data.type === "CRYPTO"
                    ? "O código é obrigatório (ex: BTC, ETH)."
                    : data.type === "US_STOCK"
                        ? "O código é obrigatório (ex: AAPL, VOO)."
                        : data.type === "FII"
                            ? "O código é obrigatório (ex: HGLG11, MXRF11)."
                            : "O código é obrigatório para Ações.",
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
import type { ApiInvestment } from "@/lib/investments";
import { API_BASE_URL } from "@/lib/auth";

interface InvestmentModalProps {
    children?: React.ReactNode;
    investmentToEdit?: ApiInvestment | null;
    prefillAsset?: Partial<ApiInvestment> | null;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onSuccess?: () => void;
}

export function InvestmentModal({ children, investmentToEdit, prefillAsset, open: controlledOpen, onOpenChange, onSuccess }: InvestmentModalProps) {
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
            maturityDate: "",
            sector: "",
            tickerCode: "",
            averagePrice: 0,
            currentPrice: 0,
            quantity: 0,
            purchaseExchangeRate: 0,
            accountId: "NONE",
        },
    });
    const [isFetchingRate, setIsFetchingRate] = useState(false);
    const [cryptoCurrency, setCryptoCurrency] = useState<"BRL" | "USD">("USD");
    const [liveUsdRate, setLiveUsdRate] = useState<number>(5.64);
    const [accounts, setAccounts] = useState<Array<{ id: string; name: string; currency: string }>>([]);

    useEffect(() => {
        if (!open) return;
        fetch("https://economia.awesomeapi.com.br/last/USD-BRL")
            .then(r => (r.ok ? r.json() : null))
            .then(d => {
                const bid = Number(d?.USDBRL?.bid);
                if (bid > 0) setLiveUsdRate(bid);
            })
            .catch(() => { });
        fetch(`${API_BASE_URL}/accounts`)
            .then(r => (r.ok ? r.json() : []))
            .then(data => {
                if (Array.isArray(data)) {
                    setAccounts(data);
                }
            })
            .catch(() => { });
    }, [open]);

    useEffect(() => {
        if (open && investmentToEdit) {
            const isCryptoUsd = investmentToEdit.type === "CRYPTO" && (
                (investmentToEdit.purchaseExchangeRate != null && investmentToEdit.purchaseExchangeRate > 0) ||
                investmentToEdit.averagePriceUsd != null
            );
            setCryptoCurrency(investmentToEdit.type === "CRYPTO" ? (isCryptoUsd ? "USD" : "BRL") : "USD");
            form.reset({
                name: investmentToEdit.name,
                type: investmentToEdit.type,
                investedAmount: investmentToEdit.investedAmount,
                currentValue: investmentToEdit.currentValue,
                cdiPercentage: investmentToEdit.cdiPercentage || 100,
                investmentDate: investmentToEdit.investmentDate ? new Date(investmentToEdit.investmentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                maturityDate: (investmentToEdit as { maturityDate?: string | null }).maturityDate ? new Date((investmentToEdit as { maturityDate?: string }).maturityDate!).toISOString().split('T')[0] : "",
                sector: investmentToEdit.sector || "",
                tickerCode: investmentToEdit.tickerCode || "",
                averagePrice: isCryptoUsd
                    ? (investmentToEdit.averagePriceUsd ?? investmentToEdit.averagePrice ?? 0)
                    : (investmentToEdit.averagePrice || 0),
                currentPrice: investmentToEdit.currentPrice || 0,
                quantity: investmentToEdit.quantity || 0,
                purchaseExchangeRate: investmentToEdit.purchaseExchangeRate || 0,
                accountId: investmentToEdit.accountId || "NONE",
            });
        } else if (open && !investmentToEdit && prefillAsset) {
            const isCryptoUsd = prefillAsset.type === "CRYPTO" && (
                (prefillAsset.purchaseExchangeRate != null && prefillAsset.purchaseExchangeRate > 0) ||
                prefillAsset.averagePriceUsd != null
            );
            setCryptoCurrency(prefillAsset.type === "CRYPTO" ? (isCryptoUsd ? "USD" : "BRL") : "USD");
            form.reset({
                name: prefillAsset.name || "",
                type: prefillAsset.type || "FIXED_INCOME",
                investedAmount: 0,
                currentValue: 0,
                cdiPercentage: prefillAsset.cdiPercentage || 100,
                investmentDate: new Date().toISOString().split('T')[0],
                maturityDate: "",
                sector: prefillAsset.sector || "",
                tickerCode: prefillAsset.tickerCode || "",
                averagePrice: 0,
                currentPrice: prefillAsset.currentPrice || 0,
                quantity: 0,
                purchaseExchangeRate: prefillAsset.currentExchangeRate || prefillAsset.purchaseExchangeRate || 0,
                accountId: prefillAsset.accountId || "NONE",
            });
        } else if (open && !investmentToEdit) {
            setCryptoCurrency("USD");
            form.reset({
                name: "",
                type: "FIXED_INCOME",
                investedAmount: 0,
                currentValue: 0,
                cdiPercentage: 100,
                investmentDate: new Date().toISOString().split('T')[0],
                maturityDate: "",
                sector: "",
                tickerCode: "",
                averagePrice: 0,
                currentPrice: 0,
                quantity: 0,
                purchaseExchangeRate: 0,
                accountId: "NONE",
            });
        }
    }, [investmentToEdit, prefillAsset, open, form]);

    const watchType = form.watch("type");
    const watchAvgPrice = form.watch("averagePrice") ?? 0;
    const watchQuantity = form.watch("quantity") ?? 0;
    const watchPurchaseRate = form.watch("purchaseExchangeRate") ?? 0;

    const fillCurrentUsdRate = async () => {
        setIsFetchingRate(true);
        try {
            const res = await fetch("https://economia.awesomeapi.com.br/last/USD-BRL");
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const bid = Number(data?.USDBRL?.bid);
            if (!(bid > 0)) throw new Error("cotação inválida");
            form.setValue("purchaseExchangeRate", Number(bid.toFixed(4)), { shouldValidate: true });
        } catch (error) {
            console.error(error);
            toast.error("Não foi possível obter a cotação atual do dólar.");
        } finally {
            setIsFetchingRate(false);
        }
    };

    const onSubmit = async (data: InvestmentData) => {
        setIsSaving(true);
        try {
            const bodyData: Record<string, unknown> = {
                name: data.name,
                type: data.type,
                investedAmount: Number(data.investedAmount),
                currentValue: Number(data.currentValue),
            };

            if (data.investmentDate) {
                bodyData.investmentDate = new Date(data.investmentDate).toISOString();
            }

            if (data.type === "FIXED_INCOME") {
                bodyData.cdiPercentage = Number(data.cdiPercentage);
                if (data.maturityDate) {
                    bodyData.maturityDate = new Date(`${data.maturityDate}T12:00:00.000Z`).toISOString();
                }
            }

            if (data.type === "VARIABLE_INCOME" || data.type === "FII") {
                bodyData.sector = data.sector || (data.type === "FII" ? "FII" : undefined);
                bodyData.tickerCode = data.tickerCode?.toUpperCase();
                bodyData.averagePrice = Number(data.averagePrice);
                bodyData.quantity = Number(data.quantity);
                // Auto-calculate investedAmount from avgPrice * qty
                bodyData.investedAmount = Number(data.averagePrice) * Number(data.quantity);
                bodyData.currentValue = bodyData.investedAmount as number; // Will be overridden by B3 live price
            }

            if (data.type === "CRYPTO") {
                bodyData.sector = data.sector || undefined;
                bodyData.tickerCode = data.tickerCode?.trim().toUpperCase();
                bodyData.averagePrice = Number(data.averagePrice);
                bodyData.quantity = Number(data.quantity);
                if (cryptoCurrency === "USD") {
                    const rate = liveUsdRate > 0 ? liveUsdRate : 5.64;
                    bodyData.purchaseExchangeRate = rate;
                    bodyData.investedAmount = Number(data.averagePrice) * Number(data.quantity) * rate;
                } else {
                    bodyData.purchaseExchangeRate = 0;
                    bodyData.investedAmount = Number(data.averagePrice) * Number(data.quantity);
                }
                bodyData.currentValue = bodyData.investedAmount as number; // Will be overridden by live price
            }

            if (data.type === "US_STOCK") {
                bodyData.sector = data.sector || undefined;
                bodyData.tickerCode = data.tickerCode?.trim().toUpperCase();
                bodyData.averagePrice = Number(data.averagePrice); // USD
                bodyData.quantity = Number(data.quantity);
                bodyData.purchaseExchangeRate = Number(data.purchaseExchangeRate);
                // BRL cost; the backend recomputes it the same way
                bodyData.investedAmount = Number(data.averagePrice) * Number(data.quantity) * Number(data.purchaseExchangeRate);
                bodyData.currentValue = bodyData.investedAmount as number;
            }

            if (data.type === "VARIABLE_INCOME" || data.type === "FII" || data.type === "US_STOCK" || data.type === "CRYPTO") {
                bodyData.accountId = data.accountId && data.accountId !== "NONE" ? data.accountId : null;
            }

            const method = investmentToEdit ? "PATCH" : "POST";
            const url = investmentToEdit
                ? `${API_BASE_URL}/investments/${investmentToEdit.id}`
                : `${API_BASE_URL}/investments`;

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
                    <DialogTitle>
                        {investmentToEdit
                            ? "Editar Aporte"
                            : prefillAsset
                                ? `Novo Aporte — ${prefillAsset.tickerCode || prefillAsset.name}`
                                : "Novo Investimento"}
                    </DialogTitle>
                    <DialogDescription>
                        {investmentToEdit
                            ? "Atualize as informações deste aporte."
                            : prefillAsset
                                ? "Registre um novo aporte para consolidar neste ativo."
                                : "Cadastre um novo ativo ou aporte em sua carteira."}
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
                                            <SelectItem value="VARIABLE_INCOME">Ações (B3)</SelectItem>
                                            <SelectItem value="FII">Fundos Imobiliários (FIIs)</SelectItem>
                                            <SelectItem value="US_STOCK">Ações / ETFs (EUA)</SelectItem>
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
                                <div className="grid grid-cols-2 gap-4">
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
                                    <FormField
                                        control={form.control}
                                        name="maturityDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Data de Vencimento</FormLabel>
                                                <FormControl>
                                                    <Input type="date" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </>
                        )}

                        {/* ── VARIABLE INCOME / FII FIELDS ── */}
                        {(watchType === "VARIABLE_INCOME" || watchType === "FII") && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="tickerCode"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Código (Ticker)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder={watchType === "FII" ? "Ex: HGLG11" : "Ex: PETR4"}
                                                        className="uppercase"
                                                        {...field}
                                                    />
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
                                                <FormLabel>{watchType === "FII" ? "Segmento" : "Ramo"}</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder={watchType === "FII" ? "Ex: Logística, Papel" : "Ex: Energia"}
                                                        {...field}
                                                    />
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
                                                <FormLabel>Preço de Compra / PM</FormLabel>
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
                                <FormField
                                    control={form.control}
                                    name="investmentDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Data do Aporte / Compra</FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
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
                                                    <Input placeholder="Ex: BTC, ETH, 1MBABYDOGE" className="uppercase" {...field} />
                                                </FormControl>
                                                <p className="text-[10px] text-gray-400 mt-0.5">Use a sigla da moeda (BTC, SOL, 1MBABYDOGE...)</p>
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
                                                    <Input placeholder="Ex: Layer 1, Cripto" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-1.5 text-xs">
                                    <span className="text-muted-foreground font-medium">Moeda do Preço de Custo:</span>
                                    <div className="inline-flex rounded-md border bg-background p-0.5">
                                        <button
                                            type="button"
                                            onClick={() => setCryptoCurrency("USD")}
                                            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${cryptoCurrency === "USD"
                                                    ? "bg-primary text-primary-foreground shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground"
                                                }`}
                                        >
                                            US$ (Padrão Binance)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCryptoCurrency("BRL")}
                                            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${cryptoCurrency === "BRL"
                                                    ? "bg-primary text-primary-foreground shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground"
                                                }`}
                                        >
                                            R$ (Reais)
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="averagePrice"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {cryptoCurrency === "USD" ? "Preço de Custo (US$)" : "Preço de Compra / PM (R$)"}
                                                </FormLabel>
                                                <FormControl>
                                                    <CurrencyInput
                                                        prefix={cryptoCurrency === "USD" ? "US$ " : "R$ "}
                                                        decimalScale={10}
                                                        fixedDecimalScale={false}
                                                        placeholder={cryptoCurrency === "USD" ? "US$ 0,0000" : "R$ 0,0000"}
                                                        value={field.value ?? ""}
                                                        onChange={(val) => field.onChange(val ?? 0)}
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
                                                    <CurrencyInput
                                                        prefix=""
                                                        decimalScale={10}
                                                        fixedDecimalScale={false}
                                                        placeholder="0,00000000"
                                                        value={field.value ?? ""}
                                                        onChange={(val) => field.onChange(val ?? 0)}
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
                                            <FormLabel>Data do Aporte / Compra</FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="rounded-md bg-sky-50 border border-sky-100 px-3 py-2 text-xs text-sky-900 flex justify-between">
                                    <span>Total investido</span>
                                    <span className="font-semibold tabular-nums">
                                        {cryptoCurrency === "USD" ? (
                                            <>
                                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(watchAvgPrice * watchQuantity)}
                                                {" ≈ "}
                                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(watchAvgPrice * watchQuantity * liveUsdRate)}
                                            </>
                                        ) : (
                                            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(watchAvgPrice * watchQuantity)
                                        )}
                                    </span>
                                </div>
                            </>
                        )}

                        {/* ── US STOCK / ETF FIELDS ── */}
                        {watchType === "US_STOCK" && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="tickerCode"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Código (Ticker)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Ex: AAPL, VOO" className="uppercase" {...field} />
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
                                                <FormLabel>Ramo / Tipo</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Ex: Tecnologia, ETF S&P 500" {...field} />
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
                                                <FormLabel>Preço Médio (US$)</FormLabel>
                                                <FormControl>
                                                    <CurrencyInput
                                                        prefix="US$ "
                                                        decimalScale={6}
                                                        fixedDecimalScale={false}
                                                        placeholder="US$ 0,00"
                                                        value={field.value ?? ""}
                                                        onChange={(val) => field.onChange(val ?? 0)}
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
                                                    <CurrencyInput
                                                        prefix=""
                                                        decimalScale={8}
                                                        fixedDecimalScale={false}
                                                        placeholder="0,000000"
                                                        value={field.value ?? ""}
                                                        onChange={(val) => field.onChange(val ?? 0)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="purchaseExchangeRate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Dólar na Compra (R$)</FormLabel>
                                                <FormControl>
                                                    <CurrencyInput
                                                        decimalScale={4}
                                                        placeholder="R$ 0,0000"
                                                        value={field.value || ""}
                                                        onChange={(val) => field.onChange(val || 0)}
                                                    />
                                                </FormControl>
                                                <button
                                                    type="button"
                                                    onClick={fillCurrentUsdRate}
                                                    disabled={isFetchingRate}
                                                    className="text-[11px] text-emerald-700 hover:underline disabled:opacity-50 text-left"
                                                >
                                                    {isFetchingRate ? "Buscando cotação..." : "Usar cotação de hoje"}
                                                </button>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="investmentDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Data da Compra</FormLabel>
                                                <FormControl>
                                                    <Input type="date" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="rounded-md bg-sky-50 border border-sky-100 px-3 py-2 text-xs text-sky-900 flex justify-between">
                                    <span>Total investido</span>
                                    <span className="font-semibold tabular-nums">
                                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(watchAvgPrice * watchQuantity)}
                                        {" = "}
                                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(watchAvgPrice * watchQuantity * watchPurchaseRate)}
                                    </span>
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

                        {(watchType === "VARIABLE_INCOME" || watchType === "FII" || watchType === "US_STOCK" || watchType === "CRYPTO") && (
                            <FormField
                                control={form.control}
                                name="accountId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Conta para proventos (opcional)</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value || "NONE"}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione uma conta" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="NONE">Sem conta vinculada</SelectItem>
                                                {accounts.map((acc) => (
                                                    <SelectItem key={acc.id} value={acc.id}>
                                                        {acc.name} ({acc.currency})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[11px] text-muted-foreground">
                                            Proventos recebidos a partir de hoje serão creditados automaticamente nesta conta.
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <div className="flex justify-end pt-4">
                            <Button type="button" variant="outline" className="mr-2" onClick={() => setOpen(false)} disabled={isSaving}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? "Salvando..." : "Salvar"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
