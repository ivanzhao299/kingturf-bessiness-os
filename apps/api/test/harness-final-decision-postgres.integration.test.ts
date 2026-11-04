import { randomBytes, randomUUID } from 'node:crypto';
import { Database } from '@kingturf/database';
import type { AuthorizationContext } from '@kingturf/domain';
import { expect, it } from 'vitest';
import { buildApp, type ApiDependencies } from '../src/app.js';
import { PostgresCommercialRepository } from '../src/commercial-repositories.js';
import { PostgresComplaintRepository } from '../src/complaint-repositories.js';
import { PostgresNotificationRepository } from '../src/notification-repositories.js';
import { employeeScopedPredicate, recordScopeSql } from '../src/scope-sql.js';
import { AuthenticationService, PasswordHasher } from '../src/security.js';
import { PostgresSecurityStore } from '../src/repositories.js';
import { ownedPostgres } from './fixtures/owned-postgres.js';

// Historical boundary probes and approved local scope regressions use guarded PostgreSQL.
// Older API probes inject context; the SEC008 login case uses real ephemeral credentials/session.
type Owned = Awaited<ReturnType<typeof ownedPostgres>>;
async function withOwned(run: (owned: Owned) => Promise<void>) {
  const owned = await ownedPostgres('final_decision_pg');
  const connection = process.env.DATABASE_URL;
  if (!connection) throw new Error('Guarded database connection required');
  const inspector = new Database(connection);
  try {
    await run(owned);
  } finally {
    try {
      await owned.close();
      const remaining = await inspector.query<{ remains: boolean }>(
        'SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname=$1) remains',
        [owned.schema],
      );
      expect(remaining.rows[0]?.remains).toBe(false);
    } finally {
      await inspector.close();
    }
  }
}

function api(owned: Owned) {
  const authorization: AuthorizationContext = {
    actor: owned.context.actor,
    permissions: new Map([
      ['cost-matrix:manage', { scopes: ['COMPANY'], fields: null }],
      ['cost-matrix:read', { scopes: ['COMPANY'], fields: null }],
      ['complaint:triage', { scopes: ['COMPANY'], fields: null }],
      ['complaint:assign', { scopes: ['COMPANY'], fields: null }],
    ]),
  };
  const app = buildApp({
    auth: {
      authenticate: () => Promise.resolve(authorization),
    } as unknown as ApiDependencies['auth'],
    employees: {} as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
    commercial: new PostgresCommercialRepository(owned.db),
    complaints: new PostgresComplaintRepository(owned.db),
  });
  return (pathname: string, body: Record<string, unknown>, method = 'POST') =>
    app.dispatch({
      method,
      pathname,
      body,
      headers: {
        authorization: 'Bearer fixed-non-secret-characterization',
        'content-type': 'application/json',
        'x-correlation-id': randomUUID(),
        'idempotency-key': randomUUID(),
      },
    });
}

async function complaintFixture(owned: Owned) {
  const customer = randomUUID(),
    policy = randomUUID();
  const complaint = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const hash = 'a'.repeat(64);
  await owned.db.query(
    `INSERT INTO customers(id,tenant_id,customer_number,name,normalized_name,status,owner_id,owner_organization_id,created_by,updated_by)
     VALUES($1,$2,'FINAL-CUSTOMER','Synthetic customer','synthetic customer','ACTIVE',$3,$4,$3,$3)`,
    [customer, owned.company, owned.employee, owned.team],
  );
  await owned.db.query(
    `INSERT INTO complaint_sla_policy_versions(id,tenant_id,policy_code,version,severity,response_hours,containment_hours,root_cause_hours,closure_hours,effective_at,published_at,canonical_hash,created_by)
     VALUES($1,$2,'FINAL-MAJOR',1,'MAJOR',4,8,72,240,'2026-01-01','2026-01-01',$3,$4)`,
    [policy, owned.company, hash, owned.employee],
  );
  await owned.db.query(
    `INSERT INTO customer_complaints(id,tenant_id,complaint_number,customer_id,sla_policy_version_id,channel,defect_category,severity,occurred_at,reported_at,description,customer_request,initial_snapshot,response_due_at,containment_due_at,root_cause_due_at,closure_due_at,reported_by,correlation_id,idempotency_key,canonical_hash)
     VALUES($1,$2,'FINAL-COMPLAINT',$3,$4,'CUSTOMER_SERVICE','PILE_HEIGHT','MAJOR','2026-08-01','2026-08-02','Synthetic complaint description','Investigate synthetic complaint','{"source":"synthetic-final-decision"}','2026-08-02 04:00Z','2026-08-02 08:00Z','2026-08-05','2026-08-12',$5,$6,'final-complaint-create',$7)`,
    [complaint, owned.company, customer, policy, owned.employee, randomUUID(), hash],
  );
  await owned.db.query(
    `INSERT INTO customer_complaint_events(tenant_id,complaint_id,sequence,state,reason,evidence,actor_id,expected_version,correlation_id,idempotency_key,canonical_hash)
     VALUES($1,$2,1,'REPORTED','Synthetic initial state','{}',$3,0,$4,'final-complaint-initial',$5)`,
    [owned.company, complaint, owned.employee, randomUUID(), hash],
  );
  return complaint;
}

