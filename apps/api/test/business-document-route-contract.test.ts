// Frozen against old buildApp at 5707ff6 (business source unchanged from 6ba55c4).
// Synthetic HTTP mocks characterize dispatch/evaluation, not SQL or production credentials.
import { describe, expect, it, vi, type Mock } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest, type ApiResponse } from '../src/app.js';

type Repository = NonNullable<ApiDependencies['businessDocuments']>;
type Method =
  | 'listConnectors'
  | 'configureConnector'
  | 'activityLog'
  | 'list'
  | 'referenceData'
  | 'create'
  | 'get'
  | 'saveVersion'
  | 'updateBindings'
  | 'transition'
  | 'createTranslation'
  | 'recordClientActivity'
  | 'dispatch';
type Kind =
  | 'connectors'
  | 'configure'
  | 'audit'
  | 'list'
  | 'reference'
  | 'create'
  | 'detail'
  | 'version'
  | 'bindings'
  | 'review'
  | 'translation'
  | 'activity'
  | 'send';
type Row = Readonly<{
  label: string;
  method: string;
  path: string;
  repo: Method;
  cap: PermissionKey;
  kind: Kind;
  status: number;
  action?: string;
}>;
type Call = (...args: unknown[]) => Promise<unknown>;
type MutableDependencies = { -readonly [K in keyof ApiDependencies]: ApiDependencies[K] };
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '88888888-8888-4888-8888-888888888888';
const actor = { employeeId: id, companyId: 'old-business-document-http-mock' };
const base = '/api/v1/business-documents';
const methods: readonly Method[] = [
  'listConnectors',
  'configureConnector',
  'activityLog',
  'list',
  'referenceData',
  'create',
  'get',
  'saveVersion',
  'updateBindings',
  'transition',
  'createTranslation',
  'recordClientActivity',
  'dispatch',
];
const capabilities: readonly PermissionKey[] = [
  'business-document:configure',
  'business-document:send',
  'business-document:translate',
  'business-document:audit',
  'business-document:read',
  'business-document:manage',
  'business-document:approve',
];
const rows: readonly Row[] = [
  {
    label: 'connectors',
    method: 'GET',
    path: '/api/v1/document-connectors',
    repo: 'listConnectors',
    cap: 'business-document:configure',
    kind: 'connectors',
    status: 200,
  },
  {
    label: 'configure',
    method: 'PUT',
    path: '/api/v1/document-connectors/EMAIL',
    repo: 'configureConnector',
    cap: 'business-document:configure',
    kind: 'configure',
    status: 200,
  },
  {
    label: 'audit',
    method: 'GET',
    path: '/api/v1/business-document-activity',
    repo: 'activityLog',
    cap: 'business-document:audit',
    kind: 'audit',
    status: 200,
  },
  {
    label: 'list',
    method: 'GET',
    path: base,
    repo: 'list',
    cap: 'business-document:read',
    kind: 'list',
    status: 200,
  },
  {
    label: 'reference',
    method: 'GET',
    path: base + '/reference-data',
    repo: 'referenceData',
    cap: 'business-document:manage',
    kind: 'reference',
    status: 200,
  },
  {
    label: 'create',
    method: 'POST',
    path: base,
    repo: 'create',
    cap: 'business-document:manage',
    kind: 'create',
    status: 201,
  },
  {
    label: 'detail',
    method: 'GET',
    path: base + '/' + id,
    repo: 'get',
    cap: 'business-document:read',
    kind: 'detail',
    status: 200,
  },
  {
    label: 'version',
    method: 'POST',
    path: base + '/' + id + '/versions',
    repo: 'saveVersion',
    cap: 'business-document:manage',
    kind: 'version',
    status: 201,
  },
  {
    label: 'bindings',
    method: 'PATCH',
    path: base + '/' + id + '/bindings',
    repo: 'updateBindings',
    cap: 'business-document:manage',
    kind: 'bindings',
    status: 200,
  },
  ...(['submit', 'approve', 'reject'] as const).map(
    (action): Row => ({
      label: action,
      method: 'POST',
      path: base + '/' + id + '/' + action,
      repo: 'transition',
      cap: action === 'submit' ? 'business-document:manage' : 'business-document:approve',
      kind: 'review',
      status: 201,
      action: action === 'submit' ? 'SUBMITTED' : action === 'approve' ? 'APPROVED' : 'REJECTED',
    }),
  ),
  {
    label: 'translation',
    method: 'POST',
    path: base + '/' + id + '/translations',
    repo: 'createTranslation',
    cap: 'business-document:translate',
    kind: 'translation',
    status: 201,
  },
  {
    label: 'activity',
    method: 'POST',
    path: base + '/' + id + '/activity',
    repo: 'recordClientActivity',
    cap: 'business-document:read',
    kind: 'activity',
    status: 201,
  },
  {
    label: 'send',
    method: 'POST',
    path: base + '/' + id + '/send',
    repo: 'dispatch',
    cap: 'business-document:send',
    kind: 'send',
    status: 202,
  },
];
const writes = rows.filter((row) => row.method !== 'GET');
const rawDocuments = rows.filter((row) => row.path.includes(id));
const record = (value: unknown) => value as Record<string, unknown>;
function rowFor(kind: Kind): Row {
  const row = rows.find((candidate) => candidate.kind === kind);
  if (!row) throw new Error('missing characterization row');
  return row;
}
function property(target: object, key: PropertyKey, get: () => unknown) {
  Object.defineProperty(target, key, { configurable: true, enumerable: true, get });
}
function bodyFor(row: Row): Record<string, unknown> {
  switch (row.kind) {
    case 'configure':
      return {
        provider: ' MOCK_PROVIDER ',
        displayName: ' Mock Connector ',
        status: 'DISABLED',
        expectedVersion: 0,
        configuration: { endpoint: 'unit-only' },
      };
    case 'create':
      return {
        templateKey: ' TEMPLATE ',
        title: ' Title ',
        route: ' not-whitelisted-route ',
        content: { nested: { unit: true } },
      };
    case 'version':
      return { expectedVersion: 1, content: { nested: { unit: true } }, changeSummary: ' Change ' };
    case 'bindings':
      return {};
    case 'review':
      return { expectedVersion: 1, reason: ' Reason ' };
    case 'translation':
      return { expectedVersion: 1, targetLocale: ' en-US ' };
    case 'activity':
      return { action: ' PRINTED ', version: 1 };
    case 'send':
      return {
        expectedVersion: 1,
        channel: ' EMAIL ',
        recipientName: ' Recipient ',
        recipientAddress: ' Recipient@Example.COM ',
        subject: ' Subject ',
        message: ' Message ',
      };
    default:
      return {};
  }
}
function fixture() {
  const scopes: readonly DataScope[] = ['COMPANY'];
  const permissions = new Map<PermissionKey, Grant>(
    capabilities.map((cap) => [cap, { fields: null, scopes }]),
  );
  const authorization: AuthorizationContext = { actor, permissions, scopeAnchors: new Map() };
  const result = { id: other, unprojected: { nested: true }, state: 'OPAQUE' };
  const calls = Object.fromEntries(
    methods.map((name) => [name, vi.fn<Call>().mockResolvedValue(result)]),
  ) as Record<Method, Mock<Call>>;
  const repository = calls as unknown as Repository;
  const authenticate = vi
    .fn<() => Promise<AuthorizationContext | null>>()
    .mockResolvedValue(authorization);
  const dependencies = {
    auth: { authenticate },
    businessDocuments: repository,
  } as unknown as MutableDependencies;
  const app = buildApp(dependencies);
  const request = (row: Row, patch: Partial<ApiRequest> = {}): ApiRequest => ({
    method: row.method,
    pathname: row.path,
    body: bodyFor(row),
    query: { route: ' unparsed route ', documentId: id, actorId: other, limit: '2' },
    headers: {
      authorization: 'Bearer synthetic-unit-session',
      'x-correlation-id': correlationId,
      'idempotency-key': 'abcdefgh',
    },
    ...patch,
  });
  return {
    app,
    dependencies,
    repository,
    calls,
    authenticate,
    permissions,
    authorization,
    scopes,
    result,
    request,
  };
}
function errorBody(response: ApiResponse, status: number, message?: string) {
  expect(response.statusCode).toBe(status);
  const error = record(record(response.body).error);
  expect(error.correlationId).toBe(correlationId);
  if (message !== undefined) expect(error.message).toBe(message);
  expect(response.headers?.['x-correlation-id']).toBe(correlationId);
  return error;
}
function expectedArgs(
  row: Row,
  body: Record<string, unknown>,
  scopes: readonly DataScope[],
): unknown[] {
  const scope = { actor, scopes };
  switch (row.kind) {
    case 'connectors':
      return [actor, true];
    case 'configure':
      return [
        'EMAIL',
        {
          provider: 'MOCK_PROVIDER',
          displayName: 'Mock Connector',
          senderIdentity: null,
          secretReference: null,
          configuration: body.configuration,
          status: 'DISABLED',
          expectedVersion: 0,
        },
        actor,
        correlationId,
      ];
    case 'audit':
      return [actor, { documentId: id, actorId: other, limit: 2 }];
    case 'list':
      return [' unparsed route ', scope];
    case 'reference':
      return [scope];
    case 'create':
      return [
        {
          templateKey: 'TEMPLATE',
          title: 'Title',
          route: 'not-whitelisted-route',
          content: body.content,
        },
        actor,
        correlationId,
      ];
    case 'detail':
      return [id, { ...scope, includeAudit: true }];
    case 'version':
      return [
        id,
        { expectedVersion: 1, content: body.content, changeSummary: 'Change' },
        scope,
        correlationId,
      ];
    case 'bindings':
      return [
        id,
        {
          customerId: undefined,
          salesOrderId: undefined,
          operatorId: undefined,
          salespersonId: undefined,
          assignedTo: undefined,
        },
        scope,
        correlationId,
      ];
    case 'review':
      return [
        id,
        { expectedVersion: 1, action: row.action, reason: 'Reason' },
        scope,
        correlationId,
      ];
    case 'translation':
      return [id, { expectedVersion: 1, targetLocale: 'en-US' }, scope, correlationId];
    case 'activity':
      return [id, 'PRINTED', 1, scope, correlationId];
    case 'send':
      return [
        id,
        {
          expectedVersion: 1,
          channel: 'EMAIL',
          recipientName: 'Recipient',
          recipientAddress: 'recipient@example.com',
          subject: 'Subject',
          message: 'Message',
          idempotencyKey: 'abcdefgh',
        },
        scope,
        correlationId,
      ];
  }
}
describe('old business-document buildApp HTTP contract', () => {
  it('pins 13 support branches / 15 canonical paths / 13 repository methods', () => {
    expect(rows).toHaveLength(15);
    expect(new Set(rows.map((row) => row.method + ' ' + row.path)).size).toBe(15);
    expect(new Set(rows.map((row) => row.repo)).size).toBe(13);
  });
  for (const row of rows) {
    it(row.label + ': exact arguments, receiver, raw response, correlation', async () => {
      const f = fixture(),
        request = f.request(row);
      const response = await f.app.dispatch(request);
      expect(response.statusCode).toBe(row.status);
      expect(f.calls[row.repo].mock.calls).toEqual([
        expectedArgs(row, record(request.body), f.scopes),
      ]);
      expect(f.calls[row.repo].mock.contexts[0]).toBe(f.repository);
      const args = f.calls[row.repo].mock.calls[0] ?? [];
      if (row.kind === 'connectors' || row.kind === 'audit') expect(args[0]).toBe(actor);
      else if (row.kind === 'configure') expect(args[2]).toBe(actor);
      else if (row.kind === 'create') expect(args[1]).toBe(actor);
      else {
        const scopeIndex =
          row.kind === 'reference'
            ? 0
            : row.kind === 'activity'
              ? 3
              : row.kind === 'list' || row.kind === 'detail'
                ? 1
                : 2;
        const scope = record(args[scopeIndex]);
        expect(scope.actor).toBe(actor);
        expect(scope.scopes).toBe(f.scopes);
      }
      if (['connectors', 'audit', 'list'].includes(row.kind))
        expect(record(response.body).items).toBe(f.result);
      else expect(response.body).toBe(f.result);
      expect(response.headers?.['x-correlation-id']).toBe(correlationId);
    });
    it(row.label + ': repository guard and callee are exactly two late root reads', async () => {
      const f = fixture();
      const second = { ...f.calls };
      const call = vi.fn<Call>().mockResolvedValue(f.result);
      second[row.repo] = call;
      let reads = 0;
      Object.defineProperty(f.dependencies, 'businessDocuments', {
        get() {
          reads += 1;
          return reads === 1 ? f.repository : second;
        },
      });
      expect((await f.app.dispatch(f.request(row))).statusCode).toBe(row.status);
      expect(reads).toBe(2);
      expect(f.calls[row.repo]).not.toHaveBeenCalled();
      expect(call).toHaveBeenCalledTimes(1);
      expect(call.mock.contexts[0]).toBe(second);
    });
    it(row.label + ': global unauthenticated precedes missing repository/body', async () => {
      const f = fixture();
      f.authenticate.mockResolvedValue(null);
      delete f.dependencies.businessDocuments;
      errorBody(
        await f.app.dispatch(f.request(row, { body: null })),
        401,
        'A valid session is required',
      );
      expect(f.calls[row.repo]).not.toHaveBeenCalled();
    });
    it(row.label + ': authorization precedes repository/body/path validation', async () => {
      const f = fixture();
      f.permissions.clear();
      delete f.dependencies.businessDocuments;
      errorBody(await f.app.dispatch(f.request(row, { body: null })), 403, 'Permission denied');
    });
    it(row.label + ': authorized missing repository is 503 before body', async () => {
      const f = fixture();
      delete f.dependencies.businessDocuments;
      errorBody(
        await f.app.dispatch(f.request(row, { body: null })),
        503,
        'Business document repository unavailable',
      );
    });
    it(row.label + ': no requested-field check or response projection is added', async () => {
      const f = fixture();
      for (const cap of capabilities) f.permissions.set(cap, { fields: [], scopes: f.scopes });
      const response = await f.app.dispatch(f.request(row));
      expect(response.statusCode).toBe(row.status);
      const value = ['connectors', 'audit', 'list'].includes(row.kind)
        ? record(response.body).items
        : response.body;
      expect(value).toBe(f.result);
    });
    it(row.label + ': empty scope denies except configure-presence connector list', async () => {
      const f = fixture();
      f.permissions.clear();
      f.permissions.set(row.cap, { fields: [], scopes: [] });
      const response = await f.app.dispatch(f.request(row));
      if (row.kind === 'connectors') {
        expect(response.statusCode).toBe(200);
        expect(f.calls.listConnectors).toHaveBeenCalledWith(actor, true);
      } else errorBody(response, 403, 'Permission denied');
    });
    for (const [code, status] of [
      ['invalid_request', 400],
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
    ] as const) {
      it(row.label + ': repository DomainError ' + code + ' is unchanged', async () => {
        const f = fixture();
        f.calls[row.repo].mockRejectedValue(new DomainError(code, 'repository marker'));
        expect(
          errorBody(await f.app.dispatch(f.request(row)), status, 'repository marker').code,
        ).toBe(code);
      });
    }
    it(row.label + ': ordinary repository failure remains opaque 500', async () => {
      const f = fixture();
      f.calls[row.repo].mockRejectedValue(new Error('not exposed'));
      errorBody(await f.app.dispatch(f.request(row)), 500, 'Internal server error');
    });
    it(
      row.label + ': active method getter failure keeps its receiver-evaluation position',
      async () => {
        const f = fixture();
        property(f.repository, row.repo, () => {
          throw new DomainError('conflict', 'callee marker');
        });
        errorBody(await f.app.dispatch(f.request(row)), 409, 'callee marker');
      },
    );
    it(
      row.label + ': await permission mutation does not introduce late read authorization',
      async () => {
        const f = fixture();
        f.calls[row.repo].mockImplementation(() => {
          f.permissions.clear();
          return Promise.resolve(f.result);
        });
        expect((await f.app.dispatch(f.request(row))).statusCode).toBe(row.status);
      },
    );
    for (const [label, result] of [
      ['null', null],
      ['date', new Date(0)],
      ['array', []],
      ['number', 7],
      ['string', 'opaque-result'],
    ] as const) {
      it(row.label + ': opaque mock result ' + label + ' is not reshaped', async () => {
        const f = fixture();
        f.calls[row.repo].mockResolvedValue(result);
        const response = await f.app.dispatch(f.request(row));
        expect(response.statusCode).toBe(row.status);
        expect(
          ['connectors', 'audit', 'list'].includes(row.kind)
            ? record(response.body).items
            : response.body,
        ).toBe(result);
      });
    }
    for (const suffix of ['/', '/extra', '?x=1', '#fragment', '/versions/extra', '/send/extra']) {
      it(row.label + ': unsupported pathname suffix ' + suffix, async () => {
        const f = fixture();
        f.permissions.clear();
        errorBody(
          await f.app.dispatch(f.request(row, { pathname: row.path + suffix, body: null })),
          404,
          'Route not found',
        );
      });
    }
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE']) {
      if (rows.some((otherRow) => otherRow.path === row.path && otherRow.method === method))
        continue;
      it(row.label + ': unsupported method ' + method + ' does not touch repository', async () => {
        const f = fixture();
        let roots = 0;
        f.permissions.clear();
        property(f.dependencies, 'businessDocuments', () => {
          roots++;
          throw new Error('unmatched root');
        });
        errorBody(
          await f.app.dispatch(f.request(row, { method, body: null })),
          404,
          'Route not found',
        );
        expect(roots).toBe(0);
      });
    }
    it(row.label + ': public request spread getter throws outside inner catch', async () => {
      const f = fixture(),
        request = { ...f.request(row) };
      property(request, 'body', () => {
        throw new Error('outer spread');
      });
      await expect(f.app.dispatch(request)).rejects.toThrow('outer spread');
    });
  }
  for (const row of writes) {
    for (const [label, body] of [
      ['null', null],
      ['undefined', undefined],
      ['array', []],
      ['string', 'x'],
      ['number', 1],
      ['boolean', true],
    ] as const) {
      it(row.label + ': body shape ' + label + ' after authorization/repository', async () => {
        const f = fixture();
        errorBody(
          await f.app.dispatch(f.request(row, { body })),
          400,
          'A JSON object body is required',
        );
      });
    }
    it(row.label + ': unknown own keys sorted before values/method capture', async () => {
      const f = fixture(),
        body = { ...bodyFor(row), zUnexpected: true, aUnexpected: undefined };
      errorBody(
        await f.app.dispatch(f.request(row, { body })),
        400,
        'Unsupported fields: aUnexpected, zUnexpected',
      );
      expect(f.calls[row.repo]).not.toHaveBeenCalled();
    });
    it(
      row.label + ': inherited values / symbol / non-enumerable unknown keys retain old access',
      async () => {
        const f = fixture(),
          body = Object.create(bodyFor(row)) as Record<string, unknown>;
        Object.defineProperty(body, 'notEnumerated', { value: true });
        body[Symbol('ignored') as unknown as string] = true;
        expect((await f.app.dispatch(f.request(row, { body }))).statusCode).toBe(row.status);
      },
    );
    it(row.label + ': allow ownKeys may replace root before callee capture', async () => {
      const f = fixture(),
        second = fixture();
      const body = new Proxy(bodyFor(row), {
        ownKeys(target) {
          f.dependencies.businessDocuments = second.repository;
          return Reflect.ownKeys(target);
        },
      });
      expect((await f.app.dispatch(f.request(row, { body }))).statusCode).toBe(row.status);
      expect(f.calls[row.repo]).not.toHaveBeenCalled();
      expect(second.calls[row.repo]).toHaveBeenCalledOnce();
      expect(second.calls[row.repo].mock.contexts[0]).toBe(second.repository);
    });
    it(row.label + ': input getter replaces root only after original method capture', async () => {
      const f = fixture(),
        second = fixture(),
        body = bodyFor(row);
      const field =
        row.kind === 'configure'
          ? 'provider'
          : row.kind === 'create'
            ? 'templateKey'
            : row.kind === 'bindings'
              ? 'customerId'
              : row.kind === 'activity'
                ? 'version'
                : 'expectedVersion';
      const value = body[field];
      property(body, field, () => {
        f.dependencies.businessDocuments = second.repository;
        return value;
      });
      expect((await f.app.dispatch(f.request(row, { body }))).statusCode).toBe(row.status);
      expect(f.calls[row.repo]).toHaveBeenCalledOnce();
      expect(second.calls[row.repo]).not.toHaveBeenCalled();
      expect(f.calls[row.repo].mock.contexts[0]).toBe(f.repository);
    });
    it(
      row.label + ': undefined method still evaluates malformed input before call failure',
      async () => {
        const f = fixture(),
          body = bodyFor(row);
        Reflect.deleteProperty(f.repository, row.repo);
        if (row.kind === 'configure') body.provider = 'lowercase';
        else if (row.kind === 'create') body.templateKey = '';
        else if (row.kind === 'bindings') body.customerId = 'invalid';
        else if (row.kind === 'activity') body.version = 0;
        else body.expectedVersion = 0;
        expect((await f.app.dispatch(f.request(row, { body }))).statusCode).toBe(400);
        errorBody(await f.app.dispatch(f.request(row)), 500, 'Internal server error');
      },
    );
  }
  for (const row of rawDocuments) {
    for (const rawId of ['a', '-', 'a---']) {
      it(row.label + ': raw short ID ' + rawId + ' retains bindings exception', async () => {
        const f = fixture(),
          response = await f.app.dispatch(
            f.request(row, { pathname: row.path.replace(id, rawId) }),
          );
        if (row.kind === 'bindings') {
          expect(response.statusCode).toBe(200);
          expect(f.calls.updateBindings.mock.calls[0]?.[0]).toBe(rawId);
        } else errorBody(response, 400, 'documentId must be a UUID');
      });
    }
    it(row.label + ': uppercase raw ID misses lowercase matcher', async () => {
      const f = fixture();
      errorBody(
        await f.app.dispatch(f.request(row, { pathname: row.path.replace(id, id.toUpperCase()) })),
        404,
        'Route not found',
      );
    });
    it(
      row.label + ': active method getter wins malformed UUID after body preprocessing',
      async () => {
        const f = fixture();
        property(f.repository, row.repo, () => {
          throw new DomainError('conflict', 'method first');
        });
        errorBody(
          await f.app.dispatch(f.request(row, { pathname: row.path.replace(id, 'a') })),
          409,
          'method first',
        );
      },
    );
  }
});

