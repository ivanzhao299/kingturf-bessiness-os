// A2（TD-SEC-012）：权限目录为代码所有。目录写入默认 403，仅 SYSTEM_ADMIN 维护角色
// （直查角色编码，不新增 capability）可作种子外补录；GET 全局只读契约保持不变。
// M1a：SYSTEM_ADMIN/SUPER_ADMIN 为保留角色编码，API 创建路径一律拒绝（防自建同名
// 角色绕过目录门禁）；SQL/bootstrap 通道不受影响。
import { describe, expect, it, vi } from 'vitest';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';

const correlationId = '11111111-1111-4111-8111-111111111111';
const tenantAdmin = {
  actor: { employeeId: 'employee', companyId: 'company' },
  permissions: new Map([
    ['permission:read', { scopes: ['COMPANY'], fields: null }],
    ['permission:manage', { scopes: ['COMPANY'], fields: null }],
    ['authorization:read', { scopes: ['COMPANY'], fields: null }],
    ['authorization:manage', { scopes: ['COMPANY'], fields: null }],
    ['role:read', { scopes: ['COMPANY'], fields: null }],
    ['role:manage', { scopes: ['COMPANY'], fields: null }],
  ]),
};

function fixture(options: { systemAdministrator?: boolean } = {}) {
  const createPermission = vi.fn().mockResolvedValue({
    id: 'permission-id',
    capability: 'fixture:capability',
    description: 'Fixture capability',
  });
  const createRole = vi.fn().mockResolvedValue({
    id: 'role-id',
    organizationId: 'company',
    code: 'KT_FIXTURE',
    name: 'Fixture',
    version: 1,
  });
  const listPermissions = vi
    .fn()
    .mockResolvedValue([
      { id: 'permission-id', capability: 'fixture:capability', description: 'Fixture capability' },
    ]);
  const isSystemAdministrator = vi.fn().mockResolvedValue(options.systemAdministrator ?? false);
  const authenticate = vi.fn().mockResolvedValue(tenantAdmin);
  const repository = {
    createPermission,
    createRole,
    listPermissions,
    isSystemAdministrator,
  };
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    employees: {} as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
    authorization: repository as unknown as NonNullable<ApiDependencies['authorization']>,
  });
  const dispatch = (request: ApiRequest) =>
    app.dispatch({
      ...request,
      headers: {
        authorization: 'Bearer fixture-token',
        'x-correlation-id': correlationId,
        ...(request.method === 'POST' ? { 'content-type': 'application/json' } : {}),
        ...request.headers,
      },
    });
  return { dispatch, createPermission, createRole, listPermissions, isSystemAdministrator };
}

describe('permission catalog is code-owned (A2)', () => {
  it('rejects catalog creation by a tenant administrator holding permission:manage', async () => {
    const f = fixture();
    const response = await f.dispatch({
      method: 'POST',
      pathname: '/api/v1/permissions',
      body: { capability: 'fixture:capability', description: 'Fixture capability' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: 'forbidden',
        message: 'Permission catalog writes require the SYSTEM_ADMIN role',
        correlationId,
      },
    });
    expect(f.createPermission).not.toHaveBeenCalled();
    expect(f.isSystemAdministrator).toHaveBeenCalledWith(tenantAdmin.actor);
  });

  it('allows catalog append beyond the seed for the SYSTEM_ADMIN maintenance role', async () => {
    const f = fixture({ systemAdministrator: true });
    const response = await f.dispatch({
      method: 'POST',
      pathname: '/api/v1/permissions',
      body: { capability: 'fixture:capability', description: 'Fixture capability' },
    });
    expect(response.statusCode).toBe(201);
    expect(f.createPermission).toHaveBeenCalledWith(
      { capability: 'fixture:capability', description: 'Fixture capability' },
      tenantAdmin.actor,
      correlationId,
    );
  });

  it('keeps the catalog globally readable through permission:read', async () => {
    const f = fixture();
    const response = await f.dispatch({ method: 'GET', pathname: '/api/v1/permissions' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([
      { id: 'permission-id', capability: 'fixture:capability', description: 'Fixture capability' },
    ]);
    expect(f.listPermissions).toHaveBeenCalledTimes(1);
    expect(f.isSystemAdministrator).not.toHaveBeenCalled();
  });

  it('still rejects catalog creation without any session grant', async () => {
    const f = fixture();
    const response = await f.dispatch({
      method: 'POST',
      pathname: '/api/v1/permissions',
      body: { capability: 'fixture:capability', description: 'Fixture capability' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('rejects tenant creation of reserved administrator role codes (M1a)', async () => {
    const f = fixture();
    for (const code of ['SYSTEM_ADMIN', 'SUPER_ADMIN', ' system_admin ']) {
      const response = await f.dispatch({
        method: 'POST',
        pathname: '/api/v1/roles',
        body: { code, name: 'Self made' },
      });
      expect(response.statusCode).toBe(403);
      expect(response.body).toEqual({
        error: {
          code: 'forbidden',
          message: 'Reserved administrator role codes cannot be created through the API',
          correlationId,
        },
      });
    }
    expect(f.createRole).not.toHaveBeenCalled();
  });

  it('keeps creating ordinary tenant roles after reserving administrator codes (M1a)', async () => {
    const f = fixture();
    const response = await f.dispatch({
      method: 'POST',
      pathname: '/api/v1/roles',
      body: { code: 'KT_TENANT_VIEWER', name: 'Tenant viewer' },
    });
    expect(response.statusCode).toBe(201);
    expect(f.createRole).toHaveBeenCalledWith(
      { code: 'KT_TENANT_VIEWER', name: 'Tenant viewer' },
      tenantAdmin.actor,
      correlationId,
    );
  });
});
