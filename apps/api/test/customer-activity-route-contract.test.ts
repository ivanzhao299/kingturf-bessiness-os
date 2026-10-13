// Fixed expectations on 956ebda's inline customer activity POST, before extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const leadId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: id };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
type ActivityArgs = Parameters<NonNullable<ApiDependencies['crm']>['createActivity']>;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const headerKey = '  activity.key!?  ';
const path = `/api/v1/customers/${id}/activities`;
const details = { nested: { allowed: ['evidence', null, true, 7] }, arbitrary: ' unchanged ' };
const body = {
  leadId: ` ${leadId} `,
  type: ' OTHER_NEW_KIND ',
  occurredAt: ' 2026-10-13T01:00:00+08:00 ',
  summary: ' arbitrary summary ',
  details,
};
const input = {
  leadId,
  type: 'OTHER_NEW_KIND',
  occurredAt: '2026-10-12T17:00:00.000Z',
  summary: 'arbitrary summary',
  details,
};
const fields = ['leadId', 'type', 'occurredAt', 'summary', 'details'];
const result = { id, version: 1, customerId: id, summary: 'raw', private: 'raw', details };
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['customer-activity:create', grant],
    ['customer-activity:read', grant],
    ['customer:read', grant],
    ['customer:create', grant],
  ],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([capability]) => [capability, anchors])),
  };
  const repository = {
    createActivity: vi
      .fn<(...args: ActivityArgs) => Promise<typeof result>>()
      .mockResolvedValue(result),
    assign: vi.fn(),
    listCustomers: vi.fn().mockResolvedValue([result]),
    createCustomer: vi.fn().mockResolvedValue(result),
    findCustomer: vi.fn(),
    transitionCustomer: vi.fn(),
    createContact: vi.fn(),
    customer360: vi.fn(),
    listLeads: vi.fn(),
    createLead: vi.fn(),
    claimLead: vi.fn(),
    transitionLead: vi.fn(),
  };
  const authenticate = vi.fn().mockResolvedValue(context);
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    employees: {} as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
    ...(available ? { crm: repository as unknown as NonNullable<ApiDependencies['crm']> } : {}),
  });
  const dispatch = (
    pathname: string,
    value: unknown,
    options: { key?: string | null; method?: string; session?: boolean } = {},
  ) =>
    app.dispatch({
      method: options.method ?? 'POST',
      pathname,
      body: value,
      query: { type: 'CHANGED', leadId: 'bad', occurredAt: 'bad' },
      headers: {
        authorization: options.session === false ? '' : 'Bearer fixture',
        'x-correlation-id': correlationId,
        ...(options.key === null ? {} : { 'idempotency-key': options.key ?? headerKey }),
      },
    });
  return { repository, authenticate, dispatch };
}
const response = (statusCode: number, value: unknown) => ({
  statusCode,
  body: value,
  headers: { 'x-correlation-id': correlationId },
});
const error = (status: number, code: string, message: string) =>
  response(status, { error: { code, message, correlationId } });
const invalid = (message: string) => error(400, 'invalid_request', message);
const denied = error(403, 'forbidden', 'Permission denied');
const fieldDenied = error(403, 'forbidden', 'Field permission denied');
const missing = error(404, 'not_found', 'Route not found');
const unavailable = error(503, 'internal_error', 'CRM dependency unavailable');
const keyError = invalid('Idempotency-Key is required and must be at most 128 characters');
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const mock of Object.values(f.repository)) expect(mock).not.toHaveBeenCalled();
};
const expectCall = (f: ReturnType<typeof fixture>, expected: unknown = input, key = headerKey) => {
  expect(f.repository.createActivity).toHaveBeenCalledExactlyOnceWith(
    id,
    expected,
    actor,
    correlationId,
    key,
    ['TEAM'],
    anchors,
  );
};

