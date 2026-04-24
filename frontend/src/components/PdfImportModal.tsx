"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileText, AlertTriangle, CheckCircle2, ChevronRight, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface ParsedTransaction {
    date: string;
    description: string;
    amount: number;
    installmentsCurrent: number | null;
    installmentsTotal: number | null;
    suggestedCategoryId: string | null;
    hasCategoryMatch: boolean;
    _categoryId?: string | null;
    _exclude?: boolean;
    _description?: string; // user-edited description
}

interface ApiCard { id: string; name: string; }
interface ApiCategory { id: string; name: string; }

interface PdfImportModalProps {
    cards: ApiCard[];
    categories: ApiCategory[];
    currentCardId?: string;
    children: React.ReactNode;
    onSuccess?: () => void;
}

type Step = "upload" | "review" | "done";

const formatBRL = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// ─── Quick-Create Category dialog ──────────────────────────────────────────
function QuickCreateCategory({
    onCreated,
}: {
    onCreated: (cat: ApiCategory) => void;
}) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const res = await fetch("http://localhost:3333/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim() }),
            });
            if (!res.ok) throw new Error("Erro ao criar categoria");
            const cat: ApiCategory = await res.json();
            toast.success(`Categoria "${cat.name}" criada!`);
            onCreated(cat);
            setName("");
            setOpen(false);
        } catch {
            toast.error("Não foi possível criar a categoria.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    title="Nova categoria"
                    className="inline-flex items-center justify-center h-6 w-6 rounded border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors shrink-0"
                >
                    <PlusCircle className="h-3.5 w-3.5" />
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[360px]">
                <DialogHeader>
                    <DialogTitle>Nova Categoria</DialogTitle>
                    <DialogDescription>Crie uma categoria rápida para categorizar esta transação.</DialogDescription>
                </DialogHeader>
                <div className="py-2 space-y-2">
                    <Label htmlFor="quick-cat-name">Nome da categoria</Label>
                    <Input
                        id="quick-cat-name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ex: Alimentação, Transporte..."
                        onKeyDown={e => e.key === "Enter" && handleSave()}
                        autoFocus
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={!name.trim() || saving} className="bg-indigo-600 hover:bg-indigo-700">
                        {saving ? "Criando..." : "Criar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────
export function PdfImportModal({ cards, categories: initialCategories, currentCardId, children, onSuccess }: PdfImportModalProps) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<Step>("upload");
    const [selectedCardId, setSelectedCardId] = useState(currentCardId || cards[0]?.id || "");
    const [file, setFile] = useState<File | null>(null);
    const [pdfPassword, setPdfPassword] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
    const [categories, setCategories] = useState<ApiCategory[]>(initialCategories);
    const [isParsing, setIsParsing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetModal = () => {
        setStep("upload");
        setFile(null);
        setPdfPassword("");
        setTransactions([]);
        setCategories(initialCategories);
        setSelectedCardId(currentCardId || cards[0]?.id || "");
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped?.type === "application/pdf") setFile(dropped);
        else toast.error("Por favor, selecione apenas arquivos PDF.");
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) setFile(selected);
    };

    const handleParse = async () => {
        if (!file || !selectedCardId) return;
        setIsParsing(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const url = new URL(`http://localhost:3333/card-transactions/import-pdf`);
            url.searchParams.set("creditCardId", selectedCardId);
            if (pdfPassword) url.searchParams.set("password", pdfPassword);

            const res = await fetch(url.toString(), { method: "POST", body: formData });

            if (!res.ok) {
                const err = await res.json();
                toast.error(`Erro ao processar PDF: ${err.message}`);
                return;
            }

            const data = await res.json();
            if (!data.transactions || data.transactions.length === 0) {
                toast.warning("Nenhuma transação foi detectada neste PDF. Verifique se o arquivo não está escaneado.");
                return;
            }

            const enriched: ParsedTransaction[] = data.transactions.map((tx: ParsedTransaction) => ({
                ...tx,
                _categoryId: tx.suggestedCategoryId,
                _exclude: false,
                _description: tx.description,
            }));

            setTransactions(enriched);
            setStep("review");
        } catch {
            toast.error("Erro de conexão com o servidor.");
        } finally {
            setIsParsing(false);
        }
    };

    const handleConfirm = async () => {
        const toImport = transactions.filter(tx => !tx._exclude);
        if (!toImport.length) { toast.error("Nenhuma transação selecionada."); return; }

        setIsImporting(true);
        try {
            const payload = toImport.map(tx => ({
                ...tx,
                description: tx._description ?? tx.description,
                suggestedCategoryId: tx._categoryId ?? null,
            }));

            const res = await fetch("http://localhost:3333/card-transactions/import-pdf/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ creditCardId: selectedCardId, transactions: payload }),
            });

            if (!res.ok) { const err = await res.json(); toast.error(`Erro ao importar: ${err.message}`); return; }

            const result = await res.json();
            toast.success(`${result.imported} transações importadas com sucesso!`);
            setStep("done");
            if (onSuccess) onSuccess();
        } catch {
            toast.error("Erro de conexão com o servidor.");
        } finally {
            setIsImporting(false);
        }
    };

    const updateTx = (index: number, changes: Partial<ParsedTransaction>) =>
        setTransactions(prev => { const c = [...prev]; c[index] = { ...c[index], ...changes }; return c; });

    const handleCategoryCreated = (cat: ApiCategory, txIndex: number) => {
        setCategories(prev => [...prev, cat]);
        updateTx(txIndex, { _categoryId: cat.id });
    };

    const activeCount = transactions.filter(tx => !tx._exclude).length;
    const uncategorizedCount = transactions.filter(tx => !tx._categoryId && !tx._exclude).length;

    return (
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetModal(); }}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[820px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-indigo-500" />
                        Importar Fatura PDF
                    </DialogTitle>
                    <DialogDescription>
                        {step === "upload" && "Selecione o cartão e faça upload do PDF da fatura para detectar as transações."}
                        {step === "review" && `${transactions.length} transações detectadas. Revise, edite e ajuste categorias antes de importar.`}
                        {step === "done" && "Importação concluída com sucesso!"}
                    </DialogDescription>
                </DialogHeader>

                {/* Stepper */}
                <div className="flex items-center gap-2 text-sm text-gray-500 pt-1">
                    {(["upload", "review", "done"] as Step[]).map((s, i) => (
                        <span key={s} className="flex items-center gap-2">
                            {i > 0 && <ChevronRight className="h-3 w-3" />}
                            <span className={step === s ? (s === "done" ? "font-semibold text-emerald-600" : "font-semibold text-indigo-600") : "text-gray-400"}>
                                {i + 1}. {s === "upload" ? "Upload" : s === "review" ? "Revisão" : "Confirmar"}
                            </span>
                        </span>
                    ))}
                </div>

                <div className="flex-1 overflow-hidden">

                    {/* STEP 1: UPLOAD */}
                    {step === "upload" && (
                        <div className="space-y-4 py-2">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Cartão de Crédito</label>
                                <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                                    <SelectTrigger><SelectValue placeholder="Selecione o cartão..." /></SelectTrigger>
                                    <SelectContent>{cards.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                    Senha do PDF
                                    <span className="text-xs font-normal text-gray-400">(opcional — use CPF ou data de nascimento)</span>
                                </label>
                                <input
                                    type="password"
                                    value={pdfPassword}
                                    onChange={e => setPdfPassword(e.target.value)}
                                    placeholder="Ex: 12345678900 ou 01011990"
                                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>

                            <div
                                onDrop={handleDrop}
                                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-10 cursor-pointer text-center transition-all ${isDragging ? "border-indigo-400 bg-indigo-50" : "border-gray-300 hover:border-indigo-300 hover:bg-gray-50"}`}
                            >
                                <Upload className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                                {file ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <p className="font-medium text-gray-800">{file.name}</p>
                                        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                                        <Badge variant="secondary" className="text-emerald-700 bg-emerald-50">PDF Selecionado</Badge>
                                    </div>
                                ) : (
                                    <>
                                        <p className="font-medium text-gray-700">Arraste o PDF aqui ou clique para selecionar</p>
                                        <p className="text-sm text-gray-400 mt-1">Apenas PDFs com texto selecionável são suportados</p>
                                    </>
                                )}
                                <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
                            </div>

                            <div className="flex justify-end">
                                <Button onClick={handleParse} disabled={!file || !selectedCardId || isParsing} className="bg-indigo-600 hover:bg-indigo-700">
                                    {isParsing ? "Analisando PDF..." : "Analisar Fatura"}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: REVIEW */}
                    {step === "review" && (
                        <div className="flex flex-col gap-3 py-2 h-full">
                            {uncategorizedCount > 0 && (
                                <div className="flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-3 py-2 text-sm">
                                    <AlertTriangle className="h-4 w-4 shrink-0" />
                                    <span>{uncategorizedCount} transaç{uncategorizedCount === 1 ? "ão sem" : "ões sem"} categoria — revise antes de importar.</span>
                                </div>
                            )}

                            <div className="overflow-y-auto max-h-[440px] border rounded-lg">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr className="text-left text-gray-500 text-xs uppercase border-b">
                                            <th className="px-2 py-2 w-8"></th>
                                            <th className="px-2 py-2 whitespace-nowrap">Data</th>
                                            <th className="px-2 py-2">Descrição</th>
                                            <th className="px-2 py-2 text-center">Parc.</th>
                                            <th className="px-2 py-2 text-right whitespace-nowrap">Valor</th>
                                            <th className="px-2 py-2">Categoria</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {transactions.map((tx, i) => (
                                            <tr key={i} className={`${tx._exclude ? "opacity-40 bg-gray-50" : "hover:bg-gray-50"} transition-colors`}>
                                                {/* Checkbox */}
                                                <td className="px-2 py-1.5">
                                                    <input type="checkbox" checked={!tx._exclude}
                                                        onChange={e => updateTx(i, { _exclude: !e.target.checked })}
                                                        className="rounded" />
                                                </td>
                                                {/* Date */}
                                                <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap text-xs">
                                                    {new Date(tx.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                                                </td>
                                                {/* Description — editable input */}
                                                <td className="px-2 py-1.5 max-w-[200px]">
                                                    <input
                                                        type="text"
                                                        value={tx._description ?? tx.description}
                                                        onChange={e => updateTx(i, { _description: e.target.value })}
                                                        disabled={tx._exclude}
                                                        className="w-full bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-indigo-400 focus:outline-none py-0.5 text-sm rounded-none transition-colors"
                                                        title={tx._description ?? tx.description}
                                                    />
                                                </td>
                                                {/* Installments */}
                                                <td className="px-2 py-1.5 text-center text-gray-400 text-xs whitespace-nowrap">
                                                    {tx.installmentsCurrent && tx.installmentsTotal
                                                        ? `${tx.installmentsCurrent}/${tx.installmentsTotal}` : "—"}
                                                </td>
                                                {/* Amount */}
                                                <td className="px-2 py-1.5 text-right font-medium tabular-nums whitespace-nowrap">
                                                    {formatBRL(tx.amount)}
                                                </td>
                                                {/* Category */}
                                                <td className="px-2 py-1.5 min-w-[180px]">
                                                    <div className="flex items-center gap-1">
                                                        <Select
                                                            value={tx._categoryId ?? "__none__"}
                                                            onValueChange={val => updateTx(i, { _categoryId: val === "__none__" ? null : val })}
                                                            disabled={tx._exclude}
                                                        >
                                                            <SelectTrigger className={`h-7 text-xs flex-1 ${!tx._categoryId ? "border-red-200 text-red-600" : ""}`}>
                                                                <SelectValue>
                                                                    {tx._categoryId
                                                                        ? categories.find(c => c.id === tx._categoryId)?.name ?? "Sem categoria"
                                                                        : <span className="flex items-center gap-1 text-red-500"><AlertTriangle className="h-3 w-3" /> Sem categoria</span>
                                                                    }
                                                                </SelectValue>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="__none__">Sem categoria</SelectItem>
                                                                {categories.map(cat => (
                                                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        {/* Quick-create category */}
                                                        {!tx._exclude && (
                                                            <QuickCreateCategory
                                                                onCreated={cat => handleCategoryCreated(cat, i)}
                                                            />
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-between items-center pt-1">
                                <span className="text-sm text-gray-500">{activeCount} de {transactions.length} selecionadas</span>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setStep("upload")}>Voltar</Button>
                                    <Button onClick={handleConfirm} disabled={isImporting || activeCount === 0} className="bg-emerald-600 hover:bg-emerald-700">
                                        {isImporting ? "Importando..." : `Importar ${activeCount} transaç${activeCount === 1 ? "ão" : "ões"}`}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: DONE */}
                    {step === "done" && (
                        <div className="flex flex-col items-center gap-4 py-10 text-center">
                            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
                            <h3 className="text-lg font-semibold text-gray-900">Importação concluída!</h3>
                            <p className="text-gray-500 text-sm">As transações foram lançadas na fatura do cartão selecionado.</p>
                            <Button onClick={() => setOpen(false)} className="bg-emerald-600 hover:bg-emerald-700">Fechar</Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
