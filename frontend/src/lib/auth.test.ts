import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessRoute,
  hasAnyPermission,
  hasPermission,
  isApiBackendUrl,
  resolveActiveWorkspace,
  type AuthUser,
  type WorkspaceSummary,
} from './auth.ts';

const ownerWs: WorkspaceSummary = {
  id: 'ws-owner',
  name: 'Casa',
  roleCode: 'OWNER',
  roleName: 'Proprietário',
  permissions: ['view:resumo', 'view:fluxo_caixa', 'create:despesa', 'manage:workspace'],
  status: 'ACTIVE',
};

const viewerWs: WorkspaceSummary = {
  id: 'ws-viewer',
  name: 'Família',
  roleCode: 'VIEWER',
  roleName: 'Visualizador',
  permissions: ['view:resumo'],
  status: 'ACTIVE',
};

const regularUser: AuthUser = {
  id: 'u1',
  name: 'Matheus',
  email: 'matheus@test.com',
  isSuperAdmin: false,
  defaultWorkspaceId: 'ws-viewer',
};

const superAdmin: AuthUser = {
  id: 'u-admin',
  name: 'Admin',
  email: 'admin@myfinance.local',
  isSuperAdmin: true,
};

describe('auth helpers', () => {
  it('checks single and any permissions', () => {
    assert.equal(hasPermission(viewerWs.permissions, 'view:resumo'), true);
    assert.equal(hasPermission(viewerWs.permissions, 'create:despesa'), false);
    assert.equal(hasAnyPermission(viewerWs.permissions, ['view:fluxo_caixa', 'view:resumo']), true);
    assert.equal(hasAnyPermission(viewerWs.permissions, ['create:despesa', 'edit:cartao']), false);
  });

  it('resolves active workspace in priority order: preferred -> default -> first', () => {
    const list = [ownerWs, viewerWs];
    assert.equal(resolveActiveWorkspace(list, 'ws-owner', 'ws-viewer')?.id, 'ws-owner');
    assert.equal(resolveActiveWorkspace(list, 'ws-unknown', 'ws-viewer')?.id, 'ws-viewer');
    assert.equal(resolveActiveWorkspace(list, null, null)?.id, 'ws-owner');
    assert.equal(resolveActiveWorkspace([], 'ws-owner')?.id ?? null, null);
  });

  it('enforces route access by role and super admin flag', () => {
    assert.equal(canAccessRoute('/login', null, null), true);
    assert.equal(canAccessRoute('/', null, null), false);

    // VIEWER can see Resumo and Configuracoes, but not Fluxo de Caixa, Cartoes, or Admin
    assert.equal(canAccessRoute('/', regularUser, viewerWs), true);
    assert.equal(canAccessRoute('/configuracoes', regularUser, viewerWs), true);
    assert.equal(canAccessRoute('/fluxo-de-caixa', regularUser, viewerWs), false);
    assert.equal(canAccessRoute('/cartoes', regularUser, viewerWs), false);
    assert.equal(canAccessRoute('/admin', regularUser, ownerWs), false);

    // Super admin can access /admin
    assert.equal(canAccessRoute('/admin', superAdmin, ownerWs), true);
  });

  it('detects backend API URLs for fetch header injection', () => {
    assert.equal(isApiBackendUrl('http://localhost:3333/accounts'), true);
    assert.equal(isApiBackendUrl('/api/local'), false);
  });
});
