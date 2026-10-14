// Fixed against d70653a; only old buildApp, no future website route module.
// Signature placeholders are opaque mock values, never signing keys or HMAC material.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';
type Method = NonNullable<ApiDependencies['websiteLeads']>['ingest'];
type Result = Awaited<ReturnType<Method>>;
const path = '/api/v1/integrations/website/leads';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correlationId = '33333333-3333-4333-8333-333333333333';
const nested = { keep: true };
const returned: Result & { nested: typeof nested; extra: string } = {
  leadId: id,
  externalRef: 'mock-reference',
  status: 'POOL',
  duplicate: false,
  nested,
  extra: 'opaque-output',
};
const response = (statusCode: number, body: unknown) => ({
  statusCode,
  body,
  headers: { 'x-correlation-id': correlationId },
});
const error = (statusCode: number, code: string, message: string) =>
  response(statusCode, { error: { code, message, correlationId } });
function fixture(options: { available?: boolean; authenticated?: boolean } = {}) {
  const context: AuthorizationContext = {
    actor: { companyId: 'website-http-direct-mock', employeeId: id },
    permissions: new Map(),
    scopeAnchors: new Map(),
  };
  const permissionGet = vi.spyOn(context.permissions, 'get');
  const authenticate = vi
    .fn<ApiDependencies['auth']['authenticate']>()
    .mockResolvedValue(options.authenticated ? context : null);
  const login = vi.fn<ApiDependencies['auth']['login']>().mockResolvedValue(null);
  const ingest = vi.fn<Method>().mockResolvedValue(returned);
  const repository = { ingest };
  const dependencies: ApiDependencies = {
    auth: { authenticate, login } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false
      ? {}
      : { websiteLeads: repository as unknown as NonNullable<ApiDependencies['websiteLeads']> }),
  };
  const body: Record<string, unknown> = { anyField: nested };
  const headers: Record<string, string | undefined> = {
    'x-correlation-id': correlationId,
    'x-kingturf-timestamp': 'opaque-timestamp',
    'x-kingturf-signature': 'opaque-signature',
  };
  const app = buildApp(dependencies);
  const dispatch = (request: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: 'POST',
      pathname: path,
      body,
      ...request,
      headers: request.headers ?? headers,
    });
  return {
    dependencies,
    body,
    headers,
    context,
    permissionGet,
    authenticate,
    login,
    ingest,
    repository,
    dispatch,
  };
}
describe('old one public signed website ingest POST', () => {
  it('four raw args/original receiver/201 raw result ref/no session/grant/DTO', async () => {
    const f = fixture({ authenticated: true });
    const result = await f.dispatch({
      headers: { ...f.headers, authorization: 'Bearer mock-session' },
    });
    expect(result).toEqual(response(201, returned));
    expect(result.body).toBe(returned);
    const args = f.ingest.mock.calls[0];
    expect(args).toHaveLength(4);
    expect(args?.[0]).toBe(f.body);
    expect(args?.[1]).toBe(f.headers['x-kingturf-timestamp']);
    expect(args?.[2]).toBe(f.headers['x-kingturf-signature']);
    expect(args?.[3]).toBe(correlationId);
    expect(f.ingest.mock.contexts[0]).toBe(f.repository);
    expect((result.body as typeof returned).nested).toBe(nested);
    expect(Object.hasOwn(result.body as object, 'id')).toBe(false);
    expect(f.authenticate).not.toHaveBeenCalled();
    expect(f.permissionGet).not.toHaveBeenCalled();
    expect(f.login).not.toHaveBeenCalled();
  });
  it('missing overall dependencies503 before route/ingestor/session', async () => {
    expect(
      await buildApp().dispatch({
        method: 'POST',
        pathname: path,
        body: null,
        headers: { 'x-correlation-id': correlationId },
      }),
    ).toEqual(error(503, 'internal_error', 'Application dependencies are unavailable'));
  });
  it('missing ingestor503 before body validation/bearer/session', async () => {
    const f = fixture({ available: false });
    expect(
      await f.dispatch({
        body: null,
        headers: { ...f.headers, authorization: 'Bearer mock-session' },
      }),
    ).toEqual(error(503, 'internal_error', 'Website lead integration unavailable'));
    expect(f.authenticate).not.toHaveBeenCalled();
    expect(f.permissionGet).not.toHaveBeenCalled();
  });
  it.each([
    { name: 'undefined', value: undefined },
    { name: 'null', value: null },
    { name: 'array', value: [] },
    { name: 'false', value: false },
    { name: 'true', value: true },
    { name: 'zero', value: 0 },
    { name: 'number', value: 1 },
    { name: 'string', value: 'raw-mock' },
    { name: 'bigint', value: 1n },
    { name: 'symbol', value: Symbol('raw-mock') },
    { name: 'function', value: () => undefined },
    { name: 'date', value: new Date(0) },
    { name: 'null-prototype', value: Object.create(null) as object },
    { name: 'boxed', value: Object(3) as object },
  ])(
    'raw $name forwarded unchanged; mock only not service/transport acceptance',
    async ({ value }) => {
      const f = fixture();
      expect((await f.dispatch({ body: value })).statusCode).toBe(201);
      expect(f.ingest.mock.calls[0]?.[0]).toBe(value);
      expect(f.authenticate).not.toHaveBeenCalled();
    },
  );
  it('raw body field getters and query internals not read by HTTP', async () => {
    const f = fixture();
    const getter = vi.fn(() => {
      throw new Error('not read by HTTP');
    });
    const body = Object.defineProperty({}, 'locale', { enumerable: true, get: getter });
    const query = Object.defineProperty({}, 'signature', { enumerable: true, get: getter });
    expect((await f.dispatch({ body, query })).statusCode).toBe(201);
    expect(getter).not.toHaveBeenCalled();
    expect(f.ingest.mock.calls[0]?.[0] === body).toBe(true);
  });
  for (const key of ['x-kingturf-timestamp', 'x-kingturf-signature'] as const) {
    it.each([
      { name: 'undefined', value: undefined },
      { name: 'empty', value: '' },
      { name: 'spaces', value: '  ' },
      { name: 'opaque', value: 'opaque-mock' },
      { name: 'null', value: null },
      { name: 'number', value: 0 },
      { name: 'boolean', value: false },
      { name: 'object', value: nested },
    ])('header ' + key + ' $name raw value/no HTTP trim/default/parse', async ({ value }) => {
      const f = fixture();
      const headers = { ...f.headers, [key]: value } as unknown as NonNullable<
        ApiRequest['headers']
      >;
      expect((await f.dispatch({ headers })).statusCode).toBe(201);
      expect(f.ingest.mock.calls[0]?.[key === 'x-kingturf-timestamp' ? 1 : 2]).toBe(value);
    });
  }
  it('missing two headers forwarded undefined; no body/header fallback', async () => {
    const f = fixture();
    const body = { timestamp: 'not-used', signature: 'not-used', idempotencyKey: 'not-used' };
    expect(
      (await f.dispatch({ body, headers: { 'x-correlation-id': correlationId } })).statusCode,
    ).toBe(201);
    expect(f.ingest.mock.calls[0]).toEqual([body, undefined, undefined, correlationId]);
  });
  it('nonenumerable/inherited headers omitted by global spread', async () => {
    const f = fixture();
    const headers = { 'x-correlation-id': correlationId };
    Object.defineProperty(headers, 'x-kingturf-signature', { value: 'opaque-mock' });
    Object.setPrototypeOf(headers, { 'x-kingturf-timestamp': 'opaque-mock' });
    expect((await f.dispatch({ headers })).statusCode).toBe(201);
    expect(f.ingest.mock.calls[0]?.[1]).toBeUndefined();
    expect(f.ingest.mock.calls[0]?.[2]).toBeUndefined();
  });
  it('trace global request/header copy→login auth dependency→root twice/method→call→late duplicate', async () => {
    const f = fixture();
    const events: string[] = [];
    const headers = { ...f.headers };
    for (const [key, event] of [
      ['x-kingturf-timestamp', 'timestamp'],
      ['x-kingturf-signature', 'signature'],
    ] as const)
      Object.defineProperty(headers, key, {
        enumerable: true,
        get: () => {
          events.push(event);
          return f.headers[key];
        },
      });
    const auth = f.dependencies.auth;
    Object.defineProperty(f.dependencies, 'auth', {
      get: () => {
        events.push('auth dependency');
        return auth;
      },
    });
    Object.defineProperty(f.dependencies, 'websiteLeads', {
      get: () => {
        events.push('root');
        return f.repository;
      },
    });
    Object.defineProperty(f.repository, 'ingest', {
      get: () => {
        events.push('method');
        return f.ingest;
      },
    });
    const output = { ...returned };
    Object.defineProperty(output, 'duplicate', {
      get: () => {
        events.push('duplicate');
        return false;
      },
    });
    f.ingest.mockImplementationOnce(() => {
      events.push('call');
      return Promise.resolve(output);
    });
    expect((await f.dispatch({ headers })).statusCode).toBe(201);
    expect(events).toEqual([
      'timestamp',
      'signature',
      'auth dependency',
      'root',
      'root',
      'method',
      'call',
      'duplicate',
    ]);
    expect(f.authenticate).not.toHaveBeenCalled();
  });
  it('global signature header getter once; global raw body getter once before root', async () => {
    const f = fixture();
    const events: string[] = [];
    const getter = vi.fn(() => {
      events.push('header');
      return 'opaque-mock';
    });
    const headers = Object.defineProperty({ ...f.headers }, 'x-kingturf-signature', {
      enumerable: true,
      get: getter,
    });
    const root = vi.fn(() => {
      events.push('root');
      return f.repository;
    });
    Object.defineProperty(f.dependencies, 'websiteLeads', { get: root });
    const bodyGetter = vi.fn(() => {
      events.push('body');
      return f.body;
    });
    const request = Object.defineProperty({ method: 'POST', pathname: path, headers }, 'body', {
      enumerable: true,
      get: bodyGetter,
    });
    expect((await buildApp(f.dependencies).dispatch(request)).statusCode).toBe(201);
    expect(bodyGetter).toHaveBeenCalledOnce();
    expect(getter).toHaveBeenCalledOnce();
    expect(events).toEqual(['body', 'header', 'root', 'root']);
  });
  it('global header getter error rejects outside inner error-C envelope before ingestor', async () => {
    const f = fixture();
    const failure = new Error('global getter fixture');
    const headers = Object.defineProperty({ ...f.headers }, 'x-kingturf-signature', {
      enumerable: true,
      get: () => {
        throw failure;
      },
    });
    await expect(f.dispatch({ headers })).rejects.toBe(failure);
    expect(f.ingest).not.toHaveBeenCalled();
  });
  it('first root getter can select second root before method capture', async () => {
    const f = fixture();
    const replacement = vi.fn<Method>().mockResolvedValue(returned),
      repo = { ingest: replacement };
    let reads = 0;
    Object.defineProperty(f.dependencies, 'websiteLeads', {
      get: () => (++reads === 1 ? f.repository : repo),
    });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(reads).toBe(2);
    expect(replacement).toHaveBeenCalledOnce();
    expect(replacement.mock.contexts[0]).toBe(repo);
    expect(f.ingest).not.toHaveBeenCalled();
  });
  it('method getter root swap preserves captured reference/receiver and already copied headers', async () => {
    const f = fixture();
    const replacement = vi.fn<Method>().mockResolvedValue(returned);
    Object.defineProperty(f.repository, 'ingest', {
      get: () => {
        Reflect.set(f.dependencies, 'websiteLeads', { ingest: replacement });
        f.headers['x-kingturf-signature'] = 'changed-original-only';
        return f.ingest;
      },
    });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(f.ingest).toHaveBeenCalledOnce();
    expect(f.ingest.mock.contexts[0]).toBe(f.repository);
    expect(f.ingest.mock.calls[0]?.[2]).toBe('opaque-signature');
    expect(replacement).not.toHaveBeenCalled();
  });
  it.each([1, 2])(
    'root getter throwing at read %i maps500-C without authentication',
    async (failAt) => {
      const f = fixture();
      let reads = 0;
      Object.defineProperty(f.dependencies, 'websiteLeads', {
        get: () => {
          if (++reads === failAt) throw new Error('root fixture');
          return f.repository;
        },
      });
      expect(await f.dispatch()).toEqual(error(500, 'internal_error', 'Internal server error'));
      expect(reads).toBe(failAt);
      expect(f.ingest).not.toHaveBeenCalled();
      expect(f.authenticate).not.toHaveBeenCalled();
    },
  );
  it('missing root checked once; second missing root old500 not new503', async () => {
    const f = fixture();
    let reads = 0;
    Object.defineProperty(f.dependencies, 'websiteLeads', {
      get: () => (++reads === 1 ? undefined : f.repository),
    });
    expect(await f.dispatch()).toEqual(
      error(503, 'internal_error', 'Website lead integration unavailable'),
    );
    expect(reads).toBe(1);
    const g = fixture();
    let secondReads = 0;
    Object.defineProperty(g.dependencies, 'websiteLeads', {
      get: () => (++secondReads === 1 ? g.repository : undefined),
    });
    expect(await g.dispatch()).toEqual(error(500, 'internal_error', 'Internal server error'));
    expect(secondReads).toBe(2);
  });
  it.each([
    { name: 'false', value: false },
    { name: 'true', value: true },
    { name: 'missing', value: undefined },
    { name: 'null', value: null },
    { name: 'zero', value: 0 },
    { name: 'one', value: 1 },
    { name: 'empty', value: '' },
    { name: 'false-string', value: 'false' },
    { name: 'array', value: [] },
    { name: 'object', value: {} },
    { name: 'NaN', value: NaN },
  ])('duplicate $name original truthiness/status and raw ref', async ({ value }) => {
    const f = fixture(),
      output = { ...returned };
    Object.defineProperty(output, 'duplicate', { value });
    f.ingest.mockResolvedValueOnce(output);
    const result = await f.dispatch();
    expect(result.statusCode).toBe(value ? 200 : 201);
    expect(result.body).toBe(output);
  });
  it('duplicate read once after await, not before result; nested/raw identity remains', async () => {
    const f = fixture();
    let reads = 0,
      release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const output = { ...returned };
    let duplicate = false;
    Object.defineProperty(output, 'duplicate', {
      get: () => {
        reads++;
        return duplicate;
      },
    });
    f.ingest.mockImplementationOnce(async () => {
      await pending;
      return output;
    });
    const task = f.dispatch();
    await Promise.resolve();
    expect(reads).toBe(0);
    duplicate = true;
    release?.();
    const result = await task;
    expect(reads).toBe(1);
    expect(result.statusCode).toBe(200);
    expect(result.body).toBe(output);
    expect((result.body as typeof returned).nested).toBe(nested);
  });
  it.each([
    { name: 'null', value: null },
    { name: 'undefined', value: undefined },
  ])('nullish result $name old TypeError500-C not result shape validation', async ({ value }) => {
    const f = fixture();
    f.ingest.mockResolvedValueOnce(value as unknown as Result);
    expect(await f.dispatch()).toEqual(error(500, 'internal_error', 'Internal server error'));
  });
  it.each([
    { name: 'false', value: false },
    { name: 'zero', value: 0 },
    { name: 'string', value: 'mock-output' },
    { name: 'array', value: [] },
    { name: 'object', value: {} },
  ])(
    'non-null mock result $name raw201; not transport/service output guarantee',
    async ({ value }) => {
      const f = fixture();
      f.ingest.mockResolvedValueOnce(value as unknown as Result);
      const result = await f.dispatch();
      expect(result.statusCode).toBe(201);
      expect(result.body).toBe(value);
    },
  );
  it.each([
    ['forbidden', 403],
    ['invalid_request', 400],
    ['conflict', 409],
    ['not_found', 404],
  ] as const)('ingest DomainError %s preserves %i/C without auth', async (code, status) => {
    const f = fixture();
    f.ingest.mockRejectedValueOnce(new DomainError(code, 'ingest rejected'));
    expect(await f.dispatch()).toEqual(error(status, code, 'ingest rejected'));
    expect(f.authenticate).not.toHaveBeenCalled();
  });
  it('ordinary ingest error and duplicate getter DomainError use original envelopes', async () => {
    const f = fixture();
    f.ingest.mockRejectedValueOnce(new Error('service fixture'));
    expect(await f.dispatch()).toEqual(error(500, 'internal_error', 'Internal server error'));
    const output = { ...returned };
    Object.defineProperty(output, 'duplicate', {
      get: () => {
        throw new DomainError('conflict', 'late result fixture');
      },
    });
    f.ingest.mockResolvedValueOnce(output);
    expect(await f.dispatch()).toEqual(error(409, 'conflict', 'late result fixture'));
  });
  it.each(['GET', 'HEAD', 'OPTIONS', 'PATCH', 'PUT', 'DELETE', 'post'])(
    'unsupported method %s session401 vs authenticated404, no ingestor read',
    async (method) => {
      const f = fixture(),
        g = fixture({ authenticated: true });
      expect(await f.dispatch({ method })).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
      expect(
        await g.dispatch({
          method,
          headers: { ...g.headers, authorization: 'Bearer mock-session' },
        }),
      ).toEqual(error(404, 'not_found', 'Route not found'));
      expect(f.ingest).not.toHaveBeenCalled();
      expect(g.ingest).not.toHaveBeenCalled();
    },
  );
  it.each([
    path + '/',
    path + '/extra',
    path.toUpperCase(),
    path + '?literal',
    '/api/v1/not-a-website-route',
  ])('unsupported path %s session401 vs authenticated404', async (pathname) => {
    const f = fixture(),
      g = fixture({ authenticated: true });
    expect(await f.dispatch({ pathname })).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(
      await g.dispatch({
        pathname,
        headers: { ...g.headers, authorization: 'Bearer mock-session' },
      }),
    ).toEqual(error(404, 'not_found', 'Route not found'));
    expect(f.ingest).not.toHaveBeenCalled();
    expect(g.ingest).not.toHaveBeenCalled();
  });
  it('login neighbour runs first; health public; unsupported suffix can hit existing QTC sharedO', async () => {
    const f = fixture({ authenticated: true });
    expect(await f.dispatch({ pathname: '/api/v1/auth/login', body: {} })).toEqual(
      error(400, 'invalid_request', 'login is required'),
    );
    expect(await f.dispatch({ method: 'GET', pathname: '/health', body: null })).toEqual(
      response(200, { status: 'ok' }),
    );
    Reflect.set(f.dependencies, 'quoteToCash', {});
    expect(
      await f.dispatch({
        pathname: path + '/',
        body: null,
        headers: { ...f.headers, authorization: 'Bearer mock-session' },
      }),
    ).toEqual(error(400, 'invalid_request', 'A JSON object body is required'));
    expect((await f.dispatch({ body: null })).statusCode).toBe(201);
    expect(f.ingest).toHaveBeenCalledOnce();
  });
  it('invalid incoming correlation normalized once; ingestor and error/header share generated C', async () => {
    const f = fixture();
    f.ingest.mockRejectedValueOnce(new DomainError('forbidden', 'ingest rejected'));
    const result = await f.dispatch({
      headers: { ...f.headers, 'x-correlation-id': 'invalid-correlation' },
    });
    const supplied = f.ingest.mock.calls[0]?.[3];
    expect(supplied).toMatch(/^[0-9a-f-]{36}$/u);
    expect(result.headers?.['x-correlation-id']).toBe(supplied);
    expect(result.body).toEqual({
      error: { code: 'forbidden', message: 'ingest rejected', correlationId: supplied },
    });
  });
});
