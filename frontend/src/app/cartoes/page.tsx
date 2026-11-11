"use client";

import { Money } from "@/components/Money";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, CreditCard as CreditCardIcon, FileText, Edit2, Repeat, RotateCcw, Receipt, Gauge, List as ListIcon, Layers, ShoppingBag, Star, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Panel } from "@/components/Panel";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { estimatePointsFromSpend, formatPoints } from "@/lib/miles";
import {
    filterByHolder,
    groupInvoice,
    holderLabel,
    holderTotals,
    holdersOf,
    openInvoiceMonth,
    primaryCard,
    type InvoiceGroupKey,
} from "@/lib/credit-cards";
import { InvoiceGroupSection } from "@/components/cards/InvoiceGroupSection";
import { CardHoldersModal } from "@/components/CardHoldersModal";
import type { LucideIcon } from "lucide-react";
import { CreditCardTransactionModal } from "@/components/CreditCardTransactionModal";
import { CreateCardModal } from "@/components/CreateCardModal";
import { PdfImportModal } from "@/components/PdfImportModal";
import { EstornoModal } from "@/components/EstornoModal";
import { ApiCategory, ICONS_MAP } from "@/components/CreateCategoryModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Helper: Formatter
const formatDay = (dateString: string) => {
    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short"
    }).format(new Date(dateString));
};

type ApiCardHolder = {
    id: string;
    name: string;
    last4?: string | null;
    isMain: boolean;
};

type ApiCard = {
    id: string;
    name: string;
    limit: number;
    invoiceClosingOffset: number;
    dueDay: number;
    color?: string;
    pointsPerDollar?: number | null;
    loyaltyProgram?: string | null;
    isPrimary?: boolean;
    holders?: ApiCardHolder[];
};

type ApiInvoiceItem = {
    id: string;
    date: string;
    description: string;
    amount: number;
    installments: number;
    categoryId?: string;
    creditCardId: string;
    cardHolderId?: string;
    cardHolder?: { id: string; name: string; last4?: string | null } | null;
    isFixed?: boolean;
};

// Removed MOCK data

const GROUP_ICONS: Record<InvoiceGroupKey, LucideIcon> = { fixed: Repeat, installments: Layers, single: ShoppingBag };
const GROUP_EMPTY: Record<InvoiceGroupKey, string> = {
    fixed: "Nenhum lançamento fixo nesta fatura.",
    installments: "Nenhuma compra parcelada nesta fatura.",
    single: "Nenhuma compra à vista nesta fatura.",
};

/** Invoice split into Fixos (always on top), Parcelados and À vista, each collapsible, with the invoice total at the end. */
function InvoiceList({ transactions, categories, onEditSuccess, openGroups, onToggleGroup, showHolder = false, grandTotal }: {
    transactions: ApiInvoiceItem[];
    categories: ApiCategory[];
    onEditSuccess: () => void;
    openGroups: Record<InvoiceGroupKey, boolean>;
    onToggleGroup: (key: InvoiceGroupKey) => void;
    /** Shows the holder badge on each line (only when the card has supplementary holders) */
    showHolder?: boolean;
    /** Full invoice total, shown when the list is filtered by holder */
    grandTotal?: number;
}) {
    if (transactions.length === 0) {
        return <InvoiceItems transactions={[]} categories={categories} onEditSuccess={onEditSuccess} />;
    }
    const { groups, total } = groupInvoice(transactions);
    const isFiltered = grandTotal != null && Math.abs(grandTotal - total) > 0.005;

    return (
        <div className="space-y-3 p-4">
            {groups.map(group => (
                <InvoiceGroupSection
                    key={group.key}
                    id={group.key}
                    title={group.label}
                    icon={GROUP_ICONS[group.key]}
                    count={group.items.length}
                    total={group.total}
                    isOpen={openGroups[group.key]}
                    onToggle={() => onToggleGroup(group.key)}
                >
                    {group.items.length > 0
                        ? <InvoiceItems transactions={group.items} categories={categories} onEditSuccess={onEditSuccess} showHolder={showHolder} />
                        : <p className="px-4 py-5 text-center text-sm text-muted-foreground">{GROUP_EMPTY[group.key]}</p>}
                </InvoiceGroupSection>
            ))}

            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-4 py-3">
                <span className="text-sm font-medium">{isFiltered ? "Total do portador" : "Total da fatura"}</span>
                <span className="text-lg font-medium tabular-nums"><Money value={total} /></span>
            </div>

            {isFiltered && (
                <div className="flex items-center justify-between gap-3 px-4 text-xs text-muted-foreground">
                    <span>Fatura completa</span>
                    <span className="tabular-nums"><Money value={grandTotal} /></span>
                </div>
            )}
        </div>
    );
}

