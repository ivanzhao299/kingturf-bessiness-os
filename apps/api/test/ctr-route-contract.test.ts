// Fixed CTR write expectations on acb269e, before extraction; command priority is intentionally asymmetric.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = '11111111-1111-4111-8111-111111111111';
const attachmentId = '22222222-2222-4222-8222-222222222222';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: 'actor' };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
const key = ' raw key!? ';
const result = { id, version: 2, title: 'Fixed', secret: 'private' };
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const methods = [
  'createCtr',
  'createCtrVersion',
  'submitCtr',
  'approveCtr',
  'linkCtrAttachment',
] as const;
type Method = (typeof methods)[number];
type Operation = {
  path: string;
  method: Method;
  capability: PermissionKey;
  status: number;
  body: Record<string, unknown>;
  args: readonly unknown[];
  command?: boolean;
};
const createBody = {
  opportunityId: id,
  code: ' ctr! ',
  title: ' title ',
  requirements: { fixed: true },
};
const versionBody = { title: ' title ', requirements: { fixed: true } };
const submitBody = { expectedVersion: 2 };
const decisionBody = { decision: ' APPROVED ', reason: ' reason ' };
const operations: readonly Operation[] = [
  {
    path: '/api/v1/ctrs',
    method: 'createCtr',
    capability: 'ctr:create',
    status: 201,
    body: createBody,
    args: [
      { opportunityId: id, code: 'ctr!', title: 'title', requirements: { fixed: true } },
      actor,
      ['TEAM'],
      anchors,
      correlationId,
    ],
  },
  {
    path: `/api/v1/ctrs/${id}/versions`,
    method: 'createCtrVersion',
    capability: 'ctr:update',
    status: 201,
    body: versionBody,
    args: [
      id,
      { title: 'title', requirements: { fixed: true } },
      actor,
      ['TEAM'],
      anchors,
      correlationId,
    ],
  },
  {
    path: `/api/v1/ctr-versions/${id}/submit`,
    method: 'submitCtr',
    capability: 'ctr:submit',
    status: 200,
    body: submitBody,
    args: [id, 2, key, actor, ['TEAM'], anchors, correlationId],
    command: true,
  },
  {
    path: `/api/v1/ctr-versions/${id}/decision`,
    method: 'approveCtr',
    capability: 'ctr:approve',
    status: 200,
    body: decisionBody,
    args: [id, 'APPROVED', 'reason', key, actor, ['TEAM'], anchors, correlationId],
    command: true,
  },
  {
    path: `/api/v1/ctr-versions/${id}/attachments`,
    method: 'linkCtrAttachment',
    capability: 'ctr:update',
    status: 201,
    body: { attachmentId },
    args: [id, attachmentId, actor, ['TEAM'], anchors, correlationId],
  },
];
const submitPath = `/api/v1/ctr-versions/${id}/submit`,
  decisionPath = `/api/v1/ctr-versions/${id}/decision`;
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['ctr:read', grant],
    ['ctr:create', grant],
    ['ctr:update', grant],
    ['ctr:submit', grant],
    ['ctr:approve', grant],
  ],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([capability]) => [capability, anchors])),
  };
  const repository = {
    ...(Object.fromEntries(
      methods.map((method) => [method, vi.fn().mockResolvedValue(result)]),
    ) as Record<Method, ReturnType<typeof vi.fn>>),
    listCommercialView: vi.fn().mockResolvedValue([result]),
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
    path: string,
    body: unknown,
    options: { method?: string; key?: string | undefined; session?: boolean } = {},
  ) =>
    app.dispatch({
      method: options.method ?? 'POST',
      pathname: path,
      body,
      headers: {
        authorization: options.session === false ? '' : 'Bearer fixture',
        'x-correlation-id': correlationId,
        'idempotency-key': Object.hasOwn(options, 'key') ? options.key : key,
      },
    });
  return { repository, authenticate, dispatch };
}
const response = (statusCode: number, body: unknown) => ({
  statusCode,
  body,
  headers: {
    'x-correlation-id': correlationId,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'strict-origin-when-cross-origin',

    'content-security-policy-report-only':
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
  },
});
const error = (status: number, code: string, message: string) =>
  response(status, { error: { code, message, correlationId } });
