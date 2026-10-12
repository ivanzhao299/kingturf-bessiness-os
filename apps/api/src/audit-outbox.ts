import type { Actor } from '@kingturf/domain';
import type { JsonObject } from '@kingturf/types';
import type { SqlClient } from '@kingturf/database';

type ActorContext = Actor | Readonly<{ actor: Actor }>;

export async function writeAuditEvent(
  tx: SqlClient,
  action: string,
  outcome: string,
  actorId: string,
  organizationId: string,
  targetType: string,
  targetId: string,
  correlationId: string,
  metadata: JsonObject,
): Promise<void> {
  await tx.query(
    'INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [action, outcome, actorId, organizationId, targetType, targetId, correlationId, metadata],
  );
}

export const writeCollectionAudit = (
  tx: SqlClient,
  action: string,
  targetType: string,
  targetId: string,
  context: Readonly<{ actor: Actor }>,
  correlationId: string,
  metadata: JsonObject,
) =>
  writeAuditEvent(
    tx,
    action,
    'SUCCESS',
    context.actor.employeeId,
    context.actor.companyId,
    targetType,
    targetId,
    correlationId,
    metadata,
  );

export const writeContractAudit = (
  tx: SqlClient,
  action: string,
  actor: Actor,
  targetType: string,
  targetId: string,
  correlationId: string,
  metadata: JsonObject,
) =>
  writeAuditEvent(
    tx,
    action,
    'SUCCESS',
    actor.employeeId,
    actor.companyId,
    targetType,
    targetId,
    correlationId,
    metadata,
  );

export const writeProductionCostPolicyAudit = (
  tx: SqlClient,
  actor: Actor,
  policyId: string,
  correlationId: string,
  metadata: JsonObject,
) =>
  writeAuditEvent(
    tx,
    'manufacturing-cost.policy-created',
    'SUCCESS',
    actor.employeeId,
    actor.companyId,
    'production-cost-policy',
    policyId,
    correlationId,
    metadata,
  );

export const writeShipmentReleaseAudit = (
  tx: SqlClient,
  actor: Actor,
  releaseRequestId: string,
  correlationId: string,
  snapshot: JsonObject,
) =>
  writeAuditEvent(
    tx,
    'shipment.release-requested',
    'SUCCESS',
    actor.employeeId,
    actor.companyId,
    'shipment-release',
    releaseRequestId,
    correlationId,
    snapshot,
  );

export const writeRiskPolicyCreatedAudit = (
  tx: SqlClient,
  actor: Actor,
  id: string,
  correlationId: string,
  metadata: JsonObject,
) =>
  writeAuditEvent(
    tx,
    'risk-policy.created',
    'SUCCESS',
    actor.employeeId,
    actor.companyId,
    'risk-policy',
    id,
    correlationId,
    metadata,
  );
export const writeRiskPolicyRevisedAudit = (
  tx: SqlClient,
  actor: Actor,
  id: string,
  correlationId: string,
  metadata: JsonObject,
) =>
  writeAuditEvent(
    tx,
    'risk-policy.revised',
    'SUCCESS',
    actor.employeeId,
    actor.companyId,
    'risk-policy',
    id,
    correlationId,
    metadata,
  );
export const writeRiskPolicyPublishedAudit = (
  tx: SqlClient,
  actor: Actor,
  id: string,
  correlationId: string,
  metadata: JsonObject,
) =>
  writeAuditEvent(
    tx,
    'risk-policy.published',
    'SUCCESS',
    actor.employeeId,
    actor.companyId,
    'risk-policy',
    id,
    correlationId,
    metadata,
  );

export const writeWebsiteLeadAudit = (
  tx: SqlClient,
  actorId: string,
  tenantId: string,
  leadId: string,
  correlationId: string,
  externalRef: string,
) =>
  writeAuditEvent(
    tx,
    'lead.website_ingested',
    'SUCCESS',
    actorId,
    tenantId,
    'lead',
    leadId,
    correlationId,
    { externalRef, source: 'WEBSITE' },
  );

export const writeAuthorizationAudit = (
  db: SqlClient,
  event: Readonly<{
    action: string;
    outcome: string;
    actorId: string | null;
    organizationId: string | null;
    targetType: string | null;
    targetId: string | null;
    correlationId: string;
    metadata: JsonObject;
  }>,
) =>
  db.query(
    'INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [
      event.action,
      event.outcome,
      event.actorId,
      event.organizationId,
      event.targetType,
      event.targetId,
      event.correlationId,
      event.metadata,
    ],
  );
export const writeTransactionalAudit = (
  tx: SqlClient,
  action: string,
  actor: Actor,
  targetType: string,
  targetId: string,
  correlationId: string,
  metadata: Record<string, unknown>,
) =>
  writeAuditEvent(
    tx,
    action,
    'SUCCESS',
    actor.employeeId,
    actor.companyId,
    targetType,
    targetId,
    correlationId,
    metadata as JsonObject,
  );

