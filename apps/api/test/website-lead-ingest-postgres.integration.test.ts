import { createHmac, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, migrate } from '@kingturf/database';
import { PostgresWebsiteLeadIngestor } from '../src/website-lead-ingest.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL is required; website lead PostgreSQL tests may not be skipped');

const canonical = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
    .join(',')}}`;
};

describe('website inquiry to CRM lead PostgreSQL acceptance', () => {
  const schema = `website_lead_${randomUUID().replaceAll('-', '')}`;
  const companyId = randomUUID();
  const secret = 'website-lead-postgres-test-secret-32-characters';
  let admin: Database;
  let database: Database;

  beforeAll(async () => {
    admin = new Database(connectionString);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(connectionString);
    scoped.searchParams.set('options', `-csearch_path=${schema}`);
    database = new Database(scoped.toString());
    await migrate(database);
    await database.query(
      "INSERT INTO organizations(id,code,name,organization_type) VALUES($1,'KT','King Turf','COMPANY')",
      [companyId],
    );
  });

  afterAll(async () => {
    await database.close();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.close();
  });

  it('creates one pool lead and replays concurrent duplicate inquiries idempotently', async () => {
    const payload = {
      externalRef: `website-test-${randomUUID()}`,
      name: 'Website acceptance',
      company: 'Website Test Company',
      contact: 'website-test@kingturf.invalid',
      country: 'CN',
      application: 'Football field',
      projectBrief: 'Automated integration acceptance',
      locale: 'en',
      sourcePage: '/en/contact',
    } as const;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = `sha256=${createHmac('sha256', secret)
      .update(`${timestamp}.${canonical(payload)}`)
      .digest('hex')}`;
    const ingestor = new PostgresWebsiteLeadIngestor(database, secret);
    const results = await Promise.all([
      ingestor.ingest(payload, timestamp, signature, randomUUID()),
      ingestor.ingest(payload, timestamp, signature, randomUUID()),
    ]);

    expect(new Set(results.map(({ leadId }) => leadId)).size).toBe(1);
    expect(results.map(({ duplicate }) => duplicate).sort()).toEqual([false, true]);
    const leadId = results[0].leadId;
    expect(
      (
        await database.query<{
          audit_count: string;
          ingest_count: string;
          lead_count: string;
          service_employee_count: string;
        }>(
          `SELECT
            (SELECT count(*)::text FROM leads WHERE id=$1 AND tenant_id=$2 AND source='WEBSITE' AND status='POOL') lead_count,
            (SELECT count(*)::text FROM website_lead_ingests WHERE lead_id=$1 AND tenant_id=$2 AND external_ref=$3) ingest_count,
            (SELECT count(*)::text FROM audit_events WHERE target_id=$1 AND organization_id=$2 AND action='lead.website_ingested') audit_count,
            (SELECT count(*)::text FROM employees e LEFT JOIN identities i ON i.employee_id=e.id WHERE e.company_id=$2 AND e.employee_number='KT-WEBSITE-INTEGRATION' AND i.id IS NULL) service_employee_count`,
          [leadId, companyId, payload.externalRef],
        )
      ).rows[0],
    ).toEqual({
      audit_count: '1',
      ingest_count: '1',
      lead_count: '1',
      service_employee_count: '1',
    });
  });

  it('rejects invalid signatures without writing a lead', async () => {
    const ingestor = new PostgresWebsiteLeadIngestor(database, secret);
    await expect(
      ingestor.ingest(
        {
          externalRef: 'bad-signature',
          name: 'Invalid',
          company: null,
          contact: 'invalid@kingturf.invalid',
          country: null,
          application: 'Test',
          projectBrief: null,
          locale: 'en',
          sourcePage: null,
        },
        String(Math.floor(Date.now() / 1000)),
        `sha256=${'0'.repeat(64)}`,
        randomUUID(),
      ),
    ).rejects.toThrow(/signature is invalid/u);
  });
});
