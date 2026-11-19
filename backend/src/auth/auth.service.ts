import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    OnModuleInit,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
    ChangePasswordDto,
    ForgotPasswordDto,
    LoginDto,
    RegisterDto,
    ResetPasswordDto,
} from './dto/auth.dto';
import { MailService } from './mail.service';
import { hashPassword, verifyPassword } from './password.util';
import {
    computeResetExpiry,
    generateResetToken,
    hashResetToken,
    isResetTokenValid,
    PASSWORD_RESET_TTL_MINUTES,
} from './password-reset.helper';
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
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly mailService: MailService,
    ) {}

    async onModuleInit() {
        await ensureBootstrapWorkspace(this.prisma);
    }

    async login(dto: LoginDto) {
        const identifier = dto.email.trim().toLowerCase();
        const emailCandidates = identifier.includes('@')
            ? [identifier]
            : [identifier, `${identifier}@teste.com`];
        const user = await this.prisma.user.findFirst({
            where: {
                email: { in: emailCandidates },
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
            tv: user.tokenVersion,
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
            tv: result.user.tokenVersion,
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

    async forgotPassword(dto: ForgotPasswordDto) {
        const genericResponse = {
            message: 'Se o e-mail estiver cadastrado, enviaremos as instruções para redefinir sua senha.',
        };
        const email = dto.email.trim().toLowerCase();
        const user = await this.prisma.user.findUnique({
            where: { email },
            select: { id: true, name: true, email: true, isActive: true },
        });
        if (!user || !user.isActive) {
            return genericResponse;
        }

        const now = new Date();
        const { rawToken, tokenHash } = generateResetToken();
        const expiresAt = computeResetExpiry(now, PASSWORD_RESET_TTL_MINUTES);

        await this.prisma.$transaction([
            this.prisma.passwordResetToken.updateMany({
                where: { userId: user.id, usedAt: null },
                data: { usedAt: now },
            }),
            this.prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    tokenHash,
                    expiresAt,
                },
            }),
        ]);

        const frontendOrigin = this.resolveFrontendOrigin();
        const resetUrl = `${frontendOrigin}/reset-password?token=${encodeURIComponent(rawToken)}`;

        try {
            await this.mailService.sendPasswordResetEmail({
                to: user.email,
                name: user.name,
                resetUrl,
                ttlMinutes: PASSWORD_RESET_TTL_MINUTES,
            });
        } catch (err) {
            this.logger.error(`Falha ao enviar e-mail de recuperação para ${user.email}`, err as Error);
        }

        return genericResponse;
    }

    async resetPassword(dto: ResetPasswordDto) {
        const now = new Date();
        const tokenHash = hashResetToken(dto.token);
        const record = await this.prisma.passwordResetToken.findUnique({
            where: { tokenHash },
            include: {
                user: { select: { id: true, isActive: true } },
            },
        });

        if (!record || !record.user.isActive || !isResetTokenValid(record, now)) {
            throw new BadRequestException('Link de recuperação inválido ou expirado.');
        }

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: record.userId },
                data: {
                    passwordHash: hashPassword(dto.newPassword),
                    tokenVersion: { increment: 1 },
                },
            }),
            this.prisma.passwordResetToken.updateMany({
                where: { userId: record.userId, usedAt: null },
                data: { usedAt: now },
            }),
        ]);

        return { message: 'Senha redefinida com sucesso. Faça login com sua nova senha.' };
    }

    async changePassword(userId: string, dto: ChangePasswordDto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, isActive: true, passwordHash: true },
        });
        if (!user || !user.isActive) {
            throw new UnauthorizedException('Usuário inativo ou não encontrado.');
        }
        if (!user.passwordHash || !verifyPassword(dto.currentPassword, user.passwordHash)) {
            throw new UnauthorizedException('Senha atual incorreta.');
        }

        const updated = await this.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: hashPassword(dto.newPassword),
                tokenVersion: { increment: 1 },
            },
            select: { id: true, email: true, tokenVersion: true },
        });

        const accessToken = await this.jwtService.signAsync({
            sub: updated.id,
            email: updated.email,
            tv: updated.tokenVersion,
        });

        return {
            message: 'Senha alterada com sucesso.',
            accessToken,
        };
    }

    private resolveFrontendOrigin(): string {
        const explicit = process.env.FRONTEND_URL?.split(',')[0]?.trim();
        if (explicit) return explicit.replace(/\/+$/, '');
        const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
        if (vercelProd) {
            return (vercelProd.startsWith('http') ? vercelProd : `https://${vercelProd}`).replace(/\/+$/, '');
        }
        return 'http://localhost:3000';
    }
}

