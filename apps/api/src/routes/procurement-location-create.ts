import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['procurement']>, 'createLocation'>;
type CreateLocation = Repository['createLocation'];
type Input = Readonly<Parameters<CreateLocation>[0]>;
type ScopeContext = Readonly<Parameters<CreateLocation>[1]>;
type ValidatedLocation = Readonly<{
  repository: Repository;
  createLocation: CreateLocation;
  input: Input;
  scopeContext: ScopeContext;
  correlationId: Parameters<CreateLocation>[2];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<CreateLocation>[2];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function procurementLocationCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/inventory-locations' ? { params: [] } : null),
      validate: (request): ValidatedLocation => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, ['code', 'name', 'locationType']);
        const grant = context.authorizeQuery(
          context.authorization,
          'inventory:move',
          Object.keys(body),
        );
        const locationType = context.parsers.string(body.locationType, 'locationType');
        if (
          !['RECEIVING', 'STORAGE', 'PRODUCTION', 'QUARANTINE', 'SHIPPING'].includes(locationType)
        )
          throw new DomainError('invalid_request', 'locationType is unsupported');
        const repository = context.repository();
        const createLocation = repository.createLocation;
        const input: Input = {
          code: context.parsers.stableCode(context.parsers.string(body.code, 'code')),
          name: context.parsers.string(body.name, 'name'),
          locationType,
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, createLocation, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<CreateLocation>> = await validated.createLocation.call(
          validated.repository,
          validated.input,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'inventory:read'),
        };
      },
    }),
  ];
}
