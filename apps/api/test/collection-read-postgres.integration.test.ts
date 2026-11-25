import { randomUUID } from 'node:crypto';
import type { AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { ApiDependencies, ApiRequest } from '../src/app.ts';
import { PostgresCollectionRepository } from '../src/collection-repositories.ts';
import { configuredCollectionRoutes } from '../src/routes/dispatch/collections.ts';
import { dispatchFastifyRouteGroup } from '../src/routes/fastify/registry.ts';
import { dispatchRoutes } from '../src/routes/types.ts';
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
    const legacy = await dispatchRoutes(
      configuredCollectionRoutes(repo, auth, randomUUID()),
      request,
    );
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
