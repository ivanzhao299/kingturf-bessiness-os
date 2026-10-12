import { randomUUID } from 'node:crypto';
import type { Database } from '@kingturf/database';
import { employeeScopedPredicate, type EmployeeScopeOptions } from './scope-sql.ts';
import { writeFoundationEmptyAudit as audit } from './audit-outbox.ts';
import { eventPublisher, UUID_PATTERN } from './event-repositories.ts';
import { DomainError, type Actor, type ScopeAnchor } from '@kingturf/domain';
import type {
  DataScope,
  JsonObject,
  NotificationChannel,
  NotificationDto,
  NotificationPreferenceDto,
} from '@kingturf/types';

type NotificationRow = Readonly<{
  id: string;
  tenant_id: string;
  kind: string;
  title: string;
  message: string;
  subject_type: string | null;
  subject_id: string | null;
  idempotency_key: string;
  event_id: string;
  created_by: string;
  created_at: Date;
  normalized_recipients: readonly string[];
  semantic_payload: JsonObject;
}>;
type NotificationReadRow = NotificationRow & Readonly<{ read_at: Date | null }>;
type NotificationReplayRow = NotificationReadRow & Readonly<{ request_matches: boolean }>;
type NotificationPreferenceRow = Readonly<{
  channel: NotificationChannel;
  enabled: boolean;
  version: number;
}>;

// foundation（通知收件人）员工域谓词选项：缺省省略 actor_org 与 authorized_org 两处
// 组织有效性 JOIN（与 repositories 变体的语义差异登记 TD-SEC-007）；SQL 与迁移前逐字一致。
const NOTIFICATION_SCOPE: EmployeeScopeOptions = { actorOrganizationValidation: 'skip' };

export class PostgresNotificationRepository {
  public constructor(private readonly db: Database) {}
  // 收件人范围谓词已收敛至 scope-sql.ts 的 employeeScopedPredicate（批次 1b，TD-DUP-001）。
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
      const scoped = employeeScopedPredicate(
        scopes,
        actor.employeeId,
        actor.companyId,
        anchors,
        3,
        NOTIFICATION_SCOPE,
      );
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
      const prior = await tx.query<NotificationReplayRow>(
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
      const row = await tx.query<NotificationReadRow>(
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
      const inserted = row.rows[0];
      if (!inserted) throw new Error('Notification insert returned no row');
      return this.map(inserted);
    });
  }
  private map(r: NotificationReadRow): NotificationDto {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      kind: r.kind,
      title: r.title,
      message: r.message,
      subjectType: r.subject_type,
      subjectId: r.subject_id,
      readAt: r.read_at?.toISOString() ?? null,
      createdAt: r.created_at.toISOString(),
    };
  }
  public async list(actor: Actor, unreadOnly = false): Promise<readonly NotificationDto[]> {
    return (
      await this.db.query<NotificationReadRow>(
        'SELECT n.*,r.read_at FROM notification_recipients r JOIN notifications n ON n.id=r.notification_id AND n.tenant_id=r.tenant_id WHERE r.tenant_id=$1 AND r.employee_id=$2 AND ($3=false OR r.read_at IS NULL) ORDER BY r.created_at DESC LIMIT 100',
        [actor.companyId, actor.employeeId, unreadOnly],
      )
    ).rows.map((r) => this.map(r));
  }
  public async find(id: string, actor: Actor): Promise<NotificationDto | null> {
    const r = await this.db.query<NotificationReadRow>(
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
      await this.db.query<NotificationPreferenceRow>(
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
          ? await tx.query<NotificationPreferenceRow>(
              'INSERT INTO notification_preferences(tenant_id,employee_id,channel,enabled) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,employee_id,channel) DO NOTHING RETURNING channel,enabled,version',
              [actor.companyId, actor.employeeId, channel, enabled],
            )
          : await tx.query<NotificationPreferenceRow>(
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
