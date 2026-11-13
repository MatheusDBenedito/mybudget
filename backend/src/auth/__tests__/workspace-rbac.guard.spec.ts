import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceRbacGuard } from '../guards/workspace-rbac.guard';
import {
    ANY_PERMISSIONS_KEY,
    IS_PUBLIC_KEY,
    PERMISSIONS_KEY,
    SUPER_ADMIN_KEY,
} from '../decorators/permissions.decorator';

function createMockContext(req: Record<string, any>): ExecutionContext {
    return {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
            getRequest: () => req,
        }),
    } as unknown as ExecutionContext;
}

function createMockReflector(overrides: Record<string, any> = {}): Reflector {
    return {
        getAllAndOverride: (key: string) => overrides[key],
    } as unknown as Reflector;
}

describe('WorkspaceRbacGuard', () => {
    it('allows @Public() routes without user or workspace', async () => {
        const reflector = createMockReflector({ [IS_PUBLIC_KEY]: true });
        const prisma = {} as any;
        const guard = new WorkspaceRbacGuard(reflector, prisma);

        const result = await guard.canActivate(createMockContext({ headers: {} }));
        expect(result).toBe(true);
    });

    it('rejects unauthenticated requests on protected routes', async () => {
        const reflector = createMockReflector({});
        const prisma = {} as any;
        const guard = new WorkspaceRbacGuard(reflector, prisma);

        await expect(guard.canActivate(createMockContext({ headers: {} }))).rejects.toThrow(
            UnauthorizedException,
        );
    });

    it('enforces @RequireSuperAdmin() strictly', async () => {
        const reflector = createMockReflector({ [SUPER_ADMIN_KEY]: true });
        const prisma = {} as any;
        const guard = new WorkspaceRbacGuard(reflector, prisma);

        await expect(
            guard.canActivate(
                createMockContext({
                    headers: {},
                    user: { userId: 'u1', email: 'a@b.com', isSuperAdmin: false },
                }),
            ),
        ).rejects.toThrow(ForbiddenException);

        const allowed = await guard.canActivate(
            createMockContext({
                headers: {},
                user: { userId: 'admin', email: 'admin@myfinance.local', isSuperAdmin: true },
            }),
        );
        expect(allowed).toBe(true);
    });

    it('blocks cross-workspace access when user is not an active member of x-workspace-id', async () => {
        const reflector = createMockReflector({ [PERMISSIONS_KEY]: ['view:resumo'] });
        const prisma = {
            workspaceUser: {
                findUnique: jest.fn().mockResolvedValue(null),
            },
        } as any;
        const guard = new WorkspaceRbacGuard(reflector, prisma);

        await expect(
            guard.canActivate(
                createMockContext({
                    headers: { 'x-workspace-id': 'ws-other' },
                    user: { userId: 'u1', email: 'u1@test.com', isSuperAdmin: false },
                }),
            ),
        ).rejects.toThrow(ForbiddenException);
    });

    it('checks @RequirePermissions() and attaches workspaceContext when authorized', async () => {
        const reflector = createMockReflector({ [PERMISSIONS_KEY]: ['create:despesa'] });
        const prisma = {
            workspaceUser: {
                findUnique: jest.fn().mockResolvedValue({
                    status: 'ACTIVE',
                    workspace: { name: 'Família' },
                    role: {
                        code: 'EDITOR',
                        name: 'EDITOR',
                        permissions: [
                            { permission: { code: 'view:resumo' } },
                            { permission: { code: 'create:despesa' } },
                        ],
                    },
                }),
            },
        } as any;
        const guard = new WorkspaceRbacGuard(reflector, prisma);
        const req: Record<string, any> = {
            headers: { 'x-workspace-id': 'ws-1' },
            user: { userId: 'u1', email: 'u1@test.com', isSuperAdmin: false },
        };

        const allowed = await guard.canActivate(createMockContext(req));
        expect(allowed).toBe(true);
        expect(req.workspaceContext).toEqual({
            workspaceId: 'ws-1',
            workspaceName: 'Família',
            roleCode: 'EDITOR',
            roleName: 'EDITOR',
            permissions: new Set(['view:resumo', 'create:despesa']),
            userId: 'u1',
            email: 'u1@test.com',
            isSuperAdmin: false,
        });
    });

    it('returns 403 when user lacks required permission (e.g., VIEWER creating expense)', async () => {
        const reflector = createMockReflector({ [PERMISSIONS_KEY]: ['create:despesa'] });
        const prisma = {
            workspaceUser: {
                findUnique: jest.fn().mockResolvedValue({
                    status: 'ACTIVE',
                    workspace: { name: 'Família' },
                    role: {
                        name: 'VIEWER',
                        permissions: [{ permission: { code: 'view:resumo' } }],
                    },
                }),
            },
        } as any;
        const guard = new WorkspaceRbacGuard(reflector, prisma);

        await expect(
            guard.canActivate(
                createMockContext({
                    headers: { 'x-workspace-id': 'ws-1' },
                    user: { userId: 'u-viewer', email: 'viewer@test.com', isSuperAdmin: false },
                }),
            ),
        ).rejects.toThrow(ForbiddenException);
    });

    it('allows @RequireAnyPermissions() when at least one permission matches', async () => {
        const reflector = createMockReflector({
            [ANY_PERMISSIONS_KEY]: ['view:despesa', 'view:resumo'],
        });
        const prisma = {
            workspaceUser: {
                findUnique: jest.fn().mockResolvedValue({
                    status: 'ACTIVE',
                    workspace: { name: 'Família' },
                    role: {
                        name: 'VIEWER',
                        permissions: [{ permission: { code: 'view:resumo' } }],
                    },
                }),
            },
        } as any;
        const guard = new WorkspaceRbacGuard(reflector, prisma);

        const allowed = await guard.canActivate(
            createMockContext({
                headers: { 'x-workspace-id': 'ws-1' },
                user: { userId: 'u-viewer', email: 'viewer@test.com', isSuperAdmin: false },
            }),
        );
        expect(allowed).toBe(true);
    });

    it('blocks a module even for OWNER when the user plan excludes that module', async () => {
        const reflector = createMockReflector({ [PERMISSIONS_KEY]: ['view:milhas'] });
        const prisma = {
            workspaceUser: {
                findUnique: jest.fn().mockResolvedValue({
                    status: 'ACTIVE',
                    workspace: { name: 'Família' },
                    user: {
                        plan: {
                            allowedModules: ['resumo', 'despesa', 'receita', 'cartao'],
                        },
                    },
                    role: {
                        code: 'OWNER',
                        name: 'Proprietário',
                        permissions: [
                            { permission: { code: 'view:resumo', module: 'resumo' } },
                            { permission: { code: 'view:milhas', module: 'milhas' } },
                        ],
                    },
                }),
            },
        } as any;
        const guard = new WorkspaceRbacGuard(reflector, prisma);

        await expect(
            guard.canActivate(
                createMockContext({
                    headers: { 'x-workspace-id': 'ws-1' },
                    user: { userId: 'u-owner', email: 'owner@test.com', isSuperAdmin: false },
                }),
            ),
        ).rejects.toThrow(ForbiddenException);
    });
});
