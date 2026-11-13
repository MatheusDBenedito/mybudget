import { Prisma, PrismaClient } from '@prisma/client';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export const DEFAULT_WORKSPACE_CATEGORIES = [
    { name: 'Alimentação', color: 'bg-red-500', icon: 'Utensils' },
    { name: 'Moradia', color: 'bg-orange-500', icon: 'Home' },
    { name: 'Transporte', color: 'bg-yellow-500', icon: 'Car' },
    { name: 'Saúde', color: 'bg-emerald-500', icon: 'HeartPulse' },
    { name: 'Lazer', color: 'bg-violet-500', icon: 'Gamepad2' },
    { name: 'Educação', color: 'bg-blue-500', icon: 'GraduationCap' },
    { name: 'Assinaturas', color: 'bg-pink-500', icon: 'Smartphone' },
    { name: 'Salário', color: 'bg-green-500', icon: 'DollarSign' },
    { name: 'Investimentos', color: 'bg-cyan-500', icon: 'TrendingUp' },
    { name: 'Outros', color: 'bg-slate-500', icon: 'Tag' },
] as const;

/**
 * Seeds a fresh workspace with 1 default checking account, 1 default credit card
 * (with main holder), and primary categories so new workspaces are ready to use.
 * Idempotent: skips if the workspace already has accounts, cards, or categories.
 */
export async function seedDefaultWorkspaceData(prisma: PrismaLike, workspaceId: string) {
    const [accountsCount, cardsCount, categoriesCount] = await Promise.all([
        prisma.account.count({ where: { workspaceId } }),
        prisma.creditCard.count({ where: { workspaceId } }),
        prisma.category.count({ where: { workspaceId } }),
    ]);

    if (accountsCount > 0 || cardsCount > 0 || categoriesCount > 0) {
        return { seeded: false };
    }

    const account = await prisma.account.create({
        data: {
            workspaceId,
            name: 'Conta Principal',
            balance: 0,
            currency: 'BRL',
            type: 'CHECKING',
        },
    });

    const card = await prisma.creditCard.create({
        data: {
            workspaceId,
            name: 'Cartão Principal',
            limit: 5000,
            invoiceClosingOffset: 7,
            dueDay: 10,
            color: 'from-neutral-800 to-neutral-950',
            isPrimary: true,
            accountId: account.id,
        },
    });

    await prisma.cardHolder.create({
        data: {
            creditCardId: card.id,
            name: 'Titular',
            isMain: true,
        },
    });

    await prisma.category.createMany({
        data: DEFAULT_WORKSPACE_CATEGORIES.map((cat) => ({
            workspaceId,
            name: cat.name,
            color: cat.color,
            icon: cat.icon,
        })),
    });

    return { seeded: true };
}

