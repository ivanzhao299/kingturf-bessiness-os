// Fixed expectations on 17f1088's inline complaint GET routes, before extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = '11111111-1111-4111-8111-111111111111';
const cursor = '22222222-2222-4222-8222-222222222222';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: 'actor' };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
const repositoryContext = { actor, scopes: ['TEAM'], anchors };
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const path = '/api/v1/complaints';
const item = { id, version: 2, description: 'visible', private: 'raw' };
const page = { items: [item], nextCursor: cursor };
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [['complaint:read', grant]],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([capability]) => [capability, anchors])),
  };
  const repository = {
    list: vi.fn().mockResolvedValue(page),
    getById: vi.fn().mockResolvedValue(item),
    listSlaPolicies: vi.fn().mockResolvedValue([]),
    createComplaint: vi.fn(),
    batchTriage: vi.fn(),
    transitionComplaint: vi.fn(),
  };
  const authenticate = vi.fn().mockResolvedValue(context);
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    employees: {} as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
    ...(available
      ? { complaints: repository as unknown as NonNullable<ApiDependencies['complaints']> }
      : {}),
  });
  const dispatch = (
    pathname = path,
    query?: Record<string, string>,
    options: { method?: string; body?: unknown; session?: boolean } = {},
  ) =>
    app.dispatch({
      method: options.method ?? 'GET',
      pathname,
      ...(query === undefined ? {} : { query }),
      body: options.body ?? 'malformed body',
      headers: {
        authorization: options.session === false ? '' : 'Bearer fixture',
        'x-correlation-id': correlationId,
        'idempotency-key': 'x'.repeat(129),
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
const missing = error(404, 'not_found', 'Route not found');
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const mock of Object.values(f.repository)) expect(mock).not.toHaveBeenCalled();
};

describe('inline complaint read route contracts', () => {
  it('list defaults query, preserves receiver/R and only two args, raw nextCursor and body/header ignore', async () => {
    const f = fixture();
    expect(await f.dispatch()).toEqual(response(200, page));
    expect(f.repository.list).toHaveBeenCalledExactlyOnceWith({ limit: 50 }, repositoryContext);
    expect(f.repository.list.mock.contexts).toEqual([f.repository]);
    expect(f.repository.getById).not.toHaveBeenCalled();
  });
  it('list preserves full filter/order, timestamp normalization, false and unknown-query ignore', async () => {
    const f = fixture();
    expect(
      await f.dispatch(path, {
        limit: '0x10',
        cursor: ` ${cursor} `,
        query: ' turf ',
        state: 'NCR_OPEN',
        severity: 'MAJOR',
        assignedTo: id,
        customerId: cursor,
        salesOrderId: id,
        inventoryLotId: cursor,
        createdFrom: ' 2026-10-14 ',
        createdTo: '2026-10-13T01:00:00+08:00',
        overdue: 'false',
        ignored: 'invalid',
      }),
    ).toEqual(response(200, page));
    const filter = {
      limit: 16,
      cursor,
      query: 'turf',
      state: 'NCR_OPEN',
      severity: 'MAJOR',
      assignedTo: id,
      customerId: cursor,
      salesOrderId: id,
      inventoryLotId: cursor,
      createdFrom: '2026-10-14T00:00:00.000Z',
      createdTo: '2026-10-12T17:00:00.000Z',
      overdue: false,
    };
    expect(f.repository.list).toHaveBeenCalledExactlyOnceWith(filter, repositoryContext);
    expect(Object.keys(f.repository.list.mock.calls[0]?.[0] as Record<string, unknown>)).toEqual([
      'limit',
      'cursor',
      'query',
      'state',
      'severity',
      'assignedTo',
      'customerId',
      'salesOrderId',
      'inventoryLotId',
      'createdFrom',
      'createdTo',
      'overdue',
    ]);
  });
  it('all empty query strings are omitted and limit defaults, unknown keys ignored', async () => {
    const f = fixture();
    expect(
      await f.dispatch(path, {
        limit: '',
        cursor: '',
        query: '',
        state: '',
        severity: '',
        assignedTo: '',
        customerId: '',
        salesOrderId: '',
        inventoryLotId: '',
        createdFrom: '',
        createdTo: '',
        overdue: '',
        extra: 'bad',
      }),
    ).toEqual(response(200, page));
    expect(f.repository.list).toHaveBeenCalledExactlyOnceWith({ limit: 50 }, repositoryContext);
  });
  it.each([
    ['1', 1],
    ['100', 100],
    ['1e2', 100],
    ['0x10', 16],
    ['5.0', 5],
    [' 5 ', 5],
    ['+5', 5],
    ['', 50],
  ])('limit %j keeps Number/truthy semantics → %j', async (limit, parsed) => {
    const f = fixture();
    expect(await f.dispatch(path, { limit })).toEqual(response(200, page));
    expect(f.repository.list).toHaveBeenCalledExactlyOnceWith({ limit: parsed }, repositoryContext);
  });
  it.each([' ', '0', '101', '-1', '1.5', 'Infinity', 'NaN', 'bad', '1e3'])(
    'limit %j fails original integer bounds',
    async (limit) => {
      const f = fixture();
      expect(await f.dispatch(path, { limit })).toEqual(
        invalid('limit must be an integer between 1 and 100'),
      );
      noCalls(f);
    },
  );
  it.each([
    'REPORTED',
    'TRIAGED',
    'INVESTIGATING',
    'NCR_OPEN',
    'CAPA_ACTIVE',
    'VERIFIED',
    'CLOSED',
    'REJECTED',
  ])('state %s passes unchanged', async (state) => {
    const f = fixture();
    expect(await f.dispatch(path, { state })).toEqual(response(200, page));
    expect(f.repository.list).toHaveBeenCalledExactlyOnceWith(
      { limit: 50, state },
      repositoryContext,
    );
  });
  it.each(['LOW', 'MEDIUM', 'MAJOR', 'CRITICAL'])(
    'severity %s passes unchanged',
    async (severity) => {
      const f = fixture();
      expect(await f.dispatch(path, { severity })).toEqual(response(200, page));
      expect(f.repository.list).toHaveBeenCalledExactlyOnceWith(
        { limit: 50, severity },
        repositoryContext,
      );
    },
  );
  it.each(['reported', ' REPORTED ', 'BAD', ' '])(
    'state %j is not trimmed/coerced',
    async (state) => {
      const f = fixture();
      expect(await f.dispatch(path, { state })).toEqual(invalid('state is unsupported'));
      noCalls(f);
    },
  );
  it.each(['major', ' MAJOR ', 'BAD', ' '])(
    'severity %j is not trimmed/coerced',
    async (severity) => {
      const f = fixture();
      expect(await f.dispatch(path, { severity })).toEqual(invalid('severity is unsupported'));
      noCalls(f);
    },
  );
  it.each([
    ['true', true],
    ['false', false],
  ])('overdue %s passes boolean %j', async (overdue, parsed) => {
    const f = fixture();
    expect(await f.dispatch(path, { overdue })).toEqual(response(200, page));
    expect(f.repository.list).toHaveBeenCalledExactlyOnceWith(
      { limit: 50, overdue: parsed },
      repositoryContext,
    );
  });
  it.each(['TRUE', ' true ', '0', ' '])('overdue %j fails without trim', async (overdue) => {
    const f = fixture();
    expect(await f.dispatch(path, { overdue })).toEqual(invalid('overdue must be true or false'));
    noCalls(f);
  });
  it.each([
    [{ state: 'BAD', severity: 'BAD', overdue: 'BAD', limit: 'bad' }, 'state is unsupported'],
    [{ severity: 'BAD', overdue: 'BAD', limit: 'bad' }, 'severity is unsupported'],
    [{ overdue: 'BAD', limit: 'bad', cursor: 'bad' }, 'overdue must be true or false'],
    [{ limit: 'bad', cursor: 'bad', query: ' ' }, 'limit must be an integer between 1 and 100'],
    [{ cursor: 'bad', query: ' ', assignedTo: 'bad' }, 'cursor must be a UUID'],
    [{ query: ' ', assignedTo: 'bad', customerId: 'bad' }, 'query is required'],
    [{ assignedTo: 'bad', customerId: 'bad' }, 'assignedTo must be a UUID'],
    [{ customerId: 'bad', salesOrderId: 'bad' }, 'customerId must be a UUID'],
    [{ salesOrderId: 'bad', inventoryLotId: 'bad' }, 'salesOrderId must be a UUID'],
    [{ inventoryLotId: 'bad', createdFrom: 'bad' }, 'inventoryLotId must be a UUID'],
    [{ createdFrom: 'bad', createdTo: 'bad' }, 'createdFrom must be a valid timestamp'],
    [{ createdTo: 'bad' }, 'createdTo must be a valid timestamp'],
  ] as const)('list first-error priority %j', async (query, message) => {
    const f = fixture();
    expect(await f.dispatch(path, query)).toEqual(invalid(message));
    noCalls(f);
  });
  it('detail keeps auth-before-UUID, wide regex and ignores query/body/header', async () => {
    const f = fixture();
    expect(await f.dispatch(`${path}/${id}`, { state: 'BAD', limit: 'bad' })).toEqual(
      response(200, item),
    );
    expect(f.repository.getById).toHaveBeenCalledExactlyOnceWith(id, repositoryContext);
    expect(f.repository.getById.mock.contexts).toEqual([f.repository]);
    expect(f.repository.list).not.toHaveBeenCalled();
    expect(await f.dispatch(`${path}/bad`)).toEqual(invalid('complaintId must be a UUID'));
    const absent = fixture([]);
    expect(await absent.dispatch(`${path}/bad`)).toEqual(denied);
    expect(await absent.dispatch(`${path}/not-a-uuid`)).toEqual(missing);
    noCalls(absent);
  });
  it.each([path, `${path}/${id}`])(
    '%s read needs capability/scopes but no requested fields',
    async (pathname) => {
      for (const permissions of [[], [['complaint:read', { scopes: [], fields: null }]]] as const) {
        const f = fixture(permissions);
        expect(await f.dispatch(pathname, { state: 'BAD' })).toEqual(denied);
        noCalls(f);
      }
      const empty = fixture([['complaint:read', { scopes: ['TEAM'], fields: [] }]]);
      expect(await empty.dispatch(pathname)).toEqual(
        response(200, pathname === path ? { items: [{ id }], nextCursor: cursor } : { id }),
      );
    },
  );
  it.each([path, `${path}/${id}`])(
    '%s limited/full projection retains id and independent read fields',
    async (pathname) => {
      for (const [read, dto] of [
        [
          { scopes: ['TEAM'], fields: ['description'] },
          { id, description: 'visible' },
        ],
        [grant, item],
      ] as const) {
        const f = fixture([['complaint:read', read]]);
        expect(await f.dispatch(pathname)).toEqual(
          response(200, pathname === path ? { items: [dto], nextCursor: cursor } : dto),
        );
      }
    },
  );
  it('empty pages, next page and undefined cursor are not synthesized or normalized', async () => {
    const f = fixture();
    for (const nextCursor of [null, '', undefined, 'raw-not-a-uuid']) {
      f.repository.list.mockResolvedValueOnce({ items: [], nextCursor });
      expect(await f.dispatch()).toEqual(response(200, { items: [], nextCursor }));
    }
    expect(await f.dispatch(path, { cursor })).toEqual(response(200, page));
    expect(f.repository.list).toHaveBeenLastCalledWith({ limit: 50, cursor }, repositoryContext);
  });
  it.each([path, `${path}/bad`])(
    '%s missing repo skips all validation and session stays first',
    async (pathname) => {
      const f = fixture([], false);
      expect(await f.dispatch(pathname, { state: 'BAD', limit: 'bad' })).toEqual(missing);
      expect(await f.dispatch(pathname, {}, { session: false })).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
      expect(f.authenticate).toHaveBeenCalledOnce();
      noCalls(f);
    },
  );
  it('global session precedes invalid list filters and invalid detail UUID', async () => {
    const f = fixture();
    for (const pathname of [path, `${path}/bad`])
      expect(await f.dispatch(pathname, { state: 'BAD' }, { session: false })).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
    expect(f.authenticate).not.toHaveBeenCalled();
    noCalls(f);
  });
  it('unsupported paths/methods and neighbours are not swallowed by reads', async () => {
    const f = fixture([]);
    for (const pathname of [
      `${path}/`,
      `${path}/${id}/`,
      path.toUpperCase(),
      `${path}/AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA`,
      `${path}/batch-triage`,
      `${path}/${id}/triage`,
      `${path}/not-a-uuid`,
    ])
      expect(await f.dispatch(pathname)).toEqual(missing);
    for (const method of ['PATCH', 'DELETE', 'OPTIONS', 'HEAD'])
      expect(await f.dispatch(path, {}, { method })).toEqual(missing);
    expect(await f.dispatch(path, {}, { method: 'POST', body: [] })).toEqual(
      invalid('A JSON object body is required'),
    );
    expect(await f.dispatch(`${path}/batch-triage`, {}, { method: 'POST', body: {} })).toEqual(
      denied,
    );
    expect(await f.dispatch(`${path}/${id}/triage`, {}, { method: 'POST', body: {} })).toEqual(
      denied,
    );
    expect(await f.dispatch('/api/v1/complaint-sla-policies')).toEqual(denied);
    noCalls(f);
  });
  it.each([path, `${path}/${id}`])(
    '%s keeps repository DomainError/internal envelopes and correlation',
    async (pathname) => {
      const f = fixture();
      const mock = pathname === path ? f.repository.list : f.repository.getById;
      for (const [code, status] of [
        ['forbidden', 403],
        ['not_found', 404],
        ['conflict', 409],
        ['invalid_request', 400],
      ] as const) {
        mock.mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
        expect(await f.dispatch(pathname)).toEqual(error(status, code, 'fixed failure'));
      }
      mock.mockRejectedValueOnce(new Error('private fixture failure'));
      expect(await f.dispatch(pathname)).toEqual(
        error(500, 'internal_error', 'Internal server error'),
      );
    },
  );
});
