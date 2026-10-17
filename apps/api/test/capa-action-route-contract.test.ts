// Fixed expectations on f751736's two inline CAPA action routes, before extraction.
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
const addPath = `/api/v1/capas/${id}/actions`;
const completePath = `/api/v1/capa-actions/${id}/complete`;
const addBody = {
  actionType: ' CORRECTIVE ',
  description: ' fixed action ',
  ownerId: id,
  dueAt: ' 2026-10-13T01:00:00+08:00 ',
  expectedVersion: 3,
  idempotencyKey: ' ACTION_1 ',
};
const addInput = {
  actionType: 'CORRECTIVE',
  description: 'fixed action',
  ownerId: id,
  dueAt: '2026-10-12T17:00:00.000Z',
  expectedVersion: 3,
  idempotencyKey: 'ACTION_1',
};
const completeBody = {
  completedAt: ' 2026-10-13T01:00:00+08:00 ',
  evidence: { original: ['evidence'] },
  expectedCapaVersion: 3,
  idempotencyKey: ' COMPLETE_1 ',
};
const completeInput = {
  completedAt: '2026-10-12T17:00:00.000Z',
  evidence: completeBody.evidence,
  expectedCapaVersion: 3,
  idempotencyKey: 'COMPLETE_1',
};
const result = { id, version: 4, state: 'repo-state', private: 'raw' };
const operations = [
  {
    name: 'add',
    path: addPath,
    method: 'addCapaAction',
    body: addBody,
    input: addInput,
    time: 'dueAt',
    version: 'expectedVersion',
    protectedField: 'ownerId',
  },
  {
    name: 'complete',
    path: completePath,
    method: 'completeCapaAction',
    body: completeBody,
    input: completeInput,
    time: 'completedAt',
    version: 'expectedCapaVersion',
    protectedField: 'evidence',
  },
] as const;
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
    addCapaAction: vi.fn().mockResolvedValue(result),
    completeCapaAction: vi.fn().mockResolvedValue(result),
    createCapa: vi.fn(),
    closeCapa: vi.fn(),
    verifyCapa: vi.fn(),
    createNcr: vi.fn(),
    transitionNcr: vi.fn(),
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
    pathname: string,
    value: unknown,
    options: { method?: string; key?: string; session?: boolean } = {},
  ) =>
    app.dispatch({
      method: options.method ?? 'POST',
      pathname,
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
const fieldDenied = error(403, 'forbidden', 'Field permission denied');
const missing = error(404, 'not_found', 'Route not found');
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const mock of Object.values(f.repository)) expect(mock).not.toHaveBeenCalled();
};

