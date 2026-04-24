import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';

@Injectable()
export class TransactionsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createTransactionDto: CreateTransactionDto) {
        let { accountId, ...rest } = createTransactionDto;

        // Auto-determine status based on date if not explicitly provided
        if (!rest.status) {
            const transactionDate = new Date(rest.date);
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            rest.status = transactionDate <= today ? 'PAID' : 'PENDING';
        }

        if (!accountId) {
            const account = await this.prisma.account.findFirst();
            if (!account) {
                throw new NotFoundException('Nenhuma conta encontrada para vincular a transação.');
            }
            accountId = account.id;
        }

        const transaction = await this.prisma.transaction.create({
            data: {
                ...rest,
                accountId,
            },
        });

        // If transaction is PAID, update account balance
        if (transaction.status === 'PAID') {
            const delta = transaction.type === 'INCOME' ? transaction.amount : -transaction.amount;
            await this.prisma.account.update({
                where: { id: transaction.accountId },
                data: { balance: { increment: delta } },
            });
        }

        return transaction;
    }

    async findAll(month?: number, year?: number) {
        const whereClause: any = {};

        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 1);
            whereClause.date = {
                gte: startDate,
                lt: endDate,
            };
        } else if (year) {
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year + 1, 0, 1);
            whereClause.date = {
                gte: startDate,
                lt: endDate,
            };
        }

        // Fetch actual transactions for the period
        const transactions = await this.prisma.transaction.findMany({
            where: whereClause,
            include: { category: true },
            orderBy: { date: 'desc' },
        });

        // Project fixed transactions from previous months
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);

            const fixedTransactions = await this.prisma.transaction.findMany({
                where: {
                    isFixed: true,
                    date: { lt: startDate }, // Only from before this month
                },
                include: { category: true },
            });

            for (const fixed of fixedTransactions) {
                // Check if there's already a real transaction for this fixed in the current month
                const alreadyExists = transactions.some(
                    (t) =>
                        t.description === fixed.description &&
                        t.amount === fixed.amount &&
                        t.type === fixed.type &&
                        t.accountId === fixed.accountId &&
                        t.isFixed === true
                );

                if (!alreadyExists) {
                    // Project with adjusted date and PENDING status
                    const projectedDate = new Date(year, month - 1, new Date(fixed.date).getDate());
                    transactions.push({
                        ...fixed,
                        id: `projected-${fixed.id}-${year}-${month}`,
                        date: projectedDate,
                        status: 'PENDING',
                    } as any);
                }
            }

            // Re-sort after adding projections
            transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }

        return transactions;
    }

    async updateStatus(id: string, updateDto: UpdateTransactionStatusDto) {
        // Handle projected (virtual) fixed transactions
        if (id.startsWith('projected-')) {
            // Parse: projected-{originalId}-{year}-{month}
            const parts = id.split('-');
            const projMonth = parseInt(parts[parts.length - 1], 10);
            const projYear = parseInt(parts[parts.length - 2], 10);
            // Original UUID is everything between 'projected-' and the last two segments
            const originalId = parts.slice(1, parts.length - 2).join('-');

            const original = await this.prisma.transaction.findUnique({
                where: { id: originalId },
            });

            if (!original) {
                throw new NotFoundException(`Original fixed transaction ${originalId} not found`);
            }

            // Create a real transaction for this month
            const projectedDate = new Date(projYear, projMonth - 1, new Date(original.date).getDate());
            const newTransaction = await this.prisma.transaction.create({
                data: {
                    description: original.description,
                    amount: original.amount,
                    date: projectedDate,
                    type: original.type,
                    status: updateDto.status,
                    isFixed: true,
                    accountId: original.accountId,
                    categoryId: original.categoryId,
                },
            });

            // Adjust balance if marking as PAID
            if (updateDto.status === 'PAID') {
                const delta = original.type === 'INCOME' ? original.amount : -original.amount;
                await this.prisma.account.update({
                    where: { id: original.accountId },
                    data: { balance: { increment: delta } },
                });
            }

            return newTransaction;
        }

        // Regular (non-projected) transaction
        const transaction = await this.prisma.transaction.findUnique({
            where: { id },
        });

        if (!transaction) {
            throw new NotFoundException(`Transaction with ID ${id} not found`);
        }

        const oldStatus = transaction.status;
        const newStatus = updateDto.status;

        const updated = await this.prisma.transaction.update({
            where: { id },
            data: { status: newStatus },
        });

        // Adjust account balance based on status change
        if (oldStatus !== newStatus) {
            const delta = transaction.type === 'INCOME' ? transaction.amount : -transaction.amount;

            if (newStatus === 'PAID') {
                // PENDING → PAID: apply balance change
                await this.prisma.account.update({
                    where: { id: transaction.accountId },
                    data: { balance: { increment: delta } },
                });
            } else if (oldStatus === 'PAID') {
                // PAID → PENDING: reverse balance change
                await this.prisma.account.update({
                    where: { id: transaction.accountId },
                    data: { balance: { increment: -delta } },
                });
            }
        }

        return updated;
    }
}
