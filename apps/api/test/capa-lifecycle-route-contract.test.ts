// Fixed expectations on ae2bd86's inline close/verify routes, before extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: 'not-owner-or-verifier' };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
const repositoryContext = { actor, scopes: ['TEAM'], anchors };
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const closeBody = {
  expectedVersion: 3,
  reason: ' archive ',
  evidence: { archive: ['original'] },
  idempotencyKey: ' CLOSE_1 ',
};
const closeInput = { ...closeBody, reason: 'archive', idempotencyKey: 'CLOSE_1' };
const verifyBody = {
  verifiedAt: ' 2026-10-13T01:00:00+08:00 ',
  standard: ' internal standard ',
  sampleScope: ' three lots ',
  observationUntil: ' 2026-10-14T01:00:00+08:00 ',
  result: ' PASSED ',
  evidence: { report: ['original'] },
  expectedVersion: 3,
  complaintExpectedVersion: 5,
  idempotencyKey: ' VERIFY_1 ',
};
const verifyInput = {
  ...verifyBody,
  verifiedAt: '2026-10-12T17:00:00.000Z',
  standard: 'internal standard',
  sampleScope: 'three lots',
  observationUntil: '2026-10-13T17:00:00.000Z',
  result: 'PASSED',
  idempotencyKey: 'VERIFY_1',
};
const result = { id, version: 4, state: 'repo-state', private: 'raw' };
const operations = [
  {
    name: 'close',
    path: `/api/v1/capas/${id}/close`,
    method: 'closeCapa',
    capability: 'capa:manage',
    wrongCapability: 'capa:verify',
    body: closeBody,
    input: closeInput,
  },
  {
    name: 'verify',
    path: `/api/v1/capas/${id}/verify`,
    method: 'verifyCapa',
    capability: 'capa:verify',
    wrongCapability: 'capa:manage',
    body: verifyBody,
    input: verifyInput,
  },
] as const;
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['capa:manage', grant],
    ['capa:verify', grant],
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
    closeCapa: vi.fn().mockResolvedValue(result),
    verifyCapa: vi.fn().mockResolvedValue(result),
    createCapa: vi.fn(),
    addCapaAction: vi.fn(),
    completeCapaAction: vi.fn(),
    createNcr: vi.fn(),
    transitionNcr: vi.fn(),
  };
  const authenticate = vi.fn().mockResolvedValue(context);
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    employees: {} as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
    collections: {} as NonNullable<ApiDependencies['collections']>,
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
  describe(`inline CAPA lifecycle ${op.name}`, () => {
    it('normalizes complete id/input/R/C with original receiver, one call, 201, query ignored, no header', async () => {
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
    it.each([null, [], false, 0, 'bad'])('body %j before allow/auth/enum/path', async (value) => {
      const f = fixture([]);
      expect(await f.dispatch(op.path.replace(id, 'bad'), value)).toEqual(
        invalid('A JSON object body is required'),
      );
      noCalls(f);
    });
    it('exact allow before route-specific field authorization and all parsing', async () => {
      const absent = fixture([]);
      expect(
        await absent.dispatch(op.path.replace(id, 'bad'), { ...op.body, z: null, a: undefined }),
      ).toEqual(invalid('Unsupported fields: a, z'));
      expect(await absent.dispatch(op.path.replace(id, 'bad'), {})).toEqual(denied);
      noCalls(absent);
      for (const write of [
        { scopes: ['TEAM'], fields: [] },
        { scopes: [], fields: null },
      ] as const) {
        const f = fixture([[op.capability, write]]);
        expect(await f.dispatch(op.path.replace(id, 'bad'), op.body)).toEqual(
          write.fields === null ? denied : fieldDenied,
        );
        noCalls(f);
      }
      const finite = fixture([[op.capability, { scopes: ['TEAM'], fields: Object.keys(op.body) }]]);
      expect(await finite.dispatch(op.path, op.body)).toEqual(response(201, { id, version: 4 }));
      const wrong = fixture([
        [op.wrongCapability, grant],
        ['ncr:manage', grant],
        ['capa:read', grant],
      ]);
      expect(await wrong.dispatch(op.path, op.body)).toEqual(denied);
      noCalls(wrong);
    });
    it.each([undefined, null])(
      'evidence key %j participates in field permission before parsing',
      async (evidence) => {
        const f = fixture([
          [
            op.capability,
            {
              scopes: ['TEAM'],
              fields: Object.keys(op.body).filter((field) => field !== 'evidence'),
            },
          ],
        ]);
        expect(await f.dispatch(op.path, { ...op.body, evidence })).toEqual(fieldDenied);
        noCalls(f);
      },
    );
    it.each([undefined, null, false, [], '', 0])(
      'evidence %j required, never defaults',
      async (evidence) => {
        const f = fixture();
        expect(await f.dispatch(op.path, { ...op.body, evidence })).toEqual(
          invalid('evidence must be a JSON object'),
        );
        noCalls(f);
      },
    );
    it('empty evidence passes, server state/owner/verifier cannot enter input', async () => {
      const f = fixture();
      expect(await f.dispatch(op.path, { ...op.body, evidence: {} })).toEqual(
        response(201, result),
      );
      expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(
        id,
        { ...op.input, evidence: {} },
        repositoryContext,
        correlationId,
      );
      expect(
        await f.dispatch(op.path, { ...op.body, ownerId: id, state: 'OPEN', verifierId: id }),
      ).toEqual(invalid('Unsupported fields: ownerId, state, verifierId'));
      expect(f.repository[op.method]).toHaveBeenCalledOnce();
    });
    const versions =
      op.name === 'close' ? ['expectedVersion'] : ['expectedVersion', 'complaintExpectedVersion'];
    for (const version of versions) {
      it.each([undefined, null, false, 0, '1', 1.5, 1000001])(
        `${version} %j rejects original types/bounds`,
        async (value) => {
          const f = fixture();
          expect(await f.dispatch(op.path, { ...op.body, [version]: value })).toEqual(
            invalid(`${version} must be an integer between 1 and 1000000`),
          );
          noCalls(f);
        },
      );
      it.each([1, 1000000])(`${version} boundary %j passes unchanged`, async (value) => {
        const f = fixture();
        expect(await f.dispatch(op.path, { ...op.body, [version]: value })).toEqual(
          response(201, result),
        );
        expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(
          id,
          { ...op.input, [version]: value },
          repositoryContext,
          correlationId,
        );
      });
    }
    it('body key trim and 1..64/shape retained', async () => {
      const f = fixture();
      for (const key of ['A', 'A'.repeat(64)]) {
        expect(await f.dispatch(op.path, { ...op.body, idempotencyKey: ` ${key} ` })).toEqual(
          response(201, result),
        );
        expect(f.repository[op.method]).toHaveBeenLastCalledWith(
          id,
          { ...op.input, idempotencyKey: key },
          repositoryContext,
          correlationId,
        );
      }
      for (const key of ['A'.repeat(65), '1START', 'a', 'A!?'])
        expect(await f.dispatch(op.path, { ...op.body, idempotencyKey: key })).toEqual(
          invalid('Code must be 1-64 uppercase letters, digits, underscore, or hyphen'),
        );
      for (const key of [undefined, null, '', ' ', 0])
        expect(await f.dispatch(op.path, { ...op.body, idempotencyKey: key })).toEqual(
          invalid('idempotencyKey is required'),
        );
      expect(f.repository[op.method]).toHaveBeenCalledTimes(2);
    });
    it('header ignored and never substitutes body key', async () => {
      const f = fixture();
      for (const key of ['', 'x'.repeat(129), 'bad!?']) {
        expect(await f.dispatch(op.path, op.body, { key })).toEqual(response(201, result));
        expect(
          await f.dispatch(op.path, { ...op.body, idempotencyKey: undefined }, { key }),
        ).toEqual(invalid('idempotencyKey is required'));
      }
      expect(f.repository[op.method]).toHaveBeenCalledTimes(3);
    });
    it('independent capa:read full/finite/empty/missing projection without new read permission', async () => {
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
          [op.capability, grant],
          ['ncr:read', grant],
          ['complaint:read', grant],
        ];
        if (read) permissions.push(['capa:read', read]);
        const f = fixture(permissions);
        expect(await f.dispatch(op.path, op.body)).toEqual(response(201, dto));
        expect(f.repository[op.method]).toHaveBeenCalledOnce();
      }
    });
    it('global401, missing repository404 and unauthenticated no authentication call', async () => {
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
    it('only POST and unchanged regex/method/path boundaries', async () => {
      const f = fixture([]);
      for (const path of [
        op.path.replace(id, 'not-a-uuid'),
        op.path.replace(id, id.toUpperCase()),
        op.path.toUpperCase(),
        `${op.path}/`,
        `${op.path}/unknown`,
        op.path.replace(op.name, 'unknown'),
      ])
        expect(await f.dispatch(path, null)).toEqual(missing);
      for (const method of ['GET', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])
        expect(await f.dispatch(op.path, null, { method })).toEqual(missing);
      noCalls(f);
    });
    it('other lifecycle/actions/create and neighbouring collections fall through to their own authorization', async () => {
      const f = fixture([]);
      for (const path of [
        operations[op.name === 'close' ? 1 : 0].path,
        `/api/v1/capas/${id}/actions`,
        `/api/v1/capa-actions/${id}/complete`,
        `/api/v1/ncrs/${id}/capas`,
      ])
        expect(await f.dispatch(path, {})).toEqual(denied);
      expect(await f.dispatch('/api/v1/collection-cases', null, { method: 'GET' })).toEqual(denied);
      noCalls(f);
    });
    it('DomainError/internal envelopes preserve status/message/correlation', async () => {
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
      f.repository[op.method].mockRejectedValueOnce(new Error('private failure'));
      expect(await f.dispatch(op.path, op.body)).toEqual(
        error(500, 'internal_error', 'Internal server error'),
      );
    });
  });
}

describe('close distinct parsing sequence', () => {
  it('UUID before version/reason/evidence/body key after allow/auth', async () => {
    const f = fixture();
    expect(
      await f.dispatch(operations[0].path.replace(id, 'bad'), {
        expectedVersion: 0,
        reason: '',
        evidence: null,
        idempotencyKey: '',
      }),
    ).toEqual(invalid('capaId must be a UUID'));
    noCalls(f);
  });
  it.each([
    [
      { expectedVersion: 0, reason: '', evidence: null, idempotencyKey: '' },
      'expectedVersion must be an integer between 1 and 1000000',
    ],
    [{ reason: '', evidence: null, idempotencyKey: '' }, 'reason is required'],
    [{ evidence: null, idempotencyKey: '' }, 'evidence must be a JSON object'],
    [{ idempotencyKey: '' }, 'idempotencyKey is required'],
  ])('first-error priority %j', async (changed, message) => {
    const f = fixture();
    expect(await f.dispatch(operations[0].path, { ...closeBody, ...changed })).toEqual(
      invalid(message),
    );
    noCalls(f);
  });
  it('verify-only fields are unknown on close', async () => {
    const f = fixture();
    expect(
      await f.dispatch(operations[0].path, {
        ...closeBody,
        result: 'PASSED',
        complaintExpectedVersion: 5,
        verifiedAt: 'bad',
      }),
    ).toEqual(invalid('Unsupported fields: complaintExpectedVersion, result, verifiedAt'));
    noCalls(f);
  });
});

describe('verify distinct result-first and field sequence', () => {
  it.each(['PASSED', 'FAILED'])('result %s trimmed before passing', async (value) => {
    const f = fixture();
    expect(await f.dispatch(operations[1].path, { ...verifyBody, result: ` ${value} ` })).toEqual(
      response(201, result),
    );
    expect(f.repository.verifyCapa).toHaveBeenCalledExactlyOnceWith(
      id,
      { ...verifyInput, result: value },
      repositoryContext,
      correlationId,
    );
  });
  it.each([undefined, null, false, '', 0, 'BAD', 'passed'])(
    'result %j before path/timestamp',
    async (value) => {
      const f = fixture();
      expect(
        await f.dispatch(operations[1].path.replace(id, 'bad'), {
          ...verifyBody,
          result: value,
          verifiedAt: 'bad',
        }),
      ).toEqual(
        invalid(
          typeof value === 'string' && value.length
            ? 'result is unsupported'
            : 'result is required',
        ),
      );
      noCalls(f);
    },
  );
  it('valid result then UUID before other fields', async () => {
    const f = fixture();
    expect(
      await f.dispatch(operations[1].path.replace(id, 'bad'), {
        ...verifyBody,
        verifiedAt: 'bad',
        standard: '',
        evidence: null,
        expectedVersion: 0,
      }),
    ).toEqual(invalid('capaId must be a UUID'));
    noCalls(f);
  });
  it.each([
    [
      {
        verifiedAt: 'bad',
        standard: '',
        sampleScope: '',
        observationUntil: 'bad',
        evidence: null,
        expectedVersion: 0,
        complaintExpectedVersion: 0,
        idempotencyKey: '',
      },
      'verifiedAt must be a valid timestamp',
    ],
    [
      {
        standard: '',
        sampleScope: '',
        observationUntil: 'bad',
        evidence: null,
        expectedVersion: 0,
        complaintExpectedVersion: 0,
        idempotencyKey: '',
      },
      'standard is required',
    ],
    [
      {
        sampleScope: '',
        observationUntil: 'bad',
        evidence: null,
        expectedVersion: 0,
        complaintExpectedVersion: 0,
        idempotencyKey: '',
      },
      'sampleScope is required',
    ],
    [
      {
        observationUntil: 'bad',
        evidence: null,
        expectedVersion: 0,
        complaintExpectedVersion: 0,
        idempotencyKey: '',
      },
      'observationUntil must be a valid timestamp',
    ],
    [
      { evidence: null, expectedVersion: 0, complaintExpectedVersion: 0, idempotencyKey: '' },
      'evidence must be a JSON object',
    ],
    [
      { expectedVersion: 0, complaintExpectedVersion: 0, idempotencyKey: '' },
      'expectedVersion must be an integer between 1 and 1000000',
    ],
    [
      { complaintExpectedVersion: 0, idempotencyKey: '' },
      'complaintExpectedVersion must be an integer between 1 and 1000000',
    ],
    [{ idempotencyKey: '' }, 'idempotencyKey is required'],
  ])('first-error priority %j', async (changed, message) => {
    const f = fixture();
    expect(await f.dispatch(operations[1].path, { ...verifyBody, ...changed })).toEqual(
      invalid(message),
    );
    noCalls(f);
  });
  for (const field of ['verifiedAt', 'observationUntil'] as const) {
    it.each([undefined, null, '', ' ', 0])(`${field} %j required`, async (value) => {
      const f = fixture();
      expect(await f.dispatch(operations[1].path, { ...verifyBody, [field]: value })).toEqual(
        invalid(`${field} is required`),
      );
      noCalls(f);
    });
    it(`${field} broad Date normalization and invalid timestamp retained`, async () => {
      const f = fixture();
      expect(
        await f.dispatch(operations[1].path, { ...verifyBody, [field]: ' 2026-10-13 ' }),
      ).toEqual(response(201, result));
      expect(f.repository.verifyCapa).toHaveBeenCalledExactlyOnceWith(
        id,
        { ...verifyInput, [field]: '2026-10-13T00:00:00.000Z' },
        repositoryContext,
        correlationId,
      );
      expect(await f.dispatch(operations[1].path, { ...verifyBody, [field]: 'bad' })).toEqual(
        invalid(`${field} must be a valid timestamp`),
      );
      expect(f.repository.verifyCapa).toHaveBeenCalledOnce();
    });
  }
  it('does not add observation/verified ordering or owner/state HTTP checks (mock only)', async () => {
    const f = fixture([['capa:verify', grant]]);
    expect(
      await f.dispatch(operations[1].path, { ...verifyBody, observationUntil: '2020-01-01' }),
    ).toEqual(response(201, { id, version: 4 }));
    expect(f.repository.verifyCapa).toHaveBeenCalledExactlyOnceWith(
      id,
      { ...verifyInput, observationUntil: '2020-01-01T00:00:00.000Z' },
      repositoryContext,
      correlationId,
    );
  });
  it('close reason is unknown on verify', async () => {
    const f = fixture();
    expect(await f.dispatch(operations[1].path, { ...verifyBody, reason: 'archive' })).toEqual(
      invalid('Unsupported fields: reason'),
    );
    noCalls(f);
  });
});
