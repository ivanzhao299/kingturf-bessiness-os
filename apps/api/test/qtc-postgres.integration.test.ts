import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, migrate } from '@kingturf/database';
import { PostgresQuoteToCashRepository } from '../src/qtc-repositories.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL is required; Quote-to-Cash PostgreSQL tests may not be skipped');

describe('JTF-P1-E11..E17 PostgreSQL ledger acceptance', () => {
  const identifier = (value: unknown): string => {
    if (typeof value !== 'string') throw new Error('Expected identifier');
    return value;
  };
  const schema = `qtc_${randomUUID().replaceAll('-', '')}`,
    company = randomUUID(),
    otherCompany = randomUUID(),
    team = randomUUID(),
    otherTeam = randomUUID(),
    employee = randomUUID(),
    outsider = randomUUID(),
    customer = randomUUID();
  const context = {
    actor: { companyId: company, employeeId: employee },
    scopes: ['COMPANY'] as const,
    anchors: [],
  };
  let admin: Database, db: Database, qtc: PostgresQuoteToCashRepository;
  beforeAll(async () => {
    admin = new Database(connectionString);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(connectionString);
    scoped.searchParams.set('options', `-csearch_path=${schema}`);
    db = new Database(scoped.toString());
    await migrate(db);
    await db.query(
      "INSERT INTO organizations(id,code,name,organization_type) VALUES($1,'A','A','COMPANY'),($2,'B','B','COMPANY')",
      [company, otherCompany],
    );
    await db.query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$2,'TA','TA','TEAM'),($3,$4,'TB','TB','TEAM')",
      [team, company, otherTeam, otherCompany],
    );
    await db.query(
      "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'E','Employee','e@a.test'),($4,$5,$6,'O','Other','o@b.test')",
      [employee, company, team, outsider, otherCompany, otherTeam],
    );
    await db.query(
      "INSERT INTO customers(id,tenant_id,customer_number,name,normalized_name,status,owner_id,owner_organization_id,created_by,updated_by) VALUES($1,$2,'C','Customer','customer','ACTIVE',$3,$4,$3,$3)",
      [customer, company, employee, team],
    );
    qtc = new PostgresQuoteToCashRepository(db);
  });
  afterAll(async () => {
    await db.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.close();
  });

  it('rolls back collisions, rejects cross-tenant access, freezes intake, and serializes allocation', async () => {
    const correlation = randomUUID();
    const item = await qtc.postAr(
      {
        customerId: customer,
        salesOrderId: null,
        documentNumber: 'INV-1',
        documentType: 'INVOICE',
        currency: 'CNY',
        amount: '100.000000',
        dueAt: '2026-09-01T00:00:00.000Z',
      },
      'ar-1',
      context,
      correlation,
    );
    const payment = await qtc.intakePayment(
      {
        customerId: customer,
        currency: 'CNY',
        amount: '100.000000',
        receivedAt: '2026-08-13T00:00:00.000Z',
        bankReference: 'BANK-1',
        rawPayload: { source: 'fixture' },
      },
      'pay-1',
      context,
      correlation,
    );
    await expect(
      db.query('UPDATE bank_payments SET amount=1 WHERE id=$1', [payment.id]),
    ).rejects.toThrow(/immutable/u);
    await expect(
      qtc.intakePayment(
        {
          customerId: customer,
          currency: 'CNY',
          amount: '1',
          receivedAt: '2026-08-13T00:00:00.000Z',
          bankReference: 'BANK-2',
          rawPayload: {},
        },
        'pay-1',
        context,
        correlation,
      ),
    ).rejects.toThrow(/Idempotency key/u);
    await expect(
      qtc.intakePayment(
        {
          customerId: customer,
          currency: 'CNY',
          amount: '100.000000',
          receivedAt: '2026-08-13T00:00:00.000Z',
          bankReference: 'BANK-1',
          rawPayload: { source: 'fixture' },
        },
        'pay-1',
        { ...context, scopes: [] },
        correlation,
      ),
    ).rejects.toThrow(/not found/u);
    expect(
      (await db.query("SELECT count(*)::int n FROM bank_payments WHERE bank_reference='BANK-2'"))
        .rows[0],
    ).toEqual({ n: 0 });
    await expect(
      qtc.postAr(
        {
          customerId: customer,
          salesOrderId: null,
          documentNumber: 'X',
          documentType: 'INVOICE',
          currency: 'CNY',
          amount: '1',
          dueAt: '2026-09-01T00:00:00.000Z',
        },
        'cross',
        {
          actor: { companyId: otherCompany, employeeId: outsider },
          scopes: ['COMPANY'],
          anchors: [],
        },
        correlation,
      ),
    ).rejects.toThrow(/not found/u);
    const attempts = await Promise.allSettled([
      qtc.reconcile({ paymentId: identifier(payment.id) }, 'run-a', context, correlation),
      qtc.reconcile({ paymentId: identifier(payment.id) }, 'run-b', context, correlation),
    ]);
    expect(attempts.every((x) => x.status === 'fulfilled')).toBe(true);
    const statuses = attempts.map((attempt) => {
      if (attempt.status !== 'fulfilled') throw attempt.reason;
      const value: unknown = attempt.value.status;
      if (typeof value !== 'string') throw new Error('Expected reconciliation status');
      return value;
    });
    expect(statuses.sort()).toEqual(['COMPLETED', 'NO_MATCH']);
    expect(
      (await db.query('SELECT amount FROM allocation_entries WHERE ar_open_item_id=$1', [item.id]))
        .rows,
    ).toEqual([{ amount: '100.000000' }]);
    expect(
      (
        await db.query(
          "SELECT count(*)::int n FROM audit_events WHERE action IN ('ar.posted','bank-payment.received','reconciliation.completed')",
        )
      ).rows[0],
    ).toEqual({ n: 4 });
    expect(
      (
        await db.query('SELECT count(*)::int n FROM domain_event_outbox WHERE tenant_id=$1', [
          company,
        ])
      ).rows[0],
    ).toEqual({ n: 4 });
    const clearedPayments = await qtc.listOperationalPage(
      'payments',
      {
        limit: 10,
        query: 'BANK-1',
        from: '2026-08-01T00:00:00.000Z',
        to: '2026-08-31T23:59:59.999Z',
        minAmount: '0',
        maxAmount: '0',
        state: 'CLEARED',
      },
      context,
    );
    expect(clearedPayments).toMatchObject({
      items: [{ id: payment.id, bank_reference: 'BANK-1', remaining_amount: 0 }],
      nextCursor: null,
    });
  });

  it('pages and filters receivables with stable tenant-scoped cursors', async () => {
    const correlation = randomUUID();
    const first = await qtc.postAr(
      {
        customerId: customer,
        salesOrderId: null,
        documentNumber: 'INV-PAGE-1',
        documentType: 'INVOICE',
        currency: 'CNY',
        amount: '200',
        dueAt: '2026-10-01T00:00:00.000Z',
      },
      'ar-page-1',
      context,
      correlation,
    );
    const second = await qtc.postAr(
      {
        customerId: customer,
        salesOrderId: null,
        documentNumber: 'INV-PAGE-2',
        documentType: 'INVOICE',
        currency: 'CNY',
        amount: '300',
        dueAt: '2026-10-02T00:00:00.000Z',
      },
      'ar-page-2',
      context,
      correlation,
    );
    const pageOne = await qtc.listOperationalPage(
      'ar',
      {
        limit: 1,
        query: 'INV-PAGE',
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-31T23:59:59.999Z',
        minAmount: '150',
        maxAmount: '350',
        state: 'OPEN',
      },
      context,
    );
    expect(pageOne.items).toHaveLength(1);
    expect(pageOne.items[0]).toMatchObject({ id: first.id, documentNumber: 'INV-PAGE-1' });
    expect(pageOne.nextCursor).toBe(first.id);
    if (!pageOne.nextCursor) throw new Error('Expected a stable cursor for the second page');
    const pageTwo = await qtc.listOperationalPage(
      'ar',
      { limit: 1, query: 'INV-PAGE', cursor: pageOne.nextCursor },
      context,
    );
    expect(pageTwo.items).toHaveLength(1);
    expect(pageTwo.items[0]).toMatchObject({ id: second.id, documentNumber: 'INV-PAGE-2' });
    expect(pageTwo.nextCursor).toBeNull();
    const hidden = await qtc.listOperationalPage(
      'ar',
      { limit: 10 },
      {
        ...context,
        actor: { companyId: otherCompany, employeeId: outsider },
      },
    );
    expect(hidden.items).toEqual([]);
  });
});
