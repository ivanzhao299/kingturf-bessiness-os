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
  region = randomUUID(),
  department = randomUUID(),
  organization = randomUUID(),
  otherOrganization = randomUUID();
const requester = randomUUID(),
  approver = randomUUID(),
  outsider = randomUUID();
const auditFixture = {
  siblingTeam: randomUUID(),
  siblingDepartment: randomUUID(),
  siblingDepartmentTeam: randomUUID(),
  siblingRegion: randomUUID(),
  siblingRegionDepartment: randomUUID(),
  siblingRegionTeam: randomUUID(),
  inactiveTeam: randomUUID(),
  deletedTeam: randomUUID(),
  siblingTeamActor: randomUUID(),
  siblingDepartmentActor: randomUUID(),
  siblingRegionActor: randomUUID(),
} as const;
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
      "INSERT INTO organizations(id,owner_organization_id,parent_id,code,name,organization_type) VALUES($1,$4,NULL,'REGION','Region','REGION'),($2,$4,$1,'DEPARTMENT','Department','DEPARTMENT'),($3,$4,$2,'TEAM','Team','TEAM'),($5,$6,NULL,'OTHER-TEAM','Other team','TEAM')",
      [region, department, organization, company, otherOrganization, otherCompany],
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
      firstEffective = '2025-01-01T00:00:00.000Z',
      secondEffective = '2026-01-01T00:00:00.000Z';
    const category = (await repo.createCategory(
      {
        code: 'COLOR',
        name: 'Color',
        description: null,
        effectiveFrom: firstEffective,
        effectiveTo: null,
      },
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
    await repo.updateCategory(
      categoryId,
      {
        name: 'Colour',
        description: null,
        effectiveFrom: secondEffective,
        effectiveTo: null,
        version: 1,
      },
      actor,
      randomUUID(),
    );
    expect((await repo.listCategories(company, new Date(firstEffective)))[0]?.name).toBe('Color');
    expect((await repo.listCategories(company, new Date(secondEffective)))[0]?.name).toBe('Colour');
    await expect(
      repo.updateCategory(
        categoryId,
        {
          name: 'Stale',
          description: null,
          effectiveFrom: secondEffective,
          effectiveTo: null,
          version: 1,
        },
        actor,
        randomUUID(),
      ),
    ).rejects.toThrow(/stale/u);
    const created = (await repo.createEntry(
      {
        categoryId,
        code: 'RED',
        label: 'Red',
        value: { hex: '#f00' },
        effectiveFrom: firstEffective,
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
        effectiveFrom: secondEffective,
        effectiveTo: null,
        version: 1,
      },
      actor,
      randomUUID(),
    );
    expect((await repo.findEntry(created.entry_id, company, new Date(firstEffective)))?.label).toBe(
      'Red',
    );
    expect(
      (await repo.findEntry(created.entry_id, company, new Date(secondEffective)))?.label,
    ).toBe('Crimson');
    expect(await repo.findEntry(created.entry_id, otherCompany)).toBeNull();
    await expect(
      repo.updateEntry(
        created.entry_id,
        {
          label: 'Stale',
          value: {},
          effectiveFrom: secondEffective,
          effectiveTo: null,
          version: 1,
        },
        actor,
        randomUUID(),
      ),
    ).rejects.toThrow(/stale/u);
    await repo.deleteEntry(created.entry_id, 2, actor, randomUUID());
    expect(await repo.findEntry(created.entry_id, company)).toBeNull();
    expect(
      (await db.query('SELECT 1 FROM audit_events WHERE target_id=$1', [created.entry_id]))
        .rowCount,
    ).toBe(3);
    await expect(
      repo.deleteCategory(categoryId, 2, { ...actor, companyId: otherCompany }, randomUUID()),
    ).rejects.toThrow();
    await repo.deleteCategory(categoryId, 2, actor, randomUUID());
    expect(await repo.listCategories(company, new Date(secondEffective))).toEqual([]);
    await expect(
      repo.createCategory(
        {
          code: 'ROLLBACK',
          name: 'Rollback',
          description: null,
          effectiveFrom: firstEffective,
          effectiveTo: null,
        },
        actor,
        'not-a-uuid',
      ),
    ).rejects.toThrow();
    expect((await db.query("SELECT 1 FROM master_categories WHERE code='ROLLBACK'")).rowCount).toBe(
      0,
    );
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
    const retryCorrelation = randomUUID();
    const [retry, concurrentRetry] = await Promise.all([
      repo.allocate(definition.id, 'stable', actor, retryCorrelation),
      repo.allocate(definition.id, 'stable', actor, randomUUID()),
    ]);
    expect(retry).toEqual(first);
    expect(concurrentRetry).toEqual(first);
    await expect(
      db.query('UPDATE issued_numbers SET rendered_value=$2 WHERE id=$1', [first.id, 'changed']),
    ).rejects.toThrow(/immutable/u);
    await expect(db.query('DELETE FROM issued_numbers WHERE id=$1', [first.id])).rejects.toThrow(
      /immutable/u,
    );
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
      db.query(
        "UPDATE number_definition_versions SET prefix='X' WHERE definition_id=$1 AND version=1",
        [definition.id],
      ),
    ).rejects.toThrow(/immutable/u);
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
      db.query(
        "UPDATE rule_definition_versions SET required_inputs='{}' WHERE definition_id=$1 AND version=1",
        [definition.id],
      ),
    ).rejects.toThrow(/immutable/u);
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
    expect(await repo.listTasks({ companyId: otherCompany, employeeId: outsider })).toEqual([]);
    await expect(
      repo.start(
        definition.id,
        'generic-subject',
        randomUUID(),
        'foreign-start',
        { companyId: otherCompany, employeeId: outsider },
        randomUUID(),
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "UPDATE workflow_definition_versions SET spec='{}' WHERE definition_id=$1 AND version=1",
        [definition.id],
      ),
    ).rejects.toThrow(/immutable/u);
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
      db.query("UPDATE workflow_decisions SET comment='changed' WHERE id=$1", [decision.id]),
    ).rejects.toThrow(/immutable/u);
    const transition = (
      await db.query<{ id: string }>(
        'SELECT id FROM workflow_transitions WHERE instance_id=$1 ORDER BY occurred_at DESC LIMIT 1',
        [started.id],
      )
    ).rows[0];
    expect(transition).toBeTruthy();
    if (transition) {
      await expect(
        db.query("UPDATE workflow_transitions SET reason='changed' WHERE id=$1", [transition.id]),
      ).rejects.toThrow(/immutable/u);
      await expect(
        db.query('DELETE FROM workflow_transitions WHERE id=$1', [transition.id]),
      ).rejects.toThrow(/immutable/u);
    }
    await expect(
      db.query('DELETE FROM workflow_definition_versions WHERE definition_id=$1 AND version=1', [
        definition.id,
      ]),
    ).rejects.toThrow(/immutable/u);
  });

  it('applies the audit DataScope security matrix to list and find', async () => {
    const repo = new PostgresAuditRepository(db);
    await db.query(
      `INSERT INTO organizations(id,owner_organization_id,parent_id,code,name,organization_type,active,deleted_at) VALUES
       ($1,$9,$10,'AUD-TEAM-2','Audit team 2','TEAM',true,NULL),
       ($2,$9,$11,'AUD-DEPT-2','Audit department 2','DEPARTMENT',true,NULL),
       ($3,$9,$2,'AUD-DEPT-TEAM','Audit department team','TEAM',true,NULL),
       ($4,$9,NULL,'AUD-REGION-2','Audit region 2','REGION',true,NULL),
       ($5,$9,$4,'AUD-REGION-DEPT','Audit region department','DEPARTMENT',true,NULL),
       ($6,$9,$5,'AUD-REGION-TEAM','Audit region team','TEAM',true,NULL),
       ($7,$9,$10,'AUD-INACTIVE','Inactive team','TEAM',false,NULL),
       ($8,$9,$10,'AUD-DELETED','Deleted team','TEAM',true,now())`,
      [
        auditFixture.siblingTeam,
        auditFixture.siblingDepartment,
        auditFixture.siblingDepartmentTeam,
        auditFixture.siblingRegion,
        auditFixture.siblingRegionDepartment,
        auditFixture.siblingRegionTeam,
        auditFixture.inactiveTeam,
        auditFixture.deletedTeam,
        company,
        department,
        region,
      ],
    );
    await db.query(
      `INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES
       ($1,$7,$4,'AUD-T','Audit team actor','audit-team@example.test'),
       ($2,$7,$5,'AUD-D','Audit department actor','audit-department@example.test'),
       ($3,$7,$6,'AUD-R','Audit region actor','audit-region@example.test')`,
      [
        auditFixture.siblingTeamActor,
        auditFixture.siblingDepartmentActor,
        auditFixture.siblingRegionActor,
        auditFixture.siblingTeam,
        auditFixture.siblingDepartmentTeam,
        auditFixture.siblingRegionTeam,
        company,
      ],
    );
    const eventIds = {
      self: randomUUID(),
      team: randomUUID(),
      department: randomUUID(),
      region: randomUUID(),
      company: randomUUID(),
      foreign: randomUUID(),
    } as const;
    await db.query(
      `INSERT INTO audit_events(id,action,outcome,actor_id,organization_id,correlation_id,metadata) VALUES
       ($1,'scope.self','SUCCESS',$7,$12,$13,'{}'),
       ($2,'scope.team','SUCCESS',$8,$12,$13,'{}'),
       ($3,'scope.department','SUCCESS',$9,$12,$13,'{}'),
       ($4,'scope.region','SUCCESS',$10,$12,$13,'{}'),
       ($5,'scope.company','SUCCESS',$11,$12,$13,'{}'),
       ($6,'scope.foreign','SUCCESS',$7,$14,$13,'{}')`,
      [
        eventIds.self,
        eventIds.team,
        eventIds.department,
        eventIds.region,
        eventIds.company,
        eventIds.foreign,
        requester,
        approver,
        auditFixture.siblingTeamActor,
        auditFixture.siblingDepartmentActor,
        auditFixture.siblingRegionActor,
        company,
        randomUUID(),
        otherCompany,
      ],
    );

    const cases = [
      { scope: 'SELF', action: 'scope.self', candidate: eventIds.self },
      { scope: 'TEAM', action: 'scope.team', candidate: eventIds.team },
      { scope: 'DEPARTMENT', action: 'scope.department', candidate: eventIds.department },
      { scope: 'REGION', action: 'scope.region', candidate: eventIds.region },
      { scope: 'COMPANY', action: 'scope.company', candidate: eventIds.company },
      { scope: 'GROUP', action: 'scope.company', candidate: eventIds.company },
    ] as const;
    for (const testCase of cases) {
      const listed = await repo.list(
        company,
        { action: testCase.action },
        [testCase.scope],
        requester,
        [],
      );
      expect(listed.items.map((event) => event.id)).toContain(testCase.candidate);
      expect(
        await repo.find(testCase.candidate, company, [testCase.scope], requester, []),
      ).not.toBeNull();
      expect(
        await repo.find(eventIds.foreign, otherCompany, [testCase.scope], requester, []),
      ).toBeNull();
      expect(
        (
          await repo.list(
            otherCompany,
            { action: 'scope.foreign' },
            [testCase.scope],
            requester,
            [],
          )
        ).items,
      ).toEqual([]);
    }

    const typedCases = [
      {
        scope: 'TEAM',
        anchor: organization,
        positive: eventIds.team,
        outside: eventIds.department,
      },
      {
        scope: 'DEPARTMENT',
        anchor: department,
        positive: eventIds.department,
        outside: eventIds.region,
      },
      {
        scope: 'REGION',
        anchor: region,
        positive: eventIds.region,
        outside: eventIds.company,
      },
    ] as const;
    for (const testCase of typedCases) {
      const anchors = [{ scope: testCase.scope, organizationId: testCase.anchor }];
      const explicitIds = (
        await repo.list(company, { limit: 100 }, [testCase.scope], requester, anchors)
      ).items.map((event) => event.id);
      expect(explicitIds).toContain(testCase.positive);
      expect(explicitIds).not.toContain(testCase.outside);
      expect(
        await repo.find(testCase.positive, company, [testCase.scope], requester, anchors),
      ).not.toBeNull();
      expect(
        await repo.find(testCase.outside, company, [testCase.scope], requester, anchors),
      ).toBeNull();
    }

    const invalidTeamAnchors = [
      { scope: 'TEAM', organizationId: region },
      { scope: 'TEAM', organizationId: otherOrganization },
      { scope: 'TEAM', organizationId: auditFixture.inactiveTeam },
      { scope: 'TEAM', organizationId: auditFixture.deletedTeam },
      { scope: 'TEAM', organizationId: null },
    ] as const;
    for (const anchor of invalidTeamAnchors) {
      expect((await repo.list(company, {}, ['TEAM'], requester, [anchor])).items).toEqual([]);
      expect(await repo.find(eventIds.self, company, ['TEAM'], requester, [anchor])).toBeNull();
    }
    expect(
      (
        await repo.list(company, {}, [], requester, [
          { scope: 'TEAM', organizationId: organization },
        ])
      ).items,
    ).toEqual([]);
    expect(
      (
        await repo.list(company, {}, ['TEAM'], outsider, [
          { scope: 'TEAM', organizationId: organization },
        ])
      ).items,
    ).toEqual([]);
    expect(
      await repo.find(eventIds.self, company, ['TEAM'], outsider, [
        { scope: 'TEAM', organizationId: organization },
      ]),
    ).toBeNull();
  });
});
