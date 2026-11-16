import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { InvestmentsService } from '../investments/investments.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CardTransactionsService } from '../card-transactions/card-transactions.service';
import { buildCashFlow, CashFlowMonthInput, CashFlowResult } from './cash-flow.builder';

const monthIndex = (year: number, month: number) => year * 12 + (month - 1);
const fromIndex = (index: number) => ({ year: Math.floor(index / 12), month: (index % 12) + 1 });

const investmentGrossValue = (inv: any): number => {
    if (inv.type === 'FIXED_INCOME' && inv.grossValue != null) {
        return Number(inv.grossValue);
    }
    if ((inv.type === 'VARIABLE_INCOME' || inv.type === 'FII' || inv.type === 'CRYPTO') && inv.currentPrice != null) {
        return Number(inv.currentPrice) * Number(inv.quantity ?? 0);
    }
    return Number(inv.currentValue ?? 0);
};

@Injectable()
export class CashFlowService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly accounts: AccountsService,
        private readonly investments: InvestmentsService,
        private readonly transactions: TransactionsService,
        private readonly cardTransactions: CardTransactionsService,
    ) { }

    /**
     * Spreadsheet-style cash flow for `count` months starting at month/year.
     * Reuses the same projection rules as the rest of the app (fixed transactions and card invoices),
     * so card rows update as soon as purchases are added to an invoice.
     * Uses the net balance (saldo líquido) across all accounts + investments gross as openingBalance.
     */
    async getCashFlow(workspaceId: string, month: number, year: number, count: number, today = new Date()): Promise<CashFlowResult> {
        const [accounts, investments, cards] = await Promise.all([
            this.accounts.findAll(workspaceId),
            this.investments.findAll(workspaceId),
            this.prisma.creditCard.findMany({
                where: { workspaceId },
                select: {
                    id: true,
                    name: true,
                    dueDay: true,
                    holders: {
                        orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
                        select: { id: true, name: true, last4: true, isMain: true },
                    },
                },
                orderBy: { createdAt: 'asc' },
            }),
        ]);
        const accountsNet = accounts.reduce((acc, a) => acc + a.balance, 0);
        const investmentsGross = investments.reduce((acc, inv) => acc + investmentGrossValue(inv), 0);
        const openingBalance = Math.round((accountsNet + investmentsGross) * 100) / 100;

        const start = monthIndex(year, month);
        const current = monthIndex(today.getFullYear(), today.getMonth() + 1);

        // Compute passive income projections covering both leadIn (if start > current) and the requested window
        const projStartIdx = Math.min(start, current);
        const projEndIdx = start + count;
        const projStart = fromIndex(projStartIdx);
        const projCount = Math.max(count, projEndIdx - projStartIdx);
        const projections = await this.investments.getProjections(
            workspaceId,
            projStart.month,
            projStart.year,
            projCount,
            today,
            investments,
        );
        const passiveByMonth = new Map<string, { scheduledDividends: number; projectedFiiDividends: number; fixedIncomeNetYield: number }>();
        for (const p of projections.months) {
            passiveByMonth.set(`${p.year}-${p.month}`, {
                scheduledDividends: p.scheduledDividends,
                projectedFiiDividends: p.projectedFiiDividends,
                fixedIncomeNetYield: p.fixedIncomeNetYield,
            });
        }

        const loadMonth = async (index: number): Promise<CashFlowMonthInput> => {
            const m = fromIndex(index);
            const [transactions, invoices] = await Promise.all([
                this.transactions.findAll(workspaceId, m.month, m.year),
                Promise.all(cards.map(c => this.cardTransactions.findAllByInvoice(workspaceId, c.id, m.month, m.year))),
            ]);
            return {
                ...m,
                passiveIncome: passiveByMonth.get(`${m.year}-${m.month}`),
                transactions: transactions.map(t => ({
                    description: t.description,
                    amount: t.amount,
                    type: t.type,
                    status: t.status,
                    isFixed: t.isFixed,
                    installmentGroupId: t.installmentGroupId,
                    category: t.category ? { name: t.category.name } : null,
                })),
                cards: cards.map((c, i) => {
                    const items = invoices[i];
                    const total = items.reduce((acc, tx) => acc + tx.amount, 0);
                    const holders = c.holders.length > 1
                        ? c.holders.map(h => {
                            const label = h.last4 ? `${h.name} ••${h.last4}` : h.name;
                            return {
                                id: h.id,
                                name: h.isMain ? `${label} (titular)` : label,
                                total: items
                                    .filter(tx => (tx.cardHolder?.id ?? tx.cardHolderId) === h.id)
                                    .reduce((acc, tx) => acc + tx.amount, 0),
                            };
                        })
                        : undefined;
                    return {
                        id: c.id,
                        name: c.name,
                        dueDay: c.dueDay,
                        total,
                        holders,
                    };
                }),
            };
        };

        // When the sheet starts in the future, months between today and the start still move the balance
        const leadInIndexes = Array.from({ length: Math.max(start - current, 0) }, (_, i) => current + i);
        const windowIndexes = Array.from({ length: count }, (_, i) => start + i);

        const [leadIn, months] = await Promise.all([
            Promise.all(leadInIndexes.map(loadMonth)),
            Promise.all(windowIndexes.map(loadMonth)),
        ]);

        return buildCashFlow({ months, leadIn, openingBalance, today });
    }
}
