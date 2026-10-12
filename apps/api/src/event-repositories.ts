import type { Database, Transaction } from '@kingturf/database';
import {
  enqueueDomainEventOutbox,
  writeFoundationDomainEventAudit as operationalAudit,
} from './audit-outbox.ts';
import { DomainError, type Actor, type EventPublisher } from '@kingturf/domain';
import type { DomainEventEnvelope, JsonObject } from '@kingturf/types';

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const OPERATION_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/u;
const ERROR_CODE = /^[a-z][a-z0-9_]{0,63}$/u;
const operationName = (value: string, field: string): void => {
  if (!OPERATION_NAME.test(value)) throw new DomainError('invalid_request', `${field} is invalid`);
};
const eventIdentity = (eventId: string, tenantId: string): void => {
  if (!UUID_PATTERN.test(eventId) || !UUID_PATTERN.test(tenantId))
    throw new DomainError('invalid_request', 'Invalid event identity');
};

export class PostgresTransactionalEventPublisher implements EventPublisher {
  public async enqueue(
    tx: Transaction,
    input: Omit<DomainEventEnvelope, 'eventId'>,
  ): Promise<string> {
    return enqueueDomainEventOutbox(tx, input);
  }
}

export const eventPublisher = new PostgresTransactionalEventPublisher();

