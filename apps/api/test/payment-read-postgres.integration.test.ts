import { randomUUID } from 'node:crypto';
import type { AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApiDependencies, ApiRequest } from '../src/app.ts';
import { decimal, integer, permittedDto, string, timestamp, uuid } from '../src/app-values.ts';
import { authorizeQuery } from '../src/policy.ts';
import { PostgresQuoteToCashRepository } from '../src/qtc-repositories.ts';
import { dispatchFastifyRouteGroup } from '../src/routes/fastify/registry.ts';
import { qtcBaseReadRoutes } from '../src/routes/qtc-base-reads.ts';
import { qtcOperationalReadRoutes } from '../src/routes/qtc-operational-reads.ts';
import { dispatchRoutes } from '../src/routes/types.ts';
import { ownedCommercialGraph } from './fixtures/owned-commercial-graph.js';

const paymentPath = '/api/v1/bank-payments';
const runPath = '/api/v1/reconciliation-runs';
const valueAsText = (value: unknown): string => {
  if (typeof value !== 'string') throw new Error('Missing text in payment fixture');
  return value;
};
const object = (value: unknown): JsonObject => (value ?? {}) as JsonObject;
const rows = (value: unknown): readonly JsonObject[] =>
  Array.isArray(value) ? value.map(object) : [];
type Grant = Readonly<{ scopes: readonly DataScope[]; fields: readonly string[] | null }>;
const company: Grant = { scopes: ['COMPANY'], fields: null };

let fixture: Awaited<ReturnType<typeof ownedCommercialGraph>>;
let dispose: (() => Promise<void>) | undefined;
let repo: PostgresQuoteToCashRepository;
const auth = (patch: Partial<Record<PermissionKey, Grant>> = {}): AuthorizationContext => ({
  actor: fixture.context.actor,
  permissions: new Map<PermissionKey, Grant>([
    ['bank-payment:read', patch['bank-payment:read'] ?? company],
    ['bank-payment:intake', patch['bank-payment:intake'] ?? company],
    ['reconciliation:read', patch['reconciliation:read'] ?? company],
    ['reconciliation:run', patch['reconciliation:run'] ?? company],
    ['ar:read', patch['ar:read'] ?? company],
  ]),
  scopeAnchors: new Map(),
});
const get = (pathname: string, query?: ApiRequest['query']): ApiRequest => ({
  method: 'GET',
  pathname,
  ...(query ? { query } : {}),
});
const bridge = (request: ApiRequest, authorization = auth()) =>
  dispatchFastifyRouteGroup(request, {
    authorization,
    correlationId: randomUUID(),
    dependencies: { quoteToCash: repo, commercial: {} } as unknown as ApiDependencies,
  });
const post = (pathname: string, body: JsonObject, key = randomUUID()) =>
  bridge({ method: 'POST', pathname, body, headers: { 'idempotency-key': key } });

beforeAll(async () => {
  fixture = await ownedCommercialGraph();
  dispose = fixture.close;
  repo = new PostgresQuoteToCashRepository(fixture.db);
}, 60_000);
afterAll(async () => {
  await dispose?.();
});

