import { z } from 'zod';
import { DomainError } from '@kingturf/domain';
import { permittedDto, uuid } from '../../app-values.ts';
import { authorizeQuery } from '../../policy.ts';
import { SUPPLIER_QUOTE_SORTS } from '../../supplier-quote-read-repository.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';

const querySchema = z.object({
  query: z.string().trim().min(1).max(200).optional(),
  status: z.enum(['VALID', 'EXPIRED']).optional(),
  sort: z.enum(SUPPLIER_QUOTE_SORTS).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
const quoteSchema = z.looseObject({ id: z.string().optional() });
const listSchema = z.object({ items: z.array(quoteSchema), nextCursor: z.string().optional() });
const sortField = {
  received: 'received_at',
  reference: 'quote_reference',
  supplier: 'supplierName',
  rfq: 'rfqNumber',
  expiry: 'valid_until',
} as const;

export function registerSupplierQuoteRoutes(app: FastifyRouteGroupApp, scope: FastifyRouteScope) {
  const requireRepository = () => {
    const repo = scope.dependencies.procurement;
    if (!repo)
      throw Object.assign(new Error('Procurement dependency unavailable'), { statusCode: 503 });
    return repo;
  };
  const fields = scope.authorization.permissions.get('procurement:read')?.fields ?? null;

  app.get(
    '/api/v1/supplier-quotes',
    {
      schema: { querystring: querySchema, response: { 200: listSchema } },
    },
    async (request) => {
      const query = request.query;
      const usedFields = new Set<string>();
      if (query.query !== undefined)
        for (const field of ['quote_reference', 'supplierName', 'lines']) usedFields.add(field);
      if (query.status !== undefined) usedFields.add('valid_until');
      if (query.sort !== undefined) usedFields.add(sortField[query.sort]);
      const grant = authorizeQuery(scope.authorization, 'procurement:read', [...usedFields]);
      const context = {
        actor: scope.authorization.actor,
        scopes: grant.scopes,
        anchors: grant.anchors,
      };
      const repository = requireRepository();
      if (Object.keys(query).length === 0)
        return {
          items: (await repository.list('quotes', context)).map((item) =>
            permittedDto(item, fields),
          ),
        };
      const { items, nextCursor } = await repository.listSupplierQuotePage(context, query);
      return {
        items: items.map((item) => permittedDto(item, fields)),
        ...(nextCursor === null ? {} : { nextCursor }),
      };
    },
  );

  app.get(
    '/api/v1/supplier-quotes/:quoteId',
    { schema: { response: { 200: quoteSchema } } },
    async (request) => {
      const grant = authorizeQuery(scope.authorization, 'procurement:read');
      const id = uuid((request.params as { quoteId: string }).quoteId, 'quoteId');
      const quote = await requireRepository().findSupplierQuote(id, {
        actor: scope.authorization.actor,
        scopes: grant.scopes,
        anchors: grant.anchors,
      });
      if (!quote) throw new DomainError('not_found', 'Supplier quote not found');
      return permittedDto(quote, fields);
    },
  );
}