it('BOUND003: real API forwards invalid date but PG rejects insert/update without storing it', async () => {
  await withOwned(async (owned) => {
    const repo = new PostgresCommercialRepository(owned.db);
    const model = await repo.createCostMatrix(
      {
        code: 'FINAL-DATE',
        name: 'Synthetic date matrix',
        productSpecification: { costBasis: 'M2' },
        currency: 'CNY',
        defaultTaxRate: '0.13',
      },
      owned.context.actor,
      ['COMPANY'],
      randomUUID(),
    );
    if (typeof model.id !== 'string') throw new Error('Synthetic matrix identifier required');
    const dispatch = api(owned);
    const body = {
      factorCode: 'VALID',
      factorName: 'Synthetic yarn',
      category: 'DIRECT_MATERIAL',
      sourceType: 'MANUAL',
      quantity: '1',
      unitCode: 'KG',
      manualUnitPriceTaxInclusive: '8.6',
      taxRate: '0.13',
      priceSourceName: 'Synthetic source',
      priceEffectiveAt: '2026-02-28',
      adjustable: true,
      sortOrder: 1,
    };
    const path = `/api/v1/cost-matrices/${model.id}/factors`;
    expect((await dispatch(path, body)).statusCode).toBe(201);
    const factor = (
      await owned.db.query<{ id: string }>(
        'SELECT id FROM cost_specification_factors WHERE tenant_id=$1 AND factor_code=$2',
        [owned.company, 'VALID'],
      )
    ).rows[0];
    if (!factor) throw new Error('Synthetic valid factor required');
    expect(
      (await dispatch(path, { ...body, factorCode: 'INVALID', priceEffectiveAt: '2026-02-30' }))
        .statusCode,
    ).toBe(500);
    const { factorCode: ignored, ...patch } = body;
    expect(ignored).toBe('VALID');
    expect(
      (
        await dispatch(
          `${path}/${factor.id}`,
          { ...patch, priceEffectiveAt: '2026-02-30' },
          'PATCH',
        )
      ).statusCode,
    ).toBe(500);
    await expect(
      repo.addCostMatrixFactor(
        model.id,
        { ...body, factorCode: 'DIRECT-INVALID', priceEffectiveAt: '2026-02-30' },
        owned.context.actor,
        ['COMPANY'],
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: '22008' });
    const rows = await owned.db.query<{ factor_code: string; effective: string }>(
      'SELECT factor_code,price_effective_at::text effective FROM cost_specification_factors WHERE tenant_id=$1 ORDER BY factor_code',
      [owned.company],
    );
    expect(rows.rows).toEqual([{ factor_code: 'VALID', effective: '2026-02-28' }]);
    const audit = await owned.db.query<{ n: number }>(
      "SELECT count(*)::int n FROM audit_events WHERE organization_id=$1 AND action='cost-matrix.factor-added'",
      [owned.company],
    );
    expect(audit.rows[0]?.n).toBe(1);
  });
}, 20000);

