import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';
import {
    buildTransactionInstallments,
    shouldAdjustAccountBalanceForInstallment,
} from './helpers/installment-transactions.helper';

const seriesKey = (type: string, description: string) =>
    `${type}:${description.trim().toLocaleLowerCase('pt-BR')}`;

const clampedMonthDate = (year: number, month: number, day: number) => {
    const lastDay = new Date(year, month, 0).getDate();
    return new Date(year, month - 1, Math.min(day, lastDay), 12, 0, 0);
};

@Injectable()
export class TransactionsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(workspaceId: string, createTransactionDto: CreateTransactionDto) {
        let { accountId, installments, ...rest } = createTransactionDto;

        if (!accountId) {
            const account = await this.prisma.account.findFirst({ where: { workspaceId } });
            if (!account) {
                throw new NotFoundException('Nenhuma conta encontrada para vincular a transação.');
            }
            accountId = account.id;
        } else {
            const account = await this.prisma.account.findFirst({ where: { id: accountId, workspaceId }, select: { id: true } });
            if (!account) {
                throw new BadRequestException('Conta informada não encontrada neste workspace.');
            }
        }

        if (rest.categoryId) {
            const cat = await this.prisma.category.findFirst({ where: { id: rest.categoryId, workspaceId }, select: { id: true } });
            if (!cat) {
                throw new BadRequestException('Categoria informada não encontrada neste workspace.');
            }
        }

        const installmentsCount = rest.isFixed ? 1 : Math.min(480, Math.max(1, installments ?? 1));

        if (installmentsCount === 1) {
            // Auto-determine status based on date if not explicitly provided
            if (!rest.status) {
                const transactionDate = new Date(rest.date);
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                rest.status = transactionDate <= today ? 'PAID' : 'PENDING';
            }

            const transaction = await this.prisma.transaction.create({
                data: {
                    ...rest,
                    workspaceId,
                    installments: 1,
                    accountId,
                },
            });

            // If transaction is PAID, update account balance
            if (transaction.status === 'PAID') {
                const delta = this.balanceDelta(transaction.type, transaction.amount);
                await this.prisma.account.update({
                    where: { id: transaction.accountId },
                    data: { balance: { increment: delta } },
                });
            }

            return transaction;
        }

        const drafts = buildTransactionInstallments({
            description: rest.description,
            amount: rest.amount,
            date: new Date(rest.date),
            explicitStatus: rest.status,
            installments: installmentsCount,
        });
        const installmentGroupId = randomUUID();

