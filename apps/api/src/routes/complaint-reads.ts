import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type ReadRepository = Pick<NonNullable<ApiDependencies['complaints']>, 'list' | 'getById'>;
type ListFilter = Parameters<ReadRepository['list']>[0];
type ReadContext = Readonly<{
  repository: ReadRepository;
  authorization: AuthorizationContext;
  authorize: (capability: PermissionKey) => AuthorizedQuery;
  permittedDto: (value: Record<string, unknown>, fields: readonly string[] | null) => unknown;
  parsers: Readonly<{
    string: (value: unknown, name: string) => string;
    uuid: (value: unknown, name: string) => string;
    integer: (value: unknown, name: string, minimum: number, maximum: number) => number;
    timestamp: (value: unknown, name: string) => string;
  }>;
}>;

function listFilter(context: ReadContext, request: ApiRequest): ListFilter {
  const p = context.parsers;
  const query = request.query ?? {};
  const state = query.state;
  const severity = query.severity;
  const allowedStates = [
    'REPORTED',
    'TRIAGED',
    'INVESTIGATING',
    'NCR_OPEN',
    'CAPA_ACTIVE',
    'VERIFIED',
    'CLOSED',
    'REJECTED',
  ];
  const allowedSeverities = ['LOW', 'MEDIUM', 'MAJOR', 'CRITICAL'];
  if (state && !allowedStates.includes(state))
    throw new DomainError('invalid_request', 'state is unsupported');
  if (severity && !allowedSeverities.includes(severity))
    throw new DomainError('invalid_request', 'severity is unsupported');
  if (query.overdue && !['true', 'false'].includes(query.overdue))
    throw new DomainError('invalid_request', 'overdue must be true or false');
  return {
    limit: query.limit ? p.integer(Number(query.limit), 'limit', 1, 100) : 50,
    ...(query.cursor ? { cursor: p.uuid(query.cursor, 'cursor') } : {}),
    ...(query.query ? { query: p.string(query.query, 'query') } : {}),
    ...(state ? { state: state as NonNullable<ListFilter['state']> } : {}),
    ...(severity ? { severity: severity as NonNullable<ListFilter['severity']> } : {}),
    ...(query.assignedTo ? { assignedTo: p.uuid(query.assignedTo, 'assignedTo') } : {}),
    ...(query.customerId ? { customerId: p.uuid(query.customerId, 'customerId') } : {}),
    ...(query.salesOrderId ? { salesOrderId: p.uuid(query.salesOrderId, 'salesOrderId') } : {}),
    ...(query.inventoryLotId
      ? { inventoryLotId: p.uuid(query.inventoryLotId, 'inventoryLotId') }
      : {}),
    ...(query.createdFrom ? { createdFrom: p.timestamp(query.createdFrom, 'createdFrom') } : {}),
    ...(query.createdTo ? { createdTo: p.timestamp(query.createdTo, 'createdTo') } : {}),
    ...(query.overdue ? { overdue: query.overdue === 'true' } : {}),
  };
}

export function complaintReadRoutes(context: ReadContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/complaints' ? { params: [] } : null),
      validate: (request) => {
        const grant = context.authorize('complaint:read');
        return { grant, filter: listFilter(context, request) };
      },
      handler: async (_request, _match, input) => {
        const page = await context.repository.list(input.filter, {
          actor: context.authorization.actor,
          scopes: input.grant.scopes,
          anchors: input.grant.anchors,
        });
        return {
          statusCode: 200,
          body: {
            items: page.items.map((item) =>
              context.permittedDto(
                item,
                context.authorization.permissions.get('complaint:read')?.fields ?? null,
              ),
            ),
            nextCursor: page.nextCursor,
          },
        };
      },
    }),
    defineRoute({
      method: 'GET',
      match: (pathname) => {
        const match = /^\/api\/v1\/complaints\/([0-9a-f-]+)$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (_request, match) => {
        const grant = context.authorize('complaint:read');
        return { grant, id: context.parsers.uuid(match.params[0], 'complaintId') };
      },
      handler: async (_request, _match, input) => {
        const item = await context.repository.getById(input.id, {
          actor: context.authorization.actor,
          scopes: input.grant.scopes,
          anchors: input.grant.anchors,
        });
        return {
          statusCode: 200,
          body: context.permittedDto(
            item,
            context.authorization.permissions.get('complaint:read')?.fields ?? null,
          ),
        };
      },
    }),
  ];
}
