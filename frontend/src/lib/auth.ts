export interface UserPlanSummary {
  id: string;
  code: string;
  name: string;
  allowedModules: string[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  defaultWorkspaceId?: string | null;
  plan?: UserPlanSummary | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug?: string;
  roleCode: string;
  roleName: string;
  permissions: string[];
  status?: string;
  isDefault?: boolean;
}

export interface AuthSessionPayload {
  accessToken: string;
  user: AuthUser;
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | null;
  pendingInvitesCount?: number;
}

export const AUTH_TOKEN_STORAGE_KEY = 'myfinance_auth_token';
export const ACTIVE_WORKSPACE_STORAGE_KEY = 'myfinance_active_workspace_id';
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';

export function hasPermission(
  permissions: readonly string[] | undefined | null,
  required: string,
): boolean {
  if (!permissions || permissions.length === 0) return false;
  return permissions.includes(required);
}

export function hasAnyPermission(
  permissions: readonly string[] | undefined | null,
  requiredList: readonly string[],
): boolean {
  if (!permissions || permissions.length === 0) return false;
  return requiredList.some((perm) => permissions.includes(perm));
}

export function resolveActiveWorkspace(
  workspaces: readonly WorkspaceSummary[],
  preferredId?: string | null,
  defaultWorkspaceId?: string | null,
): WorkspaceSummary | null {
  if (!workspaces || workspaces.length === 0) return null;
  if (preferredId) {
    const match = workspaces.find((ws) => ws.id === preferredId);
    if (match) return match;
  }
  if (defaultWorkspaceId) {
    const def = workspaces.find((ws) => ws.id === defaultWorkspaceId);
    if (def) return def;
  }
  return workspaces.find((ws) => ws.isDefault) ?? workspaces[0];
}

export function canAccessRoute(
  pathname: string,
  user: AuthUser | null,
  activeWorkspace: WorkspaceSummary | null,
): boolean {
  if (pathname === '/login' || pathname === '/register') return true;
  if (!user) return false;
  if (pathname.startsWith('/admin')) return user.isSuperAdmin;
  if (pathname.startsWith('/configuracoes')) return true;

  const perms = activeWorkspace?.permissions ?? [];
  if (pathname === '/') return hasPermission(perms, 'view:resumo');
  if (pathname.startsWith('/fluxo-de-caixa') || pathname.startsWith('/fluxo-caixa')) {
    return hasAnyPermission(perms, ['view:fluxo_caixa', 'view:despesa', 'view:receita']);
  }
  if (pathname.startsWith('/cartoes')) return hasPermission(perms, 'view:cartao');
  if (pathname.startsWith('/investimentos')) return hasPermission(perms, 'view:investimentos');
  if (pathname.startsWith('/milhas')) return hasPermission(perms, 'view:milhas');
  if (pathname.startsWith('/relatorios')) return hasAnyPermission(perms, ['view:fluxo_caixa', 'view:resumo']);
  return true;
}

export function isApiBackendUrl(input: RequestInfo | URL): boolean {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  return url.startsWith(API_BASE_URL);
}
