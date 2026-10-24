import type { AuthorizationContext } from '@kingturf/domain';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['businessDocuments']>, 'updateBindings'>;
type Method = Repository['updateBindings'];
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  grant: ReturnType<typeof authorizeQuery>;
  correlationId: string;
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
  }>;
}>;
type Validated = Readonly<{ repository: Repository; method: Method; args: Parameters<Method> }>;
export function businessDocumentBindingRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'PATCH',
      match: (pathname) => {
        const match = /^\/api\/v1\/business-documents\/([0-9a-f-]+)\/bindings$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): Validated => {
        const b = context.parsers.objectBody(request.body);
        context.parsers.allow(b, [
          'customerId',
          'salesOrderId',
          'operatorId',
          'salespersonId',
          'assignedTo',
        ]);
        const nullableUuid = (value: unknown, field: string): string | null | undefined =>
          value === undefined
            ? undefined
            : value === null || value === ''
              ? null
              : context.parsers.uuid(value, field);
        const repository = context.repository();
        const method = repository.updateBindings;
        const args: Parameters<Method> = [
          match.params[0] ?? '',
          {
            customerId: nullableUuid(b.customerId, 'customerId'),
            salesOrderId: nullableUuid(b.salesOrderId, 'salesOrderId'),
            operatorId: nullableUuid(b.operatorId, 'operatorId'),
            salespersonId: nullableUuid(b.salespersonId, 'salespersonId'),
            assignedTo: nullableUuid(b.assignedTo, 'assignedTo'),
          },
          { actor: context.authorization.actor, scopes: context.grant.scopes },
          context.correlationId,
        ];
        return { repository, method, args };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Method>> = await validated.method.call(
          validated.repository,
          ...validated.args,
        );
        return { statusCode: 200, body: result };
      },
    }),
  ];
}
