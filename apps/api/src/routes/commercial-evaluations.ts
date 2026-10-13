import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type EvaluationRepository = Pick<
  NonNullable<ApiDependencies['commercial']>,
  'evaluateCost' | 'evaluatePolicy'
>;
type EvaluationContext = Readonly<{
  repository: EvaluationRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields: readonly string[]) => AuthorizedQuery;
  mutationDto: (value: Record<string, unknown>, capability: PermissionKey) => unknown;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    decimal: (value: unknown, name: string) => string;
    currency: (value: unknown) => string;
    array: (value: unknown, name: string) => readonly unknown[];
    jsonObject: (value: unknown, name: string) => Record<string, never>;
    idempotency: (request: ApiRequest) => string;
  }>;
}>;

function costLines(context: EvaluationContext, value: unknown) {
  const p = context.parsers;
  return p.array(value, 'lines').map((candidate, index) => {
    const line = p.jsonObject(candidate, `lines[${String(index)}]`);
    return {
      key: p.string(line.key, 'key'),
      description: p.string(line.description, 'description'),
      quantity: { value: p.decimal(line.quantity, 'quantity'), unit: p.string(line.unit, 'unit') },
      unitCost: {
        amount: p.decimal(line.unitCost, 'unitCost'),
        currency: p.currency(line.currency),
      },
    };
  });
}

export function commercialEvaluationRoutes(context: EvaluationContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/cost-evaluations' ? { params: [] } : null),
      validate: (request) => {
        const body = p.objectBody(request.body);
        p.allow(body, [
          'modelVersionId',
          'technicalSolutionRevisionId',
          'currency',
          'lines',
          'context',
        ]);
        const grant = context.authorize('cost:evaluate', Object.keys(body));
        const lines = costLines(context, body.lines);
        return {
          grant,
          input: {
            modelVersionId: p.uuid(body.modelVersionId, 'modelVersionId'),
            technicalSolutionRevisionId: p.uuid(
              body.technicalSolutionRevisionId,
              'technicalSolutionRevisionId',
            ),
            currency: p.currency(body.currency),
            lines,
            context: p.jsonObject(body.context, 'context'),
            idempotencyKey: p.idempotency(request),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await context.repository.evaluateCost(
            input.input,
            context.authorization.actor,
            input.grant.scopes,
            input.grant.anchors,
            context.correlationId,
          ),
          'cost:read',
        ),
      }),
    }),
    defineRoute({
      method: 'POST',
      match: (pathname) =>
        pathname === '/api/v1/sales-policy-evaluations' ? { params: [] } : null,
      validate: (request) => {
        const body = p.objectBody(request.body);
        p.allow(body, ['policyVersionId', 'costDecisionId', 'context']);
        const grant = context.authorize('sales-policy:evaluate', Object.keys(body));
        return {
          grant,
          input: {
            policyVersionId: p.uuid(body.policyVersionId, 'policyVersionId'),
            costDecisionId: p.uuid(body.costDecisionId, 'costDecisionId'),
            context: p.jsonObject(body.context, 'context'),
            idempotencyKey: p.idempotency(request),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await context.repository.evaluatePolicy(
            input.input,
            context.authorization.actor,
            input.grant.scopes,
            input.grant.anchors,
            context.correlationId,
          ),
          'sales-policy:read',
        ),
      }),
    }),
  ];
}