describe('FIN-2 payment and reconciliation reads on real PostgreSQL', () => {
  it('preserves default responses on the same legacy repository and field projection', async () => {
    const authorization = auth();
    const context = { repository: () => repo, authorization, authorizeQuery, permittedDto };
    const routes = [
      ...qtcBaseReadRoutes(context),
      ...qtcOperationalReadRoutes({
        ...context,
        parsers: { decimal, integer, uuid, string, timestamp },
      }),
    ];
    for (const path of [paymentPath, runPath]) {
      const request = get(path);
      const legacy = await dispatchRoutes(routes, request);
      const bridged = await bridge(request, authorization);
      expect(bridged).toEqual(legacy);
      expect(rows(object(bridged?.body).items)).toHaveLength(1);
    }
  });

  it('reads immutable run results and allocation rows, with independent AR and payment grants', async () => {
    const payment = rows(object((await bridge(get(paymentPath)))?.body).items)[0];
    const run = rows(object((await bridge(get(runPath)))?.body).items)[0];
    expect(payment?.bank_reference).toBe('SENSITIVE-PAYMENT');
    const paymentDetail = object(
      (await bridge(get(`${paymentPath}/${valueAsText(payment?.id)}`)))?.body,
    );
    expect(paymentDetail).toMatchObject({
      originalAmount: '100000.000000',
      appliedAmount: '100000.000000',
      remainingAmount: '0.000000',
    });
    expect(paymentDetail.registeredAt).toEqual(expect.any(String));
    expect(rows(paymentDetail.allocations)).toMatchObject([
      {
        documentNumber: 'SENSITIVE-AR',
        amount: '100000.000000',
        allocationOrder: 1,
        receivableRemaining: '850000.000000',
      },
    ]);
    const runDetail = object((await bridge(get(`${runPath}/${valueAsText(run?.id)}`)))?.body);
    expect(runDetail).toMatchObject({
      resultHash: run?.result_hash,
      matchCount: 1,
      algorithm: 'due_at,created_at,id',
      remainingAfterRun: '0.000000',
      bankReference: 'SENSITIVE-PAYMENT',
      allocations: paymentDetail.allocations,
    });

    const limited = auth({
      'ar:read': { scopes: ['SELF'], fields: ['id'] },
      'bank-payment:read': { scopes: ['COMPANY'], fields: ['amount'] },
    });
    const restricted = object(
      (await bridge(get(`${runPath}/${valueAsText(run?.id)}`), limited))?.body,
    );
    expect(restricted).not.toHaveProperty('bankReference');
    expect(rows(restricted.allocations)[0]).not.toHaveProperty('documentNumber');
    expect(rows(restricted.allocations)[0]).not.toHaveProperty('receivableRemaining');
    expect(rows(restricted.allocations)[0]).toHaveProperty('amount', '100000.000000');
  });

  it('intakes exact amounts, runs the existing matcher and supports keyset pages and per-currency totals', async () => {
    const body = {
      customerId: fixture.graph.customerId,
      currency: 'USD',
      amount: '9007199254740993.000002',
      receivedAt: '2026-09-01T12:00:00Z',
      bankReference: 'FIN2-PAYMENT-USD',
      rawPayload: { payer: 'Synthetic' },
    };
    const key = randomUUID();
    const first = await post(paymentPath, body, key);
    expect(first?.statusCode).toBe(201);
    expect(await post(paymentPath, body, key)).toEqual(first);
    const id = valueAsText(object(first?.body).id);
    const addedRun = await post(runPath, { paymentId: id });
    expect(addedRun?.statusCode).toBe(201);
    expect(addedRun?.body).toMatchObject({
      status: 'NO_MATCH',
      remainingAmount: body.amount,
      allocations: [],
    });

    const page = object((await bridge(get(paymentPath, { limit: '1', summary: '1' })))?.body);
    expect(rows(page.items)).toHaveLength(1);
    const next = object(
      (
        await bridge(
          get(paymentPath, { limit: '1', summary: '1', cursor: valueAsText(page.nextCursor) }),
        )
      )?.body,
    );
    expect(rows(next.items)[0]).toMatchObject({ id, remainingAmount: body.amount });
    expect(next.nextCursor).toBeNull();
    expect(page.summary).toEqual(next.summary);
    expect(rows(page.summary)).toContainEqual({
      currency: 'USD',
      paymentCount: 1,
      receivedAmount: body.amount,
      appliedAmount: '0.000000',
      remainingAmount: body.amount,
    });
    const search = await bridge(get(paymentPath, { search: ' payment-usd ', state: 'OPEN' }));
    expect(rows(object(search?.body).items)[0]).toMatchObject({ id });
    const masked = await bridge(
      get(paymentPath, { summary: '1' }),
      auth({ 'bank-payment:read': { scopes: ['COMPANY'], fields: ['bank_reference'] } }),
    );
    expect(masked?.body).not.toHaveProperty('summary');
    const firstRun = object((await bridge(get(runPath, { limit: '1' })))?.body);
    const nextRun = object(
      (await bridge(get(runPath, { limit: '1', cursor: valueAsText(firstRun.nextCursor) })))?.body,
    );
    expect(rows(firstRun.items)[0]).toMatchObject({ status: 'NO_MATCH', matchCount: 0 });
    expect(rows(nextRun.items)[0]).toMatchObject({ status: 'COMPLETED', matchCount: 1 });
    expect(nextRun.nextCursor).toBeNull();
    expect(
      (await bridge(get(`${runPath}/${valueAsText(object(addedRun?.body).id)}`)))?.body,
    ).toMatchObject({ remainingAfterRun: body.amount, allocations: [] });
  });
});
