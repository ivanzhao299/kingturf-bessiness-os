import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type FactorRepository = Pick<
  NonNullable<ApiDependencies['commercial']>,
  'addCostMatrixFactor' | 'updateCostMatrixFactor'
>;
type FactorContext = Readonly<{
  repository: FactorRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields: readonly string[]) => AuthorizedQuery;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    decimal: (value: unknown, name: string) => string;
    calendarDate: (value: unknown, name: string) => string;
    integer: (value: unknown, name: string, minimum: number, maximum: number) => number;
    costFactorSourceType: (value: unknown) => string;
    requireCostFactorItemSource: (sourceType: string, sourceItemVersionId: unknown) => void;
  }>;
}>;
const factorFields = [
  'factorName',
  'category',
  'sourceType',
  'sourceItemVersionId',
  'quantity',
  'unitCode',
  'manualUnitPriceTaxInclusive',
  'taxRate',
  'priceSourceName',
  'priceSourceReference',
  'priceEffectiveAt',
  'priceNote',
  'adjustable',
  'sortOrder',
] as const;

function bodyAndSource(context: FactorContext, request: ApiRequest, fields: readonly string[]) {
  const p = context.parsers;
  const body = p.objectBody(request.body);
  p.allow(body, fields);
  const grant = context.authorize('cost-matrix:manage', Object.keys(body));
  const sourceType = p.costFactorSourceType(body.sourceType);
  p.requireCostFactorItemSource(sourceType, body.sourceItemVersionId);
  return { body, grant, sourceType };
}

function factorValues(context: FactorContext, body: Record<string, unknown>, sourceType: string) {
  const p = context.parsers;
  return {
    factorName: p.string(body.factorName, 'factorName'),
    category: p.string(body.category, 'category'),
    sourceType,
    ...(body.sourceItemVersionId
      ? { sourceItemVersionId: p.uuid(body.sourceItemVersionId, 'sourceItemVersionId') }
      : {}),
    quantity: p.decimal(body.quantity, 'quantity'),
    unitCode: p.string(body.unitCode, 'unitCode'),
    manualUnitPriceTaxInclusive: p.decimal(
      body.manualUnitPriceTaxInclusive,
      'manualUnitPriceTaxInclusive',
    ),
    taxRate: p.decimal(body.taxRate, 'taxRate'),
    priceSourceName: p.string(body.priceSourceName, 'priceSourceName'),
    ...(body.priceSourceReference
      ? { priceSourceReference: p.string(body.priceSourceReference, 'priceSourceReference') }
      : {}),
    ...(body.priceEffectiveAt
      ? { priceEffectiveAt: p.calendarDate(body.priceEffectiveAt, 'priceEffectiveAt') }
      : {}),
    ...(body.priceNote ? { priceNote: p.string(body.priceNote, 'priceNote') } : {}),
    adjustable: body.adjustable !== false,
    sortOrder: p.integer(body.sortOrder ?? 0, 'sortOrder', 0, 10000),
  };
}

export function costMatrixFactorRoutes(context: FactorContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/cost-matrices\/([0-9a-f-]+)\/factors$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match) => {
        const { body, grant, sourceType } = bodyAndSource(context, request, [
          'factorCode',
          ...factorFields,
        ]);
        const modelId = p.uuid(match.params[0], 'modelId');
        return {
          grant,
          modelId,
          input: {
            factorCode: p.string(body.factorCode, 'factorCode'),
            ...factorValues(context, body, sourceType),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: await context.repository.addCostMatrixFactor(
          input.modelId,
          input.input,
          context.authorization.actor,
          input.grant.scopes,
          context.correlationId,
        ),
      }),
    }),
    defineRoute({
      method: 'PATCH',
      match: (pathname) => {
        const match = /^\/api\/v1\/cost-matrices\/([0-9a-f-]+)\/factors\/([0-9a-f-]+)$/u.exec(
          pathname,
        );
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match) => {
        const { body, grant, sourceType } = bodyAndSource(context, request, factorFields);
        const modelId = p.uuid(match.params[0], 'modelId');
        const factorId = p.uuid(match.params[1], 'factorId');
        return { grant, modelId, factorId, input: factorValues(context, body, sourceType) };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: await context.repository.updateCostMatrixFactor(
          input.modelId,
          input.factorId,
          input.input,
          context.authorization.actor,
          input.grant.scopes,
          context.correlationId,
        ),
      }),
    }),
  ];
}
