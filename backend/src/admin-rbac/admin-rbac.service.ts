import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminPermissionDto, CreateAdminRoleDto } from '../workspaces/dto/workspace.dto';

@Injectable()
export class AdminRbacService {
    constructor(private readonly prisma: PrismaService) {}

    listPermissions() {
        return this.prisma.permission.findMany({
            orderBy: [{ module: 'asc' }, { action: 'asc' }],
        });
    }

    async createPermission(dto: CreateAdminPermissionDto) {
        const code = dto.code.trim().toLowerCase();
        const existing = await this.prisma.permission.findUnique({ where: { code } });
        if (existing) {
            throw new ConflictException(`Permissão "${code}" já existe.`);
        }
        return this.prisma.permission.create({
            data: {
                code,
                module: dto.module.trim().toLowerCase(),
                action: dto.action.trim().toLowerCase(),
                description: dto.description?.trim() || `${dto.action.trim().toLowerCase()}:${dto.module.trim().toLowerCase()}`,
            },
        });
    }

    async deletePermission(id: string) {
        const existing = await this.prisma.permission.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Permissão não encontrada.');
        return this.prisma.permission.delete({ where: { id } });
    }

    async listRoles() {
        const roles = await this.prisma.role.findMany({
            where: { workspaceId: null },
            orderBy: { code: 'asc' },
            include: {
                permissions: {
                    include: { permission: true },
                },
                _count: { select: { members: true } },
            },
        });

        return roles.map((r) => ({
            id: r.id,
            code: r.code,
            name: r.name,
            description: r.description,
            isSystem: r.isSystem,
            membersCount: r._count.members,
            permissions: r.permissions.map((rp) => rp.permission),
        }));
    }

    async createRole(dto: CreateAdminRoleDto) {
        const code = dto.code.trim().toUpperCase();
        const existing = await this.prisma.role.findFirst({
            where: { code, workspaceId: null },
        });
        if (existing) {
            throw new ConflictException(`Perfil "${code}" já existe.`);
        }
        return this.prisma.role.create({
            data: {
                code,
                name: dto.name.trim(),
                description: dto.description?.trim(),
                isSystem: false,
                workspaceId: null,
            },
        });
    }

    async setRolePermissions(roleId: string, permissionIds: string[]) {
        const role = await this.prisma.role.findUnique({ where: { id: roleId } });
        if (!role) throw new NotFoundException('Perfil não encontrado.');

        await this.prisma.$transaction(async (tx) => {
            await tx.rolePermission.deleteMany({ where: { roleId } });
            if (permissionIds.length > 0) {
                await tx.rolePermission.createMany({
                    data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
                    skipDuplicates: true,
                });
            }
        });

        return this.listRoles();
    }

    async getPlatformOverview() {
        const [usersCount, workspacesCount, permissionsCount, rolesCount, workspaces] =
            await Promise.all([
                this.prisma.user.count(),
                this.prisma.workspace.count(),
                this.prisma.permission.count(),
                this.prisma.role.count({ where: { workspaceId: null } }),
                this.prisma.workspace.findMany({
                    orderBy: { createdAt: 'desc' },
                    include: {
                        createdBy: { select: { id: true, name: true, email: true } },
                        _count: { select: { members: true, accounts: true, transactions: true } },
                    },
                }),
            ]);

        return {
            stats: { usersCount, workspacesCount, permissionsCount, rolesCount },
            workspaces,
        };
    }

    listPlans() {
        return this.prisma.plan.findMany({
            orderBy: { createdAt: 'asc' },
            include: { _count: { select: { users: true } } },
        });
    }

    async createPlan(dto: { code: string; name: string; description?: string; allowedModules: string[] }) {
        const code = dto.code.trim().toUpperCase();
        const existing = await this.prisma.plan.findUnique({ where: { code } });
        if (existing) {
            throw new ConflictException(`Plano "${code}" já existe.`);
        }
        return this.prisma.plan.create({
            data: {
                code,
                name: dto.name.trim(),
                description: dto.description?.trim(),
                allowedModules: dto.allowedModules.map((m) => m.trim().toLowerCase()),
            },
        });
    }

    async setPlanModules(planId: string, allowedModules: string[]) {
        const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) throw new NotFoundException('Plano não encontrado.');

        return this.prisma.plan.update({
            where: { id: planId },
            data: { allowedModules: Array.from(new Set(allowedModules.map((m) => m.trim().toLowerCase()))) },
        });
    }

    listUsers() {
        return this.prisma.user.findMany({
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                name: true,
                email: true,
                isSuperAdmin: true,
                isActive: true,
                planId: true,
                plan: { select: { id: true, code: true, name: true } },
            },
        });
    }

    async setUserPlan(userId: string, planId: string) {
        const [user, plan] = await Promise.all([
            this.prisma.user.findUnique({ where: { id: userId } }),
            this.prisma.plan.findUnique({ where: { id: planId } }),
        ]);
        if (!user) throw new NotFoundException('Usuário não encontrado.');
        if (!plan) throw new NotFoundException('Plano não encontrado.');

        return this.prisma.user.update({
            where: { id: userId },
            data: { planId },
            select: {
                id: true,
                name: true,
                email: true,
                isSuperAdmin: true,
                planId: true,
                plan: { select: { id: true, code: true, name: true } },
            },
        });
    }
}

