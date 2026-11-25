import { DomainError, type Actor, type ScopeAnchor } from '@kingturf/domain';
import type { SqlClient } from '@kingturf/database';
import type { DataScope, JsonObject } from '@kingturf/types';

export type ShipmentReadContext = Readonly<{
  actor: Actor;
  scopes: readonly DataScope[];
  anchors: readonly ScopeAnchor[];
}>;
export const requireShipmentCompany = (context: ShipmentReadContext) => {
  if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP'))
    throw new DomainError('forbidden', 'Shipment operations require company scope');
};

const SHIPMENT_RELEASE_SELECT = `SELECT to_jsonb(r)||jsonb_build_object('state',s.state,'orderNumber',o.order_number,'productionOrderNumber',p.order_number,'lotNumber',l.lot_number,
        'events',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.sequence) FROM shipment_release_events e WHERE e.tenant_id=r.tenant_id AND e.release_request_id=r.id),'[]'::jsonb),
        'shipments',coalesce((SELECT jsonb_agg(to_jsonb(sh)||jsonb_build_object('state',ss.state,'events',coalesce((SELECT jsonb_agg(to_jsonb(se) ORDER BY se.sequence) FROM shipment_events se WHERE se.tenant_id=sh.tenant_id AND se.shipment_id=sh.id),'[]'::jsonb)) ORDER BY sh.created_at) FROM shipments sh JOIN shipment_effective_states ss ON ss.tenant_id=sh.tenant_id AND ss.shipment_id=sh.id WHERE sh.tenant_id=r.tenant_id AND sh.release_request_id=r.id),'[]'::jsonb)) item
        FROM shipment_release_requests r JOIN shipment_release_effective_states s ON s.tenant_id=r.tenant_id AND s.release_request_id=r.id
        JOIN sales_orders o ON o.tenant_id=r.tenant_id AND o.id=r.sales_order_id JOIN production_orders p ON p.tenant_id=r.tenant_id AND p.id=r.production_order_id
        JOIN inventory_lots l ON l.tenant_id=r.tenant_id AND l.id=r.finished_lot_id WHERE r.tenant_id=$1`;

export type ShipmentPageFilter = Readonly<{
  limit: number;
  state?: string;
  query?: string;
  cursor?: string;
}>;

export class PostgresShipmentReadRepository {
  public constructor(private readonly readDb: SqlClient) {}

  public async list(context: ShipmentReadContext) {
    requireShipmentCompany(context);
    const { rows } = await this.readDb.query<{ item: JsonObject }>(
      `${SHIPMENT_RELEASE_SELECT} ORDER BY r.created_at DESC`,
      [context.actor.companyId],
    );
    return rows.map(({ item }) => item);
  }

  public async listShipmentPage(filter: ShipmentPageFilter, context: ShipmentReadContext) {
    requireShipmentCompany(context);
    const { rows } = await this.readDb.query<{ item: JsonObject }>(
      `${SHIPMENT_RELEASE_SELECT}
       AND ($2::text IS NULL OR s.state::text=$2)
       AND ($3::text IS NULL OR strpos(lower(concat_ws(' ',r.request_number,o.order_number,p.order_number,l.lot_number)),lower($3))>0)
       AND ($4::uuid IS NULL OR (r.created_at,r.id) < (SELECT c.created_at,c.id
         FROM shipment_release_requests c WHERE c.tenant_id=$1 AND c.id=$4::uuid))
       ORDER BY r.created_at DESC,r.id DESC LIMIT $5`,
      [
        context.actor.companyId,
        filter.state ?? null,
        filter.query ?? null,
        filter.cursor ?? null,
        filter.limit + 1,
      ],
    );
    const items = rows.slice(0, filter.limit).map(({ item }) => item);
    const cursor = items.at(-1)?.id;
    return {
      items,
      nextCursor: rows.length > filter.limit && typeof cursor === 'string' ? cursor : null,
    };
  }

  public async findShipmentRelease(id: string, context: ShipmentReadContext) {
    requireShipmentCompany(context);
    const { rows } = await this.readDb.query<{ item: JsonObject }>(
      `${SHIPMENT_RELEASE_SELECT} AND r.id=$2`,
      [context.actor.companyId, id],
    );
    return rows[0]?.item ?? null;
  }

  public async shipmentCounts(context: ShipmentReadContext) {
    requireShipmentCompany(context);
    const { rows } = await this.readDb.query<{
      requests: string;
      exceptions: string;
      released: string;
      delivered: string;
    }>(
      `SELECT count(*)::text AS requests,
         count(*) FILTER (WHERE state='EXCEPTION_PENDING')::text AS exceptions,
         count(*) FILTER (WHERE state='RELEASED')::text AS released,
         (SELECT count(*)::text FROM shipment_effective_states WHERE tenant_id=$1 AND state='DELIVERED') AS delivered
       FROM shipment_release_effective_states WHERE tenant_id=$1`,
      [context.actor.companyId],
    );
    return rows[0] ?? { requests: '0', exceptions: '0', released: '0', delivered: '0' };
  }
}
