import { DomainError } from '@kingturf/domain';
import { z } from 'zod';
import type { ApiRequest } from '../../app.ts';
import { integer, permittedDto, uuid } from '../../app-values.ts';
import { authorizeQuery } from '../../policy.ts';
import { canReadFinField } from '../../qtc-read-repositories.ts';
import { asCollectionGuard } from '../../write-rejection-mapping.ts';
import { configuredCollectionRoutes } from '../dispatch/collections.ts';
import { dispatchRoutes } from '../types.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';

const cases = '/api/v1/collection-cases';
const states = [
  'OPEN',
  'CONTACTING',
  'PROMISE_ACTIVE',
  'PROMISE_BROKEN',
  'LEGAL_PENDING',
  'LEGAL_ACCEPTED',
  'RESOLVED',
  'CLOSED',
];
const row = z.looseObject({ id: z.string().optional() });
const list = z.object({
  items: z.array(row),
  nextCursor: z.string().nullable().optional(),
  summary: z.array(z.record(z.string(), z.unknown())).optional(),
});
type Query = Readonly<Record<string, string | undefined>>;

const requireRepository = (scope: FastifyRouteScope) => {
  const repo = scope.dependencies.collections;
  if (!repo)
    throw Object.assign(new Error('Collections dependency unavailable'), { statusCode: 503 });
  return repo;
};
const readContext = (scope: FastifyRouteScope) => {
  const { authorization } = scope;
  const read = authorizeQuery(authorization, 'collection:read');
  const legal = authorization.permissions.get('legal-case:read');
  const legalRead = legal
    ? {
        scopes: legal.scopes,
        anchors: authorization.scopeAnchors?.get('legal-case:read') ?? [],
        fields: legal.fields,
      }
    : undefined;
  return { actor: authorization.actor, scopes: read.scopes, anchors: read.anchors, legalRead };
};

export function registerCollectionCaseRoutes(
  app: FastifyRouteGroupApp,
  scope: FastifyRouteScope,
): void {
  const fields = scope.authorization.permissions.get('collection:read')?.fields ?? null;
  app.get(cases, { schema: { response: { 200: list } } }, async (request) => {
    const { state, search: rawSearch, limit, cursor, summary } = request.query as Query;
    const search = rawSearch?.trim() ?? '';
    if (!(state || search || limit || cursor || summary)) {
      const result = await legacy(scope, { method: 'GET', pathname: cases });
      return list.parse(result.body);
    }
    const context = readContext(scope);
    if (state && !states.includes(state))
      throw new DomainError('invalid_request', 'state is unsupported');
    if (state && !canReadFinField(fields, 'state'))
      throw new DomainError('forbidden', 'Field permission denied');
    if (summary && summary !== '1' && summary !== 'true')
      throw new DomainError('invalid_request', 'summary is unsupported');
    if (search.length > 100)
      throw new DomainError('invalid_request', 'search exceeds 100 characters');
    const repo = requireRepository(scope);
    const summarize =
      summary &&
      canReadFinField(fields, 'currency') &&
      canReadFinField(fields, 'remainingAmount') &&
      canReadFinField(fields, 'state') &&
      canReadFinField(fields, 'nextActionAt');
    const [page, totals] = await Promise.all([
      repo.listCollectionPage(context, {
        fields,
        limit: limit ? integer(Number(limit), 'limit', 1, 100) : 50,
        ...(state ? { state } : {}),
        ...(search ? { search } : {}),
        ...(cursor ? { cursor: uuid(cursor, 'cursor') } : {}),
      }),
      summarize ? repo.summarizeCollections(context) : Promise.resolve(null),
    ]);
    return {
      items: page.items.map((item) => permittedDto(item, fields)),
      nextCursor: page.nextCursor,
      ...(totals === null ? {} : { summary: [...totals] }),
    };
  });
  app.get(`${cases}/:id`, { schema: { response: { 200: row } } }, async (request) => {
    const context = readContext(scope);
    const id = uuid((request.params as { id: string }).id, 'collectionCaseId');
    const grant = scope.authorization.permissions.get('ar:read');
    const ar = grant
      ? {
          actor: context.actor,
          scopes: grant.scopes,
          fields: grant.fields,
          anchors: scope.authorization.scopeAnchors?.get('ar:read') ?? [],
        }
      : null;
    const result = await requireRepository(scope).findCollection(id, context, ar);
    if (!result) throw new DomainError('not_found', 'Collection case not found');
    return permittedDto(result, fields);
  });
  for (const path of [
    cases,
    `${cases}/:id/followups`,
    `${cases}/:id/promises`,
    `${cases}/:id/legal-handoffs`,
    '/api/v1/collection-promises/:id/break',
    '/api/v1/legal-handoffs/:id/accept',
    '/api/v1/legal-handoffs/:id/evidence-packages',
  ]) {
    app.post(path, async (request, reply) => {
      const req: ApiRequest = {
        method: 'POST',
        pathname: request.url.split('?')[0] ?? request.url,
        body: request.body,
      };
      try {
        const result = await legacy(scope, req);
        void reply.code(result.statusCode);
        return result.body;
      } catch (error: unknown) {
        throw asCollectionGuard(error);
      }
    });
  }
}

async function legacy(scope: FastifyRouteScope, request: ApiRequest) {
  const routes = configuredCollectionRoutes(
    requireRepository(scope),
    scope.authorization,
    scope.correlationId,
  );
  const result = await dispatchRoutes(routes, request);
  if (!result) throw new DomainError('not_found', 'Collection route not found');
  return result;
}
