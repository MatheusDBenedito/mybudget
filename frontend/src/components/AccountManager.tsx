import { useState, useEffect } from "react";
import { PlusCircle, Building2, Pencil, Trash2 } from "lucide-react";
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

const formatBRL = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
};

type ApiAccount = {
    id: string;
    name: string;
    balance: number;
};

const accountSchema = z.object({
    name: z.string().min(2, "Nome da conta deve ter pelo menos 2 caracteres."),
    balance: z.number({ message: "Insira um valor numérico válido." }),
});

type AccountData = z.infer<typeof accountSchema>;

export function AccountManager() {
    const [accounts, setAccounts] = useState<ApiAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Edit mode
    const [editingAccount, setEditingAccount] = useState<ApiAccount | null>(null);

    // Delete mode
    const [accountToDelete, setAccountToDelete] = useState<{ id: string, name: string } | null>(null);

    const form = useForm<AccountData>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            name: "",
            balance: 0,
        },
    });

    const fetchAccounts = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("http://localhost:3333/accounts");
            if (res.ok) {
                const data = await res.json();
                setAccounts(data);
            }
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
        form.reset({ name: "", balance: 0 });
        setIsDialogOpen(true);
    };

    const openEditDialog = (account: ApiAccount) => {
        setEditingAccount(account);
        form.reset({ name: account.name, balance: account.balance });
        setIsDialogOpen(true);
    };

    const onSubmit = async (data: AccountData) => {
        setIsSaving(true);
        try {
            const url = editingAccount
                ? `http://localhost:3333/accounts/${editingAccount.id}`
                : "http://localhost:3333/accounts";

            const method = editingAccount ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
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
            const res = await fetch(`http://localhost:3333/accounts/${accountToDelete.id}`, {
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
        } catch (error) {
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
                    <p className="text-sm text-gray-500">Cadastre suas contas correntes ou carteiras físicas.</p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openCreateDialog} className="bg-emerald-600 hover:bg-emerald-700">
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
                                <Input id="name" placeholder="Ex: Nubank, Carteira..." {...form.register("name")} />
                                {form.formState.errors.name && (
                                    <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
                                )}
                            </div>

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

                            <DialogFooter className="mt-6">
                                <Button type="submit" className="w-full sm:w-auto" disabled={isSaving}>
                                    {isSaving ? "Salvando..." : "Salvar Conta"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {isLoading ? (
                <div className="p-12 text-center text-gray-400 animate-pulse bg-slate-50 border rounded-lg">
                    Carregando contas...
                </div>
            ) : accounts.length === 0 ? (
                <div className="p-12 text-center text-gray-400 bg-slate-50 border border-dashed rounded-lg">
                    <Building2 className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                    <p>Nenhuma conta cadastrada.</p>
                    <p className="text-sm mt-1">Clique em "Nova Conta" para começar.</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {accounts.map((acc) => (
                        <Card key={acc.id} className="overflow-hidden border-l-4 border-l-indigo-500 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                            <Building2 className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-gray-900">{acc.name}</h4>
                                            <p className="text-sm text-gray-500 mt-1">Saldo Atual</p>
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

                                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                                    <span className="text-2xl font-bold tracking-tight text-gray-900">
                                        {formatBRL(acc.balance)}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Conta</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja apagar a conta "{accountToDelete?.name}"? Esta ação só será permitida se não houver registros vinculados.
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
