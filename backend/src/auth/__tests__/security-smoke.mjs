import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const BASE_URL = process.env.API_URL || 'http://localhost:3333';
const ADMIN_LOGIN = process.env.BOOTSTRAP_ADMIN_EMAIL || 'AdminCockpitLife';
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Life@Duartegalo';

async function req(path, { method = 'GET', token, workspaceId, body, origin } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (workspaceId) headers['x-workspace-id'] = workspaceId;
    if (origin) headers['Origin'] = origin;

    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = text;
    }
    return { status: res.status, headers: res.headers, data: json };
}

async function run() {
    const prisma = new PrismaClient();
    const testEmail = `sec-smoke-${Date.now()}@test.local`;
    let createdUserId = null;
    let createdWorkspaceId = null;
    let passed = 0;

    const check = async (label, fn) => {
        await fn();
        passed += 1;
        console.log(`PASS [${passed}] ${label}`);
    };

    try {
        await check('Unauthenticated /accounts returns 401', async () => {
            const res = await req('/accounts');
            assert.equal(res.status, 401);
        });

        await check('Unauthenticated /admin/overview returns 401', async () => {
            const res = await req('/admin/overview');
            assert.equal(res.status, 401);
        });

        await check('Legacy default admin credentials (admin123) return 401', async () => {
            const res = await req('/auth/login', {
                method: 'POST',
                body: { email: 'admin@myfinance.local', password: 'admin123' },
            });
            assert.equal(res.status, 401);
        });

        let adminToken = '';
        let adminWorkspaceId = '';

        await check('Super Admin login succeeds and accesses /admin/overview', async () => {
            const login = await req('/auth/login', {
                method: 'POST',
                body: { email: ADMIN_LOGIN, password: ADMIN_PASSWORD },
            });
            assert.ok(login.status === 200 || login.status === 201, `Expected 200/201, got ${login.status}`);
            assert.equal(login.data?.user?.isSuperAdmin, true);
            adminToken = login.data.accessToken;
            adminWorkspaceId = login.data.activeWorkspace.id;

            const ov = await req('/admin/overview', { token: adminToken });
            assert.equal(ov.status, 200);
        });

        await check('Tampered JWT is rejected with 401', async () => {
            const tampered = `${adminToken.slice(0, -4)}zzzz`;
            const res = await req('/accounts', { token: tampered, workspaceId: adminWorkspaceId });
            assert.equal(res.status, 401);
        });

        let userToken = '';
        let userWorkspaceId = '';

        await check('Register new non-admin user on default PRO plan', async () => {
            const reg = await req('/auth/register', {
                method: 'POST',
                body: {
                    name: 'Security Smoke User',
                    email: testEmail,
                    password: 'StrongPassword#2026',
                    workspaceName: 'Security Smoke WS',
                },
            });
            assert.equal(reg.status, 201);
            createdUserId = reg.data.user.id;
            userToken = reg.data.accessToken;
            userWorkspaceId = reg.data.activeWorkspace.id;
            createdWorkspaceId = userWorkspaceId;
            assert.equal(reg.data.user.isSuperAdmin, false);
        });

        await check('Regular user cannot access /admin/overview or /seed (403)', async () => {
            const ov = await req('/admin/overview', { token: userToken });
            assert.equal(ov.status, 403);
            const seed = await req('/seed', { method: 'POST', token: userToken });
            assert.equal(seed.status, 403);
        });

        await check('IDOR blocked: regular user cannot access another workspace via x-workspace-id (403)', async () => {
            const acc = await req('/accounts', { token: userToken, workspaceId: adminWorkspaceId });
            assert.equal(acc.status, 403);
            const cf = await req('/cash-flow?month=11&year=2026', {
                token: userToken,
                workspaceId: adminWorkspaceId,
            });
            assert.equal(cf.status, 403);
        });

        await check('Plan restriction: OWNER on PRO plan cannot access /miles (403) while /accounts succeeds (200)', async () => {
            const ownAcc = await req('/accounts', { token: userToken, workspaceId: userWorkspaceId });
            assert.equal(ownAcc.status, 200);

            const miles = await req('/miles', { token: userToken, workspaceId: userWorkspaceId });
            assert.equal(miles.status, 403);
        });

        await check('Cannot invite another OWNER (400)', async () => {
            const roles = await req('/workspaces/roles', { token: userToken });
            assert.equal(roles.status, 200);
            const ownerRole = roles.data.find((r) => r.code === 'OWNER');
            assert.ok(ownerRole, 'OWNER role should exist');

            const inv = await req('/workspaces/current/invites', {
                method: 'POST',
                token: userToken,
                workspaceId: userWorkspaceId,
                body: { email: 'another@test.local', roleId: ownerRole.id },
            });
            assert.equal(inv.status, 400);
        });

        await check('Invalid Google credential is rejected safely (400/401)', async () => {
            const res = await req('/auth/google', {
                method: 'POST',
                body: { credential: 'invalid.google.token' },
            });
            assert.ok(res.status === 400 || res.status === 401, `Expected 400/401, got ${res.status}`);
        });

        await check('CORS rejects untrusted origin', async () => {
            const res = await req('/accounts', {
                method: 'OPTIONS',
                origin: 'https://evil-attacker.example.com',
            });
            const allowOrigin = res.headers.get('access-control-allow-origin');
            assert.notEqual(allowOrigin, '*');
            assert.notEqual(allowOrigin, 'https://evil-attacker.example.com');
        });

        console.log(`\nAll ${passed} live security checks PASSED.`);
    } finally {
        if (createdWorkspaceId) {
            await prisma.workspace.deleteMany({ where: { id: createdWorkspaceId } });
        }
        if (createdUserId) {
            await prisma.user.deleteMany({ where: { id: createdUserId } });
        }
        await prisma.$disconnect();
    }
}

run().catch((err) => {
    console.error('Security smoke test FAILED:', err);
    process.exit(1);
});

