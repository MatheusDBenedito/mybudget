import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType } from '@prisma/client';

@Injectable()
export class ReportsService {
    constructor(private readonly prisma: PrismaService) {}

    async getExpensesByCategory(workspaceId: string, month: number, year: number) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 1);

        const regularExpenses = await this.prisma.transaction.groupBy({
            by: ['categoryId'],
            where: {
                workspaceId,
                type: TransactionType.EXPENSE,
                status: { not: 'CANCELLED' },
                date: { gte: startDate, lt: endDate },
            },
            _sum: { amount: true },
        });

        const cardExpenses = await this.prisma.cardTransaction.groupBy({
            by: ['categoryId'],
            where: {
                workspaceId,
                invoiceDate: { gte: startDate, lt: endDate },
            },
            _sum: { amount: true },
        });

        const aggregatedMap = new Map<string | null, number>();

        regularExpenses.forEach((exp) => {
            const current = aggregatedMap.get(exp.categoryId) || 0;
            aggregatedMap.set(exp.categoryId, current + (exp._sum.amount || 0));
        });

        cardExpenses.forEach((exp) => {
            const current = aggregatedMap.get(exp.categoryId) || 0;
            aggregatedMap.set(exp.categoryId, current + (exp._sum.amount || 0));
        });

        const categoryIds = Array.from(aggregatedMap.keys()).filter((id) => id !== null) as string[];

        const categories = await this.prisma.category.findMany({
            where: { id: { in: categoryIds }, workspaceId },
        });

        const categoryDict = categories.reduce((acc, cat) => {
            acc[cat.id] = { name: cat.name, color: cat.color || '#cccccc' };
            return acc;
        }, {} as Record<string, { name: string; color: string }>);

        const result = [];

        for (const [categoryId, totalAmount] of aggregatedMap.entries()) {
            if (totalAmount <= 0) continue;

            if (categoryId && categoryDict[categoryId]) {
                result.push({
                    category: categoryDict[categoryId].name,
                    color: categoryDict[categoryId].color,
                    total: totalAmount,
                });
            } else {
                result.push({
                    category: 'Outros',
                    color: '#9e9e9e',
                    total: totalAmount,
                });
            }
        }

        return result.sort((a, b) => b.total - a.total);
    }

    async getMonthlyEvolution(workspaceId: string) {
        const today = new Date();
        const startDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
        const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);

        const incomeTransactions = await this.prisma.transaction.groupBy({
            by: ['date'],
            where: {
                workspaceId,
                type: TransactionType.INCOME,
                status: { not: 'CANCELLED' },
                date: { gte: startDate, lt: endDate },
            },
            _sum: { amount: true },
        });

        const expenseTransactions = await this.prisma.transaction.groupBy({
            by: ['date'],
            where: {
                workspaceId,
                type: TransactionType.EXPENSE,
                status: { not: 'CANCELLED' },
                date: { gte: startDate, lt: endDate },
            },
            _sum: { amount: true },
        });

        const cardExpenses = await this.prisma.cardTransaction.groupBy({
            by: ['invoiceDate'],
            where: {
                workspaceId,
                invoiceDate: { gte: startDate, lt: endDate },
            },
            _sum: { amount: true },
        });

        const monthlyMap = new Map<string, { monthParam: string; income: number; expense: number }>();

        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const formatString = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            monthlyMap.set(formatString, { monthParam: formatString, income: 0, expense: 0 });
        }

        incomeTransactions.forEach((t) => {
            const formatString = `${String(t.date.getMonth() + 1).padStart(2, '0')}/${t.date.getFullYear()}`;
            if (monthlyMap.has(formatString)) {
                monthlyMap.get(formatString)!.income += t._sum.amount || 0;
            }
        });

        expenseTransactions.forEach((t) => {
            const formatString = `${String(t.date.getMonth() + 1).padStart(2, '0')}/${t.date.getFullYear()}`;
            if (monthlyMap.has(formatString)) {
                monthlyMap.get(formatString)!.expense += t._sum.amount || 0;
            }
        });

        cardExpenses.forEach((t) => {
            const formatString = `${String(t.invoiceDate.getMonth() + 1).padStart(2, '0')}/${t.invoiceDate.getFullYear()}`;
            if (monthlyMap.has(formatString)) {
                monthlyMap.get(formatString)!.expense += t._sum.amount || 0;
            }
        });

        return Array.from(monthlyMap.values());
    }
}
