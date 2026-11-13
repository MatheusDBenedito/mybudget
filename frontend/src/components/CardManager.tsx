"use client";

import { useState, useEffect } from "react";
import { PlusCircle, CreditCard as CreditCardIcon, Edit2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CreateCardModal } from "@/components/CreateCardModal";
import { CardHoldersModal } from "@/components/CardHoldersModal";
import { holderLabel, holdersOf } from "@/lib/credit-cards";
import { API_BASE_URL } from "@/lib/auth";

type ApiCardHolder = {
    id: string;
    name: string;
    last4?: string | null;
    isMain: boolean;
};

// Tipagem equivalente a que recebemos da API
type ApiCard = {
    id: string;
    name: string;
    limit: number;
    invoiceClosingOffset: number;
    dueDay: number;
    color?: string;
    pointsPerDollar?: number | null;
    loyaltyProgram?: string | null;
    holders?: ApiCardHolder[];
};

export function CardManager() {
    const [cards, setCards] = useState<ApiCard[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadCards = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/credit-cards`);
            if (res.ok) {
                const data = await res.json();

                // Reads color from db, fallbacks to Purple if legacy
                const mapped = data.map((c: ApiCard) => ({
                    ...c,
                    color: c.color || "from-purple-600 to-purple-900",
                }));

                setCards(mapped);
            }
        } catch (error) {
            console.error("Erro ao carregar cartões:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadCards();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Seus Cartões</h3>
                    <p className="text-sm text-gray-500">
                        Adicione cartões para acompanhar faturas, portadores adicionais e limites.
                    </p>
                </div>

                <CreateCardModal onSuccess={loadCards}>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Novo Cartão
                    </Button>
                </CreateCardModal>
            </div>

            {isLoading ? (
                <div className="py-12 text-center">
                    <p className="text-sm text-gray-500 animate-pulse">Carregando seus cartões...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cards.map((card) => {
                        const holders = holdersOf(card.holders);
                        return (
                            <div
                                key={card.id}
                                className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${card.color} p-6 shadow-md text-white group`}
                            >
                                <div className="flex justify-between items-start mb-8">
                                    <CreditCardIcon className="h-8 w-8 opacity-80" />
                                    <div className="flex items-center gap-1">
                                        <CardHoldersModal cardId={card.id} cardName={card.name} onChanged={loadCards}>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Gerenciar portadores"
                                                aria-label={`Gerenciar portadores de ${card.name}`}
                                                className="h-8 w-8 text-white/80 hover:text-white hover:bg-black/20"
                                            >
                                                <Users className="h-4 w-4" />
                                            </Button>
                                        </CardHoldersModal>
                                        <CreateCardModal initialData={card} onSuccess={loadCards}>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Editar cartão"
                                                aria-label={`Editar ${card.name}`}
                                                className="h-8 w-8 text-white/80 hover:text-white hover:bg-black/20"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                        </CreateCardModal>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <h4 className="font-medium text-white/90">{card.name}</h4>
                                    <p className="text-2xl font-bold tracking-tight">
                                        {new Intl.NumberFormat("pt-BR", {
                                            style: "currency",
                                            currency: "BRL",
                                        }).format(card.limit)}
                                    </p>
                                </div>

                                <div className="mt-6 flex gap-6 text-xs text-white/70">
                                    <div>
                                        <span className="block font-medium mb-1">FECHAMENTO</span>
                                        <span className="text-sm text-white" title="Dias antes do Vencimento">~{card.invoiceClosingOffset} d.</span>
                                    </div>
                                    <div>
                                        <span className="block font-medium mb-1">VENCIMENTO</span>
                                        <span className="text-sm text-white">Dia {card.dueDay}</span>
                                    </div>
                                    <div>
                                        <span className="block font-medium mb-1">PONTOS</span>
                                        <span className="text-sm text-white">
                                            {card.pointsPerDollar
                                                ? `${card.pointsPerDollar.toLocaleString("pt-BR")} pts/US$${card.loyaltyProgram ? ` · ${card.loyaltyProgram}` : ""}`
                                                : "Não pontua"}
                                        </span>
                                    </div>
                                </div>

                                {holders.length > 0 && (
                                    <p className="mt-4 truncate border-t border-white/15 pt-3 text-xs text-white/80">
                                        Portadores: {holders.map(h => `${holderLabel(h)}${h.isMain ? " (titular)" : ""}`).join(" · ")}
                                    </p>
                                )}
                            </div>
                        );
                    })}

                    {cards.length === 0 && (
                        <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl border-gray-200">
                            <CreditCardIcon className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                            <h3 className="text-sm font-medium text-gray-900">Nenhum cartão</h3>
                            <p className="mt-1 text-sm text-gray-500">Você ainda não tem cartões cadastrados.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
