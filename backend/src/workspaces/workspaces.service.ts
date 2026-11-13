import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ensureRbacCatalog } from '../auth/rbac-catalog';
import { seedDefaultWorkspaceData } from './default-workspace-seed';
import { CreateInviteDto, CreateWorkspaceDto } from './dto/workspace.dto';

const slugify = (text: string) =>
    text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'workspace';

@Injectable()
export class WorkspacesService {
    constructor(private readonly prisma: PrismaService) {}

    async listUserWorkspaces(userId: string) {
        const memberships = await this.prisma.workspaceUser.findMany({
            where: { userId, status: 'ACTIVE' },
            orderBy: { joinedAt: 'asc' },
            include: {
                workspace: true,
                role: { select: { id: true, code: true, name: true } },
            },
        });
        return memberships.map((m) => ({
            id: m.workspace.id,
            name: m.workspace.name,
            slug: m.workspace.slug,
            roleCode: m.role.code,
            roleName: m.role.name,
            joinedAt: m.joinedAt,
        }));
    }

    async createWorkspace(userId: string, dto: CreateWorkspaceDto) {
        const { roleMap } = await ensureRbacCatalog(this.prisma);
        const ownerRoleId = roleMap.get('OWNER')!;
        const slug = `${slugify(dto.name)}-${randomUUID().slice(0, 6)}`;

        return this.prisma.$transaction(async (tx) => {
            const workspace = await tx.workspace.create({
                data: {
                    name: dto.name.trim(),
                    slug,
                    createdById: userId,
                },
            });
            await tx.workspaceUser.create({
                data: {
                    workspaceId: workspace.id,
                    userId,
                    roleId: ownerRoleId,
                    status: 'ACTIVE',
                },
            });
            await tx.user.update({
                where: { id: userId },
                data: { defaultWorkspaceId: workspace.id },
            });
            await seedDefaultWorkspaceData(tx, workspace.id);
            return workspace;
        });
    }

    async setDefaultWorkspace(userId: string, workspaceId: string) {
        const membership = await this.prisma.workspaceUser.findUnique({
            where: { workspaceId_userId: { workspaceId, userId } },
        });
        if (!membership || membership.status !== 'ACTIVE') {
            throw new ForbiddenException('Você não pertence a este workspace.');
        }
        return this.prisma.user.update({
            where: { id: userId },
            data: { defaultWorkspaceId: workspaceId },
            select: { id: true, defaultWorkspaceId: true },
        });
    }

    listAvailableRoles() {
        return this.prisma.role.findMany({
            where: { workspaceId: null },
            orderBy: { code: 'asc' },
            select: { id: true, code: true, name: true, description: true },
        });
    }

    listMembers(workspaceId: string) {
        return this.prisma.workspaceUser.findMany({
            where: { workspaceId },
            orderBy: { joinedAt: 'asc' },
            include: {
                user: { select: { id: true, name: true, email: true } },
                role: { select: { id: true, code: true, name: true } },
            },
        });
    }

