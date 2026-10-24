import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type CalculationRepository = Pick<
  NonNullable<ApiDependencies['commercial']>,
  'calculateCostMatrix' | 'createQuoteCostDecisionFromMatrix'
>;
type CalculationContext = Readonly<{
  repository: CalculationRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields: readonly string[]) => AuthorizedQuery;
  mutationDto: (value: Record<string, unknown>) => unknown;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    idempotency: (request: ApiRequest) => string;
  }>;
}>;

type CalculateInput = Readonly<{
  grant: AuthorizedQuery;
  modelId: string;
  mode: Parameters<CalculationRepository['calculateCostMatrix']>[1];
  idempotencyKey: string;
}>;

export function costMatrixCalculationRoutes(
  context: CalculationContext,
): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/cost-matrices\/([0-9a-f-]+)\/calculate$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): CalculateInput => {
        const body = p.objectBody(request.body);
        p.allow(body, ['pricingMode']);
        const grant = context.authorize('cost-matrix:calculate', Object.keys(body));
        const mode = p.string(body.pricingMode, 'pricingMode');
        if (mode !== 'TAX_INCLUSIVE' && mode !== 'TAX_EXCLUSIVE')
          throw new DomainError(
            'invalid_request',
            'pricingMode must be TAX_INCLUSIVE or TAX_EXCLUSIVE',
          );
        return {
          grant,
          modelId: p.uuid(match.params[0], 'modelId'),
          mode,
          idempotencyKey: p.idempotency(request),
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: await context.repository.calculateCostMatrix(
          input.modelId,
          input.mode,
          input.idempotencyKey,
          context.authorization.actor,
          input.grant.scopes,
          context.correlationId,
        ),
      }),
    }),
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match =
          /^\/api\/v1\/cost-matrix-calculations\/([0-9a-f-]+)\/quote-cost-decision$/u.exec(
            pathname,
          );
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match) => {
        const body = p.objectBody(request.body);
        p.allow(body, ['technicalSolutionRevisionId', 'modelVersionId']);
        const grant = context.authorize('cost:evaluate', Object.keys(body));
        return {
          grant,
          calculationId: p.uuid(match.params[0], 'calculationId'),
          input: {
            technicalSolutionRevisionId: p.uuid(
              body.technicalSolutionRevisionId,
              'technicalSolutionRevisionId',
            ),
            modelVersionId: p.uuid(body.modelVersionId, 'modelVersionId'),
            idempotencyKey: p.idempotency(request),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await context.repository.createQuoteCostDecisionFromMatrix(
            input.calculationId,
            input.input,
            context.authorization.actor,
            input.grant.scopes,
            input.grant.anchors,
            context.correlationId,
          ),
        ),
      }),
    }),
  ];
}
