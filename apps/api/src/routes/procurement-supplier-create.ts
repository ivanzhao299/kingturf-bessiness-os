import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['procurement']>, 'createSupplier'>;
type CreateSupplier = Repository['createSupplier'];
type Input = Readonly<Parameters<CreateSupplier>[0]>;
type ScopeContext = Readonly<Parameters<CreateSupplier>[1]>;
type ValidatedSupplier = Readonly<{
  repository: Repository;
  createSupplier: CreateSupplier;
  input: Input;
  scopeContext: ScopeContext;
  correlationId: Parameters<CreateSupplier>[2];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<CreateSupplier>[2];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
    currency: (value: unknown) => string;
    integer: (value: unknown, name: string, min: number, max: number) => number;
    jsonObject: (value: unknown, name: string) => Input['contact'];
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function procurementSupplierCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/suppliers' ? { params: [] } : null),
      validate: (request): ValidatedSupplier => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'supplierNumber',
          'name',
          'currency',
          'paymentTermsDays',
          'qualityRatingBasisPoints',
          'contact',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'supplier:manage',
          Object.keys(body),
        );
        const repository = context.repository();
        const createSupplier = repository.createSupplier;
        const input: Input = {
          supplierNumber: context.parsers.stableCode(
            context.parsers.string(body.supplierNumber, 'supplierNumber'),
          ),
          name: context.parsers.string(body.name, 'name'),
          currency: context.parsers.currency(body.currency),
          paymentTermsDays: context.parsers.integer(
            body.paymentTermsDays,
            'paymentTermsDays',
            0,
            3650,
          ),
          qualityRatingBasisPoints:
            body.qualityRatingBasisPoints === null || body.qualityRatingBasisPoints === undefined
              ? null
              : context.parsers.integer(
                  body.qualityRatingBasisPoints,
                  'qualityRatingBasisPoints',
                  0,
                  10000,
                ),
          contact: context.parsers.jsonObject(body.contact ?? {}, 'contact'),
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, createSupplier, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<CreateSupplier>> = await validated.createSupplier.call(
          validated.repository,
          validated.input,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'supplier:read'),
        };
      },
    }),
  ];
}
