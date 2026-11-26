import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, migrate } from '@kingturf/database';
import { ownedHttpApi } from './fixtures/owned-http-api.js';

// TD-OPS-007（2026-11-26 项目所有者裁定，沿用现值）：投诉描述去首尾空白后至少 10 个字符，
// 此前短描述直接命中迁移 0054 的 CHECK(length(trim(description))>=10) 返回 500。
// 生产 server.ts 子进程（真 HTTP）+ 真 PostgreSQL；断言同时核对响应与落库行数。

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL is required; ops write guard tests may not be skipped');

const commandKey = () => `CMP-${randomUUID().toUpperCase()}`;
const hash = 'a'.repeat(64);
type Api = Awaited<ReturnType<typeof ownedHttpApi>>;
type User = Awaited<ReturnType<Api['user']>>;
type Reply = Awaited<ReturnType<User['request']>>;
const error = async (reply: Reply) =>
  (await reply.json()) as { error: { code: string; message: string; correlationId: unknown } };

describe('TD-OPS-007 short complaint descriptions over real HTTP on real PostgreSQL', () => {
  const schema = `opsguard_${randomUUID().replaceAll('-', '')}`,
    company = randomUUID(),
    team = randomUUID(),
    registrarEmployee = randomUUID(),
    customer = randomUUID(),
    policy = randomUUID();
  let admin: Database, db: Database, http: Api, registrar: User;

  const counts = async () =>
    (
      await db.query(
        `SELECT (SELECT count(*)::int n FROM customer_complaints) complaints,
                (SELECT count(*)::int n FROM customer_complaint_events) complaint_events,
                (SELECT count(*)::int n FROM audit_events) audits,(SELECT count(*)::int n FROM domain_event_outbox) outbox`,
      )
    ).rows[0];

  const createdId = async (reply: Reply) => {
    expect(reply.status).toBe(201);
    return ((await reply.json()) as { id: string }).id;
  };

  const registerComplaint = (number: string, description: unknown) =>
    registrar.request('/api/v1/complaints', 'POST', {
      complaintNumber: number,
      customerId: customer,
      slaPolicyVersionId: policy,
      channel: 'CUSTOMER_SERVICE',
      defectCategory: 'PILE_HEIGHT',
      severity: 'MAJOR',
      occurredAt: '2026-08-01T00:00:00.000Z',
      reportedAt: '2026-08-02T00:00:00.000Z',
      description,
      customerRequest: '请排查原因并更换',
      initialSnapshot: { customerReference: 'E-OPSGUARD' },
      idempotencyKey: commandKey(),
    });

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
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$2,'QA','Quality','TEAM')",
      [team, company],
    );
    await db.query(
      "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'REGISTRAR','Registrar','registrar@opsguard.test')",
      [registrarEmployee, company, team],
    );
    await db.query(
      `INSERT INTO customers(id,tenant_id,customer_number,name,normalized_name,status,owner_id,owner_organization_id,created_by,updated_by)
       VALUES($1,$2,'C-1','Customer','customer','ACTIVE',$3,$4,$3,$3)`,
      [customer, company, registrarEmployee, team],
    );
    await db.query(
      `INSERT INTO complaint_sla_policy_versions(id,tenant_id,policy_code,version,severity,response_hours,containment_hours,root_cause_hours,closure_hours,effective_at,published_at,canonical_hash,created_by)
       VALUES($1,$2,'MAJOR-STANDARD',1,'MAJOR',4,8,72,240,'2026-01-01','2026-01-01',$3,$4)`,
      [policy, company, hash, registrarEmployee],
    );
    http = await ownedHttpApi({ db, schema });
    registrar = await http.user(registrarEmployee, company);
    await registrar.grant(
      ['complaint:create', 'complaint:read', 'complaint:triage', 'complaint:assign'],
      ['COMPANY'],
    );
  }, 90_000);

  afterAll(async () => {
    await http.close();
    await db.close();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.close();
  });

  it('TD-OPS-007: a description shorter than 10 characters gets a 4xx with a Chinese hint and writes nothing', async () => {
    const nine = '客户反映草坪有起球';
    expect(Array.from(nine).length).toBe(9);
    const before = await counts();
    for (const description of [nine, `  ${nine}  `, '🌟'.repeat(5)]) {
      const reply = await registerComplaint('CMP-OPSGUARD-SHORT', description);
      expect(reply.status).toBe(400);
      const rejected = (await error(reply)).error;
      expect([rejected.code, rejected.message]).toEqual([
        'invalid_request',
        '问题描述至少 10 个字符',
      ]);
      expect(typeof rejected.correlationId).toBe('string');
    }
    expect(await counts()).toEqual(before);
  }, 20_000);

  it('TD-OPS-007: a description of exactly 10 characters is accepted and stored trimmed (boundary)', async () => {
    const ten = '客户反映新草坪有起球';
    const astral = '🌟'.repeat(10);
    expect([Array.from(ten).length, Array.from(astral).length]).toEqual([10, 10]);
    expect(astral.length).toBe(20);
    const padded = await createdId(await registerComplaint('CMP-OPSGUARD-BOUNDARY', `  ${ten}  `));
    const stored = (
      await db.query<{ description: string }>(
        'SELECT description FROM customer_complaints WHERE id=$1',
        [padded],
      )
    ).rows[0];
    expect(stored).toEqual({ description: ten });
    // 码点计数与 PostgreSQL length() 同口径：10 个星面字符是 10 个字符、20 个 UTF-16 码元。
    expect(await createdId(await registerComplaint('CMP-OPSGUARD-ASTRAL', astral))).toEqual(
      expect.any(String),
    );
  }, 20_000);
});
