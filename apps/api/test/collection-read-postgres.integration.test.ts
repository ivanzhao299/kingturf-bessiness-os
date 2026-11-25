import { randomUUID } from 'node:crypto';
import type { AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { ApiDependencies, ApiRequest } from '../src/app.ts';
import { PostgresQuoteToCashRepository } from '../src/qtc-repositories.ts';
import { PostgresCollectionRepository } from '../src/collection-repositories.ts';
import { collectionsAttempts } from '../src/routes/dispatch/collections.ts';
import { dispatchFastifyRouteGroup } from '../src/routes/fastify/registry.ts';
import { ownedCommercialGraph } from './fixtures/owned-commercial-graph.js';

const path = '/api/v1/collection-cases';
const object = (data: unknown): JsonObject => (data ?? {}) as JsonObject;
type Grant = { scopes: readonly DataScope[]; fields: readonly string[] | null };
const company: Grant = { scopes: ['COMPANY'], fields: null };
let graph: Awaited<ReturnType<typeof ownedCommercialGraph>>;
let dispose: (() => Promise<void>) | undefined;
let repo: PostgresCollectionRepository;
const authorization = (
  grants: readonly (readonly [PermissionKey, Grant])[] = [],
): AuthorizationContext => ({
  actor: graph.context.actor,
  permissions: new Map<PermissionKey, Grant>([['collection:read', company], ...grants]),
  scopeAnchors: new Map(),
});
const get = (pathname = path, query?: ApiRequest['query']): ApiRequest => ({
  method: 'GET',
  pathname,
  ...(query ? { query } : {}),
});
const bridge = (request: ApiRequest, auth = authorization()) =>
  dispatchFastifyRouteGroup(request, {
    authorization: auth,
    correlationId: randomUUID(),
    dependencies: { collections: repo, commercial: {} } as unknown as ApiDependencies,
  });
beforeAll(async () => {
  graph = await ownedCommercialGraph();
  dispose = graph.close;
  repo = new PostgresCollectionRepository(graph.db);
}, 60_000);
afterAll(async () => {
  await dispose?.();
});

it('preserves the default collection list from the legacy query and projection', async () => {
  for (const auth of [authorization(), authorization([['legal-case:read', company]])]) {
    const request = get();
    const [attempt] = collectionsAttempts({
      request,
      context: auth,
      dependencies: { collections: repo } as ApiDependencies,
      correlationId: randomUUID(),
    });
    if (attempt?.kind !== 'pending') throw new Error('Missing legacy collection attempt');
    const legacy = attempt.project(await attempt.pending);
    const current = await bridge(request, auth);
    expect(current?.statusCode).toBe(200);
    expect(current).toEqual(legacy);
    expect(object(current?.body).items).toHaveLength(1);
  }
});

it('keeps collection detail scoped and projects legal evidence independently', async () => {
  const request = get(`${path}/${graph.graph.collectionId}`);
  const denied = await bridge(request);
  expect(denied?.statusCode).toBe(200);
  expect(denied?.body).toMatchObject({
    state: 'LEGAL_ACCEPTED',
    remainingAmount: '850000.000000',
    documentNumber: 'SENSITIVE-AR',
  });
  expect(denied?.body).not.toHaveProperty('legalHandoffs');
  expect(denied?.body).not.toHaveProperty('receivable');
  expect(JSON.stringify(denied?.body)).not.toContain('SENSITIVE-LEGAL');
  const allowed = await bridge(
    request,
    authorization([
      ['legal-case:read', company],
      ['ar:read', company],
    ]),
  );
  expect(allowed?.body).toMatchObject({
    receivable: { documentNumber: 'SENSITIVE-AR', remaining_amount: '850000.000000' },
  });
  expect(JSON.stringify(allowed?.body)).toContain('SENSITIVE-PACKAGE');
  const masked = await bridge(
    request,
    authorization([
      ['legal-case:read', { scopes: ['COMPANY'], fields: ['state'] }],
      ['ar:read', { scopes: ['COMPANY'], fields: ['documentNumber'] }],
    ]),
  );
  expect(JSON.stringify(masked?.body)).not.toContain('SENSITIVE-PACKAGE');
  expect(object(object(masked?.body).receivable)).not.toHaveProperty('remaining_amount');
  expect(
    (
      await bridge(
        request,
        authorization([['collection:read', { scopes: ['SELF'], fields: null }]]),
      )
    )?.statusCode,
  ).toBe(403);
  expect((await bridge(get(`${path}/${randomUUID()}`)))?.statusCode).toBe(404);
});

it('filters additive rows and summarizes exact amounts within the visible company', async () => {
  const response = await bridge(
    get(path, { summary: '1', state: 'LEGAL_ACCEPTED', search: 'auth-collection', limit: '1' }),
  );
  expect(response?.body).toMatchObject({
    items: [{ id: graph.graph.collectionId, assignedName: 'Owned A', followupOverdue: false }],
    nextCursor: null,
    summary: [
      { currency: 'CNY', activeCount: 1, activeBalance: '850000.000000', followupOverdueCount: 0 },
    ],
  });
  const masked = await bridge(
    get(path, { summary: '1', search: 'SENSITIVE-AR' }),
    authorization([['collection:read', { scopes: ['COMPANY'], fields: ['case_number'] }]]),
  );
  expect(masked?.body).toEqual({ items: [], nextCursor: null });
});

it('accepts the legacy console timestamp key without changing its bytes or accepting it as a case number', async () => {
  const qtc = new PostgresQuoteToCashRepository(graph.db);
  const ar = await qtc.postAr(
    {
      customerId: graph.graph.customerId,
      salesOrderId: null,
      currency: 'CNY',
      documentType: 'INVOICE',
      documentNumber: 'FIN3-TIMESTAMP-AR',
      amount: '12.5',
      dueAt: '2026-01-01T23:59:59.000Z',
    },
    randomUUID(),
    graph.context,
    randomUUID(),
  );
  const auth = authorization([['collection:manage', company]]);
  const fields = {
    arOpenItemId: ar.id,
    assignedTo: graph.context.actor.employeeId,
    priority: 'HIGH',
    reason: 'Legacy form',
    idempotencyKey: 'COL-mj3rw6w0',
  };
  const malformed = await bridge(
    {
      method: 'POST',
      pathname: path,
      body: { ...fields, caseNumber: 'FIN3-TIMESTAMP-CASE', idempotencyKey: 'FOLLOW-mj3rw6w0' },
    },
    auth,
  );
  expect(malformed?.statusCode).toBe(400);
  expect(
    (
      await bridge(
        { method: 'POST', pathname: path, body: { ...fields, caseNumber: 'fin3-timestamp' } },
        auth,
      )
    )?.statusCode,
  ).toBe(400);
  const created = await bridge(
    { method: 'POST', pathname: path, body: { ...fields, caseNumber: 'FIN3-TIMESTAMP-CASE' } },
    auth,
  );
  expect(created?.statusCode).toBe(201);
  const stored = await graph.db.query<{ idempotency_key: string }>(
    'SELECT idempotency_key FROM collection_cases WHERE tenant_id=$1 AND case_number=$2',
    [graph.context.actor.companyId, 'FIN3-TIMESTAMP-CASE'],
  );
  expect(stored.rows[0]?.idempotency_key).toBe(fields.idempotencyKey);
});