const invalid = (message: string) => error(400, 'invalid_request', message);
const denied = error(403, 'forbidden', 'Permission denied');
const fieldDenied = error(403, 'forbidden', 'Field permission denied');
const missing = error(404, 'not_found', 'Route not found');
const versionError = invalid('version must be a positive integer');
const keyError = invalid('Idempotency-Key is required');
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const method of methods) expect(f.repository[method]).not.toHaveBeenCalled();
  expect(f.repository.listCommercialView).not.toHaveBeenCalled();
};

describe('CTR inline supported write contracts', () => {
  it.each(operations)(
    '$path preserves exact inputs, receiver, scoped args, DTO/status and call count',
    async (op) => {
      const f = fixture();
      expect(await f.dispatch(op.path, op.body)).toEqual(response(op.status, result));
      expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(...op.args);
      expect(f.repository[op.method].mock.contexts).toEqual([f.repository]);
      for (const method of methods)
        if (method !== op.method) expect(f.repository[method]).not.toHaveBeenCalled();
      expect(f.repository.listCommercialView).not.toHaveBeenCalled();
    },
  );
  it.each(operations)(
    '$path preserves mutation DTO with absent/limited/empty read grant',
    async (op) => {
      const absent = fixture([[op.capability, grant]]);
      expect(await absent.dispatch(op.path, op.body)).toEqual(
        response(op.status, { id, version: 2 }),
      );
      const limited = fixture([
        [op.capability, grant],
        ['ctr:read', { scopes: ['SELF'], fields: ['title'] }],
      ]);
      expect(await limited.dispatch(op.path, op.body)).toEqual(
        response(op.status, { id, title: 'Fixed' }),
      );
      const empty = fixture([
        [op.capability, grant],
        ['ctr:read', { scopes: ['TEAM'], fields: [] }],
      ]);
      expect(await empty.dispatch(op.path, op.body)).toEqual(response(op.status, { id }));
    },
  );
  it.each(operations)(
    '$path preserves permission/scopes and distinct field-authorization semantics',
    async (op) => {
      const f = fixture([]);
      expect(await f.dispatch(op.path, null)).toEqual(invalid('A JSON object body is required'));
      expect(await f.dispatch(op.path, op.body)).toEqual(denied);
      noCalls(f);
      const empty = fixture([[op.capability, { scopes: [], fields: null }]]);
      expect(await empty.dispatch(op.path, op.body)).toEqual(denied);
      noCalls(empty);
      const fields = fixture([[op.capability, { scopes: ['TEAM'], fields: [] }]]);
      expect(await fields.dispatch(op.path, op.body)).toEqual(
        op.command ? response(op.status, { id, version: 2 }) : fieldDenied,
      );
      if (op.command)
        expect(fields.repository[op.method]).toHaveBeenCalledExactlyOnceWith(...op.args);
      else noCalls(fields);
    },
  );
  it('preserves both approved and rejected decisions', async () => {
    const f = fixture();
    expect(await f.dispatch(decisionPath, { decision: ' REJECTED ', reason: ' reason ' })).toEqual(
      response(200, result),
    );
    expect(f.repository.approveCtr).toHaveBeenCalledExactlyOnceWith(
      id,
      'REJECTED',
      'reason',
      key,
      actor,
      ['TEAM'],
      anchors,
      correlationId,
    );
  });
});

