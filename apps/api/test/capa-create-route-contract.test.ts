// Fixed expectations on 8c72ff4's inline CAPA creation, before extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = '11111111-1111-4111-8111-111111111111';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: 'actor' };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
const repositoryContext = { actor, scopes: ['TEAM'], anchors };
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const path = `/api/v1/ncrs/${id}/capas`;
const body = {
  capaNumber: ' CAPA_2026-1 ',
  ownerId: id,
  targetAt: ' 2026-10-13T01:00:00+08:00 ',
  riskLevel: ' MAJOR ',
  rootCauseSnapshot: { nested: ['cause'] },
  complaintExpectedVersion: 3,
  evidence: { original: ['evidence'] },
  idempotencyKey: ' CAPA_CREATE_1 ',
};
const input = {
  capaNumber: 'CAPA_2026-1',
  ncrId: id,
  ownerId: id,
  targetAt: '2026-10-12T17:00:00.000Z',
  riskLevel: 'MAJOR',
  rootCauseSnapshot: body.rootCauseSnapshot,
  complaintExpectedVersion: 3,
  evidence: body.evidence,
  idempotencyKey: 'CAPA_CREATE_1',
};
const result = { id, version: 4, state: 'OPEN', private: 'raw' };
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['capa:manage', grant],
    ['capa:read', grant],
  ],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([capability]) => [capability, anchors])),
  };
  const repository = {
    createCapa: vi.fn().mockResolvedValue(result),
    addCapaAction: vi.fn(),
    closeCapa: vi.fn(),
    verifyCapa: vi.fn(),
    createNcr: vi.fn(),
    transitionNcr: vi.fn(),
    transitionComplaint: vi.fn(),
    createComplaint: vi.fn(),
    batchTriage: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    listSlaPolicies: vi.fn(),
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
    value: unknown = body,
    options: { path?: string; method?: string; session?: boolean; key?: string } = {},
  ) =>
    app.dispatch({
      method: options.method ?? 'POST',
      pathname: options.path ?? path,
      body: value,
      query: { state: 'BAD', limit: 'bad' },
      headers: {
        authorization: options.session === false ? '' : 'Bearer fixture',
        'x-correlation-id': correlationId,
        ...(options.key === undefined ? {} : { 'idempotency-key': options.key }),
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
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const mock of Object.values(f.repository)) expect(mock).not.toHaveBeenCalled();
};

describe('inline CAPA creation route contracts', () => {
  it('preserves normalized input/order, receiver/R/C and 201, ignoring query without header', async () => {
    const f = fixture();
    expect(await f.dispatch()).toEqual(response(201, result));
    expect(f.repository.createCapa).toHaveBeenCalledExactlyOnceWith(
      input,
      repositoryContext,
      correlationId,
    );
    expect(f.repository.createCapa.mock.contexts).toEqual([f.repository]);
    expect(
      Object.keys(f.repository.createCapa.mock.calls[0]?.[0] as Record<string, unknown>),
    ).toEqual([
      'capaNumber',
      'ncrId',
      'ownerId',
      'targetAt',
      'riskLevel',
      'rootCauseSnapshot',
      'complaintExpectedVersion',
      'evidence',
      'idempotencyKey',
    ]);
    for (const [name, mock] of Object.entries(f.repository))
      if (name !== 'createCapa') expect(mock).not.toHaveBeenCalled();
  });
  it.each([null, [], false, 0, 'bad'])(
    'object body %j precedes allow/auth/risk/UUID',
    async (value) => {
      const f = fixture([]);
      expect(await f.dispatch(value, { path: '/api/v1/ncrs/bad/capas' })).toEqual(
        invalid('A JSON object body is required'),
      );
      noCalls(f);
    },
  );
  it('eight-field allow precedes management, then fields/scopes precede risk/number/path', async () => {
    const absent = fixture([]);
    expect(await absent.dispatch({ ...body, z: true, a: true, riskLevel: '' })).toEqual(
      invalid('Unsupported fields: a, z'),
    );
    expect(await absent.dispatch({ ...body, riskLevel: '' })).toEqual(denied);
    expect(await absent.dispatch({})).toEqual(denied);
    noCalls(absent);
    for (const write of [
      { scopes: ['TEAM'], fields: [] },
      { scopes: [], fields: null },
    ] as const) {
      const f = fixture([['capa:manage', write]]);
      expect(await f.dispatch({ ...body, riskLevel: '' })).toEqual(
        write.fields === null ? denied : fieldDenied,
      );
      noCalls(f);
    }
    const finite = fixture([['capa:manage', { scopes: ['TEAM'], fields: Object.keys(body) }]]);
    expect(await finite.dispatch()).toEqual(response(201, { id, version: 4 }));
    expect(await fixture().dispatch({})).toEqual(invalid('riskLevel is required'));
    expect(await fixture().dispatch({ ...body, ncrId: id, state: 'OPEN' })).toEqual(
      invalid('Unsupported fields: ncrId, state'),
    );
  });
  it.each([undefined, null])(
    'undefined/null field key %j still participates in field grants',
    async (rootCauseSnapshot) => {
      const f = fixture([
        [
          'capa:manage',
          {
            scopes: ['TEAM'],
            fields: Object.keys(body).filter((key) => key !== 'rootCauseSnapshot'),
          },
        ],
      ]);
      expect(await f.dispatch({ ...body, rootCauseSnapshot })).toEqual(fieldDenied);
      noCalls(f);
    },
  );
  it.each(['LOW', 'MEDIUM', 'MAJOR', 'CRITICAL'])('risk %s accepts trim', async (riskLevel) => {
    const f = fixture();
    expect(await f.dispatch({ ...body, riskLevel: ` ${riskLevel} ` })).toEqual(
      response(201, result),
    );
    expect(f.repository.createCapa).toHaveBeenCalledExactlyOnceWith(
      { ...input, riskLevel },
      repositoryContext,
      correlationId,
    );
  });
  it.each([
    [undefined, 'riskLevel is required'],
    ['', 'riskLevel is required'],
    [true, 'riskLevel is required'],
    ['major', 'riskLevel is unsupported'],
    ['BAD', 'riskLevel is unsupported'],
  ])('risk %j parses before bad number/path/owner', async (riskLevel, message) => {
    const f = fixture();
    expect(
      await f.dispatch(
        { ...body, riskLevel, capaNumber: '', ownerId: 'bad' },
        { path: '/api/v1/ncrs/bad/capas' },
      ),
    ).toEqual(invalid(message));
    noCalls(f);
  });
  it.each([
    ['', 'capaNumber is required'],
    ['lower', 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen'],
  ])('number %j still precedes path UUID after valid risk', async (capaNumber, message) => {
    const f = fixture();
    expect(
      await f.dispatch({ ...body, capaNumber, ownerId: 'bad' }, { path: '/api/v1/ncrs/bad/capas' }),
    ).toEqual(invalid(message));
    noCalls(f);
  });
  it('valid risk/number lead to path UUID before owner and target', async () => {
    const f = fixture();
    expect(
      await f.dispatch(
        { ...body, ownerId: 'bad', targetAt: 'bad' },
        { path: '/api/v1/ncrs/bad/capas' },
      ),
    ).toEqual(invalid('ncrId must be a UUID'));
    noCalls(f);
  });
  it.each([
    [{ ownerId: 'bad', targetAt: 'bad' }, 'ownerId must be a UUID'],
    [{ targetAt: 'bad', rootCauseSnapshot: null }, 'targetAt must be a valid timestamp'],
    [
      { rootCauseSnapshot: null, complaintExpectedVersion: 0 },
      'rootCauseSnapshot must be a JSON object',
    ],
    [
      { complaintExpectedVersion: 0, evidence: false },
      'complaintExpectedVersion must be an integer between 1 and 1000000',
    ],
    [{ evidence: false, idempotencyKey: '' }, 'evidence must be a JSON object'],
    [{ idempotencyKey: '' }, 'idempotencyKey is required'],
    [
      { idempotencyKey: 'lower' },
      'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    ],
  ])('remaining input first-error priority %j', async (changed, message) => {
    const f = fixture();
    expect(await f.dispatch({ ...body, ...changed })).toEqual(invalid(message));
    noCalls(f);
  });
  it('timestamp retains broad Date parsing and normalization', async () => {
    const f = fixture();
    expect(await f.dispatch({ ...body, targetAt: ' 2026-10-13 ', rootCauseSnapshot: {} })).toEqual(
      response(201, result),
    );
    expect(f.repository.createCapa).toHaveBeenCalledExactlyOnceWith(
      { ...input, targetAt: '2026-10-13T00:00:00.000Z', rootCauseSnapshot: {} },
      repositoryContext,
      correlationId,
    );
  });
  it.each([undefined, null, '', 0])('targetAt %j is required', async (targetAt) => {
    const f = fixture();
    expect(await f.dispatch({ ...body, targetAt })).toEqual(invalid('targetAt is required'));
    noCalls(f);
  });
  it.each([undefined, null, [], 'bad', false, 0])(
    'snapshot %j is mandatory JSON, not default',
    async (rootCauseSnapshot) => {
      const f = fixture();
      expect(await f.dispatch({ ...body, rootCauseSnapshot })).toEqual(
        invalid('rootCauseSnapshot must be a JSON object'),
      );
      noCalls(f);
    },
  );
  it.each([0, '1', 1.5, 1000001, undefined])(
    'version %j retains original body number bounds',
    async (complaintExpectedVersion) => {
      const f = fixture();
      expect(await f.dispatch({ ...body, complaintExpectedVersion })).toEqual(
        invalid('complaintExpectedVersion must be an integer between 1 and 1000000'),
      );
      noCalls(f);
    },
  );
  it.each([1, 1000000])('version boundary %j accepted', async (complaintExpectedVersion) => {
    const f = fixture();
    expect(await f.dispatch({ ...body, complaintExpectedVersion })).toEqual(response(201, result));
    expect(f.repository.createCapa).toHaveBeenCalledExactlyOnceWith(
      { ...input, complaintExpectedVersion },
      repositoryContext,
      correlationId,
    );
  });
  it.each([undefined, null])('evidence %j defaults to {}', async (evidence) => {
    const f = fixture();
    expect(await f.dispatch({ ...body, evidence })).toEqual(response(201, result));
    expect(f.repository.createCapa).toHaveBeenCalledExactlyOnceWith(
      { ...input, evidence: {} },
      repositoryContext,
      correlationId,
    );
  });
  it.each([false, [], '', 0])(
    'evidence %j retains JSON error instead of default',
    async (evidence) => {
      const f = fixture();
      expect(await f.dispatch({ ...body, evidence })).toEqual(
        invalid('evidence must be a JSON object'),
      );
      noCalls(f);
    },
  );
  it.each(['capaNumber', 'idempotencyKey'] as const)(
    '%s keeps trim/1/64 and format boundary',
    async (field) => {
      const f = fixture();
      for (const value of ['A', 'A'.repeat(64)]) {
        expect(await f.dispatch({ ...body, [field]: ` ${value} ` })).toEqual(response(201, result));
        expect(f.repository.createCapa).toHaveBeenLastCalledWith(
          { ...input, [field]: value },
          repositoryContext,
          correlationId,
        );
      }
      for (const value of ['A'.repeat(65), '1START', 'A!?'])
        expect(await f.dispatch({ ...body, [field]: value })).toEqual(
          invalid('Code must be 1-64 uppercase letters, digits, underscore, or hyphen'),
        );
      expect(f.repository.createCapa).toHaveBeenCalledTimes(2);
    },
  );
  it.each(['', 'x'.repeat(129), 'bad!?'])(
    'header %j ignored and never body-key fallback',
    async (key) => {
      const f = fixture();
      expect(await f.dispatch(body, { key })).toEqual(response(201, result));
      expect(await f.dispatch({ ...body, idempotencyKey: undefined }, { key })).toEqual(
        invalid('idempotencyKey is required'),
      );
      expect(f.repository.createCapa).toHaveBeenCalledOnce();
    },
  );
  it('201 independent capa:read full/finite/empty/missing ignores wrong read grants', async () => {
    for (const [read, dto] of [
      [grant, result],
      [
        { scopes: ['TEAM'], fields: ['state'] },
        { id, state: 'OPEN' },
      ],
      [{ scopes: ['TEAM'], fields: [] }, { id }],
      [undefined, { id, version: 4 }],
    ] as const) {
      const permissions: (readonly [PermissionKey, Grant])[] = [
        ['capa:manage', grant],
        ['ncr:read', grant],
        ['complaint:read', grant],
      ];
      if (read) permissions.push(['capa:read', read]);
      expect(await fixture(permissions).dispatch()).toEqual(response(201, dto));
    }
    const wrong = fixture([
      ['ncr:manage', grant],
      ['capa:read', grant],
    ]);
    expect(await wrong.dispatch()).toEqual(denied);
    noCalls(wrong);
  });
  it('global401 and absent repo404 precede all validation', async () => {
    const absent = fixture([], false);
    expect(await absent.dispatch(null, { path: '/api/v1/ncrs/bad/capas' })).toEqual(missing);
    expect(await absent.dispatch({ unknown: true })).toEqual(missing);
    expect(await absent.dispatch(null, { session: false })).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(absent.authenticate).toHaveBeenCalledTimes(2);
    noCalls(absent);
    const f = fixture();
    expect(await f.dispatch(null, { session: false })).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(f.authenticate).not.toHaveBeenCalled();
    noCalls(f);
  });
  it('wide regex/case/method and neighbouring routes are not swallowed', async () => {
    const f = fixture([]);
    for (const pathname of [
      '/api/v1/ncrs/not-a-uuid/capas',
      '/api/v1/ncrs/AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA/capas',
      `${path}/`,
      path.toUpperCase(),
      `${path}/unknown`,
    ])
      expect(await f.dispatch(null, { path: pathname })).toEqual(missing);
    for (const method of ['GET', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])
      expect(await f.dispatch(null, { method })).toEqual(missing);
    expect(await f.dispatch({}, { path: `/api/v1/ncrs/${id}/contain` })).toEqual(denied);
    expect(await f.dispatch({}, { path: `/api/v1/complaints/${id}/ncrs` })).toEqual(denied);
    expect(await f.dispatch({}, { path: `/api/v1/capas/${id}/actions` })).toEqual(denied);
    expect(await f.dispatch({}, { path: `/api/v1/capas/${id}/close` })).toEqual(denied);
    expect(await f.dispatch({}, { path: `/api/v1/capas/${id}/verify` })).toEqual(denied);
    noCalls(f);
  });
  it('DomainError/internal envelopes preserve global status/message/correlation', async () => {
    const f = fixture();
    for (const [code, status] of [
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
      ['invalid_request', 400],
    ] as const) {
      f.repository.createCapa.mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
      expect(await f.dispatch()).toEqual(error(status, code, 'fixed failure'));
    }
    f.repository.createCapa.mockRejectedValueOnce(new Error('private fixture failure'));
    expect(await f.dispatch()).toEqual(error(500, 'internal_error', 'Internal server error'));
  });
});
