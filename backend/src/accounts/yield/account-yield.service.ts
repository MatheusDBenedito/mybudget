import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Account, Prisma, PotMovement, YieldPot } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
    BalanceMovement, bcbDateToKey, DailyCdi, LotSnapshot, openingBalanceFor, simulateBucket, SimulateBucketResult, toDateKey,
} from './account-yield.calculator';

const ACCRUAL_INTERVAL_MS = 60 * 60 * 1000; // hourly; each run only credits days not yet credited
const CDI_CACHE_MS = 60 * 60 * 1000;
export const MAIN_BUCKET = 'main';

export type AccrualSummary = { accounts: number; days: number; totalNet: number };

type PotWithMovements = YieldPot & { movements: PotMovement[] };
type AccountWithPots = Account & { pots: PotWithMovements[] };

type BucketRun = {
    /** "main" (account free balance) or the pot id */
    bucket: string;
    potId: string | null;
    name: string;
    cdiPercentage: number;
    result: SimulateBucketResult;
};

export type BucketLots = { bucket: string; name: string; cdiPercentage: number; lots: LotSnapshot[] };

const dayKeyOf = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Credits the daily net yield of yielding accounts ("conta remunerada") and their pots ("cofrinhos").
 * Runs on startup and every hour; idempotent thanks to one AccountYield row per account, bucket and day.
 * Every deposit is a lot with its own IR clock (regressive table; withheld IR is not refunded); withdrawals
 * consume the oldest lots first. Days missed while the system was off are replayed one by one.
 */