describe('CTR inline validation priority', () => {
  it('submit authorizes before allow while decision allows before authorization', async () => {
    const f = fixture([]);
    expect(await f.dispatch(submitPath, { extra: true })).toEqual(denied);
    expect(await f.dispatch(decisionPath, { extra: true })).toEqual(
      invalid('Unsupported fields: extra'),
    );
    noCalls(f);
    const allowed = fixture();
    expect(await allowed.dispatch(submitPath, { extra: true })).toEqual(
      invalid('Unsupported fields: extra'),
    );
    expect(await allowed.dispatch(decisionPath, { extra: true })).toEqual(
      invalid('Unsupported fields: extra'),
    );
    noCalls(allowed);
  });
  it.each(operations.filter((op) => !op.command))(
    '$path allows fields before authorization and authorizes before UUID/values',
    async (op) => {
      const f = fixture([]);
      expect(await f.dispatch(op.path, { extra: true })).toEqual(
        invalid('Unsupported fields: extra'),
      );
      expect(await f.dispatch(op.path, {})).toEqual(denied);
      const badPath = op.path.replace(id, 'bad');
      expect(await f.dispatch(badPath, op.body)).toEqual(denied);
      noCalls(f);
    },
  );
  it.each([submitPath, decisionPath])(
    '%s parses body then UUID before permission/allow',
    async (path) => {
      const badPath = path.replace(id, 'bad');
      const f = fixture([]);
      expect(await f.dispatch(badPath, null)).toEqual(invalid('A JSON object body is required'));
      expect(await f.dispatch(badPath, { extra: true })).toEqual(
        invalid('ctrVersionId must be a UUID'),
      );
      expect(await f.dispatch(badPath, {})).toEqual(invalid('ctrVersionId must be a UUID'));
      noCalls(f);
    },
  );
  it.each([
    [
      '/api/v1/ctrs',
      { ...createBody, opportunityId: 'bad', code: '' },
      'opportunityId must be a UUID',
    ],
    ['/api/v1/ctrs', { ...createBody, code: '', title: '' }, 'code is required'],
    ['/api/v1/ctrs', { ...createBody, title: '', requirements: [] }, 'title is required'],
    ['/api/v1/ctrs', { ...createBody, requirements: null }, 'requirements must be a JSON object'],
    [`/api/v1/ctrs/bad/versions`, { title: '', requirements: [] }, 'ctrId must be a UUID'],
    [`/api/v1/ctrs/${id}/versions`, { title: '', requirements: [] }, 'title is required'],
    [
      `/api/v1/ctrs/${id}/versions`,
      { ...versionBody, requirements: [] },
      'requirements must be a JSON object',
    ],
    [
      `/api/v1/ctr-versions/bad/attachments`,
      { attachmentId: 'bad' },
      'ctrVersionId must be a UUID',
    ],
    [
      `/api/v1/ctr-versions/${id}/attachments`,
      { attachmentId: 'bad' },
      'attachmentId must be a UUID',
    ],
    [decisionPath, { decision: '', reason: '' }, 'decision is required'],
    [decisionPath, { decision: 'BAD', reason: '' }, 'decision is unsupported'],
    [decisionPath, { decision: 'APPROVED', reason: '' }, 'reason is required'],
  ])('%s preserves first parsing failure for %j', async (path, body, message) => {
    const f = fixture();
    expect(await f.dispatch(path, body, { key: undefined })).toEqual(invalid(message));
    noCalls(f);
  });
  it.each([undefined, null, 0, -1, 0.5, '1', Number.POSITIVE_INFINITY])(
    'submit rejects version %j before missing header key',
    async (expectedVersion) => {
      const f = fixture();
      expect(await f.dispatch(submitPath, { expectedVersion }, { key: undefined })).toEqual(
        versionError,
      );
      noCalls(f);
    },
  );
  it.each([undefined, '', 'x'.repeat(129)])(
    'commands reject missing/empty/overlong key %j only after inputs',
    async (headerKey) => {
      const f = fixture();
      expect(await f.dispatch(submitPath, submitBody, { key: headerKey })).toEqual(keyError);
      expect(await f.dispatch(decisionPath, decisionBody, { key: headerKey })).toEqual(keyError);
      noCalls(f);
    },
  );
  it.each([' ', '!?', ' raw key ', 'x'.repeat(128)])(
    'commands preserve header key %j without trim or format validation',
    async (headerKey) => {
      const f = fixture();
      expect((await f.dispatch(submitPath, submitBody, { key: headerKey })).statusCode).toBe(200);
      expect(f.repository.submitCtr).toHaveBeenCalledExactlyOnceWith(
        id,
        2,
        headerKey,
        actor,
        ['TEAM'],
        anchors,
        correlationId,
      );
      expect((await f.dispatch(decisionPath, decisionBody, { key: headerKey })).statusCode).toBe(
        200,
      );
      expect(f.repository.approveCtr).toHaveBeenCalledExactlyOnceWith(
        id,
        'APPROVED',
        'reason',
        headerKey,
        actor,
        ['TEAM'],
        anchors,
        correlationId,
      );
    },
  );
  it('does not substitute a body idempotencyKey for the header', async () => {
    const f = fixture();
    expect(
      await f.dispatch(submitPath, { ...submitBody, idempotencyKey: 'BODY' }, { key: undefined }),
    ).toEqual(invalid('Unsupported fields: idempotencyKey'));
    expect(
      await f.dispatch(
        decisionPath,
        { ...decisionBody, idempotencyKey: 'BODY' },
        { key: undefined },
      ),
    ).toEqual(invalid('Unsupported fields: idempotencyKey'));
    noCalls(f);
  });
  it.each(operations.filter((op) => !op.command))(
    '$path does not require a command idempotency header',
    async (op) => {
      const f = fixture();
      expect(await f.dispatch(op.path, op.body, { key: undefined })).toEqual(
        response(op.status, result),
      );
      expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(...op.args);
    },
  );
});

