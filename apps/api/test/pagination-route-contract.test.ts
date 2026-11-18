// B2（TD-API-003）：治理列表 cursor 分页契约——limit 边界 1-100/默认 50、cursor 透传、
// 响应 {items,nextCursor} 信封。以 organizations 端点为代表性探针（parsePageFilter 全端点共用）。
import { describe, expect, it, vi } from 'vitest';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';

const correlationId = '11111111-1111-4111-8111-111111111111';
const actor = { employeeId: 'employee', companyId: 'company' };
const context = {
  actor,
  permissions: new Map([['organization:read', { scopes: ['COMPANY'], fields: null }]]),
};

function fixture() {
  const list = vi.fn().mockResolvedValue({ items: [{ id: 'organization-1' }], nextCursor: null });
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(context),
    } as unknown as ApiDependencies['auth'],
    organizations: { list } as unknown as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
  });
  const dispatch = (request: ApiRequest) =>
    app.dispatch({
      ...request,
      headers: { authorization: 'Bearer fixture-token', 'x-correlation-id': correlationId },
    });
  const get = (query: Readonly<Record<string, string>>) =>
    dispatch({ method: 'GET', pathname: '/api/v1/organizations', query: { ...query } });
  return { list, dispatch, get };
}

describe('governance cursor pagination contract (B2)', () => {
  it('rejects limit outside 1-100 and malformed cursors', async () => {
    const f = fixture();
    for (const query of [{ limit: '0' }, { limit: '101' }, { limit: 'abc' }, { cursor: '' }]) {
      const response = await f.get(query);
      expect(response.statusCode, JSON.stringify(query)).toBe(400);
      expect(response.body).toMatchObject({ error: { code: 'invalid_request' } });
    }
    expect(f.list).not.toHaveBeenCalled();
  });

  it('defaults to 50, accepts 100 and forwards opaque cursors to the repository', async () => {
    const f = fixture();
    await f.get({});
    expect(f.list).toHaveBeenLastCalledWith('company', { limit: 50 });
    await f.get({ limit: '100' });
    expect(f.list).toHaveBeenLastCalledWith('company', { limit: 100 });
    await f.get({ limit: '7', cursor: 'opaque-token' });
    expect(f.list).toHaveBeenLastCalledWith('company', { limit: 7, cursor: 'opaque-token' });
  });

  it('returns the {items,nextCursor} envelope verbatim', async () => {
    const f = fixture();
    const response = await f.get({});
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ items: [{ id: 'organization-1' }], nextCursor: null });
  });
});
