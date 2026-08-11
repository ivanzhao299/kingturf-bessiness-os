import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, migrate } from '@kingturf/database';
import {
  PostgresAuditRepository,
  PostgresMasterDataRepository,
  PostgresNumberRepository,
  PostgresRuleRepository,
  PostgresWorkflowRepository,
} from '../src/platform-repositories.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL is required; PostgreSQL integration tests may not be skipped');
const schema = `platform_${randomUUID().replaceAll('-', '')}`;
let admin: Database, db: Database;
const company = randomUUID(),
  otherCompany = randomUUID(),
  organization = randomUUID(),
  otherOrganization = randomUUID();
const requester = randomUUID(),
  approver = randomUUID(),
  outsider = randomUUID();
const actor = { companyId: company, employeeId: requester };
const approverActor = { companyId: company, employeeId: approver };
const spec = {
  states: ['PENDING', 'APPROVED'],
  initialState: 'PENDING',
  terminalStates: ['APPROVED'],
  transitions: [{ from: 'PENDING', to: 'APPROVED', decision: 'approve' }],
  steps: [
    {
      key: 'review',
      order: 1,
      eligibleRoles: [],
      eligibleActors: [approver],
      quorum: 1,
      separateFromRequester: true,
    },
  ],
} as const;

describe('JTF-P0-E07..E11 PostgreSQL scenarios', () => {
  beforeAll(async () => {
    admin = new Database(connectionString);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(connectionString);
    scoped.searchParams.set('options', `-csearch_path=${schema}`);
    db = new Database(scoped.toString());
    await migrate(db);
    await db.query(
      "INSERT INTO organizations(id,code,name,organization_type) VALUES($1,'PLATFORM','Platform','COMPANY'),($2,'OTHER','Other','COMPANY')",
      [company, otherCompany],
    );
    await db.query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$2,'TEAM','Team','TEAM'),($3,$4,'OTHER-TEAM','Other team','TEAM')",
      [organization, company, otherOrganization, otherCompany],
    );
    await db.query(
      "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$4,$5,'REQ','Requester','req@example.test'),($2,$4,$5,'APR','Approver','apr@example.test'),($3,$6,$7,'OUT','Outsider','out@example.test')",
      [requester, approver, outsider, company, organization, otherCompany, otherOrganization],
    );
  });
  afterAll(async () => {
    await db.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.close();
  });

  it('versions, reads by effective time, logically deletes entries, and audits atomically', async () => {
    const repo = new PostgresMasterDataRepository(db),
      now = new Date().toISOString();
    const category = (await repo.createCategory(
      { code: 'COLOR', name: 'Color', description: null, effectiveFrom: now, effectiveTo: null },
      actor,
      randomUUID(),
    )) as { category_id?: string; id?: string };
    const categoryId =
      category.category_id ??
      (
        await db.query<{ category_id: string }>(
          'SELECT category_id FROM master_category_versions WHERE id=$1',
          [category.id],
        )
      ).rows[0]?.category_id;
    expect(categoryId).toBeTruthy();
    if (!categoryId) throw new Error('Expected category fixture');
    const created = (await repo.createEntry(
      {
        categoryId,
        code: 'RED',
        label: 'Red',
        value: { hex: '#f00' },
        effectiveFrom: now,
        effectiveTo: null,
      },
      actor,
      randomUUID(),
    )) as { entry_id: string };
    await repo.updateEntry(
      created.entry_id,
      {
        label: 'Crimson',
        value: { hex: '#c00' },
        effectiveFrom: now,
        effectiveTo: null,
        version: 1,
      },
      actor,
      randomUUID(),
    );
    expect((await repo.findEntry(created.entry_id, company))?.label).toBe('Crimson');
    await repo.deleteEntry(created.entry_id, 2, actor, randomUUID());
    expect(await repo.findEntry(created.entry_id, company)).toBeNull();
    expect(
      (await db.query('SELECT 1 FROM audit_events WHERE target_id=$1', [created.entry_id]))
        .rowCount,
    ).toBe(3);
  });

  it('allocates unique numbers concurrently and preserves idempotent allocation', async () => {
    const repo = new PostgresNumberRepository(db);
    const definition = (await repo.createDefinition(
      {
        code: 'GENERIC',
        prefix: 'N-',
        suffix: '',
        padding: 4,
        startingValue: 1,
        increment: 1,
        resetPeriod: 'NEVER',
      },
      actor,
      randomUUID(),
    )) as { id: string };
    await repo.publish(definition.id, 1, actor, randomUUID());
    const values = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        repo.allocate(definition.id, `key-${String(i)}`, actor, randomUUID()),
      ),
    );
    expect(new Set(values.map((v) => v.value)).size).toBe(12);
    const first = await repo.allocate(definition.id, 'stable', actor, randomUUID());
    const retry = await repo.allocate(definition.id, 'stable', actor, randomUUID());
    expect(retry).toEqual(first);
    await repo.createVersion(
      definition.id,
      {
        prefix: 'V2-',
        suffix: '',
        padding: 4,
        startingValue: 100,
        increment: 1,
        resetPeriod: 'NEVER',
      },
      actor,
      randomUUID(),
    );
    await expect(
      db.query('DELETE FROM number_definition_versions WHERE definition_id=$1 AND version=1', [
        definition.id,
      ]),
    ).rejects.toThrow(/immutable/u);
  });

  it('returns the exact stored rule snapshot on retry and protects published versions', async () => {
    const repo = new PostgresRuleRepository(db);
    const definition = (await repo.create(
      {
        code: 'GENERIC_RULE',
        ast: {
          op: 'eq',
          left: { op: 'input', path: 'flag' },
          right: { op: 'literal', value: true },
        },
        requiredInputs: ['flag'],
      },
      actor,
      randomUUID(),
    )) as { id: string };
    await repo.publish(definition.id, 1, actor, randomUUID());
    const first = await repo.evaluate(definition.id, { flag: true }, 'same', actor, randomUUID());
    const retry = await repo.evaluate(definition.id, { flag: false }, 'same', actor, randomUUID());
    expect(retry).toEqual(first);
    expect(
      (
        await db.query("SELECT 1 FROM audit_events WHERE action='rule.evaluate' AND target_id=$1", [
          first.id,
        ])
      ).rowCount,
    ).toBe(1);
    await repo.createVersion(
      definition.id,
      { ast: { op: 'literal', value: false }, requiredInputs: [] },
      actor,
      randomUUID(),
    );
    await expect(
      db.query('DELETE FROM rule_definition_versions WHERE definition_id=$1 AND version=1', [
        definition.id,
      ]),
    ).rejects.toThrow(/immutable/u);
  });

  it('runs an idempotent workflow with assignment, SoD, transitions, and immutable history', async () => {
    const repo = new PostgresWorkflowRepository(db);
    const definition = (await repo.create({ code: 'GENERIC_FLOW', spec }, actor, randomUUID())) as {
      id: string;
    };
    await repo.publish(definition.id, 1, actor, randomUUID());
    const subject = randomUUID(),
      started = (await repo.start(
        definition.id,
        'generic-subject',
        subject,
        'start-key',
        actor,
        randomUUID(),
      )) as { id: string };
    expect(
      (
        (await repo.start(
          definition.id,
          'generic-subject',
          randomUUID(),
          'start-key',
          actor,
          randomUUID(),
        )) as { id: string }
      ).id,
    ).toBe(started.id);
    const task = (await repo.listTasks(approverActor))[0] as { id: string } | undefined;
    expect(task).toBeTruthy();
    if (!task) throw new Error('Expected workflow task');
    await expect(
      repo.decide(task.id, 'approve', null, 'bad', 1, actor, randomUUID()),
    ).rejects.toThrow();
    const decision = (await repo.decide(
      task.id,
      'approve',
      null,
      'decision-key',
      1,
      approverActor,
      randomUUID(),
    )) as { id: string };
    expect(
      (
        (await repo.decide(
          task.id,
          'approve',
          null,
          'decision-key',
          1,
          approverActor,
          randomUUID(),
        )) as { id: string }
      ).id,
    ).toBe(decision.id);
    await expect(
      repo.decide(task.id, 'approve', 'changed', 'decision-key', 1, approverActor, randomUUID()),
    ).rejects.toThrow();
    expect(
      (
        await db.query<{ state: string }>('SELECT state FROM workflow_instances WHERE id=$1', [
          started.id,
        ])
      ).rows[0]?.state,
    ).toBe('APPROVED');
    await expect(
      db.query('DELETE FROM workflow_decisions WHERE id=$1', [decision.id]),
    ).rejects.toThrow(/immutable/u);
    await expect(
      db.query('DELETE FROM workflow_definition_versions WHERE definition_id=$1 AND version=1', [
        definition.id,
      ]),
    ).rejects.toThrow(/immutable/u);
  });

  it('applies audit DataScope and tenant isolation', async () => {
    const repo = new PostgresAuditRepository(db);
    const all = await repo.list(company, {}, ['COMPANY'], requester, []);
    expect(all.items.length).toBeGreaterThan(0);
    const self = await repo.list(company, {}, ['SELF'], requester, []);
    expect(self.items.every((e) => e.actorId === requester)).toBe(true);
    expect((await repo.list(otherCompany, {}, ['GROUP'], outsider, [])).items).toEqual([]);
  });
});