describe('business-document route-specific old parser and priority edges', () => {
  const create = rowFor('create'),
    bindings = rowFor('bindings'),
    configure = rowFor('configure');
  const translation = rowFor('translation'),
    activity = rowFor('activity'),
    send = rowFor('send');
  for (const value of [undefined, null, '', false, 0]) {
    for (const key of [
      'subjectType',
      'customerId',
      'salesOrderId',
      'operatorId',
      'salespersonId',
      'assignedTo',
    ]) {
      it('create truthy optional ' + key + ' skips ' + String(value), async () => {
        const f = fixture(),
          body = { ...bodyFor(create), [key]: value, subjectId: 'not-read' };
        expect((await f.app.dispatch(f.request(create, { body }))).statusCode).toBe(201);
        expect(record(f.calls.create.mock.calls[0]?.[0])).not.toHaveProperty(key);
      });
    }
  }
  it('create optional UUID case/trim, subject pair and content identity/order', async () => {
    const f = fixture(),
      body: Record<string, unknown> = {
        ...bodyFor(create),
        subjectType: ' ANY_KIND ',
        subjectId: ' ' + id.toUpperCase() + ' ',
        customerId: other,
        salesOrderId: id,
        operatorId: other,
        salespersonId: id,
        assignedTo: other,
      };
    expect((await f.app.dispatch(f.request(create, { body }))).statusCode).toBe(201);
    expect(f.calls.create.mock.calls[0]?.[0]).toEqual({
      templateKey: 'TEMPLATE',
      title: 'Title',
      route: 'not-whitelisted-route',
      subjectType: 'ANY_KIND',
      subjectId: id.toUpperCase(),
      customerId: other,
      salesOrderId: id,
      operatorId: other,
      salespersonId: id,
      assignedTo: other,
      content: body.content,
    });
    expect(record(f.calls.create.mock.calls[0]?.[0]).content).toBe(body.content);
  });
  for (const key of ['templateKey', 'title', 'route'])
    for (const value of [undefined, null, '', 1]) {
      it('create original required string ' + key + '/' + String(value), async () => {
        const f = fixture();
        errorBody(
          await f.app.dispatch(f.request(create, { body: { ...bodyFor(create), [key]: value } })),
          400,
          key + ' is required',
        );
      });
    }
  for (const value of [undefined, null, [], 'not-json']) {
    it('create content remains last required shallow JSON / ' + String(value), async () => {
      const f = fixture();
      errorBody(
        await f.app.dispatch(f.request(create, { body: { ...bodyFor(create), content: value } })),
        400,
        'content must be a JSON object',
      );
    });
  }
  for (const field of ['customerId', 'salesOrderId', 'operatorId', 'salespersonId', 'assignedTo']) {
    for (const [label, value, parsed] of [
      ['undefined', undefined, undefined],
      ['null', null, null],
      ['empty', '', null],
      ['uuid', ' ' + id.toUpperCase() + ' ', id.toUpperCase()],
    ] as const) {
      it('bindings explicit key ' + field + '/' + label, async () => {
        const f = fixture();
        expect(
          (await f.app.dispatch(f.request(bindings, { body: { [field]: value } }))).statusCode,
        ).toBe(200);
        const input = record(f.calls.updateBindings.mock.calls[0]?.[1]);
        expect(Object.keys(input)).toEqual([
          'customerId',
          'salesOrderId',
          'operatorId',
          'salespersonId',
          'assignedTo',
        ]);
        expect(input[field]).toBe(parsed);
      });
    }
    for (const value of [' ', false, 0, 'invalid']) {
      it('bindings rejects non-nullish invalid ' + field + '/' + String(value), async () => {
        const f = fixture();
        expect(
          (await f.app.dispatch(f.request(bindings, { body: { [field]: value } }))).statusCode,
        ).toBe(400);
      });
    }
  }
  for (const row of rows.filter((r) =>
    ['version', 'review', 'translation', 'activity', 'send'].includes(r.kind),
  )) {
    const key = row.kind === 'activity' ? 'version' : 'expectedVersion';
    for (const value of [undefined, null, 0, -1, 1.2, '1', Number.MAX_SAFE_INTEGER + 1]) {
      it(
        row.label + ': positive version not connector nonnegative / ' + String(value),
        async () => {
          const f = fixture();
          errorBody(
            await f.app.dispatch(f.request(row, { body: { ...bodyFor(row), [key]: value } })),
            400,
            'version must be a positive integer',
          );
        },
      );
    }
    it(row.label + ': maximum safe positive version passes unchanged', async () => {
      const f = fixture();
      expect(
        (
          await f.app.dispatch(
            f.request(row, { body: { ...bodyFor(row), [key]: Number.MAX_SAFE_INTEGER } }),
          )
        ).statusCode,
      ).toBe(row.status);
    });
  }
  for (const targetLocale of ['en', 'eng', 'en-US', 'zh-CN', ' fr ']) {
    it('translation locale accepts original pattern ' + targetLocale, async () => {
      const f = fixture();
      expect(
        (
          await f.app.dispatch(
            f.request(translation, { body: { expectedVersion: 1, targetLocale } }),
          )
        ).statusCode,
      ).toBe(201);
      expect(record(f.calls.createTranslation.mock.calls[0]?.[1]).targetLocale).toBe(
        targetLocale.trim(),
      );
    });
  }
  for (const targetLocale of ['', 'EN', 'en-us', 'en_US', 'english', null]) {
    it('translation locale rejects ' + String(targetLocale), async () => {
      const f = fixture();
      expect(
        (
          await f.app.dispatch(
            f.request(translation, { body: { expectedVersion: 1, targetLocale } }),
          )
        ).statusCode,
      ).toBe(400);
    });
  }
  for (const value of [undefined, {}, new Date(0), null, []]) {
    it(
      'translation content undefined omission vs shallow JSON ' + JSON.stringify(value),
      async () => {
        const f = fixture(),
          response = await f.app.dispatch(
            f.request(translation, { body: { ...bodyFor(translation), content: value } }),
          );
        if (value === null || Array.isArray(value)) expect(response.statusCode).toBe(400);
        else {
          expect(response.statusCode).toBe(201);
          const input = record(f.calls.createTranslation.mock.calls[0]?.[1]);
          expect(Object.hasOwn(input, 'content')).toBe(value !== undefined);
          if (value !== undefined) expect(input.content).toBe(value);
        }
      },
    );
  }
  for (const action of ['PRINTED', 'DOWNLOADED', ' PRINTED ']) {
    it('client activity read-capability / action ' + action, async () => {
      const f = fixture();
      f.permissions.clear();
      f.permissions.set('business-document:read', { fields: [], scopes: f.scopes });
      expect(
        (await f.app.dispatch(f.request(activity, { body: { action, version: 1 } }))).statusCode,
      ).toBe(201);
      expect(f.calls.recordClientActivity.mock.calls[0]?.[1]).toBe(action.trim());
    });
  }
  it('activity unsupported action wins bad UUID and version', async () => {
    const f = fixture();
    errorBody(
      await f.app.dispatch(
        f.request(activity, {
          pathname: activity.path.replace(id, 'a'),
          body: { action: 'emailed', version: 0 },
        }),
      ),
      400,
      'document activity is unsupported',
    );
  });
  for (const key of [undefined, '', '1234567', 'x'.repeat(129)]) {
    it('send header length first, before malformed body / ' + String(key?.length), async () => {
      const f = fixture();
      errorBody(
        await f.app.dispatch(
          f.request(send, {
            body: null,
            headers: { ...f.request(send).headers, 'idempotency-key': key },
          }),
        ),
        400,
        'Idempotency-Key header must contain 8 to 128 characters',
      );
    });
  }
  for (const key of [' '.repeat(8), 'abcdefgh', 'x'.repeat(128)]) {
    it('send accepts untrimmed header length ' + String(key.length), async () => {
      const f = fixture();
      expect(
        (
          await f.app.dispatch(
            f.request(send, { headers: { ...f.request(send).headers, 'idempotency-key': key } }),
          )
        ).statusCode,
      ).toBe(202);
      expect(record(f.calls.dispatch.mock.calls[0]?.[1]).idempotencyKey).toBe(key);
    });
  }
  for (const channel of [
    'EMAIL',
    'WECHAT_WORK',
    'WHATSAPP_BUSINESS',
    'MICROSOFT_TEAMS',
    'TELEGRAM',
    'LINE',
  ]) {
    it('send connector enum ' + channel + ' / original email normalization only', async () => {
      const f = fixture();
      expect(
        (await f.app.dispatch(f.request(send, { body: { ...bodyFor(send), channel } }))).statusCode,
      ).toBe(202);
      expect(record(f.calls.dispatch.mock.calls[0]?.[1]).recipientAddress).toBe(
        channel === 'EMAIL' ? 'recipient@example.com' : 'Recipient@Example.COM',
      );
    });
  }
  for (const channel of ['TRANSLATION', 'email', 'SMS']) {
    it('send rejects unsupported channel before bad UUID / ' + channel, async () => {
      const f = fixture();
      errorBody(
        await f.app.dispatch(
          f.request(send, {
            pathname: send.path.replace(id, 'a'),
            body: { ...bodyFor(send), channel },
          }),
        ),
        400,
        'document connector is unsupported',
      );
    });
  }
  it('send malformed email is checked before method getter and UUID', async () => {
    const f = fixture();
    property(f.repository, 'dispatch', () => {
      throw new Error('too late');
    });
    errorBody(
      await f.app.dispatch(
        f.request(send, {
          pathname: send.path.replace(id, 'a'),
          body: { ...bodyFor(send), recipientAddress: 'not-email' },
        }),
      ),
      400,
      'Contact email is malformed',
    );
  });
  for (const [field, length] of [
    ['recipientName', 200],
    ['subject', 200],
    ['message', 4000],
    ['recipientAddress', 320],
  ] as const) {
    it('send bounded field ' + field + ' over max', async () => {
      const f = fixture();
      const body = { ...bodyFor(send), channel: 'TELEGRAM', [field]: 'x'.repeat(length + 1) };
      errorBody(
        await f.app.dispatch(f.request(send, { body })),
        400,
        field + ' exceeds ' + String(length) + ' characters',
      );
    });
    it('send bounded field ' + field + ' exact max', async () => {
      const f = fixture();
      expect(
        (
          await f.app.dispatch(
            f.request(send, {
              body: { ...bodyFor(send), channel: 'TELEGRAM', [field]: 'x'.repeat(length) },
            }),
          )
        ).statusCode,
      ).toBe(202);
    });
  }
  for (const value of [undefined, null, '', false, 0, id.toUpperCase()]) {
    it('send translationId truthy optional / ' + String(value), async () => {
      const f = fixture();
      expect(
        (
          await f.app.dispatch(
            f.request(send, { body: { ...bodyFor(send), translationId: value } }),
          )
        ).statusCode,
      ).toBe(202);
      const input = record(f.calls.dispatch.mock.calls[0]?.[1]);
      expect(Object.hasOwn(input, 'translationId')).toBe(Boolean(value));
      if (value) expect(input.translationId).toBe(value);
    });
  }
  for (const status of ['UNCONFIGURED', 'DISABLED', 'READY']) {
    it('configure original status ' + status + ' and nonnegative version 0', async () => {
      const f = fixture(),
        body = {
          ...bodyFor(configure),
          status,
          secretReference: status === 'READY' ? 'KINGTURF_CONNECTOR_TEST_ONLY' : null,
        };
      expect((await f.app.dispatch(f.request(configure, { body }))).statusCode).toBe(200);
      expect(record(f.calls.configureConnector.mock.calls[0]?.[1]).expectedVersion).toBe(0);
    });
  }
  for (const value of [undefined, null, '', '  ']) {
    it('configure READY original managed-reference check / ' + String(value), async () => {
      const f = fixture();
      expect(
        (
          await f.app.dispatch(
            f.request(configure, {
              body: { ...bodyFor(configure), status: 'READY', secretReference: value },
            }),
          )
        ).statusCode,
      ).toBe(400);
    });
  }
  for (const value of [undefined, null, '', 'AB', 'A'.repeat(200), 'A', 'A'.repeat(201), '  ']) {
    it('configure nullable sender length / ' + String(value?.length), async () => {
      const f = fixture();
      expect(
        (
          await f.app.dispatch(
            f.request(configure, { body: { ...bodyFor(configure), senderIdentity: value } }),
          )
        ).statusCode,
      ).toBe(value === 'A' || value?.length === 201 || value === '  ' ? 400 : 200);
    });
  }
  for (const value of [
    undefined,
    null,
    {},
    new Date(0),
    [],
    { nested: { password: 'synthetic-not-a-secret' } },
    { values: [{ apiKey: 'synthetic-not-a-secret' }] },
  ]) {
    it(
      'configure configuration nullish/default/nested secret-key rejection / ' +
        JSON.stringify(value),
      async () => {
        const f = fixture();
        const response = await f.app.dispatch(
          f.request(configure, { body: { ...bodyFor(configure), configuration: value } }),
        );
        const bad =
          Array.isArray(value) ||
          (value !== null && typeof value === 'object' && ('nested' in value || 'values' in value));
        expect(response.statusCode).toBe(bad ? 400 : 200);
        if (!bad && value !== undefined && value !== null)
          expect(record(f.calls.configureConnector.mock.calls[0]?.[1]).configuration).toBe(value);
      },
    );
  }
  it('configure status / reference / sender / READY are all before method capture', async () => {
    const f = fixture();
    property(f.repository, 'configureConnector', () => {
      throw new Error('too late');
    });
    errorBody(
      await f.app.dispatch(
        f.request(configure, { body: { ...bodyFor(configure), status: 'READY' } }),
      ),
      400,
      'A managed secret reference is required before a connector can be enabled',
    );
  });
  it('configure raw uppercase path matcher accepts TRANSLATION, rejects lower path', async () => {
    const f = fixture();
    expect(
      (
        await f.app.dispatch(
          f.request(configure, { pathname: '/api/v1/document-connectors/TRANSLATION' }),
        )
      ).statusCode,
    ).toBe(200);
    errorBody(
      await f.app.dispatch(f.request(configure, { pathname: '/api/v1/document-connectors/email' })),
      404,
      'Route not found',
    );
  });
  it('connector list configure presence bypasses grant scopes, fallback prefers send', async () => {
    const row = rowFor('connectors'),
      f = fixture();
    f.permissions.clear();
    f.permissions.set('business-document:send', { fields: [], scopes: [] });
    f.permissions.set('business-document:translate', { fields: [], scopes: f.scopes });
    errorBody(await f.app.dispatch(f.request(row)), 403, 'Permission denied');
    f.permissions.delete('business-document:send');
    expect((await f.app.dispatch(f.request(row))).statusCode).toBe(200);
    expect(f.calls.listConnectors).toHaveBeenCalledWith(actor, false);
  });
  it('detail audit is Map.has presence, not another grant/scope authorization', async () => {
    const row = rowFor('detail'),
      f = fixture();
    f.permissions.set('business-document:audit', { fields: [], scopes: [] });
    expect((await f.app.dispatch(f.request(row))).statusCode).toBe(200);
    expect(record(f.calls.get.mock.calls[0]?.[1]).includeAudit).toBe(true);
    f.permissions.delete('business-document:audit');
    await f.app.dispatch(f.request(row));
    expect(record(f.calls.get.mock.calls[1]?.[1]).includeAudit).toBe(false);
  });
  it('audit query getters retain double reads and method-capture order', async () => {
    const f = fixture(),
      row = rowFor('audit');
    const call = f.calls.activityLog;
    const events: string[] = [];
    const query = Object.defineProperties(
      {},
      {
        limit: {
          get() {
            events.push('limit');
            return '2';
          },
        },
        documentId: {
          get() {
            events.push('documentId');
            return id;
          },
        },
        actorId: {
          get() {
            events.push('actorId');
            return other;
          },
        },
      },
    ) as NonNullable<ApiRequest['query']>;
    Object.defineProperty(f.repository, 'activityLog', {
      get() {
        events.push('method');
        return call;
      },
    });
    expect((await f.app.dispatch(f.request(row, { query }))).statusCode).toBe(200);
    expect(events).toEqual([
      'limit',
      'limit',
      'method',
      'documentId',
      'documentId',
      'actorId',
      'actorId',
    ]);
  });
  it('list method getter precedes query.route getter', async () => {
    const f = fixture(),
      row = rowFor('list');
    const events: string[] = [];
    const call = f.calls.list;
    Object.defineProperty(f.repository, 'list', {
      get() {
        events.push('method');
        return call;
      },
    });
    const query = Object.defineProperty({}, 'route', {
      get() {
        events.push('route');
        return 'raw';
      },
    }) as NonNullable<ApiRequest['query']>;
    expect((await f.app.dispatch(f.request(row, { query }))).statusCode).toBe(200);
    expect(events).toEqual(['method', 'route']);
  });
  it('list query.route passes opaque raw value, no string/enum normalization', async () => {
    const row = rowFor('list'),
      f = fixture(),
      route = { arbitrary: true };
    const query = { route } as unknown as NonNullable<ApiRequest['query']>;
    expect((await f.app.dispatch(f.request(row, { query }))).statusCode).toBe(200);
    expect(f.calls.list.mock.calls[0]?.[0]).toBe(route);
  });
  for (const limit of ['1', '200', '2e1', ' 2 ', '0', '201', '1.5', 'NaN', '']) {
    it('audit Number conversion/bounds / ' + limit, async () => {
      const row = rowFor('audit'),
        f = fixture(),
        n = Number(limit);
      const response = await f.app.dispatch(f.request(row, { query: { limit } }));
      expect(response.statusCode).toBe(Number.isInteger(n) && n >= 1 && n <= 200 ? 200 : 400);
      if (response.statusCode === 200)
        expect(f.calls.activityLog).toHaveBeenCalledWith(actor, { limit: n });
    });
  }
  it('audit limit conversion precedes bad optional UUID, truthy optional filters only', async () => {
    const row = rowFor('audit'),
      f = fixture();
    errorBody(
      await f.app.dispatch(f.request(row, { query: { limit: '0', documentId: 'invalid' } })),
      400,
      'limit must be an integer between 1 and 200',
    );
    expect(
      (await f.app.dispatch(f.request(row, { query: { documentId: '', actorId: '' } }))).statusCode,
    ).toBe(200);
    expect(f.calls.activityLog).toHaveBeenCalledWith(actor, {});
  });
});
