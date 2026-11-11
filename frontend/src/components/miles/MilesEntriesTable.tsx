"use client";

import { useState } from "react";
import { CreditCard, Pencil, Trash2, Plane } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
    type ApiMilesEntry, type MilesStatus,
    MILES_STATUS_LABELS, MILES_STATUS_ORDER, daysUntil, formatPoints, fromApiDate, isOverdue,
} from "@/lib/miles";

const STATUS_STYLES: Record<MilesStatus, string> = {
    PENDING: "bg-amber-50 text-amber-800 border-amber-200",
    TRANSFERRED: "bg-sky-50 text-sky-800 border-sky-200",
    CREDITED: "bg-positive-soft text-positive border-transparent",
};

type Filter = "ALL" | MilesStatus;

interface MilesEntriesTableProps {
    entries: ApiMilesEntry[];
    isLoading: boolean;
    onEdit: (entry: ApiMilesEntry) => void;
    onDelete: (entry: ApiMilesEntry) => void;
    onStatusChange: (entry: ApiMilesEntry, status: MilesStatus) => void;
}

function CreditDate({ entry }: { entry: ApiMilesEntry }) {
    const date = fromApiDate(entry.expectedCreditDate);
    const days = daysUntil(date);
    const late = isOverdue(entry.status, date);

    let hint: string;
    if (entry.status === "CREDITED") hint = "creditado";
    else if (late) hint = `atrasado há ${Math.abs(days)} ${Math.abs(days) === 1 ? "dia" : "dias"}`;
    else if (days === 0) hint = "previsto para hoje";
    else hint = `em ${days} ${days === 1 ? "dia" : "dias"}`;

    return (
        <div>
            <div className="tabular-nums">{date.toLocaleDateString("pt-BR")}</div>
            <div className={cn("text-xs", late ? "font-medium text-negative" : "text-muted-foreground")}>{hint}</div>
        </div>
    );
}

function Origin({ entry }: { entry: ApiMilesEntry }) {
    if (entry.creditCard) {
        return (
            <div className="flex items-center gap-2">
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white", entry.creditCard.color || "from-slate-600 to-slate-900")}>
                    <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div>
                    <div className="font-medium">Cartão {entry.creditCard.name}</div>
                    {entry.referenceMonth && (
                        <div className="text-xs text-muted-foreground tabular-nums">
                            Fatura {String(entry.referenceMonth).padStart(2, "0")}/{entry.referenceYear}
                        </div>
                    )}
                </div>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                <Plane className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="font-medium">{entry.origin || "—"}</span>
        </div>
    );
}

export function MilesEntriesTable({ entries, isLoading, onEdit, onDelete, onStatusChange }: MilesEntriesTableProps) {
    const [filter, setFilter] = useState<Filter>("ALL");

    const counts = MILES_STATUS_ORDER.reduce(
        (acc, s) => ({ ...acc, [s]: entries.filter(e => e.status === s).length }),
        { ALL: entries.length } as Record<Filter, number>,
    );
    const visible = filter === "ALL" ? entries : entries.filter(e => e.status === filter);
    const filters: Filter[] = ["ALL", ...MILES_STATUS_ORDER];

    return (
        <div>
            <div className="overflow-x-auto border-b px-4" role="tablist" aria-label="Filtrar por status">
                <div className="flex h-11 items-stretch gap-5">
                    {filters.map(f => (
                        <button
                            key={f}
                            type="button"
                            role="tab"
                            aria-selected={filter === f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "flex items-center gap-1.5 whitespace-nowrap border-b-2 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                                filter === f ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {f === "ALL" ? "Todos" : MILES_STATUS_LABELS[f]}
                            <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{counts[f]}</span>
                        </button>
                    ))}
                </div>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Origem</TableHead>
                        <TableHead>Programa</TableHead>
                        <TableHead className="text-right">Pontos</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Previsão de crédito</TableHead>
                        <TableHead className="text-right"><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visible.map(entry => (
                        <TableRow key={entry.id}>
                            <TableCell><Origin entry={entry} /></TableCell>
                            <TableCell>
                                <div className="font-medium">{entry.program}</div>
                                {entry.notes && <div className="max-w-[220px] truncate text-xs text-muted-foreground" title={entry.notes}>{entry.notes}</div>}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">{formatPoints(entry.points)}</TableCell>
                            <TableCell>
                                <Select value={entry.status} onValueChange={(value) => onStatusChange(entry, value as MilesStatus)}>
                                    <SelectTrigger
                                        size="sm"
                                        aria-label={`Status de ${formatPoints(entry.points)} pontos ${entry.program}`}
                                        className={cn("h-8 w-[140px] text-xs font-medium", STATUS_STYLES[entry.status])}
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MILES_STATUS_ORDER.map(s => <SelectItem key={s} value={s}>{MILES_STATUS_LABELS[s]}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </TableCell>
                            <TableCell><CreditDate entry={entry} /></TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon-sm" aria-label="Editar lançamento" onClick={() => onEdit(entry)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon-sm" aria-label="Excluir lançamento" className="text-negative hover:bg-negative-soft hover:text-negative" onClick={() => onDelete(entry)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                    {!isLoading && visible.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                {entries.length === 0
                                    ? "Nenhum lançamento ainda. Registre a estimativa de um cartão ou adicione manualmente."
                                    : "Nenhum lançamento com este status."}
                            </TableCell>
                        </TableRow>
                    )}
                    {isLoading && (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground animate-pulse">Carregando...</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
