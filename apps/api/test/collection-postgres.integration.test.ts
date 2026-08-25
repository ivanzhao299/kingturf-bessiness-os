import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, migrate } from '@kingturf/database';
import { PostgresQuoteToCashRepository } from '../src/qtc-repositories.js';
import { PostgresCollectionRepository } from '../src/collection-repositories.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL is required; collections PostgreSQL tests may not be skipped');

const identifier = (value: unknown): string => {
  if (typeof value !== 'string') throw new Error('Expected string identifier');
  return value;
};

describe('KT-L19 PostgreSQL collections and legal evidence acceptance', () => {
  const schema = `collections_${randomUUID().replaceAll('-', '')}`,
    company = randomUUID(),
    team = randomUUID(),
    collector = randomUUID(),
    legal = randomUUID(),
    customer = randomUUID();
  const collectorContext = {
    actor: { companyId: company, employeeId: collector },
    scopes: ['COMPANY'] as const,
    anchors: [],
  };
  const legalContext = {
    actor: { companyId: company, employeeId: legal },
    scopes: ['COMPANY'] as const,
    anchors: [],
  };
  let admin: Database,
    db: Database,
    qtc: PostgresQuoteToCashRepository,
    collections: PostgresCollectionRepository;

  beforeAll(async () => {
    admin = new Database(connectionString);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(connectionString);
    scoped.searchParams.set('options', `-csearch_path=${schema}`);
    db = new Database(scoped.toString());
    await migrate(db);
    await db.query(
      "INSERT INTO organizations(id,code,name,organization_type) VALUES($1,'KT','KingTurf','COMPANY')",
      [company],
    );
    await db.query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$2,'FIN','Finance','TEAM')",
      [team, company],
    );
    await db.query(
      "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'COL','Collector','collector@kt.test'),($4,$2,$3,'LEGAL','Legal','legal@kt.test')",
      [collector, company, team, legal],
    );
    await db.query(
      "INSERT INTO customers(id,tenant_id,customer_number,name,normalized_name,status,owner_id,owner_organization_id,created_by,updated_by) VALUES($1,$2,'C-1','Overdue Customer','overdue customer','ACTIVE',$3,$4,$3,$3)",
      [customer, company, collector, team],
    );
    qtc = new PostgresQuoteToCashRepository(db);
    collections = new PostgresCollectionRepository(db);
  });

  afterAll(async () => {
    await db.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.close();
  });

  it('closes an overdue receivable through broken promise, independent legal acceptance, and ready evidence', async () => {
    const correlation = randomUUID();
    const ar = await qtc.postAr(
      {
        customerId: customer,
        salesOrderId: null,
        documentNumber: 'INV-L19-1',
        documentType: 'INVOICE',
        currency: 'CNY',
        amount: '100000.000000',
        dueAt: '2026-01-01T00:00:00.000Z',
      },
      'l19-ar-1',
      collectorContext,
      correlation,
    );
    const opened = await collections.createCase(
      {
        caseNumber: 'COL-L19-1',
        arOpenItemId: identifier(ar.id),
        assignedTo: collector,
        priority: 'CRITICAL',
        reason: '逾期未付款',
        idempotencyKey: 'l19-case-1',
      },
      collectorContext,
      correlation,
    );
    await collections.addFollowup(
      opened.id,
      {
        channel: 'PHONE',
        occurredAt: '2026-08-01T08:00:00.000Z',
        contactPerson: 'Buyer Finance',
        outcome: '客户承诺八月付款',
        evidence: { callReference: 'CALL-L19-1' },
        idempotencyKey: 'l19-followup-1',
      },
      collectorContext,
      correlation,
    );
    const promise = await collections.createPromise(
      opened.id,
      {
        promisedAmount: '100000.000000',
        currency: 'CNY',
        promisedAt: '2026-08-01T08:00:00.000Z',
        dueAt: '2026-08-10T08:00:00.000Z',
        debtorContact: 'Buyer Finance',
        evidence: { emailReference: 'MAIL-L19-1' },
        idempotencyKey: 'l19-promise-1',
      },
      collectorContext,
      correlation,
    );
    await expect(
      collections.decidePromise(
        promise.id,
        'FULFILLED',
        {
          reason: '无核销证据',
          allocationEntryIds: [],
          evidence: {},
          idempotencyKey: 'l19-promise-false-fulfill',
        },
        collectorContext,
        correlation,
      ),
    ).rejects.toThrow(/sufficient allocation evidence/u);
    await collections.decidePromise(
      promise.id,
      'BROKEN',
      {
        reason: '承诺到期仍未到账',
        allocationEntryIds: [],
        evidence: { reviewedAt: '2026-08-11T00:00:00.000Z' },
        idempotencyKey: 'l19-promise-broken',
      },
      collectorContext,
      correlation,
    );
    const handoff = await collections.requestLegal(
      opened.id,
      {
        handoffNumber: 'LEGAL-L19-1',
        reason: '付款承诺违约',
        idempotencyKey: 'l19-legal-1',
      },
      collectorContext,
      correlation,
    );
    await expect(
      collections.decideLegal(
        handoff.id,
        'ACCEPTED',
        { reason: '自受理', evidence: {}, idempotencyKey: 'l19-illegal-self-accept' },
        collectorContext,
        correlation,
      ),
    ).rejects.toThrow(/requester cannot decide/u);
    await collections.decideLegal(
      handoff.id,
      'ACCEPTED',
      {
        reason: '法务证据审查通过',
        evidence: { reviewReference: 'LEGAL-REVIEW-1' },
        idempotencyKey: 'l19-legal-accepted',
      },
      legalContext,
      correlation,
    );
    const evidencePackage = await collections.generateEvidencePackage(
      handoff.id,
      { packageNumber: 'DEBT-L19-1', idempotencyKey: 'l19-debt-1' },
      legalContext,
      correlation,
    );
    expect(evidencePackage).toMatchObject({ state: 'READY', missingRequirements: [] });
    await collections.transitionCase(
      opened.id,
      'CLOSED',
      {
        reason: '法务案件材料已冻结',
        evidence: { packageId: evidencePackage.id },
        idempotencyKey: 'l19-case-closed',
      },
      legalContext,
      correlation,
    );
    const [listed] = await collections.list(legalContext);
    expect(listed).toMatchObject({ state: 'CLOSED', case_number: 'COL-L19-1' });
    const auditActions = (
      await db.query<{ action: string }>(
        "SELECT action FROM audit_events WHERE organization_id=$1 AND action LIKE ANY(ARRAY['collection-%','legal-%','debt-%']) ORDER BY occurred_at,id",
        [company],
      )
    ).rows.map(({ action }) => action);
    expect(auditActions).toEqual([
      'collection-case.opened',
      'collection-followup.recorded',
      'collection-promise.created',
      'collection-promise.broken',
      'legal-handoff.requested',
      'legal-handoff.accepted',
      'debt-evidence-package.generated',
      'collection-case.closed',
    ]);
    await expect(
      db.query("UPDATE collection_cases SET priority='LOW' WHERE id=$1", [opened.id]),
    ).rejects.toThrow(/immutable/u);
  });
});
