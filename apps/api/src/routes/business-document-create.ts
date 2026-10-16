import type { AuthorizationContext } from '@kingturf/domain';
import type { JsonObject } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['businessDocuments']>, 'create'>;
type Method = Repository['create'];
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  correlationId: string;
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    uuid: (value: unknown, name: string) => string;
    jsonObject: (value: unknown, name: string) => JsonObject;
  }>;
}>;
type Validated = Readonly<{ repository: Repository; method: Method; args: Parameters<Method> }>;
export function businessDocumentCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/business-documents' ? { params: [] } : null),
      validate: (request): Validated => {
        const b = context.parsers.objectBody(request.body);
        context.parsers.allow(b, [
          'templateKey',
          'title',
          'route',
          'subjectType',
          'subjectId',
          'customerId',
          'salesOrderId',
          'operatorId',
          'salespersonId',
          'assignedTo',
          'content',
        ]);
        const repository = context.repository();
        const method = repository.create;
        const args: Parameters<Method> = [
          {
            templateKey: context.parsers.string(b.templateKey, 'templateKey'),
            title: context.parsers.string(b.title, 'title'),
            route: context.parsers.string(b.route, 'route'),
            ...(b.subjectType
              ? {
                  subjectType: context.parsers.string(b.subjectType, 'subjectType'),
                  subjectId: context.parsers.uuid(b.subjectId, 'subjectId'),
                }
              : {}),
            ...(b.customerId
              ? { customerId: context.parsers.uuid(b.customerId, 'customerId') }
              : {}),
            ...(b.salesOrderId
              ? { salesOrderId: context.parsers.uuid(b.salesOrderId, 'salesOrderId') }
              : {}),
            ...(b.operatorId
              ? { operatorId: context.parsers.uuid(b.operatorId, 'operatorId') }
              : {}),
            ...(b.salespersonId
              ? { salespersonId: context.parsers.uuid(b.salespersonId, 'salespersonId') }
              : {}),
            ...(b.assignedTo
              ? { assignedTo: context.parsers.uuid(b.assignedTo, 'assignedTo') }
              : {}),
            content: context.parsers.jsonObject(b.content, 'content'),
          },
          context.authorization.actor,
          context.correlationId,
        ];
        return { repository, method, args };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Method>> = await validated.method.call(
          validated.repository,
          ...validated.args,
        );
        return { statusCode: 201, body: result };
      },
    }),
  ];
}
