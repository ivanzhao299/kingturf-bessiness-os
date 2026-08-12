/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-non-null-assertion */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Database, Transaction } from '@kingturf/database';
import {
  assertStableCode,
  DomainError,
  validateBusinessObjectSchema,
  type Actor,
  type EventPublisher,
  type ObjectAccessAuthorizer,
  type ObjectInstanceResolver,
  type ObjectStorage,
  type ScopeAnchor,
} from '@kingturf/domain';
import type {
  AttachmentDto,
  BusinessObjectDefinitionDto,
  BusinessObjectSchema,
  BusinessObjectVersionDto,
  DataScope,
  DomainEventEnvelope,
  JsonObject,
  NotificationDto,
  NotificationPreferenceDto,
} from '@kingturf/types';

const audit = async (
  tx: Transaction,
  action: string,
  actor: Actor,
  targetType: string,
  targetId: string,
  correlationId: string,
): Promise<void> => {
  await tx.query(
    "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES($1,'SUCCESS',$2,$3,$4,$5,$6,'{}')",
    [action, actor.employeeId, actor.companyId, targetType, targetId, correlationId],
  );
};
const operationalAudit = async (
  tx: Transaction,
  action: string,
  actor: Actor,
  targetId: string,
  correlationId: string,
  metadata: JsonObject,
): Promise<void> => {
  await tx.query(
    "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES($1,'SUCCESS',$2,$3,'domain-event',$4,$5,$6)",
    [action, actor.employeeId, actor.companyId, targetId, correlationId, metadata],
  );
};
const OPERATION_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/u;
const ERROR_CODE = /^[a-z][a-z0-9_]{0,63}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
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
    const result = await tx.query<{ id: string }>(
      'INSERT INTO domain_event_outbox(tenant_id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,occurred_at,actor_id,correlation_id,causation_id,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',
      [
        input.tenantId,
        input.eventType,
        input.eventVersion,
        input.aggregateType,
        input.aggregateId,
        input.aggregateVersion,
        input.occurredAt,
        input.actorId,
        input.correlationId,
        input.causationId,
        input.payload,
      ],
    );
    return result.rows[0]!.id;
  }
}

const eventPublisher = new PostgresTransactionalEventPublisher();

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

