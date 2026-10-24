// Fixed expectations for the inline IAM block at c7bc896; no migrated oracle.
import { describe, expect, it, vi } from 'vitest';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { employeeId: id, companyId: otherId };
const methods = [
  'listRoles',
  'createRole',
  'listPermissions',
  'createPermission',
  'listGrants',
  'grant',
  'revoke',
  'listAssignments',
  'assign',
  'unassign',
  'listScopeGrants',
  'grantScope',
  'revokeScope',
] as const;
function fixture(capabilities: readonly string[], available = true) {
  const repository = Object.fromEntries(
    methods.map((name) => [name, vi.fn().mockResolvedValue({ fixed: name })]),
  );
  const context = {
    actor,
    permissions: new Map(capabilities.map((name) => [name, { scopes: ['SELF'], fields: null }])),
  };
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(context),
    } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(available
      ? { authorization: repository as unknown as NonNullable<ApiDependencies['authorization']> }
      : {}),
  });
  const dispatch = (resource: string, method: string, body: unknown = null) =>
    app.dispatch({
      method,
      pathname: `/api/v1/${resource}`,
      body,
      headers: { authorization: 'Bearer fixture', 'x-correlation-id': correlationId },
    });
  return { dispatch, repository, context };
}
function assertError(
  result: Awaited<ReturnType<ReturnType<typeof fixture>['dispatch']>>,
  status: number,
  code: string,
  message?: string,
) {
  expect(result.statusCode).toBe(status);
  expect(result.headers).toEqual({
    'x-correlation-id': correlationId,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'strict-origin-when-cross-origin',

    'content-security-policy-report-only':
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
  });
  expect(result.body).toMatchObject({
    error: { code, correlationId, ...(message ? { message } : {}) },
  });
}
const resources = [
  ['roles', 'role'],
  ['permissions', 'permission'],
  ['grants', 'role'],
  ['assignments', 'role-assignment'],
  ['scope-grants', 'data-scope'],
] as const;

describe('IAM inline permission and prerequisite contracts', () => {
  it.each(resources)(
    '%s preserves authorization before repository before body',
    async (resource, capability) => {
      const denied = fixture([]);
      assertError(await denied.dispatch(resource, 'POST', null), 403, 'forbidden');
      expect(Object.values(denied.repository).every((call) => call.mock.calls.length === 0)).toBe(
        true,
      );
      const missing = fixture([`${capability}:manage`], false);
      assertError(
        await missing.dispatch(resource, 'POST', null),
        503,
        'internal_error',
        'Authorization repository is unavailable',
      );
      const allowed = fixture([`${capability}:manage`]);
      assertError(
        await allowed.dispatch(resource, 'POST', null),
        400,
        'invalid_request',
        'A JSON object body is required',
      );
    },
  );
  it.each(resources)(
    '%s accepts atomic read and authorization fallback, ignoring GET body',
    async (resource, capability) => {
      for (const permission of [`${capability}:read`, 'authorization:read']) {
        const { dispatch, repository } = fixture([permission]);
        const call = {
          roles: 'listRoles',
          permissions: 'listPermissions',
          grants: 'listGrants',
          assignments: 'listAssignments',
          'scope-grants': 'listScopeGrants',
        }[resource];
        expect(await dispatch(resource, 'GET', ['ignored'])).toEqual({
          statusCode: 200,
          body: { fixed: call },
          headers: {
            'x-correlation-id': correlationId,
            'x-content-type-options': 'nosniff',
            'x-frame-options': 'SAMEORIGIN',
            'referrer-policy': 'strict-origin-when-cross-origin',

            'content-security-policy-report-only':
              "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
          },
        });
        expect(repository[call]).toHaveBeenCalledExactlyOnceWith(
          ...(resource === 'permissions' ? [] : [actor.companyId]),
        );
      }
    },
  );
  it('freezes actual grants capability: role rather than role-grant', async () => {
    assertError(await fixture(['role-grant:read']).dispatch('grants', 'GET'), 403, 'forbidden');
    assertError(
      await fixture(['role-grant:manage']).dispatch('grants', 'POST', {}),
      403,
      'forbidden',
    );
    expect((await fixture(['role:read']).dispatch('grants', 'GET')).statusCode).toBe(200);
  });
  it('does not fall back when an atomic grant exists but has no scopes', async () => {
    const { dispatch, context, repository } = fixture(['role:manage', 'authorization:manage']);
    const grant = context.permissions.get('role:manage');
    if (!grant) throw new Error('fixture grant missing');
    grant.scopes.length = 0;
    assertError(await dispatch('grants', 'POST', null), 403, 'forbidden', 'Permission denied');
    expect(repository.grant).not.toHaveBeenCalled();
  });
});

