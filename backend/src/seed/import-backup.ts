import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const DEFAULT_BACKUP_PATH = path.resolve(__dirname, '../../prisma/backup-data.json');

type BackupFile = {
    exportedAt: string;
    version: number;
    data: {
        users?: any[];
        workspaces?: any[];
        roles?: any[];
        permissions?: any[];
        rolePermissions?: any[];
        workspaceUsers?: any[];
        workspaceInvites?: any[];
        accounts: any[];
        categories: any[];
        creditCards: any[];
        cardHolders: any[];
        transactions: any[];
        cardTransactions: any[];
        recurringExpenses: any[];
        investments: any[];
        investmentDividends: any[];
        milesEntries: any[];
        balanceAdjustments: any[];
        accountTransfers: any[];
        yieldPots: any[];
        potMovements: any[];
        accountYields: any[];
        dashboardLayouts: any[];
    };
};

const toDate = (v: unknown) => (v ? new Date(String(v)) : null);

async function main() {
    const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_BACKUP_PATH;
    if (!fs.existsSync(inputPath)) {
        throw new Error(`Arquivo de backup não encontrado: ${inputPath}`);
    }

    const raw = fs.readFileSync(inputPath, 'utf8');
    const backup = JSON.parse(raw) as BackupFile;
    const d = backup.data;

    const prisma = new PrismaClient();

    try {
        await prisma.$transaction(async (tx) => {
            // Clear tables in reverse dependency order
            await tx.dashboardLayout.deleteMany();
            await tx.accountYield.deleteMany();
            await tx.potMovement.deleteMany();
            await tx.yieldPot.deleteMany();
            await tx.accountTransfer.deleteMany();
            await tx.balanceAdjustment.deleteMany();
            await tx.milesEntry.deleteMany();
            await tx.investmentDividend.deleteMany();
            await tx.investment.deleteMany();
            await tx.recurringExpense.deleteMany();
            await tx.cardTransaction.deleteMany();
            await tx.transaction.deleteMany();
            await tx.cardHolder.deleteMany();
            await tx.creditCard.deleteMany();
            await tx.category.deleteMany();
            await tx.account.deleteMany();
            await tx.workspaceInvite.deleteMany();
            await tx.workspaceUser.deleteMany();
            await tx.rolePermission.deleteMany();
            await tx.permission.deleteMany();
            await tx.role.deleteMany();
            await tx.workspace.deleteMany();
            await tx.user.deleteMany();

            // Restore auth, workspaces & RBAC in topological order
            if (d.users?.length) {
                await tx.user.createMany({
                    data: d.users.map((r) => ({
                        ...r,
                        createdAt: toDate(r.createdAt) ?? new Date(),
                        updatedAt: toDate(r.updatedAt) ?? new Date(),
                    })),
                });
            }

            if (d.workspaces?.length) {
                await tx.workspace.createMany({
                    data: d.workspaces.map((r) => ({
                        ...r,
                        createdAt: toDate(r.createdAt) ?? new Date(),
                        updatedAt: toDate(r.updatedAt) ?? new Date(),
                    })),
                });
            }

            if (d.roles?.length) {
                await tx.role.createMany({
                    data: d.roles.map((r) => ({
                        ...r,
                        createdAt: toDate(r.createdAt) ?? new Date(),
                        updatedAt: toDate(r.updatedAt) ?? new Date(),
                    })),
                });
            }

            if (d.permissions?.length) {
                await tx.permission.createMany({
                    data: d.permissions.map((r) => ({
                        ...r,
                        createdAt: toDate(r.createdAt) ?? new Date(),
                    })),
                });
            }

            if (d.rolePermissions?.length) {
                await tx.rolePermission.createMany({
                    data: d.rolePermissions,
                });
            }

            if (d.workspaceUsers?.length) {
                await tx.workspaceUser.createMany({
                    data: d.workspaceUsers.map((r) => ({
                        ...r,
                        joinedAt: toDate(r.joinedAt) ?? new Date(),
                        updatedAt: toDate(r.updatedAt) ?? new Date(),
                    })),
                });
            }

            if (d.workspaceInvites?.length) {
                await tx.workspaceInvite.createMany({
                    data: d.workspaceInvites.map((r) => ({
                        ...r,
                        expiresAt: toDate(r.expiresAt) ?? new Date(),
                        createdAt: toDate(r.createdAt) ?? new Date(),
                        acceptedAt: toDate(r.acceptedAt),
                    })),
                });
            }

            // Restore financial data in topological order
            if (d.accounts?.length) {
                await tx.account.createMany({
                    data: d.accounts.map((r) => ({
                        ...r,
                        yieldSince: toDate(r.yieldSince),
                        createdAt: toDate(r.createdAt) ?? new Date(),
                        updatedAt: toDate(r.updatedAt) ?? new Date(),
                    })),
                });
            }

            if (d.categories?.length) {
                await tx.category.createMany({
                    data: d.categories.map((r) => ({
                        ...r,
                        createdAt: toDate(r.createdAt) ?? new Date(),
                        updatedAt: toDate(r.updatedAt) ?? new Date(),
                    })),
                });
            }

            if (d.creditCards?.length) {
                await tx.creditCard.createMany({
                    data: d.creditCards.map((r) => ({
                        ...r,
                        createdAt: toDate(r.createdAt) ?? new Date(),
                        updatedAt: toDate(r.updatedAt) ?? new Date(),
                    })),
                });
            }

            if (d.cardHolders?.length) {
                await tx.cardHolder.createMany({
                    data: d.cardHolders.map((r) => ({
                        ...r,
                        createdAt: toDate(r.createdAt) ?? new Date(),
                        updatedAt: toDate(r.updatedAt) ?? new Date(),
                    })),
                });
            }

            if (d.transactions?.length) {
                await tx.transaction.createMany({
                    data: d.transactions.map((r) => ({
                        ...r,
                        date: toDate(r.date) ?? new Date(),
                        fixedUntil: toDate(r.fixedUntil),
                        createdAt: toDate(r.createdAt) ?? new Date(),
                        updatedAt: toDate(r.updatedAt) ?? new Date(),
                    })),
                });
            }

            if (d.cardTransactions?.length) {
                await tx.cardTransaction.createMany({
                    data: d.cardTransactions.map((r) => ({
                        ...r,
                        date: toDate(r.date) ?? new Date(),
                        invoiceDate: toDate(r.invoiceDate) ?? new Date(),
                        createdAt: toDate(r.createdAt) ?? new Date(),
                        updatedAt: toDate(r.updatedAt) ?? new Date(),
                    })),
                });
            }

            if (d.recurringExpenses?.length) {
                await tx.recurringExpense.createMany({
                    data: d.recurringExpenses.map((r) => ({
                        ...r,
                        createdAt: toDate(r.createdAt) ?? new Date(),
                        updatedAt: toDate(r.updatedAt) ?? new Date(),
                    })),
                });
            }

            if (d.investments?.length) {
                await tx.investment.createMany({
                    data: d.investments.map((r) => ({
                        ...r,
                        investmentDate: toDate(r.investmentDate),
                        createdAt: toDate(r.createdAt) ?? new Date(),
                        updatedAt: toDate(r.updatedAt) ?? new Date(),
                    })),
                });
            }

            if (d.investmentDividends?.length) {
                await tx.investmentDividend.createMany({
                    data: d.investmentDividends.map((r) => ({
                        ...r,
                        date: toDate(r.date) ?? new Date(),
                        createdAt: toDate(r.createdAt) ?? new Date(),
                    })),
                });
            }

            if (d.milesEntries?.length) {
                await tx.milesEntry.createMany({
                    data: d.milesEntries.map((r) => ({
                        ...r,
                        expectedCreditDate: toDate(r.expectedCreditDate) ?? new Date(),
                        createdAt: toDate(r.createdAt) ?? new Date(),
                        updatedAt: toDate(r.updatedAt) ?? new Date(),
                    })),
                });
            }

            if (d.balanceAdjustments?.length) {
                await tx.balanceAdjustment.createMany({
                    data: d.balanceAdjustments.map((r) => ({
                        ...r,
                        date: toDate(r.date) ?? new Date(),
                        createdAt: toDate(r.createdAt) ?? new Date(),
                    })),
                });
            }

            if (d.accountTransfers?.length) {
                await tx.accountTransfer.createMany({
                    data: d.accountTransfers.map((r) => ({
                        ...r,
                        date: toDate(r.date) ?? new Date(),
                        createdAt: toDate(r.createdAt) ?? new Date(),
                    })),
                });
            }

            if (d.yieldPots?.length) {
                await tx.yieldPot.createMany({
                    data: d.yieldPots.map((r) => ({
                        ...r,
                        createdAt: toDate(r.createdAt) ?? new Date(),
                        updatedAt: toDate(r.updatedAt) ?? new Date(),
                    })),
                });
            }

            if (d.potMovements?.length) {
                await tx.potMovement.createMany({
                    data: d.potMovements.map((r) => ({
                        ...r,
                        date: toDate(r.date) ?? new Date(),
                        createdAt: toDate(r.createdAt) ?? new Date(),
                    })),
                });
            }

            if (d.accountYields?.length) {
                await tx.accountYield.createMany({
                    data: d.accountYields.map((r) => ({
                        ...r,
                        date: toDate(r.date) ?? new Date(),
                        createdAt: toDate(r.createdAt) ?? new Date(),
                    })),
                });
            }

            if (d.dashboardLayouts?.length) {
                await tx.dashboardLayout.createMany({
                    data: d.dashboardLayouts.map((r) => ({
                        ...r,
                        updatedAt: toDate(r.updatedAt) ?? new Date(),
                    })),
                });
            }
        });

        console.log(`Carga restaurada com sucesso a partir de: ${inputPath} (exportado em ${backup.exportedAt})`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error('Erro ao restaurar backup:', err);
    process.exit(1);
});