export class PostgresEventRepository {
  public constructor(private readonly db: Database) {}
  public async claim(
    actor: Actor,
    consumer: string,
    worker: string,
    limit = 20,
    leaseSeconds = 30,
  ): Promise<readonly (DomainEventEnvelope & { claimToken: string })[]> {
    if (!UUID_PATTERN.test(actor.companyId) || !UUID_PATTERN.test(actor.employeeId))
      throw new DomainError('invalid_request', 'Invalid actor');
    operationName(consumer, 'consumer');
    operationName(worker, 'worker');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new DomainError('invalid_request', 'limit must be between 1 and 100');
    if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 5 || leaseSeconds > 300)
      throw new DomainError('invalid_request', 'leaseSeconds must be between 5 and 300');
    return this.db.transaction(async (tx) => {
      const rows = (
        await tx.query<{
          id: string;
          event_type: string;
          event_version: number;
          tenant_id: string;
          aggregate_type: string;
          aggregate_id: string;
          aggregate_version: number;
          occurred_at: Date;
          actor_id: string | null;
          correlation_id: string;
          causation_id: string | null;
          payload: JsonObject;
          claim_token: string;
        }>(
          `WITH candidates AS (
             SELECT o.id,o.tenant_id FROM domain_event_outbox o
             LEFT JOIN event_consumer_deliveries d ON d.event_id=o.id AND d.tenant_id=o.tenant_id AND d.consumer_name=$1
             WHERE o.tenant_id=$2
               AND NOT EXISTS (SELECT 1 FROM event_consumer_checkpoints c WHERE c.event_id=o.id AND c.tenant_id=o.tenant_id AND c.consumer_name=$1)
               AND (d.id IS NULL OR (d.state='PENDING' AND d.available_at<=now()) OR (d.state='PROCESSING' AND d.lease_until<now()))
             ORDER BY o.created_at FOR UPDATE OF o SKIP LOCKED LIMIT $3
           ), leased AS (
             INSERT INTO event_consumer_deliveries(tenant_id,consumer_name,event_id,state,claimed_by,claim_token,lease_until,attempts)
             SELECT tenant_id,$1,id,'PROCESSING',$4,gen_random_uuid(),now()+make_interval(secs=>$5),1 FROM candidates
             ON CONFLICT(tenant_id,consumer_name,event_id) DO UPDATE SET state='PROCESSING',claimed_by=$4,claim_token=gen_random_uuid(),lease_until=now()+make_interval(secs=>$5),attempts=event_consumer_deliveries.attempts+1
             RETURNING event_id,tenant_id,claim_token
           ) SELECT o.*,l.claim_token FROM domain_event_outbox o JOIN leased l ON l.event_id=o.id AND l.tenant_id=o.tenant_id ORDER BY o.created_at`,
          [consumer, actor.companyId, limit, worker, leaseSeconds],
        )
      ).rows;
      for (const row of rows)
        await operationalAudit(tx, 'event.delivery.claim', actor, row.id, row.correlation_id, {
          consumer,
          worker,
        });
      return rows.map((r) => ({
        eventId: r.id,
        eventType: r.event_type,
        eventVersion: r.event_version,
        tenantId: r.tenant_id,
        aggregateType: r.aggregate_type,
        aggregateId: r.aggregate_id,
        aggregateVersion: r.aggregate_version,
        occurredAt: r.occurred_at.toISOString(),
        actorId: r.actor_id,
        correlationId: r.correlation_id,
        causationId: r.causation_id,
        payload: r.payload,
        claimToken: r.claim_token,
      }));
    });
  }
  public async complete(
    eventId: string,
    actor: Actor,
    consumer: string,
    claimToken: string,
  ): Promise<void> {
    eventIdentity(eventId, actor.companyId);
    operationName(consumer, 'consumer');
    if (!UUID_PATTERN.test(claimToken))
      throw new DomainError('invalid_request', 'Invalid claim token');
    await this.db.transaction(async (tx) => {
      const delivered = await tx.query<{ attempts: number; correlation_id: string }>(
        "UPDATE event_consumer_deliveries d SET state='DELIVERED',delivered_at=now(),lease_until=NULL,claimed_by=NULL,claim_token=NULL FROM domain_event_outbox o WHERE d.event_id=$1 AND d.tenant_id=$2 AND d.consumer_name=$3 AND d.state='PROCESSING' AND d.claim_token=$4 AND d.lease_until>=now() AND o.id=d.event_id AND o.tenant_id=d.tenant_id RETURNING d.attempts,o.correlation_id",
        [eventId, actor.companyId, consumer, claimToken],
      );
      if (!delivered.rows[0])
        throw new DomainError('conflict', 'Event delivery is not held by this consumer');
      await tx.query(
        'INSERT INTO event_consumer_checkpoints(tenant_id,consumer_name,event_id) VALUES($1,$2,$3)',
        [actor.companyId, consumer, eventId],
      );
      await tx.query(
        "INSERT INTO event_delivery_attempts(tenant_id,event_id,consumer_name,attempt,outcome) VALUES($1,$2,$3,$4,'SUCCESS')",
        [actor.companyId, eventId, consumer, delivered.rows[0].attempts],
      );
      await operationalAudit(
        tx,
        'event.delivery.complete',
        actor,
        eventId,
        delivered.rows[0].correlation_id,
        { consumer },
      );
    });
  }
  public async fail(
    eventId: string,
    actor: Actor,
    consumer: string,
    claimToken: string,
    errorCode: string,
    maxAttempts = 5,
  ): Promise<void> {
    eventIdentity(eventId, actor.companyId);
    operationName(consumer, 'consumer');
    if (!UUID_PATTERN.test(claimToken))
      throw new DomainError('invalid_request', 'Invalid claim token');
    if (!ERROR_CODE.test(errorCode))
      throw new DomainError('invalid_request', 'errorCode is invalid');
    if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 100)
      throw new DomainError('invalid_request', 'maxAttempts must be between 1 and 100');
    await this.db.transaction(async (tx) => {
      const locked = await tx.query<{ attempts: number; correlation_id: string }>(
        "SELECT d.attempts,o.correlation_id FROM event_consumer_deliveries d JOIN domain_event_outbox o ON o.id=d.event_id AND o.tenant_id=d.tenant_id WHERE d.event_id=$1 AND d.tenant_id=$2 AND d.consumer_name=$3 AND d.state='PROCESSING' AND d.claim_token=$4 AND d.lease_until>=now() FOR UPDATE OF d",
        [eventId, actor.companyId, consumer, claimToken],
      );
      if (!locked.rows[0]) throw new DomainError('not_found', 'Event not found');
      const dead = locked.rows[0].attempts >= maxAttempts;
      await tx.query(
        "UPDATE event_consumer_deliveries SET state=$4::outbox_state,available_at=CASE WHEN $4='PENDING' THEN now()+make_interval(secs=>LEAST(3600, power(2,attempts)::integer)) ELSE available_at END,lease_until=NULL,claimed_by=NULL,claim_token=NULL,last_error_code=$5 WHERE event_id=$1 AND tenant_id=$2 AND consumer_name=$3 AND claim_token=$6",
        [
          eventId,
          actor.companyId,
          consumer,
          dead ? 'DEAD_LETTER' : 'PENDING',
          errorCode,
          claimToken,
        ],
      );
      await operationalAudit(
        tx,
        dead ? 'event.delivery.dead-letter' : 'event.delivery.retry',
        actor,
        eventId,
        locked.rows[0].correlation_id,
        { consumer, errorCode },
      );
      await tx.query(
        'INSERT INTO event_delivery_attempts(tenant_id,event_id,consumer_name,attempt,outcome,error_code) VALUES($1,$2,$3,$4,$5,$6)',
        [
          actor.companyId,
          eventId,
          consumer,
          locked.rows[0].attempts,
          dead ? 'DEAD_LETTER' : 'RETRY',
          errorCode,
        ],
      );
    });
  }
  public async counts(tenantId: string): Promise<Readonly<Record<string, number>>> {
    const rows = await this.db.query<{ state: string; count: string }>(
      `SELECT state,count(*)::text count FROM (
         SELECT state::text FROM event_consumer_deliveries WHERE tenant_id=$1
         UNION ALL SELECT 'PENDING' FROM domain_event_outbox o WHERE tenant_id=$1
           AND NOT EXISTS(SELECT 1 FROM event_consumer_deliveries d WHERE d.event_id=o.id AND d.tenant_id=o.tenant_id)
       ) s GROUP BY state`,
      [tenantId],
    );
    return Object.fromEntries(rows.rows.map((r) => [r.state, Number(r.count)]));
  }
}

export class InProcessEventDispatcher {
  public constructor(
    private readonly events: PostgresEventRepository,
    private readonly actor: Actor,
    private readonly consumer: string,
    private readonly handle: (event: DomainEventEnvelope) => Promise<void>,
  ) {}
  public async pollOnce(worker = `local-${String(process.pid)}`): Promise<number> {
    const claimed = await this.events.claim(this.actor, this.consumer, worker);
    for (const event of claimed) {
      try {
        await this.handle(event);
        await this.events.complete(event.eventId, this.actor, this.consumer, event.claimToken);
      } catch {
        await this.events.fail(
          event.eventId,
          this.actor,
          this.consumer,
          event.claimToken,
          'handler_failed',
        );
      }
    }
    return claimed.length;
  }
}