@Injectable()
export class AccountYieldService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(AccountYieldService.name);
    private timer: NodeJS.Timeout | null = null;
    private running: Promise<AccrualSummary> | null = null;
    private cdiCache: { from: string; fetchedAt: number; days: DailyCdi[] } | null = null;

    constructor(private readonly prisma: PrismaService) { }

    onModuleInit() {
        // Don't block startup; failures are logged and retried on the next tick
        void this.accrueAll().catch(err => this.logger.warn(`Yield accrual failed: ${err.message}`));
        this.timer = setInterval(() => {
            void this.accrueAll().catch(err => this.logger.warn(`Yield accrual failed: ${err.message}`));
        }, ACCRUAL_INTERVAL_MS);
        this.timer.unref?.();
    }

    onModuleDestroy() {
        if (this.timer) clearInterval(this.timer);
    }

    /** Credits every missing business day for all yielding accounts. Concurrent calls share one run. */
    accrueAll(today = new Date()): Promise<AccrualSummary> {
        if (!this.running) {
            this.running = this.doAccrueAll(today).finally(() => { this.running = null; });
        }
        return this.running;
    }

    private loadYieldingAccounts(where: Prisma.AccountWhereInput = {}): Promise<AccountWithPots[]> {
        return this.prisma.account.findMany({
            where: { ...where, type: 'YIELDING', cdiPercentage: { not: null }, yieldSince: { not: null } },
            include: { pots: { include: { movements: true }, orderBy: { createdAt: 'asc' } } },
        });
    }

    private async doAccrueAll(today: Date): Promise<AccrualSummary> {
        const accounts = await this.loadYieldingAccounts();
        const summary: AccrualSummary = { accounts: 0, days: 0, totalNet: 0 };
        if (accounts.length === 0) return summary;

        const todayKey = toDateKey(today);
        const cdiDays = await this.cdiFor(accounts, today);
        if (cdiDays.length === 0) return summary;

        for (const account of accounts) {
            const runs = await this.simulateAccount(account, cdiDays, todayKey);
            let creditedDays = 0;

            for (const run of runs) {
                for (const day of run.result.credits) {
                    const credit = day.netAmount + day.taxRefund;
                    try {
                        await this.prisma.$transaction([
                            this.prisma.accountYield.create({
                                data: {
                                    accountId: account.id,
                                    bucket: run.bucket,
                                    date: new Date(`${day.date}T00:00:00.000Z`),
                                    cdiDailyRate: day.cdiDailyRate,
                                    cdiPercentage: day.cdiPercentage,
                                    balanceBefore: day.balanceBefore,
                                    grossAmount: day.grossAmount,
                                    irRate: day.irRate,
                                    taxAmount: day.taxAmount,
                                    netAmount: day.netAmount,
                                    taxRefund: day.taxRefund,
                                },
                            }),
                            // The account balance is the total, pots included
                            this.prisma.account.update({
                                where: { id: account.id },
                                data: { balance: { increment: credit } },
                            }),
                            ...(run.potId
                                ? [this.prisma.yieldPot.update({ where: { id: run.potId }, data: { balance: { increment: credit } } })]
                                : []),
                        ]);
                        creditedDays++;
                        summary.days++;
                        summary.totalNet += credit;
                        if (day.taxRefund > 0) {
                            this.logger.log(`IR bracket changed in "${account.name.trim()} / ${run.name}" on ${day.date}: refunded R$ ${day.taxRefund.toFixed(2)}`);
                        }
                    } catch (err) {
                        // Another run credited this day first: stop this bucket and let the next run recompute
                        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') break;
                        throw err;
                    }
                }
            }

            if (creditedDays > 0) {
                summary.accounts++;
                this.logger.log(`Credited ${creditedDays} day(s) of yield to "${account.name.trim()}"`);
            }
        }

        summary.totalNet = Math.round(summary.totalNet * 100) / 100;
        return summary;
    }

    /**
     * Replays the account's free balance and each pot. Movements:
     * - main: settled transactions (income +, expense -), transfers between accounts (in +, out -)
     *   and pot transfers (guardar -, retirar +);
     * - pot: its own transfers (guardar +, retirar -).
     */
    private async simulateAccount(account: AccountWithPots, cdiDays: DailyCdi[], todayKey: string): Promise<BucketRun[]> {
        const [credited, paidTransactions, transfers, adjustments] = await Promise.all([
            this.prisma.accountYield.findMany({ where: { accountId: account.id } }),
            this.prisma.transaction.findMany({
                where: { accountId: account.id, status: 'PAID' },
                select: { amount: true, type: true, date: true, updatedAt: true },
            }),
            this.prisma.accountTransfer.findMany({
                where: { OR: [{ fromAccountId: account.id }, { toAccountId: account.id }] },
                select: { amount: true, date: true, toAccountId: true },
            }),
            this.prisma.balanceAdjustment.findMany({ where: { accountId: account.id }, select: { amount: true, date: true } }),
        ]);
        const now = new Date();
        const potMovement = (m: PotMovement): BalanceMovement => ({ date: toDateKey(m.date), delta: m.amount });

        const runBucket = (
            bucket: string, potId: string | null, name: string, cdiPercentage: number,
            startKey: string, currentBalance: number, movements: BalanceMovement[],
        ): BucketRun => {
            const bucketCredits = credited.filter(c => c.bucket === bucket && dayKeyOf(c.date) >= startKey);
            const creditedTotal = bucketCredits.reduce((acc, c) => acc + c.netAmount + c.taxRefund, 0);
            return {
                bucket, potId, name, cdiPercentage,
                result: simulateBucket({
                    startKey, todayKey, cdiPercentage, cdiDays, movements,
                    openingBalance: openingBalanceFor(startKey, currentBalance, movements, creditedTotal),
                    creditedKeys: new Set(bucketCredits.map(c => dayKeyOf(c.date))),
                    hasIof: account.hasIof,
                }),
            };
        };

        const potsTotal = account.pots.reduce((acc, p) => acc + p.balance, 0);
        const mainMovements: BalanceMovement[] = [
            // Settled transactions moved the balance on their date (or when settled, if dated in the future)
            ...paidTransactions.map(t => ({
                date: toDateKey(t.date <= now ? t.date : t.updatedAt),
                delta: t.type === 'INCOME' ? t.amount : -t.amount,
            })),
            // Transfers between own accounts: incoming ones start a new lot, outgoing ones consume the oldest
            ...transfers.map(t => ({ date: toDateKey(t.date), delta: t.toAccountId === account.id ? t.amount : -t.amount })),
            // Manual balance edits (e.g. zeroing the free balance) count from the day they were made
            ...adjustments.map(a => ({ date: toDateKey(a.date), delta: a.amount })),
            // Guardar/retirar move money from/to the free balance; adjustments (sync with the bank app) don't
            ...account.pots.flatMap(p => p.movements
                .filter(m => m.kind !== 'adjustment')
                .map(m => ({ ...potMovement(m), delta: -m.amount }))),
        ];

        return [
            runBucket(MAIN_BUCKET, null, 'Saldo da conta', account.cdiPercentage!, toDateKey(account.yieldSince!),
                account.balance - potsTotal, mainMovements),
            ...account.pots.map(p => runBucket(p.id, p.id, p.name, p.cdiPercentage, toDateKey(p.createdAt),
                p.balance, p.movements.map(potMovement))),
        ];
    }

    /**
     * Recalculates an account's yields from `fromKey` on, after something was registered on a past date
     * (e.g. a cofrinho created or a withdrawal made days ago). Days already credited are never recomputed by
     * the normal run, so the credits from that day on (free balance and existing pots) are reversed and
     * deleted, then the accrual replays those days with the money where it really was on each day.
     */
    async recomputeFrom(accountId: string, fromKey: string): Promise<AccrualSummary> {
        if (this.running) await this.running.catch(() => undefined);

        const pots = await this.prisma.yieldPot.findMany({ where: { accountId }, select: { id: true } });
        const buckets = [MAIN_BUCKET, ...pots.map(p => p.id)];
        const rows = await this.prisma.accountYield.findMany({
            where: { accountId, bucket: { in: buckets }, date: { gte: new Date(`${fromKey}T00:00:00.000Z`) } },
        });

        if (rows.length > 0) {
            const credit = (bucket?: string) => rows
                .filter(r => bucket === undefined || r.bucket === bucket)
                .reduce((acc, r) => acc + r.netAmount + r.taxRefund, 0);
            await this.prisma.$transaction([
                this.prisma.accountYield.deleteMany({ where: { id: { in: rows.map(r => r.id) } } }),
                this.prisma.account.update({ where: { id: accountId }, data: { balance: { decrement: credit() } } }),
                ...pots
                    .filter(p => rows.some(r => r.bucket === p.id))
                    .map(p => this.prisma.yieldPot.update({ where: { id: p.id }, data: { balance: { decrement: credit(p.id) } } })),
            ]);
            this.logger.log(`Recomputing ${rows.length} credited day(s) of account ${accountId} from ${fromKey}`);
        }
        return this.accrueAll();
    }

    /** Yield credited to a bucket on or after `fromKey` (what a recompute from that day would reverse). */
    async creditedSince(accountId: string, bucket: string, fromKey: string): Promise<number> {
        const { _sum } = await this.prisma.accountYield.aggregate({
            where: { accountId, bucket, date: { gte: new Date(`${fromKey}T00:00:00.000Z`) } },
            _sum: { netAmount: true, taxRefund: true },
        });
        return (_sum.netAmount ?? 0) + (_sum.taxRefund ?? 0);
    }

    /** Current lots (deposit date, value, age, IR bracket) of the account's free balance and each pot. */
    async lots(accountId: string, today = new Date()): Promise<BucketLots[]> {
        const [account] = await this.loadYieldingAccounts({ id: accountId });
        if (!account) return [];
        const cdiDays = await this.cdiFor([account], today);
        const runs = await this.simulateAccount(account, cdiDays, toDateKey(today));
        return runs.map(r => ({ bucket: r.bucket, name: r.name, cdiPercentage: r.cdiPercentage, lots: r.result.lots }));
    }

    /** Daily CDI covering the earliest start among the accounts and their pots (cached for an hour). */
    private async cdiFor(accounts: AccountWithPots[], today: Date): Promise<DailyCdi[]> {
        const starts = accounts.flatMap(a => [a.yieldSince!, ...a.pots.map(p => p.createdAt)]);
        const earliest = starts.reduce((min, d) => (d < min ? d : min), starts[0]);
        const fromKey = toDateKey(earliest);
        if (fromKey >= toDateKey(today)) return [];

        const cache = this.cdiCache;
        if (cache && cache.from <= fromKey && Date.now() - cache.fetchedAt < CDI_CACHE_MS) return cache.days;

        const days = await this.fetchDailyCdi(earliest, today);
        if (days.length > 0) this.cdiCache = { from: fromKey, fetchedAt: Date.now(), days };
        return days;
    }

    /** Daily CDI (BCB series 12) between two dates; only business days are published. */
    private async fetchDailyCdi(from: Date, to: Date): Promise<DailyCdi[]> {
        const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=${fmt(from)}&dataFinal=${fmt(to)}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                this.logger.warn(`BCB API returned ${response.status} for daily CDI`);
                return [];
            }
            const data: Array<{ data: string; valor: string }> = await response.json();
            return data
                .map(item => ({ date: bcbDateToKey(item.data), ratePercent: parseFloat(item.valor) }))
                .filter(d => Number.isFinite(d.ratePercent) && d.ratePercent > 0);
        } catch (err) {
            this.logger.warn(`Failed to fetch daily CDI: ${(err as Error).message}`);
            return [];
        }
    }

    /** Recent credits of one account (all buckets), newest first. */
    history(accountId: string, limit = 120) {
        return this.prisma.accountYield.findMany({
            where: { accountId },
            orderBy: [{ date: 'desc' }, { bucket: 'asc' }],
            take: limit,
        });
    }

    /** What entered the balance (net yield + IR refunds) in the given month, and cumulative IR tax per account/bucket. */
    async monthTotals(year: number, month: number): Promise<{
        byAccount: Map<string, number>;
        byBucket: Map<string, number>;
        taxByAccount: Map<string, number>;
        taxByBucket: Map<string, number>;
    }> {
        const start = new Date(Date.UTC(year, month - 1, 1));
        const end = new Date(Date.UTC(year, month, 1));
        const [rows, allTaxRows] = await Promise.all([
            this.prisma.accountYield.groupBy({
                by: ['accountId', 'bucket'],
                where: { date: { gte: start, lt: end } },
                _sum: { netAmount: true, taxRefund: true },
            }),
            this.prisma.accountYield.groupBy({
                by: ['accountId', 'bucket'],
                _sum: { taxAmount: true, taxRefund: true },
            }),
        ]);
        const byAccount = new Map<string, number>();
        const byBucket = new Map<string, number>();
        for (const r of rows) {
            const value = (r._sum.netAmount ?? 0) + (r._sum.taxRefund ?? 0);
            byAccount.set(r.accountId, (byAccount.get(r.accountId) ?? 0) + value);
            byBucket.set(`${r.accountId}:${r.bucket}`, value);
        }

        const taxByAccount = new Map<string, number>();
        const taxByBucket = new Map<string, number>();
        for (const r of allTaxRows) {
            const tax = Math.max((r._sum.taxAmount ?? 0) - (r._sum.taxRefund ?? 0), 0);
            taxByAccount.set(r.accountId, (taxByAccount.get(r.accountId) ?? 0) + tax);
            taxByBucket.set(`${r.accountId}:${r.bucket}`, tax);
        }

        const round = (m: Map<string, number>) => new Map([...m].map(([k, v]) => [k, Math.round(v * 100) / 100]));
        return {
            byAccount: round(byAccount),
            byBucket: round(byBucket),
            taxByAccount: round(taxByAccount),
            taxByBucket: round(taxByBucket),
        };
    }
}
