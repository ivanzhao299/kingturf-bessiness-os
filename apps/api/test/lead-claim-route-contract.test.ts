// Fixed against 1257451's inline POST lead claim; no future route/helper imports.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

type Crm = NonNullable<ApiDependencies['crm']>;
type ClaimArgs = Parameters<Crm['claimLead']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: id };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const path = `/api/v1/leads/${id}/claim`;
const headerKey = '  claim.key!?  ';
const body = { expectedVersion: 7 };
const result = { id, version: 8, status: 'CLAIMED', title: 'repo lead', private: 'raw' };
function fixture(
  entries: readonly (readonly [PermissionKey, Grant])[] = [
    ['lead-pool:claim', grant],
    ['lead:read', grant],
    ['lead-pool:read', grant],
  ],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(entries),
    scopeAnchors: new Map(entries.map(([capability]) => [capability, anchors])),
  };
  const repository = {
    claimLead: vi.fn<(...args: ClaimArgs) => Promise<typeof result>>().mockResolvedValue(result),
    listLeads: vi.fn(),
    createLead: vi.fn(),
    transitionLead: vi.fn(),
    assign: vi.fn(),
    listCustomers: vi.fn(),
    createCustomer: vi.fn(),
    findCustomer: vi.fn(),
    customer360: vi.fn(),
    transitionCustomer: vi.fn(),
    createContact: vi.fn(),
    createActivity: vi.fn(),
  };
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(context),
    } as unknown as ApiDependencies['auth'],
    employees: {} as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
    ...(available ? { crm: repository as unknown as Crm } : {}),
  });
  const dispatch = (
    pathname: string,
    value: unknown,
    options: { method?: string; session?: boolean; key?: string | null } = {},
  ) =>
    app.dispatch({
      method: options.method ?? 'POST',
      pathname,
      body: value,
      query: { expectedVersion: 'bad', idempotencyKey: 'QUERY_KEY', leadId: 'bad' },
      headers: {
        authorization: options.session === false ? '' : 'Bearer fixture',
        'x-correlation-id': correlationId,
        ...(options.key === null ? {} : { 'idempotency-key': options.key ?? headerKey }),
      },
    });
  return { repository, dispatch };
}
const response = (statusCode: number, value: unknown) => ({
  statusCode,
  body: value,
  headers: {
    'x-correlation-id': correlationId,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'strict-origin-when-cross-origin',
  },
});
const error = (status: number, code: string, message: string) =>
  response(status, { error: { code, message, correlationId } });
const invalid = (message: string) => error(400, 'invalid_request', message);
const denied = error(403, 'forbidden', 'Permission denied');
const missing = error(404, 'not_found', 'Route not found');
const unavailable = error(503, 'internal_error', 'CRM dependency unavailable');
const keyError = invalid('Idempotency-Key is required and must be at most 128 characters');
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const mock of Object.values(f.repository)) expect(mock).not.toHaveBeenCalled();
};
const expectCall = (f: ReturnType<typeof fixture>, version = 7, key = headerKey) => {
  expect(f.repository.claimLead).toHaveBeenCalledExactlyOnceWith(
    id,
    version,
    actor,
    correlationId,
    key,
    ['TEAM'],
    anchors,
  );
  expect(f.repository.claimLead.mock.calls[0]).toHaveLength(7);
  expect(f.repository.claimLead.mock.contexts).toEqual([f.repository]);
  for (const [name, mock] of Object.entries(f.repository))
    if (name !== 'claimLead') expect(mock).not.toHaveBeenCalled();
};

