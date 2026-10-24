import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type NestedReadContext = Readonly<{
  repository: Pick<
    NonNullable<ApiDependencies['commercial']>,
    'listCtrs' | 'listTechnicalSolutions'
  >;
  authorization: AuthorizationContext;
  authorize: (capability: PermissionKey) => AuthorizedQuery;
  permittedDto: (value: Record<string, unknown>, capability: PermissionKey) => unknown;
  uuid: (value: unknown, name: string) => string;
}>;

export function commercialNestedReadRoutes(context: NestedReadContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => {
        const match = /^\/api\/v1\/opportunities\/([0-9a-f-]+)\/ctrs$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      // GET body/query are ignored; authorization must precede the opportunity UUID.
      validate: (_request, match) => {
        const grant = context.authorize('ctr:read');
        return { grant, opportunityId: context.uuid(match.params[0], 'opportunityId') };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: {
          items: (
            await context.repository.listCtrs(
              input.opportunityId,
              context.authorization.actor,
              input.grant.scopes,
              input.grant.anchors,
            )
          ).map((item) => context.permittedDto(item, 'ctr:read')),
        },
      }),
    }),
    defineRoute({
      method: 'GET',
      match: (pathname) => {
        const match = /^\/api\/v1\/opportunities\/([0-9a-f-]+)\/technical-solutions$/u.exec(
          pathname,
        );
        return match ? { params: match.slice(1) } : null;
      },
      validate: (_request, match) => {
        const grant = context.authorize('technical-solution:read');
        return { grant, opportunityId: context.uuid(match.params[0], 'opportunityId') };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: {
          items: (
            await context.repository.listTechnicalSolutions(
              input.opportunityId,
              context.authorization.actor,
              input.grant.scopes,
              input.grant.anchors,
            )
          ).map((item) => context.permittedDto(item, 'technical-solution:read')),
        },
      }),
    }),
  ];
}