const writes = [
  {
    resource: 'roles',
    method: 'POST',
    capability: 'role:manage',
    body: { code: ' R ', name: ' Role ' },
    call: 'createRole',
    args: [{ code: 'R', name: 'Role' }],
    status: 201,
  },
  {
    resource: 'permissions',
    method: 'POST',
    capability: 'permission:manage',
    body: { capability: ' role:read ', description: ' Read ' },
    call: 'createPermission',
    args: [{ capability: 'role:read', description: 'Read' }],
    status: 201,
  },
  {
    resource: 'grants',
    method: 'POST',
    capability: 'role:manage',
    body: { roleId: id, permissionId: otherId, scopes: ['SELF'], fields: ['displayName'] },
    call: 'grant',
    args: [{ roleId: id, permissionId: otherId, scopes: ['SELF'], fields: ['displayName'] }],
    status: 204,
  },
  {
    resource: 'grants',
    method: 'DELETE',
    capability: 'role:manage',
    body: { roleId: id, permissionId: otherId },
    call: 'revoke',
    args: [id, otherId],
    status: 204,
  },
  {
    resource: 'assignments',
    method: 'POST',
    capability: 'role-assignment:manage',
    body: { employeeId: id, roleId: otherId },
    call: 'assign',
    args: [id, otherId],
    status: 204,
  },
  {
    resource: 'assignments',
    method: 'DELETE',
    capability: 'role-assignment:manage',
    body: { employeeId: id, roleId: otherId },
    call: 'unassign',
    args: [id, otherId],
    status: 204,
  },
  {
    resource: 'scope-grants',
    method: 'POST',
    capability: 'data-scope:manage',
    body: { employeeId: id, permissionId: otherId, scope: 'TEAM', organizationId: id },
    call: 'grantScope',
    args: [{ employeeId: id, permissionId: otherId, scope: 'TEAM', organizationId: id }],
    status: 201,
  },
  {
    resource: `scope-grants/${id}`,
    method: 'DELETE',
    capability: 'data-scope:manage',
    body: null,
    call: 'revokeScope',
    args: [id],
    status: 204,
  },
] as const;
describe('IAM supported write contracts', () => {
  it.each(writes)(
    '$method $resource preserves full repository parameters and fallback',
    async (entry) => {
      for (const capability of [entry.capability, 'authorization:manage']) {
        const { dispatch, repository } = fixture([capability]);
        const result = await dispatch(entry.resource, entry.method, entry.body);
        expect(result).toEqual({
          statusCode: entry.status,
          body: entry.status === 204 ? {} : { fixed: entry.call },
          headers: {
            'x-correlation-id': correlationId,
            'x-content-type-options': 'nosniff',
            'x-frame-options': 'SAMEORIGIN',
            'referrer-policy': 'strict-origin-when-cross-origin',

            'content-security-policy-report-only':
              "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
          },
        });
        expect(repository[entry.call]).toHaveBeenCalledExactlyOnceWith(
          ...entry.args,
          actor,
          correlationId,
        );
      }
    },
  );
  it.each(writes.filter((entry) => !(entry.method === 'DELETE' && entry.resource.includes('/'))))(
    '$method $resource rejects extra fields before other input errors',
    async (entry) => {
      const { dispatch, repository } = fixture([entry.capability]);
      assertError(
        await dispatch(entry.resource, entry.method, { extra: true }),
        400,
        'invalid_request',
        'Unsupported fields: extra',
      );
      expect(repository[entry.call]).not.toHaveBeenCalled();
    },
  );
  it.each([
    ['roles', { code: '', name: '' }, 'code is required'],
    [
      'permissions',
      { capability: 'bad', description: '' },
      'capability must use resource:action syntax',
    ],
    ['grants', { roleId: 'bad', permissionId: 'bad', scopes: [] }, 'roleId must be a UUID'],
    [
      'grants',
      { roleId: id, permissionId: otherId, fields: ['bad_name'], scopes: [] },
      'fields contains an unsupported field name',
    ],
    [
      'grants',
      { roleId: id, permissionId: otherId, scopes: [] },
      'scopes contains an unsupported DataScope',
    ],
    ['assignments', { employeeId: 'bad', roleId: 'bad' }, 'employeeId must be a UUID'],
    [
      'scope-grants',
      { scope: 'BAD', employeeId: 'bad' },
      'scopes contains an unsupported DataScope',
    ],
    ['scope-grants', { scope: 'TEAM', employeeId: 'bad' }, 'Typed scopes require organizationId'],
    [
      'scope-grants',
      { scope: 'SELF', organizationId: id, employeeId: 'bad' },
      'SELF, COMPANY, and GROUP do not accept organizationId',
    ],
    [
      'scope-grants',
      { scope: 'TEAM', organizationId: 'bad', employeeId: 'bad' },
      'organizationId must be a UUID',
    ],
    [
      'scope-grants',
      { scope: 'SELF', employeeId: 'bad', permissionId: otherId },
      'employeeId must be a UUID',
    ],
  ])('%s preserves field/value validation precedence', async (resource, body, message) => {
    const { dispatch, repository } = fixture(['authorization:manage']);
    assertError(await dispatch(resource, 'POST', body), 400, 'invalid_request', message);
    expect(Object.values(repository).every((call) => call.mock.calls.length === 0)).toBe(true);
  });
});

