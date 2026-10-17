// Fixed against cea34f4's inline evaluate route, before extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';

type Rules = NonNullable<ApiDependencies['rules']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correlationId = '33333333-3333-4333-8333-333333333333';
const nextCorrelation = '44444444-4444-4444-8444-444444444444';
const actor = { companyId: 'evaluation-tenant', employeeId: id };
const base = '/api/v1/rules';
const pathname = `${base}/${id}/evaluate`;
const originalInput = { flag: true, arbitrary: { raw: ['value'] } };
const row = {
  id: 'evaluation-fixture',
  ruleVersionId: id,
  inputHash: 'stored-hash',
  decision: true,
  trace: [{ op: 'fixture', result: true }],
  evaluatedAt: '2026-10-14T00:00:00.000Z',
  correlationId,
  private: { retained: true },
};
function fixture(
  options: {
    denied?: boolean;
    emptyScope?: boolean;
    available?: boolean;
    fields?: Grant['fields'];
  } = {},
) {
  const permissions = new Map<PermissionKey, Grant>([
    ['rule:read', { scopes: ['TEAM'], fields: null }],
    ...(options.denied
      ? []
      : [
          [
            'rule:evaluate',
            {
              scopes: options.emptyScope ? [] : ['TEAM'],
              fields: options.fields === undefined ? null : options.fields,
            },
          ] as [PermissionKey, Grant],
        ]),
  ]);
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map([
      ['rule:evaluate', [{ scope: 'TEAM', organizationId: 'not-forwarded' }]],
    ]),
  };
  const get = vi.spyOn(permissions, 'get');
  const repository = {
    evaluate: vi.fn<Rules['evaluate']>().mockResolvedValue(row),
    list: vi.fn<Rules['list']>().mockResolvedValue([]),
    create: vi.fn<Rules['create']>().mockResolvedValue({ id, version: undefined }),
    publish: vi.fn<Rules['publish']>().mockResolvedValue({ id: 'publish-neighbor' }),
    createVersion: vi.fn<Rules['createVersion']>().mockResolvedValue({ id }),
  };
  const entries = { listEntries: vi.fn().mockResolvedValue([{ id: 'entry-neighbor' }]) };
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(context),
    } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false ? {} : { rules: repository as unknown as Rules }),
    masterData: entries as unknown as NonNullable<ApiDependencies['masterData']>,
  });
  const dispatch = (options: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: 'POST',
      pathname,
      body: { input: originalInput },
      query: { idempotencyKey: 'query-key', version: 'bad', unknown: 'ignored' },
      ...options,
      headers: {
        authorization: 'Bearer fixture',
        'x-correlation-id': correlationId,
        'idempotency-key': 'raw-key',
        ...options.headers,
      },
    });
  return { repository, entries, permissions, get, dispatch };
}
const response = (statusCode: number, body: unknown) => ({
  statusCode,
  body,
  headers: {
    'x-correlation-id': correlationId,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'strict-origin-when-cross-origin',
  },
});
const error = (statusCode: number, code: string, message: string) =>
  response(statusCode, { error: { code, message, correlationId } });
const invalid = (message: string) => error(400, 'invalid_request', message);
const keyRequired = invalid('Idempotency-Key header is required');
const objectRequired = invalid('A JSON object body is required');
const uuidRequired = invalid('ruleId must be a UUID');
const denied = error(403, 'forbidden', 'Permission denied');
const unavailable = error(503, 'internal_error', 'Rule repository unavailable');
const missing = error(404, 'not_found', 'Route not found');
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const mock of Object.values(f.repository)) expect(mock).not.toHaveBeenCalled();
};