it('BOUND004: UUID case aliases partly commit once and preserve raw-case batch replay identity', async () => {
  await withOwned(async (owned) => {
    const id = await complaintFixture(owned);
    const dispatch = api(owned);
    const items = [id, id.toUpperCase()].map((value) => ({
      id: value,
      expectedVersion: 1,
      assignedTo: owned.employee,
      reason: 'Synthetic case-alias triage',
    }));
    const path = '/api/v1/complaints/batch-triage';
    const body = { batchKey: 'FINAL-CASE-BATCH', items };
    const first = await dispatch(path, body);
    expect(first.statusCode).toBe(200);
    expect(first.body).toMatchObject({
      requested: 2,
      succeeded: 1,
      rejected: 1,
      failed: 0,
      items: [
        { id, status: 'SUCCEEDED' },
        { id: id.toUpperCase(), status: 'REJECTED', code: 'conflict' },
      ],
    });
    expect((await dispatch(path, body)).body).toEqual(first.body);
    expect(
      (
        await dispatch(path, {
          ...body,
          items: items.map((item) => ({ ...item, id: item.id.toUpperCase() })),
        })
      ).statusCode,
    ).toBe(400);
    expect((await dispatch(path, { ...body, items: [...items].reverse() })).statusCode).toBe(409);
    const state = await owned.db.query<{ state: string; sequence: number }>(
      'SELECT state,sequence FROM customer_complaint_effective_states WHERE tenant_id=$1 AND complaint_id=$2',
      [owned.company, id],
    );
    expect(state.rows).toEqual([{ state: 'TRIAGED', sequence: 2 }]);
    const events = await owned.db.query<{ n: number; caseKey: boolean }>(
      `SELECT count(*)::int n,bool_or(idempotency_key=$3) "caseKey" FROM customer_complaint_events WHERE tenant_id=$1 AND complaint_id=$2`,
      [owned.company, id, `FINAL-CASE-BATCH:${id}:triage`],
    );
    expect(events.rows).toEqual([{ n: 2, caseKey: true }]);
    const audit = await owned.db.query<{ action: string; n: number }>(
      "SELECT action,count(*)::int n FROM audit_events WHERE organization_id=$1 AND action IN('complaint.triaged','complaint.batch-triaged') GROUP BY action ORDER BY action",
      [owned.company],
    );
    expect(audit.rows).toEqual([
      { action: 'complaint.batch-triaged', n: 1 },
      { action: 'complaint.triaged', n: 1 },
    ]);
    expect(
      (
        await owned.db.query<{ n: number }>(
          'SELECT count(*)::int n FROM complaint_batch_commands WHERE tenant_id=$1',
          [owned.company],
        )
      ).rows[0]?.n,
    ).toBe(1);
  });
}, 20000);

it('SEC008: real complaint scope queries validate organization anchors without changing broad grants', async () => {
  await withOwned(async (owned) => {
    const id = await complaintFixture(owned);
    const complaints = new PostgresComplaintRepository(owned.db);
    const department = randomUUID(),
      region = randomUUID();
    await owned.db.query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$2,'SCOPE-DEPT','Scope department','DEPARTMENT'),($3,$2,'SCOPE-REGION','Scope region','REGION')",
      [department, owned.company, region],
    );
    await owned.db.query('UPDATE organizations SET parent_id=$1 WHERE id=$2', [region, department]);
    await owned.db.query('UPDATE organizations SET parent_id=$1 WHERE id=$2', [
      department,
      owned.team,
    ]);
    const expectVisible = async (
      context: Parameters<typeof complaints.list>[1],
      visible: boolean,
    ) => {
      expect((await complaints.list({}, context)).items).toHaveLength(visible ? 1 : 0);
      if (visible) expect(await complaints.getById(id, context)).toMatchObject({ id });
      else
        await expect(complaints.getById(id, context)).rejects.toMatchObject({ code: 'not_found' });
    };
    for (const scopes of [['SELF'], ['COMPANY'], ['GROUP']] as const)
      await expectVisible({ ...owned.context, scopes }, true);
    for (const [scope, organizationId] of [
      ['TEAM', owned.team],
      ['DEPARTMENT', department],
      ['REGION', region],
    ] as const) {
      const context = { ...owned.context, scopes: [scope], anchors: [{ scope, organizationId }] };
      await expectVisible(context, true);
      await expectVisible({ ...context, anchors: [] }, false);
      await expectVisible({ ...context, scopes: [] }, false);
      await expectVisible(
        { ...context, anchors: [{ scope, organizationId: owned.otherTeam }] },
        false,
      );
      await owned.db.query('UPDATE organizations SET active=false WHERE id=$1', [organizationId]);
      await expectVisible(context, false);
      await expectVisible({ ...context, scopes: ['COMPANY', scope] }, true);
      await owned.db.query('UPDATE organizations SET active=true,deleted_at=now() WHERE id=$1', [
        organizationId,
      ]);
      await expectVisible(context, false);
      await owned.db.query('UPDATE organizations SET deleted_at=NULL WHERE id=$1', [
        organizationId,
      ]);
    }
    await expectVisible(
      {
        ...owned.context,
        scopes: ['DEPARTMENT'],
        anchors: [{ scope: 'DEPARTMENT', organizationId: owned.team }],
      },
      false,
    );
    await expectVisible(
      {
        ...owned.context,
        scopes: ['SELF'],
        actor: { ...owned.context.actor, employeeId: owned.otherEmployee },
      },
      false,
    );
    await expectVisible(owned.otherContext, false);
  });
}, 20000);

