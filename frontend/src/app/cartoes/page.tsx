"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlusCircle, CreditCard as CreditCardIcon, FileText, Edit2, Repeat, RotateCcw } from "lucide-react";
import { CreditCardTransactionModal } from "@/components/CreditCardTransactionModal";
import { CreateCardModal } from "@/components/CreateCardModal";
import { PdfImportModal } from "@/components/PdfImportModal";
import { EstornoModal } from "@/components/EstornoModal";
import { ApiCategory, ICONS_MAP } from "@/components/CreateCategoryModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Helper: Formatter
const formatBRL = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
};

const formatDay = (dateString: string) => {
    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short"
    }).format(new Date(dateString));
};

type ApiCard = {
    id: string;
    name: string;
    limit: number;
    invoiceClosingOffset: number;
    dueDay: number;
    color?: string;
};

type ApiInvoiceItem = {
    id: string;
    date: string;
    description: string;
    amount: number;
    installments: number;
    categoryId?: string;
    creditCardId: string;
};

// Removed MOCK data

function InvoiceList({ transactions, categories, onEditSuccess }: { transactions: any[], categories: ApiCategory[], onEditSuccess: () => void }) {
    if (transactions.length === 0) {
        return (
            <div className="flex flex-col flex-1 items-center justify-center p-8 text-center bg-gray-50 border border-dashed rounded-md">
                <FileText className="h-8 w-8 text-gray-400 mb-2" />
                <p className="text-gray-500 text-sm">Nenhuma transação nesta fatura.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 mt-4">
            {transactions.map((tx) => {
                const category = categories.find(c => c.id === tx.categoryId);
                const IconComponent = category?.icon && ICONS_MAP[category.icon]
                    ? ICONS_MAP[category.icon]
                    : null;

                return (
                    <div key={tx.id} className="flex items-center justify-between p-4 bg-white border rounded-lg hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-4">
                            {IconComponent ? (
                                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${category?.color || 'bg-gray-800'}`}>
                                    <IconComponent className="h-5 w-5" />
                                </div>
                            ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-semibold text-xs">
                                    {formatDay(tx.date)}
                                </div>
                            )}
                            <div>
                                <p className="font-medium text-gray-900 flex items-center gap-2">
                                    {tx.description}
                                    {tx.installments > 1 && (
                                        <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-100">
                                            Parcela vinculada ({tx.installments}x)
                                        </Badge>
                                    )}
                                    {tx.isFixed && (
                                        <Badge variant="secondary" className="text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1">
                                            <Repeat className="h-3 w-3" />
                                            Fixo
                                        </Badge>
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="text-right flex items-center justify-end gap-1">
                            <p className="font-semibold mr-2 tabular-nums"
                                style={{ color: tx.amount < 0 ? '#059669' : undefined }}>
                                {formatBRL(tx.amount)}
                            </p>
                            {/* Estorno — only for positive (non-credit) transactions */}
                            {tx.amount > 0 && (
                                <EstornoModal
                                    transactionId={tx.id}
                                    description={tx.description}
                                    amount={Math.abs(tx.amount)}
                                    onSuccess={onEditSuccess}
                                >
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-amber-500 transition-colors" title="Estornar">
                                        <RotateCcw className="h-4 w-4" />
                                    </Button>
                                </EstornoModal>
                            )}
                            <CreditCardTransactionModal initialData={tx} onSuccess={onEditSuccess}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-indigo-600 transition-colors">
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                            </CreditCardTransactionModal>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

import { useState, useEffect, useCallback, useMemo } from "react";

export default function CartoesPage() {
    const monthsList = useMemo(() => {
        const list = [];
        let current = new Date();
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

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [cardRes, catRes] = await Promise.all([
                    fetch("http://localhost:3333/credit-cards"),
                    fetch("http://localhost:3333/categories")
                ]);

                if (cardRes.ok) {
                    const cards = await cardRes.json();
                    setAllCards(cards);
                    if (cards.length > 0) {
                        setCard(cards[0]);
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

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500 animate-pulse">Buscando fatura no servidor...</div>;
    }

    if (!card) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-xl mt-8 max-w-4xl bg-gray-50">
                <CreditCardIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Nenhum cartão encontrado</h3>
                <p className="mt-2 text-gray-500 max-w-sm mb-6">Comece adicionando o seu primeiro Cartão de Crédito para gerenciar suas faturas aqui.</p>
                <CreateCardModal>
                    <Button className="bg-emerald-600 hover:bg-emerald-700">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Cadastrar Cartão
                    </Button>
                </CreateCardModal>
            </div>
        );
    }

    const currentInvoiceTotal = (invoices[activeTab] || []).reduce((acc, curr) => acc + curr.amount, 0);
    const percentUsed = Math.min((currentInvoiceTotal / card.limit) * 100, 100);

    return (
        <div className="space-y-8 max-w-4xl mx-auto w-full">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900">Cartões de Crédito</h2>
                    <p className="mt-1 text-gray-500">Acompanhe seus limites e faturas.</p>
                </div>
                <div className="flex items-center gap-4">
                    {allCards.length > 1 && (
                        <Select onValueChange={(id) => setCard(allCards.find(c => c.id === id) || null)} value={card.id}>
                            <SelectTrigger className="w-[180px] h-10 bg-white">
                                <SelectValue placeholder="Selecione o Cartão" />
                            </SelectTrigger>
                            <SelectContent>
                                {allCards.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <CreditCardTransactionModal onSuccess={loadInvoices}>
                        <Button className="bg-emerald-600 hover:bg-emerald-700">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Lançar Despesa
                        </Button>
                    </CreditCardTransactionModal>
                    <PdfImportModal
                        cards={allCards}
                        categories={categories}
                        currentCardId={card.id}
                        onSuccess={loadInvoices}
                    >
                        <Button variant="outline" className="border-indigo-300 text-indigo-700 hover:bg-indigo-50">
                            <FileText className="mr-2 h-4 w-4" />
                            Importar PDF
                        </Button>
                    </PdfImportModal>
                </div>
            </div>

            {/* Credit Card Widget */}
            <Card className="overflow-hidden border-0 shadow-lg">
                <div className={`bg-gradient-to-br ${card.color || 'from-purple-700 to-purple-900'} text-white p-6 sm:p-8`}>
                    <div className="flex justify-between items-start mb-8">
                        <div className="flex items-center gap-2">
                            <CreditCardIcon className="h-6 w-6 opacity-80" />
                            <span className="font-medium text-lg tracking-wide">{card.name}</span>
                        </div>
                        <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm" title="A fatura geralmente fecha nestes dias de antecedência.">
                            Fechamento ~{card.invoiceClosingOffset} dias antes do vcto.
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-12 items-end">
                        <div className="flex flex-col gap-1">
                            <p className="text-purple-200 text-sm uppercase tracking-wider font-medium">Fatura {activeTab}</p>
                            <p className="text-3xl sm:text-4xl font-bold tracking-tight">
                                {formatBRL(currentInvoiceTotal)}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-purple-200/80">Todos os Cartões:</span>
                                <span className="text-sm font-medium">{formatBRL(globalTotals[activeTab] || 0)}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-purple-200 text-sm mb-1 uppercase tracking-wider font-medium">Limite Disp.</p>
                            <p className="text-xl font-medium">
                                {formatBRL(card.limit - currentInvoiceTotal)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Progress Bar Section (Inside Card bottom part) */}
                <CardContent className="bg-white p-4 sm:p-6 border-t">
                    <div className="flex justify-between items-center mb-2 text-sm">
                        <span className="text-gray-600 font-medium">Uso do Limite</span>
                        <span className="text-gray-900 font-bold">{percentUsed.toFixed(1)}%</span>
                    </div>
                    <Progress value={percentUsed} className="h-3" />
                    <p className="text-xs text-center text-gray-400 mt-3">
                        Limite total de {formatBRL(card.limit)}
                    </p>
                </CardContent>
            </Card>

            {/* Invoices Tabs */}
            <div className="mt-8">
                <h3 className="text-xl font-bold tracking-tight text-gray-900 mb-4">Lançamentos</h3>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 w-full gap-1 mb-6 p-1 h-auto bg-gray-100 rounded-md">
                        {monthsList.map(m => (
                            <TabsTrigger key={m.label} value={m.label} className="data-[state=active]:bg-white px-2 sm:px-4 py-2 text-xs sm:text-sm">
                                {m.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {monthsList.map(m => (
                        <TabsContent key={m.label} value={m.label} className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                            <InvoiceList transactions={invoices[m.label] || []} categories={categories} onEditSuccess={loadInvoices} />
                        </TabsContent>
                    ))}
                </Tabs>
            </div>

        </div>
    );
}
