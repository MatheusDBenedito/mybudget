import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PluggyProvider } from './providers/pluggy.provider';
import { RegisterConnectionDto, UpdateAccountMapDto } from './dto/open-finance.dto';
import {
    computeExternalBalanceReconciliation,
    mapExternalCardTransactionsToLocal,
    mapExternalTransactionsToLocal,
} from './helpers/open-finance-sync.helper';

@Injectable()
export class OpenFinanceService {
    private readonly logger = new Logger(OpenFinanceService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly pluggy: PluggyProvider,
    ) {}

    private ensureAllowedWorkspace(workspaceId: string): void {
        const restrictedId = process.env.OPEN_FINANCE_WORKSPACE_ID?.trim();
        if (restrictedId && restrictedId !== workspaceId) {
            throw new ForbiddenException(
                'Open Finance está restrito ao workspace pessoal configurado em OPEN_FINANCE_WORKSPACE_ID.',
            );
        }
    }

    getStatus(workspaceId: string) {
        const restrictedId = process.env.OPEN_FINANCE_WORKSPACE_ID?.trim() || null;
        return {
            provider: this.pluggy.name,
            configured: this.pluggy.isConfigured(),
            sandbox: this.pluggy.isSandbox(),
            workspaceAllowed: !restrictedId || restrictedId === workspaceId,
            restrictedWorkspaceId: restrictedId,
        };
    }

    async createConnectToken(workspaceId: string, itemId?: string) {
        this.ensureAllowedWorkspace(workspaceId);
        const accessToken = await this.pluggy.createConnectToken(itemId, workspaceId);
        return { accessToken };
    }

