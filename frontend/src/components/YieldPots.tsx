import { Money } from "@/components/Money";
import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, PiggyBank, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";

const API = "http://localhost:3333/accounts";

const formatPct = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const formatDate = (key: string) => key.split("-").reverse().join("/");

export type ApiPot = { id: string; name: string; cdiPercentage: number; balance: number; monthYield?: number; createdAt?: string };

/** Today as yyyy-mm-dd (local), used as default and maximum for the date fields. */
const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const localKey = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export type PotsAccount = {
    id: string;
    cdiPercentage: number | null;
    freeBalance?: number;
    freeMonthYield?: number;
    pots?: ApiPot[];
};

type Lot = { date: string; principal: number; value: number; ageDays: number; irRate: number };
type BucketLots = { bucket: string; name: string; cdiPercentage: number; lots: Lot[] };

type PotForm = { mode: "create" } | { mode: "edit"; pot: ApiPot };
type MoveForm = { kind: "deposit" | "withdraw"; pot: ApiPot };

async function send(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const message = Array.isArray(err.message) ? err.message.join(", ") : err.message;
        throw new Error(message ?? "Erro ao salvar.");
    }
    return res.json();
}

/** Free balance and cofrinhos of a yielding account, with guardar/retirar and the deposits (IR lots). */
export function YieldPots({ account, onChanged }: { account: PotsAccount; onChanged: () => Promise<void> | void }) {
    const pots = account.pots ?? [];
    const free = account.freeBalance ?? 0;

    const [potForm, setPotForm] = useState<PotForm | null>(null);
    const [potName, setPotName] = useState("");
    const [potRate, setPotRate] = useState<number | undefined>(undefined);
    const [potInitial, setPotInitial] = useState<number | undefined>(undefined);
    const [potDate, setPotDate] = useState(todayKey());
    const [potAppBalance, setPotAppBalance] = useState<number | undefined>(undefined);

    const [move, setMove] = useState<MoveForm | null>(null);
    const [moveAmount, setMoveAmount] = useState<number | undefined>(undefined);
    const [moveDate, setMoveDate] = useState(todayKey());

    const [potToDelete, setPotToDelete] = useState<ApiPot | null>(null);

    const [freeOpen, setFreeOpen] = useState(false);
    const [freeValue, setFreeValue] = useState<number | undefined>(undefined);
    const openFree = () => {
        setFreeValue(free);
        setFreeOpen(true);
    };
    const saveFree = (value: number | undefined) => {
        if (value === undefined || value < 0) return toast.error("Informe o saldo livre.");
        return run(
            () => send(`${API}/${account.id}/free-balance`, "PATCH", { balance: value }),
            value === 0 ? "Saldo livre zerado!" : "Saldo livre atualizado!",
            () => setFreeOpen(false),
        );
    };
    const [saving, setSaving] = useState(false);

    const [lots, setLots] = useState<BucketLots[] | null>(null);
    const [lotsOpen, setLotsOpen] = useState(false);

    const refresh = async () => {
        await onChanged();
        if (lotsOpen) await loadLots();
    };

    const loadLots = async () => {
        try {
            const res = await fetch(`${API}/${account.id}/lots`);
            if (res.ok) setLots(await res.json());
        } catch {
            toast.error("Erro ao carregar os depósitos.");
        }
    };

    const toggleLots = async () => {
        const next = !lotsOpen;
        setLotsOpen(next);
        if (next) await loadLots();
    };

    const openCreate = () => {
        setPotName("");
        setPotRate(account.cdiPercentage ?? 100);
        setPotInitial(undefined);
        setPotDate(todayKey());
        setPotForm({ mode: "create" });
    };

    const openEdit = (pot: ApiPot) => {
        setPotName(pot.name);
        setPotRate(pot.cdiPercentage);
        setPotAppBalance(pot.balance);
        setPotForm({ mode: "edit", pot });
    };

    const openMove = (kind: MoveForm["kind"], pot: ApiPot) => {
        setMoveAmount(undefined);
        setMoveDate(todayKey());
        setMove({ kind, pot });
    };

    const run = async (action: () => Promise<unknown>, success: string, close: () => void) => {
        setSaving(true);
        try {
            await action();
            close();
            await refresh();
            toast.success(success);
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const savePot = () => {
        if (!potForm) return;
        if (potName.trim().length < 2) return toast.error("Dê um nome ao cofrinho.");
        if (!(potRate && potRate > 0)) return toast.error("Informe o % do CDI do cofrinho.");
        if (potForm.mode === "create") {
            return run(
                () => send(`${API}/${account.id}/pots`, "POST", { name: potName, cdiPercentage: potRate, initialAmount: potInitial ?? 0, date: potDate }),
                potDate < todayKey() ? "Cofrinho criado! Rendimentos recalculados desde a data informada." : "Cofrinho criado!",
                () => setPotForm(null),
            );
        }
        const pot = potForm.pot;
        const adjust = potAppBalance !== undefined && Math.abs(potAppBalance - pot.balance) >= 0.005;
        return run(
            async () => {
                await send(`${API}/pots/${pot.id}`, "PATCH", { name: potName, cdiPercentage: potRate });
                // After a rate change the yields are recalculated; the app balance is applied on top of that
                if (adjust) await send(`${API}/pots/${pot.id}/adjust`, "POST", { balance: potAppBalance });
            },
            adjust ? "Cofrinho atualizado e saldo igualado ao app!" : "Cofrinho atualizado!",
            () => setPotForm(null),
        );
    };

    const saveMove = () => {
        if (!move) return;
        if (!(moveAmount && moveAmount > 0)) return toast.error("Informe o valor.");
        return run(
            () => send(`${API}/pots/${move.pot.id}/${move.kind}`, "POST", { amount: moveAmount, date: moveDate }),
            (move.kind === "deposit" ? "Valor guardado no cofrinho!" : "Valor retirado do cofrinho!")
                + (moveDate < todayKey() ? " Rendimentos recalculados desde a data informada." : ""),
            () => setMove(null),
        );
    };

    const moveMax = move ? (move.kind === "deposit" ? free : move.pot.balance) : 0;

    return (
        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Onde está o dinheiro</span>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={openCreate}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Novo cofrinho
                </Button>
            </div>

            <ul className="divide-y rounded-lg border">
                <li className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium">Saldo livre</p>
                            <p className="text-[11px] text-muted-foreground">{formatPct(account.cdiPercentage ?? 0)} do CDI</p>
                        </div>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <div className="text-right">
                            <p className="text-sm font-semibold tabular-nums"><Money value={free} /></p>
                            <p className="text-[11px] tabular-nums text-positive">+<Money value={account.freeMonthYield ?? 0} /> no mês</p>
                        </div>
                        <button type="button" onClick={openFree} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-indigo-600" title="Editar saldo livre" aria-label="Editar saldo livre">
                            <Pencil className="h-4 w-4" />
                        </button>
                    </div>
                </li>
                {pots.map(pot => (
                    <li key={pot.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <PiggyBank className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden />
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{pot.name}</p>
                                <p className="text-[11px] text-muted-foreground">{formatPct(pot.cdiPercentage)} do CDI</p>
                            </div>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                            <div className="text-right">
                                <p className="text-sm font-semibold tabular-nums"><Money value={pot.balance} /></p>
                                <p className="text-[11px] tabular-nums text-positive">+<Money value={pot.monthYield ?? 0} /> no mês</p>
                            </div>
                            <div className="flex text-gray-400">
                                <button type="button" onClick={() => openMove("deposit", pot)} className="rounded-md p-1.5 hover:bg-gray-100 hover:text-positive" title="Guardar" aria-label={`Guardar em ${pot.name}`}>
                                    <ArrowDownToLine className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => openMove("withdraw", pot)} className="rounded-md p-1.5 hover:bg-gray-100 hover:text-amber-600" title="Retirar" aria-label={`Retirar de ${pot.name}`}>
                                    <ArrowUpFromLine className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => openEdit(pot)} className="rounded-md p-1.5 hover:bg-gray-100 hover:text-indigo-600" title="Editar" aria-label={`Editar ${pot.name}`}>
                                    <Pencil className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => setPotToDelete(pot)} className="rounded-md p-1.5 hover:bg-red-50 hover:text-red-600" title="Excluir" aria-label={`Excluir ${pot.name}`}>
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>

            <button type="button" onClick={toggleLots} className="text-xs font-medium text-indigo-600 hover:underline">
                {lotsOpen ? "Ocultar depósitos e IR" : "Ver depósitos e faixa de IR"}
            </button>

            {lotsOpen && (
                <div className="overflow-x-auto rounded-lg border">
                    {lots === null ? (
                        <p className="p-3 text-xs text-muted-foreground">Carregando...</p>
                    ) : (
                        <table className="w-full text-xs">
                            <thead className="bg-muted/40 text-muted-foreground">
                                <tr>
                                    <th className="px-2 py-1.5 text-left font-medium">Onde</th>
                                    <th className="px-2 py-1.5 text-left font-medium">Depósito</th>
                                    <th className="px-2 py-1.5 text-right font-medium">Valor hoje</th>
                                    <th className="px-2 py-1.5 text-right font-medium">Dias</th>
                                    <th className="px-2 py-1.5 text-right font-medium">IR</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {lots.flatMap(b => b.lots.map((l, i) => (
                                    <tr key={`${b.bucket}-${i}`}>
                                        <td className="px-2 py-1.5">{b.bucket === "main" ? "Saldo livre" : b.name}</td>
                                        <td className="px-2 py-1.5 tabular-nums">{formatDate(l.date)}</td>
                                        <td className="px-2 py-1.5 text-right tabular-nums"><Money value={l.value} /></td>
                                        <td className="px-2 py-1.5 text-right tabular-nums">{l.ageDays}</td>
                                        <td className="px-2 py-1.5 text-right tabular-nums">{formatPct(l.irRate * 100)}</td>
                                    </tr>
                                )))}
                                {lots.every(b => b.lots.length === 0) && (
                                    <tr><td colSpan={5} className="px-2 py-3 text-center text-muted-foreground">Nenhum depósito rendendo.</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                    <p className="border-t px-2 py-1.5 text-[11px] text-muted-foreground">
                        Cada depósito tem seu próprio prazo de IR. Retiradas e pagamentos saem dos depósitos mais antigos primeiro.
                    </p>
                </div>
            )}

            <Dialog open={!!potForm} onOpenChange={open => !open && setPotForm(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{potForm?.mode === "edit" ? "Editar cofrinho" : "Novo cofrinho"}</DialogTitle>
                        <DialogDescription>O cofrinho rende com o próprio % do CDI e o dinheiro continua na conta.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="pot-name">Nome</Label>
                            <Input id="pot-name" placeholder="Ex: Viagem, Reserva..." value={potName} onChange={e => setPotName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pot-rate">Rendimento (% do CDI)</Label>
                            <Input
                                id="pot-rate" type="number" inputMode="decimal" min={0} step="0.5" placeholder="Ex: 120"
                                value={potRate ?? ""}
                                onChange={e => setPotRate(e.target.value === "" ? undefined : Number(e.target.value))}
                            />
                        </div>
                        {potForm?.mode === "edit" && (
                            <div className="space-y-2">
                                <Label htmlFor="pot-app-balance">Saldo atual no app do banco</Label>
                                <CurrencyInput id="pot-app-balance" placeholder="R$ 0,00" value={potAppBalance ?? ""} onChange={setPotAppBalance} />
                                <p className="text-xs text-muted-foreground">
                                    Se o app mostrar outro valor, informe aqui: a diferença entra como ajuste
                                    (não sai do saldo livre) e o rendimento continua a partir dele.
                                </p>
                            </div>
                        )}
                        {potForm?.mode === "create" && (
                            <div className="space-y-2">
                                <Label htmlFor="pot-date">Data de criação</Label>
                                <Input id="pot-date" type="date" max={todayKey()} value={potDate} onChange={e => setPotDate(e.target.value || todayKey())} />
                                <p className="text-xs text-muted-foreground">
                                    Pode ser uma data passada: o cofrinho rende desde esse dia e o sistema refaz a conta.
                                </p>
                            </div>
                        )}
                        {potForm?.mode === "create" && (
                            <div className="space-y-2">
                                <Label htmlFor="pot-initial">Valor guardado na criação (opcional)</Label>
                                <CurrencyInput id="pot-initial" placeholder="R$ 0,00" value={potInitial ?? ""} onChange={setPotInitial} />
                                <p className="text-xs text-muted-foreground">Sai do saldo livre: <Money value={free} /> disponível.</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={savePot} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!move} onOpenChange={open => !open && setMove(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{move?.kind === "deposit" ? `Guardar em ${move?.pot.name}` : `Retirar de ${move?.pot.name}`}</DialogTitle>
                        <DialogDescription>
                            {move?.kind === "deposit"
                                ? "O valor sai do saldo livre da conta e passa a render no cofrinho."
                                : "O valor volta para o saldo livre da conta. Sai dos depósitos mais antigos do cofrinho."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label htmlFor="move-date">Data</Label>
                        <Input
                            id="move-date"
                            type="date"
                            min={move?.pot.createdAt ? localKey(move.pot.createdAt) : undefined}
                            max={todayKey()}
                            value={moveDate}
                            onChange={e => setMoveDate(e.target.value || todayKey())}
                        />
                        {moveDate < todayKey() && (
                            <p className="text-xs text-muted-foreground">Data passada: os rendimentos são recalculados a partir desse dia.</p>
                        )}
                    </div>
                    <div className="space-y-2 pb-2">
                        <Label htmlFor="move-amount">Valor</Label>
                        <CurrencyInput id="move-amount" placeholder="R$ 0,00" value={moveAmount ?? ""} onChange={setMoveAmount} />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{move?.kind === "deposit" ? "Saldo livre" : "Saldo do cofrinho"}: <Money value={moveMax} /></span>
                            <button type="button" className="font-medium text-indigo-600 hover:underline" onClick={() => setMoveAmount(moveMax)}>
                                Tudo
                            </button>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={saveMove} disabled={saving}>
                            {saving ? "Salvando..." : move?.kind === "deposit" ? "Guardar" : "Retirar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={freeOpen} onOpenChange={setFreeOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar saldo livre</DialogTitle>
                        <DialogDescription>
                            É o dinheiro da conta fora dos cofrinhos. Os cofrinhos não mudam; o total da conta passa a ser
                            cofrinhos + saldo livre. O rendimento muda a partir de hoje (o que já rendeu fica como está).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label htmlFor="free-balance">Saldo livre</Label>
                        <CurrencyInput id="free-balance" placeholder="R$ 0,00" value={freeValue ?? ""} onChange={setFreeValue} />
                        <p className="text-xs text-muted-foreground">Atual: <Money value={free} /></p>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button type="button" variant="outline" onClick={() => saveFree(0)} disabled={saving || free === 0}>
                            Zerar saldo livre
                        </Button>
                        <Button type="button" onClick={() => saveFree(freeValue)} disabled={saving}>
                            {saving ? "Salvando..." : "Salvar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!potToDelete} onOpenChange={open => !open && setPotToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir cofrinho</AlertDialogTitle>
                        <AlertDialogDescription>
                            Excluir &ldquo;{potToDelete?.name}&rdquo;? {potToDelete && potToDelete.balance > 0
                                ? <>Os <Money value={potToDelete.balance} /> guardados voltam para o saldo livre da conta.</>
                                : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 text-white hover:bg-red-700"
                            onClick={() => potToDelete && run(() => send(`${API}/pots/${potToDelete.id}`, "DELETE"), "Cofrinho excluído!", () => setPotToDelete(null))}
                        >
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
