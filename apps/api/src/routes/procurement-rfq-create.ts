import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['procurement']>, 'createRfq'>;
type CreateRfq = Repository['createRfq'];
type Input = Readonly<Parameters<CreateRfq>[0]>;
type ScopeContext = Readonly<Parameters<CreateRfq>[1]>;
type ValidatedRfq = Readonly<{
  repository: Repository;
  createRfq: CreateRfq;
  input: Input;
  scopeContext: ScopeContext;
  correlationId: Parameters<CreateRfq>[2];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<CreateRfq>[2];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    array: (value: unknown, name: string) => readonly unknown[];
    jsonObject: (value: unknown, name: string) => Record<string, unknown>;
    uuid: (value: unknown, name: string) => string;
    decimal: (value: unknown, name: string) => string;
    calendarDate: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
    timestamp: (value: unknown, name: string) => string;
    currency: (value: unknown) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function procurementRfqCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/procurement-rfqs' ? { params: [] } : null),
      validate: (request): ValidatedRfq => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, ['rfqNumber', 'responseDueAt', 'currency', 'lines', 'issue']);
        const grant = context.authorizeQuery(
          context.authorization,
          'procurement:manage',
          Object.keys(body),
        );
        const lines = context.parsers.array(body.lines, 'lines').map((entry, index) => {
          const line = context.parsers.jsonObject(entry, `lines[${String(index)}]`);
          context.parsers.allow(line, ['itemVersionId', 'quantity', 'requiredAt']);
          return {
            itemVersionId: context.parsers.uuid(line.itemVersionId, 'itemVersionId'),
            quantity: context.parsers.decimal(line.quantity, 'quantity'),
            requiredAt: context.parsers.calendarDate(line.requiredAt, 'requiredAt'),
          };
        });
        if (!lines.length) throw new DomainError('invalid_request', 'lines must not be empty');
        const repository = context.repository();
        const createRfq = repository.createRfq;
        const input: Input = {
          rfqNumber: context.parsers.stableCode(
            context.parsers.string(body.rfqNumber, 'rfqNumber'),
          ),
          responseDueAt: context.parsers.timestamp(body.responseDueAt, 'responseDueAt'),
          currency: context.parsers.currency(body.currency),
          lines,
          issue: body.issue === true,
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, createRfq, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<CreateRfq>> = await validated.createRfq.call(
          validated.repository,
          validated.input,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'procurement:read'),
        };
      },
    }),
  ];
}
