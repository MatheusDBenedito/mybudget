import { PrismaClient } from '@prisma/client';
import { hashPassword } from './password.util';
import { seedDefaultWorkspaceData } from '../workspaces/default-workspace-seed';

export type PermissionSeed = {
    code: string;
    module: string;
    action: string;
    description: string;
};

export const DEFAULT_PERMISSIONS: PermissionSeed[] = [
    { code: 'view:resumo', module: 'resumo', action: 'view', description: 'Visualizar página Resumo' },
    { code: 'edit:resumo_layout', module: 'resumo', action: 'edit', description: 'Personalizar layout do Resumo' },
    { code: 'view:fluxo_caixa', module: 'fluxo_caixa', action: 'view', description: 'Visualizar Fluxo de Caixa' },
    { code: 'delete:fluxo_caixa', module: 'fluxo_caixa', action: 'delete', description: 'Excluir lançamentos no Fluxo de Caixa' },
    { code: 'view:despesa', module: 'despesa', action: 'view', description: 'Visualizar receitas e despesas em conta' },
    { code: 'create:despesa', module: 'despesa', action: 'create', description: 'Criar receitas e despesas em conta' },
    { code: 'edit:despesa', module: 'despesa', action: 'edit', description: 'Editar ou liquidar receitas e despesas' },
    { code: 'delete:despesa', module: 'despesa', action: 'delete', description: 'Excluir receitas e despesas' },
    { code: 'view:conta', module: 'conta', action: 'view', description: 'Visualizar contas e cofrinhos' },
    { code: 'create:conta', module: 'conta', action: 'create', description: 'Criar contas e cofrinhos' },
    { code: 'edit:conta', module: 'conta', action: 'edit', description: 'Editar contas, saldos e transferências' },
    { code: 'delete:conta', module: 'conta', action: 'delete', description: 'Excluir contas e cofrinhos' },
    { code: 'view:cartao', module: 'cartao', action: 'view', description: 'Visualizar cartões e faturas' },
    { code: 'create:cartao', module: 'cartao', action: 'create', description: 'Criar cartões, portadores e compras' },
    { code: 'edit:cartao', module: 'cartao', action: 'edit', description: 'Editar cartões, portadores e compras' },
    { code: 'delete:cartao', module: 'cartao', action: 'delete', description: 'Excluir cartões, portadores e compras' },
    { code: 'view:investimentos', module: 'investimentos', action: 'view', description: 'Visualizar carteira e proventos' },
    { code: 'create:investimentos', module: 'investimentos', action: 'create', description: 'Criar aportes de investimentos' },
    { code: 'edit:investimentos', module: 'investimentos', action: 'edit', description: 'Editar investimentos e sincronizar proventos' },
    { code: 'delete:investimentos', module: 'investimentos', action: 'delete', description: 'Excluir investimentos' },
    { code: 'view:milhas', module: 'milhas', action: 'view', description: 'Visualizar milhas' },
    { code: 'create:milhas', module: 'milhas', action: 'create', description: 'Criar lançamentos de milhas' },
    { code: 'edit:milhas', module: 'milhas', action: 'edit', description: 'Editar lançamentos de milhas' },
    { code: 'delete:milhas', module: 'milhas', action: 'delete', description: 'Excluir lançamentos de milhas' },
    { code: 'view:membros', module: 'workspace', action: 'view', description: 'Visualizar membros do workspace' },
    { code: 'manage:membros', module: 'workspace', action: 'manage_members', description: 'Convidar, alterar perfis e remover membros' },
    { code: 'manage:workspace', module: 'workspace', action: 'manage', description: 'Gerenciar configurações do workspace' },
];

