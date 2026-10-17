// Fixed expected contracts from the inline branch at ad8f260; run before extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '@kingturf/domain';
import { buildApp, type ApiDependencies } from '../src/app.js';

const correlationId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const pathname = `/api/v1/employees/${employeeId}/identity`;
function fixture(allowed = true) {
  const context = {
    actor: { employeeId: 'actor', companyId: 'company' },
    permissions: new Map(
      allowed ? [['authorization:manage', { scopes: ['SELF'], fields: null }]] : [],
    ),
  };
  const provisionIdentity = vi.fn().mockResolvedValue(undefined);
  const authenticate = vi.fn().mockResolvedValue(context);
  const count = vi.fn();
  const app = buildApp({
    auth: { provisionIdentity, authenticate } as unknown as ApiDependencies['auth'],
    employees: {} as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
    telemetry: { count, timing: vi.fn() },
  });
  const dispatch = (body: unknown, path = pathname, method = 'PUT', authenticated = true) =>
    app.dispatch({
      method,
      pathname: path,
      body,
      headers: {
        authorization: authenticated ? 'Bearer fixture-token' : '',
        'x-correlation-id': correlationId,
      },
    });
  return { context, provisionIdentity, authenticate, count, dispatch };
}
const response = (statusCode: number, code: string, message: string) => ({
  statusCode,
  body: { error: { code, message, correlationId } },
  headers: {
    'x-correlation-id': correlationId,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'strict-origin-when-cross-origin',
  },
});

describe('identity provisioning inline contract', () => {
  it('preserves permission priority for malformed body and regex-matched invalid UUID', async () => {
    const { dispatch, provisionIdentity } = fixture(false);
    for (const [body, path] of [
      [null, pathname],
      [{}, '/api/v1/employees/bad/identity'],
    ] as const) {
      const result = await dispatch(body, path);
      expect(result.statusCode).toBe(403);
      expect(result.body).toMatchObject({ error: { code: 'forbidden', correlationId } });
      expect(result.headers).toEqual({
        'x-correlation-id': correlationId,
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'SAMEORIGIN',
        'referrer-policy': 'strict-origin-when-cross-origin',
      });
    }
    expect(provisionIdentity).not.toHaveBeenCalled();
  });
  it('preserves body/allow/path/string error order and does not invoke the service', async () => {
    const { dispatch, provisionIdentity } = fixture();
    expect(await dispatch(null)).toEqual(
      response(400, 'invalid_request', 'A JSON object body is required'),
    );
    expect(await dispatch({ extra: true }, '/api/v1/employees/bad/identity')).toEqual(
      response(400, 'invalid_request', 'Unsupported fields: extra'),
    );
    expect(await dispatch({}, '/api/v1/employees/bad/identity')).toEqual(
      response(400, 'invalid_request', 'employeeId must be a UUID'),
    );
    expect(await dispatch({})).toEqual(response(400, 'invalid_request', 'login is required'));
    expect(await dispatch({ login: 'user' })).toEqual(
      response(400, 'invalid_request', 'password is required'),
    );
    expect(provisionIdentity).not.toHaveBeenCalled();
  });
  it('returns 204 with exact arguments, correlation and telemetry', async () => {
    const { dispatch, provisionIdentity, context, authenticate, count } = fixture();
    expect(await dispatch({ login: ' user ', password: ' fixture-password ' })).toEqual({
      statusCode: 204,
      body: {},
      headers: {
        'x-correlation-id': correlationId,
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'SAMEORIGIN',
        'referrer-policy': 'strict-origin-when-cross-origin',
      },
    });
    expect(provisionIdentity).toHaveBeenCalledExactlyOnceWith(
      context,
      employeeId,
      'user',
      'fixture-password',
      correlationId,
    );
    expect(authenticate).toHaveBeenCalledExactlyOnceWith('fixture-token');
    expect(count).toHaveBeenCalledWith('http_requests_total', 1, {
      method: 'PUT',
      route: 'api',
      status: '204',
    });
  });
  it('does not mutate without a session or on unsupported method/path', async () => {
    const { dispatch, provisionIdentity, authenticate } = fixture();
    expect(await dispatch(null, pathname, 'PUT', false)).toEqual(
      response(401, 'authentication_required', 'A valid session is required'),
    );
    expect(authenticate).not.toHaveBeenCalled();
    expect(await dispatch(null, pathname, 'POST')).toEqual(
      response(404, 'not_found', 'Route not found'),
    );
    expect(await dispatch(null, '/api/v1/employees/not-a-uuid/identity')).toEqual(
      response(404, 'not_found', 'Route not found'),
    );
    expect(provisionIdentity).not.toHaveBeenCalled();
  });
  it('preserves domain and unexpected error envelopes', async () => {
    const { dispatch, provisionIdentity } = fixture();
    const body = { login: 'user', password: 'fixture-password' };
    for (const [code, status] of [
      ['not_found', 404],
      ['conflict', 409],
      ['forbidden', 403],
    ] as const) {
      provisionIdentity.mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
      expect(await dispatch(body)).toEqual(response(status, code, 'fixed failure'));
    }
    provisionIdentity.mockRejectedValueOnce(new Error('private fixture failure'));
    expect(await dispatch(body)).toEqual(response(500, 'internal_error', 'Internal server error'));
  });
});