export const writeBusinessDocumentCreateAudit = (
  tx: SqlClient,
  actor: Actor,
  documentId: string,
  correlationId: string,
  templateKey: string,
) =>
  writeAuditEvent(
    tx,
    'business-document.create',
    'SUCCESS',
    actor.employeeId,
    actor.companyId,
    'business-document',
    documentId,
    correlationId,
    { templateKey },
  );

export const writeBusinessDocumentBindingsAudit = (
  tx: SqlClient,
  actor: Actor,
  documentId: string,
  correlationId: string,
  metadata: JsonObject,
) =>
  writeAuditEvent(
    tx,
    'business-document.bindings-updated',
    'SUCCESS',
    actor.employeeId,
    actor.companyId,
    'business-document',
    documentId,
    correlationId,
    metadata,
  );

export const writeBusinessDocumentVersionAudit = (
  tx: SqlClient,
  actor: Actor,
  documentId: string,
  correlationId: string,
  version: number,
) =>
  writeAuditEvent(
    tx,
    'business-document.version-created',
    'SUCCESS',
    actor.employeeId,
    actor.companyId,
    'business-document',
    documentId,
    correlationId,
    { version },
  );

export const writeBusinessDocumentTranslationAudit = (
  tx: SqlClient,
  actor: Actor,
  documentId: string,
  correlationId: string,
  metadata: JsonObject,
) =>
  writeAuditEvent(
    tx,
    'business-document.translation-created',
    'SUCCESS',
    actor.employeeId,
    actor.companyId,
    'business-document',
    documentId,
    correlationId,
    metadata,
  );

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
  auditTargetType = aggregateType,
  auditTargetId = aggregateId,
): Promise<void> {
  const actor = actorOf(actorContext);
  await tx.query(
    "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES($1,'SUCCESS',$2,$3,$4,$5,$6,$7)",
    [
      action,
      actor.employeeId,
      actor.companyId,
      auditTargetType,
      auditTargetId,
      correlationId,
      payload,
    ],
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

export const writeCommercialEvidence = (
  tx: SqlClient,
  action: string,
  actor: Actor,
  id: string,
  version: number,
  correlationId: string,
  payload: JsonObject,
  aggregateType = 'opportunity',
) => writeAuditOutbox(tx, action, aggregateType, id, version, actor, correlationId, payload);

export const writeCrmAuditEvent = async (
  tx: SqlClient,
  action: string,
  actor: Actor,
  type: string,
  id: string,
  correlationId: string,
  version: number,
  payload: Record<string, unknown>,
  eventAggregate: Readonly<{ type: string; id: string; version: number }> = { type, id, version },
) => {
  return writeAuditOutbox(
    tx,
    action,
    eventAggregate.type,
    eventAggregate.id,
    eventAggregate.version,
    actor,
    correlationId,
    payload as JsonObject,
    type,
    id,
  );
};

export const writeComplaintEvidence = (
  tx: SqlClient,
  action: string,
  targetType: string,
  targetId: string,
  version: number,
  payload: JsonObject,
  context: Readonly<{ actor: Actor }>,
  correlationId: string,
) => writeAuditOutbox(tx, action, targetType, targetId, version, context, correlationId, payload);

export const writeFixedVersionOneEvidence = (
  tx: SqlClient,
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  context: Readonly<{ actor: Actor }>,
  correlationId: string,
  payload: JsonObject,
) => {
  const actor = context.actor;
  return writeAuditOutbox(
    tx,
    eventType,
    aggregateType,
    aggregateId,
    1,
    actor,
    correlationId,
    payload,
  );
};

export const writeNextVersionEvidence = async (
  tx: SqlClient,
  aggregateType: string,
  action: string,
  aggregateId: string,
  context: Readonly<{ actor: Actor }>,
  correlationId: string,
  payload: JsonObject,
) => {
  const actor = context.actor;
  await tx.query(
    "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES($1,'SUCCESS',$2,$3,$4,$5,$6,$7)",
    [action, actor.employeeId, actor.companyId, aggregateType, aggregateId, correlationId, payload],
  );
  await tx.query(
    'INSERT INTO domain_event_outbox(tenant_id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,occurred_at,actor_id,correlation_id,payload) SELECT $1,$2,1,$3,$4,coalesce(max(aggregate_version),0)+1,now(),$5,$6,$7 FROM domain_event_outbox WHERE tenant_id=$1 AND event_type=$2 AND aggregate_id=$4',
    [actor.companyId, action, aggregateType, aggregateId, actor.employeeId, correlationId, payload],
  );
};

export const writeProductionNextVersionEvidence = (
  tx: SqlClient,
  action: string,
  id: string,
  context: Readonly<{ actor: Actor }>,
  correlationId: string,
  payload: JsonObject,
) => writeNextVersionEvidence(tx, 'production-order', action, id, context, correlationId, payload);

export const writeQualityNextVersionEvidence = (
  tx: SqlClient,
  action: string,
  id: string,
  context: Readonly<{ actor: Actor }>,
  correlationId: string,
  payload: JsonObject,
) =>
  writeNextVersionEvidence(tx, 'quality-inspection', action, id, context, correlationId, payload);
