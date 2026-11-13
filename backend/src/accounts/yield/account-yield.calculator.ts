// Pure daily-yield math for yielding accounts and their pots ("cofrinhos").
// No Prisma/Nest so it can be unit tested directly.
//
// Model: every deposit into a bucket (the account's free balance or a pot) is a separate lot with its own start date.
// Each business day every lot yields; each day's IR follows the regressive table by the lot's age on that day. As in
// Mercado Pago, IR already withheld is not refunded when a lot reaches a lower bracket (only the following days are
// taxed at the lower rate). Withdrawals consume the oldest lots first (PEPS/FIFO).

export type DailyCdi = {
    /** yyyy-mm-dd */
    date: string;
    /** Daily CDI in percent, as published by BCB series 12 (e.g. 0.055131) */
    ratePercent: number;
};

/** A deposit (+) or withdrawal (-) on a bucket, excluding yields. */
export type BalanceMovement = {
    /** yyyy-mm-dd: day the money moved */
    date: string;
    delta: number;
};

export type DailyYield = {
    date: string;
    cdiDailyRate: number;
    cdiPercentage: number;
    /** Bucket balance at the end of the day the yield refers to */
    balanceBefore: number;
    grossAmount: number;
    /** Effective rate of the day (tax / gross), lots weighted by their yield */
    irRate: number;
    taxAmount: number;
    netAmount: number;
    /** IR given back by lots that reached a lower bracket */
    taxRefund: number;
};

export type LotSnapshot = {
    /** Start date of the lot (deposit day) */
    date: string;
    principal: number;
    gross: number;
    tax: number;
    value: number;
    ageDays: number;
    irRate: number;
};

/** `date` = deposit day (IR clock); `yieldFrom` = first business day the deposit earns CDI */
type Lot = { date: string; yieldFrom: string; principal: number; gross: number; tax: number };

const NOT_YET = '9999-12-31';

/**
 * First business day a deposit made on `dateKey` earns CDI: the day itself, or the next business day when made on a
 * weekend/holiday. Mercado Pago posts each day's yield early on the following business day, so a deposit on Sunday
 * 12/04 earns the CDI of Monday 13/04, shown in the app on Tuesday 14/04.
 * `businessDays` are the CDI dates (BCB publishes only business days), sorted.
 */
