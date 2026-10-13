// Fixed expectations from the inline profiles/state branches at d50da96; run before extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const identityId = '11111111-1111-4111-8111-111111111111';
const correlationId = '22222222-2222-4222-8222-222222222222';
const actor = { employeeId: 'actor', companyId: 'tenant' };
const profilesPath = '/api/v1/user-access-profiles';
const statePath = `/api/v1/identities/${identityId}/state`;
const badStatePath = '/api/v1/identities/bad/state';
const items = [{ id: 'fixed-profile' }];
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['SELF'], fields: null };
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['identity:read', grant],
    ['identity:manage', grant],
  ],
  available: 'both' | 'profiles' | 'state' | 'none' | 'no-repository' = 'both',
) {
  const context: AuthorizationContext = { actor, permissions: new Map(permissions) };
  const authenticate = vi.fn().mockResolvedValue(context);
  const listUserAccessProfiles = vi.fn().mockResolvedValue(items);
  const setIdentityActive = vi.fn().mockResolvedValue(undefined);
  const repository = {
    ...(['both', 'profiles'].includes(available) ? { listUserAccessProfiles } : {}),
    ...(['both', 'state'].includes(available) ? { setIdentityActive } : {}),
  } as unknown as NonNullable<ApiDependencies['authorization']>;
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    employees: {} as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
    ...(available === 'no-repository' ? {} : { authorization: repository }),
  });
  const dispatch = (method: string, pathname: string, body: unknown = null, session = true) =>
    app.dispatch({
      method,
      pathname,
      body,
      headers: {
        authorization: session ? 'Bearer fixture-token' : '',
        'x-correlation-id': correlationId,
      },
    });
  return { context, repository, authenticate, listUserAccessProfiles, setIdentityActive, dispatch };
}
const error = (statusCode: number, code: string, message: string) => ({
  statusCode,
  body: { error: { code, message, correlationId } },
  headers: { 'x-correlation-id': correlationId },
});
const denied = error(403, 'forbidden', 'Permission denied');
const fieldDenied = error(403, 'forbidden', 'Field permission denied');
const invalidBoolean = error(400, 'invalid_request', 'active and revokeSessions must be boolean');
const invalidUuid = error(400, 'invalid_request', 'identityId must be a UUID');
const unavailableProfiles = error(
  503,
  'internal_error',
  'User access profile repository is unavailable',
);
const unavailableState = error(
  503,
  'internal_error',
  'Identity management repository is unavailable',
);

describe('profiles inline contract', () => {
  it.each(['identity:read', 'authorization:read'] as const)(
    '%s lists tenant profiles and ignores GET body',
    async (capability) => {
      const f = fixture([[capability, grant]]);
      expect(await f.dispatch('GET', profilesPath, ['ignored'])).toEqual({
        statusCode: 200,
        body: { items },
        headers: { 'x-correlation-id': correlationId },
      });
      expect(f.listUserAccessProfiles).toHaveBeenCalledExactlyOnceWith(actor.companyId);
      expect(f.listUserAccessProfiles.mock.contexts).toEqual([f.repository]);
      expect(f.setIdentityActive).not.toHaveBeenCalled();
    },
  );
  it('authorizes before unavailable repository/method', async () => {
    const f = fixture([], 'no-repository');
    expect(await f.dispatch('GET', profilesPath)).toEqual(denied);
    expect(f.listUserAccessProfiles).not.toHaveBeenCalled();
  });
  it.each(['none', 'state', 'no-repository'] as const)(
    'returns 503 with %s availability',
    async (available) => {
      const f = fixture(undefined, available);
      expect(await f.dispatch('GET', profilesPath, null)).toEqual(unavailableProfiles);
      expect(f.listUserAccessProfiles).not.toHaveBeenCalled();
    },
  );
  it('does not retry fallback when preferred scopes are empty', async () => {
    const f = fixture([
      ['identity:read', { scopes: [], fields: null }],
      ['authorization:read', grant],
    ]);
    expect(await f.dispatch('GET', profilesPath)).toEqual(denied);
    expect(f.listUserAccessProfiles).not.toHaveBeenCalled();
  });
  it('does not introduce field checks for GET profiles', async () => {
    const f = fixture([['identity:read', { scopes: ['SELF'], fields: [] }]]);
    expect((await f.dispatch('GET', profilesPath, { extra: true })).statusCode).toBe(200);
    expect(f.listUserAccessProfiles).toHaveBeenCalledExactlyOnceWith(actor.companyId);
  });
});