export const DEFAULT_ROLE_DEFINITIONS: {
    code: 'OWNER' | 'EDITOR' | 'VIEWER';
    name: string;
    description: string;
    permissions: string[];
}[] = [
    {
        code: 'OWNER',
        name: 'Proprietário',
        description: 'Acesso total ao workspace, dados financeiros e gestão de membros.',
        permissions: DEFAULT_PERMISSIONS.map((p) => p.code),
    },
    {
        code: 'EDITOR',
        name: 'Editor',
        description: 'Pode visualizar e modificar despesas, receitas, cartões, contas e investimentos.',
        permissions: [
            'view:resumo',
            'edit:resumo_layout',
            'view:fluxo_caixa',
            'view:despesa',
            'create:despesa',
            'edit:despesa',
            'delete:despesa',
            'view:conta',
            'create:conta',
            'edit:conta',
            'view:cartao',
            'create:cartao',
            'edit:cartao',
            'view:investimentos',
            'create:investimentos',
            'edit:investimentos',
            'delete:investimentos',
            'view:milhas',
            'create:milhas',
            'edit:milhas',
            'delete:milhas',
            'view:membros',
        ],
    },
    {
        code: 'VIEWER',
        name: 'Leitor',
        description: 'Somente leitura da página Resumo.',
        permissions: ['view:resumo'],
    },
];

export const ALL_PERMISSION_MODULES = Array.from(
    new Set(DEFAULT_PERMISSIONS.map((p) => p.module)),
);

export const DEFAULT_PLAN_DEFINITIONS = [
    {
        code: 'ESSENCIAL',
        name: 'Essencial',
        description: 'Controle básico: Resumo, Fluxo de Caixa, Contas, Cartões e Categorias.',
        allowedModules: [
            'resumo',
            'despesa',
            'receita',
            'fluxo_caixa',
            'cartao',
            'conta',
            'categoria',
            'membros',
            'workspace',
        ],
        isDefault: false,
    },
    {
        code: 'PRO',
        name: 'Pro',
        description: 'Inclui Investimentos e Relatórios (sem Milhas).',
        allowedModules: [
            'resumo',
            'despesa',
            'receita',
            'fluxo_caixa',
            'cartao',
            'investimentos',
            'conta',
            'categoria',
            'membros',
            'workspace',
        ],
        isDefault: true,
    },
    {
        code: 'COMPLETO',
        name: 'Completo',
        description: 'Acesso completo a todos os módulos, incluindo Milhas.',
        allowedModules: ALL_PERMISSION_MODULES,
        isDefault: false,
    },
] as const;

/**
 * Intersects a role's permissions with the user's subscription plan allowedModules.
 * If allowedModules is null/undefined (e.g. Super Admin or unassigned), all role permissions apply.
 */
export function filterPermissionsByPlan(
    permissions: ReadonlyArray<{ code: string; module?: string | null }>,
    allowedModules?: readonly string[] | null,
): string[] {
    if (!allowedModules) {
        return permissions.map((p) => p.code);
    }
    const allowedSet = new Set(allowedModules);
    return permissions
        .filter((p) => !p.module || allowedSet.has(p.module))
        .map((p) => p.code);
}

/**
 * Ensures the global RBAC catalog (Permissions and system Roles) exists idempotently.
 */
export async function ensureRbacCatalog(prisma: PrismaClient) {
    const permissionMap = new Map<string, string>();

    for (const perm of DEFAULT_PERMISSIONS) {
        const record = await prisma.permission.upsert({
            where: { code: perm.code },
            update: { module: perm.module, action: perm.action, description: perm.description },
            create: perm,
        });
        permissionMap.set(perm.code, record.id);
    }

    const roleMap = new Map<string, string>();
    for (const roleDef of DEFAULT_ROLE_DEFINITIONS) {
        let role = await prisma.role.findFirst({
            where: { code: roleDef.code, workspaceId: null },
        });
        if (!role) {
            role = await prisma.role.create({
                data: {
                    code: roleDef.code,
                    name: roleDef.name,
                    description: roleDef.description,
                    isSystem: true,
                    workspaceId: null,
                },
            });
        }
        roleMap.set(roleDef.code, role.id);

        // Ensure default role permissions are attached (never strips custom admin additions if role already existed, only adds missing defaults on fresh role)
        const existingCount = await prisma.rolePermission.count({ where: { roleId: role.id } });
        if (existingCount === 0) {
            await prisma.rolePermission.createMany({
                data: roleDef.permissions
                    .map((code) => permissionMap.get(code))
                    .filter((id): id is string => !!id)
                    .map((permissionId) => ({ roleId: role.id, permissionId })),
                skipDuplicates: true,
            });
        }
    }

    const planMap = new Map<string, string>();
    for (const planDef of DEFAULT_PLAN_DEFINITIONS) {
        let plan = await prisma.plan.findUnique({ where: { code: planDef.code } });
        if (!plan) {
            plan = await prisma.plan.create({
                data: {
                    code: planDef.code,
                    name: planDef.name,
                    description: planDef.description,
                    allowedModules: [...planDef.allowedModules],
                    isDefault: planDef.isDefault,
                },
            });
        }
        planMap.set(planDef.code, plan.id);
    }

    return { permissionMap, roleMap, planMap };
}

