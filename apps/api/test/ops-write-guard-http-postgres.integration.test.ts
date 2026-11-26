import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, migrate } from '@kingturf/database';
import { PostgresManufacturingRepository } from '../src/manufacturing-repositories.js';
import { ownedHttpApi } from './fixtures/owned-http-api.js';

// TD-OPS-006 / TD-OPS-007（2026-11-26 项目所有者裁定）：质量与投诉写路径对「留空」与「过短」的处理。
// 生产 server.ts 子进程（真 HTTP）+ 真 PostgreSQL；每个断言同时核对响应与落库值。
// 载荷形态与 Preact 表单逐字段一致：表单留空时数值上下限发空串，备注与临时遏制说明发空串。

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

describe('TD-OPS-006 and TD-OPS-007 blank and short text over real HTTP on real PostgreSQL', () => {
  const schema = `opsguard_${randomUUID().replaceAll('-', '')}`,
    company = randomUUID(),
    team = randomUUID(),
    registrarEmployee = randomUUID(),
    qualityEmployee = randomUUID(),
    customer = randomUUID(),
    policy = randomUUID();
  let admin: Database, db: Database, http: Api, registrar: User, quality: User;
  let itemVersionId: string, lotId: string;

  const counts = async () => {
    const row = (
      await db.query<{
        complaints: number;
        complaint_events: number;
        ncrs: number;
        ncr_events: number;
        plans: number;
        characteristics: number;
        inspections: number;
        results: number;
        audits: number;
        outbox: number;
      }>(
        `SELECT (SELECT count(*)::int n FROM customer_complaints) complaints,
                (SELECT count(*)::int n FROM customer_complaint_events) complaint_events,
                (SELECT count(*)::int n FROM nonconformance_reports) ncrs,(SELECT count(*)::int n FROM ncr_events) ncr_events,
                (SELECT count(*)::int n FROM quality_inspection_plans) plans,(SELECT count(*)::int n FROM quality_plan_characteristics) characteristics,
                (SELECT count(*)::int n FROM quality_inspections) inspections,(SELECT count(*)::int n FROM quality_inspection_results) results,
                (SELECT count(*)::int n FROM audit_events) audits,(SELECT count(*)::int n FROM domain_event_outbox) outbox`,
      )
    ).rows[0];
    if (!row) throw new Error('Fixture counts missing');
    return row;
  };
  const limitRow = async (planVersionId: string) =>
    (
      await db.query<{ lower_limit: string | null; upper_limit: string | null }>(
        'SELECT lower_limit,upper_limit FROM quality_plan_characteristics WHERE inspection_plan_version_id=$1',
        [planVersionId],
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
  const complaintToInvestigating = async (number: string) => {
    const id = await createdId(await registerComplaint(number, '客户反映新草坪有起球'));
    const detail = await registrar.request(`/api/v1/complaints/${id}`);
    const { version } = (await detail.json()) as { version: number };
    const triaged = await registrar.request('/api/v1/complaints/batch-triage', 'POST', {
      batchKey: commandKey(),
      items: [
        { id, expectedVersion: version, assignedTo: qualityEmployee, reason: '分派质量调查' },
      ],
    });
    expect(triaged.status).toBe(200);
    expect(await triaged.json()).toMatchObject({ succeeded: 1 });
    const started = await registrar.request(`/api/v1/complaints/${id}/investigate`, 'POST', {
      expectedVersion: 2,
      reason: '调查开始',
      evidence: { reference: 'E-START' },
      idempotencyKey: commandKey(),
    });
    expect(started.status).toBe(201);
    expect(await started.json()).toMatchObject({ state: 'INVESTIGATING', version: 3 });
    return id;
  };
  const createNcr = (complaintId: string, number: string, temporaryContainment: unknown) =>
    quality.request(`/api/v1/complaints/${complaintId}/ncrs`, 'POST', {
      ncrNumber: number,
      defectType: '起球',
      affectedScope: '单个批次两卷',
      investigatorId: qualityEmployee,
      quarantinedQuantity: '0',
      temporaryContainment,
      complaintExpectedVersion: 3,
      evidence: { reference: 'E-NCR' },
      idempotencyKey: commandKey(),
    });
  const ncrRow = async (complaintId: string) =>
    (
      await db.query<{ temporary_containment: string }>(
        'SELECT temporary_containment FROM nonconformance_reports WHERE complaint_id=$1',
        [complaintId],
      )
    ).rows[0];

  const createPlan = (code: string, lowerLimit: unknown, upperLimit: unknown) =>
    quality.request('/api/v1/quality-plans', 'POST', {
      code,
      name: '规格上下限留空的检验计划',
      itemVersionId,
      inspectionStage: 'INCOMING',
      samplingMethod: '全检',
      acceptanceRule: { description: '全部必检项通过' },
      effectiveAt: '2026-01-01T00:00:00.000Z',
      characteristics: [
        {
          code: 'LENGTH',
          name: '长度',
          dataType: 'NUMERIC',
          lowerLimit,
          upperLimit,
          required: true,
          instructions: '',
        },
      ],
      publish: true,
    });
  const sampledInspection = async (number: string, planVersionId: string) => {
    const id = await createdId(
      await quality.request('/api/v1/quality-inspections', 'POST', {
        inspectionNumber: number,
        planVersionId,
        lotId,
        sourceType: 'PRODUCTION_ROLL',
        // 来源业务编号无外键；同一计划与批次开第二张检验单时不能撞唯一键 (source_type, source_id, 计划版本, 批次)。
        sourceId: randomUUID(),
        sampleSize: '1',
      }),
    );
    const sampled = await quality.request(`/api/v1/quality-inspections/${id}/sample`, 'POST', {
      reason: '抽样',
      evidence: { reference: 'E-SAMPLE' },
      idempotencyKey: commandKey(),
    });
    expect(sampled.status).toBe(201);
    const characteristic = (
      await db.query<{ id: string }>(
        'SELECT id FROM quality_plan_characteristics WHERE inspection_plan_version_id=$1',
        [planVersionId],
      )
    ).rows[0];
    if (!characteristic) throw new Error('Fixture characteristic missing');
    return { id, characteristicId: characteristic.id };
  };
  const recordResult = (inspection: { id: string; characteristicId: string }, notes: unknown) =>
    quality.request(`/api/v1/quality-inspections/${inspection.id}/results`, 'POST', {
      characteristicId: inspection.characteristicId,
      measuredNumeric: '10',
      passed: true,
      notes,
      occurredAt: '2026-01-02T00:00:00.000Z',
      idempotencyKey: commandKey(),
    });
  const notesRow = async (inspectionId: string) =>
    (
      await db.query<{ notes: string }>(
        'SELECT notes FROM quality_inspection_results WHERE inspection_id=$1',
        [inspectionId],
      )
    ).rows[0];

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
      `INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES
       ($1,$2,$3,'REGISTRAR','Registrar','registrar@opsguard.test'),($4,$2,$3,'QUALITY','Quality','quality@opsguard.test')`,
      [registrarEmployee, company, team, qualityEmployee],
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
    const item = await new PostgresManufacturingRepository(db).createItem(
      {
        sku: 'OPSGUARD-RAW',
        name: 'Ops guard material',
        itemType: 'RAW_MATERIAL',
        baseUnitCode: 'M',
        specification: {},
        effectiveAt: '2026-01-01T00:00:00Z',
        publish: true,
      },
      {
        actor: { companyId: company, employeeId: qualityEmployee },
        scopes: ['COMPANY'],
        anchors: [],
      },
      randomUUID(),
    );
    if (typeof item.id !== 'string') throw new Error('Fixture item missing');
    itemVersionId = item.id;
    const lot = (
      await db.query<{ id: string }>(
        "INSERT INTO inventory_lots(tenant_id,lot_number,item_version_id,quality_status) VALUES($1,'OPSGUARD-LOT',$2,'QUARANTINE') RETURNING id",
        [company, itemVersionId],
      )
    ).rows[0];
    if (!lot) throw new Error('Fixture lot missing');
    lotId = lot.id;
    http = await ownedHttpApi({ db, schema });
    registrar = await http.user(registrarEmployee, company);
    await registrar.grant(
      ['complaint:create', 'complaint:read', 'complaint:triage', 'complaint:assign'],
      ['COMPANY'],
    );
    quality = await http.user(qualityEmployee, company);
    await quality.grant(
      [
        'quality-plan:manage',
        'quality-plan:read',
        'quality:inspect',
        'quality:read',
        'ncr:manage',
        'ncr:read',
      ],
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

  it('TD-OPS-006: blank specification limits are stored as NULL exactly like omitted limits', async () => {
    // numeric(24,6) 的落库值由驱动按 6 位小数返回。
    const variants: readonly (readonly [unknown, unknown, string | null, string | null])[] = [
      ['', '', null, null],
      [null, null, null, null],
      ['  ', ' ', null, null],
      ['', '12', null, '12.000000'],
      ['10', '', '10.000000', null],
    ];
    for (const [index, [lowerLimit, upperLimit, lower, upper]] of variants.entries()) {
      const before = await counts();
      const planVersionId = await createdId(
        await createPlan(`QP-OPSGUARD-${String(index + 1)}`, lowerLimit, upperLimit),
      );
      expect(await limitRow(planVersionId)).toEqual({
        lower_limit: lower,
        upper_limit: upper,
      });
      expect((await counts()).characteristics).toBe(before.characteristics + 1);
    }
  }, 20_000);

  it('TD-OPS-006: non-string limit values keep their original rejection', async () => {
    const before = await counts();
    for (const [value, message] of [
      [0, 'lowerLimit is required'],
      [false, 'lowerLimit is required'],
      [[], 'lowerLimit is required'],
      [{}, 'lowerLimit is required'],
      ['NaN', 'Invalid decimal'],
    ] as const) {
      const reply = await createPlan('QP-OPSGUARD-BAD', value, '');
      expect(reply.status).toBe(400);
      expect((await error(reply)).error.message).toBe(message);
    }
    expect(await counts()).toEqual(before);
  }, 20_000);

  it('TD-OPS-006: blank result notes are stored as an empty string', async () => {
    const planVersionId = await createdId(await createPlan('QP-OPSGUARD-RESULT', '', ''));
    expect(await limitRow(planVersionId)).toEqual({ lower_limit: null, upper_limit: null });
    for (const [index, notes] of ['', '   '].entries()) {
      const inspection = await sampledInspection(
        `INSPECTION-OPSGUARD-${String(index + 1)}`,
        planVersionId,
      );
      const before = await counts();
      expect((await recordResult(inspection, notes)).status).toBe(201);
      expect(await notesRow(inspection.id)).toEqual({ notes: '' });
      expect((await counts()).results).toBe(before.results + 1);
    }
  }, 20_000);

  it('TD-OPS-006: non-string result notes keep their original rejection', async () => {
    const planVersionId = await createdId(await createPlan('QP-OPSGUARD-NOTES-BAD', '10', '12'));
    const inspection = await sampledInspection('INSPECTION-OPSGUARD-NOTES-BAD', planVersionId);
    const before = await counts();
    for (const value of [undefined, null, 3, false, {}]) {
      const reply = await recordResult(inspection, value);
      expect(reply.status).toBe(400);
      expect((await error(reply)).error.message).toBe('notes is required');
    }
    expect(await counts()).toEqual(before);
  }, 20_000);

  it('TD-OPS-006: a blank temporary containment note is stored as an empty string', async () => {
    for (const [index, containment] of ['', '  '].entries()) {
      const complaintId = await complaintToInvestigating(`CMP-OPSGUARD-NCR-${String(index + 1)}`);
      const before = await counts();
      expect(
        (await createNcr(complaintId, `NCR-OPSGUARD-${String(index + 1)}`, containment)).status,
      ).toBe(201);
      expect(await ncrRow(complaintId)).toEqual({ temporary_containment: '' });
      expect((await counts()).ncrs).toBe(before.ncrs + 1);
    }
  }, 20_000);

  it('TD-OPS-006: non-string temporary containment values keep their original rejection', async () => {
    const complaintId = await complaintToInvestigating('CMP-OPSGUARD-NCR-BAD');
    const before = await counts();
    for (const value of [undefined, null, 3, false, {}]) {
      const reply = await createNcr(complaintId, 'NCR-OPSGUARD-BAD', value);
      expect(reply.status).toBe(400);
      expect((await error(reply)).error.message).toBe('temporaryContainment is required');
    }
    expect(await counts()).toEqual(before);
  }, 20_000);
});
