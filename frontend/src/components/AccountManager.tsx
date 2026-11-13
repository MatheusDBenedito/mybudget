import { Money } from "@/components/Money";
import { useState, useEffect } from "react";
import { PlusCircle, Building2, Pencil, Trash2, ArrowLeftRight, ArrowRight, Undo2, DollarSign } from "lucide-react";
import { TransferDialog } from "@/components/TransferDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
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
import { CurrencyInput } from "@/components/ui/currency-input";
import {
    type AccountType,
    type AccountCurrency,
    ACCOUNT_TYPE_LABELS,
    ACCOUNT_CURRENCY_LABELS,
    isYielding,
    isUsdAccount,
    computeUsdAccountMetrics,
    yieldLabel,
} from "@/lib/accounts";
import { type ApiPot, YieldPots } from "@/components/YieldPots";
import { API_BASE_URL } from "@/lib/auth";

const formatBRL = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
};

const formatUSD = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "USD",
    }).format(value);
};

const formatRate = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    }).format(value);
};

type ApiAccount = {
    id: string;
    name: string;
    balance: number;
    currency?: AccountCurrency;
    balanceUsd?: number | null;
    investedBrl?: number | null;
    purchaseExchangeRate?: number | null;
    currentExchangeRate?: number | null;
    variationBrl?: number;
    variationPct?: number;
    type: AccountType;
    cdiPercentage: number | null;
    hasIof?: boolean;
    /** Net yield credited this month (yielding accounts) */
    monthYield?: number;
    /** Balance outside the cofrinhos */
    freeBalance?: number;
    freeMonthYield?: number;
    pots?: ApiPot[];
};

const accountSchema = z.object({
    name: z.string().trim().min(2, "Nome da conta deve ter pelo menos 2 caracteres."),
    currency: z.enum(["BRL", "USD"]),
    balance: z.number({ message: "Insira um valor numérico válido." }),
    balanceUsd: z.number().optional(),
    investedBrl: z.number().optional(),
    purchaseExchangeRate: z.number().optional(),
    type: z.enum(["CHECKING", "YIELDING"]),
    cdiPercentage: z.number().optional(),
    hasIof: z.boolean().optional(),
}).superRefine((data, ctx) => {
    if (data.currency === "BRL" && data.type === "YIELDING" && !(data.cdiPercentage && data.cdiPercentage > 0)) {
        ctx.addIssue({ code: "custom", message: "Informe quanto a conta rende (% do CDI).", path: ["cdiPercentage"] });
    }
    if (data.currency === "USD") {
        if (data.balanceUsd === undefined || data.balanceUsd < 0) {
            ctx.addIssue({ code: "custom", message: "Informe o saldo em dólar (US$).", path: ["balanceUsd"] });
        }
        if ((data.balanceUsd ?? 0) > 0 && !(data.investedBrl && data.investedBrl > 0) && !(data.purchaseExchangeRate && data.purchaseExchangeRate > 0)) {
            ctx.addIssue({
                code: "custom",
                message: "Informe quanto foi gasto em Reais (R$) ou a cotação do dólar no momento da compra.",
                path: ["investedBrl"],
            });
        }
    }
});

type AccountData = z.infer<typeof accountSchema>;

type ApiTransfer = {
    id: string;
    amount: number;
    date: string;
    description: string | null;
    fromAccount: { id: string; name: string };
    toAccount: { id: string; name: string };
};

