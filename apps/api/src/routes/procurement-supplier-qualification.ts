import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['procurement']>, 'qualifySupplier'>;
type QualifySupplier = Repository['qualifySupplier'];
type Input = Readonly<Parameters<QualifySupplier>[1]>;
type ScopeContext = Readonly<Parameters<QualifySupplier>[2]>;
type ValidatedQualification = Readonly<{
  repository: Repository;
  qualifySupplier: QualifySupplier;
  supplierId: Parameters<QualifySupplier>[0];
  input: Input;
  scopeContext: ScopeContext;
  correlationId: Parameters<QualifySupplier>[3];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<QualifySupplier>[3];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    uuid: (value: unknown, name: string) => string;
    calendarDate: (value: unknown, name: string) => string;
    decimal: (value: unknown, name: string) => string;
    integer: (value: unknown, name: string, min: number, max: number) => number;
    jsonObject: (value: unknown, name: string) => Input['evidence'];
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function procurementSupplierQualificationRoutes(
  context: Context,
): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/suppliers\/([0-9a-f-]+)\/qualifications$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedQualification => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'itemVersionId',
          'status',
          'validFrom',
          'validTo',
          'minimumOrderQuantity',
          'leadTimeDays',
          'evidence',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'supplier:manage',
          Object.keys(body),
        );
        const status = context.parsers.string(body.status, 'status');
        if (!['APPROVED', 'CONDITIONAL', 'REJECTED'].includes(status))
          throw new DomainError('invalid_request', 'qualification status is unsupported');
        const repository = context.repository();
        const qualifySupplier = repository.qualifySupplier;
        const supplierId = context.parsers.uuid(match.params[0], 'supplierId');
        const input: Input = {
          itemVersionId: context.parsers.uuid(body.itemVersionId, 'itemVersionId'),
          status,
          validFrom: context.parsers.calendarDate(body.validFrom, 'validFrom'),
          validTo:
            body.validTo === null || body.validTo === undefined
              ? null
              : context.parsers.calendarDate(body.validTo, 'validTo'),
          minimumOrderQuantity: context.parsers.decimal(
            body.minimumOrderQuantity,
            'minimumOrderQuantity',
          ),
          leadTimeDays: context.parsers.integer(body.leadTimeDays, 'leadTimeDays', 0, 3650),
          evidence: context.parsers.jsonObject(body.evidence ?? {}, 'evidence'),
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, qualifySupplier, supplierId, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<QualifySupplier>> = await validated.qualifySupplier.call(
          validated.repository,
          validated.supplierId,
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
