import type { LucideIcon } from "lucide-react";
import { Landmark, ChartCandlestick, Building2, Globe, Bitcoin, Wallet } from "lucide-react";

export type InvestmentType = "FIXED_INCOME" | "VARIABLE_INCOME" | "FII" | "CRYPTO" | "US_STOCK" | "OTHER";

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

    // US stocks/ETFs and Crypto (USD prices and values)
    purchaseExchangeRate?: number;
    currentExchangeRate?: number;
    averagePriceUsd?: number;
    currentPriceUsd?: number;
    investedUsd?: number;
    currentValueUsd?: number;
    assetGainBrl?: number;
    fxGainBrl?: number;
    priceIsLive?: boolean;

    // Linked bank/brokerage account for automatic dividend credits
    accountId?: string | null;
    account?: { id: string; name: string; currency: string } | null;
};

export const INVESTMENT_CLASSES: Record<InvestmentType, { title: string; icon: LucideIcon }> = {
    FIXED_INCOME: { title: "Renda Fixa", icon: Landmark },
    VARIABLE_INCOME: { title: "Ações", icon: ChartCandlestick },
    FII: { title: "Fundos Imobiliários (FIIs)", icon: Building2 },
    US_STOCK: { title: "Ações e ETFs Intern.", icon: Globe },
    CRYPTO: { title: "Criptomoedas", icon: Bitcoin },
    OTHER: { title: "Outros", icon: Wallet },
};

export const CLASS_ORDER: InvestmentType[] = ["FIXED_INCOME", "VARIABLE_INCOME", "FII", "US_STOCK", "CRYPTO", "OTHER"];

/** Current BRL value of a position (net of IR for fixed income), consistent across all pages. */
export const currentValueOf = (inv: ApiInvestment): number => {
    if (inv.type === "VARIABLE_INCOME" || inv.type === "FII" || inv.type === "CRYPTO") {
        return inv.currentPrice != null ? inv.currentPrice * (inv.quantity ?? 0) : inv.currentValue;
    }
    if (inv.type === "US_STOCK") {
        return inv.currentValue;
    }
    return inv.netValue ?? inv.currentValue;
};

/** Gross BRL value of a position (before IR deduction on fixed income). */
export const grossValueOf = (inv: ApiInvestment): number => {
    if (inv.type === "FIXED_INCOME" && inv.grossValue != null) {
        return inv.grossValue;
    }
    return currentValueOf(inv);
};

/** Estimated IR tax of a position (for fixed income). */
export const taxAmountOf = (inv: ApiInvestment): number => {
    if (inv.type === "FIXED_INCOME" && inv.taxAmount != null) {
        return inv.taxAmount;
    }
    return Math.max(grossValueOf(inv) - currentValueOf(inv), 0);
};

export const profitPctOf = (inv: ApiInvestment): number =>
    inv.investedAmount > 0 ? ((currentValueOf(inv) - inv.investedAmount) / inv.investedAmount) * 100 : 0;

export type ConsolidatedInvestment = ApiInvestment & {
    groupKey: string;
    lots: ApiInvestment[];
    contributionsCount: number;
};

const round2 = (v: number) => Math.round(v * 100) / 100;
const round8 = (v: number) => Math.round(v * 1e8) / 1e8;

export function assetGroupKey(inv: Pick<ApiInvestment, "type" | "tickerCode" | "name">): string {
    const ticker = inv.tickerCode?.trim().toUpperCase();
    const name = inv.name.trim().toUpperCase();
    return `${inv.type}:${ticker || name}`;
}

function sortLotsChronologically(lots: ApiInvestment[]): ApiInvestment[] {
    return [...lots].sort((a, b) => {
        const ta = a.investmentDate ? new Date(a.investmentDate).getTime() : Number.POSITIVE_INFINITY;
        const tb = b.investmentDate ? new Date(b.investmentDate).getTime() : Number.POSITIVE_INFINITY;
        const validA = Number.isFinite(ta) ? ta : Number.POSITIVE_INFINITY;
        const validB = Number.isFinite(tb) ? tb : Number.POSITIVE_INFINITY;
        if (validA !== validB) return validA - validB;
        return a.id.localeCompare(b.id);
    });
}

