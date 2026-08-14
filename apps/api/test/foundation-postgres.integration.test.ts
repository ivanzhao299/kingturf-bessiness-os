import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, migrate } from '@kingturf/database';
import type { ObjectAccessAuthorizer, ObjectStorage } from '@kingturf/domain';
import { PostgresEmployeeRepository } from '../src/repositories.js';
import {
  InProcessEventDispatcher,
  EmployeeObjectInstanceResolver,
  PostgresAttachmentRepository,
  PostgresBusinessObjectRepository,
  PostgresEventRepository,
  PostgresTransactionalEventPublisher,
  PostgresNotificationRepository,
  PostgresRegistryObjectAccessAuthorizer,
} from '../src/foundation-repositories.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL is required; foundation PostgreSQL tests may not be skipped');

describe('JTF-P0-E12..E15 PostgreSQL acceptance', () => {
  const schema = `foundation_${randomUUID().replaceAll('-', '')}`;
  const company = randomUUID(),
    otherCompany = randomUUID(),
    organization = randomUUID(),
    restrictedOrganization = randomUUID(),
    otherOrganization = randomUUID();
  const employee = randomUUID(),
    recipient = randomUUID(),
    restrictedRecipient = randomUUID(),
    outsider = randomUUID();
  const actor = { companyId: company, employeeId: employee } as const;
  let admin: Database, db: Database;
  let failStorageDelete = false;
  const objects = new Map<string, Uint8Array>();
  const storage: ObjectStorage = {
    put(key, bytes) {
      objects.set(key, bytes);
      return Promise.resolve();
    },
    get(key) {
      return Promise.resolve(objects.get(key) ?? null);
    },
    delete(key) {
      if (failStorageDelete) return Promise.reject(new Error('local storage unavailable'));
      objects.delete(key);
      return Promise.resolve();
    },
  };
  const access: ObjectAccessAuthorizer = {
    authorize(type, id, candidate, scopes) {
      return Promise.resolve(
        type === 'employee' &&
          id === recipient &&
          candidate.companyId === company &&
          scopes.includes('COMPANY'),
      );
    },
  };

  beforeAll(async () => {
    admin = new Database(connectionString);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(connectionString);
    scoped.searchParams.set('options', `-csearch_path=${schema}`);
    db = new Database(scoped.toString());
    await migrate(db);
    await db.query(
      "INSERT INTO organizations(id,code,name,organization_type) VALUES($1,'FOUND','Foundation','COMPANY'),($2,'OTHER','Other','COMPANY')",
      [company, otherCompany],
    );
    await db.query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$4,'TEAM','Team','TEAM'),($2,$4,'RESTRICTED','Restricted team','TEAM'),($3,$5,'OTHERTEAM','Other team','TEAM')",
      [organization, restrictedOrganization, otherOrganization, company, otherCompany],
    );
    await db.query(
      "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$5,$6,'ACT','Actor','actor@foundation.test'),($2,$5,$6,'REC','Recipient','recipient@foundation.test'),($3,$5,$7,'REST','Restricted','restricted@foundation.test'),($4,$8,$9,'OUT','Outsider','outsider@foundation.test')",
      [
        employee,
        recipient,
        restrictedRecipient,
        outsider,
        company,
        organization,
        restrictedOrganization,
        otherCompany,
        otherOrganization,
      ],
    );
  });
  afterAll(async () => {
    await db.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.close();
  });

  it('creates idempotent tenant inbox records atomically and isolates recipients', async () => {
    const repo = new PostgresNotificationRepository(db),
      correlationId = randomUUID();
    const input = {
      kind: 'generic',
      title: 'Notice',
      message: 'Safe message',
      recipients: [recipient],
      idempotencyKey: 'notice-1',
    };
    const first = await repo.create(input, actor, correlationId, ['COMPANY']);
    expect((await repo.create(input, actor, randomUUID(), ['COMPANY'])).id).toBe(first.id);
    expect(
      (
        await repo.create({ ...input, recipients: [recipient, recipient] }, actor, randomUUID(), [
          'COMPANY',
        ])
      ).id,
    ).toBe(first.id);
    await expect(
      repo.create({ ...input, message: 'Changed' }, actor, randomUUID(), ['COMPANY']),
    ).rejects.toThrow(/different notification/u);
    await expect(
      repo.create({ ...input, recipients: [restrictedRecipient] }, actor, randomUUID(), [
        'COMPANY',
      ]),
    ).rejects.toThrow(/different notification/u);
    await expect(
      repo.create({ ...input, recipients: [outsider] }, actor, randomUUID(), ['COMPANY']),
    ).rejects.toThrow(/outside the granted data scope/u);
    expect(
      (
        await db.query<{ count: string }>(
          'SELECT count(*)::text count FROM notification_recipients WHERE tenant_id=$1 AND notification_id=$2',
          [company, first.id],
        )
      ).rows[0]?.count,
    ).toBe('1');
    expect(
      (await repo.list({ companyId: company, employeeId: recipient })).map((x) => x.id),
    ).toEqual([first.id]);
    expect(await repo.list({ companyId: otherCompany, employeeId: outsider })).toEqual([]);
    await repo.setRead(first.id, true, { companyId: company, employeeId: recipient }, randomUUID());
    expect(await repo.unread({ companyId: company, employeeId: recipient })).toBe(0);
    await expect(
      repo.create(
        { ...input, idempotencyKey: 'rollback', recipients: [recipient, outsider] },
        actor,
        randomUUID(),
        ['COMPANY'],
      ),
    ).rejects.toThrow();
    expect(
      (await db.query("SELECT 1 FROM notifications WHERE idempotency_key='rollback'")).rowCount,
    ).toBe(0);
    expect(
      (await db.query('SELECT 1 FROM audit_events WHERE correlation_id=$1', [correlationId]))
        .rowCount,
    ).toBe(1);
    await expect(
      repo.create({ ...input, idempotencyKey: 'self-denied' }, actor, randomUUID(), ['SELF']),
    ).rejects.toThrow(/outside the granted data scope/u);
    await expect(
      repo.create(
        { ...input, recipients: [restrictedRecipient], idempotencyKey: 'anchor-denied' },
        actor,
        randomUUID(),
        [],
        [{ scope: 'TEAM', organizationId: organization }],
      ),
    ).rejects.toThrow(/outside the granted data scope/u);
    expect(
      (
        await repo.create(
          { ...input, idempotencyKey: 'anchor-allowed' },
          actor,
          randomUUID(),
          [],
          [{ scope: 'TEAM', organizationId: organization }],
        )
      ).tenantId,
    ).toBe(company);
  });

  it('requires compare-and-swap versions for notification preferences under concurrency', async () => {
    const repo = new PostgresNotificationRepository(db);
    const otherActor = { companyId: otherCompany, employeeId: outsider } as const;
    const created = await repo.setPreference('IN_APP', true, 0, actor, randomUUID());
    expect(created.version).toBe(1);
    await repo.setPreference('IN_APP', false, 0, otherActor, randomUUID());
    await expect(repo.setPreference('IN_APP', false, 0, actor, randomUUID())).rejects.toThrow(
      /version conflict/u,
    );

    const concurrent = await Promise.allSettled([
      repo.setPreference('IN_APP', false, 1, actor, randomUUID()),
      repo.setPreference('IN_APP', true, 1, actor, randomUUID()),
    ]);
    expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(concurrent.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await repo.preferences(actor))[0]?.version).toBe(2);
    expect(await repo.preferences(otherActor)).toEqual([
      { channel: 'IN_APP', enabled: false, version: 1 },
    ]);
    expect(
      (
        await db.query<{ count: string }>(
          "SELECT count(*)::text count FROM audit_events WHERE organization_id=$1 AND actor_id=$2 AND action='notification.preference.update'",
          [company, employee],
        )
      ).rows[0]?.count,
    ).toBe('2');
  });

  it('allows every consumer exactly once and reports counts only for its tenant', async () => {
    const notifications = new PostgresNotificationRepository(db);
    const event = await notifications.create(
      {
        kind: 'event',
        title: 'Event',
        message: 'Message',
        recipients: [recipient],
        idempotencyKey: 'event-1',
      },
      actor,
      randomUUID(),
      ['COMPANY'],
    );
    const events = new PostgresEventRepository(db);
    const seenA: string[] = [],
      seenB: string[] = [];
    await new InProcessEventDispatcher(events, actor, 'consumer-a', (e) => {
      seenA.push(e.eventId);
      return Promise.resolve();
    }).pollOnce('worker-a');
    await new InProcessEventDispatcher(events, actor, 'consumer-b', (e) => {
      seenB.push(e.eventId);
      return Promise.resolve();
    }).pollOnce('worker-b');
    const eventRow = await db.query<{ event_id: string }>(
      'SELECT event_id FROM notifications WHERE id=$1',
      [event.id],
    );
    expect(eventRow.rows[0]).toBeDefined();
    const eventId = eventRow.rows[0]?.event_id;
    if (!eventId) throw new Error('notification event was not linked');
    await expect(events.complete(eventId, actor, 'never-claimed', randomUUID())).rejects.toThrow(
      /not held/u,
    );
    expect(
      (
        await db.query(
          'SELECT 1 FROM event_consumer_checkpoints WHERE tenant_id=$1 AND consumer_name=$2 AND event_id=$3',
          [company, 'never-claimed', eventId],
        )
      ).rowCount,
    ).toBe(0);
    expect(seenA).toContain(eventRow.rows[0]?.event_id);
    expect(seenB).toEqual(seenA);
    await new InProcessEventDispatcher(events, actor, 'consumer-a', (e) => {
      seenA.push(e.eventId);
      return Promise.resolve();
    }).pollOnce('worker-a2');
    expect(new Set(seenA).size).toBe(seenA.length);
    expect(Object.values(await events.counts(company)).reduce((a, b) => a + b, 0)).toBeGreaterThan(
      0,
    );
    expect(Object.values(await events.counts(otherCompany)).reduce((a, b) => a + b, 0)).toBe(0);
    await notifications.create(
      {
        kind: 'other-event',
        title: 'Other tenant event',
        message: 'Isolated',
        recipients: [outsider],
        idempotencyKey: 'other-event-1',
      },
      { companyId: otherCompany, employeeId: outsider },
      randomUUID(),
      ['SELF'],
    );
    const failed = await events.claim(actor, 'consumer-failing', 'reused-worker', 1);
    expect(failed).toHaveLength(1);
    expect(failed[0]?.tenantId).toBe(company);
    const claimAudit = await db.query<{
      actor_id: string;
      organization_id: string;
      correlation_id: string;
      metadata: Record<string, unknown>;
    }>(
      "SELECT actor_id,organization_id,correlation_id,metadata FROM audit_events WHERE action='event.delivery.claim' AND target_id=$1 AND metadata->>'consumer'=$2",
      [failed[0]?.eventId, 'consumer-failing'],
    );
    expect(claimAudit.rows).toEqual([
      {
        actor_id: employee,
        organization_id: company,
        correlation_id: failed[0]?.correlationId,
        metadata: { consumer: 'consumer-failing', worker: 'reused-worker' },
      },
    ]);
    expect(JSON.stringify(claimAudit.rows[0]?.metadata)).not.toContain(failed[0]?.claimToken);
    expect(
      await events.claim(
        { companyId: otherCompany, employeeId: outsider },
        'consumer-failing',
        'other-worker',
        20,
      ),
    ).toHaveLength(1);
    if (!failed[0]) throw new Error('expected a tenant-qualified claim');
    await db.query(
      "UPDATE event_consumer_deliveries SET lease_until=now()-interval '1 second' WHERE tenant_id=$1 AND consumer_name=$2 AND event_id=$3",
      [company, 'consumer-failing', failed[0].eventId],
    );
    const reclaimed = await events.claim(actor, 'consumer-failing', 'reused-worker', 1);
    expect(reclaimed[0]?.claimToken).not.toBe(failed[0].claimToken);
    await expect(
      events.fail(
        failed[0].eventId,
        actor,
        'consumer-failing',
        failed[0].claimToken,
        'stale_handler',
        1,
      ),
    ).rejects.toThrow(/not found/u);
    if (!reclaimed[0]) throw new Error('expected an expired claim to be reclaimed');
    await events.fail(
      reclaimed[0].eventId,
      actor,
      'consumer-failing',
      reclaimed[0].claimToken,
      'safe_code',
      1,
    );
    expect((await events.counts(company)).DEAD_LETTER).toBe(1);
    await expect(events.claim(actor, '', 'worker')).rejects.toThrow(/consumer/u);
    await expect(events.claim(actor, 'consumer', 'worker', 0)).rejects.toThrow(/limit/u);
    await expect(events.claim(actor, 'consumer', 'worker', 1, 1)).rejects.toThrow(/leaseSeconds/u);
    await expect(
      events.claim({ companyId: 'bad-tenant', employeeId: employee }, 'consumer', 'worker'),
    ).rejects.toThrow(/actor/u);
    await expect(
      events.fail(randomUUID(), actor, 'consumer', randomUUID(), 'Unsafe Code', 0),
    ).rejects.toThrow(/errorCode/u);
    expect(
      (
        await db.query(
          "SELECT 1 FROM audit_events WHERE organization_id=$1 AND actor_id=$2 AND action LIKE 'event.delivery.%'",
          [company, employee],
        )
      ).rowCount,
    ).toBeGreaterThan(0);
  });

  it('publishes through a caller-owned transaction and rolls back with its business mutation', async () => {
    const publisher = new PostgresTransactionalEventPublisher();
    const envelope = {
      eventType: 'generic.changed',
      eventVersion: 1,
      tenantId: company,
      aggregateType: 'generic',
      aggregateId: randomUUID(),
      aggregateVersion: 1,
      occurredAt: new Date().toISOString(),
      actorId: employee,
      correlationId: randomUUID(),
      causationId: null,
      payload: { safe: true },
    } as const;
    const eventId = await db.transaction((tx) => publisher.enqueue(tx, envelope));
    expect(
      (
        await db.query('SELECT 1 FROM domain_event_outbox WHERE id=$1 AND tenant_id=$2', [
          eventId,
          company,
        ])
      ).rowCount,
    ).toBe(1);
    await expect(
      db.transaction(async (tx) => {
        await publisher.enqueue(tx, { ...envelope, aggregateId: randomUUID() });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(
      (
        await db.query(
          "SELECT count(*)::text count FROM domain_event_outbox WHERE tenant_id=$1 AND event_type='generic.changed'",
          [company],
        )
      ).rows[0],
    ).toEqual({ count: '1' });
  });

  it('enforces authorized object binding and attachment integrity', async () => {
    const repo = new PostgresAttachmentRepository(db, storage, access),
      bytes = Buffer.from('safe file');
    const created = await repo.create(
      {
        name: 'safe.txt',
        mimeType: 'text/plain',
        size: bytes.length,
        checksum: createHash('sha256').update(bytes).digest('hex'),
      },
      actor,
      randomUUID(),
    );
    await expect(
      repo.upload(
        created.id,
        bytes,
        { companyId: company, employeeId: recipient },
        ['COMPANY'],
        [],
        randomUUID(),
      ),
    ).rejects.toThrow(/not found/u);
    await expect(
      repo.upload(created.id, Buffer.from('wrong'), actor, ['COMPANY'], [], randomUUID()),
    ).rejects.toThrow(/mismatch/u);
    await repo.upload(created.id, bytes, actor, ['COMPANY'], [], randomUUID());
    await expect(
      repo.bind(created.id, 'employee', outsider, actor, ['COMPANY'], [], randomUUID()),
    ).rejects.toThrow(/not found/u);
    await repo.bind(created.id, 'employee', recipient, actor, ['COMPANY'], [], randomUUID());
    expect(await repo.download(created.id, actor, ['SELF'], [])).toBeNull();
    expect((await repo.download(created.id, actor, ['COMPANY'], []))?.bytes).toEqual(bytes);
    await expect(repo.remove(created.id, 2, actor, ['SELF'], [], randomUUID())).rejects.toThrow(
      /not found/u,
    );
    expect(
      (await db.query<{ state: string }>('SELECT state FROM attachments WHERE id=$1', [created.id]))
        .rows[0]?.state,
    ).toBe('AVAILABLE');

    failStorageDelete = true;
    await expect(repo.remove(created.id, 2, actor, ['COMPANY'], [], randomUUID())).rejects.toThrow(
      /storage unavailable/u,
    );
    expect(
      (await db.query<{ state: string }>('SELECT state FROM attachments WHERE id=$1', [created.id]))
        .rows[0]?.state,
    ).toBe('DELETE_PENDING');
    failStorageDelete = false;
    await repo.remove(created.id, 2, actor, ['COMPANY'], [], randomUUID());
    expect(
      (await db.query<{ state: string }>('SELECT state FROM attachments WHERE id=$1', [created.id]))
        .rows[0]?.state,
    ).toBe('DELETED');
  });

  it('resolves concrete employee attachment targets through a published type and fails closed', async () => {
    const registry = new PostgresBusinessObjectRepository(db);
    const definition = await registry.create(
      'EMPLOYEE',
      'Employee',
      { fields: [{ key: 'reference', label: 'Reference', type: 'string', required: true }] },
      actor,
      randomUUID(),
    );
    const authorizer = new PostgresRegistryObjectAccessAuthorizer(
      db,
      new Map([
        ['employee', new EmployeeObjectInstanceResolver(new PostgresEmployeeRepository(db))],
      ]),
    );
    expect(await authorizer.authorize('employee', recipient, actor, ['COMPANY'])).toBe(false);
    await registry.publish(definition.id, 1, actor, randomUUID());
    expect(await authorizer.authorize('employee', recipient, actor, ['COMPANY'])).toBe(true);
    expect(await authorizer.authorize('employee', recipient, actor, ['SELF'])).toBe(false);
    expect(
      await authorizer.authorize(
        'employee',
        recipient,
        actor,
        [],
        [{ scope: 'TEAM', organizationId: organization }],
      ),
    ).toBe(true);
    expect(
      await authorizer.authorize(
        'employee',
        restrictedRecipient,
        actor,
        [],
        [{ scope: 'TEAM', organizationId: organization }],
      ),
    ).toBe(false);
    expect(await authorizer.authorize('employee', randomUUID(), actor, ['COMPANY'])).toBe(false);
    expect(await authorizer.authorize('employee', definition.id, actor, ['COMPANY'])).toBe(false);
    expect(await authorizer.authorize('unknown_type', definition.id, actor, ['COMPANY'])).toBe(
      false,
    );
    expect(await authorizer.authorize('employee', outsider, actor, ['COMPANY'])).toBe(false);

    const bytes = Buffer.from('registry attachment');
    const attachments = new PostgresAttachmentRepository(db, storage, authorizer);
    const attachment = await attachments.create(
      {
        name: 'registry.txt',
        mimeType: 'text/plain',
        size: bytes.length,
        checksum: createHash('sha256').update(bytes).digest('hex'),
      },
      actor,
      randomUUID(),
    );
    await attachments.upload(attachment.id, bytes, actor, ['COMPANY'], [], randomUUID());
    await expect(
      attachments.bind(
        attachment.id,
        'unknown_type',
        definition.id,
        actor,
        ['COMPANY'],
        [],
        randomUUID(),
      ),
    ).rejects.toThrow(/not found/u);
    await attachments.bind(
      attachment.id,
      'employee',
      recipient,
      actor,
      ['COMPANY'],
      [],
      randomUUID(),
    );
    expect((await attachments.download(attachment.id, actor, ['COMPANY'], []))?.bytes).toEqual(
      bytes,
    );
    expect(await attachments.download(attachment.id, actor, ['SELF'], [])).toBeNull();
    expect(
      await attachments.download(
        attachment.id,
        { companyId: otherCompany, employeeId: outsider },
        ['COMPANY'],
        [],
      ),
    ).toBeNull();
  });

  it('versions registry schemas and makes published versions immutable', async () => {
    const repo = new PostgresBusinessObjectRepository(db);
    const target = await repo.create(
      'GENERIC_TARGET',
      'Generic target',
      { fields: [{ key: 'name', label: 'Name', type: 'string', required: true }] },
      actor,
      randomUUID(),
    );
    const definition = await repo.create(
      'GENERIC_OBJECT',
      'Generic object',
      {
        fields: [
          {
            key: 'target',
            label: 'Target',
            type: 'relationship',
            required: true,
            targetDefinitionId: target.id,
            cardinality: 'ONE',
          },
        ],
      },
      actor,
      randomUUID(),
    );
    expect(definition.versions?.[0]).toMatchObject({
      tenantId: company,
      version: 1,
      schema: {
        fields: [
          {
            key: 'target',
            type: 'relationship',
            targetDefinitionId: target.id,
            cardinality: 'ONE',
          },
        ],
      },
    });
    const publishedDefinition = await repo.publish(definition.id, 1, actor, randomUUID());
    expect(publishedDefinition.version).toBe(2);
    const published = publishedDefinition.versions?.find((item) => item.version === 1);
    expect(published?.status).toBe('PUBLISHED');
    await expect(
      db.query("UPDATE business_object_versions SET schema='{}' WHERE id=$1", [published?.id]),
    ).rejects.toThrow(/published/u);
    const relationship = await db.query<{ id: string }>(
      'SELECT id FROM business_object_relationships WHERE version_id=$1',
      [published?.id],
    );
    expect(relationship.rows[0]).toBeDefined();
    await expect(
      db.query("UPDATE business_object_relationships SET cardinality='MANY' WHERE id=$1", [
        relationship.rows[0]?.id,
      ]),
    ).rejects.toThrow(/immutable/u);
    await expect(
      db.query('DELETE FROM business_object_relationships WHERE id=$1', [relationship.rows[0]?.id]),
    ).rejects.toThrow(/immutable/u);
    const afterAdd = await repo.addVersion(
      definition.id,
      { fields: [{ key: 'active', label: 'Active', type: 'boolean', required: false }] },
      actor,
      randomUUID(),
    );
    expect(afterAdd.version).toBe(3);
    expect(afterAdd.versions?.map((item) => item.version)).toEqual([1, 2]);
    expect((await repo.find(definition.id, company))?.version).toBe(3);
    expect((await repo.find(definition.id, company))?.versions).toHaveLength(2);
    expect(await repo.find(definition.id, otherCompany)).toBeNull();
  });
});