describe('identity state inline validation and field permission contract', () => {
  it.each([
    [null, error(400, 'invalid_request', 'A JSON object body is required')],
    [[], error(400, 'invalid_request', 'A JSON object body is required')],
    ['invalid', error(400, 'invalid_request', 'A JSON object body is required')],
    [{ extra: true }, error(400, 'invalid_request', 'Unsupported fields: extra')],
    [{ z: true, a: true }, error(400, 'invalid_request', 'Unsupported fields: a, z')],
    [{ active: 'invalid' }, denied],
    [{ active: true, revokeSessions: 'invalid' }, denied],
  ])(
    'preserves body/allow before permission and permission before booleans (%j)',
    async (body, expected) => {
      const f = fixture([], 'none');
      expect(await f.dispatch('PATCH', badStatePath, body)).toEqual(expected);
      expect(f.setIdentityActive).not.toHaveBeenCalled();
    },
  );
  it.each([
    {},
    { active: null },
    { active: 1 },
    { active: false, revokeSessions: null },
    { active: true, revokeSessions: 'true' },
  ])('checks booleans before unavailable method and UUID (%j)', async (body) => {
    const f = fixture(undefined, 'none');
    expect(await f.dispatch('PATCH', badStatePath, body)).toEqual(invalidBoolean);
    expect(f.setIdentityActive).not.toHaveBeenCalled();
  });
  it.each(['none', 'profiles', 'no-repository'] as const)(
    'checks method %s before path UUID',
    async (available) => {
      const f = fixture(undefined, available);
      expect(await f.dispatch('PATCH', badStatePath, { active: true })).toEqual(unavailableState);
      expect(f.setIdentityActive).not.toHaveBeenCalled();
    },
  );
  it('validates matched UUID when method is available', async () => {
    const f = fixture();
    expect(await f.dispatch('PATCH', badStatePath, { active: true })).toEqual(invalidUuid);
    expect(f.setIdentityActive).not.toHaveBeenCalled();
  });
  it('does not retry legacy when preferred has empty scopes', async () => {
    const f = fixture([
      ['identity:manage', { scopes: [], fields: null }],
      ['authorization:manage', grant],
    ]);
    expect(await f.dispatch('PATCH', statePath, { active: true })).toEqual(denied);
    expect(f.setIdentityActive).not.toHaveBeenCalled();
  });
  it.each(['identity:manage', 'authorization:manage'] as const)(
    'checks each requested field on %s before booleans',
    async (capability) => {
      const f = fixture([[capability, { scopes: ['SELF'], fields: ['active'] }]]);
      expect(
        await f.dispatch('PATCH', statePath, { active: true, revokeSessions: 'invalid' }),
      ).toEqual(fieldDenied);
      expect(f.setIdentityActive).not.toHaveBeenCalled();
      expect(await f.dispatch('PATCH', statePath, { active: false })).toEqual({
        statusCode: 204,
        body: {},
        headers: { 'x-correlation-id': correlationId },
      });
      expect(f.setIdentityActive).toHaveBeenCalledExactlyOnceWith(
        identityId,
        false,
        false,
        actor,
        correlationId,
      );
    },
  );
  it('does not retry fallback after preferred field denial', async () => {
    const f = fixture([
      ['identity:manage', { scopes: ['SELF'], fields: ['active'] }],
      ['authorization:manage', grant],
    ]);
    expect(await f.dispatch('PATCH', statePath, { active: true, revokeSessions: true })).toEqual(
      fieldDenied,
    );
    expect(f.setIdentityActive).not.toHaveBeenCalled();
  });
  it('requires active field authorization independently of revokeSessions', async () => {
    const f = fixture([['identity:manage', { scopes: ['SELF'], fields: ['revokeSessions'] }]]);
    expect(await f.dispatch('PATCH', statePath, { active: true, revokeSessions: false })).toEqual(
      fieldDenied,
    );
    expect(f.setIdentityActive).not.toHaveBeenCalled();
  });
});

