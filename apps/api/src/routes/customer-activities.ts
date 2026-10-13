import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type ActivityRepository = Pick<NonNullable<ApiDependencies['crm']>, 'createActivity'>;
type ActivityArgs = Parameters<ActivityRepository['createActivity']>;
type ActivityInput = ActivityArgs[1];
type ValidatedActivity = Readonly<{
  grant: AuthorizedQuery;
  id: ActivityArgs[0];
  key: ActivityArgs[4];
  input: ActivityInput;
}>;
type ActivityContext = Readonly<{
  repository: ActivityRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields: readonly string[]) => AuthorizedQuery;
  mutationDto: (value: Record<string, unknown>) => unknown;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    timestamp: (value: unknown, name: string) => string;
  }>;
}>;

export function customerActivityRoutes(context: ActivityContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/customers\/([0-9a-f-]+)\/activities$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedActivity => {
        const grant = context.authorize('customer-activity:create', [
          'leadId',
          'type',
          'occurredAt',
          'summary',
          'details',
        ]);
        const key = request.headers?.['idempotency-key'];
        if (!key || key.length > 128)
          throw new DomainError(
            'invalid_request',
            'Idempotency-Key is required and must be at most 128 characters',
          );
        const body = p.objectBody(request.body);
        p.allow(body, ['leadId', 'type', 'occurredAt', 'summary', 'details']);
        const details = (
          body.details === undefined ? {} : p.objectBody(body.details)
        ) as ActivityInput['details'];
        return {
          grant,
          key,
          id: p.uuid(match.params[0], 'customerId'),
          input: {
            leadId:
              body.leadId === null || body.leadId === undefined
                ? null
                : p.uuid(body.leadId, 'leadId'),
            type: p.string(body.type, 'type'),
            occurredAt: p.timestamp(body.occurredAt, 'occurredAt'),
            summary: p.string(body.summary, 'summary'),
            details,
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await context.repository.createActivity(
            input.id,
            input.input,
            context.authorization.actor,
            context.correlationId,
            input.key,
            input.grant.scopes,
            input.grant.anchors,
          ),
        ),
      }),
    }),
  ];
}
