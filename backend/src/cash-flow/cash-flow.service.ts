import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CardTransactionsService } from '../card-transactions/card-transactions.service';
import { buildCashFlow, CashFlowMonthInput, CashFlowResult } from './cash-flow.builder';

const monthIndex = (year: number, month: number) => year * 12 + (month - 1);
const fromIndex = (index: number) => ({ year: Math.floor(index / 12), month: (index % 12) + 1 });

@Injectable()
export class CashFlowService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly transactions: TransactionsService,
        private readonly cardTransactions: CardTransactionsService,
    ) { }

    /**
     * Spreadsheet-style cash flow for `count` months starting at month/year.
     * Reuses the same projection rules as the rest of the app (fixed transactions and card invoices),
     * so card rows update as soon as purchases are added to an invoice.
     */
    async getCashFlow(month: number, year: number, count: number, today = new Date()): Promise<CashFlowResult> {
        const [accounts, cards] = await Promise.all([
            this.prisma.account.findMany({ select: { balance: true } }),
            this.prisma.creditCard.findMany({ select: { id: true, name: true, dueDay: true }, orderBy: { createdAt: 'asc' } }),
        ]);
        const openingBalance = accounts.reduce((acc, a) => acc + a.balance, 0);

        const start = monthIndex(year, month);
        const current = monthIndex(today.getFullYear(), today.getMonth() + 1);

        const loadMonth = async (index: number): Promise<CashFlowMonthInput> => {
            const m = fromIndex(index);
            const [transactions, invoices] = await Promise.all([
                this.transactions.findAll(m.month, m.year),
                Promise.all(cards.map(c => this.cardTransactions.findAllByInvoice(c.id, m.month, m.year))),
            ]);
            return {
                ...m,
                transactions: transactions.map(t => ({
                    description: t.description,
                    amount: t.amount,
                    type: t.type,
                    status: t.status,
                    isFixed: t.isFixed,
                    category: t.category ? { name: t.category.name } : null,
                })),
                cards: cards.map((c, i) => ({
                    id: c.id,
                    name: c.name,
                    dueDay: c.dueDay,
                    total: invoices[i].reduce((acc, tx) => acc + tx.amount, 0),
                })),
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