describe('inline claim no-field authorization/header/body/UUID/version order', () => {
  it('seven args/receiver/A/C/rawheader/S/An,200 leadread projection; query ignored', async () => {
    const f = fixture();
    expect(await f.dispatch(path, body)).toEqual(response(200, result));
    expectCall(f);
  });
  it.each([
    { entries: [] },
    { entries: [['lead:assign', grant]] },
    { entries: [['lead-pool:read', grant]] },
    { entries: [['lead-pool:claim', { scopes: [], fields: null }]] },
  ] as const)(
    'capability/scope first before invalid header/body/UUID: $entries',
    async ({ entries }) => {
      const f = fixture(entries);
      expect(await f.dispatch(path.replace(id, 'bad'), null, { key: null })).toEqual(denied);
      noCalls(f);
    },
  );
  it.each([{ fields: [] }, { fields: ['unrelated'] }])(
    'claim requests no fields, finite $fields allowed',
    async ({ fields }) => {
      const f = fixture([['lead-pool:claim', { ...grant, fields }]]);
      expect(await f.dispatch(path, body)).toEqual(response(200, { id, version: 8 }));
      expectCall(f);
    },
  );
  it.each([{ key: null }, { key: '' }, { key: 'x'.repeat(129) }])(
    'header $key fails before body/allow/UUID/version, no body fallback',
    async ({ key }) => {
      const f = fixture();
      expect(await f.dispatch(path.replace(id, 'bad'), null, { key })).toEqual(keyError);
      expect(
        await f.dispatch(path, { expectedVersion: -1, idempotencyKey: 'BODY_KEY' }, { key }),
      ).toEqual(keyError);
      noCalls(f);
    },
  );
  it.each(['x', 'x'.repeat(128), ' ', ' '.repeat(128), '!?.raw-key'])(
    'header %j accepted raw, not trimmed or formatted',
    async (key) => {
      const f = fixture();
      expect(await f.dispatch(path, body, { key })).toEqual(response(200, result));
      expectCall(f, 7, key);
    },
  );
  it.each([
    { value: null },
    { value: undefined },
    { value: [] },
    { value: 'body' },
    { value: false },
  ])('valid header then object validation before UUID: $value', async ({ value }) => {
    const f = fixture();
    expect(await f.dispatch(path.replace(id, 'bad'), value)).toEqual(
      invalid('A JSON object body is required'),
    );
    noCalls(f);
  });
  it.each(['id', 'leadId', 'version', 'status', 'ownerId', 'idempotencyKey'])(
    'unknown/server field %s before UUID and EV',
    async (field) => {
      const f = fixture();
      expect(
        await f.dispatch(path.replace(id, 'bad'), { expectedVersion: -1, [field]: true }),
      ).toEqual(invalid(`Unsupported fields: ${field}`));
      noCalls(f);
    },
  );
  it('unknown sorted keys and UUID before expectedVersion; empty body has EV error', async () => {
    const f = fixture();
    expect(await f.dispatch(path, { z: 1, a: 2 })).toEqual(invalid('Unsupported fields: a, z'));
    expect(await f.dispatch(path.replace(id, 'bad'), {})).toEqual(invalid('leadId must be a UUID'));
    expect(await f.dispatch(path, {})).toEqual(
      invalid('expectedVersion must be a non-negative integer'),
    );
    noCalls(f);
  });
  it.each([0, Number.MAX_SAFE_INTEGER])(
    'original nonnegative safe version reaches mock: %j',
    async (expectedVersion) => {
      const f = fixture();
      expect(await f.dispatch(path, { expectedVersion })).toEqual(response(200, result));
      expectCall(f, expectedVersion);
    },
  );
  it.each([
    { value: undefined },
    { value: null },
    { value: false },
    { value: true },
    { value: -1 },
    { value: 0.5 },
    { value: '0' },
    { value: Number.MAX_SAFE_INTEGER + 1 },
    { value: NaN },
    { value: Infinity },
    { value: [] },
    { value: {} },
  ])('version rejects without coerce: $value', async ({ value }) => {
    const f = fixture();
    expect(await f.dispatch(path, { expectedVersion: value })).toEqual(
      invalid('expectedVersion must be a non-negative integer'),
    );
    noCalls(f);
  });
});

