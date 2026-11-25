import { z } from 'zod';
import { assertStableCode, DomainError } from '@kingturf/domain';
import type { ApiRequest } from '../../api-types.ts';
import {
  allow,
  decimal,
  mutationDto,
  objectBody,
  permittedDto,
  string,
  timestamp,
  uuid,
} from '../../app-values.ts';
import { INVENTORY_QUALITY, INVENTORY_SORTS } from '../../inventory-ledger-read-repository.ts';
import { guardRejection } from '../../pg-rejections.ts';
import { authorizeQuery } from '../../policy.ts';
import { procurementMovementCreateRoutes } from '../procurement-movement-create.ts';
import { dispatchRoutes } from '../types.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';

const BALANCES = '/api/v1/inventory-balances';
const MOVEMENTS = '/api/v1/inventory-movements';
const cursor = z.string().refine((value) => {
  const parts = value.split(':');
  return parts.length === 2 && parts.every((part) => z.uuid().safeParse(part).success);
});
const querySchema = z.object({
  query: z.string().trim().min(1).max(200).optional(),
  status: z.enum(INVENTORY_QUALITY).optional(),
  location: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: cursor.optional(),
  sort: z.enum(INVENTORY_SORTS).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
});
const sortField = {
  sku: 'sku',
  lot: 'lotNumber',
  location: 'locationCode',
  quantity: 'quantity',
  last: 'lastMovementAt',
} as const;
const row = z.looseObject({});
const list = z.object({ items: z.array(row), nextCursor: z.string().optional() });
const NEGATIVE_STOCK_HINT = {
  'inventory movement cannot create negative lot balance':
    '本次出库会使该批次库位结存为负，请减少数量或刷新库存后重试',
};

export function registerInventoryLedgerRoutes(app: FastifyRouteGroupApp, scope: FastifyRouteScope) {
  const repository = () => {
    const repo = scope.dependencies.procurement;
    if (!repo)
      throw Object.assign(new Error('Procurement dependency unavailable'), { statusCode: 503 });
    return repo;
  };
  const fields = scope.authorization.permissions.get('inventory:read')?.fields ?? null;
  const readContext = (used: readonly string[] = []) => {
    const grant = authorizeQuery(scope.authorization, 'inventory:read', used);
    return { actor: scope.authorization.actor, scopes: grant.scopes, anchors: grant.anchors };
  };
  app.get(
    BALANCES,
    { schema: { querystring: querySchema, response: { 200: list } } },
    async (request) => {
      const filter = request.query;
      const used = new Set<string>();
      if (filter.query !== undefined) for (const key of ['sku', 'lotNumber']) used.add(key);
      if (filter.status !== undefined) used.add('qualityStatus');
      if (filter.location !== undefined) used.add('locationId');
      if (filter.sort !== undefined) used.add(sortField[filter.sort]);
      const context = readContext([...used]);
      const repo = repository();
      if (Object.keys(filter).length === 0)
        return {
          items: (await repo.list('inventory', context)).map((item) => permittedDto(item, fields)),
        };
      const { items, nextCursor } = await repo.listInventoryBalancePage(context, filter);
      return {
        items: items.map((item) => permittedDto(item, fields)),
        ...(nextCursor === null ? {} : { nextCursor }),
      };
    },
  );
  app.get(
    `${BALANCES}/:lotId/:locationId`,
    { schema: { response: { 200: row } } },
    async (request) => {
      const params = request.params as { lotId: string; locationId: string };
      const visible = (permission: 'procurement:read' | 'production:read') => {
        const grant = scope.authorization.permissions.get(permission);
        return (
          grant?.fields === null &&
          (grant.scopes.includes('COMPANY') || grant.scopes.includes('GROUP'))
        );
      };
      const balance = await repository().findInventoryBalance(
        readContext(),
        uuid(params.lotId, 'lotId'),
        uuid(params.locationId, 'locationId'),
        {
          receipts: visible('procurement:read'),
          production: visible('production:read'),
        },
      );
      if (!balance) throw new DomainError('not_found', 'Inventory balance not found');
      return permittedDto(balance, fields);
    },
  );
  app.post(MOVEMENTS, async (request, reply) => {
    const routes = procurementMovementCreateRoutes({
      repository,
      authorization: scope.authorization,
      authorizeQuery,
      correlationId: scope.correlationId,
      parsers: {
        objectBody,
        allow,
        string,
        uuid,
        decimal,
        timestamp,
        stableCode: assertStableCode,
      },
      mutationDto,
    });
    try {
      const result = await dispatchRoutes(routes, {
        method: 'POST',
        pathname: MOVEMENTS,
        body: request.body,
        headers: request.headers,
      } as ApiRequest);
      if (!result) throw new Error('Missing inventory movement write route');
      void reply.code(result.statusCode);
      return result.body;
    } catch (error: unknown) {
      const hint = guardRejection(error, NEGATIVE_STOCK_HINT);
      if (hint === null) throw error;
      throw new DomainError('conflict', hint);
    }
  });
}
