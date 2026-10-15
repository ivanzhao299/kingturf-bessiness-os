import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['mrp']>, 'run'>;
type Run = Repository['run'];
type Input = Readonly<Parameters<Run>[0]>;
type ScopeContext = Readonly<Parameters<Run>[1]>;
type ValidatedRun = Readonly<{
  repository: Repository;
  run: Run;
  input: Input;
  scopeContext: ScopeContext;
  correlationId: Parameters<Run>[2];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<Run>[2];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
    timestamp: (value: unknown, name: string) => string;
    calendarDate: (value: unknown, name: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function mrpRunCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/mrp-runs' ? { params: [] } : null),
      validate: (request): ValidatedRun => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, ['runNumber', 'asOf', 'horizonEnd']);
        const grant = context.authorizeQuery(context.authorization, 'mrp:run', Object.keys(body));
        const repository = context.repository();
        const run = repository.run;
        const input: Input = {
          runNumber: context.parsers.stableCode(
            context.parsers.string(body.runNumber, 'runNumber'),
          ),
          asOf: context.parsers.timestamp(body.asOf, 'asOf'),
          horizonEnd: context.parsers.calendarDate(body.horizonEnd, 'horizonEnd'),
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, run, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Run>> = await validated.run.call(
          validated.repository,
          validated.input,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'mrp:read'),
        };
      },
    }),
  ];
}