describe('inline claim independent response projection and error translation', () => {
  it.each([
    { fields: null, projected: result },
    { fields: [], projected: { id } },
    { fields: ['title'], projected: { id, title: result.title } },
  ])('leadread $fields projects200, not poolread', async ({ fields, projected }) => {
    const f = fixture([
      ['lead-pool:claim', grant],
      ['lead:read', { ...grant, fields }],
      ['lead-pool:read', grant],
    ]);
    expect(await f.dispatch(path, body)).toEqual(response(200, projected));
    expectCall(f);
  });
  it('missing leadread even with poolread full uses version fallback without read authorization', async () => {
    const f = fixture([
      ['lead-pool:claim', grant],
      ['lead-pool:read', grant],
    ]);
    expect(await f.dispatch(path, body)).toEqual(response(200, { id, version: 8 }));
    expectCall(f);
  });
  it.each([
    {
      thrown: new DomainError('conflict', 'Lead version is stale'),
      projected: error(409, 'conflict', 'Lead version is stale'),
    },
    {
      thrown: new DomainError('not_found', 'Lead not found'),
      projected: error(404, 'not_found', 'Lead not found'),
    },
    {
      thrown: new Error('private error'),
      projected: error(500, 'internal_error', 'Internal server error'),
    },
  ])('repository error unchanged envelope', async ({ thrown, projected }) => {
    const f = fixture();
    f.repository.claimLead.mockRejectedValue(thrown);
    expect(await f.dispatch(path, body)).toEqual(projected);
    expectCall(f);
  });
  it('two identical HTTP requests each forward to mock; same result is not PG replay proof', async () => {
    const f = fixture();
    expect(await f.dispatch(path, body)).toEqual(response(200, result));
    expect(await f.dispatch(path, body)).toEqual(response(200, result));
    expect(f.repository.claimLead.mock.calls).toEqual([
      [id, 7, actor, correlationId, headerKey, ['TEAM'], anchors],
      [id, 7, actor, correlationId, headerKey, ['TEAM'], anchors],
    ]);
    for (const [name, mock] of Object.entries(f.repository))
      if (name !== 'claimLead') expect(mock).not.toHaveBeenCalled();
  });
});

describe('inline claim supported-method dependency boundary and neighbors', () => {
  it('global401 before supported missing repo503 then cap/header/body', async () => {
    const f = fixture([], false);
    expect(await f.dispatch(path, null, { session: false, key: null })).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(await f.dispatch(path, null, { key: null })).toEqual(unavailable);
    noCalls(f);
  });
  it.each(['bad', '-', 'deadbeef', '360'])(
    'raw hex-like %s matches then cap/header/UUID; missing repo503 first',
    async (bad) => {
      const f = fixture();
      expect(await f.dispatch(path.replace(id, bad), {}, { key: null })).toEqual(keyError);
      expect(await f.dispatch(path.replace(id, bad), body)).toEqual(
        invalid('leadId must be a UUID'),
      );
      noCalls(f);
      const absent = fixture([], false);
      expect(await absent.dispatch(path.replace(id, bad), null, { key: null })).toEqual(
        unavailable,
      );
      noCalls(absent);
    },
  );
  it.each(['GET', 'PATCH', 'PUT', 'DELETE'])(
    'unsupported claim %s404 even missing repo without header/body preflight',
    async (method) => {
      for (const available of [true, false]) {
        const f = fixture([], available);
        expect(await f.dispatch(path, null, { method, key: null })).toEqual(missing);
        noCalls(f);
      }
    },
  );
  it.each([
    path.replace(id, id.toUpperCase()),
    path.replace(id, 'not-a-uuid'),
    `${path}/`,
    `${path}/extra`,
    '/api/v1/leads/claim',
    `/api/v1/leads/${id}`,
    `/api/v1/leads/${id}/unknown`,
    '/api/v1/leads/assign',
  ])('unmatched POST %s404 regardless repo', async (pathname) => {
    for (const available of [true, false]) {
      const f = fixture([], available);
      expect(await f.dispatch(pathname, null, { key: null })).toEqual(missing);
      noCalls(f);
    }
  });
  it.each([
    { pathname: '/api/v1/leads', method: 'GET' },
    { pathname: '/api/v1/leads', method: 'POST' },
    { pathname: '/api/v1/leads/pool', method: 'GET' },
    { pathname: `/api/v1/leads/${id}/transition`, method: 'POST' },
    { pathname: `/api/v1/leads/${id}/assign`, method: 'POST' },
    { pathname: `/api/v1/leads/${id}/reassign`, method: 'POST' },
    { pathname: `/api/v1/leads/${id}/release`, method: 'POST' },
  ])('neighbor $method $pathname keeps own capability and503', async ({ pathname, method }) => {
    const f = fixture([['lead-pool:claim', grant]]);
    expect(await f.dispatch(pathname, {}, { method })).toEqual(denied);
    noCalls(f);
    const absent = fixture([], false);
    expect(await absent.dispatch(pathname, null, { method })).toEqual(unavailable);
    noCalls(absent);
  });
  it('organization neighbor not claimed or given CRM503', async () => {
    for (const available of [true, false]) {
      const f = fixture([], available);
      expect(await f.dispatch('/api/v1/organizations', null, { method: 'GET' })).toEqual(denied);
      noCalls(f);
    }
  });
});