describe('old rule evaluation contracts', () => {
  it.each([
    { denied: true, available: true },
    { denied: true, available: false },
    { emptyScope: true, available: true },
    { emptyScope: true, available: false },
  ])('Q0 precedes repo/key/root/UUID for %j', async (options) => {
    const f = fixture(options);
    expect(
      await f.dispatch({
        pathname: `${base}/a/evaluate`,
        body: null,
        headers: { 'idempotency-key': '' },
      }),
    ).toEqual(denied);
    noCalls(f);
  });
  it.each([{ key: undefined }, { key: '' }, { key: 'x'.repeat(201) }])(
    'authorized missingrepo precedes key/root/UUID $key',
    async ({ key }) => {
      const f = fixture({ available: false });
      expect(
        await f.dispatch({
          pathname: `${base}/a/evaluate`,
          body: null,
          headers: { 'idempotency-key': key },
        }),
      ).toEqual(unavailable);
      noCalls(f);
    },
  );
  it('global401 precedes all supported checks', async () => {
    const f = fixture({ denied: true, available: false });
    expect(
      await f.dispatch({
        pathname: `${base}/a/evaluate`,
        body: null,
        headers: { authorization: '', 'idempotency-key': '' },
      }),
    ).toEqual(error(401, 'authentication_required', 'A valid session is required'));
    noCalls(f);
  });
  it.each([{ fields: null }, { fields: [] }, { fields: ['unrelated'] }] as const)(
    'Q0 fields $fields do not project or add scopes',
    async ({ fields }) => {
      const f = fixture({ fields });
      const actual = await f.dispatch();
      expect(actual).toEqual(response(200, row));
      expect(actual.body).toBe(row);
      expect(f.repository.evaluate).toHaveBeenCalledExactlyOnceWith(
        id,
        originalInput,
        'raw-key',
        actor,
        correlationId,
      );
      expect(f.repository.evaluate.mock.calls[0]?.length).toBe(5);
      expect(f.repository.evaluate.mock.calls[0]?.[1]).toBe(originalInput);
      expect(f.repository.evaluate.mock.calls[0]?.[3]).toBe(actor);
      expect(f.repository.evaluate.mock.contexts).toEqual([f.repository]);
      expect(f.get.mock.calls.every(([cap]) => cap === 'rule:evaluate')).toBe(true);
      expect(f.repository.list).not.toHaveBeenCalled();
      expect(f.repository.publish).not.toHaveBeenCalled();
    },
  );
  it('rule:read alone is insufficient', async () => {
    const f = fixture({ denied: true });
    expect(await f.dispatch()).toEqual(denied);
    noCalls(f);
  });
  it('no rule:read grant required', async () => {
    const f = fixture();
    f.permissions.delete('rule:read');
    expect((await f.dispatch()).body).toBe(row);
  });
  it.each([undefined, ''])('missing key %j precedes root/allow/UUID/input', async (key) => {
    const f = fixture();
    for (const body of [null, { extra: true, input: null }, { input: null }])
      expect(
        await f.dispatch({
          pathname: `${base}/a/evaluate`,
          body,
          headers: { 'idempotency-key': key },
        }),
      ).toEqual(keyRequired);
    noCalls(f);
  });
  it.each([undefined, ''])('body/query keys cannot replace header %j', async (key) => {
    const f = fixture();
    expect(
      await f.dispatch({
        body: { input: {}, idempotencyKey: 'body-key' },
        headers: { 'idempotency-key': key },
      }),
    ).toEqual(keyRequired);
    noCalls(f);
  });
  it('capitalized header field is not a fallback in buildApp protocol', async () => {
    const f = fixture();
    expect(
      await f.dispatch({ headers: { 'idempotency-key': undefined, 'Idempotency-Key': 'capital' } }),
    ).toEqual(keyRequired);
    noCalls(f);
  });
  it.each([1, 128, 129, 200, 201, 1024])(
    'length%i reaches mock unchanged, not PG proof',
    async (length) => {
      const f = fixture();
      const key = 'x'.repeat(length);
      const actual = await f.dispatch({ headers: { 'idempotency-key': key } });
      expect(actual).toEqual(response(200, row));
      expect(actual.body).toBe(row);
      expect(f.repository.evaluate).toHaveBeenCalledExactlyOnceWith(
        id,
        originalInput,
        key,
        actor,
        correlationId,
      );
    },
  );
  it.each([' ', '  ', ' raw key ', '!@#$%^&*():/?中文'])(
    'key %j is not trimmed or format checked',
    async (key) => {
      const f = fixture();
      expect((await f.dispatch({ headers: { 'idempotency-key': key } })).body).toBe(row);
      expect(f.repository.evaluate).toHaveBeenCalledExactlyOnceWith(
        id,
        originalInput,
        key,
        actor,
        correlationId,
      );
    },
  );
  it.each([
    { value: undefined },
    { value: null },
    { value: [] },
    { value: '' },
    { value: false },
    { value: 1 },
  ])('nonempty key then root O rejects $value before UUID', async ({ value }) => {
    const f = fixture();
    expect(
      await f.dispatch({
        pathname: `${base}/a/evaluate`,
        body: value,
        headers: { 'idempotency-key': 'x'.repeat(201) },
      }),
    ).toEqual(objectRequired);
    noCalls(f);
  });
  it.each(['inputHash', 'idempotencyKey', 'decision', 'trace', 'version', 'ast'])(
    'root extra %s rejects before UUID/input O',
    async (extra) => {
      const f = fixture();
      expect(
        await f.dispatch({
          pathname: `${base}/a/evaluate`,
          body: { input: null, [extra]: 'bad' },
          headers: { 'idempotency-key': 'x'.repeat(201) },
        }),
      ).toEqual(invalid(`Unsupported fields: ${extra}`));
      noCalls(f);
    },
  );
  it('root unknown keys sort before UUID', async () => {
    const f = fixture();
    expect(await f.dispatch({ pathname: `${base}/a/evaluate`, body: { z: 1, a: 1 } })).toEqual(
      invalid('Unsupported fields: a, z'),
    );
    noCalls(f);
  });
  it.each(['a', '---', 'aaaaaaaa-aaaa-0aaa-8aaa-aaaaaaaaaaaa'])(
    'UUID %s precedes nested O with long nonempty key',
    async (rawId) => {
      const f = fixture();
      expect(
        await f.dispatch({
          pathname: `${base}/${rawId}/evaluate`,
          body: { input: null },
          headers: { 'idempotency-key': 'x'.repeat(201) },
        }),
      ).toEqual(uuidRequired);
      noCalls(f);
    },
  );
  it('bad UUID precedes input getter', async () => {
    const f = fixture();
    const getter = vi.fn(() => {
      throw new Error('Input must not be read');
    });
    const body = Object.defineProperty({}, 'input', { enumerable: true, get: getter });
    expect(await f.dispatch({ pathname: `${base}/a/evaluate`, body })).toEqual(uuidRequired);
    expect(getter).not.toHaveBeenCalled();
    noCalls(f);
  });
  it.each([
    { value: undefined },
    { value: null },
    { value: [] },
    { value: '' },
    { value: 'input' },
    { value: false },
    { value: 1 },
  ])('UUID then nested input O rejects $value with generic message', async ({ value }) => {
    const f = fixture();
    expect(await f.dispatch({ body: { input: value } })).toEqual(objectRequired);
    noCalls(f);
  });
  it('missing input rejects with original generic object error', async () => {
    const f = fixture();
    expect(await f.dispatch({ body: {} })).toEqual(objectRequired);
    noCalls(f);
  });
  it.each([
    { value: {} },
    { value: originalInput },
    {
      value: {
        inputHash: 'not-server-hash',
        ast: null,
        idempotencyKey: 'nested',
        deep: [null, { unvalidated: undefined }],
        notFinite: NaN,
      },
    },
  ])('shallow input $value is passed by reference, not PG validity proof', async ({ value }) => {
    const f = fixture();
    const actual = await f.dispatch({ body: { input: value } });
    expect(actual).toEqual(response(200, row));
    expect(actual.body).toBe(row);
    expect(f.repository.evaluate.mock.calls[0]?.[1]).toBe(value);
    expect(f.repository.evaluate).toHaveBeenCalledExactlyOnceWith(
      id,
      value,
      'raw-key',
      actor,
      correlationId,
    );
  });
  it('input getter read once and raw nested reference forwarded', async () => {
    const f = fixture();
    const getter = vi.fn(() => originalInput);
    const body = Object.defineProperty({}, 'input', { enumerable: true, get: getter });
    expect((await f.dispatch({ body })).body).toBe(row);
    expect(getter).toHaveBeenCalledTimes(1);
    expect(f.repository.evaluate.mock.calls[0]?.[1]).toBe(originalInput);
  });
  it('unknown query/header never change arguments', async () => {
    const f = fixture();
    expect(
      (
        await f.dispatch({
          query: { input: 'bad', version: 'NaN', idempotencyKey: 'other', inputHash: 'different' },
          headers: { unknown: 'extra', 'Input-Hash': 'different' },
        })
      ).body,
    ).toBe(row);
    expect(f.repository.evaluate).toHaveBeenCalledExactlyOnceWith(
      id,
      originalInput,
      'raw-key',
      actor,
      correlationId,
    );
  });
  it.each([
    { method: 'GET', pathname },
    { method: 'PATCH', pathname },
    { method: 'DELETE', pathname },
    { method: 'post', pathname },
    { method: 'POST', pathname: `${base}/evaluate` },
    { method: 'POST', pathname: `${base}//evaluate` },
    { method: 'POST', pathname: `${base}/${id.toUpperCase()}/evaluate` },
    { method: 'POST', pathname: `${pathname}/extra` },
    { method: 'POST', pathname: `${pathname}/` },
    { method: 'POST', pathname: `${base}/not-uuid/evaluate` },
    { method: 'POST', pathname: `${base}/ ${id} /evaluate` },
  ])('unsupported $method $pathname stays404 with missingrepo', async (request) => {
    const f = fixture({ available: false, emptyScope: true });
    expect(
      await f.dispatch({ ...request, body: null, headers: { 'idempotency-key': '' } }),
    ).toEqual(missing);
    noCalls(f);
  });
  it('samekey differentinput forwards twice with no HTTP fingerprint conflict (mock only)', async () => {
    const f = fixture();
    const secondInput = { flag: false };
    const first = await f.dispatch();
    const second = await f.dispatch({
      body: { input: secondInput },
      headers: { 'x-correlation-id': nextCorrelation },
    });
    expect(first.body).toBe(row);
    expect(second.body).toBe(row);
    expect(f.repository.evaluate.mock.calls).toEqual([
      [id, originalInput, 'raw-key', actor, correlationId],
      [id, secondInput, 'raw-key', actor, nextCorrelation],
    ]);
    expect(f.repository.evaluate.mock.calls[1]?.[1]).toBe(secondInput);
    expect(f.repository.evaluate.mock.contexts).toEqual([f.repository, f.repository]);
  });
  it.each([
    { code: 'invalid_request', status: 400, message: 'A bounded idempotency key is required' },
    { code: 'not_found', status: 404, message: 'Published rule not found' },
    { code: 'conflict', status: 409, message: 'Rule evaluation failed' },
  ] as const)(
    'repository $code error passes through (mock, not PG)',
    async ({ code, status, message }) => {
      const f = fixture();
      f.repository.evaluate.mockRejectedValue(new DomainError(code, message));
      expect(await f.dispatch()).toEqual(error(status, code, message));
      expect(f.repository.evaluate).toHaveBeenCalledExactlyOnceWith(
        id,
        originalInput,
        'raw-key',
        actor,
        correlationId,
      );
    },
  );
  it('publish and entries positive neighbors are not evaluation', async () => {
    const f = fixture();
    f.permissions.set('rule:update', { scopes: ['SELF'], fields: null });
    f.permissions.set('master-data:read', { scopes: ['SELF'], fields: null });
    expect(
      await f.dispatch({
        pathname: `${base}/${id}/publish`,
        body: { version: 1 },
        headers: { 'idempotency-key': '' },
      }),
    ).toEqual(response(200, { id: 'publish-neighbor' }));
    expect(f.repository.publish).toHaveBeenCalledExactlyOnceWith(id, 1, actor, correlationId);
    expect(
      await f.dispatch({
        method: 'GET',
        pathname: '/api/v1/master-data/entries',
        body: null,
        query: { at: '2026-01-01' },
      }),
    ).toEqual(response(200, [{ id: 'entry-neighbor' }]));
    expect(f.entries.listEntries).toHaveBeenCalledExactlyOnceWith(
      actor.companyId,
      null,
      new Date('2026-01-01'),
    );
    expect(f.repository.evaluate).not.toHaveBeenCalled();
  });
});