export function firstYieldDay(dateKey: string, businessDays: string[]): string {
    return businessDays.find(d => d >= dateKey) ?? NOT_YET;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
/** Drops fractions of a cent (tolerates float noise like 0.06999999). */
const truncate2 = (v: number) => Math.floor(v * 100 + 1e-9) / 100;
const EPSILON = 0.005;
const MS_PER_DAY = 86_400_000;

/** "dd/MM/yyyy" (BCB format) -> "yyyy-mm-dd" */
export function bcbDateToKey(bcbDate: string): string {
    const [dd, mm, yyyy] = bcbDate.split('/');
    return `${yyyy}-${mm}-${dd}`;
}

/** Local calendar day as "yyyy-mm-dd" (avoids UTC shifting the day). */
export function toDateKey(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/** Calendar days between two yyyy-mm-dd keys (b - a). */
export function daysBetween(a: string, b: string): number {
    return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / MS_PER_DAY);
}

// Brazilian regressive IOF table for fixed income (days 1 to 29; 0% from day 30 onwards)
export const IOF_RATES_BY_DAY: Record<number, number> = {
    1: 0.96, 2: 0.93, 3: 0.90, 4: 0.86, 5: 0.83,
    6: 0.80, 7: 0.76, 8: 0.73, 9: 0.70, 10: 0.66,
    11: 0.63, 12: 0.60, 13: 0.56, 14: 0.53, 15: 0.50,
    16: 0.46, 17: 0.43, 18: 0.40, 19: 0.36, 20: 0.33,
    21: 0.30, 22: 0.26, 23: 0.23, 24: 0.20, 25: 0.16,
    26: 0.13, 27: 0.10, 28: 0.06, 29: 0.03,
};

export function iofRateForDays(days: number): number {
    if (days <= 0) return 0.96;
    if (days >= 30) return 0;
    return IOF_RATES_BY_DAY[days] ?? 0;
}

/** Brazilian regressive IR table for fixed income, by calendar days since the deposit. */
export function irRateForDays(days: number): number {
    if (days <= 180) return 0.225;
    if (days <= 360) return 0.2;
    if (days <= 720) return 0.175;
    return 0.15;
}

const lotValue = (lot: Lot) => lot.principal + lot.gross - lot.tax;

/** Removes `amount` from the oldest lots first, scaling a partially withdrawn lot proportionally. */
function withdrawFifo(lots: Lot[], amount: number): void {
    let remaining = amount;
    while (remaining > EPSILON && lots.length > 0) {
        const lot = lots[0];
        const value = lotValue(lot);
        if (value <= remaining + EPSILON) {
            remaining -= value;
            lots.shift();
        } else {
            const keep = 1 - remaining / value;
            lot.principal *= keep;
            lot.gross *= keep;
            lot.tax *= keep;
            remaining = 0;
        }
    }
}

function applyMovement(lots: Lot[], movement: BalanceMovement, businessDays: string[]): void {
    if (movement.delta > 0) {
        lots.push({
            date: movement.date, yieldFrom: firstYieldDay(movement.date, businessDays),
            principal: movement.delta, gross: 0, tax: 0,
        });
    } else if (movement.delta < 0) {
        withdrawFifo(lots, -movement.delta);
    }
}

export type SimulateBucketInput = {
    /** First day the bucket yields (account became yielding / pot creation) */
    startKey: string;
    todayKey: string;
    cdiPercentage: number;
    cdiDays: DailyCdi[];
    /** Balance at the start of `startKey`, before that day's movements (becomes the first lot) */
    openingBalance: number;
    /** Deposits/withdrawals on or after `startKey` (yields excluded) */
    movements: BalanceMovement[];
    /** Days already credited: simulated (so lots evolve) but not returned as new credits */
    creditedKeys: Set<string>;
    /** Whether IOF is charged on earnings during the first 30 days (false = isento, e.g. Mercado Pago) */
    hasIof?: boolean;
};

export type SimulateBucketResult = {
    /** Credits still missing, one per business day, in date order */
    credits: DailyYield[];
    /** Lots as of today (after today's movements) */
    lots: LotSnapshot[];
};

/**
 * Replays a bucket day by day from its start, rebuilding the lots, and returns the daily credits still missing.
 * Only CDI business days strictly before today yield (a day's rate is published the next day). Days missed while the
 * system was off are computed with the lots that existed on each day.
 */
export function simulateBucket(input: SimulateBucketInput): SimulateBucketResult {
    const businessDays = input.cdiDays.map(d => d.date).sort();
    const lots: Lot[] = [];
    if (input.openingBalance > EPSILON) {
        lots.push({
            date: input.startKey, yieldFrom: firstYieldDay(input.startKey, businessDays),
            principal: input.openingBalance, gross: 0, tax: 0,
        });
    }

    const movementsByDay = new Map<string, BalanceMovement[]>();
    for (const m of input.movements) {
        if (m.date < input.startKey) continue;
        movementsByDay.set(m.date, [...(movementsByDay.get(m.date) ?? []), m]);
    }
    const cdiByDay = new Map(input.cdiDays.map(d => [d.date, d.ratePercent]));

    const days = [...new Set([...movementsByDay.keys(), ...cdiByDay.keys()])]
        .filter(d => d >= input.startKey && d < input.todayKey)
        .sort();

    const credits: DailyYield[] = [];
    // Exact running totals of the bucket. Each day credits the difference between the rounded totals, so
    // rounding to cents never accumulates (on small balances, rounding every day would inflate the yield).
    let cumGross = 0;
    let cumTax = 0;
    let cumRefund = 0;
    for (const day of days) {
        for (const m of movementsByDay.get(day) ?? []) applyMovement(lots, m, businessDays);

        const rate = cdiByDay.get(day);
        if (rate === undefined || !(rate > 0)) continue;

        const balanceBefore = round2(lots.reduce((acc, l) => acc + lotValue(l), 0));
        let tax = 0;
        let refund = 0;
        let dailyIrWeight = 0;
        let dailyGrossWeight = 0;
        const earning: { lot: Lot; g: number; irRate: number; iofRate: number }[] = [];
        for (const lot of lots) {
            const ageDays = daysBetween(lot.date, day);
            const irRate = irRateForDays(ageDays);
            const iofRate = input.hasIof ? iofRateForDays(ageDays) : 0;
            const value = lotValue(lot);
            // A deposit earns from the business day it settles
            if (day < lot.yieldFrom || !(value > 0) || !(input.cdiPercentage > 0)) continue;
            earning.push({ lot, irRate, iofRate, g: value * (rate / 100) * (input.cdiPercentage / 100) });
        }

        // The day's gross yield is truncated to the cent (as Mercado Pago credits it); the lots share it proportionally
        const exactGross = earning.reduce((acc, e) => acc + e.g, 0);
        const gross = truncate2(exactGross);
        const share = exactGross > 0 ? gross / exactGross : 0;
        for (const e of earning) {
            const g = e.g * share;
            // IOF incide primeiro sobre o rendimento bruto (se houver); IR incide sobre o rendimento líquido de IOF
            const iof = g * e.iofRate;
            const baseIr = Math.max(g - iof, 0);
            const t = iof + baseIr * e.irRate;
            e.lot.gross += g;
            e.lot.tax += t;
            tax += t;
            dailyIrWeight += t;
            dailyGrossWeight += g;
        }

        // Regra da virada de faixa ("Salto"):
        // A provisão contínua de IR sobre o rendimento total acumulado do lote segue a alíquota da faixa atual (t).
        // Se a alíquota atual do lote for menor que o imposto provisionado até então, a diferença é liberada
        // como ajuste positivo (taxRefund), reduzindo a trava do imposto e aumentando o saldo líquido.
        for (const lot of lots) {
            if (lot.gross > EPSILON) {
                const currentAge = daysBetween(lot.date, day);
                const currentIrRate = irRateForDays(currentAge);
                const currentIofRate = input.hasIof ? iofRateForDays(currentAge) : 0;
                const expectedIof = lot.gross * currentIofRate;
                const expectedIr = Math.max(lot.gross - expectedIof, 0) * currentIrRate;
                const maxProvisionedTax = expectedIof + expectedIr;

                if (lot.tax > maxProvisionedTax + 1e-4) {
                    const diff = lot.tax - maxProvisionedTax;
                    lot.tax = maxProvisionedTax;
                    refund += diff;
                }
            }
        }

        const [prevGross, prevTax, prevRefund] = [cumGross, cumTax, cumRefund];
        cumGross += gross;
        cumTax += tax;
        cumRefund += refund;

        if (input.creditedKeys.has(day)) continue;
        const grossAmount = round2(round2(cumGross) - round2(prevGross));
        const taxAmount = round2(round2(cumTax) - round2(prevTax));
        const taxRefund = round2(round2(cumRefund) - round2(prevRefund));
        credits.push({
            date: day,
            cdiDailyRate: rate,
            cdiPercentage: input.cdiPercentage,
            balanceBefore,
            grossAmount,
            irRate: dailyGrossWeight > 0 ? Math.round((dailyIrWeight / dailyGrossWeight) * 10000) / 10000 : irRateForDays(0),
            taxAmount,
            netAmount: round2(grossAmount - taxAmount),
            taxRefund,
        });
    }

    // Movements from today on are already in the balance: include them in the lots snapshot
    for (const [day, list] of [...movementsByDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        if (day >= input.todayKey) list.forEach(m => applyMovement(lots, m, businessDays));
    }

    return {
        credits,
        lots: lots.map(l => {
            const ageDays = Math.max(daysBetween(l.date, input.todayKey), 0);
            return {
                date: l.date,
                principal: round2(l.principal),
                gross: round2(l.gross),
                tax: round2(l.tax),
                value: round2(lotValue(l)),
                ageDays,
                irRate: irRateForDays(ageDays),
            };
        }),
    };
}

/**
 * Balance of a bucket at the start of `startKey`, rebuilt from its current balance by undoing every later deposit,
 * withdrawal and credited yield.
 */
export function openingBalanceFor(
    startKey: string,
    currentBalance: number,
    movements: BalanceMovement[],
    creditedTotal: number,
): number {
    const later = movements.reduce((acc, m) => (m.date >= startKey ? acc + m.delta : acc), 0);
    return round2(currentBalance - later - creditedTotal);
}
