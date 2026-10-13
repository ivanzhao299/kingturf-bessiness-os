// Fixed expectations from the two inline nested GET branches at f267e0c, before extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = '11111111-1111-4111-8111-111111111111';
const correlationId = '22222222-2222-4222-8222-222222222222';
const actor = { companyId: 'tenant', employeeId: 'actor' };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const ctrItem = { id: 'ctr-id', title: 'CTR', requirements: { fixed: true }, secret: 'private' };
const solutionItem = {
  id: 'solution-id',
  title: 'Solution',
  specification: { fixed: true },
  secret: 'private',
};
const cases = [
  {
    suffix: 'ctrs',
    capability: 'ctr:read',
    method: 'listCtrs',
    other: 'listTechnicalSolutions',
    item: ctrItem,
  },
  {
    suffix: 'technical-solutions',
    capability: 'technical-solution:read',
    method: 'listTechnicalSolutions',
    other: 'listCtrs',
    item: solutionItem,
  },
] as const;
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['ctr:read', grant],
    ['technical-solution:read', grant],
  ],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([key]) => [key, anchors])),
  };
  const repository = {
    listCtrs: vi.fn().mockResolvedValue([ctrItem]),
    listTechnicalSolutions: vi.fn().mockResolvedValue([solutionItem]),
  };
  const authenticate = vi.fn().mockResolvedValue(context);
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    employees: {} as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
    ...(available
      ? { commercial: repository as unknown as NonNullable<ApiDependencies['commercial']> }
      : {}),
  });
  const dispatch = (
    suffix: string,
    method = 'GET',
    body: unknown = null,
    itemId = id,
    session = true,
    path?: string,
  ) =>
    app.dispatch({
      method,
      pathname: path ?? `/api/v1/opportunities/${itemId}/${suffix}`,
      body,
      query: { page: 'invalid', pageSize: 'invalid', fields: 'secret' },
      headers: {
        authorization: session ? 'Bearer fixture' : '',
        'x-correlation-id': correlationId,
      },
    });
  return { context, repository, authenticate, dispatch };
}
const response = (statusCode: number, body: unknown) => ({
  statusCode,
  body,
  headers: { 'x-correlation-id': correlationId },
});
const error = (statusCode: number, code: string, message: string) =>
  response(statusCode, { error: { code, message, correlationId } });
const denied = error(403, 'forbidden', 'Permission denied');
const missing = error(404, 'not_found', 'Route not found');
const noCalls = (f: ReturnType<typeof fixture>) => {
  expect(f.repository.listCtrs).not.toHaveBeenCalled();
  expect(f.repository.listTechnicalSolutions).not.toHaveBeenCalled();
};

