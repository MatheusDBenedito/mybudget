// Account helpers. Pure functions (no React/aliases) so they can run under `node --test`.

export type AccountType = "CHECKING" | "YIELDING";
export type AccountCurrency = "BRL" | "USD";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
    CHECKING: "Conta corrente",
    YIELDING: "Conta remunerada",
};

export const ACCOUNT_CURRENCY_LABELS: Record<AccountCurrency, string> = {
    BRL: "Real (R$)",
    USD: "Dólar (US$)",
};

export type AccountLike = {
    id: string;
    name: string;
    balance: number;
    grossBalance?: number;
    taxAmount?: number;
    currency?: AccountCurrency;
    balanceUsd?: number | null;
    investedBrl?: number | null;
    purchaseExchangeRate?: number | null;
    currentExchangeRate?: number | null;
    variationBrl?: number;
    variationPct?: number;
    type?: AccountType;
    cdiPercentage?: number | null;
    /** Balance outside the cofrinhos (yielding accounts) */
    freeBalance?: number;
};

export const isYielding = (account: AccountLike) => account.type === "YIELDING" && account.currency !== "USD";

export const isUsdAccount = (account: AccountLike) => account.currency === "USD";

const round2 = (v: number) => Math.round(v * 100) / 100;
const round4 = (v: number) => Math.round(v * 10000) / 10000;

export type UsdAccountMetrics = {
    balanceUsd: number;
    investedBrl: number;
    purchaseExchangeRate: number | null;
    currentExchangeRate: number | null;
    currentBalanceBrl: number;
    variationBrl: number;
    variationPct: number;
};

/**
 * Pure calculator for USD accounts:
 * - Resolves investedBrl and purchaseExchangeRate from whichever was informed
 * - Calculates currentBalanceBrl based on today's USD rate (or purchase rate fallback)
 * - Calculates variationBrl and variationPct relative to the BRL amount spent at purchase
 */
export function computeUsdAccountMetrics(input: {
    balanceUsd?: number | null;
    investedBrl?: number | null;
    purchaseExchangeRate?: number | null;
    currentExchangeRate?: number | null;
    fallbackBalanceBrl?: number | null;
}): UsdAccountMetrics {
    const balanceUsd = round2(input.balanceUsd ?? 0);
    let investedBrl = input.investedBrl != null ? round2(input.investedBrl) : null;
    let purchaseRate = input.purchaseExchangeRate != null && input.purchaseExchangeRate > 0
        ? round4(input.purchaseExchangeRate)
        : null;

    if (balanceUsd > 0) {
        if (investedBrl != null && purchaseRate == null) {
            purchaseRate = round4(investedBrl / balanceUsd);
        } else if (purchaseRate != null && investedBrl == null) {
            investedBrl = round2(balanceUsd * purchaseRate);
        }
    }

    const currentRate = input.currentExchangeRate != null && input.currentExchangeRate > 0
        ? round4(input.currentExchangeRate)
        : purchaseRate;

    const currentBalanceBrl = currentRate != null
        ? round2(balanceUsd * currentRate)
        : round2(input.fallbackBalanceBrl ?? investedBrl ?? 0);

    const resolvedInvestedBrl = round2(investedBrl ?? currentBalanceBrl);
    const variationBrl = round2(currentBalanceBrl - resolvedInvestedBrl);
    const variationPct = resolvedInvestedBrl > 0
        ? round2(((currentBalanceBrl - resolvedInvestedBrl) / resolvedInvestedBrl) * 100)
        : 0;

    return {
        balanceUsd,
        investedBrl: resolvedInvestedBrl,
        purchaseExchangeRate: purchaseRate,
        currentExchangeRate: currentRate,
        currentBalanceBrl,
        variationBrl,
        variationPct,
    };
}

/** Short description of the yield, e.g. "Rende 100% do CDI". */
export const yieldLabel = (account: AccountLike) =>
    isYielding(account) && account.cdiPercentage
        ? `Rende ${account.cdiPercentage.toLocaleString("pt-BR")}% do CDI`
        : "Não rende";

/** Money that can leave the account directly: what is kept in cofrinhos must be withdrawn first. */
export const transferableBalance = (account: AccountLike) => account.freeBalance ?? account.balance;

export type TransferCheck = { error: string | null; warning: string | null };

/**
 * Validates a transfer between own accounts before sending it.
 * Blocks: same account, missing/zero amount, more than the free balance of an account with cofrinhos.
 * Warns (doesn't block): the source account would go negative.
 */
export function checkTransfer(
    accounts: AccountLike[],
    input: { fromId: string; toId: string; amount: number | undefined },
): TransferCheck {
    const from = accounts.find(a => a.id === input.fromId);
    const to = accounts.find(a => a.id === input.toId);
    if (!from || !to) return { error: "Escolha as contas de origem e destino.", warning: null };
    if (from.id === to.id) return { error: "Escolha contas diferentes para origem e destino.", warning: null };
    if (!(input.amount && input.amount > 0)) return { error: "Informe o valor.", warning: null };

    const hasPots = from.freeBalance !== undefined && from.freeBalance < from.balance - 0.005;
    if (hasPots && input.amount > from.freeBalance! + 0.005) {
        return { error: "Valor maior que o saldo fora dos cofrinhos. Retire do cofrinho antes de transferir.", warning: null };
    }
    if (input.amount > from.balance + 0.005) {
        return { error: null, warning: `${from.name.trim()} ficará com saldo negativo.` };
    }
    return { error: null, warning: null };
}

/** Accounts in the order they should be offered to pay an expense: checking accounts first (stable). */
export function sortForPayment<T extends AccountLike>(accounts: T[]): T[] {
    return [...accounts].sort((a, b) => Number(isYielding(a)) - Number(isYielding(b)));
}

/**
 * Account pre-selected when settling a transaction.
 * Expenses come out of a checking account so money in yielding accounts keeps earning:
 * the transaction's own account if it is a checking account, otherwise the first checking account.
 * Incomes keep the transaction's own account.
 * Falls back to the first available account.
 */
export function defaultSettlementAccount<T extends AccountLike>(
    accounts: T[],
    kind: "INCOME" | "EXPENSE",
    preferredId?: string,
): T | undefined {
    const preferred = accounts.find(a => a.id === preferredId);
    if (kind === "EXPENSE") {
        if (preferred && !isYielding(preferred)) return preferred;
        return accounts.find(a => !isYielding(a)) ?? preferred ?? accounts[0];
    }
    return preferred ?? accounts[0];
}