export class PostgresNotificationRepository {
  public constructor(private readonly db: Database) {}
  private recipientScope(
    scopes: readonly DataScope[],
    actor: Actor,
    anchors: readonly ScopeAnchor[],
    startParameter: number,
  ): Readonly<{ predicate: string; values: readonly string[] }> {
    const values: string[] = [];
    const parameter = (value: string): string => {
      values.push(value);
      return `$${String(startParameter + values.length - 1)}`;
    };
    const clauses: string[] = [];
    if (scopes.includes('GROUP') || scopes.includes('COMPANY')) clauses.push('TRUE');
    if (scopes.includes('SELF')) clauses.push(`e.id=${parameter(actor.employeeId)}`);
    for (const scope of ['TEAM', 'DEPARTMENT', 'REGION'] as const) {
      if (!scopes.includes(scope)) continue;
      const actorId = parameter(actor.employeeId);
      const companyId = parameter(actor.companyId);
      const depth = scope === 'TEAM' ? ' AND target_rel.depth<=1' : '';
      clauses.push(
        `EXISTS (SELECT 1 FROM employees scope_actor JOIN LATERAL (SELECT actor_rel.ancestor_id FROM organization_scope_relationships actor_rel JOIN organizations typed_anchor ON typed_anchor.id=actor_rel.ancestor_id AND typed_anchor.organization_type='${scope}' AND typed_anchor.owner_organization_id=scope_actor.company_id AND typed_anchor.active AND typed_anchor.deleted_at IS NULL WHERE actor_rel.descendant_id=scope_actor.organization_id ORDER BY actor_rel.depth LIMIT 1) nearest ON true JOIN organization_scope_relationships target_rel ON target_rel.ancestor_id=nearest.ancestor_id AND target_rel.descendant_id=e.organization_id${depth} WHERE scope_actor.id=${actorId} AND scope_actor.company_id=${companyId} AND scope_actor.active AND scope_actor.deleted_at IS NULL)`,
      );
    }
    for (const anchor of anchors) {
      if (anchor.scope === 'SELF' && anchor.organizationId === null)
        clauses.push(`e.id=${parameter(actor.employeeId)}`);
      else if (
        (anchor.scope === 'COMPANY' || anchor.scope === 'GROUP') &&
        anchor.organizationId === null
      )
        clauses.push(`e.company_id=${parameter(actor.companyId)}`);
      else if (
        (anchor.scope === 'TEAM' || anchor.scope === 'DEPARTMENT' || anchor.scope === 'REGION') &&
        anchor.organizationId !== null
      ) {
        const anchorId = parameter(anchor.organizationId);
        const depth = anchor.scope === 'TEAM' ? ' AND explicit_osr.depth<=1' : '';
        clauses.push(
          `EXISTS (SELECT 1 FROM organizations explicit_anchor JOIN organization_scope_relationships explicit_osr ON explicit_osr.ancestor_id=explicit_anchor.id AND explicit_osr.descendant_id=e.organization_id${depth} WHERE explicit_anchor.id=${anchorId} AND explicit_anchor.owner_organization_id=e.company_id AND explicit_anchor.organization_type='${anchor.scope}' AND explicit_anchor.active AND explicit_anchor.deleted_at IS NULL)`,
        );
      }
    }
    const actorId = parameter(actor.employeeId);
    const companyId = parameter(actor.companyId);
    const actorExists = `EXISTS (SELECT 1 FROM employees authorized_actor JOIN organizations authorized_company ON authorized_company.id=authorized_actor.company_id AND authorized_company.organization_type='COMPANY' AND authorized_company.active AND authorized_company.deleted_at IS NULL WHERE authorized_actor.id=${actorId} AND authorized_actor.company_id=${companyId} AND authorized_actor.active AND authorized_actor.deleted_at IS NULL)`;
    return {
      predicate: clauses.length ? `(${actorExists} AND (${clauses.join(' OR ')}))` : 'FALSE',
      values,
    };
  }
  public async create(
    input: {
      kind: string;
      title: string;
      message: string;
      recipients: readonly string[];
      subjectType?: string;
      subjectId?: string;
      idempotencyKey: string;
    },
    actor: Actor,
    correlationId: string,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[] = [],
  ): Promise<NotificationDto> {
    if (
      !input.recipients.length ||
      input.recipients.some((recipient) => !UUID_PATTERN.test(recipient)) ||
      input.title.length > 200 ||
      input.message.length > 4000 ||
      input.idempotencyKey.length > 128
    )
      throw new DomainError('invalid_request', 'Invalid notification');
    return this.db.transaction(async (tx) => {
      const recipients = [...new Set(input.recipients)].sort();
      const semanticPayload = {
        kind: input.kind,
        title: input.title,
        message: input.message,
        subjectType: input.subjectType ?? null,
        subjectId: input.subjectId ?? null,
      };
      const scoped = this.recipientScope(scopes, actor, anchors, 3);
      const authorized = await tx.query<{ count: string }>(
        `SELECT count(*)::text count FROM employees e WHERE e.company_id=$1 AND e.id=ANY($2::uuid[]) AND e.active AND e.deleted_at IS NULL AND ${scoped.predicate}`,
        [actor.companyId, recipients, ...scoped.values],
      );
      if (Number(authorized.rows[0]?.count ?? 0) !== recipients.length)
        throw new DomainError(
          'forbidden',
          'One or more notification recipients are outside the granted data scope',
        );
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${actor.companyId}:${input.idempotencyKey}`,
      ]);
      const prior = await tx.query<any>(
        'SELECT n.*,NULL::timestamptz read_at,(n.normalized_recipients=$3::uuid[] AND n.semantic_payload=$4::jsonb) request_matches FROM notifications n WHERE tenant_id=$1 AND idempotency_key=$2',
        [actor.companyId, input.idempotencyKey, recipients, semanticPayload],
      );
      if (prior.rows[0]) {
        if (!prior.rows[0].request_matches)
          throw new DomainError(
            'conflict',
            'Idempotency key was already used for a different notification',
          );
        return this.map(prior.rows[0]);
      }
      const id = randomUUID();
      const eventId = await eventPublisher.enqueue(tx, {
        eventType: 'notification.created',
        eventVersion: 1,
        tenantId: actor.companyId,
        aggregateType: 'notification',
        aggregateId: id,
        aggregateVersion: 1,
        occurredAt: new Date().toISOString(),
        actorId: actor.employeeId,
        correlationId,
        causationId: null,
        payload: { kind: input.kind },
      });
      const row = await tx.query<any>(
        'INSERT INTO notifications(id,tenant_id,kind,title,message,subject_type,subject_id,idempotency_key,event_id,created_by,normalized_recipients,semantic_payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *,NULL::timestamptz read_at',
        [
          id,
          actor.companyId,
          input.kind,
          input.title,
          input.message,
          input.subjectType ?? null,
          input.subjectId ?? null,
          input.idempotencyKey,
          eventId,
          actor.employeeId,
          recipients,
          semanticPayload,
        ],
      );
      for (const recipient of recipients) {
        await tx.query(
          'INSERT INTO notification_recipients(tenant_id,notification_id,employee_id) VALUES($1,$2,$3)',
          [actor.companyId, id, recipient],
        );
        await tx.query(
          "INSERT INTO notification_delivery_attempts(tenant_id,notification_id,employee_id,channel,attempt,state) VALUES($1,$2,$3,'IN_APP',1,'DELIVERED')",
          [actor.companyId, id, recipient],
        );
      }
      await audit(tx, 'notification.create', actor, 'notification', id, correlationId);
      return this.map(row.rows[0]);
    });
  }
  private map(r: any): NotificationDto {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      kind: r.kind,
      title: r.title,
      message: r.message,
      subjectType: r.subject_type,
      subjectId: r.subject_id,
      readAt: r.read_at?.toISOString?.() ?? null,
      createdAt: r.created_at.toISOString(),
    };
  }
  public async list(actor: Actor, unreadOnly = false): Promise<readonly NotificationDto[]> {
    return (
      await this.db.query<any>(
        'SELECT n.*,r.read_at FROM notification_recipients r JOIN notifications n ON n.id=r.notification_id AND n.tenant_id=r.tenant_id WHERE r.tenant_id=$1 AND r.employee_id=$2 AND ($3=false OR r.read_at IS NULL) ORDER BY r.created_at DESC LIMIT 100',
        [actor.companyId, actor.employeeId, unreadOnly],
      )
    ).rows.map((r) => this.map(r));
  }
  public async find(id: string, actor: Actor): Promise<NotificationDto | null> {
    const r = await this.db.query<any>(
      'SELECT n.*,r.read_at FROM notification_recipients r JOIN notifications n ON n.id=r.notification_id AND n.tenant_id=r.tenant_id WHERE r.tenant_id=$1 AND r.employee_id=$2 AND n.id=$3',
      [actor.companyId, actor.employeeId, id],
    );
    return r.rows[0] ? this.map(r.rows[0]) : null;
  }
  public async unread(actor: Actor): Promise<number> {
    const r = await this.db.query<{ count: string }>(
      'SELECT count(*)::text count FROM notification_recipients WHERE tenant_id=$1 AND employee_id=$2 AND read_at IS NULL',
      [actor.companyId, actor.employeeId],
    );
    return Number(r.rows[0]?.count ?? 0);
  }
  public async setRead(
    id: string,
    read: boolean,
    actor: Actor,
    correlationId: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const r = await tx.query(
        'UPDATE notification_recipients SET read_at=CASE WHEN $4 THEN COALESCE(read_at,now()) ELSE NULL END WHERE tenant_id=$1 AND employee_id=$2 AND notification_id=$3',
        [actor.companyId, actor.employeeId, id, read],
      );
      if (!r.rowCount) throw new DomainError('not_found', 'Notification not found');
      await audit(
        tx,
        read ? 'notification.read' : 'notification.unread',
        actor,
        'notification',
        id,
        correlationId,
      );
    });
  }
  public async preferences(actor: Actor): Promise<readonly NotificationPreferenceDto[]> {
    return (
      await this.db.query<any>(
        'SELECT channel,enabled,version FROM notification_preferences WHERE tenant_id=$1 AND employee_id=$2 ORDER BY channel',
        [actor.companyId, actor.employeeId],
      )
    ).rows.map((r) => ({ channel: r.channel, enabled: r.enabled, version: r.version }));
  }
  public async setPreference(
    channel: string,
    enabled: boolean,
    expectedVersion: number,
    actor: Actor,
    correlationId: string,
  ): Promise<NotificationPreferenceDto> {
    if (!['IN_APP', 'EMAIL', 'SMS', 'PUSH'].includes(channel))
      throw new DomainError('invalid_request', 'Unsupported notification channel');
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0)
      throw new DomainError('invalid_request', 'expectedVersion must be a non-negative integer');
    return this.db.transaction(async (tx) => {
      const r =
        expectedVersion === 0
          ? await tx.query<any>(
              'INSERT INTO notification_preferences(tenant_id,employee_id,channel,enabled) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,employee_id,channel) DO NOTHING RETURNING channel,enabled,version',
              [actor.companyId, actor.employeeId, channel, enabled],
            )
          : await tx.query<any>(
              'UPDATE notification_preferences SET enabled=$4,version=version+1,updated_at=now() WHERE tenant_id=$1 AND employee_id=$2 AND channel=$3 AND version=$5 RETURNING channel,enabled,version',
              [actor.companyId, actor.employeeId, channel, enabled, expectedVersion],
            );
      if (!r.rows[0]) throw new DomainError('conflict', 'Preference version conflict');
      await audit(
        tx,
        'notification.preference.update',
        actor,
        'employee',
        actor.employeeId,
        correlationId,
      );
      return r.rows[0];
    });
  }
}

export class LocalAttachmentStorage implements ObjectStorage {
  public constructor(private readonly root: string) {}
  private path(key: string): string {
    if (!/^[0-9a-f]{2}\/[0-9a-f-]{36}(?:\.[0-9a-f-]{36})?$/u.test(key))
      throw new DomainError('invalid_request', 'Invalid storage key');
    return join(this.root, ...key.split('/'));
  }
  public async put(key: string, bytes: Uint8Array): Promise<void> {
    const target = this.path(key);
    await mkdir(join(this.root, key.slice(0, 2)), { recursive: true, mode: 0o700 });
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
    await rename(temporary, target);
  }
  public async get(key: string): Promise<Uint8Array | null> {
    try {
      return await readFile(this.path(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }
  public async delete(key: string): Promise<void> {
    try {
      await unlink(this.path(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

export class PostgresAttachmentRepository {
  public constructor(
    private readonly db: Database,
    private readonly storage: ObjectStorage,
    private readonly objectAccess: ObjectAccessAuthorizer,
  ) {}
  private map(r: any): AttachmentDto {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      originalName: r.original_name,
      mimeType: r.mime_type,
      size: r.actual_size == null ? null : Number(r.actual_size),
      checksum: r.actual_checksum,
      state: r.state,
      version: r.version,
      createdAt: r.created_at.toISOString(),
    };
  }
  public async create(
    input: { name: string; mimeType: string; size: number; checksum: string },
    actor: Actor,
    correlationId: string,
  ): Promise<AttachmentDto> {
    if (
      !/^[0-9a-f]{64}$/u.test(input.checksum) ||
      input.name.length > 255 ||
      /[\\/\0]/u.test(input.name)
    )
      throw new DomainError('invalid_request', 'Unsafe attachment metadata');
    return this.db.transaction(async (tx) => {
      const id = randomUUID(),
        key = `${id.slice(0, 2)}/${id}`;
      const r = await tx.query<any>(
        'INSERT INTO attachments(id,tenant_id,opaque_key,original_name,mime_type,expected_size,expected_checksum,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [
          id,
          actor.companyId,
          key,
          input.name,
          input.mimeType,
          input.size,
          input.checksum,
          actor.employeeId,
        ],
      );
      await eventPublisher.enqueue(tx, {
        eventType: 'attachment.created',
        eventVersion: 1,
        tenantId: actor.companyId,
        aggregateType: 'attachment',
        aggregateId: id,
        aggregateVersion: 1,
        occurredAt: new Date().toISOString(),
        actorId: actor.employeeId,
        correlationId,
        causationId: null,
        payload: { mimeType: input.mimeType },
      });
      await audit(tx, 'attachment.create', actor, 'attachment', id, correlationId);
      return this.map(r.rows[0]);
    });
  }
  public async upload(
    id: string,
    bytes: Uint8Array,
    actor: Actor,
    scopes: readonly import('@kingturf/types').DataScope[],
    anchors: readonly import('@kingturf/domain').ScopeAnchor[],
    correlationId: string,
  ): Promise<AttachmentDto> {
    const locked = await this.db.query<any>(
      "SELECT a.*,b.object_type,b.object_id FROM attachments a LEFT JOIN attachment_bindings b ON b.attachment_id=a.id AND b.tenant_id=a.tenant_id AND b.unbound_at IS NULL WHERE a.id=$1 AND a.tenant_id=$2 AND (a.state='PENDING' OR (a.state='UPLOADING' AND a.upload_lease_until<now()))",
      [id, actor.companyId],
    );
    const metadata = locked.rows[0];
    if (!metadata) throw new DomainError('not_found', 'Attachment not found');
    if (
      metadata.created_by !== actor.employeeId &&
      !(await this.anyAuthorized(
        locked.rows.filter((row) => row.object_id),
        actor,
        scopes,
        anchors,
      ))
    )
      throw new DomainError('not_found', 'Attachment not found');
    if (
      bytes.byteLength !== Number(metadata.expected_size) ||
      createHash('sha256').update(bytes).digest('hex') !== metadata.expected_checksum
    )
      throw new DomainError('invalid_request', 'Attachment size or checksum mismatch');
    const token = randomUUID();
    const reserved = await this.db.transaction(async (tx) => {
      const result = await tx.query<any>(
        "UPDATE attachments SET state='UPLOADING',upload_token=$3,upload_lease_until=now()+interval '5 minutes' WHERE id=$1 AND tenant_id=$2 AND (state='PENDING' OR (state='UPLOADING' AND upload_lease_until<now())) RETURNING *",
        [id, actor.companyId, token],
      );
      if (!result.rows[0])
        throw new DomainError('conflict', 'Attachment upload already in progress');
      await audit(tx, 'attachment.upload.reserve', actor, 'attachment', id, correlationId);
      return result.rows[0];
    });
    const storageKey = `${String(reserved.opaque_key)}.${token}`;
    let stored = false;
    try {
      await this.storage.put(storageKey, bytes);
      stored = true;
      return await this.db.transaction(async (tx) => {
        const r = await tx.query<any>(
          "UPDATE attachments SET state='AVAILABLE',actual_size=$4,actual_checksum=$5,actual_storage_key=$6,finalized_at=now(),version=version+1,upload_token=NULL,upload_lease_until=NULL WHERE id=$1 AND tenant_id=$2 AND state='UPLOADING' AND upload_token=$3 RETURNING *",
          [id, actor.companyId, token, bytes.byteLength, metadata.expected_checksum, storageKey],
        );
        if (!r.rows[0]) throw new DomainError('conflict', 'Attachment lifecycle conflict');
        await audit(tx, 'attachment.finalize', actor, 'attachment', id, correlationId);
        return this.map(r.rows[0]);
      });
    } catch (error) {
      if (stored) await this.storage.delete(storageKey);
      await this.db.transaction(async (tx) => {
        const reset = await tx.query(
          "UPDATE attachments SET state='PENDING',upload_token=NULL,upload_lease_until=NULL WHERE id=$1 AND tenant_id=$2 AND state='UPLOADING' AND upload_token=$3",
          [id, actor.companyId, token],
        );
        if (reset.rowCount)
          await audit(tx, 'attachment.upload.reset', actor, 'attachment', id, correlationId);
      });
      throw error;
    }
  }
  public async bind(
    id: string,
    objectType: string,
    objectId: string,
    actor: Actor,
    scopes: readonly import('@kingturf/types').DataScope[],
    anchors: readonly import('@kingturf/domain').ScopeAnchor[],
    correlationId: string,
  ): Promise<void> {
    if (!(await this.objectAccess.authorize(objectType, objectId, actor, scopes, anchors)))
      throw new DomainError('not_found', 'Bindable object not found');
    const existing = await this.db.query<any>(
      'SELECT a.created_by,b.object_type,b.object_id FROM attachments a LEFT JOIN attachment_bindings b ON b.attachment_id=a.id AND b.tenant_id=a.tenant_id AND b.unbound_at IS NULL WHERE a.id=$1 AND a.tenant_id=$2',
      [id, actor.companyId],
    );
    if (!existing.rows[0]) throw new DomainError('not_found', 'Attachment not found');
    const prior = existing.rows.filter((row) => row.object_id);
    if (
      existing.rows[0].created_by !== actor.employeeId &&
      !(await this.anyAuthorized(prior, actor, scopes, anchors))
    )
      throw new DomainError('not_found', 'Attachment not found');
    await this.db.transaction(async (tx) => {
      const r = await tx.query(
        "INSERT INTO attachment_bindings(tenant_id,attachment_id,object_type,object_id,bound_by) SELECT tenant_id,id,$3,$4,$5 FROM attachments WHERE id=$1 AND tenant_id=$2 AND state='AVAILABLE' ON CONFLICT DO NOTHING RETURNING id",
        [id, actor.companyId, objectType, objectId, actor.employeeId],
      );
      if (!r.rowCount) throw new DomainError('not_found', 'Attachment not found');
      await audit(tx, 'attachment.bind', actor, 'attachment', id, correlationId);
    });
  }
  public async unbind(
    id: string,
    objectType: string,
    objectId: string,
    actor: Actor,
    scopes: readonly import('@kingturf/types').DataScope[],
    anchors: readonly import('@kingturf/domain').ScopeAnchor[],
    correlationId: string,
  ): Promise<void> {
    if (!(await this.objectAccess.authorize(objectType, objectId, actor, scopes, anchors)))
      throw new DomainError('not_found', 'Bindable object not found');
    await this.db.transaction(async (tx) => {
      const result = await tx.query(
        'UPDATE attachment_bindings SET unbound_at=now() WHERE tenant_id=$1 AND attachment_id=$2 AND object_type=$3 AND object_id=$4 AND unbound_at IS NULL',
        [actor.companyId, id, objectType, objectId],
      );
      if (!result.rowCount) throw new DomainError('not_found', 'Attachment binding not found');
      await audit(tx, 'attachment.unbind', actor, 'attachment', id, correlationId);
    });
  }
  public async download(
    id: string,
    actor: Actor,
    scopes: readonly import('@kingturf/types').DataScope[],
    anchors: readonly import('@kingturf/domain').ScopeAnchor[],
  ): Promise<{ metadata: AttachmentDto; bytes: Uint8Array } | null> {
    const r = await this.db.query<any>(
      "SELECT a.*,b.object_type,b.object_id FROM attachments a JOIN attachment_bindings b ON b.attachment_id=a.id AND b.tenant_id=a.tenant_id AND b.unbound_at IS NULL WHERE a.id=$1 AND a.tenant_id=$2 AND a.state='AVAILABLE'",
      [id, actor.companyId],
    );
    if (!r.rows[0]) return null;
    const allowed = await Promise.all(
      r.rows.map((row) =>
        this.objectAccess.authorize(row.object_type, row.object_id, actor, scopes, anchors),
      ),
    );
    if (!allowed.some(Boolean)) return null;
    const bytes = await this.storage.get(r.rows[0].actual_storage_key ?? r.rows[0].opaque_key);
    return bytes ? { metadata: this.map(r.rows[0]), bytes } : null;
  }
  public async remove(
    id: string,
    version: number,
    actor: Actor,
    scopes: readonly import('@kingturf/types').DataScope[],
    anchors: readonly import('@kingturf/domain').ScopeAnchor[],
    correlationId: string,
  ): Promise<void> {
    const pending = await this.db.transaction(async (tx) => {
      // The row lock fences concurrent binding while current object authorization is checked and
      // the lifecycle transition is reserved.
      const bindings = await tx.query<any>(
        'SELECT a.created_by,b.object_type,b.object_id FROM attachments a LEFT JOIN attachment_bindings b ON b.attachment_id=a.id AND b.tenant_id=a.tenant_id AND b.unbound_at IS NULL WHERE a.id=$1 AND a.tenant_id=$2 FOR UPDATE OF a',
        [id, actor.companyId],
      );
      const activeBindings = bindings.rows.filter((row) => row.object_id);
      const creatorMayDeleteUnbound =
        bindings.rows[0]?.created_by === actor.employeeId && activeBindings.length === 0;
      if (
        !bindings.rows[0] ||
        (!creatorMayDeleteUnbound &&
          !(await this.anyAuthorized(activeBindings, actor, scopes, anchors)))
      )
        throw new DomainError('not_found', 'Attachment not found');
      const r = await tx.query<any>(
        "UPDATE attachments SET state='DELETE_PENDING',version=version+1 WHERE id=$1 AND tenant_id=$2 AND version=$3 AND state IN ('PENDING','AVAILABLE') RETURNING actual_storage_key,opaque_key,version",
        [id, actor.companyId, version],
      );
      if (r.rows[0]) {
        await audit(tx, 'attachment.delete.reserve', actor, 'attachment', id, correlationId);
        return r.rows[0];
      }
      const retry = await tx.query<any>(
        "SELECT actual_storage_key,opaque_key,version FROM attachments WHERE id=$1 AND tenant_id=$2 AND state='DELETE_PENDING' AND version IN ($3,$3+1)",
        [id, actor.companyId, version],
      );
      if (!retry.rows[0]) throw new DomainError('conflict', 'Attachment version conflict');
      return retry.rows[0];
    });
    await this.storage.delete(pending.actual_storage_key ?? pending.opaque_key);
    await this.db.transaction(async (tx) => {
      const finalized = await tx.query(
        "UPDATE attachments SET state='DELETED',deleted_at=now() WHERE id=$1 AND tenant_id=$2 AND state='DELETE_PENDING' AND version=$3",
        [id, actor.companyId, pending.version],
      );
      if (!finalized.rowCount) throw new DomainError('conflict', 'Attachment lifecycle conflict');
      await audit(tx, 'attachment.delete.finalize', actor, 'attachment', id, correlationId);
    });
  }
  private async anyAuthorized(
    rows: readonly any[],
    actor: Actor,
    scopes: readonly import('@kingturf/types').DataScope[],
    anchors: readonly import('@kingturf/domain').ScopeAnchor[],
  ): Promise<boolean> {
    const allowed = await Promise.all(
      rows.map((row) =>
        this.objectAccess.authorize(row.object_type, row.object_id, actor, scopes, anchors),
      ),
    );
    return allowed.some(Boolean);
  }
}

/** Validates a published type and delegates concrete instance access to its fail-closed adapter. */
export class PostgresRegistryObjectAccessAuthorizer implements ObjectAccessAuthorizer {
  public constructor(
    private readonly db: Database,
    private readonly resolvers: ReadonlyMap<string, ObjectInstanceResolver>,
  ) {}

  public async authorize(
    objectType: string,
    objectId: string,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[] = [],
  ): Promise<boolean> {
    if (!/^[a-z][a-z0-9_.-]{0,63}$/u.test(objectType)) return false;
    const resolver = this.resolvers.get(objectType);
    if (!resolver) return false;
    const registered = await this.db.query(
      `SELECT 1
         FROM business_object_definitions definition
        WHERE definition.tenant_id=$1
          AND lower(definition.code)=$2
          AND definition.deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM business_object_versions version
             WHERE version.definition_id=definition.id
               AND version.tenant_id=definition.tenant_id
               AND version.status='PUBLISHED'
          )
          AND EXISTS (
            SELECT 1 FROM employees actor
             WHERE actor.id=$3 AND actor.company_id=$1
               AND actor.active AND actor.deleted_at IS NULL
          )
        LIMIT 1`,
      [actor.companyId, objectType, actor.employeeId],
    );
    if (!registered.rowCount) return false;
    return resolver.authorizeInstance(objectId, actor, scopes, anchors);
  }
}

/** Adapter for the existing employee aggregate; it reuses the canonical E01 DataScope repository. */
export class EmployeeObjectInstanceResolver implements ObjectInstanceResolver {
  public constructor(
    private readonly employees: Pick<import('@kingturf/domain').EmployeeRepository, 'findById'>,
  ) {}
  public async authorizeInstance(
    objectId: string,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[] = [],
  ): Promise<boolean> {
    return Boolean(
      await this.employees.findById(objectId, actor.companyId, scopes, actor.employeeId, anchors),
    );
  }
}

export class PostgresBusinessObjectRepository {
  public constructor(private readonly db: Database) {}
  private version(r: any): BusinessObjectVersionDto {
    return {
      id: r.id,
      definitionId: r.definition_id,
      tenantId: r.tenant_id,
      version: r.version,
      status: r.status,
      schema: r.schema,
      createdAt: r.created_at.toISOString(),
      publishedAt: r.published_at?.toISOString?.() ?? null,
    };
  }
  private async definition(tx: Transaction, id: string, tenantId: string) {
    const d = await tx.query<any>(
      'SELECT * FROM business_object_definitions WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL',
      [id, tenantId],
    );
    if (!d.rows[0]) throw new DomainError('not_found', 'Business object not found');
    const versions = (
      await tx.query<any>(
        'SELECT * FROM business_object_versions WHERE definition_id=$1 AND tenant_id=$2 ORDER BY version',
        [id, tenantId],
      )
    ).rows.map((row) => this.version(row));
    return {
      id: d.rows[0].id,
      tenantId: d.rows[0].tenant_id,
      code: d.rows[0].code,
      name: d.rows[0].name,
      version: d.rows[0].version,
      versions,
    } satisfies BusinessObjectDefinitionDto;
  }
  public async create(
    code: string,
    name: string,
    schemaValue: unknown,
    actor: Actor,
    correlationId: string,
  ): Promise<BusinessObjectDefinitionDto> {
    const schema = validateBusinessObjectSchema(schemaValue);
    return this.db.transaction(async (tx) => {
      const d = await tx.query<any>(
        'INSERT INTO business_object_definitions(tenant_id,code,name,created_by) VALUES($1,$2,$3,$4) RETURNING *',
        [actor.companyId, assertStableCode(code), name, actor.employeeId],
      );
      const definition = d.rows[0];
      const v = await tx.query<any>(
        'INSERT INTO business_object_versions(tenant_id,definition_id,version,schema,created_by) VALUES($1,$2,1,$3,$4) RETURNING *',
        [actor.companyId, definition.id, schema, actor.employeeId],
      );
      await this.relationships(tx, v.rows[0].id, schema, actor.companyId);
      await eventPublisher.enqueue(tx, {
        eventType: 'business-object.created',
        eventVersion: 1,
        tenantId: actor.companyId,
        aggregateType: 'business-object',
        aggregateId: definition.id,
        aggregateVersion: 1,
        occurredAt: new Date().toISOString(),
        actorId: actor.employeeId,
        correlationId,
        causationId: null,
        payload: { code: definition.code },
      });
      await audit(
        tx,
        'business-object.create',
        actor,
        'business-object',
        definition.id,
        correlationId,
      );
      return {
        id: definition.id,
        tenantId: definition.tenant_id,
        code: definition.code,
        name: definition.name,
        version: definition.version,
        versions: [this.version(v.rows[0])],
      };
    });
  }
  private async relationships(
    tx: Transaction,
    versionId: string,
    schema: BusinessObjectSchema,
    tenantId: string,
  ): Promise<void> {
    for (const f of schema.fields)
      if (f.type === 'relationship')
        await tx.query(
          'INSERT INTO business_object_relationships(tenant_id,version_id,field_key,target_definition_id,cardinality) VALUES($1,$2,$3,$4,$5)',
          [tenantId, versionId, f.key, f.targetDefinitionId, f.cardinality],
        );
  }
  public async addVersion(
    id: string,
    schemaValue: unknown,
    actor: Actor,
    correlationId: string,
  ): Promise<BusinessObjectDefinitionDto> {
    const schema = validateBusinessObjectSchema(schemaValue);
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${actor.companyId}:${id}`,
      ]);
      const r = await tx.query<any>(
        'INSERT INTO business_object_versions(tenant_id,definition_id,version,schema,created_by) SELECT $2,id,COALESCE((SELECT max(version)+1 FROM business_object_versions WHERE definition_id=$1),1),$3,$4 FROM business_object_definitions WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL RETURNING *',
        [id, actor.companyId, schema, actor.employeeId],
      );
      if (!r.rows[0]) throw new DomainError('not_found', 'Business object not found');
      await this.relationships(tx, r.rows[0].id, schema, actor.companyId);
      await tx.query(
        'UPDATE business_object_definitions SET version=version+1 WHERE id=$1 AND tenant_id=$2',
        [id, actor.companyId],
      );
      await audit(
        tx,
        'business-object.version.create',
        actor,
        'business-object',
        id,
        correlationId,
      );
      return this.definition(tx, id, actor.companyId);
    });
  }
  public async publish(
    id: string,
    version: number,
    actor: Actor,
    correlationId: string,
  ): Promise<BusinessObjectDefinitionDto> {
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${actor.companyId}:${id}`,
      ]);
      const r = await tx.query<any>(
        "UPDATE business_object_versions SET status='PUBLISHED',published_at=now() WHERE definition_id=$1 AND tenant_id=$2 AND version=$3 AND status='DRAFT' RETURNING *",
        [id, actor.companyId, version],
      );
      if (!r.rows[0]) throw new DomainError('not_found', 'Draft version not found');
      await tx.query(
        'UPDATE business_object_definitions SET version=version+1 WHERE id=$1 AND tenant_id=$2',
        [id, actor.companyId],
      );
      await eventPublisher.enqueue(tx, {
        eventType: 'business-object.published',
        eventVersion: 1,
        tenantId: actor.companyId,
        aggregateType: 'business-object',
        aggregateId: id,
        aggregateVersion: version,
        occurredAt: new Date().toISOString(),
        actorId: actor.employeeId,
        correlationId,
        causationId: null,
        payload: { version },
      });
      await audit(tx, 'business-object.publish', actor, 'business-object', id, correlationId);
      return this.definition(tx, id, actor.companyId);
    });
  }
  public async find(id: string, tenantId: string): Promise<BusinessObjectDefinitionDto | null> {
    const d = await this.db.query<any>(
      'SELECT * FROM business_object_definitions WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL',
      [id, tenantId],
    );
    if (!d.rows[0]) return null;
    const versions = (
      await this.db.query<any>(
        'SELECT * FROM business_object_versions WHERE definition_id=$1 AND tenant_id=$2 ORDER BY version',
        [id, tenantId],
      )
    ).rows.map((r) => this.version(r));
    return {
      id: d.rows[0].id,
      tenantId: d.rows[0].tenant_id,
      code: d.rows[0].code,
      name: d.rows[0].name,
      version: d.rows[0].version,
      versions,
    };
  }
  public async list(tenantId: string): Promise<readonly BusinessObjectDefinitionDto[]> {
    return (
      await this.db.query<any>(
        'SELECT * FROM business_object_definitions WHERE tenant_id=$1 AND deleted_at IS NULL ORDER BY code',
        [tenantId],
      )
    ).rows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      code: r.code,
      name: r.name,
      version: r.version,
    }));
  }
}
