import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
                // Fixed series ended before this month: no more projections
                if (fixed.fixedUntil && fixed.fixedUntil < startDate) continue;

                // Check if there's already a real transaction for this fixed in the current month.
                // The account is deliberately not compared: paying a month's bill from another account
                // must not make the original projection show up again as a duplicate.
                const alreadyExists = transactions.some(
                    (t) =>
                        t.description === fixed.description &&
                        t.amount === fixed.amount &&
                        t.type === fixed.type &&
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

    /**
     * Changes the status of a transaction and keeps account balances in sync:
     * - → PAID: credits (income) or debits (expense) `accountId` when given, otherwise the transaction's account.
     *   The chosen account is saved on the transaction so a later undo reverses the same account.
     * - PAID → anything else: reverses the amount on the account that received it.
     * Status and balance are written in a single database transaction.
     */
    async updateStatus(id: string, updateDto: UpdateTransactionStatusDto) {
        const newStatus = updateDto.status;

        if (newStatus === 'PAID' && updateDto.accountId) {
            const account = await this.prisma.account.findUnique({ where: { id: updateDto.accountId }, select: { id: true } });
            if (!account) {
                throw new BadRequestException('Conta informada não encontrada.');
            }
        }

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

            const accountId = newStatus === 'PAID' ? updateDto.accountId ?? original.accountId : original.accountId;
            const projectedDate = new Date(projYear, projMonth - 1, new Date(original.date).getDate());

            // Create a real transaction for this month (and settle it, if paid)
            return this.prisma.$transaction(async (tx) => {
                const created = await tx.transaction.create({
                    data: {
                        description: original.description,
                        amount: original.amount,
                        date: projectedDate,
                        type: original.type,
                        status: newStatus,
                        isFixed: true,
                        accountId,
                        categoryId: original.categoryId,
                    },
                });
                if (newStatus === 'PAID') {
                    await tx.account.update({
                        where: { id: accountId },
                        data: { balance: { increment: this.balanceDelta(original.type, original.amount) } },
                    });
                }
                return created;
            });
        }

        // Regular (non-projected) transaction
        const transaction = await this.prisma.transaction.findUnique({
            where: { id },
        });

        if (!transaction) {
            throw new NotFoundException(`Transaction with ID ${id} not found`);
        }

        const oldStatus = transaction.status;
        if (oldStatus === newStatus) {
            return transaction;
        }

        const delta = this.balanceDelta(transaction.type, transaction.amount);

        return this.prisma.$transaction(async (tx) => {
            if (newStatus === 'PAID') {
                // PENDING → PAID: settle on the chosen account
                const accountId = updateDto.accountId ?? transaction.accountId;
                const updated = await tx.transaction.update({
                    where: { id },
                    data: { status: newStatus, accountId },
                });
                await tx.account.update({
                    where: { id: accountId },
                    data: { balance: { increment: delta } },
                });
                return updated;
            }

            const updated = await tx.transaction.update({
                where: { id },
                data: { status: newStatus },
            });
            if (oldStatus === 'PAID') {
                // PAID → PENDING/CANCELLED: reverse on the account that was used
                await tx.account.update({
                    where: { id: transaction.accountId },
                    data: { balance: { increment: -delta } },
                });
            }
            return updated;
        });
    }

    /**
     * Removes a lançamento. A paid one gives its amount back to (or takes it from) the account it moved.
     * Fixed lançamentos (and their monthly projections) accept a scope:
     * - "single": only this month. Real rows are cancelled instead of deleted (they may still feed the
     *   projection of later months); a projection gets a cancelled row for its month, which hides it.
     * - "series": this month and the following ones. Rows from this month on are removed and earlier rows
     *   of the series stop projecting after the previous month.
     */
    async remove(id: string, scope: 'single' | 'series' = 'single') {
        const projected = id.startsWith('projected-') ? this.parseProjectedId(id) : null;
        const tx = await this.prisma.transaction.findUnique({ where: { id: projected?.originalId ?? id } });
        if (!tx) throw new NotFoundException(`Transaction with ID ${id} not found`);

        const monthStart = projected
            ? new Date(projected.year, projected.month - 1, 1)
            : new Date(tx.date.getFullYear(), tx.date.getMonth(), 1);

        if (!tx.isFixed) {
            return this.prisma.$transaction(async (db) => {
                if (tx.status === 'PAID') await this.reverseBalance(db, tx);
                return db.transaction.delete({ where: { id: tx.id } });
            });
        }

        if (scope === 'series') {
            const series = await this.prisma.transaction.findMany({
                where: { isFixed: true, description: tx.description, amount: tx.amount, type: tx.type },
            });
            const lastDayBefore = new Date(monthStart.getTime() - 1);
            return this.prisma.$transaction(async (db) => {
                for (const row of series) {
                    if (row.date >= monthStart) {
                        if (row.status === 'PAID') await this.reverseBalance(db, row);
                        await db.transaction.delete({ where: { id: row.id } });
                    } else {
                        await db.transaction.update({ where: { id: row.id }, data: { fixedUntil: lastDayBefore } });
                    }
                }
                return { removed: series.filter(r => r.date >= monthStart).length, endedAfter: lastDayBefore };
            });
        }

        if (projected) {
            // A cancelled row for the month makes the projection dedupe skip it
            return this.prisma.transaction.create({
                data: {
                    description: tx.description,
                    amount: tx.amount,
                    type: tx.type,
                    date: new Date(projected.year, projected.month - 1, tx.date.getDate()),
                    status: 'CANCELLED',
                    isFixed: true,
                    accountId: tx.accountId,
                    categoryId: tx.categoryId,
                },
            });
        }

        return this.prisma.$transaction(async (db) => {
            if (tx.status === 'PAID') await this.reverseBalance(db, tx);
            return db.transaction.update({ where: { id: tx.id }, data: { status: 'CANCELLED' } });
        });
    }

    private parseProjectedId(id: string) {
        // projected-{originalId}-{year}-{month}
        const parts = id.split('-');
        return {
            originalId: parts.slice(1, parts.length - 2).join('-'),
            year: parseInt(parts[parts.length - 2], 10),
            month: parseInt(parts[parts.length - 1], 10),
        };
    }

    private reverseBalance(db: Prisma.TransactionClient, tx: { accountId: string; type: string; amount: number }) {
        return db.account.update({
            where: { id: tx.accountId },
            data: { balance: { increment: -this.balanceDelta(tx.type, tx.amount) } },
        });
    }

    /** Income adds to the balance; anything else subtracts (same rule as create()). */
    private balanceDelta(type: string, amount: number): number {
        return type === 'INCOME' ? amount : -amount;
    }
}