/**
 * Ensures at least one Super Admin user and default Workspace exist, and backfills
 * any legacy rows created before multi-tenancy (`workspaceId IS NULL`) into that workspace.
 */
export async function ensureBootstrapWorkspace(prisma: PrismaClient) {
    const { roleMap, planMap } = await ensureRbacCatalog(prisma);
    const ownerRoleId = roleMap.get('OWNER')!;
    const completoPlanId = planMap.get('COMPLETO')!;

    const envEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    const envPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    const envName = process.env.BOOTSTRAP_ADMIN_NAME?.trim();

    const adminEmail = envEmail || 'admincockpitlife';
    const adminName = envName || 'AdminCockpitLife';

    let user = await prisma.user.findFirst({
        where: { isSuperAdmin: true },
        orderBy: { createdAt: 'asc' },
    });

    if (!user) {
        user = await prisma.user.findUnique({ where: { email: adminEmail } });
    }

    if (!user) {
        if (!envPassword) {
            throw new Error(
                'BOOTSTRAP_ADMIN_PASSWORD não definido no .env para criação do Super Admin inicial.',
            );
        }
        user = await prisma.user.create({
            data: {
                name: adminName,
                email: adminEmail,
                passwordHash: hashPassword(envPassword),
                isSuperAdmin: true,
                isActive: true,
                planId: completoPlanId,
            },
        });
    } else {
        const updates: Record<string, unknown> = {};
        if (!user.planId) updates.planId = completoPlanId;
        if (envEmail && user.email !== envEmail) updates.email = envEmail;
        if (envName && user.name !== envName) updates.name = envName;
        if (envPassword) updates.passwordHash = hashPassword(envPassword);

        if (Object.keys(updates).length > 0) {
            user = await prisma.user.update({
                where: { id: user.id },
                data: updates,
            });
        }
    }

    const defaultPlanId = planMap.get('PRO') ?? completoPlanId;
    await prisma.user.updateMany({
        where: { planId: null, isSuperAdmin: false },
        data: { planId: defaultPlanId },
    });

    let workspace = await prisma.workspace.findFirst({
        orderBy: { createdAt: 'asc' },
    });

    if (!workspace) {
        workspace = await prisma.workspace.create({
            data: {
                name: 'Meu Workspace',
                slug: 'meu-workspace',
                createdById: user.id,
            },
        });
    }

    await prisma.workspaceUser.upsert({
        where: {
            workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
        },
        update: { status: 'ACTIVE' },
        create: {
            workspaceId: workspace.id,
            userId: user.id,
            roleId: ownerRoleId,
            status: 'ACTIVE',
        },
    });

    if (!user.defaultWorkspaceId) {
        await prisma.user.update({
            where: { id: user.id },
            data: { defaultWorkspaceId: workspace.id },
        });
    }

    // Backfill all legacy rows where workspaceId IS NULL
    await Promise.all([
        prisma.account.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
        prisma.category.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
        prisma.transaction.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
        prisma.creditCard.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
        prisma.cardTransaction.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
        prisma.recurringExpense.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
        prisma.investment.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
        prisma.milesEntry.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
        prisma.balanceAdjustment.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
        prisma.accountTransfer.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
        prisma.dashboardLayout.updateMany({
            where: { workspaceId: null },
            data: { workspaceId: workspace.id, userId: user.id },
        }),
    ]);

    // Seed default account, card, and categories if the workspace is completely empty
    await seedDefaultWorkspaceData(prisma, workspace.id);

    return { user, workspace };
}