describe('inline customer activity authorization/header/body order', () => {
  it('seven exact args, receiver, raw key, normalized values/details pointer, 201, query ignored', async () => {
    const f = fixture();
    expect(await f.dispatch(path, body)).toEqual(response(201, result));
    expectCall(f);
    expect(f.repository.createActivity.mock.contexts).toEqual([f.repository]);
    expect(f.repository.createActivity.mock.calls[0]?.[1].details).toBe(details);
    for (const [name, mock] of Object.entries(f.repository))
      if (name !== 'createActivity') expect(mock).not.toHaveBeenCalled();
  });
  it('missing/wrong capability and empty scopes precede header/body/UUID', async () => {
    for (const permissions of [
      [],
      [['customer:create', grant]],
      [['customer-activity:create', { scopes: [], fields: null }]],
    ] as const) {
      const f = fixture(permissions);
      expect(await f.dispatch(path.replace(id, 'bad'), null, { key: null })).toEqual(denied);
      noCalls(f);
    }
  });
  it('fixed all five fields requested even missing/defaulted values, before header/body', async () => {
    for (const field of fields) {
      const f = fixture([
        [
          'customer-activity:create',
          { scopes: ['TEAM'], fields: fields.filter((candidate) => candidate !== field) },
        ],
      ]);
      expect(
        await f.dispatch(path.replace(id, 'bad'), { ...body, [field]: undefined }, { key: null }),
      ).toEqual(fieldDenied);
      expect(await f.dispatch(path, null, { key: null })).toEqual(fieldDenied);
      noCalls(f);
    }
    const empty = fixture([['customer-activity:create', { scopes: ['TEAM'], fields: [] }]]);
    expect(await empty.dispatch(path, null, { key: null })).toEqual(fieldDenied);
    noCalls(empty);
    const finite = fixture([['customer-activity:create', { scopes: ['TEAM'], fields }]]);
    expect(await finite.dispatch(path, { ...body, leadId: undefined, details: undefined })).toEqual(
      response(201, { id, version: 1 }),
    );
    expectCall(finite, { ...input, leadId: null, details: {} });
  });
  it.each([null, '', 'x'.repeat(129)])(
    'key %j precedes body/allow/details/UUID, no body fallback',
    async (key) => {
      const f = fixture();
      expect(await f.dispatch(path.replace(id, 'bad'), null, { key })).toEqual(keyError);
      expect(
        await f.dispatch(path, { ...body, idempotencyKey: 'BODY_KEY', details: null }, { key }),
      ).toEqual(keyError);
      noCalls(f);
    },
  );
  it.each(['A', 'x'.repeat(128), ' ', '!?'])(
    'key %j accepted raw, no trim/stable-code format',
    async (key) => {
      const f = fixture();
      expect(await f.dispatch(path, body, { key })).toEqual(response(201, result));
      expectCall(f, input, key);
    },
  );
  it.each([null, [], false, 0, 'bad'])(
    'authorized valid-key body %j precedes UUID',
    async (value) => {
      const f = fixture();
      expect(await f.dispatch(path.replace(id, 'bad'), value)).toEqual(
        invalid('A JSON object body is required'),
      );
      noCalls(f);
    },
  );
  it('allow unknown/server/body-key fields after key but before details/path', async () => {
    const f = fixture();
    expect(
      await f.dispatch(path.replace(id, 'bad'), {
        ...body,
        details: null,
        idempotencyKey: 'A',
        actorId: id,
        expectedVersion: 1,
      }),
    ).toEqual(invalid('Unsupported fields: actorId, expectedVersion, idempotencyKey'));
    noCalls(f);
  });
});