describe.each(cases)('inline nested GET $suffix contracts', (c) => {
  it('preserves exact actor/scopes/anchors, receiver and projected items without cross-calling', async () => {
    const f = fixture([[c.capability, grant]]);
    expect(await f.dispatch(c.suffix, 'GET', ['ignored'])).toEqual(
      response(200, { items: [c.item] }),
    );
    expect(f.repository[c.method]).toHaveBeenCalledExactlyOnceWith(id, actor, ['TEAM'], anchors);
    expect(f.repository[c.method].mock.contexts).toEqual([f.repository]);
    expect(f.repository[c.other]).not.toHaveBeenCalled();
  });
  it('does not introduce body or query parsing', async () => {
    for (const body of [null, 'invalid', { extra: true }]) {
      const f = fixture();
      expect(await f.dispatch(c.suffix, 'GET', body)).toEqual(response(200, { items: [c.item] }));
      expect(f.repository[c.method]).toHaveBeenCalledExactlyOnceWith(id, actor, ['TEAM'], anchors);
    }
  });
  it('requires its own read capability before UUID parsing', async () => {
    const f = fixture([
      ['authorization:read', grant],
      ['opportunity:read', grant],
    ]);
    expect(await f.dispatch(c.suffix, 'GET', null, 'bad')).toEqual(denied);
    noCalls(f);
    const allowed = fixture([[c.capability, grant]]);
    expect(await allowed.dispatch(c.suffix, 'GET', null, 'bad')).toEqual(
      error(400, 'invalid_request', 'opportunityId must be a UUID'),
    );
    noCalls(allowed);
  });
  it('rejects empty scopes before invalid UUID', async () => {
    const f = fixture([[c.capability, { scopes: [], fields: null }]]);
    expect(await f.dispatch(c.suffix, 'GET', null, 'bad')).toEqual(denied);
    noCalls(f);
  });
  it('permits read with limited or empty field allowlists without asking for fields', async () => {
    const f = fixture([[c.capability, { scopes: ['SELF'], fields: ['title'] }]]);
    expect(await f.dispatch(c.suffix)).toEqual(
      response(200, { items: [{ id: c.item.id, title: c.item.title }] }),
    );
    expect(f.repository[c.method]).toHaveBeenCalledExactlyOnceWith(id, actor, ['SELF'], anchors);
    const empty = fixture([[c.capability, { scopes: ['TEAM'], fields: [] }]]);
    expect(await empty.dispatch(c.suffix)).toEqual(response(200, { items: [{ id: c.item.id }] }));
    expect(empty.repository[c.method]).toHaveBeenCalledExactlyOnceWith(
      id,
      actor,
      ['TEAM'],
      anchors,
    );
  });
  it('with no commercial repository skips permission/body/UUID checks to 404', async () => {
    const f = fixture([], false);
    for (const itemId of [id, 'bad'])
      for (const body of [null, 'invalid'])
        expect(await f.dispatch(c.suffix, 'GET', body, itemId)).toEqual(missing);
    noCalls(f);
  });
  it('requires a session before missing dependency or invalid UUID', async () => {
    const f = fixture([], false);
    for (const method of ['GET', 'POST'])
      expect(await f.dispatch(c.suffix, method, null, 'bad', false)).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
    expect(f.authenticate).not.toHaveBeenCalled();
    noCalls(f);
  });
  it('keeps wrong methods outside read authorization and parsing', async () => {
    const f = fixture([]);
    for (const method of ['POST', 'PATCH', 'DELETE', 'OPTIONS'])
      expect(await f.dispatch(c.suffix, method, null, 'bad')).toEqual(missing);
    noCalls(f);
  });
  it('keeps trailing, uppercase and unmatched path boundaries', async () => {
    const f = fixture([]);
    for (const path of [
      `/api/v1/opportunities/${id}/${c.suffix}/`,
      `/api/v1/opportunities/NOT-HEX/${c.suffix}`,
      `/api/v1/opportunities/ABC/${c.suffix}`,
      `/api/v1/opportunities/${id}/${c.suffix}/extra`,
    ])
      expect(await f.dispatch(c.suffix, 'GET', null, id, true, path)).toEqual(missing);
    noCalls(f);
  });
  it('preserves empty item lists', async () => {
    const f = fixture();
    f.repository[c.method].mockResolvedValueOnce([]);
    expect(await f.dispatch(c.suffix)).toEqual(response(200, { items: [] }));
    expect(f.repository[c.method]).toHaveBeenCalledExactlyOnceWith(id, actor, ['TEAM'], anchors);
  });
  it('preserves domain error envelopes and internal exception redaction', async () => {
    const f = fixture();
    for (const [code, status] of [
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
      ['invalid_request', 400],
    ] as const) {
      f.repository[c.method].mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
      expect(await f.dispatch(c.suffix)).toEqual(error(status, code, 'fixed failure'));
    }
    f.repository[c.method].mockRejectedValueOnce(new Error('private fixture failure'));
    expect(await f.dispatch(c.suffix)).toEqual(
      error(500, 'internal_error', 'Internal server error'),
    );
    expect(f.repository[c.other]).not.toHaveBeenCalled();
  });
});
