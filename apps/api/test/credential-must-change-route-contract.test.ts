// A1（TD-SEC-011）：凭证首登强制改密——MUST_CHANGE 会话门（服务端强制）。
// 仅放行 GET /auth/session、PUT /auth/credential、POST /auth/logout；其余 403 credential_must_change。
import { describe, expect, it, vi } from 'vitest';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';

const correlationId = '11111111-1111-4111-8111-111111111111';

function fixture(credentialState: 'OK' | 'MUST_CHANGE' | undefined) {
  const context = {
    actor: { employeeId: 'employee', companyId: 'company' },
    permissions: new Map([['role:read', { scopes: ['COMPANY'], fields: null }]]),
    ...(credentialState ? { credentialState } : {}),
  };
  const changePassword = vi.fn().mockResolvedValue(undefined);
  const logout = vi.fn().mockResolvedValue(undefined);
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(context),
      changePassword,
      logout,
      sessionGeneration: vi.fn().mockReturnValue('g'.repeat(43)),
    } as unknown as ApiDependencies['auth'],
    employees: {
      findById: vi.fn().mockResolvedValue({ displayName: 'User', employeeNumber: 'E01' }),
    } as unknown as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
  });
  const dispatch = (request: ApiRequest) =>
    app.dispatch({
      ...request,
      headers: {
        authorization: 'Bearer fixture-token',
        'x-correlation-id': correlationId,
        ...(request.method === 'PUT' || request.method === 'POST'
          ? { 'content-type': 'application/json' }
          : {}),
        ...request.headers,
      },
    });
  return { dispatch, changePassword, logout };
}

describe('credential must-change session gate (A1)', () => {
  it('blocks business routes with 403 credential_must_change for MUST_CHANGE sessions', async () => {
    const f = fixture('MUST_CHANGE');
    const response = await f.dispatch({ method: 'GET', pathname: '/api/v1/roles' });
    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: 'credential_must_change',
        message: 'Password change is required before using this session',
        correlationId,
      },
    });
  });

  it('still allows session read, credential change and logout', async () => {
    const f = fixture('MUST_CHANGE');
    const session = await f.dispatch({ method: 'GET', pathname: '/api/v1/auth/session' });
    expect(session.statusCode).toBe(200);
    expect((session.body as Record<string, unknown>).credentialState).toBe('MUST_CHANGE');
    const changed = await f.dispatch({
      method: 'PUT',
      pathname: '/api/v1/auth/credential',
      body: { currentPassword: 'old', password: 'new-password-123' },
    });
    expect(changed.statusCode).toBe(204);
    expect(f.changePassword).toHaveBeenCalledOnce();
    const out = await f.dispatch({ method: 'POST', pathname: '/api/v1/auth/logout' });
    expect(out.statusCode).toBe(204);
    expect(f.logout).toHaveBeenCalledOnce();
  });

  it('keeps OK sessions unrestricted and reports credentialState OK', async () => {
    const f = fixture('OK');
    const roles = await f.dispatch({ method: 'GET', pathname: '/api/v1/roles' });
    expect(roles.statusCode).not.toBe(403);
    const session = await f.dispatch({ method: 'GET', pathname: '/api/v1/auth/session' });
    expect((session.body as Record<string, unknown>).credentialState).toBe('OK');
  });
});
