import type { Actor } from '@kingturf/domain';
import type { JsonObject } from '@kingturf/types';
import type { SqlClient } from '@kingturf/database';

type ActorContext = Actor | Readonly<{ actor: Actor }>;

const actorOf = (value: ActorContext): Actor => ('actor' in value ? value.actor : value);

/** Writes the standard audit + outbox pair inside the caller's transaction. */
export async function writeAuditOutbox(
  tx: SqlClient,
  action: string,
  aggregateType: string,
  aggregateId: string,
  aggregateVersion: number,
  actorContext: ActorContext,
  correlationId: string,
  payload: JsonObject,
): Promise<void> {
  const actor = actorOf(actorContext);
  await tx.query(
    "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES($1,'SUCCESS',$2,$3,$4,$5,$6,$7)",
    [action, actor.employeeId, actor.companyId, aggregateType, aggregateId, correlationId, payload],
  );
  await tx.query(
    'INSERT INTO domain_event_outbox(tenant_id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,occurred_at,actor_id,correlation_id,payload) VALUES($1,$2,1,$3,$4,$5,now(),$6,$7,$8)',
    [
      actor.companyId,
      action,
      aggregateType,
      aggregateId,
      aggregateVersion,
      actor.employeeId,
      correlationId,
      payload,
    ],
  );
}
