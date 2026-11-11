import type { LucideIcon } from "lucide-react";
import { Landmark, ChartCandlestick, Globe, Bitcoin, Wallet } from "lucide-react";

export type InvestmentType = "FIXED_INCOME" | "VARIABLE_INCOME" | "CRYPTO" | "US_STOCK" | "OTHER";

export type ApiInvestment = {
    id: string;
    name: string;
    type: InvestmentType;
    investedAmount: number;
    currentValue: number;
    cdiPercentage?: number;
    investmentDate?: string;

    // Variable income fields
    sector?: string;
    tickerCode?: string;
    averagePrice?: number;
    currentPrice?: number;
    quantity?: number;

    // Calculated fields sent by backend (fixed income)
    daysInvested?: number;
    grossValue?: number;
    taxAmount?: number;
    netValue?: number;
    irTaxRate?: number;

    // US stocks/ETFs (prices in USD, values in BRL unless suffixed Usd)
    purchaseExchangeRate?: number;
    currentExchangeRate?: number;
    investedUsd?: number;
    currentValueUsd?: number;
    assetGainBrl?: number;
    fxGainBrl?: number;
    priceIsLive?: boolean;
};

export const INVESTMENT_CLASSES: Record<InvestmentType, { title: string; icon: LucideIcon }> = {
    FIXED_INCOME: { title: "Renda Fixa", icon: Landmark },
    VARIABLE_INCOME: { title: "Ações e FIIs", icon: ChartCandlestick },
    US_STOCK: { title: "Ações e ETFs Intern.", icon: Globe },
    CRYPTO: { title: "Criptomoedas", icon: Bitcoin },
    OTHER: { title: "Outros", icon: Wallet },
};

export const CLASS_ORDER: InvestmentType[] = ["FIXED_INCOME", "VARIABLE_INCOME", "US_STOCK", "CRYPTO", "OTHER"];

/** Current BRL value of a position, consistent across all pages. */
export const currentValueOf = (inv: ApiInvestment): number => {
    if (inv.type === "VARIABLE_INCOME" || inv.type === "CRYPTO") {
        return inv.currentPrice != null ? inv.currentPrice * (inv.quantity ?? 0) : inv.currentValue;
    }
    if (inv.type === "US_STOCK") {
        return inv.currentValue;
    }
    return inv.netValue ?? inv.currentValue;
};

export const profitPctOf = (inv: ApiInvestment): number =>
    inv.investedAmount > 0 ? ((currentValueOf(inv) - inv.investedAmount) / inv.investedAmount) * 100 : 0;

export type ClassStats = {
    count: number;
    invested: number;
    current: number;
    profit: number;
    profitPct: number;
    portfolioPct: number;
};

export const computeClassStats = (invs: ApiInvestment[], portfolioTotal: number): ClassStats => {
    const invested = invs.reduce((acc, i) => acc + i.investedAmount, 0);
    const current = invs.reduce((acc, i) => acc + currentValueOf(i), 0);
    const profit = current - invested;
    return {
        count: invs.length,
        invested,
        current,
        profit,
        profitPct: invested > 0 ? (profit / invested) * 100 : 0,
        portfolioPct: portfolioTotal > 0 ? (current / portfolioTotal) * 100 : 0,
    };
};