        return this.prisma.$transaction(async (db) => {
            const created = [];
            let paidDelta = 0;

            for (const draft of drafts) {
                const tx = await db.transaction.create({
                    data: {
                        workspaceId,
                        description: draft.description,
                        amount: draft.amount,
                        date: draft.date,
                        type: rest.type,
                        status: draft.status,
                        isFixed: false,
                        installments: draft.installments,
                        installmentGroupId,
                        accountId,
                        categoryId: rest.categoryId,
                    },
                });
                created.push(tx);
                if (shouldAdjustAccountBalanceForInstallment(tx.date, tx.status)) {
                    paidDelta += this.balanceDelta(tx.type, tx.amount);
                }
            }

            if (paidDelta !== 0) {
                await db.account.update({
                    where: { id: accountId },
                    data: { balance: { increment: paidDelta } },
                });
            }

            return created;
        });
    }

    async findAll(workspaceId: string, month?: number, year?: number) {
        const whereClause: any = { workspaceId };

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
                    workspaceId,
                    isFixed: true,
                    date: { lt: startDate }, // Only from before this month
                },
                include: { category: true },
                orderBy: { date: 'desc' },
            });

            const seenSeries = new Set<string>();

            for (const fixed of fixedTransactions) {
                // Single-month overrides or ended templates before this month do not drive future projections
                if (fixed.fixedUntil && fixed.fixedUntil < startDate) continue;

                const key = seriesKey(fixed.type, fixed.description);
                // Only the latest active record of a fixed series drives future projections
                if (seenSeries.has(key)) continue;
                seenSeries.add(key);

                // Any real fixed transaction in this month (even with an adjusted amount or different account)
                // supersedes the projection so estimates never duplicate.
                const alreadyExists = transactions.some(
                    (t) => t.isFixed === true && seriesKey(t.type, t.description) === key,
                );

                if (!alreadyExists) {
                    const projectedDate = clampedMonthDate(year, month, new Date(fixed.date).getDate());
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
     * Edits a transaction (or materializes/updates a projected fixed estimate).
     * Fixed transactions support `scope`:
     * - "single": overrides only this month (leaving future projections at the original estimate).
     * - "series": updates this month and future months (ending earlier templates before this month).
     */
    async update(workspaceId: string, id: string, dto: UpdateTransactionDto) {
        const scope = dto.scope ?? 'single';

        if (dto.accountId) {
            const account = await this.prisma.account.findFirst({ where: { id: dto.accountId, workspaceId }, select: { id: true } });
            if (!account) {
                throw new BadRequestException('Conta informada não encontrada neste workspace.');
            }
        }

        if (id.startsWith('projected-')) {
            const { originalId, year, month } = this.parseProjectedId(id);
            const original = await this.prisma.transaction.findFirst({ where: { id: originalId, workspaceId } });
            if (!original) {
                throw new NotFoundException(`Original fixed transaction ${originalId} not found`);
            }

            const nextDescription = dto.description?.trim() || original.description;
            const nextAmount = dto.amount ?? original.amount;
            const nextType = dto.type ?? original.type;
            const nextAccountId = dto.accountId ?? original.accountId;
            const nextCategoryId = dto.categoryId ?? original.categoryId;
            const nextIsFixed = dto.isFixed ?? true;
            const nextDate = dto.date
                ? new Date(dto.date)
                : clampedMonthDate(year, month, new Date(original.date).getDate());
            const monthStart = new Date(year, month - 1, 1);

            return this.prisma.$transaction(async (tx) => {
                if (scope === 'series') {
                    await tx.transaction.updateMany({
                        where: {
                            workspaceId,
                            isFixed: true,
                            type: original.type,
                            description: original.description,
                            date: { lt: monthStart },
                        },
                        data: { fixedUntil: new Date(monthStart.getTime() - 1) },
                    });
                }

                return tx.transaction.create({
                    data: {
                        workspaceId,
                        description: nextDescription,
                        amount: nextAmount,
                        date: nextDate,
                        type: nextType,
                        status: 'PENDING',
                        isFixed: nextIsFixed,
                        fixedUntil: scope === 'single' && nextIsFixed ? new Date(year, month, 0, 23, 59, 59, 999) : null,
                        accountId: nextAccountId,
                        categoryId: nextCategoryId,
                    },
                    include: { category: true },
                });
            });
        }

        const existing = await this.prisma.transaction.findFirst({ where: { id, workspaceId } });
        if (!existing) {
            throw new NotFoundException(`Transaction with ID ${id} not found`);
        }

        const nextDescription = dto.description?.trim() || existing.description;
        const nextAmount = dto.amount ?? existing.amount;
        const nextType = dto.type ?? existing.type;
        const nextAccountId = dto.accountId ?? existing.accountId;
        const nextCategoryId = dto.categoryId !== undefined ? dto.categoryId : existing.categoryId;
        const nextIsFixed = dto.isFixed ?? existing.isFixed;
        const nextDate = dto.date ? new Date(dto.date) : existing.date;

        const monthStart = new Date(existing.date.getFullYear(), existing.date.getMonth(), 1);
        const monthEnd = new Date(existing.date.getFullYear(), existing.date.getMonth() + 1, 0, 23, 59, 59, 999);

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.transaction.update({
                where: { id },
                data: {
                    description: nextDescription,
                    amount: nextAmount,
                    date: nextDate,
                    type: nextType,
                    isFixed: nextIsFixed,
                    accountId: nextAccountId,
                    categoryId: nextCategoryId,
                    ...(scope === 'series' && nextIsFixed ? { fixedUntil: null } : {}),
                },
                include: { category: true },
            });

            if (existing.status === 'PAID') {
                const oldDelta = this.balanceDelta(existing.type, existing.amount);
                const newDelta = this.balanceDelta(nextType, nextAmount);
                if (existing.accountId !== nextAccountId || oldDelta !== newDelta) {
                    await tx.account.update({
                        where: { id: existing.accountId },
                        data: { balance: { increment: -oldDelta } },
                    });
                    await tx.account.update({
                        where: { id: nextAccountId },
                        data: { balance: { increment: newDelta } },
                    });
                }
            }

            if (scope === 'series' && existing.isFixed) {
                await tx.transaction.updateMany({
                    where: {
                        id: { not: id },
                        workspaceId,
                        isFixed: true,
                        type: existing.type,
                        description: existing.description,
                        date: { lt: monthStart },
                    },
                    data: { fixedUntil: new Date(monthStart.getTime() - 1) },
                });

                const futureRows = await tx.transaction.findMany({
                    where: {
                        id: { not: id },
                        workspaceId,
                        isFixed: true,
                        type: existing.type,
                        description: existing.description,
                        date: { gt: monthEnd },
                    },
                });

                for (const row of futureRows) {
                    await tx.transaction.update({
                        where: { id: row.id },
                        data: {
                            description: nextDescription,
                            amount: nextAmount,
                            type: nextType,
                            categoryId: nextCategoryId,
                            isFixed: nextIsFixed,
                        },
                    });
                    if (row.status === 'PAID') {
                        const rowOld = this.balanceDelta(row.type, row.amount);
                        const rowNew = this.balanceDelta(nextType, nextAmount);
                        if (rowOld !== rowNew) {
                            await tx.account.update({
                                where: { id: row.accountId },
                                data: { balance: { increment: rowNew - rowOld } },
                            });
                        }
                    }
                }
            }

            return updated;
        });
    }

    /**
     * Changes the status of a transaction and keeps account balances in sync:
     * - → PAID: credits (income) or debits (expense) `accountId` when given, otherwise the transaction's account.
     *   The chosen account is saved on the transaction so a later undo reverses the same account.
     * - PAID → anything else: reverses the amount on the account that received it.
     * Status and balance are written in a single database transaction.
     */
    async updateStatus(workspaceId: string, id: string, updateDto: UpdateTransactionStatusDto) {
        const newStatus = updateDto.status;

        if (newStatus === 'PAID' && updateDto.accountId) {
            const account = await this.prisma.account.findFirst({ where: { id: updateDto.accountId, workspaceId }, select: { id: true } });
            if (!account) {
                throw new BadRequestException('Conta informada não encontrada neste workspace.');
            }
        }

        // Handle projected (virtual) fixed transactions
        if (id.startsWith('projected-')) {
            const { originalId, year: projYear, month: projMonth } = this.parseProjectedId(id);

            const original = await this.prisma.transaction.findFirst({
                where: { id: originalId, workspaceId },
            });

            if (!original) {
                throw new NotFoundException(`Original fixed transaction ${originalId} not found`);
            }

            const accountId = newStatus === 'PAID' ? updateDto.accountId ?? original.accountId : original.accountId;
            const effectiveAmount = updateDto.amount ?? original.amount;
            const projectedDate = clampedMonthDate(projYear, projMonth, new Date(original.date).getDate());

            // Create a real transaction for this month (and settle it, if paid)
            return this.prisma.$transaction(async (tx) => {
                const created = await tx.transaction.create({
                    data: {
                        workspaceId,
                        description: original.description,
                        amount: effectiveAmount,
                        date: projectedDate,
                        type: original.type,
                        status: newStatus,
                        isFixed: true,
                        fixedUntil: updateDto.amount != null ? new Date(projYear, projMonth, 0, 23, 59, 59, 999) : null,
                        accountId,
                        categoryId: original.categoryId,
                    },
                });
                if (newStatus === 'PAID') {
                    await tx.account.update({
                        where: { id: accountId },
                        data: { balance: { increment: this.balanceDelta(original.type, effectiveAmount) } },
                    });
                }
                return created;
            });
        }

        // Regular (non-projected) transaction
        const transaction = await this.prisma.transaction.findFirst({
            where: { id, workspaceId },
        });

        if (!transaction) {
            throw new NotFoundException(`Transaction with ID ${id} not found`);
        }

        const oldStatus = transaction.status;
        if (oldStatus === newStatus) {
            return transaction;
        }

        const effectiveAmount = newStatus === 'PAID' && updateDto.amount != null ? updateDto.amount : transaction.amount;
        const oldDelta = this.balanceDelta(transaction.type, transaction.amount);
        const newDelta = this.balanceDelta(transaction.type, effectiveAmount);

        return this.prisma.$transaction(async (tx) => {
            if (newStatus === 'PAID') {
                // PENDING → PAID: settle on the chosen account
                const accountId = updateDto.accountId ?? transaction.accountId;
                const updated = await tx.transaction.update({
                    where: { id },
                    data: { status: newStatus, accountId, amount: effectiveAmount },
                });
                await tx.account.update({
                    where: { id: accountId },
                    data: { balance: { increment: newDelta } },
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
                    data: { balance: { increment: -oldDelta } },
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
    async remove(workspaceId: string, id: string, scope: 'single' | 'series' = 'single') {
        const projected = id.startsWith('projected-') ? this.parseProjectedId(id) : null;
        const tx = await this.prisma.transaction.findFirst({ where: { id: projected?.originalId ?? id, workspaceId } });
        if (!tx) throw new NotFoundException(`Transaction with ID ${id} not found`);

        const monthStart = projected
            ? new Date(projected.year, projected.month - 1, 1)
            : new Date(tx.date.getFullYear(), tx.date.getMonth(), 1);

        if (!tx.isFixed) {
            if (tx.installmentGroupId && scope === 'series') {
                const groupRows = await this.prisma.transaction.findMany({
                    where: {
                        workspaceId,
                        installmentGroupId: tx.installmentGroupId,
                        date: { gte: monthStart },
                    },
                });
                return this.prisma.$transaction(async (db) => {
                    for (const row of groupRows) {
                        if (row.status === 'PAID') await this.reverseBalance(db, row);
                        await db.transaction.delete({ where: { id: row.id } });
                    }
                    return { removed: groupRows.length };
                });
            }

            return this.prisma.$transaction(async (db) => {
                if (tx.status === 'PAID') await this.reverseBalance(db, tx);
                return db.transaction.delete({ where: { id: tx.id } });
            });
        }

        if (scope === 'series') {
            const series = await this.prisma.transaction.findMany({
                where: { workspaceId, isFixed: true, description: tx.description, type: tx.type },
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
                    workspaceId,
                    description: tx.description,
                    amount: tx.amount,
                    type: tx.type,
                    date: clampedMonthDate(projected.year, projected.month, tx.date.getDate()),
                    status: 'CANCELLED',
                    isFixed: true,
                    fixedUntil: new Date(projected.year, projected.month, 0, 23, 59, 59, 999),
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
