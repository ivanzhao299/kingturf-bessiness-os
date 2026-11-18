// D5（ADR-0013）：租户设置路由契约——授权门、键白名单、幂等键必须、
// 服务端 schema 校验错误透传、未知键 not_found。
import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '@kingturf/domain';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';

const correlationId = '11111111-1111-4111-8111-111111111111';
const actor = { employeeId: 'employee', companyId: 'company' };

function fixture(capabilities: readonly string[]) {
  const put = vi
    .fn()
    .mockResolvedValue({ version: 1, value: 12, status: 'DRAFT', publishedAt: null });
  const publish = vi.fn().mockResolvedValue({
    version: 1,
    value: 12,
    status: 'PUBLISHED',
    publishedAt: '2026-11-18T00:00:00.000Z',
  });
  const list = vi.fn().mockResolvedValue([]);
  const repository = { put, publish, list };
  const context = {
    actor,
    permissions: new Map(capabilities.map((name) => [name, { scopes: ['COMPANY'], fields: null }])),
  };
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(context),
    } as unknown as ApiDependencies['auth'],
    employees: {} as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
    tenantSettings: repository as unknown as NonNullable<ApiDependencies['tenantSettings']>,
  });
  const dispatch = (request: ApiRequest) =>
    app.dispatch({
      ...request,
      headers: {
        authorization: 'Bearer fixture-token',
        'x-correlation-id': correlationId,
        ...(request.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...((request.headers ?? {}) as Record<string, string>),
      },
    });
  return { put, publish, list, dispatch };
}

describe('tenant settings routes (D5)', () => {
  it('lists the catalog with tenant-setting:read only', async () => {
    const f = fixture(['tenant-setting:read']);
    const response = await f.dispatch({
      method: 'GET',
      pathname: '/api/v1/tenant-settings',
      body: undefined,
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ items: [] });
    expect(f.list).toHaveBeenCalledWith('company');
  });

  it('denies reads and writes without capabilities and routes manage to PUT/publish', async () => {
    const none = fixture([]);
    expect(
      (await none.dispatch({ method: 'GET', pathname: '/api/v1/tenant-settings', body: undefined }))
        .statusCode,
    ).toBe(403);
    const reader = fixture(['tenant-setting:read']);
    expect(
      (
        await reader.dispatch({
          method: 'PUT',
          pathname: '/api/v1/tenant-settings',
          body: { key: 'security.password.minLength', value: 14 },
        })
      ).statusCode,
    ).toBe(403);
    const manager = fixture(['tenant-setting:manage']);
    const written = await manager.dispatch({
      method: 'PUT',
      pathname: '/api/v1/tenant-settings',
      body: { key: 'security.password.minLength', value: 14 },
      headers: { 'idempotency-key': 'idem-1' },
    });
    expect(written.statusCode).toBe(201);
    expect(manager.put).toHaveBeenCalledOnce();
    const published = await manager.dispatch({
      method: 'POST',
      pathname: '/api/v1/tenant-settings/publish',
      body: { key: 'security.password.minLength' },
      headers: { 'idempotency-key': 'idem-pub-1' },
    });
    expect(published.statusCode).toBe(200);
    expect(manager.publish).toHaveBeenCalledOnce();
  });

  it('requires an idempotency key and only allowlisted body fields', async () => {
    const f = fixture(['tenant-setting:manage']);
    const missing = await f.dispatch({
      method: 'PUT',
      pathname: '/api/v1/tenant-settings',
      body: { key: 'security.password.minLength', value: 14 },
    });
    expect(missing.statusCode).toBe(400);
    expect(f.put).not.toHaveBeenCalled();
    const extra = await f.dispatch({
      method: 'PUT',
      pathname: '/api/v1/tenant-settings',
      body: { key: 'security.password.minLength', value: 14, extra: true },
      headers: { 'idempotency-key': 'idem-2' },
    });
    expect(extra.statusCode).toBe(400);
    const publishExtra = await f.dispatch({
      method: 'POST',
      pathname: '/api/v1/tenant-settings/publish',
      body: { key: 'security.password.minLength', force: true },
      headers: { 'idempotency-key': 'idem-3' },
    });
    expect(publishExtra.statusCode).toBe(400);
    expect(f.publish).not.toHaveBeenCalled();
  });

  it('surfaces repository schema and whitelist failures', async () => {
    const f = fixture(['tenant-setting:manage']);
    f.put.mockRejectedValueOnce(new DomainError('invalid_request', 'fixed'));
    const invalid = await f.dispatch({
      method: 'PUT',
      pathname: '/api/v1/tenant-settings',
      body: { key: 'security.password.minLength', value: 7 },
      headers: { 'idempotency-key': 'idem-4' },
    });
    expect(invalid.statusCode).toBe(400);
    f.put.mockRejectedValueOnce(new DomainError('not_found', 'gone'));
    const unknown = await f.dispatch({
      method: 'PUT',
      pathname: '/api/v1/tenant-settings',
      body: { key: 'not.registered', value: 1 },
      headers: { 'idempotency-key': 'idem-5' },
    });
    expect(unknown.statusCode).toBe(404);
  });
});