    async listConnections(workspaceId: string) {
        return this.prisma.openFinanceConnection.findMany({
            where: { workspaceId },
            include: {
                accountMaps: {
                    include: {
                        localAccount: { select: { id: true, name: true, currency: true, type: true } },
                        localCreditCard: { select: { id: true, name: true } },
                    },
                    orderBy: { externalName: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async registerConnection(workspaceId: string, dto: RegisterConnectionDto) {
        this.ensureAllowedWorkspace(workspaceId);
        const itemId = dto.itemId.trim();
        const [itemInfo, externalAccounts] = await Promise.all([
            this.pluggy.fetchItem(itemId),
            this.pluggy.fetchAccounts(itemId),
        ]);

        const connection = await this.prisma.openFinanceConnection.upsert({
            where: { itemId },
            update: {
                workspaceId,
                institutionName: dto.institutionName?.trim() || itemInfo.institutionName,
                status: itemInfo.status,
                consentExpiresAt: itemInfo.consentExpiresAt,
            },
            create: {
                workspaceId,
                provider: this.pluggy.name,
                itemId,
                institutionName: dto.institutionName?.trim() || itemInfo.institutionName,
                status: itemInfo.status,
                consentExpiresAt: itemInfo.consentExpiresAt,
            },
        });

        for (const extAcc of externalAccounts) {
            await this.prisma.openFinanceAccountMap.upsert({
                where: { externalAccountId: extAcc.id },
                update: {
                    connectionId: connection.id,
                    externalName: extAcc.name,
                    externalType: extAcc.type,
                    externalSubtype: extAcc.subtype,
                },
                create: {
                    connectionId: connection.id,
                    externalAccountId: extAcc.id,
                    externalName: extAcc.name,
                    externalType: extAcc.type,
                    externalSubtype: extAcc.subtype,
                },
            });
        }

        return this.prisma.openFinanceConnection.findUnique({
            where: { id: connection.id },
            include: {
                accountMaps: {
                    include: {
                        localAccount: { select: { id: true, name: true, currency: true, type: true } },
                        localCreditCard: { select: { id: true, name: true } },
                    },
                },
            },
        });
    }

    async updateMapping(workspaceId: string, mapId: string, dto: UpdateAccountMapDto) {
        this.ensureAllowedWorkspace(workspaceId);
        const existing = await this.prisma.openFinanceAccountMap.findFirst({
            where: { id: mapId, connection: { workspaceId } },
        });
        if (!existing) {
            throw new NotFoundException('Mapeamento de conta Open Finance não encontrado.');
        }

        if (dto.localAccountId) {
            const acc = await this.prisma.account.findFirst({
                where: { id: dto.localAccountId, workspaceId },
                select: { id: true },
            });
            if (!acc) throw new BadRequestException('Conta local inválida para este workspace.');
        }

        if (dto.localCreditCardId) {
            const card = await this.prisma.creditCard.findFirst({
                where: { id: dto.localCreditCardId, workspaceId },
                select: { id: true },
            });
            if (!card) throw new BadRequestException('Cartão local inválido para este workspace.');
        }

        return this.prisma.openFinanceAccountMap.update({
            where: { id: mapId },
            data: {
                ...(dto.localAccountId !== undefined ? { localAccountId: dto.localAccountId } : {}),
                ...(dto.localCreditCardId !== undefined ? { localCreditCardId: dto.localCreditCardId } : {}),
                ...(dto.syncEnabled !== undefined ? { syncEnabled: dto.syncEnabled } : {}),
            },
            include: {
                localAccount: { select: { id: true, name: true, currency: true, type: true } },
                localCreditCard: { select: { id: true, name: true } },
            },
        });
    }

    async syncConnection(workspaceId: string, connectionId: string) {
        this.ensureAllowedWorkspace(workspaceId);
        const connection = await this.prisma.openFinanceConnection.findFirst({
            where: { id: connectionId, workspaceId },
            include: { accountMaps: true },
        });
        if (!connection) {
            throw new NotFoundException('Conexão Open Finance não encontrada.');
        }

        const [itemInfo, externalAccounts] = await Promise.all([
            this.pluggy.fetchItem(connection.itemId),
            this.pluggy.fetchAccounts(connection.itemId),
        ]);
        const externalBalanceById = new Map<string, number | null>(
            externalAccounts.map((acc) => [acc.id, acc.balance ?? null]),
        );
        let importedCount = 0;
        let skippedCount = 0;

        for (const map of connection.accountMaps) {
            if (!map.syncEnabled) {
                continue;
            }

            if (map.externalType === 'BANK' && map.localAccountId) {
                const counts = await this.syncBankMap(
                    workspaceId,
                    map.id,
                    map.externalAccountId,
                    map.localAccountId,
                    map.lastSyncedAt,
                    externalBalanceById.get(map.externalAccountId) ?? null,
                );
                importedCount += counts.importedCount;
                skippedCount += counts.skippedCount;
            } else if (map.externalType === 'CREDIT' && map.localCreditCardId) {
                const counts = await this.syncCardMap(workspaceId, map.id, map.externalAccountId, map.localCreditCardId, map.lastSyncedAt);
                importedCount += counts.importedCount;
                skippedCount += counts.skippedCount;
            }
        }

        const updatedConnection = await this.prisma.openFinanceConnection.update({
            where: { id: connection.id },
            data: {
                status: itemInfo.status,
                consentExpiresAt: itemInfo.consentExpiresAt,
                lastSyncedAt: new Date(),
            },
            include: {
                accountMaps: {
                    include: {
                        localAccount: { select: { id: true, name: true, currency: true, type: true } },
                        localCreditCard: { select: { id: true, name: true } },
                    },
                },
            },
        });

        return {
            connection: updatedConnection,
            importedCount,
            skippedCount,
        };
    }

    async removeConnection(workspaceId: string, connectionId: string) {
        this.ensureAllowedWorkspace(workspaceId);
        const existing = await this.prisma.openFinanceConnection.findFirst({
            where: { id: connectionId, workspaceId },
            select: { id: true },
        });
        if (!existing) {
            throw new NotFoundException('Conexão Open Finance não encontrada.');
        }
        await this.prisma.openFinanceConnection.delete({ where: { id: existing.id } });
        return { deleted: true };
    }

    async handlePluggyWebhook(payload: { event?: string; itemId?: string }, secretHeader?: string) {
        const expectedSecret = process.env.PLUGGY_WEBHOOK_SECRET?.trim();
        if (expectedSecret && secretHeader !== expectedSecret) {
            throw new ForbiddenException('Webhook secret inválido.');
        }
        if (!payload?.itemId) {
            return { ok: true, ignored: true };
        }
        const connection = await this.prisma.openFinanceConnection.findUnique({
            where: { itemId: payload.itemId },
        });
        if (!connection) {
            return { ok: true, ignored: true };
        }

        this.logger.log(`Pluggy webhook received (${payload.event ?? 'unknown'}) for item ${payload.itemId}`);
        if (payload.event === 'item/updated' || payload.event === 'transactions/created') {
            await this.syncConnection(connection.workspaceId, connection.id);
        } else if (payload.event === 'item/error' || payload.event === 'item/login_error') {
            await this.prisma.openFinanceConnection.update({
                where: { id: connection.id },
                data: { status: 'LOGIN_ERROR' },
            });
        }
        return { ok: true };
    }

    private computeFromDate(lastSyncedAt: Date | null): string {
        return lastSyncedAt
            ? new Date(lastSyncedAt.getTime() - 2 * 86_400_000).toISOString().slice(0, 10)
            : new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    }

    private async syncBankMap(
        workspaceId: string,
        mapId: string,
        externalAccountId: string,
        localAccountId: string,
        lastSyncedAt: Date | null,
        externalBalance: number | null = null,
    ) {
        const fromDate = this.computeFromDate(lastSyncedAt);
        const externalTxs = await this.pluggy.fetchTransactions(externalAccountId, fromDate);
        const extIds = externalTxs.map((t) => t.id).filter(Boolean);

        const [existingRows, unlinkedCandidates] = await Promise.all([
            extIds.length > 0
                ? this.prisma.transaction.findMany({
                      where: { externalId: { in: extIds } },
                      select: { externalId: true },
                  })
                : Promise.resolve([]),
            this.prisma.transaction.findMany({
                where: {
                    workspaceId,
                    accountId: localAccountId,
                    externalId: null,
                    type: { in: ['INCOME', 'EXPENSE'] },
                    date: { gte: new Date(new Date(fromDate).getTime() - 2 * 86_400_000) },
                },
                select: { id: true, amount: true, date: true, type: true },
            }),
        ]);

        const existingSet = new Set(
            existingRows.map((r) => r.externalId).filter((v): v is string => Boolean(v)),
        );

        const plan = mapExternalTransactionsToLocal({
            transactions: externalTxs,
            existingExternalIds: existingSet,
            unlinkedCandidates: unlinkedCandidates
                .filter((c): c is typeof c & { type: 'INCOME' | 'EXPENSE' } => c.type === 'INCOME' || c.type === 'EXPENSE')
                .map((c) => ({
                    id: c.id,
                    amount: c.amount,
                    date: c.date,
                    type: c.type,
                })),
        });

        if (plan.toCreate.length > 0 || plan.toLink.length > 0) {
            await this.prisma.$transaction(async (tx) => {
                for (const link of plan.toLink) {
                    await tx.transaction.update({
                        where: { id: link.localId },
                        data: { externalId: link.externalId },
                    });
                }

                if (plan.toCreate.length > 0) {
                    await tx.transaction.createMany({
                        data: plan.toCreate.map((item) => ({
                            workspaceId,
                            accountId: localAccountId,
                            description: item.description,
                            amount: item.amount,
                            date: item.date,
                            type: item.type,
                            status: item.status,
                            externalId: item.externalId,
                        })),
                        skipDuplicates: true,
                    });

                    if (plan.balanceDelta !== 0) {
                        await tx.account.update({
                            where: { id: localAccountId },
                            data: { balance: { increment: plan.balanceDelta } },
                        });
                    }
                }
            });
        }

        const localAccount = await this.prisma.account.findFirst({
            where: { id: localAccountId, workspaceId },
            select: {
                id: true,
                name: true,
                currency: true,
                balance: true,
                pots: { select: { id: true, balance: true } },
            },
        });

        let reconciledDelta = 0;
        if (localAccount && localAccount.currency === 'BRL') {
            const reconciliation = computeExternalBalanceReconciliation({
                externalBalance,
                localBalance: localAccount.balance,
                pots: localAccount.pots,
            });

            if (reconciliation) {
                const now = new Date();
                await this.prisma.$transaction(async (tx) => {
                    await tx.account.update({
                        where: { id: localAccountId },
                        data: { balance: { increment: reconciliation.delta } },
                    });

                    if (reconciliation.targetPotId) {
                        await tx.yieldPot.update({
                            where: { id: reconciliation.targetPotId },
                            data: { balance: { increment: reconciliation.delta } },
                        });
                        await tx.potMovement.create({
                            data: {
                                potId: reconciliation.targetPotId,
                                amount: reconciliation.delta,
                                kind: 'adjustment',
                                date: now,
                            },
                        });
                    } else {
                        await tx.balanceAdjustment.create({
                            data: {
                                workspaceId,
                                accountId: localAccountId,
                                amount: reconciliation.delta,
                                date: now,
                            },
                        });
                    }
                });

                reconciledDelta = reconciliation.delta;
                this.logger.log(
                    `Reconciled Open Finance balance for "${localAccount.name}" by R$ ${reconciliation.delta.toFixed(2)}`,
                );
            }
        }

        await this.prisma.openFinanceAccountMap.update({
            where: { id: mapId },
            data: { lastSyncedAt: new Date() },
        });

        return {
            importedCount: plan.toCreate.length,
            skippedCount: plan.skippedCount,
            reconciledDelta,
        };
    }

    private async syncCardMap(
        workspaceId: string,
        mapId: string,
        externalAccountId: string,
        localCreditCardId: string,
        lastSyncedAt: Date | null,
    ) {
        const creditCard = await this.prisma.creditCard.findFirst({
            where: { id: localCreditCardId, workspaceId },
            include: { holders: true },
        });
        if (!creditCard) {
            throw new NotFoundException('Cartão de crédito local mapeado não encontrado.');
        }

        let defaultHolder = creditCard.holders.find((h) => h.isMain) ?? creditCard.holders[0];
        if (!defaultHolder) {
            defaultHolder = await this.prisma.cardHolder.create({
                data: {
                    creditCardId: creditCard.id,
                    name: 'Titular',
                    isMain: true,
                },
            });
        }

        const fromDate = this.computeFromDate(lastSyncedAt);
        const externalTxs = await this.pluggy.fetchTransactions(externalAccountId, fromDate);
        const extIds = externalTxs.map((t) => t.id).filter(Boolean);

        const [existingRows, unlinkedCandidates] = await Promise.all([
            extIds.length > 0
                ? this.prisma.cardTransaction.findMany({
                      where: { externalId: { in: extIds } },
                      select: { externalId: true },
                  })
                : Promise.resolve([]),
            this.prisma.cardTransaction.findMany({
                where: {
                    workspaceId,
                    creditCardId: localCreditCardId,
                    externalId: null,
                    invoiceDate: { gte: new Date(new Date(fromDate).getTime() - 45 * 86_400_000) },
                },
                select: { id: true, amount: true, date: true, invoiceDate: true },
            }),
        ]);

        const existingSet = new Set(
            existingRows.map((r) => r.externalId).filter((v): v is string => Boolean(v)),
        );

        const plan = mapExternalCardTransactionsToLocal({
            transactions: externalTxs,
            existingExternalIds: existingSet,
            invoiceClosingOffset: creditCard.invoiceClosingOffset,
            dueDay: creditCard.dueDay,
            unlinkedCandidates,
        });

        const holderByLast4 = new Map<string, string>();
        for (const h of creditCard.holders) {
            if (h.last4) holderByLast4.set(h.last4, h.id);
        }

        if (plan.toCreate.length > 0 || plan.toLink.length > 0) {
            await this.prisma.$transaction(async (tx) => {
                for (const link of plan.toLink) {
                    await tx.cardTransaction.update({
                        where: { id: link.localId },
                        data: { externalId: link.externalId },
                    });
                }

                if (plan.toCreate.length > 0) {
                    await tx.cardTransaction.createMany({
                        data: plan.toCreate.map((item) => ({
                            workspaceId,
                            creditCardId: localCreditCardId,
                            cardHolderId: (item.cardLast4 && holderByLast4.get(item.cardLast4)) || defaultHolder.id,
                            description: item.description,
                            amount: item.amount,
                            date: item.date,
                            invoiceDate: item.invoiceDate,
                            installments: item.installments,
                            externalId: item.externalId,
                        })),
                        skipDuplicates: true,
                    });
                }
            });
        }

        await this.prisma.openFinanceAccountMap.update({
            where: { id: mapId },
            data: { lastSyncedAt: new Date() },
        });

        return {
            importedCount: plan.toCreate.length,
            skippedCount: plan.skippedCount,
        };
    }
}

