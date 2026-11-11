"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Holder = {
    id: string;
    name: string;
    last4?: string | null;
    isMain: boolean;
};

interface CardHoldersModalProps {
    cardId: string;
    cardName: string;
    children: React.ReactNode;
    onChanged?: () => void;
}

const API = "http://localhost:3333";

async function readError(res: Response, fallback: string) {
    try {
        const data = await res.json();
        const message = data?.message;
        return Array.isArray(message) ? message.join(" ") : message || fallback;
    } catch {
        return fallback;
    }
}

/** Manage the titular and supplementary cards of a single credit card. */
export function CardHoldersModal({ cardId, cardName, children, onChanged }: CardHoldersModalProps) {
    const [open, setOpen] = useState(false);
    const [holders, setHolders] = useState<Holder[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [name, setName] = useState("");
    const [last4, setLast4] = useState("");

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editLast4, setEditLast4] = useState("");

    const [pendingDelete, setPendingDelete] = useState<Holder | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API}/credit-cards/${cardId}/holders`);
            if (!res.ok) throw new Error(await readError(res, "Falha ao carregar os portadores."));
            setHolders(await res.json());
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Falha ao carregar os portadores.");
        } finally {
            setIsLoading(false);
        }
    }, [cardId]);

    useEffect(() => {
        if (open) {
            setEditingId(null);
            setName("");
            setLast4("");
            void load();
        }
    }, [open, load]);

    const notifyChange = () => {
        void load();
        onChanged?.();
    };

    const handleCreate = async () => {
        const trimmed = name.trim();
        if (trimmed.length < 2) {
            toast.error("Informe um nome com pelo menos 2 caracteres.");
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch(`${API}/credit-cards/${cardId}/holders`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmed, last4: last4 || undefined }),
            });

            if (!res.ok) throw new Error(await readError(res, "Falha ao adicionar o portador."));

            setName("");
            setLast4("");
            toast.success(`Portador "${trimmed}" adicionado.`);
            notifyChange();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Falha ao adicionar o portador.");
        } finally {
            setIsSaving(false);
        }
    };

    const startEditing = (holder: Holder) => {
        setEditingId(holder.id);
        setEditName(holder.name);
        setEditLast4(holder.last4 ?? "");
    };

    const handleUpdate = async (holder: Holder) => {
        const trimmed = editName.trim();
        if (trimmed.length < 2) {
            toast.error("Informe um nome com pelo menos 2 caracteres.");
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch(`${API}/credit-cards/${cardId}/holders/${holder.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmed, last4: editLast4 || null }),
            });

            if (!res.ok) throw new Error(await readError(res, "Falha ao salvar o portador."));

            setEditingId(null);
            toast.success("Portador atualizado.");
            notifyChange();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Falha ao salvar o portador.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSetMain = async (holder: Holder) => {
        if (holder.isMain) return;

        setIsSaving(true);
        try {
            const res = await fetch(`${API}/credit-cards/${cardId}/holders/${holder.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isMain: true }),
            });

            if (!res.ok) throw new Error(await readError(res, "Falha ao definir o titular."));

            toast.success(`${holder.name} agora é o titular do cartão.`);
            notifyChange();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Falha ao definir o titular.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!pendingDelete) return;

        setIsSaving(true);
        try {
            const res = await fetch(`${API}/credit-cards/${cardId}/holders/${pendingDelete.id}`, {
                method: "DELETE",
            });

            if (!res.ok) throw new Error(await readError(res, "Falha ao excluir o portador."));

            toast.success(`Portador "${pendingDelete.name}" excluído.`);
            setPendingDelete(null);
            notifyChange();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Falha ao excluir o portador.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>{children}</DialogTrigger>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>Portadores do {cardName}</DialogTitle>
                        <DialogDescription>
                            O titular e os adicionais têm lançamentos separados, mas compartilham o mesmo limite e a mesma fatura.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        {isLoading ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">Carregando portadores...</p>
                        ) : (
                            <ul className="space-y-2">
                                {holders.map(holder => (
                                    <li key={holder.id} className="rounded-lg border p-3">
                                        {editingId === holder.id ? (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Input
                                                    value={editName}
                                                    onChange={event => setEditName(event.target.value)}
                                                    aria-label="Nome do portador"
                                                    className="h-8 min-w-[140px] flex-1"
                                                    autoFocus
                                                />
                                                <Input
                                                    value={editLast4}
                                                    onChange={event => setEditLast4(event.target.value.replace(/\D/g, "").slice(0, 4))}
                                                    aria-label="Final do cartão"
                                                    placeholder="Final"
                                                    inputMode="numeric"
                                                    maxLength={4}
                                                    className="h-8 w-20"
                                                />
                                                <Button
                                                    type="button"
                                                    size="icon-sm"
                                                    onClick={() => handleUpdate(holder)}
                                                    disabled={isSaving}
                                                    aria-label={`Salvar ${holder.name}`}
                                                >
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    onClick={() => setEditingId(null)}
                                                    disabled={isSaving}
                                                    aria-label="Cancelar edição"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                                        <span className="truncate">{holder.name}</span>
                                                        {holder.last4 && (
                                                            <span className="text-xs font-normal text-muted-foreground tabular-nums">••{holder.last4}</span>
                                                        )}
                                                        {holder.isMain && (
                                                            <Badge variant="secondary" className="bg-muted text-[11px] font-normal text-muted-foreground">
                                                                Titular
                                                            </Badge>
                                                        )}
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    onClick={() => handleSetMain(holder)}
                                                    disabled={holder.isMain || isSaving}
                                                    aria-label={holder.isMain ? `${holder.name} é o titular` : `Definir ${holder.name} como titular`}
                                                    title={holder.isMain ? "Titular" : "Definir como titular"}
                                                    className="text-muted-foreground"
                                                >
                                                    <Star className={`h-4 w-4 ${holder.isMain ? "fill-amber-400 text-amber-400" : ""}`} />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    onClick={() => startEditing(holder)}
                                                    disabled={isSaving}
                                                    aria-label={`Renomear ${holder.name}`}
                                                    title="Renomear"
                                                    className="text-muted-foreground"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    onClick={() => setPendingDelete(holder)}
                                                    disabled={isSaving}
                                                    aria-label={`Excluir ${holder.name}`}
                                                    title="Excluir"
                                                    className="text-muted-foreground hover:text-negative"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}

                        <div className="rounded-lg border border-dashed p-3">
                            <p className="mb-2 text-xs font-medium text-muted-foreground">Novo portador adicional</p>
                            <div className="flex flex-wrap items-center gap-2">
                                <Input
                                    value={name}
                                    onChange={event => setName(event.target.value)}
                                    placeholder="Nome do portador"
                                    aria-label="Nome do novo portador"
                                    className="h-8 min-w-[140px] flex-1"
                                    onKeyDown={event => event.key === "Enter" && void handleCreate()}
                                />
                                <Input
                                    value={last4}
                                    onChange={event => setLast4(event.target.value.replace(/\D/g, "").slice(0, 4))}
                                    placeholder="Final"
                                    aria-label="Final do cartão adicional"
                                    inputMode="numeric"
                                    maxLength={4}
                                    className="h-8 w-20"
                                />
                                <Button type="button" size="sm" onClick={handleCreate} disabled={isSaving}>
                                    <Plus className="h-4 w-4" />
                                    Adicionar
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!pendingDelete} onOpenChange={value => { if (!value) setPendingDelete(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir portador?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingDelete?.name} será removido deste cartão. Portadores com lançamentos ou o titular não podem ser excluídos.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={event => {
                                event.preventDefault();
                                void handleDelete();
                            }}
                            className="bg-red-600 text-white hover:bg-red-700"
                            disabled={isSaving}
                        >
                            {isSaving ? "Excluindo..." : "Sim, excluir"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