describe('IAM unsupported method/item compatibility', () => {
  it('PUT and item POST preserve body checks but do not dispatch mutations', async () => {
    const { dispatch, repository } = fixture(['authorization:manage']);
    for (const [resource] of resources) {
      assertError(
        await dispatch(`${resource}/${id}`, 'POST', {}),
        404,
        'not_found',
        'Route not found',
      );
      const valid =
        resource === 'grants'
          ? { roleId: id, permissionId: otherId }
          : resource === 'assignments'
            ? { employeeId: id, roleId: otherId }
            : {};
      assertError(await dispatch(resource, 'PUT', valid), 404, 'not_found', 'Route not found');
      assertError(
        await dispatch(resource, 'PUT', null),
        400,
        'invalid_request',
        'A JSON object body is required',
      );
    }
    expect(Object.values(repository).every((call) => call.mock.calls.length === 0)).toBe(true);
  });
  it.each(resources)(
    '%s item and unsupported methods retain prerequisite errors',
    async (resource) => {
      for (const [path, method] of [
        [`${resource}/${id}`, 'GET'],
        [`${resource}/${id}`, 'POST'],
        [resource, 'PATCH'],
      ] as const) {
        assertError(await fixture([]).dispatch(path, method, null), 403, 'forbidden');
        assertError(
          await fixture(['authorization:read', 'authorization:manage'], false).dispatch(
            path,
            method,
            null,
          ),
          503,
          'internal_error',
          'Authorization repository is unavailable',
        );
        assertError(
          await fixture(['authorization:read', 'authorization:manage']).dispatch(
            path,
            method,
            null,
          ),
          method === 'GET' ? 404 : 400,
          method === 'GET' ? 'not_found' : 'invalid_request',
          method === 'GET' ? 'Route not found' : 'A JSON object body is required',
        );
      }
    },
  );
  it.each(resources)(
    '%s DELETE item ignores body; only scope-grants validates item UUID',
    async (resource) => {
      const { dispatch } = fixture(['authorization:manage']);
      const result = await dispatch(`${resource}/${id}`, 'DELETE', ['ignored']);
      expect(result.statusCode).toBe(resource === 'scope-grants' ? 204 : 404);
      const invalid = await dispatch(`${resource}/bad`, 'DELETE', null);
      expect(invalid.statusCode).toBe(resource === 'scope-grants' ? 400 : 404);
    },
  );
  it.each(resources)('%s DELETE collection must parse body', async (resource) => {
    assertError(
      await fixture(['authorization:manage']).dispatch(resource, 'DELETE', null),
      400,
      'invalid_request',
      'A JSON object body is required',
    );
  });
  it.each(['grants', 'assignments'])(
    '%s unsupported PATCH validates allow and UUID before fallback',
    async (resource) => {
      const { dispatch } = fixture(['authorization:manage']);
      assertError(
        await dispatch(resource, 'PATCH', { extra: true }),
        400,
        'invalid_request',
        'Unsupported fields: extra',
      );
      assertError(
        await dispatch(resource, 'PATCH', {}),
        400,
        'invalid_request',
        resource === 'grants' ? 'roleId is required' : 'employeeId is required',
      );
      assertError(
        await dispatch(
          resource,
          'PATCH',
          resource === 'grants'
            ? { roleId: id, permissionId: otherId, scopes: 'ignored' }
            : { employeeId: id, roleId: otherId },
        ),
        404,
        'not_found',
        'Route not found',
      );
    },
  );
});
