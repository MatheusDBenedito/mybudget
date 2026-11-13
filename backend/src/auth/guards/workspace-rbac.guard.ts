import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { filterPermissionsByPlan } from '../rbac-catalog';
import {
    ANY_PERMISSIONS_KEY,
    AuthUserPayload,
    IS_PUBLIC_KEY,
    PERMISSIONS_KEY,
    SUPER_ADMIN_KEY,
    WorkspaceRequestContext,
} from '../decorators/permissions.decorator';

@Injectable()
export class WorkspaceRbacGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly prisma: PrismaService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) return true;

        const req = context.switchToHttp().getRequest();
        const user = req.user as AuthUserPayload | undefined;
        if (!user) {
            throw new UnauthorizedException('Usuário não autenticado.');
        }

        const requireSuperAdmin = this.reflector.getAllAndOverride<boolean>(SUPER_ADMIN_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (requireSuperAdmin) {
            if (!user.isSuperAdmin) {
                throw new ForbiddenException('Acesso restrito ao Super Admin da plataforma.');
            }
            return true;
        }

        const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        const requiredAnyPermissions = this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // Routes without @RequirePermissions or @RequireAnyPermissions (e.g. /auth/me, /workspaces) only require authentication
        if (!requiredPermissions && !requiredAnyPermissions) {
            return true;
        }

        const headerWorkspaceId = (req.headers['x-workspace-id'] as string | undefined)?.trim();
        let workspaceId = headerWorkspaceId || undefined;

        if (!workspaceId) {
            const dbUser = await this.prisma.user.findUnique({
                where: { id: user.userId },
                select: { defaultWorkspaceId: true },
            });
            workspaceId = dbUser?.defaultWorkspaceId ?? undefined;
        }

        if (!workspaceId) {
            const firstMembership = await this.prisma.workspaceUser.findFirst({
                where: { userId: user.userId, status: 'ACTIVE' },
                orderBy: { joinedAt: 'asc' },
                select: { workspaceId: true },
            });
            workspaceId = firstMembership?.workspaceId;
        }

        if (!workspaceId) {
            throw new ForbiddenException('Nenhum workspace ativo disponível para este usuário.');
        }

        const membership = await this.prisma.workspaceUser.findUnique({
            where: {
                workspaceId_userId: { workspaceId, userId: user.userId },
            },
            include: {
                workspace: { select: { name: true } },
                user: {
                    select: {
                        plan: { select: { allowedModules: true } },
                    },
                },
                role: {
                    include: {
                        permissions: {
                            include: { permission: { select: { code: true, module: true } } },
                        },
                    },
                },
            },
        });

        if (!membership || membership.status !== 'ACTIVE') {
            throw new ForbiddenException('Você não possui acesso ativo a este workspace.');
        }

        const planModules = user.isSuperAdmin ? null : membership.user?.plan?.allowedModules ?? null;
        const permissions = new Set(
            filterPermissionsByPlan(
                membership.role.permissions.map((rp) => rp.permission),
                planModules,
            ),
        );

        if (requiredPermissions) {
            const missing = requiredPermissions.filter((perm) => !permissions.has(perm));
            if (missing.length > 0) {
                throw new ForbiddenException(
                    `Permissão insuficiente para esta ação. Requer: ${missing.join(', ')}`,
                );
            }
        }

        if (requiredAnyPermissions && requiredAnyPermissions.length > 0) {
            const hasAny = requiredAnyPermissions.some((perm) => permissions.has(perm));
            if (!hasAny) {
                throw new ForbiddenException(
                    `Permissão insuficiente para esta ação. Requer uma de: ${requiredAnyPermissions.join(', ')}`,
                );
            }
        }

        req.workspaceContext = {
            ...user,
            workspaceId,
            workspaceName: membership.workspace.name,
            roleCode: membership.role.code,
            roleName: membership.role.name,
            permissions,
        } satisfies WorkspaceRequestContext;

        return true;
    }
}