it('SEC007: active actor in inactive organization differs at real notification repository predicate layer', async () => {
  await withOwned(async (owned) => {
    const department = randomUUID(),
      recipient = randomUUID();
    await owned.db.query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$2,'FINAL-DEPT','Synthetic department','DEPARTMENT')",
      [department, owned.company],
    );
    await owned.db.query(
      "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'FINAL-RECIPIENT','Synthetic recipient','recipient@owned.test')",
      [recipient, owned.company, department],
    );
    const anchors = [{ scope: 'DEPARTMENT' as const, organizationId: department }];
    const count = async (validation: 'skip' | 'validate') => {
      const scoped = employeeScopedPredicate([], owned.employee, owned.company, anchors, 3, {
        actorOrganizationValidation: validation,
      });
      return (
        await owned.db.query<{ n: number }>(
          `SELECT count(*)::int n FROM employees e WHERE e.company_id=$1 AND e.id=ANY($2::uuid[]) AND e.active AND e.deleted_at IS NULL AND ${scoped.predicate}`,
          [owned.company, [recipient], ...scoped.values],
        )
      ).rows[0]?.n;
    };
    expect([await count('skip'), await count('validate')]).toEqual([1, 1]);
    await owned.db.query('UPDATE organizations SET active=false WHERE id=$1', [owned.team]);
    expect([await count('skip'), await count('validate')]).toEqual([1, 0]);
    const notification = await new PostgresNotificationRepository(owned.db).create(
      {
        kind: 'FINAL-SYNTHETIC',
        title: 'Synthetic notification',
        message: 'Predicate-layer characterization only',
        recipients: [recipient],
        idempotencyKey: 'final-scope-notification',
      },
      owned.context.actor,
      randomUUID(),
      [],
      anchors,
    );
    expect(notification).toHaveProperty('id');
    await owned.db.query('UPDATE employees SET active=false WHERE id=$1', [owned.employee]);
    expect([await count('skip'), await count('validate')]).toEqual([0, 0]);
    await owned.db.query('UPDATE employees SET active=true WHERE id=$1', [owned.employee]);
    await owned.db.query('UPDATE organizations SET active=true WHERE id=$1', [owned.team]);
    expect([await count('skip'), await count('validate')]).toEqual([1, 1]);
  });
}, 20000);

it('SEC008: real login resolves TEAM anchors, filters fields and rejects revoked access', async () => {
  await withOwned(async (owned) => {
    const id = await complaintFixture(owned),
      identity = randomUUID(),
      role = randomUUID();
    const hasher = new PasswordHasher({
      saltBytes: 16,
      keyLength: 32,
      cost: 16384,
      blockSize: 8,
      parallelization: 1,
    });
    const password = randomBytes(24).toString('base64url');
    const passwordHash = await hasher.hash(password);
    await owned.db.query(
      "INSERT INTO identities(id,employee_id,login_name) VALUES($1,$2,'local-scope-login')",
      [identity, owned.employee],
    );
    await owned.db.query(
      "INSERT INTO password_credentials(identity_id,algorithm,password_hash) VALUES($1,'scrypt',$2)",
      [identity, passwordHash],
    );
    await owned.db.query(
      'INSERT INTO organization_memberships(employee_id,organization_id) VALUES($1,$2)',
      [owned.employee, owned.company],
    );
    await owned.db.query(
      "INSERT INTO roles(id,organization_id,code,name) VALUES($1,$2,'LOCAL-SCOPE','Local scope')",
      [role, owned.company],
    );
    await owned.db.query(
      'INSERT INTO employee_role_assignments(employee_id,role_id) VALUES($1,$2)',
      [owned.employee, role],
    );
    await owned.db.query(
      "INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes) SELECT $1,id,ARRAY['id'],ARRAY['TEAM']::data_scope[] FROM permissions WHERE capability='complaint:read'",
      [role],
    );
    await owned.db.query(
      "INSERT INTO data_scope_grants(employee_id,permission_id,scope,scope_organization_id) SELECT $1,id,'TEAM',$2 FROM permissions WHERE capability='complaint:read'",
      [owned.employee, owned.team],
    );
    const store = new PostgresSecurityStore(owned.db);
    const auth = new AuthenticationService(
      store,
      hasher,
      { secret: randomBytes(32).toString('hex'), ttlSeconds: 3600 },
      store,
    );
    const session = await auth.login('local-scope-login', password, randomUUID());
    if (!session) throw new Error('Synthetic scope login failed');
    const app = buildApp({
      auth,
      employees: {} as ApiDependencies['employees'],
      organizations: {} as ApiDependencies['organizations'],
      complaints: new PostgresComplaintRepository(owned.db),
    });
    const get = (pathname: string) =>
      app.dispatch({
        method: 'GET',
        pathname,
        headers: { authorization: `Bearer ${session.token}` },
      });
    expect((await get('/api/v1/complaints')).body).toEqual({ items: [{ id }], nextCursor: null });
    expect((await get(`/api/v1/complaints/${randomUUID()}`)).statusCode).toBe(404);
    await owned.db.query('DELETE FROM data_scope_grants WHERE employee_id=$1', [owned.employee]);
    expect((await get('/api/v1/complaints')).body).toEqual({ items: [], nextCursor: null });
    await owned.db.query('DELETE FROM role_permission_grants WHERE role_id=$1', [role]);
    expect((await get('/api/v1/complaints')).statusCode).toBe(403);
    await owned.db.query('UPDATE organizations SET active=false WHERE id=$1', [owned.team]);
    expect((await get('/api/v1/complaints')).statusCode).toBe(401);
  });
}, 20000);

