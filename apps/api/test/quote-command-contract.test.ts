// Fixed inline expectations on 511c77c, before quote command extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = '11111111-1111-4111-8111-111111111111';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: 'actor' };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const key = ' raw key!? ';
const result = { id, version: 2, total: '8', private: 'raw' };
const approvePath = `/api/v1/quote-revisions/${id}/approve`,
  issuePath = `/api/v1/quote-revisions/${id}/issue`;
const approveBody = { decision: ' APPROVED ', reason: ' reason ' };
const methods = ['approveQuote', 'issueQuote'] as const;
type Operation = {
  path: string;
  method: (typeof methods)[number];
  capability: PermissionKey;
  body: Record<string, unknown>;
  args: readonly unknown[];
};
const operations: readonly Operation[] = [
  {
    path: approvePath,
    method: 'approveQuote',
    capability: 'quote:approve',
    body: approveBody,
    args: [id, 'APPROVED', 'reason', key, actor, ['TEAM'], anchors, correlationId],
  },
  {
    path: issuePath,
    method: 'issueQuote',
    capability: 'quote:issue',
    body: {},
    args: [id, key, actor, ['TEAM'], anchors, correlationId],
  },
];
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['quote:approve', grant],
    ['quote:issue', grant],
    ['quote:read', grant],
  ],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([capability]) => [capability, anchors])),
  };
  const repository = {
    approveQuote: vi.fn().mockResolvedValue(result),
    issueQuote: vi.fn().mockResolvedValue(result),
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
      query: { decision: 'BAD', idempotencyKey: 'query-key' },
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
const missing = error(404, 'not_found', 'Route not found');
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const mock of Object.values(f.repository)) expect(mock).not.toHaveBeenCalled();
};