function InvoiceItems({ transactions, categories, onEditSuccess, showHolder = false }: { transactions: ApiInvoiceItem[], categories: ApiCategory[], onEditSuccess: () => void, showHolder?: boolean }) {
    if (transactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-10 text-center">
                <FileText className="mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Nenhuma transação nesta fatura.</p>
            </div>
        );
    }

    return (
        <ul className="divide-y">
            {transactions.map((tx) => {
                const category = categories.find(c => c.id === tx.categoryId);
                const IconComponent = category?.icon && ICONS_MAP[category.icon]
                    ? ICONS_MAP[category.icon]
                    : null;

                return (
                    <li key={tx.id} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                        <div className="flex min-w-0 items-center gap-3">
                            {IconComponent ? (
                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${category?.color || 'bg-gray-800'}`}>
                                    <IconComponent className="h-4 w-4" aria-hidden="true" />
                                </div>
                            ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-foreground">
                                    {formatDay(tx.date)}
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                                    <span className="truncate">{tx.description}</span>
                                    {tx.installments > 1 && (
                                        <Badge variant="secondary" className="bg-muted text-[11px] font-normal text-muted-foreground">
                                            Parcelado ({tx.installments}x)
                                        </Badge>
                                    )}
                                    {tx.isFixed && (
                                        <Badge variant="secondary" className="flex items-center gap-1 bg-muted text-[11px] font-normal text-muted-foreground">
                                            <Repeat className="h-3 w-3" aria-hidden="true" />
                                            Fixo
                                        </Badge>
                                    )}
                                    {showHolder && tx.cardHolder && (
                                        <Badge variant="secondary" className="flex items-center gap-1 bg-muted text-[11px] font-normal text-muted-foreground">
                                            <Users className="h-3 w-3" aria-hidden="true" />
                                            {holderLabel(tx.cardHolder)}
                                        </Badge>
                                    )}
                                </p>
                                {category && <p className="text-xs text-muted-foreground">{category.name}</p>}
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center justify-end gap-1">
                            <p className={`mr-2 text-sm font-medium tabular-nums ${tx.amount < 0 ? "text-positive" : ""}`}>
                                <Money value={tx.amount} />
                            </p>
                            {/* Estorno — only for positive (non-credit) transactions */}
                            {tx.amount > 0 && (
                                <EstornoModal
                                    transactionId={tx.id}
                                    description={tx.description}
                                    amount={Math.abs(tx.amount)}
                                    onSuccess={onEditSuccess}
                                >
                                    <Button variant="ghost" size="icon-sm" aria-label={`Estornar ${tx.description}`} title="Estornar" className="text-muted-foreground">
                                        <RotateCcw className="h-4 w-4" />
                                    </Button>
                                </EstornoModal>
                            )}
                            <CreditCardTransactionModal initialData={tx} onSuccess={onEditSuccess}>
                                <Button variant="ghost" size="icon-sm" aria-label={`Editar ${tx.description}`} className="text-muted-foreground">
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                            </CreditCardTransactionModal>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

import { useState, useEffect, useCallback, useMemo } from "react";

export default function CartoesPage() {
    const monthsList = useMemo(() => {
        const list = [];
        const current = new Date();
        for (let i = 0; i < 12; i++) {
            const monthDesc = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(current).replace('.', '');
            const yearDesc = current.getFullYear();
            const label = `${monthDesc.charAt(0).toUpperCase() + monthDesc.slice(1)}/${yearDesc}`;
            list.push({
                label,
                month: current.getMonth() + 1,
                year: yearDesc
            });
            current.setMonth(current.getMonth() + 1);
        }
        return list;
    }, []);

    const [activeTab, setActiveTab] = useState<string>(monthsList[0].label);
    const [allCards, setAllCards] = useState<ApiCard[]>([]);
    const [categories, setCategories] = useState<ApiCategory[]>([]);
    const [card, setCard] = useState<ApiCard | null>(null);
    const [invoices, setInvoices] = useState<Record<string, ApiInvoiceItem[]>>({});
    const [globalTotals, setGlobalTotals] = useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [usdRate, setUsdRate] = useState<number | null>(null);
    // Holder selected in the invoice chips; null means "all holders"
    const [holderFilter, setHolderFilter] = useState<string | null>(null);
    // Open/closed state of each invoice group; kept when switching months or cards
    const [openGroups, setOpenGroups] = useState<Record<InvoiceGroupKey, boolean>>({ fixed: true, installments: true, single: true });
    const toggleGroup = (key: InvoiceGroupKey) => setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));

    useEffect(() => {
        // Dollar rate is only needed for the points estimate; failures just hide it
        fetch("https://economia.awesomeapi.com.br/last/USD-BRL")
            .then(res => (res.ok ? res.json() : null))
            .then(data => {
                const bid = Number(data?.USDBRL?.bid);
                if (bid > 0) setUsdRate(bid);
            })
            .catch(() => undefined);
    }, []);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [cardRes, catRes] = await Promise.all([
                    fetch("http://localhost:3333/credit-cards"),
                    fetch("http://localhost:3333/categories")
                ]);

                if (cardRes.ok) {
                    const cards: ApiCard[] = await cardRes.json();
                    setAllCards(cards);
                    const primary = primaryCard(cards);
                    if (primary) {
                        setCard(primary);
                    }
                }

                if (catRes.ok) {
                    setCategories(await catRes.json());
                }
            } catch (error) {
                console.error("Failed to load initial data", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadInitialData();
    }, []);

    /** Reloads the card list keeping the card currently selected */
    const refreshCards = useCallback(async () => {
        try {
            const res = await fetch("http://localhost:3333/credit-cards");
            if (!res.ok) return;
            const cards: ApiCard[] = await res.json();
            setAllCards(cards);
            setCard(prev => cards.find(c => c.id === prev?.id) ?? primaryCard(cards));
        } catch (error) {
            console.error("Failed to reload cards", error);
        }
    }, []);

    /** Favorite card: the only one, shown first and featured on the summary */
    const makePrimary = async (target: ApiCard) => {
        if (target.isPrimary) return;
        try {
            const res = await fetch(`http://localhost:3333/credit-cards/${target.id}/primary`, { method: "PATCH" });
            if (!res.ok) throw new Error("Falha ao salvar o cartão principal");
            await refreshCards();
            toast.success(`${target.name} agora é o cartão principal.`);
        } catch (error) {
            console.error(error);
            toast.error("Não foi possível definir o cartão principal.");
        }
    };

    const loadInvoices = useCallback(async () => {
        if (!card) return;
        try {
            const fetchMonth = async (month: number, year: number) => {
                const res = await fetch(`http://localhost:3333/card-transactions/${card.id}/invoice?month=${month}&year=${year}`);
                if (res.ok) return await res.json();
                return [];
            };

            const fetchMonthTotal = async (month: number, year: number) => {
                const res = await fetch(`http://localhost:3333/card-transactions/summary/invoice?month=${month}&year=${year}`);
                if (res.ok) {
                    const data = await res.json();
                    return data.totalAmount;
                }
                return 0;
            };

            const promises = monthsList.map(m => fetchMonth(m.month, m.year));
            const totalPromises = monthsList.map(m => fetchMonthTotal(m.month, m.year));

            const [results, totalResults] = await Promise.all([
                Promise.all(promises),
                Promise.all(totalPromises)
            ]);

            const newInvoices: Record<string, ApiInvoiceItem[]> = {};
            const newGlobalTotals: Record<string, number> = {};

            monthsList.forEach((m, index) => {
                newInvoices[m.label] = results[index];
                newGlobalTotals[m.label] = totalResults[index];
            });

            setInvoices(newInvoices);
            setGlobalTotals(newGlobalTotals);
        } catch (error) {
            console.error("Failed to load invoices", error);
        }
    }, [card, monthsList]);

    useEffect(() => {
        loadInvoices();
    }, [loadInvoices]);

    // Invoice where today's purchases go (e.g. in November, a card due on the 5th is on December's invoice)
    const openInvoiceLabel = useMemo(() => {
        if (!card) return null;
        const open = openInvoiceMonth(new Date(), card.invoiceClosingOffset, card.dueDay);
        return monthsList.find(m => m.month === open.month && m.year === open.year)?.label ?? null;
    }, [card, monthsList]);

    // Opens on the open invoice, and again whenever another card is selected
    useEffect(() => {
        if (openInvoiceLabel) setActiveTab(openInvoiceLabel);
    }, [openInvoiceLabel, card?.id]);

    // The holder filter belongs to a card: reset it when the card changes or the holder disappears
    useEffect(() => {
        setHolderFilter(null);
    }, [card?.id]);

    useEffect(() => {
        if (!holderFilter) return;
        const stillExists = holdersOf(card?.holders).some(holder => holder.id === holderFilter);
        if (!stillExists) setHolderFilter(null);
    }, [card?.holders, holderFilter]);

    if (isLoading) {
        return <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground animate-pulse">Buscando fatura no servidor...</div>;
    }

    if (!card) {
        return (
            <div className="space-y-6">
                <PageHeader title="Cartões" />
                <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-12 text-center">
                    <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <CreditCardIcon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <h2 className="text-lg font-medium">Nenhum cartão encontrado</h2>
                    <p className="mb-6 mt-2 max-w-sm text-sm text-muted-foreground">Comece adicionando o seu primeiro Cartão de Crédito para gerenciar suas faturas aqui.</p>
                    <CreateCardModal>
                        <Button>
                            <Plus className="h-4 w-4" />
                            Cadastrar Cartão
                        </Button>
                    </CreateCardModal>
                </div>
            </div>
        );
    }

    const currentInvoiceTotal = (invoices[activeTab] || []).reduce((acc, curr) => acc + curr.amount, 0);
    const percentUsed = Math.min((currentInvoiceTotal / card.limit) * 100, 100);
    const available = card.limit - currentInvoiceTotal;

    // Holders come from the card; their totals and the filter always refer to the visible invoice
    const cardHolders = holdersOf(card.holders);
    const invoiceItems = invoices[activeTab] || [];
    const holderSplits = holderTotals(invoiceItems, card.holders);
    const visibleInvoiceItems = filterByHolder(invoiceItems, holderFilter);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Cartões"
                actions={
                    <>
                        {allCards.length > 1 && (
                            <Select onValueChange={(id) => setCard(allCards.find(c => c.id === id) || null)} value={card.id}>
                                <SelectTrigger className="h-9 w-[200px] bg-card" aria-label="Selecionar cartão">
                                    <SelectValue placeholder="Selecione o Cartão" />
                                </SelectTrigger>
                                <SelectContent>
                                    {allCards.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.isPrimary ? `★ ${c.name}` : c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <PdfImportModal
                            cards={allCards}
                            categories={categories}
                            currentCardId={card.id}
                            onSuccess={loadInvoices}
                        >
                            <Button variant="outline" className="bg-card">
                                <FileText className="h-4 w-4" />
                                Importar PDF
                            </Button>
                        </PdfImportModal>
                        <CreditCardTransactionModal onSuccess={loadInvoices}>
                            <Button>
                                <Plus className="h-4 w-4" />
                                Lançar Despesa
                            </Button>
                        </CreditCardTransactionModal>
                    </>
                }
            />

            <div className="grid gap-4 lg:grid-cols-3">
                {/* Card visual keeps the user's chosen color */}
                <div className={`flex min-h-[180px] flex-col justify-between rounded-lg bg-gradient-to-br ${card.color || 'from-purple-700 to-purple-900'} p-5 text-white`}>
                    <div className="flex items-start justify-between gap-2">
                        <span className="flex items-center gap-2 text-lg font-medium">
                            <CreditCardIcon className="h-5 w-5 opacity-80" aria-hidden="true" />
                            {card.name}
                        </span>
                        <span className="flex items-center gap-2">
                            <CardHoldersModal
                                cardId={card.id}
                                cardName={card.name}
                                onChanged={() => { void refreshCards(); void loadInvoices(); }}
                            >
                                <button
                                    type="button"
                                    aria-label={`Gerenciar portadores de ${card.name}`}
                                    title="Portadores"
                                    className="flex h-8 w-8 items-center justify-center rounded-full bg-black/20 transition-colors hover:bg-black/40 focus-visible:outline-2 focus-visible:outline-white"
                                >
                                    <Users className="h-4 w-4 text-white/80" aria-hidden="true" />
                                </button>
                            </CardHoldersModal>
                            <button
                                type="button"
                                onClick={() => makePrimary(card)}
                                disabled={card.isPrimary}
                                aria-label={card.isPrimary ? "Cartão principal" : `Tornar ${card.name} o cartão principal`}
                                title={card.isPrimary ? "Cartão principal" : "Tornar principal"}
                                className={cn(
                                    "flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-white",
                                    card.isPrimary ? "cursor-default bg-white/20" : "bg-black/20 hover:bg-black/40",
                                )}
                            >
                                <Star className={cn("h-4 w-4", card.isPrimary ? "fill-amber-300 text-amber-300" : "text-white/80")} />
                            </button>
                            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs">Vence dia {card.dueDay}</span>
                        </span>
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-wider text-white/75">Limite total</p>
                        <p className="text-2xl font-medium tabular-nums"><Money value={card.limit} /></p>
                        <p className="mt-1 text-xs text-white/75">Fecha ~{card.invoiceClosingOffset} dias antes do vencimento</p>
                        {cardHolders.length > 0 && (
                            <p className="mt-2 truncate text-xs text-white/75">
                                {cardHolders.map(holder => `${holder.name}${holder.isMain ? " (titular)" : ""}`).join(" · ")}
                            </p>
                        )}
                    </div>
                </div>

                <StatCard title={`Fatura ${activeTab}`} icon={Receipt} info="Soma dos lançamentos deste cartão no mês selecionado.">
                    <div className="text-xl font-medium tabular-nums"><Money value={currentInvoiceTotal} /></div>
                    <div className="mt-3 text-sm text-muted-foreground">Todos os cartões</div>
                    <div className="text-[15px] tabular-nums"><Money value={globalTotals[activeTab] || 0} /></div>
                    {card.pointsPerDollar ? (
                        <>
                            <div className="mt-3 text-sm text-muted-foreground">Pontos estimados</div>
                            <Link href="/milhas" className="text-[15px] tabular-nums underline-offset-4 hover:underline">
                                {usdRate
                                    ? `≈ ${formatPoints(estimatePointsFromSpend(currentInvoiceTotal, usdRate, card.pointsPerDollar))} pts${card.loyaltyProgram ? ` ${card.loyaltyProgram}` : ""}`
                                    : "…"}
                            </Link>
                        </>
                    ) : null}
                </StatCard>

                <StatCard title="Limite disponível" icon={Gauge}>
                    <div className="flex items-center gap-3">
                        <span className={`text-xl font-medium tabular-nums ${available < 0 ? "text-negative" : ""}`}><Money value={available} /></span>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[13px] font-medium tabular-nums">{percentUsed.toFixed(1)}% usado</span>
                    </div>
                    <div
                        className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-label="Uso do limite"
                        aria-valuenow={Math.round(percentUsed)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                    >
                        <div
                            className={`h-full rounded-full ${percentUsed >= 90 ? "bg-negative-fill" : percentUsed >= 70 ? "bg-amber-400" : "bg-positive-fill"}`}
                            style={{ width: `${percentUsed}%` }}
                        />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">de <Money value={card.limit} /></p>
                </StatCard>
            </div>

            {/* Invoices by month */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
                <Panel title="Lançamentos" icon={ListIcon} count={invoiceItems.length} flush>
                    {cardHolders.length > 1 && (
                        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5" role="group" aria-label="Filtrar fatura por portador">
                            <button
                                type="button"
                                onClick={() => setHolderFilter(null)}
                                aria-pressed={holderFilter === null}
                                className={cn(
                                    "flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                                    holderFilter === null
                                        ? "border-foreground bg-foreground font-medium text-background"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                )}
                            >
                                Todos
                                <span className="tabular-nums"><Money value={currentInvoiceTotal} /></span>
                            </button>
                            {holderSplits.filter(split => split.id !== "unknown").map(split => (
                                <button
                                    key={split.id}
                                    type="button"
                                    onClick={() => setHolderFilter(split.id)}
                                    aria-pressed={holderFilter === split.id}
                                    className={cn(
                                        "flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                                        holderFilter === split.id
                                            ? "border-foreground bg-foreground font-medium text-background"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                    )}
                                >
                                    {split.name}
                                    <span className="tabular-nums"><Money value={split.total} /></span>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="overflow-x-auto border-b px-4">
                        <TabsList variant="line" className="h-11 items-stretch gap-5 p-0">
                            {monthsList.map(m => (
                                <TabsTrigger
                                    key={m.label}
                                    value={m.label}
                                    className="h-full flex-none rounded-none border-0 border-b-2 border-transparent px-0 text-[13px] tabular-nums after:hidden data-[state=active]:border-foreground"
                                >
                                    {m.label}
                                    {m.label === openInvoiceLabel && (
                                        <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Aberta</span>
                                    )}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    {monthsList.map(m => (
                        <TabsContent key={m.label} value={m.label} className="mt-0 focus-visible:outline-none">
                            <InvoiceList
                                transactions={filterByHolder(invoices[m.label] || [], holderFilter)}
                                categories={categories}
                                onEditSuccess={loadInvoices}
                                openGroups={openGroups}
                                onToggleGroup={toggleGroup}
                                showHolder={cardHolders.length > 1}
                                grandTotal={holderFilter
                                    ? (invoices[m.label] || []).reduce((acc, item) => acc + item.amount, 0)
                                    : undefined}
                            />
                        </TabsContent>
                    ))}
                </Panel>
            </Tabs>
        </div>
    );
}