describe('activity details and complete field sequence', () => {
  it.each([null, false, [], 0, '', 'text'])(
    'details %j generic object error before customer UUID',
    async (value) => {
      const f = fixture();
      expect(
        await f.dispatch(path.replace(id, 'bad'), {
          ...body,
          details: value,
          leadId: 'bad',
          type: '',
        }),
      ).toEqual(invalid('A JSON object body is required'));
      noCalls(f);
    },
  );
  it('details absent/undefined only defaults {}; arbitrary nested JSON unchanged', async () => {
    const f = fixture();
    const without = { leadId, type: 'ANY', occurredAt: '2026-10-13', summary: 'S' };
    for (const value of [
      without,
      { ...without, details: undefined },
      { ...without, details: {} },
    ]) {
      expect(await f.dispatch(path, value)).toEqual(response(201, result));
      expect(f.repository.createActivity).toHaveBeenLastCalledWith(
        id,
        { leadId, type: 'ANY', occurredAt: '2026-10-13T00:00:00.000Z', summary: 'S', details: {} },
        actor,
        correlationId,
        headerKey,
        ['TEAM'],
        anchors,
      );
    }
    expect(f.repository.createActivity).toHaveBeenCalledTimes(3);
    expect(await f.dispatch(path.replace(id, 'bad'), { ...body, details: undefined })).toEqual(
      invalid('customerId must be a UUID'),
    );
  });
  it.each([
    [
      path.replace(id, 'bad'),
      { leadId: 'bad', type: '', occurredAt: 'bad', summary: '' },
      'customerId must be a UUID',
    ],
    [path, { leadId: 'bad', type: '', occurredAt: 'bad', summary: '' }, 'leadId must be a UUID'],
    [path, { type: '', occurredAt: 'bad', summary: '' }, 'type is required'],
    [path, { occurredAt: 'bad', summary: '' }, 'occurredAt must be a valid timestamp'],
    [path, { summary: '' }, 'summary is required'],
  ])('customer→lead→type→time→summary first-error %s', async (pathname, changed, message) => {
    const f = fixture();
    expect(await f.dispatch(pathname, { ...body, ...changed })).toEqual(invalid(message));
    noCalls(f);
  });
  it.each([undefined, null])(
    'leadId %j alone becomes null, no relation precheck',
    async (value) => {
      const f = fixture();
      expect(await f.dispatch(path, { ...body, leadId: value })).toEqual(response(201, result));
      expectCall(f, { ...input, leadId: null });
    },
  );
  it.each([0, false, '', ' '])('leadId %j does not become null', async (value) => {
    const f = fixture();
    expect(await f.dispatch(path, { ...body, leadId: value })).toEqual(
      invalid('leadId is required'),
    );
    noCalls(f);
  });
  for (const field of ['type', 'summary']) {
    it.each([undefined, null, false, 0, '', ' '])(
      `${field} %j original required string`,
      async (value) => {
        const f = fixture();
        expect(await f.dispatch(path, { ...body, [field]: value })).toEqual(
          invalid(`${field} is required`),
        );
        noCalls(f);
      },
    );
  }
  it('type remains any nonempty string, not a new enum', async () => {
    const f = fixture();
    expect(await f.dispatch(path, { ...body, type: ' UNLISTED_TYPE! ' })).toEqual(
      response(201, result),
    );
    expectCall(f, { ...input, type: 'UNLISTED_TYPE!' });
  });
  it.each([undefined, null, false, 0, '', ' '])(
    'timestamp %j required before summary',
    async (value) => {
      const f = fixture();
      expect(await f.dispatch(path, { ...body, occurredAt: value, summary: '' })).toEqual(
        invalid('occurredAt is required'),
      );
      noCalls(f);
    },
  );
  it.each([
    [' 2026-10-13 ', '2026-10-13T00:00:00.000Z'],
    ['2026-02-30', '2026-03-02T00:00:00.000Z'],
  ])('broad Date %s retains original ISO normalization', async (value, normalized) => {
    const f = fixture();
    expect(await f.dispatch(path, { ...body, occurredAt: value })).toEqual(response(201, result));
    expectCall(f, { ...input, occurredAt: normalized });
  });
});