describe('inline quote approve/issue command contracts', () => {
  it.each(operations)(
    '$path preserves exact receiver/args/anchors/status/DTO/correlation and ignores query',
    async (op) => {
      const f = fixture();
      expect(await f.dispatch(op.path, op.body)).toEqual(response(200, result));
      expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(...op.args);
      expect(f.repository[op.method].mock.contexts).toEqual([f.repository]);
      for (const method of methods)
        if (method !== op.method) expect(f.repository[method]).not.toHaveBeenCalled();
      expect(f.repository.listCommercialView).not.toHaveBeenCalled();
    },
  );
  it.each(operations)(
    '$path regex-matched UUID failure precedes every body/field/permission check',
    async (op) => {
      const f = fixture([]);
      for (const body of [null, [], { unexpected: true }, {}])
        expect(await f.dispatch(op.path.replace(id, 'bad'), body, { key: undefined })).toEqual(
          invalid('quoteRevisionId must be a UUID'),
        );
      noCalls(f);
      expect(await f.dispatch(op.path.replace(id, 'not-a-uuid'), null)).toEqual(missing);
    },
  );
  it.each(operations)(
    '$path object/whitelist precedes capability and empty scopes are denied',
    async (op) => {
      const f = fixture([]);
      expect(await f.dispatch(op.path, null)).toEqual(invalid('A JSON object body is required'));
      expect(await f.dispatch(op.path, { ...op.body, unexpected: true })).toEqual(
        invalid('Unsupported fields: unexpected'),
      );
      expect(await f.dispatch(op.path, op.body, { key: undefined })).toEqual(denied);
      noCalls(f);
      const empty = fixture([[op.capability, { scopes: [], fields: null }]]);
      expect(await empty.dispatch(op.path, op.body)).toEqual(denied);
      noCalls(empty);
    },
  );
  it.each(operations)(
    '$path authorizes without requesting fields even with empty or unrelated field grants',
    async (op) => {
      for (const fields of [[], ['unrelated']] as const) {
        const f = fixture([[op.capability, { scopes: ['TEAM'], fields }]]);
        expect(await f.dispatch(op.path, op.body)).toEqual(response(200, { id, version: 2 }));
        expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(...op.args);
      }
    },
  );
  it.each(operations)(
    '$path uses independent quote read absent/empty/limited/full projection',
    async (op) => {
      for (const [read, dto] of [
        [undefined, { id, version: 2 }],
        [{ scopes: ['SELF'], fields: [] }, { id }],
        [
          { scopes: ['SELF'], fields: ['total'] },
          { id, total: '8' },
        ],
        [grant, result],
      ] as const) {
        const f = fixture([
          [op.capability, grant],
          ...(read ? [['quote:read', read] as const] : []),
        ]);
        expect(await f.dispatch(op.path, op.body)).toEqual(response(200, dto));
      }
      const f = fixture([
        [op.capability, grant],
        ['cost:read', grant],
      ]);
      expect(await f.dispatch(op.path, op.body)).toEqual(response(200, { id, version: 2 }));
    },
  );
  it.each(['APPROVED', 'REJECTED'])(
    'approve trims and accepts decision %s with reason',
    async (decision) => {
      const f = fixture();
      expect(
        await f.dispatch(approvePath, { decision: ` ${decision} `, reason: ' reason ' }),
      ).toEqual(response(200, result));
      expect(f.repository.approveQuote).toHaveBeenCalledExactlyOnceWith(
        id,
        decision,
        'reason',
        key,
        actor,
        ['TEAM'],
        anchors,
        correlationId,
      );
    },
  );
  it.each([
    [{ decision: undefined, reason: '' }, 'decision is required'],
    [{ decision: '', reason: '' }, 'decision is required'],
    [{ decision: 1, reason: '' }, 'decision is required'],
    [{ decision: 'approved', reason: '' }, 'decision is unsupported'],
    [{ decision: 'BAD', reason: '' }, 'decision is unsupported'],
    [{ decision: 'APPROVED', reason: undefined }, 'reason is required'],
    [{ decision: 'APPROVED', reason: ' ' }, 'reason is required'],
  ])('approve decision/reason error precedes missing key %j', async (body, message) => {
    const f = fixture();
    expect(await f.dispatch(approvePath, body, { key: undefined })).toEqual(invalid(message));
    noCalls(f);
  });
  for (const op of operations) {
    it.each([undefined, '', 'x'.repeat(129)])(
      `${op.path} rejects header %j after all previous checks`,
      async (headerKey) => {
        const f = fixture();
        expect(await f.dispatch(op.path, op.body, { key: headerKey })).toEqual(
          invalid('Idempotency-Key is required'),
        );
        noCalls(f);
      },
    );
    it.each(['x', 'x'.repeat(128), ' ', '!?', ' raw key '])(
      `${op.path} passes original header %j untrimmed`,
      async (headerKey) => {
        const f = fixture();
        expect(await f.dispatch(op.path, op.body, { key: headerKey })).toEqual(
          response(200, result),
        );
        expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(
          ...(op.method === 'approveQuote'
            ? [id, 'APPROVED', 'reason', headerKey, actor, ['TEAM'], anchors, correlationId]
            : [id, headerKey, actor, ['TEAM'], anchors, correlationId]),
        );
      },
    );
  }
  it.each(operations)(
    '$path rejects body idempotencyKey/expectedVersion before permission',
    async (op) => {
      const f = fixture([]);
      for (const field of ['idempotencyKey', 'expectedVersion'])
        expect(await f.dispatch(op.path, { ...op.body, [field]: 1 }, { key: undefined })).toEqual(
          invalid(`Unsupported fields: ${field}`),
        );
      noCalls(f);
    },
  );
  it('issue accepts only JSON empty object and rejects decision/reason', async () => {
    const f = fixture([]);
    expect(await f.dispatch(issuePath, approveBody)).toEqual(
      invalid('Unsupported fields: decision, reason'),
    );
    noCalls(f);
    const allowed = fixture([['quote:issue', { scopes: ['TEAM'], fields: [] }]]);
    expect(await allowed.dispatch(issuePath, {})).toEqual(response(200, { id, version: 2 }));
    expect(await allowed.dispatch(issuePath, [], { key: undefined })).toEqual(
      invalid('A JSON object body is required'),
    );
    expect(allowed.repository.issueQuote).toHaveBeenCalledOnce();
  });
  it.each(operations)(
    '$path absent repo skips bad UUID/body/header while session still precedes routing',
    async (op) => {
      const f = fixture([], false);
      expect(await f.dispatch(op.path.replace(id, 'bad'), null, { key: undefined })).toEqual(
        missing,
      );
      expect(await f.dispatch(op.path, {}, { key: undefined })).toEqual(missing);
      expect(await f.dispatch(op.path, null, { session: false })).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
      expect(f.authenticate).toHaveBeenCalledTimes(2);
      noCalls(f);
    },
  );
  it.each(operations)('$path unsupported methods and path boundaries remain 404', async (op) => {
    const f = fixture([]);
    for (const method of ['GET', 'PATCH', 'DELETE', 'OPTIONS'])
      expect(await f.dispatch(op.path, null, { method })).toEqual(missing);
    for (const path of [`${op.path}/`, op.path.toUpperCase(), `${op.path}/unknown`])
      expect(await f.dispatch(path, null)).toEqual(missing);
    noCalls(f);
  });
  it('GET quote view, line-first create/revision, and CRM matcher retain their own behavior', async () => {
    const f = fixture([['quote:read', grant]]);
    expect(await f.dispatch('/api/v1/quotes', null, { method: 'GET', key: undefined })).toEqual(
      response(200, { items: [result] }),
    );
    expect(f.repository.listCommercialView).toHaveBeenCalledExactlyOnceWith(
      'quotes',
      actor,
      ['TEAM'],
      anchors,
    );
    expect(await f.dispatch('/api/v1/quotes', null)).toEqual(
      invalid('A JSON object body is required'),
    );
    expect(await f.dispatch('/api/v1/quotes/bad/revisions', null)).toEqual(
      invalid('A JSON object body is required'),
    );
    expect(await f.dispatch('/api/v1/customers', null, { method: 'GET' })).toEqual(
      error(503, 'internal_error', 'CRM dependency unavailable'),
    );
    for (const method of methods) expect(f.repository[method]).not.toHaveBeenCalled();
  });
  it.each(operations)('$path preserves repository/global errors and correlation', async (op) => {
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