describe('CTR inline availability/session/method/envelope boundaries', () => {
  it.each(operations)('$path with no repository skips body/UUID/permission to 404', async (op) => {
    const f = fixture([], false);
    for (const path of [op.path, op.path.replace(id, 'bad')])
      for (const body of [null, op.body])
        expect(await f.dispatch(path, body, { key: undefined })).toEqual(missing);
    noCalls(f);
  });
  it.each(operations)('$path requires session before missing dependency or inputs', async (op) => {
    const f = fixture([], false);
    expect(await f.dispatch(op.path, null, { session: false, key: undefined })).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(f.authenticate).not.toHaveBeenCalled();
    noCalls(f);
  });
  it.each(operations)(
    '$path unsupported methods and paths do not parse/authorize/write',
    async (op) => {
      const f = fixture([]);
      for (const method of ['PATCH', 'DELETE', 'OPTIONS'])
        expect(await f.dispatch(op.path, null, { method })).toEqual(missing);
      for (const path of [`${op.path}/`, op.path.toUpperCase(), `${op.path}/unknown`])
        expect(await f.dispatch(path, null)).toEqual(missing);
      if (op.path !== '/api/v1/ctrs')
        expect(await f.dispatch(op.path, null, { method: 'GET' })).toEqual(missing);
      noCalls(f);
    },
  );
  it('same-path GET /ctrs remains the commercial view read without command/body validation', async () => {
    const f = fixture([['ctr:read', grant]]);
    expect(await f.dispatch('/api/v1/ctrs', null, { method: 'GET', key: undefined })).toEqual(
      response(200, { items: [result] }),
    );
    expect(f.repository.listCommercialView).toHaveBeenCalledExactlyOnceWith(
      'ctrs',
      actor,
      ['TEAM'],
      anchors,
    );
    for (const method of methods) expect(f.repository[method]).not.toHaveBeenCalled();
  });
  it.each(operations)(
    '$path keeps repository domain/internal envelopes and correlation',
    async (op) => {
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
    },
  );
});
