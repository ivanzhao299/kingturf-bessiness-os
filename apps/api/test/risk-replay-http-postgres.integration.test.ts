import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DataScope } from '@kingturf/types';
import { PostgresRiskRepository } from '../src/risk-repositories.js';
import { PasswordHasher } from '../src/security.js';
import { ownedCommercialGraph } from './fixtures/owned-commercial-graph.js';

type User = { employeeId: string; roleId: string; login: string; password: string };

describe('TD-RISK-002 real HTTP current authorization on PostgreSQL replays', () => {
  let fixture: Awaited<ReturnType<typeof ownedCommercialGraph>>;
  let child: ChildProcess | undefined;
  let closeFixture: (() => Promise<void>) | undefined;
  let directory: string | undefined;
  let origin: string;
  let owner: User, peer: User, outsider: User;
  let ownerToken: string, peerToken: string, outsiderToken: string;
  let otherTeam: string, policyId: string, key: string, firstId: string, taskId: string;
  let before: Awaited<ReturnType<typeof counts>>;
  const applicationName = `risk_replay_${randomUUID().replaceAll('-', '')}`;
  const hasher = new PasswordHasher({
    saltBytes: 16,
    keyLength: 32,
    cost: 16384,
    blockSize: 8,
    parallelization: 1,
  });
  const input = () => ({
    salesOrderId: fixture.graph.orderId,
    policyVersionId: policyId,
    assigneeEmployeeId: owner.employeeId,
    validUntil: '2099-01-01T00:00:00Z',
    dueAt: '2099-01-01T00:00:00Z',
  });
  async function counts() {
    return (
      await fixture.db.query<{
        evaluations: number;
        tasks: number;
        events: number;
        audits: number;
        outbox: number;
      }>(
        'SELECT (SELECT count(*)::int FROM risk_evaluations) evaluations,(SELECT count(*)::int FROM risk_tasks) tasks,(SELECT count(*)::int FROM risk_task_events) events,(SELECT count(*)::int FROM audit_events) audits,(SELECT count(*)::int FROM domain_event_outbox) outbox',
      )
    ).rows[0];
  }
  async function account(employeeId: string, companyId: string): Promise<User> {
    const identity = randomUUID(),
      roleId = randomUUID();
    const login = `risk-replay-${randomUUID()}`,
      password = randomBytes(24).toString('base64url');
    const identityRow = (
      await fixture.db.query<{ id: string }>(
        'INSERT INTO identities(id,employee_id,login_name) VALUES($1,$2,$3) ON CONFLICT(employee_id) DO UPDATE SET login_name=EXCLUDED.login_name RETURNING id',
        [identity, employeeId, login],
      )
    ).rows[0];
    if (!identityRow) throw new Error('Synthetic identity missing');
    await fixture.db.query(
      "INSERT INTO password_credentials(identity_id,algorithm,password_hash) VALUES($1,'scrypt',$2)",
      [identityRow.id, await hasher.hash(password)],
    );
    await fixture.db.query(
      'INSERT INTO organization_memberships(employee_id,organization_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [employeeId, companyId],
    );
    await fixture.db.query(
      "INSERT INTO roles(id,organization_id,code,name) VALUES($1::uuid,$2,$1::uuid::text,'Risk replay synthetic role')",
      [roleId, companyId],
    );
    await fixture.db.query(
      'INSERT INTO employee_role_assignments(employee_id,role_id) VALUES($1,$2)',
      [employeeId, roleId],
    );
    return { employeeId, roleId, login, password };
  }
  async function grant(user: User, scopes: readonly DataScope[], anchor?: string) {
    await fixture.db.query(
      "DELETE FROM data_scope_grants WHERE employee_id=$1 AND permission_id IN(SELECT id FROM permissions WHERE capability IN('risk:evaluate','risk:read'))",
      [user.employeeId],
    );
    await fixture.db.query(
      "DELETE FROM role_permission_grants WHERE role_id IN(SELECT role_id FROM employee_role_assignments WHERE employee_id=$1) AND permission_id IN(SELECT id FROM permissions WHERE capability IN('risk:evaluate','risk:read'))",
      [user.employeeId],
    );
    if (scopes.length === 0) return;
    await fixture.db.query(
      "INSERT INTO role_permission_grants(role_id,permission_id,data_scopes) SELECT $1,id,$2::data_scope[] FROM permissions WHERE capability IN('risk:evaluate','risk:read')",
      [user.roleId, scopes],
    );
    if (anchor)
      await fixture.db.query(
        "INSERT INTO data_scope_grants(employee_id,permission_id,scope,scope_organization_id) SELECT $1,id,'TEAM',$2 FROM permissions WHERE capability IN('risk:evaluate','risk:read')",
        [user.employeeId, anchor],
      );
  }
  async function login(user: User) {
    const response = await fetch(`${origin}/api/v1/auth/token-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: user.login, password: user.password }),
      signal: AbortSignal.timeout(10_000),
    });
    expect(response.status).toBe(200);
    const result = (await response.json()) as { token: string };
    if (typeof result.token !== 'string') throw new Error('Synthetic token login missing token');
    return result.token;
  }
  const evaluate = (token: string, replayKey = key, body = input()) =>
    fetch(`${origin}/api/v1/risk-evaluations`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': replayKey,
        'x-correlation-id': randomUUID(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  async function denied(token: string, status: number, body = input()) {
    const response = await evaluate(token, key, body);
    expect(response.status).toBe(status);
    const result = (await response.json()) as Record<string, unknown>;
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('canonical_input');
    expect(await counts()).toEqual(before);
  }
  async function manage(user: User, scopes: readonly DataScope[]) {
    await fixture.db.query(
      "DELETE FROM role_permission_grants WHERE role_id IN(SELECT role_id FROM employee_role_assignments WHERE employee_id=$1) AND permission_id=(SELECT id FROM permissions WHERE capability='risk:manage')",
      [user.employeeId],
    );
    if (scopes.length)
      await fixture.db.query(
        "INSERT INTO role_permission_grants(role_id,permission_id,data_scopes) SELECT $1,id,$2::data_scope[] FROM permissions WHERE capability='risk:manage'",
        [user.roleId, scopes],
      );
  }
  const taskCommand = (
    token: string,
    commandKey: string,
    subject = taskId,
    action = 'acknowledge',
    body = { reason: 'Synthetic acknowledgement', evidence: { ack: true } },
  ) =>
    fetch(`${origin}/api/v1/risk-tasks/${subject}/${action}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': commandKey,
        'x-correlation-id': randomUUID(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  beforeAll(async () => {
    fixture = await ownedCommercialGraph();
    closeFixture = fixture.close;
    owner = await account(fixture.context.actor.employeeId, fixture.context.actor.companyId);
    peer = await account(fixture.reviewerEmployee, fixture.context.actor.companyId);
    outsider = await account(
      fixture.otherContext.actor.employeeId,
      fixture.otherContext.actor.companyId,
    );
    otherTeam = randomUUID();
    await fixture.db.query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$2,'REPLAY-OTHER-TEAM','Replay other team','TEAM')",
      [otherTeam, fixture.context.actor.companyId],
    );
    const policy = await new PostgresRiskRepository(fixture.db).createPolicy(
      {
        code: 'REPLAY-HTTP',
        name: 'Replay HTTP',
        minimumMarginBasisPoints: 10000,
        overdueGraceDays: 0,
        creditWarningDays: 0,
        effectiveAt: '2026-01-01T00:00:00Z',
        rules: [],
        publish: true,
      },
      fixture.context,
      randomUUID(),
    );
    if (typeof policy.id !== 'string') throw new Error('Synthetic policy missing identifier');
    policyId = policy.id;
    const connection = process.env.DATABASE_URL;
    if (!connection)
      throw new Error('DATABASE_URL required; HTTP replay tests must not be skipped');
    const target = new URL(connection);
    target.searchParams.set('options', `-csearch_path=${fixture.schema},public`);
    target.searchParams.set('application_name', applicationName);
    const socket = createServer();
    await new Promise<void>((resolve) => socket.listen(0, '127.0.0.1', resolve));
    const address = socket.address();
    if (!address || typeof address === 'string') throw new Error('Owned API port unavailable');
    await new Promise<void>((resolve, reject) =>
      socket.close((error) => {
        if (error) reject(error);
        else resolve();
      }),
    );
    origin = `http://127.0.0.1:${String(address.port)}`;
    directory = await mkdtemp(join(tmpdir(), 'kt-risk-replay-http-'));
    child = spawn(process.execPath, ['--experimental-transform-types', 'apps/api/src/server.ts'], {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: target.href,
        SESSION_SECRET: randomBytes(32).toString('hex'),
        SESSION_TTL_SECONDS: '3600',
        API_HOST: '127.0.0.1',
        API_PORT: String(address.port),
        TOKEN_LOGIN_ENABLED: 'true',
        PASSWORD_SALT_BYTES: '16',
        PASSWORD_KEY_LENGTH: '32',
        PASSWORD_SCRYPT_COST: '16384',
        PASSWORD_SCRYPT_BLOCK_SIZE: '8',
        PASSWORD_SCRYPT_PARALLELIZATION: '1',
        ATTACHMENT_STORAGE_ADAPTER: 'local',
        ATTACHMENT_LOCAL_DIRECTORY: directory,
        WEBSITE_LEAD_INGEST_SECRET: '',
      },
      stdio: 'ignore',
    });
    let ready = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error('Owned risk API exited');
      try {
        ready = (await fetch(`${origin}/ready`, { signal: AbortSignal.timeout(500) })).ok;
      } catch {
        /* Original fixture readiness policy. */
      }
      if (ready) break;
      await delay(20);
    }
    if (!ready) throw new Error('Owned risk API readiness failed');
  }, 30_000);
  beforeEach(async () => {
    await fixture.db.query('UPDATE organizations SET active=true WHERE id=$1', [fixture.teamId]);
    await fixture.db.query('UPDATE employees SET organization_id=$1 WHERE id=$2', [
      fixture.teamId,
      owner.employeeId,
    ]);
    await fixture.db.query(
      'UPDATE customers SET owner_id=$1,owner_organization_id=$2 WHERE id=$3 AND tenant_id=$4',
      [peer.employeeId, fixture.teamId, fixture.graph.customerId, fixture.context.actor.companyId],
    );
    await grant(owner, ['COMPANY']);
    await grant(peer, ['SELF']);
    await grant(outsider, ['COMPANY']);
    await manage(owner, ['COMPANY']);
    await manage(peer, ['COMPANY']);
    await manage(outsider, ['COMPANY']);
    ownerToken = await login(owner);
    peerToken = await login(peer);
    outsiderToken = await login(outsider);
    key = randomUUID();
    const response = await evaluate(ownerToken);
    expect(response.status).toBe(201);
    const first = (await response.json()) as Record<string, unknown>;
    if (typeof first.id !== 'string') throw new Error('Initial risk evaluation missing identifier');
    firstId = first.id;
    if (typeof first.taskId !== 'string') throw new Error('Initial risk task missing');
    taskId = first.taskId;
    before = await counts();
  });
  afterAll(async () => {
    try {
      if (child?.exitCode === null && child.signalCode === null) {
        const running = child;
        const stopped = new Promise<void>((resolve) =>
          running.once('exit', () => {
            resolve();
          }),
        );
        running.kill('SIGTERM');
        const force = setTimeout(() => running.kill('SIGKILL'), 3000);
        try {
          await stopped;
        } finally {
          clearTimeout(force);
        }
      }
    } finally {
      try {
        await closeFixture?.();
      } finally {
        if (directory) await rm(directory, { recursive: true, force: false });
      }
    }
  });
  it('retains legal same-user and authorized different-user replay without duplicate effects', async () => {
    for (const token of [ownerToken, peerToken]) {
      for (const body of [
        input(),
        { ...input(), salesOrderId: randomUUID(), policyVersionId: randomUUID() },
      ]) {
        const response = await evaluate(token, key, body);
        expect(response.status).toBe(201);
        const result = (await response.json()) as Record<string, unknown>;
        expect(result.id).toBe(firstId);
        expect(result.sales_order_id).toBe(fixture.graph.orderId);
        expect(await counts()).toEqual(before);
      }
    }
  });
  it('rejects an existing key after current action permission is revoked', async () => {
    await fixture.db.query(
      "DELETE FROM role_permission_grants WHERE role_id=$1 AND permission_id=(SELECT id FROM permissions WHERE capability='risk:evaluate')",
      [owner.roleId],
    );
    await denied(ownerToken, 403);
  });
  it('rejects scope narrowing even if the new payload names another order', async () => {
    await grant(owner, ['SELF']);
    await denied(ownerToken, 404);
    await denied(ownerToken, 404, { ...input(), salesOrderId: randomUUID() });
    expect(
      (await fixture.db.query('SELECT id FROM sales_orders WHERE id=$1', [fixture.graph.orderId]))
        .rows,
    ).toEqual([{ id: fixture.graph.orderId }]);
  });
  it('rejects same-tenant nonowners and a caller with no current action grant', async () => {
    await grant(owner, ['SELF']);
    await denied(ownerToken, 404);
    await grant(owner, []);
    await denied(ownerToken, 403);
  });
  it('uses changed organization anchors rather than the original authorization snapshot', async () => {
    await grant(owner, ['TEAM'], fixture.teamId);
    expect((await evaluate(ownerToken)).status).toBe(201);
    await fixture.db.query('UPDATE employees SET organization_id=$1 WHERE id=$2', [
      otherTeam,
      owner.employeeId,
    ]);
    await grant(owner, ['TEAM'], otherTeam);
    await denied(ownerToken, 404);
  });
  it('rejects revoked sessions and disabled organizations before returning old results', async () => {
    await fixture.db.query('UPDATE organizations SET active=false WHERE id=$1', [fixture.teamId]);
    await denied(ownerToken, 401);
    await fixture.db.query('UPDATE organizations SET active=true WHERE id=$1', [fixture.teamId]);
    await fixture.db.query(
      'UPDATE sessions SET revoked_at=now() WHERE identity_id IN(SELECT id FROM identities WHERE employee_id=$1)',
      [owner.employeeId],
    );
    await denied(ownerToken, 401);
  });
  it('isolates the same idempotency key in another company', async () => {
    await denied(outsiderToken, 404);
  });
  it('checks each caller independently during concurrent legal and denied replays', async () => {
    await grant(owner, ['SELF']);
    const responses = await Promise.all([
      evaluate(peerToken),
      evaluate(ownerToken),
      evaluate(peerToken),
      evaluate(ownerToken),
    ]);
    expect(responses.map((r) => r.status)).toEqual([201, 404, 201, 404]);
    const results = (await Promise.all(responses.map((r) => r.json()))) as Record<
      string,
      unknown
    >[];
    expect(results[0]?.id).toBe(firstId);
    expect(results[2]?.id).toBe(firstId);
    expect(results[1]).not.toHaveProperty('id');
    expect(results[3]).not.toHaveProperty('id');
    expect(await counts()).toEqual(before);
  });
  it('serializes truly overlapping same-key HTTP requests without duplicate writes', async () => {
    const repeatedKey = randomUUID();
    let pending: Promise<Response[]> | undefined;
    try {
      await fixture.db.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${fixture.context.actor.companyId}:${repeatedKey}:risk`,
        ]);
        pending = Promise.all(Array.from({ length: 4 }, () => evaluate(ownerToken, repeatedKey)));
        let waiting = 0;
        for (let attempt = 0; attempt < 100; attempt++) {
          const locks = await fixture.db.query<{ n: number }>(
            "SELECT count(*)::int n FROM pg_stat_activity WHERE application_name=$1 AND wait_event='advisory'",
            [applicationName],
          );
          waiting = locks.rows[0]?.n ?? 0;
          if (waiting >= 2) break;
          await delay(20);
        }
        expect(waiting).toBeGreaterThanOrEqual(2);
      });
    } catch (error) {
      await pending;
      throw error;
    }
    if (!pending) throw new Error('Concurrent HTTP requests were not started');
    const responses = await pending;
    expect(responses.map((r) => r.status)).toEqual([201, 201, 201, 201]);
    const results = (await Promise.all(responses.map((r) => r.json()))) as Record<
      string,
      unknown
    >[];
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(await counts()).toEqual({
      ...before,
      evaluations: (before?.evaluations ?? 0) + 1,
      tasks: (before?.tasks ?? 0) + 1,
      events: (before?.events ?? 0) + 1,
    });
  });

  it('TD-SEC-009: characterizes wider mutation responses than the independent read data scope', async () => {
    await fixture.db.query(
      "UPDATE role_permission_grants SET data_scopes=ARRAY['SELF']::data_scope[] WHERE role_id=$1 AND permission_id=(SELECT id FROM permissions WHERE capability='risk:read')",
      [owner.roleId],
    );
    const read = await fetch(`${origin}/api/v1/risk-evaluations`, {
      headers: { authorization: `Bearer ${ownerToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    expect(read.status).toBe(200);
    expect((await read.json()) as Record<string, unknown>).toMatchObject({ items: [] });
    const replay = await evaluate(ownerToken);
    expect(replay.status).toBe(201);
    expect((await replay.json()) as Record<string, unknown>).toMatchObject({
      id: firstId,
      sales_order_id: fixture.graph.orderId,
    });
    expect(await counts()).toEqual(before);
  });
  it('TD-RISK-003: keeps authorized same-user and current broad-user task replay unchanged', async () => {
    const replayKey = randomUUID();
    const first = await taskCommand(ownerToken, replayKey);
    expect(first.status).toBe(201);
    const after = await counts();
    for (const token of [ownerToken, peerToken]) {
      const replay = await taskCommand(token, replayKey, taskId, 'escalate');
      expect(replay.status).toBe(201);
      expect((await replay.json()) as Record<string, unknown>).toMatchObject({
        taskId,
        state: 'ACKNOWLEDGED',
        reason: 'Synthetic acknowledgement',
      });
      expect(await counts()).toEqual(after);
    }
  });
  it('TD-RISK-003: denies cached events after action revocation and narrowing away from the assignee', async () => {
    const replayKey = randomUUID();
    expect((await taskCommand(ownerToken, replayKey)).status).toBe(201);
    const after = await counts();
    await manage(peer, ['SELF']);
    const denied = await taskCommand(peerToken, replayKey);
    expect(denied.status).toBe(404);
    const rejected = (await denied.json()) as Record<string, unknown>;
    for (const field of ['taskId', 'evidence', 'reason'])
      expect(rejected).not.toHaveProperty(field);
    await manage(owner, []);
    expect((await taskCommand(ownerToken, replayKey)).status).toBe(403);
    expect(await counts()).toEqual(after);
  });
  it('TD-RISK-003: rejects invalid membership and cross-company cached task reads', async () => {
    const replayKey = randomUUID();
    expect((await taskCommand(ownerToken, replayKey)).status).toBe(201);
    const after = await counts();
    expect((await taskCommand(outsiderToken, replayKey)).status).toBe(404);
    await fixture.db.query(
      'UPDATE organization_memberships SET active=false WHERE employee_id=$1',
      [peer.employeeId],
    );
    try {
      expect((await taskCommand(peerToken, replayKey)).status).toBe(401);
    } finally {
      await fixture.db.query(
        'UPDATE organization_memberships SET active=true WHERE employee_id=$1',
        [peer.employeeId],
      );
    }
    expect(await counts()).toEqual(after);
  });
  it('TD-RISK-003: binds a tenant key to its original task without leaking another subject', async () => {
    const replayKey = randomUUID();
    expect((await taskCommand(ownerToken, replayKey)).status).toBe(201);
    const created = await evaluate(ownerToken, randomUUID());
    expect(created.status).toBe(201);
    const next = (await created.json()) as Record<string, unknown>;
    if (typeof next.taskId !== 'string') throw new Error('Second risk task missing');
    const after = await counts();
    const conflict = await taskCommand(ownerToken, replayKey, next.taskId);
    expect(conflict.status).toBe(409);
    const body = (await conflict.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty('taskId');
    expect(body).not.toHaveProperty('evidence');
    expect(await counts()).toEqual(after);
  });
  it('TD-RISK-003: serializes truly overlapping duplicate task commands without another event', async () => {
    const replayKey = randomUUID();
    let pending: Promise<Response[]> | undefined;
    try {
      await fixture.db.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${fixture.context.actor.companyId}:${replayKey}:risk-task-key`,
        ]);
        pending = Promise.all(Array.from({ length: 4 }, () => taskCommand(ownerToken, replayKey)));
        let waiting = 0;
        for (let attempt = 0; attempt < 100; attempt++) {
          waiting =
            (
              await fixture.db.query<{ n: number }>(
                "SELECT count(*)::int n FROM pg_stat_activity WHERE application_name=$1 AND wait_event='advisory'",
                [applicationName],
              )
            ).rows[0]?.n ?? 0;
          if (waiting >= 2) break;
          await delay(20);
        }
        expect(waiting).toBeGreaterThanOrEqual(2);
      });
    } catch (error) {
      await pending;
      throw error;
    }
    if (!pending) throw new Error('Concurrent task requests missing');
    const responses = await pending;
    expect(responses.map((r) => r.status)).toEqual([201, 201, 201, 201]);
    expect(await counts()).toEqual({ ...before, events: (before?.events ?? 0) + 1 });
  });
  it('TD-RISK-003: serializes one key across two accessible task subjects', async () => {
    const created = await evaluate(ownerToken, randomUUID());
    expect(created.status).toBe(201);
    const next = (await created.json()) as Record<string, unknown>;
    if (typeof next.taskId !== 'string') throw new Error('Second task missing');
    const subjects = [taskId, next.taskId];
    const baseline = await counts();
    const replayKey = randomUUID();
    let pending: Promise<Response[]> | undefined;
    try {
      await fixture.db.transaction(async (tx) => {
        const held = (await tx.query<{ pid: number }>('SELECT pg_backend_pid() pid')).rows[0];
        if (!held) throw new Error('Barrier connection missing');
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${fixture.context.actor.companyId}:${replayKey}:risk-task-key`,
        ]);
        pending = Promise.all(subjects.map((id) => taskCommand(ownerToken, replayKey, id)));
        let waiting = 0;
        for (let attempt = 0; attempt < 100; attempt++) {
          waiting =
            (
              await fixture.db.query<{ n: number }>(
                'SELECT count(*)::int n FROM pg_stat_activity WHERE application_name=$1 AND $2=ANY(pg_blocking_pids(pid))',
                [applicationName, held.pid],
              )
            ).rows[0]?.n ?? 0;
          if (waiting === 2) break;
          await delay(20);
        }
        expect(waiting).toBe(2);
      });
    } catch (error) {
      await pending;
      throw error;
    }
    if (!pending) throw new Error('Concurrent commands missing');
    const responses = await pending;
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    for (const response of responses) {
      const body = (await response.json()) as Record<string, unknown>;
      if (response.status === 409) {
        expect(body).not.toHaveProperty('taskId');
        expect(body).not.toHaveProperty('evidence');
        expect(body).not.toHaveProperty('reason');
      }
    }
    expect(await counts()).toEqual({ ...baseline, events: (baseline?.events ?? 0) + 1 });
    expect(
      (
        await fixture.db.query<{ n: number }>(
          'SELECT count(*)::int n FROM risk_task_events WHERE idempotency_key=$1',
          [replayKey],
        )
      ).rows[0]?.n,
    ).toBe(1);
  });
});
