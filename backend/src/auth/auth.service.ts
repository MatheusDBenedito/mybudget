import {
    ConflictException,
    Injectable,
    OnModuleInit,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { hashPassword, verifyPassword } from './password.util';
import { ensureBootstrapWorkspace, ensureRbacCatalog, filterPermissionsByPlan } from './rbac-catalog';
import { seedDefaultWorkspaceData } from '../workspaces/default-workspace-seed';

const slugify = (text: string) =>
    text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'workspace';

@Injectable()
export class AuthService implements OnModuleInit {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
    ) {}

    async onModuleInit() {
        await ensureBootstrapWorkspace(this.prisma);
    }

    async login(dto: LoginDto) {
        const identifier = dto.email.trim().toLowerCase();
        const user = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { name: { equals: dto.email.trim(), mode: 'insensitive' } },
                    { email: identifier.includes('@') ? identifier.split('@')[0] : `${identifier}@teste.com` },
                ],
            },
        });
        if (
            !user ||
            !user.isActive ||
            !user.passwordHash ||
            !verifyPassword(dto.password, user.passwordHash)
        ) {
            throw new UnauthorizedException('E-mail ou senha inválidos.');
        }

        const accessToken = await this.jwtService.signAsync({
            sub: user.id,
            email: user.email,
        });

        const profile = await this.getProfile(user.id);
        return { accessToken, ...profile };
    }

    async register(dto: RegisterDto) {
        const email = dto.email.trim().toLowerCase();
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing) {
            throw new ConflictException('Já existe um usuário cadastrado com este e-mail.');
        }

        const { roleMap, planMap } = await ensureRbacCatalog(this.prisma);
        const ownerRoleId = roleMap.get('OWNER')!;
        const defaultPlan = await this.prisma.plan.findFirst({ where: { isDefault: true } });
        const defaultPlanId = defaultPlan?.id ?? planMap.get('PRO') ?? null;
        const workspaceLabel = dto.workspaceName?.trim() || `Workspace de ${dto.name.trim()}`;
        const slug = `${slugify(workspaceLabel)}-${randomUUID().slice(0, 6)}`;

        const result = await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    name: dto.name.trim(),
                    email,
                    passwordHash: hashPassword(dto.password),
                    isSuperAdmin: false,
                    isActive: true,
                    planId: defaultPlanId,
                },
            });

            const workspace = await tx.workspace.create({
                data: {
                    name: workspaceLabel,
                    slug,
                    createdById: user.id,
                },
            });

            await tx.workspaceUser.create({
                data: {
                    workspaceId: workspace.id,
                    userId: user.id,
                    roleId: ownerRoleId,
                    status: 'ACTIVE',
                },
            });

            await tx.user.update({
                where: { id: user.id },
                data: { defaultWorkspaceId: workspace.id },
            });

            await seedDefaultWorkspaceData(tx, workspace.id);

            return { user, workspace };
        });

        const accessToken = await this.jwtService.signAsync({
            sub: result.user.id,
            email: result.user.email,
        });

        const profile = await this.getProfile(result.user.id, result.workspace.id);
        return { accessToken, ...profile };
    }

    async getProfile(userId: string, requestedWorkspaceId?: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                isSuperAdmin: true,
                defaultWorkspaceId: true,
                plan: {
                    select: { id: true, code: true, name: true, allowedModules: true },
                },
                memberships: {
                    where: { status: 'ACTIVE' },
                    orderBy: { joinedAt: 'asc' },
                    include: {
                        workspace: { select: { id: true, name: true, slug: true } },
                        role: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                permissions: {
                                    include: { permission: { select: { code: true, module: true } } },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!user) {
            throw new UnauthorizedException('Usuário não encontrado.');
        }

        const planModules = user.isSuperAdmin ? null : user.plan?.allowedModules ?? null;
        const workspaces = user.memberships.map((m) => ({
            id: m.workspace.id,
            name: m.workspace.name,
            slug: m.workspace.slug,
            roleCode: m.role.code,
            roleName: m.role.name,
            permissions: filterPermissionsByPlan(
                m.role.permissions.map((rp) => rp.permission),
                planModules,
            ),
        }));

        const activeWorkspace =
            workspaces.find((w) => w.id === requestedWorkspaceId) ??
            workspaces.find((w) => w.id === user.defaultWorkspaceId) ??
            workspaces[0] ??
            null;

        const pendingInvitesCount = await this.prisma.workspaceInvite.count({
            where: {
                email: user.email,
                status: 'PENDING',
                expiresAt: { gt: new Date() },
            },
        });

        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                isSuperAdmin: user.isSuperAdmin,
                defaultWorkspaceId: user.defaultWorkspaceId,
                plan: user.plan
                    ? {
                          id: user.plan.id,
                          code: user.plan.code,
                          name: user.plan.name,
                          allowedModules: user.plan.allowedModules,
                      }
                    : null,
            },
            workspaces,
            activeWorkspace,
            pendingInvitesCount,
        };
    }
}