    listWorkspaceInvites(workspaceId: string) {
        return this.prisma.workspaceInvite.findMany({
            where: { workspaceId, status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            include: {
                role: { select: { id: true, code: true, name: true } },
                invitedBy: { select: { id: true, name: true, email: true } },
            },
        });
    }

    async createInvite(workspaceId: string, invitedById: string, dto: CreateInviteDto) {
        const email = dto.email.trim().toLowerCase();
        const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
        if (!role) throw new NotFoundException('Perfil (Role) não encontrado.');
        if (role.code === 'OWNER') {
            throw new BadRequestException('Cada workspace pode ter apenas 1 Proprietário (OWNER).');
        }

        const existingUser = await this.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            const alreadyMember = await this.prisma.workspaceUser.findUnique({
                where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
            });
            if (alreadyMember && alreadyMember.status === 'ACTIVE') {
                throw new ConflictException('Este usuário já é membro ativo do workspace.');
            }
        }

        const existingInvite = await this.prisma.workspaceInvite.findFirst({
            where: { workspaceId, email, status: 'PENDING', expiresAt: { gt: new Date() } },
        });
        if (existingInvite) {
            throw new ConflictException('Já existe um convite pendente para este e-mail.');
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        return this.prisma.workspaceInvite.create({
            data: {
                workspaceId,
                email,
                roleId: dto.roleId,
                token: randomUUID(),
                status: 'PENDING',
                invitedById,
                expiresAt,
            },
            include: {
                role: { select: { id: true, code: true, name: true } },
            },
        });
    }

    async revokeInvite(workspaceId: string, inviteId: string) {
        const invite = await this.prisma.workspaceInvite.findFirst({
            where: { id: inviteId, workspaceId },
        });
        if (!invite) throw new NotFoundException('Convite não encontrado.');
        return this.prisma.workspaceInvite.update({
            where: { id: invite.id },
            data: { status: 'REVOKED' },
        });
    }

    listPendingInvitesForEmail(email: string) {
        return this.prisma.workspaceInvite.findMany({
            where: {
                email: email.trim().toLowerCase(),
                status: 'PENDING',
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
            include: {
                workspace: { select: { id: true, name: true } },
                role: { select: { id: true, code: true, name: true } },
                invitedBy: { select: { id: true, name: true, email: true } },
            },
        });
    }

    async acceptInvite(userId: string, userEmail: string, token: string) {
        const invite = await this.prisma.workspaceInvite.findUnique({
            where: { token },
            include: { workspace: true },
        });

        if (!invite || invite.status !== 'PENDING') {
            throw new NotFoundException('Convite inválido ou já utilizado.');
        }
        if (invite.expiresAt < new Date()) {
            await this.prisma.workspaceInvite.update({
                where: { id: invite.id },
                data: { status: 'EXPIRED' },
            });
            throw new BadRequestException('Este convite expirou.');
        }
        if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
            throw new ForbiddenException('Este convite foi enviado para outro endereço de e-mail.');
        }

        return this.prisma.$transaction(async (tx) => {
            const member = await tx.workspaceUser.upsert({
                where: {
                    workspaceId_userId: { workspaceId: invite.workspaceId, userId },
                },
                update: { roleId: invite.roleId, status: 'ACTIVE' },
                create: {
                    workspaceId: invite.workspaceId,
                    userId,
                    roleId: invite.roleId,
                    status: 'ACTIVE',
                },
            });

            await tx.workspaceInvite.update({
                where: { id: invite.id },
                data: { status: 'ACCEPTED', acceptedAt: new Date() },
            });

            await tx.user.update({
                where: { id: userId },
                data: { defaultWorkspaceId: invite.workspaceId },
            });

            return { workspace: invite.workspace, member };
        });
    }

    async updateMemberRole(workspaceId: string, actorUserId: string, memberId: string, roleId: string) {
        const member = await this.prisma.workspaceUser.findFirst({
            where: { id: memberId, workspaceId },
            include: { role: true },
        });
        if (!member) throw new NotFoundException('Membro não encontrado neste workspace.');

        const role = await this.prisma.role.findUnique({ where: { id: roleId } });
        if (!role) throw new NotFoundException('Perfil não encontrado.');

        if (role.code === 'OWNER' && member.role.code !== 'OWNER') {
            const existingOwner = await this.prisma.workspaceUser.count({
                where: {
                    workspaceId,
                    id: { not: member.id },
                    status: 'ACTIVE',
                    role: { code: 'OWNER' },
                },
            });
            if (existingOwner > 0) {
                throw new BadRequestException('Cada workspace pode ter apenas 1 Proprietário (OWNER).');
            }
        }

        if (member.userId === actorUserId && member.role.code === 'OWNER' && role.code !== 'OWNER') {
            const otherOwners = await this.prisma.workspaceUser.count({
                where: {
                    workspaceId,
                    id: { not: member.id },
                    status: 'ACTIVE',
                    role: { code: 'OWNER' },
                },
            });
            if (otherOwners === 0) {
                throw new BadRequestException('O workspace precisa ter pelo menos um Proprietário (OWNER).');
            }
        }

        return this.prisma.workspaceUser.update({
            where: { id: member.id },
            data: { roleId },
            include: {
                user: { select: { id: true, name: true, email: true } },
                role: { select: { id: true, code: true, name: true } },
            },
        });
    }

    async removeMember(workspaceId: string, actorUserId: string, memberId: string) {
        const member = await this.prisma.workspaceUser.findFirst({
            where: { id: memberId, workspaceId },
            include: { role: true },
        });
        if (!member) throw new NotFoundException('Membro não encontrado neste workspace.');

        if (member.role.code === 'OWNER') {
            const otherOwners = await this.prisma.workspaceUser.count({
                where: {
                    workspaceId,
                    id: { not: member.id },
                    status: 'ACTIVE',
                    role: { code: 'OWNER' },
                },
            });
            if (otherOwners === 0) {
                throw new BadRequestException('Não é possível remover o último Proprietário do workspace.');
            }
        }

        if (member.userId === actorUserId) {
            throw new BadRequestException('Use a opção de sair ou peça a outro proprietário para removê-lo.');
        }

        return this.prisma.workspaceUser.delete({ where: { id: member.id } });
    }
}

