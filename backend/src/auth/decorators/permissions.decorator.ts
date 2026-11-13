import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const SUPER_ADMIN_KEY = 'requireSuperAdmin';
export const PERMISSIONS_KEY = 'requiredPermissions';
export const ANY_PERMISSIONS_KEY = 'requiredAnyPermissions';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const RequireSuperAdmin = () => SetMetadata(SUPER_ADMIN_KEY, true);
export const RequirePermissions = (...permissions: string[]) =>
    SetMetadata(PERMISSIONS_KEY, permissions);
export const RequireAnyPermissions = (...permissions: string[]) =>
    SetMetadata(ANY_PERMISSIONS_KEY, permissions);

export type AuthUserPayload = {
    userId: string;
    email: string;
    name: string;
    isSuperAdmin: boolean;
};

export type WorkspaceRequestContext = AuthUserPayload & {
    workspaceId: string;
    workspaceName: string;
    roleCode: string;
    roleName: string;
    permissions: Set<string>;
};

export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): AuthUserPayload => {
        const req = ctx.switchToHttp().getRequest();
        return req.user;
    },
);

export const CurrentWorkspace = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): WorkspaceRequestContext => {
        const req = ctx.switchToHttp().getRequest();
        return req.workspaceContext;
    },
);
