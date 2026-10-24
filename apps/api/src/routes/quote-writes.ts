import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type QuoteRepository = Pick<NonNullable<ApiDependencies['commercial']>, 'createQuote'>;
type QuoteContext = Readonly<{
  repository: QuoteRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields: readonly string[]) => AuthorizedQuery;
  mutationDto: (value: Record<string, unknown>) => unknown;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    decimal: (value: unknown, name: string, nonnegative?: boolean) => string;
    currency: (value: unknown) => string;
    integer: (value: unknown, name: string, minimum: number, maximum: number) => number;
    timestamp: (value: unknown, name: string) => string;
    array: (value: unknown, name: string) => readonly unknown[];
    jsonObject: (value: unknown, name: string) => Record<string, never>;
  }>;
}>;
const quoteFields = [
  'quoteNumber',
  'opportunityId',
  'ctrVersionId',
  'technicalSolutionRevisionId',
  'costDecisionId',
  'policyVersionId',
  'policyEvaluationId',
  'currency',
  'subtotal',
  'discount',
  'total',
  'costTotal',
  'margin',
  'marginBasisPoints',
  'validUntil',
  'lines',
] as const;

function bodyAndLines(context: QuoteContext, request: ApiRequest, capability: PermissionKey) {
  const p = context.parsers;
  const body = p.objectBody(request.body);
  p.allow(body, quoteFields);
  const grant = context.authorize(capability, Object.keys(body));
  const lines = p.array(body.lines, 'lines').map((candidate, index) => {
    const line = p.jsonObject(candidate, `lines[${String(index)}]`);
    return {
      description: p.string(line.description, 'description'),
      quantity: p.decimal(line.quantity, 'quantity'),
      unitCode: p.string(line.unitCode, 'unitCode'),
      unitPrice: p.decimal(line.unitPrice, 'unitPrice'),
      total: p.decimal(line.total, 'total'),
    };
  });
  return { body, grant, lines };
}

function quoteValues(context: QuoteContext, body: Record<string, unknown>) {
  const p = context.parsers;
  return {
    quoteNumber: p.string(body.quoteNumber, 'quoteNumber'),
    opportunityId: p.uuid(body.opportunityId, 'opportunityId'),
    ctrVersionId: p.uuid(body.ctrVersionId, 'ctrVersionId'),
    technicalSolutionRevisionId: p.uuid(
      body.technicalSolutionRevisionId,
      'technicalSolutionRevisionId',
    ),
    costDecisionId: p.uuid(body.costDecisionId, 'costDecisionId'),
    policyVersionId: p.uuid(body.policyVersionId, 'policyVersionId'),
    policyEvaluationId: p.uuid(body.policyEvaluationId, 'policyEvaluationId'),
    currency: p.currency(body.currency),
    subtotal: p.decimal(body.subtotal, 'subtotal'),
    discount: p.decimal(body.discount, 'discount'),
    total: p.decimal(body.total, 'total'),
    costTotal: p.decimal(body.costTotal, 'costTotal'),
    margin: p.decimal(body.margin, 'margin', false),
    marginBasisPoints: p.integer(body.marginBasisPoints, 'marginBasisPoints', -100000, 10000),
    validUntil: p.timestamp(body.validUntil, 'validUntil'),
  };
}

export function quoteWriteRoutes(context: QuoteContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/quotes' ? { params: [] } : null),
      validate: (request) => {
        const { body, grant, lines } = bodyAndLines(context, request, 'quote:create');
        return { grant, input: { ...quoteValues(context, body), lines } };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await context.repository.createQuote(
            input.input,
            context.authorization.actor,
            input.grant.scopes,
            input.grant.anchors,
            context.correlationId,
          ),
        ),
      }),
    }),
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/quotes\/([0-9a-f-]+)\/revisions$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match) => {
        const { body, grant, lines } = bodyAndLines(context, request, 'quote:update');
        const quoteId = context.parsers.uuid(match.params[0], 'quoteId');
        return { grant, input: { quoteId, ...quoteValues(context, body), lines } };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await context.repository.createQuote(
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
