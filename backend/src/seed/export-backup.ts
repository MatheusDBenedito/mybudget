import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const DEFAULT_BACKUP_PATH = path.resolve(__dirname, '../../prisma/backup-data.json');

async function main() {
    const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_BACKUP_PATH;
    const prisma = new PrismaClient();

    try {
        const [
            users,
            workspaces,
            roles,
            permissions,
            rolePermissions,
            workspaceUsers,
            workspaceInvites,
            accounts,
            categories,
            creditCards,
            cardHolders,
            transactions,
            cardTransactions,
            recurringExpenses,
            investments,
            investmentDividends,
            milesEntries,
            balanceAdjustments,
            accountTransfers,
            yieldPots,
            potMovements,
            accountYields,
            dashboardLayouts,
        ] = await Promise.all([
            prisma.user.findMany(),
            prisma.workspace.findMany(),
            prisma.role.findMany(),
            prisma.permission.findMany(),
            prisma.rolePermission.findMany(),
            prisma.workspaceUser.findMany(),
            prisma.workspaceInvite.findMany(),
            prisma.account.findMany(),
            prisma.category.findMany(),
            prisma.creditCard.findMany(),
            prisma.cardHolder.findMany(),
            prisma.transaction.findMany(),
            prisma.cardTransaction.findMany(),
            prisma.recurringExpense.findMany(),
            prisma.investment.findMany(),
            prisma.investmentDividend.findMany(),
            prisma.milesEntry.findMany(),
            prisma.balanceAdjustment.findMany(),
            prisma.accountTransfer.findMany(),
            prisma.yieldPot.findMany(),
            prisma.potMovement.findMany(),
            prisma.accountYield.findMany(),
            prisma.dashboardLayout.findMany(),
        ]);

        const payload = {
            exportedAt: new Date().toISOString(),
            version: 2,
            counts: {
                users: users.length,
                workspaces: workspaces.length,
                roles: roles.length,
                permissions: permissions.length,
                rolePermissions: rolePermissions.length,
                workspaceUsers: workspaceUsers.length,
                workspaceInvites: workspaceInvites.length,
                accounts: accounts.length,
                categories: categories.length,
                creditCards: creditCards.length,
                cardHolders: cardHolders.length,
                transactions: transactions.length,
                cardTransactions: cardTransactions.length,
                recurringExpenses: recurringExpenses.length,
                investments: investments.length,
                investmentDividends: investmentDividends.length,
                milesEntries: milesEntries.length,
                balanceAdjustments: balanceAdjustments.length,
                accountTransfers: accountTransfers.length,
                yieldPots: yieldPots.length,
                potMovements: potMovements.length,
                accountYields: accountYields.length,
                dashboardLayouts: dashboardLayouts.length,
            },
            data: {
                users,
                workspaces,
                roles,
                permissions,
                rolePermissions,
                workspaceUsers,
                workspaceInvites,
                accounts,
                categories,
                creditCards,
                cardHolders,
                transactions,
                cardTransactions,
                recurringExpenses,
                investments,
                investmentDividends,
                milesEntries,
                balanceAdjustments,
                accountTransfers,
                yieldPots,
                potMovements,
                accountYields,
                dashboardLayouts,
            },
        };

        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');

        console.log(`Backup exportado com sucesso para: ${outputPath}`);
        console.table(payload.counts);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error('Erro ao exportar backup:', err);
    process.exit(1);
});