describe('activity DTO, wrapper and envelopes', () => {
  it('201 independent activity:read full/finite/empty/missing, no customer/360 substitution or new read authorization', async () => {
    for (const [read, dto] of [
      [grant, result],
      [
        { scopes: ['TEAM'], fields: ['summary'] },
        { id, summary: 'raw' },
      ],
      [{ scopes: ['TEAM'], fields: [] }, { id }],
      [undefined, { id, version: 1 }],
    ] as const) {
      const permissions: (readonly [PermissionKey, Grant])[] = [
        ['customer-activity:create', grant],
        ['customer:read', grant],
        ['customer-360:read', grant],
      ];
      if (read) permissions.push(['customer-activity:read', read]);
      const f = fixture(permissions);
      expect(await f.dispatch(path, body)).toEqual(response(201, dto));
      expectCall(f);
    }
  });
  it.each(['bad', '-', '360', 'deadbeef'])(
    'wide raw ID %s reaches UUID after header/body/details',
    async (value) => {
      const f = fixture();
      expect(await f.dispatch(path.replace(id, value), body)).toEqual(
        invalid('customerId must be a UUID'),
      );
      noCalls(f);
    },
  );
  it('no-ID activities remains base GET/POST alias, never activity/header preflight', async () => {
    const f = fixture();
    expect(
      await f.dispatch('/api/v1/customers/activities', null, { method: 'GET', key: null }),
    ).toEqual(response(200, { items: [result], nextCursor: null }));
    expect(
      await f.dispatch(
        '/api/v1/customers/activities',
        { name: 'N', customerNumber: 'C' },
        { key: null },
      ),
    ).toEqual(response(201, result));
    expect(f.repository.createCustomer).toHaveBeenCalledExactlyOnceWith(
      { name: 'N', customerNumber: 'C', tags: [] },
      actor,
      correlationId,
    );
    expect(f.repository.createActivity).not.toHaveBeenCalled();
  });
  it('global401 before matched503 without authenticating missing token', async () => {
    const f = fixture([], false);
    expect(await f.dispatch(path, null, { key: null, session: false })).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(f.authenticate).not.toHaveBeenCalled();
    noCalls(f);
  });
  it('wrapper missing repo503 precedes method/cap/header/body/UUID', async () => {
    const f = fixture([], false);
    for (const pathname of [path, path.replace(id, '360'), '/api/v1/customers/activities'])
      for (const method of ['POST', 'GET', 'PATCH', 'DELETE', 'OPTIONS'])
        expect(await f.dispatch(pathname, null, { key: null, method })).toEqual(unavailable);
    noCalls(f);
  });
  it('unsupported matched methods skip header/body; nonmatches404 even without CRM', async () => {
    const f = fixture([]);
    for (const method of ['GET', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])
      expect(await f.dispatch(path, null, { key: null, method })).toEqual(missing);
    noCalls(f);
    for (const available of [true, false]) {
      const other = fixture([], available);
      for (const pathname of [
        path.replace(id, id.toUpperCase()),
        path.replace(id, 'not-a-uuid'),
        path.toUpperCase(),
        path + '/',
        path + '/extra',
        path.replace('activities', 'unknown'),
      ])
        expect(await other.dispatch(pathname, null, { key: null })).toEqual(missing);
      noCalls(other);
    }
  });
  it('ownership/lifecycle/360/lead/organization preserve their own authorization, no activity call', async () => {
    const f = fixture([]);
    for (const [method, pathname] of [
      ['POST', `/api/v1/customers/${id}/ownership`],
      ['PATCH', `/api/v1/customers/${id}`],
      ['GET', `/api/v1/customers/${id}/360`],
      ['GET', '/api/v1/leads'],
      ['GET', '/api/v1/organizations'],
    ] as const)
      expect(await f.dispatch(pathname, {}, { key: null, method })).toEqual(denied);
    noCalls(f);
  });
  it('DomainError/internal global status/message/correlation envelopes', async () => {
    const f = fixture();
    for (const [code, status] of [
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
      ['invalid_request', 400],
    ] as const) {
      f.repository.createActivity.mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
      expect(await f.dispatch(path, body)).toEqual(error(status, code, 'fixed failure'));
    }
    f.repository.createActivity.mockRejectedValueOnce(new Error('private failure'));
    expect(await f.dispatch(path, body)).toEqual(
      error(500, 'internal_error', 'Internal server error'),
    );
  });
});