it('SEC008: preserves deep TEAM compatibility and guards complaint writes on real PostgreSQL', async () => {
  await withOwned(async (owned) => {
    const id = await complaintFixture(owned),
      top = randomUUID(),
      middle = randomUUID();
    await owned.db.query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$2,'DEEP-TOP','Deep top','TEAM'),($3,$2,'DEEP-MID','Deep middle','TEAM')",
      [top, owned.company, middle],
    );
    await owned.db.query('UPDATE organizations SET parent_id=$1 WHERE id=$2', [top, middle]);
    await owned.db.query('UPDATE organizations SET parent_id=$1 WHERE id=$2', [middle, owned.team]);
    const context = {
      ...owned.context,
      scopes: ['TEAM'] as const,
      anchors: [{ scope: 'TEAM' as const, organizationId: top }],
    };
    const complaints = new PostgresComplaintRepository(owned.db);
    expect(await complaints.getById(id, context)).toMatchObject({ id });
    const strict = recordScopeSql(context.scopes, context.anchors, context.actor, 'cu', 2);
    const strictRows = await owned.db.query(
      `SELECT cu.id FROM customers cu WHERE cu.tenant_id=$1 AND ${strict.sql}`,
      [owned.company, ...strict.values],
    );
    expect(strictRows.rows).toEqual([]);
    const basis = (
      await owned.db.query<{ customer_id: string; sla_policy_version_id: string }>(
        'SELECT customer_id,sla_policy_version_id FROM customer_complaints WHERE id=$1',
        [id],
      )
    ).rows[0];
    if (!basis) throw new Error('Complaint basis missing');
    const input = {
      complaintNumber: 'LOCAL-CREATE',
      customerId: basis.customer_id,
      slaPolicyVersionId: basis.sla_policy_version_id,
      channel: 'EMAIL' as const,
      defectCategory: 'PILE_HEIGHT',
      severity: 'MAJOR' as const,
      occurredAt: '2026-08-01T00:00:00Z',
      reportedAt: '2026-08-02T00:00:00Z',
      description: 'Synthetic authorized complaint',
      customerRequest: 'Investigate',
      initialSnapshot: { source: 'local-test' },
      idempotencyKey: randomUUID(),
    };
    const created = await complaints.createComplaint(input, context, randomUUID());
    if (typeof created.id !== 'string') throw new Error('Created complaint ID missing');
    expect(await complaints.getById(created.id, context)).toMatchObject({ id: created.id });
    const before = (await owned.db.query('SELECT count(*)::int n FROM customer_complaints')).rows;
    const correlation = randomUUID();
    await expect(
      complaints.createComplaint(
        { ...input, complaintNumber: 'DENIED', idempotencyKey: randomUUID() },
        { ...context, anchors: [{ scope: 'TEAM', organizationId: owned.otherTeam }] },
        correlation,
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect((await owned.db.query('SELECT count(*)::int n FROM customer_complaints')).rows).toEqual(
      before,
    );
    expect(
      (
        await owned.db.query('SELECT count(*)::int n FROM audit_events WHERE correlation_id=$1', [
          correlation,
        ])
      ).rows,
    ).toEqual([{ n: 0 }]);
  });
}, 20000);
