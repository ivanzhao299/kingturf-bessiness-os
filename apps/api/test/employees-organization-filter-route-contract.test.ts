// UI-M2（governance/organization 左树右表）：GET /api/v1/employees 加性 `organization`
// 查询参数（uuid，服务端按选中组织过滤，DataScope 谓词原样叠加）——契约红→绿。
import { describe, expect, it, vi } from 'vitest';
import { buildApp, type ApiDependencies } from '../src/app.js';

const correlationId = '11111111-1111-4111-8111-111111111111';
const orgId = '22222222-2222-4222-8222-222222222222';
const context = {
  actor: { employeeId: 'actor', companyId: 'company' },
  permissions: new Map([['employee:read', { scopes: ['COMPANY'], fields: null }]]),
};

function fixture() {
  const list = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(context),
    } as unknown as ApiDependencies['auth'],
    employees: { list } as unknown as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
    telemetry: { count: vi.fn(), timing: vi.fn() },
  });
  const dispatch = (query: Record<string, string | undefined>) =>
    app.dispatch({
      method: 'GET',
      pathname: '/api/v1/employees',
      query,
      headers: { authorization: 'Bearer fixture-token', 'x-correlation-id': correlationId },
    });
  return { list, dispatch };
}

describe('employees organization filter (UI-M2 additive contract)', () => {
  it('passes the organization uuid through to the repository', async () => {
    const { list, dispatch } = fixture();
    expect((await dispatch({ organization: orgId })).statusCode).toBe(200);
    expect(list).toHaveBeenCalledExactlyOnceWith(
      context.actor.companyId,
      ['COMPANY'],
      context.actor.employeeId,
      [],
      { limit: 50 },
      orgId,
    );
  });
  it('omits the filter without the parameter (additive only)', async () => {
    const { list, dispatch } = fixture();
    expect((await dispatch({})).statusCode).toBe(200);
    const call = list.mock.calls[0];
    expect(call?.[5]).toBeUndefined();
  });
  it('rejects a malformed organization value as invalid_request', async () => {
    const { list, dispatch } = fixture();
    const result = await dispatch({ organization: 'not-a-uuid' });
    expect(result.statusCode).toBe(400);
    expect(result.body).toMatchObject({ error: { code: 'invalid_request', correlationId } });
    expect(list).not.toHaveBeenCalled();
  });
});