for (const op of operations) {
  describe(`inline CAPA action ${op.name} contracts`, () => {
    it('preserves exact normalized id/input/R/C/receiver/one call/201 and ignores query/no header', async () => {
      const f = fixture();
      expect(await f.dispatch(op.path, op.body)).toEqual(response(201, result));
      expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(
        id,
        op.input,
        repositoryContext,
        correlationId,
      );
      expect(f.repository[op.method].mock.contexts).toEqual([f.repository]);
      for (const [name, mock] of Object.entries(f.repository))
        if (name !== op.method) expect(mock).not.toHaveBeenCalled();
    });
    it.each([null, [], false, 0, 'bad'])('body %j precedes allow/auth/path', async (value) => {
      const f = fixture([]);
      expect(await f.dispatch(op.path.replace(id, 'bad'), value)).toEqual(
        invalid('A JSON object body is required'),
      );
      noCalls(f);
    });
    it('route-specific allow precedes manage/fields/scopes authorization and all parsers', async () => {
      const absent = fixture([]);
      expect(
        await absent.dispatch(op.path.replace(id, 'bad'), { ...op.body, z: true, a: true }),
      ).toEqual(invalid('Unsupported fields: a, z'));
      expect(await absent.dispatch(op.path.replace(id, 'bad'), {})).toEqual(denied);
      noCalls(absent);
      for (const write of [
        { scopes: ['TEAM'], fields: [] },
        { scopes: [], fields: null },
      ] as const) {
        const f = fixture([['capa:manage', write]]);
        expect(await f.dispatch(op.path.replace(id, 'bad'), op.body)).toEqual(
          write.fields === null ? denied : fieldDenied,
        );
        noCalls(f);
      }
      const finite = fixture([['capa:manage', { scopes: ['TEAM'], fields: Object.keys(op.body) }]]);
      expect(await finite.dispatch(op.path, op.body)).toEqual(response(201, { id, version: 4 }));
      expect(await fixture().dispatch(op.path, { ...op.body, state: 'OPEN' })).toEqual(
        invalid('Unsupported fields: state'),
      );
    });
    it.each([undefined, null])(
      'provided protected field %j still requests field permission',
      async (value) => {
        const f = fixture([
          [
            'capa:manage',
            {
              scopes: ['TEAM'],
              fields: Object.keys(op.body).filter((key) => key !== op.protectedField),
            },
          ],
        ]);
        expect(await f.dispatch(op.path, { ...op.body, [op.protectedField]: value })).toEqual(
          fieldDenied,
        );
        noCalls(f);
      },
    );
    it.each([0, '1', 1.5, 1000001, undefined])(
      'version %j uses original number bounds',
      async (value) => {
        const f = fixture();
        expect(await f.dispatch(op.path, { ...op.body, [op.version]: value })).toEqual(
          invalid(`${op.version} must be an integer between 1 and 1000000`),
        );
        noCalls(f);
      },
    );
    it.each([1, 1000000])('version boundary %j accepted', async (value) => {
      const f = fixture();
      expect(await f.dispatch(op.path, { ...op.body, [op.version]: value })).toEqual(
        response(201, result),
      );
      expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(
        id,
        { ...op.input, [op.version]: value },
        repositoryContext,
        correlationId,
      );
    });
    it('timestamp retains broad Date normalization', async () => {
      const f = fixture();
      expect(await f.dispatch(op.path, { ...op.body, [op.time]: ' 2026-10-13 ' })).toEqual(
        response(201, result),
      );
      expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(
        id,
        { ...op.input, [op.time]: '2026-10-13T00:00:00.000Z' },
        repositoryContext,
        correlationId,
      );
    });
    it.each([undefined, null, '', 0])('timestamp %j required', async (value) => {
      const f = fixture();
      expect(await f.dispatch(op.path, { ...op.body, [op.time]: value })).toEqual(
        invalid(`${op.time} is required`),
      );
      noCalls(f);
    });
    it('timestamp bad value keeps original error', async () => {
      const f = fixture();
      expect(await f.dispatch(op.path, { ...op.body, [op.time]: 'bad' })).toEqual(
        invalid(`${op.time} must be a valid timestamp`),
      );
      noCalls(f);
    });
    it('body key retains trim/1/64 and invalid shape', async () => {
      const f = fixture();
      for (const idempotencyKey of ['A', 'A'.repeat(64)]) {
        expect(
          await f.dispatch(op.path, { ...op.body, idempotencyKey: ` ${idempotencyKey} ` }),
        ).toEqual(response(201, result));
        expect(f.repository[op.method]).toHaveBeenLastCalledWith(
          id,
          { ...op.input, idempotencyKey },
          repositoryContext,
          correlationId,
        );
      }
      for (const idempotencyKey of ['A'.repeat(65), '1START', 'A!?'])
        expect(await f.dispatch(op.path, { ...op.body, idempotencyKey })).toEqual(
          invalid('Code must be 1-64 uppercase letters, digits, underscore, or hyphen'),
        );
      expect(f.repository[op.method]).toHaveBeenCalledTimes(2);
    });
    it('header never participates or replaces body key', async () => {
      const f = fixture();
      for (const key of ['', 'x'.repeat(129), 'bad!?']) {
        expect(await f.dispatch(op.path, op.body, { key })).toEqual(response(201, result));
        expect(
          await f.dispatch(op.path, { ...op.body, idempotencyKey: undefined }, { key }),
        ).toEqual(invalid('idempotencyKey is required'));
      }
      expect(f.repository[op.method]).toHaveBeenCalledTimes(3);
    });
    it('201 independent capa:read full/finite/empty/missing never uses ncr read or requires read', async () => {
      for (const [read, dto] of [
        [grant, result],
        [
          { scopes: ['TEAM'], fields: ['state'] },
          { id, state: 'repo-state' },
        ],
        [{ scopes: ['TEAM'], fields: [] }, { id }],
        [undefined, { id, version: 4 }],
      ] as const) {
        const permissions: (readonly [PermissionKey, Grant])[] = [
          ['capa:manage', grant],
          ['ncr:read', grant],
        ];
        if (read) permissions.push(['capa:read', read]);
        expect(await fixture(permissions).dispatch(op.path, op.body)).toEqual(response(201, dto));
      }
      const wrong = fixture([
        ['ncr:manage', grant],
        ['capa:read', grant],
      ]);
      expect(await wrong.dispatch(op.path, op.body)).toEqual(denied);
      noCalls(wrong);
    });
    it('global401 and missing repo404 precede body/auth/path parsing', async () => {
      const absent = fixture([], false);
      expect(await absent.dispatch(op.path.replace(id, 'bad'), null)).toEqual(missing);
      expect(await absent.dispatch(op.path, { unknown: true })).toEqual(missing);
      expect(await absent.dispatch(op.path, null, { session: false })).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
      expect(absent.authenticate).toHaveBeenCalledTimes(2);
      noCalls(absent);
      const f = fixture();
      expect(await f.dispatch(op.path, null, { session: false })).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
      expect(f.authenticate).not.toHaveBeenCalled();
      noCalls(f);
    });
    it('wide regex/case/method boundaries and neighbours are not swallowed', async () => {
      const f = fixture([]);
      for (const pathname of [
        op.path.replace(id, 'not-a-uuid'),
        op.path.replace(id, 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'),
        `${op.path}/`,
        op.path.toUpperCase(),
        `${op.path}/unknown`,
      ])
        expect(await f.dispatch(pathname, null)).toEqual(missing);
      for (const method of ['GET', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])
        expect(await f.dispatch(op.path, null, { method })).toEqual(missing);
      const otherPath = op.name === 'add' ? completePath : addPath;
      expect(await f.dispatch(otherPath, {})).toEqual(denied);
      expect(await f.dispatch(`/api/v1/ncrs/${id}/capas`, {})).toEqual(denied);
      expect(await f.dispatch(`/api/v1/capas/${id}/close`, {})).toEqual(denied);
      expect(await f.dispatch(`/api/v1/capas/${id}/verify`, {})).toEqual(denied);
      expect(await f.dispatch(`/api/v1/ncrs/${id}/contain`, {})).toEqual(denied);
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
        f.repository[op.method].mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
        expect(await f.dispatch(op.path, op.body)).toEqual(error(status, code, 'fixed failure'));
      }
      f.repository[op.method].mockRejectedValueOnce(new Error('private fixture failure'));
      expect(await f.dispatch(op.path, op.body)).toEqual(
        error(500, 'internal_error', 'Internal server error'),
      );
    });
  });
}

