import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense.dto';
import { TransactionType } from '@prisma/client';
import { addMonths } from 'date-fns';

@Injectable()
export class RecurringExpensesService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createDto: CreateRecurringExpenseDto) {
        return this.prisma.recurringExpense.create({
            data: createDto,
        });
    }

    /**
     * This method is intended to be called by a Cron Job (e.g., every 1st day of the month).
     * It scans for all active recurring expenses and creates a Transaction for the current month.
     */
    async processMonthlyRecurrences(year?: number, month?: number) {
        const today = new Date();
        const processingYear = year ?? today.getFullYear();
        // month param is 1-indexed (1 = Jan, 12 = Dec). JS dates are 0-indexed.
        const processingMonth = month !== undefined ? month - 1 : today.getMonth();

        const activeSubscriptions = await this.prisma.recurringExpense.findMany({
            where: { isActive: true },
        });

        if (activeSubscriptions.length === 0) {
            return { message: 'No active recurring expenses found.', createdCount: 0 };
        }

        const newTransactions = activeSubscriptions.map((sub) => {
            // Create a Date object for the specific billing day in the processing month/year
            // If the billing day is 31 and the month is February, JS Date will roll it over.
            // E.g., Date(2026, 1 /* Feb */, 31) -> Mar 3rd, 2026.
            // To strictly cap the due day to the end of the month without rollover:
            const lastDayOfMonth = new Date(processingYear, processingMonth + 1, 0).getDate();
            const finalBillingDay = sub.billingDay > lastDayOfMonth ? lastDayOfMonth : sub.billingDay;

            const transactionDate = new Date(processingYear, processingMonth, finalBillingDay);

            return {
                description: sub.description,
                amount: sub.amount,
                date: transactionDate,
                type: TransactionType.EXPENSE, // Subscriptions are expenses
                accountId: sub.accountId,
                categoryId: sub.categoryId,
            };
        });

        // Create the transactions in bulk using a Prisma transaction
        await this.prisma.$transaction(
            newTransactions.map((tx) =>
                this.prisma.transaction.create({ data: tx })
            )
        );

        return {
            message: 'Monthly recurrences processed successfully.',
            createdCount: newTransactions.length
        };
    }
}