export function AccountManager() {
    const [accounts, setAccounts] = useState<ApiAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Edit mode
    const [editingAccount, setEditingAccount] = useState<ApiAccount | null>(null);

    // Delete mode
    const [accountToDelete, setAccountToDelete] = useState<{ id: string, name: string } | null>(null);

    const [transfers, setTransfers] = useState<ApiTransfer[]>([]);
    const [transferToUndo, setTransferToUndo] = useState<ApiTransfer | null>(null);

    const undoTransfer = async () => {
        if (!transferToUndo) return;
        try {
            const res = await fetch(`${API_BASE_URL}/accounts/transfers/${transferToUndo.id}`, { method: "DELETE" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message ?? "Erro ao desfazer.");
            }
            await fetchAccounts(true);
            toast.success("Transferência desfeita: o valor voltou para a conta de origem.");
        } catch (error) {
            toast.error((error as Error).message);
        } finally {
            setTransferToUndo(null);
        }
    };

    const form = useForm<AccountData>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            name: "",
            currency: "BRL",
            balance: 0,
            balanceUsd: undefined,
            investedBrl: undefined,
            purchaseExchangeRate: undefined,
            type: "CHECKING",
            cdiPercentage: undefined,
            hasIof: false,
        },
    });
    const watchType = form.watch("type");
    const watchCurrency = form.watch("currency");
    const watchBalanceUsd = form.watch("balanceUsd");
    const watchInvestedBrl = form.watch("investedBrl");
    const watchPurchaseRate = form.watch("purchaseExchangeRate");

    const fetchAccounts = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const [res, transfersRes] = await Promise.all([
                fetch(`${API_BASE_URL}/accounts`),
                fetch(`${API_BASE_URL}/accounts/transfers`),
            ]);
            if (res.ok) {
                const data = await res.json();
                setAccounts(data);
            }
            if (transfersRes.ok) setTransfers(await transfersRes.json());
        } catch (error) {
            console.error("Failed to fetch accounts:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const openCreateDialog = () => {
        setEditingAccount(null);
        form.reset({
            name: "",
            currency: "BRL",
            balance: 0,
            balanceUsd: undefined,
            investedBrl: undefined,
            purchaseExchangeRate: undefined,
            type: "CHECKING",
            cdiPercentage: undefined,
            hasIof: false,
        });
        setIsDialogOpen(true);
    };

    const openEditDialog = (account: ApiAccount) => {
        setEditingAccount(account);
        form.reset({
            name: account.name.trim(),
            currency: account.currency ?? "BRL",
            balance: account.balance,
            balanceUsd: account.balanceUsd ?? undefined,
            investedBrl: account.investedBrl ?? undefined,
            purchaseExchangeRate: account.purchaseExchangeRate ?? undefined,
            type: account.type ?? "CHECKING",
            cdiPercentage: account.cdiPercentage ?? undefined,
            hasIof: account.hasIof ?? false,
        });
        setIsDialogOpen(true);
    };

    const onSubmit = async (data: AccountData) => {
        setIsSaving(true);
        try {
            const url = editingAccount
                ? `${API_BASE_URL}/accounts/${editingAccount.id}`
                : `${API_BASE_URL}/accounts`;

            const method = editingAccount ? "PATCH" : "POST";

            const isUsd = data.currency === "USD";
            const payload = isUsd
                ? {
                    name: data.name,
                    currency: "USD",
                    balanceUsd: data.balanceUsd ?? 0,
                    investedBrl: data.investedBrl ?? null,
                    purchaseExchangeRate: data.purchaseExchangeRate ?? null,
                    type: "CHECKING",
                    cdiPercentage: null,
                }
                : {
                    name: data.name,
                    currency: "BRL",
                    balance: data.balance,
                    balanceUsd: null,
                    investedBrl: null,
                    purchaseExchangeRate: null,
                    type: data.type,
                    cdiPercentage: data.type === "YIELDING" ? data.cdiPercentage : null,
                    hasIof: data.type === "YIELDING" ? Boolean(data.hasIof) : false,
                };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                await fetchAccounts();
                setIsDialogOpen(false);
                toast.success(editingAccount ? "Conta atualizada!" : "Conta criada com sucesso!");
            } else {
                const err = await res.json();
                toast.error(`Erro: ${err.message}`);
            }
        } catch (error) {
            console.error("Upload failed", error);
            toast.error("Erro de conexão.");
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!accountToDelete) return;

        try {
            const res = await fetch(`${API_BASE_URL}/accounts/${accountToDelete.id}`, {
                method: "DELETE"
            });

            if (res.ok) {
                await fetchAccounts();
                toast.success("Conta apagada com sucesso!");
            } else {
                const err = await res.json();

                if (err.message && err.message.includes("associated credit cards")) {
                    toast.error("Não é possível excluir esta conta: existem cartões de crédito vinculados a ela.");
                } else if (err.message && err.message.includes("associated transactions")) {
                    toast.error("Não é possível excluir esta conta: existem movimentações financeiras vinculadas a ela.");
                } else {
                    toast.error(`Erro: ${err.message}`);
                }
            }
        } catch {
            toast.error("Erro de conexão.");
        } finally {
            setAccountToDelete(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">Suas Contas</h3>
                    <p className="text-sm text-gray-500">Cadastre suas contas correntes, remuneradas ou contas em dólar.</p>
                </div>

                <div className="flex gap-2">
                <TransferDialog accounts={accounts} onSuccess={() => fetchAccounts(true)}>
                    <Button variant="outline" disabled={accounts.length < 2}>
                        <ArrowLeftRight className="mr-2 h-4 w-4" />
                        Transferir
                    </Button>
                </TransferDialog>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openCreateDialog}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Nova Conta
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingAccount ? "Editar Conta" : "Adicionar Nova Conta"}</DialogTitle>
                            <DialogDescription>
                                Preencha as informações para acompanhar o saldo no painel principal.
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nome da Instituição/Conta</Label>
                                <Input id="name" placeholder="Ex: Nubank, Nomad, Avenue, Carteira..." {...form.register("name")} />
                                {form.formState.errors.name && (
                                    <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
                                )}
                            </div>

                            <fieldset className="space-y-2">
                                <legend className="mb-2 text-sm font-medium">Moeda da conta</legend>
                                <Controller
                                    control={form.control}
                                    name="currency"
                                    render={({ field }) => (
                                        <div className="grid grid-cols-2 gap-2">
                                            {(["BRL", "USD"] as const).map(option => (
                                                <label
                                                    key={option}
                                                    className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring ${field.value === option ? "border-foreground bg-muted/50" : "hover:bg-muted/40"}`}
                                                >
                                                    <span className="flex items-center gap-2 font-medium">
                                                        <input
                                                            type="radio"
                                                            name="account-currency"
                                                            value={option}
                                                            checked={field.value === option}
                                                            onChange={() => field.onChange(option)}
                                                            className="h-4 w-4 accent-foreground"
                                                        />
                                                        {ACCOUNT_CURRENCY_LABELS[option]}
                                                    </span>
                                                    <span className="pl-6 text-xs text-muted-foreground">
                                                        {option === "BRL"
                                                            ? "Saldo nacional em Reais (R$)."
                                                            : "Flutua com o dólar hoje + histórico da compra."}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                />
                            </fieldset>

                            {watchCurrency === "USD" ? (
                                <div className="space-y-4 rounded-lg border bg-muted/20 p-3.5">
                                    <div className="space-y-2">
                                        <Label htmlFor="balanceUsd">Saldo em Dólar (US$)</Label>
                                        <Controller
                                            control={form.control}
                                            name="balanceUsd"
                                            render={({ field }) => (
                                                <CurrencyInput
                                                    id="balanceUsd"
                                                    prefix="US$ "
                                                    placeholder="US$ 0,00"
                                                    value={field.value ?? ""}
                                                    onChange={(val) => {
                                                        const usd = val ?? 0;
                                                        field.onChange(usd);
                                                        const rate = form.getValues("purchaseExchangeRate");
                                                        const invested = form.getValues("investedBrl");
                                                        if (usd > 0 && rate && rate > 0) {
                                                            form.setValue("investedBrl", Math.round(usd * rate * 100) / 100);
                                                        } else if (usd > 0 && invested && invested > 0) {
                                                            form.setValue("purchaseExchangeRate", Math.round((invested / usd) * 10000) / 10000);
                                                        }
                                                    }}
                                                />
                                            )}
                                        />
                                        {form.formState.errors.balanceUsd && (
                                            <p className="text-xs text-red-500">{form.formState.errors.balanceUsd.message}</p>
                                        )}
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="investedBrl">Quanto foi gasto na compra (R$)</Label>
                                            <Controller
                                                control={form.control}
                                                name="investedBrl"
                                                render={({ field }) => (
                                                    <CurrencyInput
                                                        id="investedBrl"
                                                        prefix="R$ "
                                                        placeholder="R$ 0,00"
                                                        value={field.value ?? ""}
                                                        onChange={(val) => {
                                                            field.onChange(val);
                                                            const usd = form.getValues("balanceUsd") ?? 0;
                                                            if (val && val > 0 && usd > 0) {
                                                                form.setValue(
                                                                    "purchaseExchangeRate",
                                                                    Math.round((val / usd) * 10000) / 10000,
                                                                );
                                                            }
                                                        }}
                                                    />
                                                )}
                                            />
                                            <p className="text-[11px] text-muted-foreground">
                                                Valor total desembolsado em reais no momento da compra.
                                            </p>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="purchaseExchangeRate">Cotação na compra (R$ / US$)</Label>
                                            <Controller
                                                control={form.control}
                                                name="purchaseExchangeRate"
                                                render={({ field }) => (
                                                    <CurrencyInput
                                                        id="purchaseExchangeRate"
                                                        prefix="R$ "
                                                        decimalScale={4}
                                                        placeholder="R$ 5,7500"
                                                        value={field.value ?? ""}
                                                        onChange={(val) => {
                                                            field.onChange(val);
                                                            const usd = form.getValues("balanceUsd") ?? 0;
                                                            if (val && val > 0 && usd > 0) {
                                                                form.setValue(
                                                                    "investedBrl",
                                                                    Math.round(usd * val * 100) / 100,
                                                                );
                                                            }
                                                        }}
                                                    />
                                                )}
                                            />
                                            <p className="text-[11px] text-muted-foreground">
                                                Câmbio pago por US$ 1,00 quando comprou o dólar.
                                            </p>
                                        </div>
                                    </div>

                                    {form.formState.errors.investedBrl && (
                                        <p className="text-xs text-red-500">{form.formState.errors.investedBrl.message}</p>
                                    )}

                                    {(watchBalanceUsd ?? 0) > 0 && ((watchInvestedBrl ?? 0) > 0 || (watchPurchaseRate ?? 0) > 0) && (
                                        <div className="rounded-md bg-card px-3 py-2 text-xs text-muted-foreground border">
                                            Custo registrado na compra:{" "}
                                            <span className="font-semibold text-foreground">
                                                {formatBRL(watchInvestedBrl ?? ((watchBalanceUsd ?? 0) * (watchPurchaseRate ?? 0)))}
                                            </span>{" "}
                                            ({formatUSD(watchBalanceUsd ?? 0)} a{" "}
                                            {formatRate(watchPurchaseRate ?? ((watchInvestedBrl ?? 0) / (watchBalanceUsd || 1)))}/US$).
                                            O saldo em reais será atualizado automaticamente com o dólar de hoje.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="balance">Saldo Atual / Inicial</Label>
                                        <Controller
                                            control={form.control}
                                            name="balance"
                                            render={({ field }) => (
                                                <CurrencyInput
                                                    id="balance"
                                                    placeholder="R$ 0,00"
                                                    value={field.value ?? ""}
                                                    onChange={(val) => field.onChange(val ?? 0)}
                                                />
                                            )}
                                        />
                                        {form.formState.errors.balance && (
                                            <p className="text-xs text-red-500">{form.formState.errors.balance.message}</p>
                                        )}
                                        <p className="text-xs text-gray-500">Você pode ajustar o saldo inicial para bater com sua conta de banco real.</p>
                                    </div>

                                    <fieldset className="space-y-2">
                                        <legend className="mb-2 text-sm font-medium">Tipo de conta</legend>
                                        <Controller
                                            control={form.control}
                                            name="type"
                                            render={({ field }) => (
                                                <div className="grid grid-cols-2 gap-2">
                                                    {(["CHECKING", "YIELDING"] as const).map(option => (
                                                        <label
                                                            key={option}
                                                            className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring ${field.value === option ? "border-foreground bg-muted/50" : "hover:bg-muted/40"}`}
                                                        >
                                                            <span className="flex items-center gap-2 font-medium">
                                                                <input
                                                                    type="radio"
                                                                    name="account-type"
                                                                    value={option}
                                                                    checked={field.value === option}
                                                                    onChange={() => field.onChange(option)}
                                                                    className="h-4 w-4 accent-foreground"
                                                                />
                                                                {ACCOUNT_TYPE_LABELS[option]}
                                                            </span>
                                                            <span className="pl-6 text-xs text-muted-foreground">
                                                                {option === "CHECKING" ? "Não rende. Usada primeiro nos pagamentos." : "Rende um % do CDI (ex: Mercado Pago)."}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        />
                                    </fieldset>

                                    {watchType === "YIELDING" && (
                                        <>
                                            <div className="space-y-2">
                                                <Label htmlFor="cdiPercentage">Rendimento (% do CDI)</Label>
                                                <Controller
                                                    control={form.control}
                                                    name="cdiPercentage"
                                                    render={({ field }) => (
                                                        <Input
                                                            id="cdiPercentage"
                                                            type="number"
                                                            inputMode="decimal"
                                                            min={0}
                                                            step="0.5"
                                                            placeholder="Ex: 100"
                                                            value={field.value ?? ""}
                                                            onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                                                        />
                                                    )}
                                                />
                                                {form.formState.errors.cdiPercentage && (
                                                    <p className="text-xs text-red-500">{form.formState.errors.cdiPercentage.message}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
                                                <div className="flex items-center justify-between">
                                                    <div className="space-y-0.5">
                                                        <Label htmlFor="hasIof" className="text-sm font-medium">Cobrança de IOF</Label>
                                                        <p className="text-xs text-muted-foreground">
                                                            Incide IOF regressivo sobre os rendimentos nos primeiros 30 dias?
                                                        </p>
                                                    </div>
                                                    <Controller
                                                        control={form.control}
                                                        name="hasIof"
                                                        render={({ field }) => (
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    role="switch"
                                                                    aria-checked={field.value ?? false}
                                                                    onClick={() => field.onChange(!field.value)}
                                                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${field.value ? "bg-primary" : "bg-muted"}`}
                                                                >
                                                                    <span
                                                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${field.value ? "translate-x-5" : "translate-x-0"}`}
                                                                    />
                                                                </button>
                                                                <span className="text-xs font-semibold w-8">
                                                                    {field.value ? "Sim" : "Não"}
                                                                </span>
                                                            </div>
                                                        )}
                                                    />
                                                </div>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {form.watch("hasIof")
                                                        ? "Tabela regressiva de IOF aplicada de 96% no dia 1 a 0% no dia 30."
                                                        : "Isento de IOF (0% em qualquer prazo, como no Mercado Pago)."}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}

                            <DialogFooter className="mt-6">
                                <Button type="submit" className="w-full sm:w-auto" disabled={isSaving}>
                                    {isSaving ? "Salvando..." : "Salvar Conta"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
                </div>
            </div>

            {isLoading ? (
                <div className="p-12 text-center text-gray-400 animate-pulse bg-slate-50 border rounded-lg">
                    Carregando contas...
                </div>
            ) : accounts.length === 0 ? (
                <div className="p-12 text-center text-gray-400 bg-slate-50 border border-dashed rounded-lg">
                    <Building2 className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                    <p>Nenhuma conta cadastrada.</p>
                    <p className="text-sm mt-1">Clique em &ldquo;Nova Conta&rdquo; para começar.</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {accounts.map((acc) => {
                        const usd = isUsdAccount(acc);
                        const usdMetrics = usd
                            ? computeUsdAccountMetrics({
                                balanceUsd: acc.balanceUsd,
                                investedBrl: acc.investedBrl,
                                purchaseExchangeRate: acc.purchaseExchangeRate,
                                currentExchangeRate: acc.currentExchangeRate,
                                fallbackBalanceBrl: acc.balance,
                            })
                            : null;

                        return (
                            <Card key={acc.id} className="overflow-hidden border-l-4 border-l-indigo-500 hover:shadow-md transition-shadow">
                                <CardContent className="p-5">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                                {usd ? <DollarSign className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-gray-900">{acc.name}</h4>
                                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                    {usd ? (
                                                        <>
                                                            <span className="inline-block rounded bg-blue-500/15 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-300">
                                                                Conta em Dólar (US$)
                                                            </span>
                                                            {usdMetrics?.currentExchangeRate && (
                                                                <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                                                                    Dólar hoje: {formatRate(usdMetrics.currentExchangeRate)}
                                                                </span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${isYielding(acc) ? "bg-positive-soft text-positive" : "bg-muted text-muted-foreground"}`}>
                                                            {isYielding(acc) ? yieldLabel(acc) : ACCOUNT_TYPE_LABELS.CHECKING}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-1 text-gray-400">
                                            <button onClick={() => openEditDialog(acc)} className="p-1.5 hover:bg-gray-100 rounded-md hover:text-indigo-600 transition-colors" title="Editar">
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button onClick={() => setAccountToDelete({ id: acc.id, name: acc.name })} className="p-1.5 hover:bg-red-50 rounded-md hover:text-red-600 transition-colors" title="Excluir">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-baseline justify-between gap-2">
                                        <div className="flex flex-wrap items-baseline gap-2">
                                            <span className="text-2xl font-bold tracking-tight text-gray-900 tabular-nums">
                                                <Money value={acc.balance} />
                                            </span>
                                            {usd && usdMetrics && (
                                                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-foreground tabular-nums">
                                                    <Money value={usdMetrics.balanceUsd} format={formatUSD} />
                                                </span>
                                            )}
                                        </div>
                                        {isYielding(acc) && (
                                            <span className="text-xs text-muted-foreground" title="Rendimento líquido (já descontado o IR) creditado diariamente neste mês">
                                                Rendeu <span className="font-medium text-positive tabular-nums">+<Money value={acc.monthYield ?? 0} /></span> no mês
                                            </span>
                                        )}
                                    </div>

                                    {usd && usdMetrics && (
                                        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-2.5 text-xs">
                                            <div>
                                                <div className="text-muted-foreground">Gasto na compra</div>
                                                <div className="mt-0.5 font-semibold text-foreground tabular-nums">
                                                    <Money value={usdMetrics.investedBrl} />
                                                </div>
                                                {usdMetrics.purchaseExchangeRate && (
                                                    <div className="text-[11px] text-muted-foreground tabular-nums">
                                                        a {formatRate(usdMetrics.purchaseExchangeRate)}/US$
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground">Valor hoje (BRL)</div>
                                                <div className="mt-0.5 font-semibold text-foreground tabular-nums">
                                                    <Money value={usdMetrics.currentBalanceBrl} />
                                                </div>
                                                {usdMetrics.currentExchangeRate && (
                                                    <div className="text-[11px] text-muted-foreground tabular-nums">
                                                        a {formatRate(usdMetrics.currentExchangeRate)}/US$
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <div className="text-muted-foreground">Variação cambial</div>
                                                <div className={`mt-0.5 font-semibold tabular-nums ${usdMetrics.variationBrl >= 0 ? "text-positive" : "text-negative"}`}>
                                                    {usdMetrics.variationBrl >= 0 ? "+" : ""}
                                                    <Money value={usdMetrics.variationBrl} />
                                                </div>
                                                <div className={`text-[11px] font-medium tabular-nums ${usdMetrics.variationPct >= 0 ? "text-positive" : "text-negative"}`}>
                                                    ({usdMetrics.variationPct >= 0 ? "+" : ""}{usdMetrics.variationPct.toFixed(2).replace(".", ",")}%)
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {isYielding(acc) && (
                                        <>
                                            <p className="mt-1 text-[11px] text-muted-foreground">Rendimento líquido creditado a cada dia útil.</p>
                                            <YieldPots account={acc} onChanged={() => fetchAccounts(true)} />
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {transfers.length > 0 && (
                <section aria-labelledby="transfers-title" className="space-y-2">
                    <h4 id="transfers-title" className="text-sm font-medium text-gray-900">Transferências recentes</h4>
                    <ul className="divide-y rounded-lg border bg-card">
                        {transfers.map(t => (
                            <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                                <div className="min-w-0">
                                    <p className="flex flex-wrap items-center gap-1.5 font-medium">
                                        {t.fromAccount.name.trim()}
                                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-label="para" />
                                        {t.toAccount.name.trim()}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(t.date).toLocaleDateString("pt-BR")}{t.description ? ` · ${t.description}` : ""}
                                    </p>
                                </div>
                                <div className="ml-auto flex items-center gap-2">
                                    <span className="font-medium tabular-nums"><Money value={t.amount} /></span>
                                    <button
                                        type="button"
                                        onClick={() => setTransferToUndo(t)}
                                        className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-600"
                                        title="Desfazer"
                                        aria-label={`Desfazer transferência de ${formatBRL(t.amount)}`}
                                    >
                                        <Undo2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <AlertDialog open={!!transferToUndo} onOpenChange={(open) => !open && setTransferToUndo(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Desfazer transferência</AlertDialogTitle>
                        <AlertDialogDescription>
                            {transferToUndo && <><Money value={transferToUndo.amount} /> voltam de {transferToUndo.toAccount.name.trim()} para {transferToUndo.fromAccount.name.trim()}.</>}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={undoTransfer}>Desfazer</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Conta</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja apagar a conta &ldquo;{accountToDelete?.name}&rdquo;? Esta ação só será permitida se não houver registros vinculados.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">Excluir Conta</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