describe('add action distinct parsing order', () => {
  it.each(['CORRECTIVE', 'PREVENTIVE'])('actionType %s trims and passes', async (actionType) => {
    const f = fixture();
    expect(await f.dispatch(addPath, { ...addBody, actionType: ` ${actionType} ` })).toEqual(
      response(201, result),
    );
    expect(f.repository.addCapaAction).toHaveBeenCalledExactlyOnceWith(
      id,
      { ...addInput, actionType },
      repositoryContext,
      correlationId,
    );
  });
  it.each([
    [undefined, 'actionType is required'],
    ['', 'actionType is required'],
    ['corrective', 'actionType is unsupported'],
    ['BAD', 'actionType is unsupported'],
  ])('actionType %j parses before bad path/description', async (actionType, message) => {
    const f = fixture();
    expect(
      await f.dispatch(addPath.replace(id, 'bad'), { ...addBody, actionType, description: '' }),
    ).toEqual(invalid(message));
    noCalls(f);
  });
  it('valid actionType leads to UUID before remaining fields', async () => {
    const f = fixture();
    expect(
      await f.dispatch(addPath.replace(id, 'bad'), { ...addBody, description: '', ownerId: 'bad' }),
    ).toEqual(invalid('capaId must be a UUID'));
    noCalls(f);
  });
  it.each([
    [{ description: '', ownerId: 'bad' }, 'description is required'],
    [{ ownerId: 'bad', dueAt: 'bad' }, 'ownerId must be a UUID'],
    [{ dueAt: 'bad', expectedVersion: 0 }, 'dueAt must be a valid timestamp'],
    [
      { expectedVersion: 0, idempotencyKey: '' },
      'expectedVersion must be an integer between 1 and 1000000',
    ],
    [{ idempotencyKey: '' }, 'idempotencyKey is required'],
  ])('add retains first-error priority %j', async (changed, message) => {
    const f = fixture();
    expect(await f.dispatch(addPath, { ...addBody, ...changed })).toEqual(invalid(message));
    noCalls(f);
  });
  it('does not accept complete fields or early owner-only checks', async () => {
    const f = fixture();
    expect(await f.dispatch(addPath, { ...addBody, evidence: {} })).toEqual(
      invalid('Unsupported fields: evidence'),
    );
    expect(await f.dispatch(addPath, addBody)).toEqual(response(201, result));
    expect(f.repository.addCapaAction).toHaveBeenCalledOnce();
  });
});

