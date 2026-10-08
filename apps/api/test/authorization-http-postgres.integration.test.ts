import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertTestDatabaseTarget, Database, migrate } from '@kingturf/database';
import type { DataScope, PermissionKey } from '@kingturf/types';
import { hashSessionToken } from '../src/security.js';
import { releasedOrderFixture } from './fixtures/released-order-http.js';

const connection = process.env.DATABASE_URL;
if (!connection)
  throw new Error('DATABASE_URL required; real HTTP authorization tests may not be skipped');
assertTestDatabaseTarget(connection, process.env.NODE_ENV);
type User = { employeeId: string; roleId: string; token: string };
type Grant = { scopes: readonly DataScope[]; fields: readonly string[] | null; anchor?: string };
const companyGrant: Grant = { scopes: ['COMPANY'], fields: null };
const selfGrant: Grant = { scopes: ['SELF'], fields: null };

describe('real HTTP source scopes and nested legal authorization', () => {
  const schema = `authz_http_${randomUUID().replaceAll('-', '')}`;
  const company = randomUUID(),
    otherCompany = randomUUID(),
    teamA = randomUUID(),
    teamB = randomUUID(),
    otherTeam = randomUUID();
  const secret = randomBytes(32).toString('hex');
  let admin: Database, db: Database, origin: string;
  let child: ChildProcess | undefined;
  let owner: User, builder: User, reviewer: User, outsider: User;
  let graph: Awaited<ReturnType<typeof releasedOrderFixture>>;
  const cleanup: (() => Promise<unknown>)[] = [];
  const logs: string[] = [];
  const uiEvidence: Record<string, unknown> = {};

  async function user(tenant: string, team: string): Promise<User> {
    const employeeId = randomUUID(),
      identityId = randomUUID(),
      roleId = randomUUID();
    await db.query(
      'INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,$1::uuid::text,$1::uuid::text,$4)',
      [employeeId, tenant, team, `${employeeId}@example.test`],
    );
    await db.query(
      'INSERT INTO identities(id,employee_id,login_name) VALUES($1,$2,$2::uuid::text)',
      [identityId, employeeId],
    );
    await db.query(
      'INSERT INTO organization_memberships(employee_id,organization_id) VALUES($1,$2)',
      [employeeId, tenant],
    );
    await db.query(
      "INSERT INTO roles(id,organization_id,code,name) VALUES($1,$2,$1::uuid::text,'Synthetic authorization role')",
      [roleId, tenant],
    );
    await db.query('INSERT INTO employee_role_assignments(employee_id,role_id) VALUES($1,$2)', [
      employeeId,
      roleId,
    ]);
    const token = randomBytes(32).toString('base64url');
    await db.query(
      "INSERT INTO sessions(identity_id,organization_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
      [identityId, tenant, hashSessionToken(token, secret)],
    );
    return { employeeId, roleId, token };
  }
  async function grants(actor: User, items: Partial<Record<PermissionKey, Grant>>): Promise<void> {
    await db.query('DELETE FROM data_scope_grants WHERE employee_id=$1', [actor.employeeId]);
    await db.query('DELETE FROM role_permission_grants WHERE role_id=$1', [actor.roleId]);
    for (const [capability, grant] of Object.entries(items)) {
      if (!grant) continue;
      const inserted = await db.query(
        'INSERT INTO role_permission_grants(role_id,permission_id,data_scopes,field_allowlist) SELECT $1,id,$3::data_scope[],$4 FROM permissions WHERE capability=$2',
        [actor.roleId, capability, grant.scopes, grant.fields],
      );
      expect(inserted.rowCount).toBe(1);
      if (grant.anchor)
        await db.query(
          "INSERT INTO data_scope_grants(employee_id,permission_id,scope,scope_organization_id) SELECT $1,id,'TEAM',$3 FROM permissions WHERE capability=$2",
          [actor.employeeId, capability, grant.anchor],
        );
    }
  }
  async function full(actor: User): Promise<void> {
    await db.query(
      "INSERT INTO role_permission_grants(role_id,permission_id,data_scopes) SELECT $1,id,ARRAY['COMPANY']::data_scope[] FROM permissions",
      [actor.roleId],
    );
  }
  async function response(
    path: string,
    token: string,
    body?: Record<string, unknown>,
  ): Promise<Response> {
    return fetch(`${origin}/api/v1${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-correlation-id': randomUUID(),
        ...(body ? { 'idempotency-key': randomUUID() } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10_000),
    });
  }
  async function setupRequest(
    path: string,
    token: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const result = await response(path, token, body);
    const payload = (await result.json()) as Record<string, unknown>;
    if (!result.ok)
      throw new Error(
        `Synthetic fixture ${path}: ${String(result.status)} ${JSON.stringify(payload.error)}`,
      );
    return payload;
  }
  async function aggregate(actor: User): Promise<Record<string, unknown>> {
    const result = await response(`/sales-orders/${graph.orderId}/360`, actor.token);
    expect(result.status).toBe(200);
    return result.json() as Promise<Record<string, unknown>>;
  }
  const entry = { 'order-360:read': companyGrant, 'sales-order:read': companyGrant };

  beforeAll(async () => {
    admin = new Database(connection);
    cleanup.push(() => admin.close());
    await admin.query(`CREATE SCHEMA ${schema}`);
    cleanup.push(() => admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`));
    const target = new URL(connection);
    target.searchParams.set('options', `-csearch_path=${schema}`);
    db = new Database(target.toString());
    cleanup.push(() => db.close());
    await migrate(db);
    // Migrate into the owned schema first; expose only the existing pgcrypto extension afterward.
    target.searchParams.set('options', `-csearch_path=${schema},public`);
    await db.query(
      "INSERT INTO organizations(id,code,name,organization_type) VALUES($1,'AUTH-A','A','COMPANY'),($2,'AUTH-B','B','COMPANY')",
      [company, otherCompany],
    );
    await db.query(
      "INSERT INTO organizations(id,owner_organization_id,parent_id,code,name,organization_type) VALUES($1,$4,$4,'TEAM-A','A','TEAM'),($2,$4,$4,'TEAM-B','B','TEAM'),($3,$5,$5,'OTHER','Other','TEAM')",
      [teamA, teamB, otherTeam, company, otherCompany],
    );
    owner = await user(company, teamA);
    builder = await user(company, teamB);
    reviewer = await user(company, teamB);
    outsider = await user(otherCompany, otherTeam);
    await full(builder);
    await full(reviewer);
    await full(outsider);
    const socket = createServer();
    await new Promise<void>((resolve) => {
      socket.listen(0, '127.0.0.1', resolve);
    });
    const address = socket.address();
    if (!address || typeof address === 'string') throw new Error('Local API port unavailable');
    await new Promise<void>((resolve, reject) => {
      socket.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    origin = `http://127.0.0.1:${String(address.port)}`;
    const processChild = spawn(
      process.execPath,
      ['--experimental-transform-types', 'apps/api/src/server.ts'],
      {
        cwd: fileURLToPath(new URL('../../../', import.meta.url)),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          DATABASE_URL: target.toString(),
          SESSION_SECRET: secret,
          SESSION_TTL_SECONDS: '3600',
          API_HOST: '127.0.0.1',
          API_PORT: String(address.port),
          PASSWORD_SALT_BYTES: '16',
          PASSWORD_KEY_LENGTH: '32',
          PASSWORD_SCRYPT_COST: '16384',
          PASSWORD_SCRYPT_BLOCK_SIZE: '8',
          PASSWORD_SCRYPT_PARALLELIZATION: '1',
          ATTACHMENT_STORAGE_ADAPTER: 'local',
          ATTACHMENT_LOCAL_DIRECTORY: `/tmp/${schema}`,
          WEBSITE_LEAD_INGEST_SECRET: '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    child = processChild;
    processChild.stdout.on('data', (chunk: Buffer) => {
      logs.push(chunk.toString());
    });
    processChild.stderr.on('data', (chunk: Buffer) => {
      logs.push(chunk.toString());
    });
    let ready = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error('Isolated authz API exited');
      try {
        ready = (await fetch(`${origin}/ready`, { signal: AbortSignal.timeout(500) })).ok;
      } catch {
        /* startup */
      }
      if (ready) break;
      await delay(20);
    }
    if (!ready) throw new Error('Isolated authz API not ready');
    graph = await releasedOrderFixture(setupRequest, builder.token, reviewer.token);
    await db.query('UPDATE customers SET owner_id=$2,owner_organization_id=$3 WHERE id=$1', [
      graph.customerId,
      owner.employeeId,
      teamA,
    ]);
  }, 30_000);
  afterAll(async () => {
    const stoppedChild = child;
    if (stoppedChild?.exitCode === null && stoppedChild.signalCode === null)
      await new Promise<void>((resolve, reject) => {
        const force = setTimeout(() => {
          stoppedChild.kill('SIGKILL');
        }, 3000);
        const deadline = setTimeout(() => {
          reject(new Error('Authz test process cleanup deadline'));
        }, 6000);
        stoppedChild.once('exit', () => {
          clearTimeout(force);
          clearTimeout(deadline);
          resolve();
        });
        stoppedChild.kill('SIGTERM');
      });
    for (const work of cleanup.reverse()) await work();
    const directory = fileURLToPath(new URL('../../../.test-results/', import.meta.url));
    await mkdir(directory, { recursive: true });
    await writeFile(`${directory}/authz-ui-fixtures.json`, JSON.stringify(uiEvidence));
  });

  it('authorizes company sources and nested legal evidence on a genuinely released order', async () => {
    const result = await aggregate(reviewer);
    uiEvidence.authorized = result;
    uiEvidence.authorizedSession = await (await response('/auth/session', reviewer.token)).json();
    const authorizedCollections = await response('/collection-cases', reviewer.token);
    uiEvidence.authorizedCollections = await authorizedCollections.json();
    expect(result.order).toMatchObject({ order_number: 'AUTH-ORDER' });
    expect(result.opportunity).toMatchObject({ name: 'SENSITIVE-OPPORTUNITY' });
    expect(result.receivables).toHaveLength(1);
    for (const section of ['payments', 'reconciliations', 'commissions', 'risks'])
      expect(result[section]).toHaveLength(1);
    expect(JSON.stringify(result.collections)).toContain('SENSITIVE-PACKAGE');
    expect(
      (result.timeline as { type: string }[]).some((event) =>
        event.type.startsWith('LEGAL_HANDOFF_'),
      ),
    ).toBe(true);
  });
  it('does not substitute COMPANY order scope for SELF customer/AR/opportunity source scopes', async () => {
    await grants(owner, {
      ...entry,
      'customer:read': selfGrant,
      'opportunity:read': selfGrant,
      'ar:read': selfGrant,
      'quote:read': selfGrant,
      'cost:read': selfGrant,
      'technical-solution:read': selfGrant,
      'sales-policy:read': selfGrant,
    });
    const result = await aggregate(owner);
    expect(result.customer).toMatchObject({ id: graph.customerId });
    expect(result.receivables).toHaveLength(1);
    for (const section of ['opportunity', 'quote', 'technical', 'cost', 'policy'])
      expect(result[section]).toBeNull();
    expect(JSON.stringify(result)).not.toContain('SENSITIVE-OPPORTUNITY');
    expect(JSON.stringify(result)).not.toContain('SENSITIVE-TECHNICAL');
    const direct = await response('/opportunities', owner.token);
    expect(direct.status).toBe(200);
    expect(((await direct.json()) as { items: unknown[] }).items).toHaveLength(0);
  });
  it('keeps commercial SELF authorized while customer-derived QTC SELF is denied for another owner', async () => {
    await grants(builder, {
      ...entry,
      'customer:read': selfGrant,
      'opportunity:read': selfGrant,
      'quote:read': selfGrant,
      'ar:read': selfGrant,
      'credit:read': selfGrant,
      'contract:read': selfGrant,
      'bank-payment:read': selfGrant,
      'reconciliation:read': selfGrant,
      'commission:read': selfGrant,
      'risk:read': selfGrant,
    });
    const result = await aggregate(builder);
    expect(result.opportunity).toMatchObject({ id: graph.opportunityId });
    expect(result.customer).toBeNull();
    expect(result.credit).toBeNull();
    expect(result.contract).toBeNull();
    expect(result.receivables).toEqual([]);
    for (const section of ['payments', 'reconciliations', 'commissions', 'risks'])
      expect(result[section]).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('SENSITIVE-AR');
    expect((result.timeline as { type: string }[]).map((event) => event.type)).not.toContain(
      'AR_POSTED',
    );
    expect((result.anomalies as { code: string }[]).map((item) => item.code)).not.toContain(
      'OPEN_AR',
    );
  });
  it('uses each source organization anchor, not the order grant organization', async () => {
    const teamRead: Grant = { scopes: ['TEAM'], fields: null, anchor: teamB };
    await grants(owner, {
      ...entry,
      'customer:read': teamRead,
      'opportunity:read': teamRead,
      'quote:read': teamRead,
      'ar:read': teamRead,
    });
    const result = await aggregate(owner);
    expect(result.customer).toBeNull();
    expect(result.opportunity).toMatchObject({ id: graph.opportunityId });
    expect(result.receivables).toEqual([]);
    const direct = await response('/customers', owner.token);
    expect(direct.status).toBe(200);
    expect(((await direct.json()) as { items: unknown[] }).items).toHaveLength(0);
  });
  it('does not leak legal keys, evidence, manifests or timeline via collection-only read', async () => {
    await grants(owner, { ...entry, 'collection:read': companyGrant });
    const result = await aggregate(owner);
    expect(result.collections).toHaveLength(1);
    const direct = await response('/collection-cases', owner.token);
    expect(direct.status).toBe(200);
    const directPayload = (await direct.json()) as Record<string, unknown>;
    // This is the parent collection lifecycle state, explicitly granted by collection:read.
    // KT-L19 keeps the collector informed of a handoff without granting legal records/evidence.
    expect((result.collections as { state: string }[])[0]?.state).toBe('LEGAL_ACCEPTED');
    expect((directPayload.items as { state: string }[])[0]?.state).toBe('LEGAL_ACCEPTED');
    uiEvidence.denied = result;
    uiEvidence.deniedSession = await (await response('/auth/session', owner.token)).json();
    uiEvidence.deniedCollections = directPayload;
    for (const payload of [result, directPayload]) {
      const raw = JSON.stringify(payload);
      for (const forbidden of [
        'legalHandoffs',
        'SENSITIVE-LEGAL',
        'SENSITIVE-PACKAGE',
        'manifest',
        'DEBT_EVIDENCE_',
        'LEGAL_HANDOFF_',
      ])
        expect(raw.includes(forbidden)).toBe(false);
    }
  });
  it('independent legal read permits nested data only with company scope and own field policy', async () => {
    await grants(owner, {
      ...entry,
      'collection:read': companyGrant,
      'legal-case:read': { scopes: ['COMPANY'], fields: ['state'] },
    });
    const result = await aggregate(owner);
    expect(JSON.stringify(result.collections)).not.toContain('SENSITIVE-LEGAL');
    expect(JSON.stringify(result.collections)).not.toContain('manifest');
    const collections = result.collections as { legalHandoffs: { id: string; state: string }[] }[];
    expect(collections[0]?.legalHandoffs[0]).toMatchObject({
      id: graph.handoffId,
      state: 'ACCEPTED',
    });
    await grants(owner, {
      ...entry,
      'collection:read': companyGrant,
      'legal-case:read': selfGrant,
    });
    const denied = await aggregate(owner);
    expect(JSON.stringify(denied)).not.toContain('legalHandoffs');
    expect(JSON.stringify(denied)).not.toContain('SENSITIVE-LEGAL');
  });
  it('does not treat evidence generation or collection field allowlists as legal read permission', async () => {
    await grants(owner, {
      ...entry,
      'collection:read': { scopes: ['COMPANY'], fields: ['legalHandoffs'] },
      'debt-evidence:generate': companyGrant,
    });
    const result = await aggregate(owner);
    expect(JSON.stringify(result)).not.toContain('legalHandoffs');
    const direct = await response('/collection-cases', owner.token);
    expect(direct.status).toBe(200);
    expect(JSON.stringify(await direct.json())).not.toContain('legalHandoffs');
  });
  it('rejects cross-tenant IDs even with GROUP and never broadens SELF/company-only children', async () => {
    await grants(outsider, {
      ...entry,
      'collection:read': companyGrant,
      'legal-case:read': companyGrant,
      'customer:read': { scopes: ['GROUP'], fields: null },
    });
    const result = await response(`/sales-orders/${graph.orderId}/360`, outsider.token);
    expect(result.status).toBe(404);
    expect(JSON.stringify(await result.json())).not.toContain('AUTH-ORDER');
    const direct = await response('/collection-cases', outsider.token);
    expect(((await direct.json()) as { items: unknown[] }).items).toEqual([]);
    await grants(owner, {
      ...entry,
      'sales-order:read': selfGrant,
      'collection:read': selfGrant,
      'shipment:read': selfGrant,
    });
    const self = await aggregate(owner);
    expect(self.collections).toEqual([]);
    expect(self.shipments).toEqual([]);
    expect((await response('/collection-cases', owner.token)).status).toBe(403);
  });
  it('denies aggregate entry and legal mutation without capabilities and cross-tenant mutation with them', async () => {
    await grants(owner, { 'sales-order:read': companyGrant });
    expect((await response(`/sales-orders/${graph.orderId}/360`, owner.token)).status).toBe(403);
    expect(
      (
        await response(`/legal-handoffs/${graph.handoffId}/accept`, owner.token, {
          reason: 'Denied',
          evidence: {},
          idempotencyKey: 'AUTH-DENIED',
        })
      ).status,
    ).toBe(403);
    await grants(outsider, { 'legal-case:decide': companyGrant });
    expect(
      (
        await response(`/legal-handoffs/${graph.handoffId}/return`, outsider.token, {
          reason: 'Cross tenant',
          evidence: {},
          idempotencyKey: 'AUTH-CROSS-TENANT',
        })
      ).status,
    ).toBe(404);
  });
  it('redacts derived anomaly values and sensitive snapshot content when their fields/sources are not granted', async () => {
    await grants(owner, {
      ...entry,
      'quote:read': { scopes: ['COMPANY'], fields: ['quoteNumber'] },
      'ar:read': { scopes: ['COMPANY'], fields: ['documentNumber'] },
      'credit:read': { scopes: ['COMPANY'], fields: ['id'] },
    });
    const result = await aggregate(owner);
    expect(result.anomalies).toEqual([]);
    expect(JSON.stringify(result.quote)).not.toContain('snapshot');
    expect(JSON.stringify(result)).not.toContain('SENSITIVE-TECHNICAL');
    const events = result.timeline as { type: string; label?: string; occurredAt?: string }[];
    expect(events.find((event) => event.type === 'QUOTE_ISSUED')).toMatchObject({
      label: 'AUTH-QUOTE',
    });
    expect(events.find((event) => event.type === 'QUOTE_ISSUED')).not.toHaveProperty('occurredAt');
  });
  it('never encodes restricted commission/risk/collection state fields in timeline types', async () => {
    await grants(owner, {
      ...entry,
      'commission:read': companyGrant,
      'risk:read': companyGrant,
      'collection:read': companyGrant,
    });
    const before = await aggregate(owner);
    const types = (before.timeline as { type: string }[]).map((event) => event.type);
    expect(types.some((type) => type.startsWith('COMMISSION_'))).toBe(true);
    expect(types.some((type) => type.startsWith('COLLECTION_'))).toBe(true);
    const idOnly: Grant = { scopes: ['COMPANY'], fields: ['id'] };
    await grants(owner, {
      ...entry,
      'commission:read': idOnly,
      'risk:read': idOnly,
      'collection:read': idOnly,
    });
    const result = await aggregate(owner);
    expect(
      (result.timeline as { type: string }[]).some((event) =>
        ['COMMISSION_', 'RISK_TASK_', 'COLLECTION_'].some((prefix) =>
          event.type.startsWith(prefix),
        ),
      ),
    ).toBe(false);
  });
  it('keeps quote-owned frozen evidence readable without granting other source objects', async () => {
    await grants(owner, {
      ...entry,
      'quote:read': companyGrant,
      'technical-solution:read': selfGrant,
      'cost:read': selfGrant,
      'sales-policy:read': selfGrant,
    });
    const result = await aggregate(owner);
    expect(result.quote).toMatchObject({ quoteNumber: 'AUTH-QUOTE' });
    expect((result.quote as Record<string, unknown>).snapshot).not.toBeNull();
    for (const source of ['technical', 'cost', 'policy']) expect(result[source]).toBeNull();
    expect(JSON.stringify(result)).not.toContain('SENSITIVE-TECHNICAL');
  });
  it('does not reveal the risk score through a severity-only timeline label', async () => {
    await grants(owner, { ...entry, 'risk:read': { scopes: ['COMPANY'], fields: ['severity'] } });
    const result = await aggregate(owner);
    const evaluation = (result.timeline as Record<string, unknown>[]).find(
      (event) => event.type === 'RISK_EVALUATED',
    );
    expect(evaluation).toBeDefined();
    expect(evaluation).not.toHaveProperty('label');
    expect(result.risks).toHaveLength(1);
  });
  it('agrees with direct commercial/QTC/commission/risk TEAM reads across both organization anchors', async () => {
    for (const [anchor, commercialCount, qtcCount] of [
      [teamA, 0, 1],
      [teamB, 1, 0],
    ] as const) {
      const team: Grant = { scopes: ['TEAM'], fields: null, anchor };
      await grants(owner, {
        ...entry,
        'opportunity:read': team,
        'quote:read': team,
        'ar:read': team,
        'commission:read': team,
        'risk:read': team,
      });
      const result = await aggregate(owner);
      expect(result.opportunity === null).toBe(commercialCount === 0);
      expect(result.receivables).toHaveLength(qtcCount);
      for (const [path, count] of [
        ['/opportunities', commercialCount],
        ['/quotes', commercialCount],
        ['/ar-open-items', qtcCount],
        ['/commissions', qtcCount],
        ['/risk-evaluations', qtcCount],
      ] as const) {
        const direct = await response(path, owner.token);
        expect(direct.status, path).toBe(200);
        expect(((await direct.json()) as { items: unknown[] }).items).toHaveLength(count);
      }
    }
  });
  it('requires both parent collection fields and independent legal read for legal timelines', async () => {
    await grants(owner, {
      ...entry,
      'collection:read': { scopes: ['COMPANY'], fields: ['id'] },
      'legal-case:read': companyGrant,
    });
    const result = await aggregate(owner);
    expect(JSON.stringify(result)).not.toContain('SENSITIVE-LEGAL');
    expect(JSON.stringify(result)).not.toContain('SENSITIVE-PACKAGE');
    expect(
      (result.timeline as { type: string }[]).some((event) =>
        ['LEGAL_HANDOFF_', 'DEBT_EVIDENCE_', 'COLLECTION_LEGAL_'].some((prefix) =>
          event.type.startsWith(prefix),
        ),
      ),
    ).toBe(false);
    const direct = await response('/collection-cases', owner.token);
    expect(direct.status).toBe(200);
    const items = ((await direct.json()) as { items: Record<string, unknown>[] }).items;
    expect(Object.keys(items[0] ?? {})).toEqual(['id']);
    uiEvidence.masked = result;
    uiEvidence.maskedCollections = { items };
    uiEvidence.maskedSession = await (await response('/auth/session', owner.token)).json();
  });
  it('does not return generated legal evidence under a narrower independent read scope', async () => {
    await grants(owner, { 'debt-evidence:generate': companyGrant, 'legal-case:read': selfGrant });
    const generated = await response(
      `/legal-handoffs/${graph.handoffId}/evidence-packages`,
      owner.token,
      { packageNumber: 'AUTH-LIMITED-READ', idempotencyKey: 'AUTH-LIMITED-GENERATE' },
    );
    expect(generated.status).toBe(201);
    const result = (await generated.json()) as Record<string, unknown>;
    expect(typeof result.id).toBe('string');
    expect(Object.keys(result).every((key) => ['id', 'version'].includes(key))).toBe(true);
    expect(JSON.stringify(result)).not.toContain('SENSITIVE-LEGAL');
    expect(result).not.toHaveProperty('manifest');
  });
  it('intersects aggregate entry SELF with the independent sales-order grant', async () => {
    await grants(builder, {
      'order-360:read': selfGrant,
      'sales-order:read': companyGrant,
      'customer:read': companyGrant,
    });
    const result = await response(`/sales-orders/${graph.orderId}/360`, builder.token);
    expect(result.status).toBe(404);
    expect(JSON.stringify(await result.json())).not.toContain('AUTH-ORDER');
    await grants(owner, { 'order-360:read': selfGrant, 'sales-order:read': companyGrant });
    expect((await aggregate(owner)).order).toMatchObject({ order_number: 'AUTH-ORDER' });
  });
  it('applies aggregate entry field policy after independent source projections', async () => {
    await grants(owner, {
      'order-360:read': { scopes: ['COMPANY'], fields: ['order'] },
      'sales-order:read': companyGrant,
      'collection:read': companyGrant,
      'legal-case:read': companyGrant,
    });
    const result = await aggregate(owner);
    expect(Object.keys(result)).toEqual(['order']);
    expect(JSON.stringify(result)).not.toContain('SENSITIVE-LEGAL');
  });
  it('does not expose authentication material in actual API logs', () => {
    const raw = logs.join('');
    for (const value of [secret, owner.token, builder.token, reviewer.token, outsider.token])
      expect(raw.includes(value)).toBe(false);
  });
});
