import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type ListOperationalPage = Qtc['listOperationalPage'];
type View = Parameters<ListOperationalPage>[0];
type Filter = Readonly<Parameters<ListOperationalPage>[1]>;
type ScopeContext = Readonly<Parameters<ListOperationalPage>[2]>;
type ValidatedRead = Readonly<{
  listOperationalPage: ListOperationalPage;
  view: View;
  filter: Filter;
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: Pick<Qtc, 'listOperationalPage'>;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  permittedDto: <T extends Record<string, unknown>>(
    value: T,
    fields: readonly string[] | null,
  ) => Partial<T>;
  parsers: Readonly<{
    decimal: (value: unknown, name: string) => string;
    integer: (value: unknown, name: string, minimum: number, maximum: number) => number;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    timestamp: (value: unknown, name: string) => string;
  }>;
}>;
type Read = Readonly<{ path: string; capability: PermissionKey; view: View }>;
const reads = [
  { path: '/api/v1/ar-open-items', capability: 'ar:read', view: 'ar' },
  { path: '/api/v1/bank-payments', capability: 'bank-payment:read', view: 'payments' },
] as const satisfies readonly Read[];

export function qtcOperationalReadRoutes(context: Context): readonly RouteDefinition[] {
  return reads.map((read) =>
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === read.path ? { params: [] } : null),
      validate: (request): ValidatedRead => {
        const grant = context.authorizeQuery(context.authorization, read.capability);
        const query = request.query ?? {};
        const state = query.state;
        if (state && !['OPEN', 'CLEARED', 'OVERDUE'].includes(state))
          throw new DomainError('invalid_request', 'state is unsupported');
        const minimum = query.minAmount
          ? context.parsers.decimal(query.minAmount, 'minAmount')
          : undefined;
        const maximum = query.maxAmount
          ? context.parsers.decimal(query.maxAmount, 'maxAmount')
          : undefined;
        if (minimum && maximum && Number(minimum) > Number(maximum))
          throw new DomainError('invalid_request', 'minAmount must not exceed maxAmount');
        const listOperationalPage = context.repository.listOperationalPage;
        const view = read.view;
        const filter: Filter = {
          limit: query.limit ? context.parsers.integer(Number(query.limit), 'limit', 1, 100) : 50,
          ...(query.cursor ? { cursor: context.parsers.uuid(query.cursor, 'cursor') } : {}),
          ...(query.query ? { query: context.parsers.string(query.query, 'query') } : {}),
          ...(query.from ? { from: context.parsers.timestamp(query.from, 'from') } : {}),
          ...(query.to ? { to: context.parsers.timestamp(query.to, 'to') } : {}),
          ...(minimum ? { minAmount: minimum } : {}),
          ...(maximum ? { maxAmount: maximum } : {}),
          ...(state ? { state: state as 'OPEN' | 'CLEARED' | 'OVERDUE' } : {}),
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        return { listOperationalPage, view, filter, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const page = await validated.listOperationalPage.call(
          context.repository,
          validated.view,
          validated.filter,
          validated.scopeContext,
        );
        return {
          statusCode: 200,
          body: {
            items: page.items.map((item) =>
              context.permittedDto(
                item,
                context.authorization.permissions.get(read.capability)?.fields ?? null,
              ),
            ),
            nextCursor: page.nextCursor,
          },
        };
      },
    }),
  );
}