describe('complete action distinct parsing order', () => {
  it('UUID precedes completedAt/evidence/version after body/allow/auth', async () => {
    const f = fixture();
    expect(
      await f.dispatch(completePath.replace(id, 'bad'), {
        ...completeBody,
        completedAt: 'bad',
        evidence: null,
        expectedCapaVersion: 0,
      }),
    ).toEqual(invalid('capaActionId must be a UUID'));
    noCalls(f);
  });
  it.each([
    [{ completedAt: 'bad', evidence: null }, 'completedAt must be a valid timestamp'],
    [{ evidence: null, expectedCapaVersion: 0 }, 'evidence must be a JSON object'],
    [
      { expectedCapaVersion: 0, idempotencyKey: '' },
      'expectedCapaVersion must be an integer between 1 and 1000000',
    ],
    [{ idempotencyKey: '' }, 'idempotencyKey is required'],
  ])('complete retains first-error priority %j', async (changed, message) => {
    const f = fixture();
    expect(await f.dispatch(completePath, { ...completeBody, ...changed })).toEqual(
      invalid(message),
    );
    noCalls(f);
  });
  it.each([undefined, null, false, [], '', 0])(
    'evidence %j is mandatory and never defaults to {}',
    async (evidence) => {
      const f = fixture();
      expect(await f.dispatch(completePath, { ...completeBody, evidence })).toEqual(
        invalid('evidence must be a JSON object'),
      );
      noCalls(f);
    },
  );
  it('empty evidence is valid, add/version/owner fields are unknown and no early owner-only check is added', async () => {
    const f = fixture();
    expect(await f.dispatch(completePath, { ...completeBody, evidence: {} })).toEqual(
      response(201, result),
    );
    expect(f.repository.completeCapaAction).toHaveBeenCalledExactlyOnceWith(
      id,
      { ...completeInput, evidence: {} },
      repositoryContext,
      correlationId,
    );
    expect(
      await f.dispatch(completePath, {
        ...completeBody,
        actionType: 'CORRECTIVE',
        expectedVersion: 3,
        ownerId: id,
      }),
    ).toEqual(invalid('Unsupported fields: actionType, expectedVersion, ownerId'));
    expect(f.repository.completeCapaAction).toHaveBeenCalledOnce();
  });
});