/**
 * Consolidates multiple investment lots (aportes) of the same asset into a single position
 * while preserving the chronological list of individual contributions (`lots`).
 */
export function consolidateInvestments(invs: ApiInvestment[]): ConsolidatedInvestment[] {
    const groups = new Map<string, ApiInvestment[]>();

    for (const inv of invs) {
        const key = assetGroupKey(inv);
        const list = groups.get(key);
        if (list) {
            list.push(inv);
        } else {
            groups.set(key, [inv]);
        }
    }

    const result: ConsolidatedInvestment[] = [];

    for (const [groupKey, rawLots] of groups.entries()) {
        const lots = sortLotsChronologically(rawLots);
        const first = lots[0];
        const contributionsCount = lots.length;

        if (contributionsCount === 1) {
            result.push({
                ...first,
                groupKey,
                lots,
                contributionsCount: 1,
            });
            continue;
        }

        const name = lots.find(l => l.name?.trim())?.name ?? first.name;
        const tickerCode = lots.find(l => l.tickerCode?.trim())?.tickerCode?.trim().toUpperCase() ?? first.tickerCode;
        const sector = lots.find(l => l.sector?.trim())?.sector ?? first.sector;
        const investmentDate = lots.find(l => l.investmentDate)?.investmentDate ?? first.investmentDate;

        if (first.type === "VARIABLE_INCOME" || first.type === "FII" || first.type === "CRYPTO") {
            const quantity = round8(lots.reduce((sum, l) => sum + (l.quantity ?? 0), 0));
            const totalInvested = lots.reduce((sum, l) => {
                const lotQty = l.quantity ?? 0;
                const lotAvg = l.averagePrice ?? 0;
                return sum + (lotQty > 0 && lotAvg > 0 ? lotAvg * lotQty : l.investedAmount);
            }, 0);
            const averagePrice = quantity > 0 ? totalInvested / quantity : (first.averagePrice ?? 0);
            const liveLot = lots.find(l => l.currentPrice != null);
            const currentPrice = liveLot?.currentPrice ?? first.currentPrice ?? averagePrice;
            const currentValue = round2(
                currentPrice != null
                    ? currentPrice * quantity
                    : lots.reduce((sum, l) => sum + currentValueOf(l), 0),
            );
            const hasUsdCost = lots.some(l => l.averagePriceUsd != null);
            const totalInvestedUsd = hasUsdCost
                ? lots.reduce((sum, l) => sum + (l.investedUsd ?? (l.averagePriceUsd ?? 0) * (l.quantity ?? 0)), 0)
                : undefined;
            const averagePriceUsd = totalInvestedUsd != null && quantity > 0 ? totalInvestedUsd / quantity : first.averagePriceUsd;
            const currentPriceUsd = liveLot?.currentPriceUsd ?? first.currentPriceUsd;

            result.push({
                ...first,
                id: first.id,
                name,
                tickerCode,
                sector,
                investmentDate,
                quantity,
                averagePrice,
                currentPrice,
                averagePriceUsd,
                currentPriceUsd,
                investedUsd: totalInvestedUsd != null ? round2(totalInvestedUsd) : first.investedUsd,
                currentValueUsd: currentPriceUsd != null ? round2(currentPriceUsd * quantity) : first.currentValueUsd,
                investedAmount: round2(totalInvested),
                currentValue,
                groupKey,
                lots,
                contributionsCount,
            });
            continue;
        }

        if (first.type === "US_STOCK") {
            const quantity = round8(lots.reduce((sum, l) => sum + (l.quantity ?? 0), 0));
            const investedUsd = round2(
                lots.reduce((sum, l) => sum + (l.investedUsd ?? (l.averagePrice ?? 0) * (l.quantity ?? 0)), 0),
            );
            const averagePrice = quantity > 0 ? investedUsd / quantity : (first.averagePrice ?? 0);
            const currentPrice = lots.find(l => l.currentPrice != null)?.currentPrice ?? averagePrice;
            const currentValueUsd = round2(
                lots.reduce((sum, l) => sum + (l.currentValueUsd ?? (l.currentPrice ?? l.averagePrice ?? 0) * (l.quantity ?? 0)), 0),
            );
            const investedAmount = round2(lots.reduce((sum, l) => sum + l.investedAmount, 0));
            const currentValue = round2(lots.reduce((sum, l) => sum + l.currentValue, 0));
            const purchaseExchangeRate = investedUsd > 0
                ? Number((investedAmount / investedUsd).toFixed(4))
                : first.purchaseExchangeRate;
            const currentExchangeRate = lots.find(l => l.currentExchangeRate != null)?.currentExchangeRate;
            const assetGainBrl = round2(lots.reduce((sum, l) => sum + (l.assetGainBrl ?? 0), 0));
            const fxGainBrl = round2(lots.reduce((sum, l) => sum + (l.fxGainBrl ?? 0), 0));
            const priceIsLive = lots.every(l => l.priceIsLive !== false);

            result.push({
                ...first,
                id: first.id,
                name,
                tickerCode,
                sector,
                investmentDate,
                quantity,
                averagePrice,
                currentPrice,
                investedUsd,
                currentValueUsd,
                investedAmount,
                currentValue,
                purchaseExchangeRate,
                currentExchangeRate,
                assetGainBrl,
                fxGainBrl,
                priceIsLive,
                groupKey,
                lots,
                contributionsCount,
            });
            continue;
        }

        if (first.type === "FIXED_INCOME") {
            const investedAmount = round2(lots.reduce((sum, l) => sum + l.investedAmount, 0));
            const grossValue = round2(lots.reduce((sum, l) => sum + (l.grossValue ?? l.currentValue), 0));
            const taxAmount = round2(lots.reduce((sum, l) => sum + (l.taxAmount ?? 0), 0));
            const netValue = round2(lots.reduce((sum, l) => sum + (l.netValue ?? l.currentValue), 0));
            const weightedCdi = investedAmount > 0
                ? round2(lots.reduce((sum, l) => sum + (l.cdiPercentage ?? 0) * l.investedAmount, 0) / investedAmount)
                : first.cdiPercentage;
            const daysInvested = Math.max(...lots.map(l => l.daysInvested ?? 0));
            const grossProfit = grossValue - investedAmount;
            const irTaxRate = grossProfit > 0 && taxAmount > 0
                ? round2((taxAmount / grossProfit) * 100)
                : first.irTaxRate;

            result.push({
                ...first,
                id: first.id,
                name,
                investmentDate,
                investedAmount,
                currentValue: netValue,
                grossValue,
                taxAmount,
                netValue,
                cdiPercentage: weightedCdi || undefined,
                daysInvested: daysInvested || undefined,
                irTaxRate,
                groupKey,
                lots,
                contributionsCount,
            });
            continue;
        }

        // OTHER
        const investedAmount = round2(lots.reduce((sum, l) => sum + l.investedAmount, 0));
        const currentValue = round2(lots.reduce((sum, l) => sum + l.currentValue, 0));
        result.push({
            ...first,
            id: first.id,
            name,
            investmentDate,
            investedAmount,
            currentValue,
            groupKey,
            lots,
            contributionsCount,
        });
    }

    return result;
}

export type ClassStats = {
    count: number;
    contributionsCount: number;
    invested: number;
    gross: number;
    current: number;
    profit: number;
    profitPct: number;
    portfolioPct: number;
};

export const computeClassStats = (invs: ApiInvestment[], portfolioTotal: number): ClassStats => {
    const consolidated = consolidateInvestments(invs);
    const invested = invs.reduce((acc, i) => acc + i.investedAmount, 0);
    const gross = invs.reduce((acc, i) => acc + grossValueOf(i), 0);
    const current = invs.reduce((acc, i) => acc + currentValueOf(i), 0);
    const profit = current - invested;
    return {
        count: consolidated.length,
        contributionsCount: invs.length,
        invested,
        gross,
        current,
        profit,
        profitPct: invested > 0 ? (profit / invested) * 100 : 0,
        portfolioPct: portfolioTotal > 0 ? (current / portfolioTotal) * 100 : 0,
    };
};
