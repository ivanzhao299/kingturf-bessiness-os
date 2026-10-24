import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiResponse } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type CustomerRepository = Pick<
  NonNullable<ApiDependencies['crm']>,
  'listCustomers' | 'createCustomer' | 'findCustomer'
>;
type CreateInput = Parameters<CustomerRepository['createCustomer']>[0];
type CustomerContext = Readonly<{
  repository: CustomerRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields?: readonly string[]) => AuthorizedQuery;
  permittedDto: (value: Record<string, unknown>, fields: readonly string[] | null) => unknown;
  mutationDto: (value: Record<string, unknown>) => unknown;
  notFound: () => ApiResponse;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    strings: (value: unknown, name: string) => readonly string[];
    uuid: (value: unknown, name: string) => string;
  }>;
}>;

const customerPath =
  /^\/api\/v1\/customers(?:\/([0-9a-f-]+))?(?:\/(contacts|ownership|activities|360))?$/u;

export function customerCollectionRoutes(context: CustomerContext): readonly RouteDefinition[] {
  const collectionMatch = (pathname: string) => {
    const match = customerPath.exec(pathname);
    return match && !match[1] ? { params: [] } : null;
  };
  return [
    defineRoute({
      method: 'GET',
      match: collectionMatch,
      validate: () => {
        const grant = context.authorize('customer:read');
        const fields = context.authorization.permissions.get('customer:read')?.fields ?? null;
        return { grant, fields };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: {
          items: (
            await context.repository.listCustomers(
              context.authorization.actor,
              input.grant.scopes,
              input.grant.anchors,
            )
          ).map((item) => context.permittedDto(item, input.fields)),
          nextCursor: null,
        },
      }),
    }),
    defineRoute({
      method: 'POST',
      match: collectionMatch,
      validate: (request): CreateInput => {
        context.authorize('customer:create', ['name', 'customerNumber', 'tags']);
        const p = context.parsers;
        const body = p.objectBody(request.body);
        p.allow(body, ['name', 'customerNumber', 'tags']);
        return {
          name: p.string(body.name, 'name'),
          customerNumber: p.string(body.customerNumber, 'customerNumber'),
          tags: body.tags === undefined ? [] : p.strings(body.tags, 'tags'),
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await context.repository.createCustomer(
            input,
            context.authorization.actor,
            context.correlationId,
          ),
        ),
      }),
    }),
  ];
}

export function customerDetailRoutes(context: CustomerContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => {
        const match = customerPath.exec(pathname);
        return match?.[1] && !match[2] ? { params: [match[1]] } : null;
      },
      validate: (_request, match) => {
        const grant = context.authorize('customer:read');
        return { grant, id: context.parsers.uuid(match.params[0], 'customerId') };
      },
      handler: async (_request, _match, input) => {
        const found = await context.repository.findCustomer(
          input.id,
          context.authorization.actor,
          input.grant.scopes,
          input.grant.anchors,
        );
        return found
          ? {
              statusCode: 200,
              body: context.permittedDto(
                found,
                context.authorization.permissions.get('customer:read')?.fields ?? null,
              ),
            }
          : context.notFound();
      },
    }),
  ];
}
