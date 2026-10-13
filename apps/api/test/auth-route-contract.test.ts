// Fixed contracts captured from app.ts at 0fdd996, before auth route extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '@kingturf/domain';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';

const correlationId = '11111111-1111-4111-8111-111111111111';
const actor = { employeeId: 'employee', companyId: 'company' };
const context = {
  actor,
  permissions: new Map([
    ['role:read', { scopes: ['SELF'], fields: null }],
    ['identity:read', { scopes: ['SELF'], fields: null }],
  ]),
};
function fixture() {
  const auth = {
    login: vi.fn().mockResolvedValue({ token: 'fixture-token', expiresAt: '2030-01-01' }),
    authenticate: vi.fn().mockResolvedValue(context),
    logout: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn().mockResolvedValue(undefined),
  };
  const findById = vi.fn().mockResolvedValue({ displayName: 'User', employeeNumber: 'E01' });
  const app = buildApp({
    auth: auth as unknown as ApiDependencies['auth'],
    employees: { findById } as unknown as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
  });
  const dispatch = (request: ApiRequest) =>
    app.dispatch({
      ...request,
      headers: {
        authorization: 'Bearer fixture-token',
        'x-correlation-id': correlationId,
        ...request.headers,
      },
    });
  return { auth, findById, dispatch };
}
const envelope = (statusCode: number, code: string, message: string) => ({
  statusCode,
  body: { error: { code, message, correlationId } },
  headers: { 'x-correlation-id': correlationId },
});

describe('auth HTTP contracts frozen at 0fdd996', () => {
  it('login is pre-auth, trims strings and accepts extra fields', async () => {
    const { auth, dispatch } = fixture();
    expect(
      await dispatch({
        method: 'POST',
        pathname: '/api/v1/auth/login',
        body: { login: ' user ', password: ' fixture-password ', extra: true },
      }),
    ).toEqual({
      statusCode: 200,
      body: { token: 'fixture-token', expiresAt: '2030-01-01' },
      headers: { 'x-correlation-id': correlationId },
    });
    expect(auth.login).toHaveBeenCalledExactlyOnceWith('user', 'fixture-password', correlationId);
    expect(auth.authenticate).not.toHaveBeenCalled();
    auth.login.mockResolvedValueOnce(null);
    expect(
      await dispatch({
        method: 'POST',
        pathname: '/api/v1/auth/login',
        body: { login: 'user', password: 'fixture-password' },
      }),
    ).toEqual(envelope(401, 'authentication_required', 'Invalid credentials'));
  });
  it('global dependency failure precedes login validation; invalid bodies do not call login', async () => {
    expect(
      await buildApp().dispatch({
        method: 'POST',
        pathname: '/api/v1/auth/login',
        body: null,
        headers: { 'x-correlation-id': correlationId },
      }),
    ).toEqual(envelope(503, 'internal_error', 'Application dependencies are unavailable'));
    const { auth, dispatch } = fixture();
    expect(await dispatch({ method: 'POST', pathname: '/api/v1/auth/login', body: null })).toEqual(
      envelope(400, 'invalid_request', 'A JSON object body is required'),
    );
    expect(await dispatch({ method: 'POST', pathname: '/api/v1/auth/login', body: {} })).toEqual(
      envelope(400, 'invalid_request', 'login is required'),
    );
    expect(auth.login).not.toHaveBeenCalled();
  });
  it('logout/session authenticate once per request and preserve exact arguments and response', async () => {
    const { auth, findById, dispatch } = fixture();
    expect(await dispatch({ method: 'POST', pathname: '/api/v1/auth/logout', body: null })).toEqual(
      { statusCode: 204, body: {}, headers: { 'x-correlation-id': correlationId } },
    );
    expect(auth.logout).toHaveBeenCalledExactlyOnceWith('fixture-token', context, correlationId);
    expect(auth.authenticate).toHaveBeenCalledExactlyOnceWith('fixture-token');
    expect(await dispatch({ method: 'GET', pathname: '/api/v1/auth/session' })).toEqual({
      statusCode: 200,
      body: {
        ...actor,
        displayName: 'User',
        employeeNumber: 'E01',
        permissions: ['identity:read', 'role:read'],
      },
      headers: { 'x-correlation-id': correlationId },
    });
    expect(findById).toHaveBeenCalledExactlyOnceWith('employee', 'company', ['SELF'], 'employee');
    expect(auth.authenticate).toHaveBeenCalledTimes(2);
    findById.mockResolvedValueOnce(null);
    expect((await dispatch({ method: 'GET', pathname: '/api/v1/auth/session' })).body).toEqual({
      ...actor,
      displayName: null,
      employeeNumber: null,
      permissions: ['identity:read', 'role:read'],
    });
  });
  it('credential parses only allowed fields and preserves service failure priority', async () => {
    const { auth, dispatch } = fixture();
    expect(
      await dispatch({
        method: 'PUT',
        pathname: '/api/v1/auth/credential',
        body: { currentPassword: ' old ', password: ' new ' },
      }),
    ).toEqual({ statusCode: 204, body: {}, headers: { 'x-correlation-id': correlationId } });
    expect(auth.changePassword).toHaveBeenCalledExactlyOnceWith(
      context,
      'old',
      'new',
      'fixture-token',
      correlationId,
    );
    auth.changePassword.mockClear();
    expect(
      await dispatch({
        method: 'PUT',
        pathname: '/api/v1/auth/credential',
        body: { currentPassword: 'old', password: 'new', target: true },
      }),
    ).toEqual(envelope(400, 'invalid_request', 'Unsupported fields: target'));
    expect(auth.changePassword).not.toHaveBeenCalled();
    auth.changePassword.mockRejectedValueOnce(
      new DomainError('forbidden', 'Current password is incorrect'),
    );
    expect(
      await dispatch({
        method: 'PUT',
        pathname: '/api/v1/auth/credential',
        body: { currentPassword: 'wrong', password: 'short' },
      }),
    ).toEqual(envelope(403, 'forbidden', 'Current password is incorrect'));
  });
  it('unauthenticated mutations and unsupported method/path preserve session/fallback behavior', async () => {
    const { auth, dispatch } = fixture();
    for (const pathname of [
      '/api/v1/auth/logout',
      '/api/v1/auth/session',
      '/api/v1/auth/credential',
    ]) {
      expect(
        await dispatch({
          method: pathname.endsWith('logout')
            ? 'POST'
            : pathname.endsWith('session')
              ? 'GET'
              : 'PUT',
          pathname,
          body: null,
          headers: { authorization: '' },
        }),
      ).toEqual(envelope(401, 'authentication_required', 'A valid session is required'));
    }
    expect(auth.authenticate).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
    expect(auth.changePassword).not.toHaveBeenCalled();
    for (const request of [
      { method: 'GET', pathname: '/api/v1/auth/login' },
      { method: 'POST', pathname: '/api/v1/auth/session' },
      { method: '', pathname: '' },
      { method: 'POST', pathname: '/api/v1/auth/refresh' },
    ]) {
      expect(await dispatch(request)).toEqual(envelope(404, 'not_found', 'Route not found'));
    }
    expect(auth.authenticate).toHaveBeenCalledTimes(4);
  });
});
