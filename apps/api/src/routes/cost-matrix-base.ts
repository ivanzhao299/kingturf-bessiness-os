import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type MatrixRepository = Pick<
  NonNullable<ApiDependencies['commercial']>,
  'listCostMatrixSummaries' | 'listCostMatrices' | 'getCostMatrix' | 'createCostMatrix'
>;
type SummaryFilters = Parameters<MatrixRepository['listCostMatrixSummaries']>[0];
type MatrixContext = Readonly<{
  repository: MatrixRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields?: readonly string[]) => AuthorizedQuery;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    jsonObject: (value: unknown, name: string) => Record<string, never>;
    integer: (value: unknown, name: string, minimum: number, maximum: number) => number;
    currency: (value: unknown) => string;
    decimal: (value: unknown, name: string) => string;
  }>;
}>;

function summaryRoutes(context: MatrixContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/cost-matrix-summaries' ? { params: [] } : null),
      validate: (request) => {
        const grant = context.authorize('cost-matrix:read');
        const page = context.parsers.integer(Number(request.query?.page ?? 1), 'page', 1, 100000);
        const pageSize = context.parsers.integer(
          Number(request.query?.pageSize ?? 20),
          'pageSize',
          5,
          100,
        );
        const attention = request.query?.attention ?? 'ALL';
        if (
          !['ALL', 'NEEDS_INPUT', 'NEEDS_CALCULATION', 'READY_FOR_QUOTE', 'IN_QUOTE'].includes(
            attention,
          )
        )
          throw new DomainError('invalid_request', 'Invalid cost matrix attention filter');
        const sort = request.query?.sort ?? 'ATTENTION';
        if (!['ATTENTION', 'CODE', 'UPDATED', 'COST_DESC'].includes(sort))
          throw new DomainError('invalid_request', 'Invalid cost matrix sort');
        const filters: SummaryFilters = {
          page,
          pageSize,
          query: request.query?.q?.trim().slice(0, 120) ?? '',
          productFamily: request.query?.productFamily?.trim().slice(0, 80) ?? '',
          attention: attention as SummaryFilters['attention'],
          sort: sort as SummaryFilters['sort'],
        };
        return { grant, filters };
      },
      handler: async (_request, _match, input) => {
        const result = await context.repository.listCostMatrixSummaries(
          input.filters,
          context.authorization.actor,
          input.grant.scopes,
        );
        return {
          statusCode: 200,
          body: { ...result, page: input.filters.page, pageSize: input.filters.pageSize },
        };
      },
    }),
  ];
}

function readRoutes(context: MatrixContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/cost-matrices' ? { params: [] } : null),
      validate: () => context.authorize('cost-matrix:read'),
      handler: async (_request, _match, grant) => ({
        statusCode: 200,
        body: {
          items: await context.repository.listCostMatrices(
            context.authorization.actor,
            grant.scopes,
          ),
        },
      }),
    }),
    defineRoute({
      method: 'GET',
      match: (pathname) => {
        const match = /^\/api\/v1\/cost-matrices\/([0-9a-f-]+)$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (_request, match) => {
        const grant = context.authorize('cost-matrix:read');
        return {
          grant,
          modelId: context.parsers.uuid(match.params[0], 'modelId'),
          includeAudit:
            context.authorization.permissions.get('audit:read')?.scopes.includes('COMPANY') ===
            true,
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: await context.repository.getCostMatrix(
          input.modelId,
          context.authorization.actor,
          input.grant.scopes,
          input.includeAudit,
        ),
      }),
    }),
  ];
}

function creationRoutes(context: MatrixContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/cost-matrices' ? { params: [] } : null),
      validate: (request) => {
        const body = p.objectBody(request.body);
        p.allow(body, [
          'code',
          'name',
          'productItemVersionId',
          'productSpecification',
          'currency',
          'defaultTaxRate',
        ]);
        const grant = context.authorize('cost-matrix:manage', Object.keys(body));
        return {
          grant,
          input: {
            code: p.string(body.code, 'code'),
            name: p.string(body.name, 'name'),
            ...(body.productItemVersionId
              ? { productItemVersionId: p.uuid(body.productItemVersionId, 'productItemVersionId') }
              : {}),
            productSpecification: p.jsonObject(
              body.productSpecification ?? {},
              'productSpecification',
            ),
            currency: p.currency(body.currency),
            defaultTaxRate: p.decimal(body.defaultTaxRate, 'defaultTaxRate'),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: await context.repository.createCostMatrix(
          input.input,
          context.authorization.actor,
          input.grant.scopes,
          context.correlationId,
        ),
      }),
    }),
  ];
}

export function costMatrixBaseRoutes(context: MatrixContext): readonly RouteDefinition[] {
  return [...summaryRoutes(context), ...readRoutes(context), ...creationRoutes(context)];
}