describe('identity state successful calls and global boundaries', () => {
  it.each([
    ['identity:manage', { active: true }, true, false],
    ['identity:manage', { active: false }, false, false],
    ['identity:manage', { active: true, revokeSessions: true }, true, true],
    ['identity:manage', { active: false, revokeSessions: false }, false, false],
    ['authorization:manage', { active: false, revokeSessions: true }, false, true],
  ] as const)(
    'preserves exact mutation args for %s %j',
    async (capability, body, active, revokeSessions) => {
      const f = fixture([[capability, grant]]);
      expect(await f.dispatch('PATCH', statePath, body)).toEqual({
        statusCode: 204,
        body: {},
        headers: { 'x-correlation-id': correlationId },
      });
      expect(f.setIdentityActive).toHaveBeenCalledExactlyOnceWith(
        identityId,
        active,
        revokeSessions,
        actor,
        correlationId,
      );
      expect(f.setIdentityActive.mock.contexts).toEqual([f.repository]);
      expect(f.listUserAccessProfiles).not.toHaveBeenCalled();
    },
  );
  it('allows both explicitly requested fields when granted', async () => {
    const f = fixture([
      ['identity:manage', { scopes: ['SELF'], fields: ['active', 'revokeSessions'] }],
    ]);
    expect(
      (await f.dispatch('PATCH', statePath, { active: true, revokeSessions: false })).statusCode,
    ).toBe(204);
    expect(f.setIdentityActive).toHaveBeenCalledExactlyOnceWith(
      identityId,
      true,
      false,
      actor,
      correlationId,
    );
  });
  it('preserves repository error envelopes for both routes', async () => {
    const f = fixture();
    for (const [code, status] of [
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
      ['invalid_request', 400],
    ] as const) {
      f.listUserAccessProfiles.mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
      expect(await f.dispatch('GET', profilesPath)).toEqual(error(status, code, 'fixed failure'));
      f.setIdentityActive.mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
      expect(await f.dispatch('PATCH', statePath, { active: true })).toEqual(
        error(status, code, 'fixed failure'),
      );
    }
    f.listUserAccessProfiles.mockRejectedValueOnce(new Error('private fixture failure'));
    expect(await f.dispatch('GET', profilesPath)).toEqual(
      error(500, 'internal_error', 'Internal server error'),
    );
    f.setIdentityActive.mockRejectedValueOnce(new Error('private fixture failure'));
    expect(await f.dispatch('PATCH', statePath, { active: true })).toEqual(
      error(500, 'internal_error', 'Internal server error'),
    );
  });
  it.each([
    ['GET', profilesPath],
    ['PATCH', statePath],
    ['POST', profilesPath],
    ['GET', statePath],
  ])('requires a session before supported/unsupported %s %s', async (method, pathname) => {
    const f = fixture();
    expect(await f.dispatch(method, pathname, null, false)).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(f.authenticate).not.toHaveBeenCalled();
    expect(f.listUserAccessProfiles).not.toHaveBeenCalled();
    expect(f.setIdentityActive).not.toHaveBeenCalled();
  });
  it('preserves 401 when authentication rejects an expired session', async () => {
    const f = fixture();
    f.authenticate.mockResolvedValue(null);
    expect(await f.dispatch('PATCH', statePath, null)).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(f.authenticate).toHaveBeenCalledExactlyOnceWith('fixture-token');
    expect(f.setIdentityActive).not.toHaveBeenCalled();
  });
  it.each([
    ['POST', profilesPath],
    ['GET', statePath],
    ['PUT', statePath],
    ['PATCH', '/api/v1/identities/NOT-HEX/state'],
    ['PATCH', `${statePath}/`],
    ['GET', `${profilesPath}/bad`],
  ])('does not authorize/parse/mutate unsupported %s %s', async (method, pathname) => {
    const f = fixture([], 'none');
    expect(await f.dispatch(method, pathname, null)).toEqual(
      error(404, 'not_found', 'Route not found'),
    );
    expect(f.listUserAccessProfiles).not.toHaveBeenCalled();
    expect(f.setIdentityActive).not.toHaveBeenCalled();
  });
});
