import { randomBytes, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { PostgresCommercialRepository } from '../src/commercial-repositories.js';
import { PostgresCrmRepository } from '../src/crm-repositories.js';
import { PostgresQuoteToCashRepository } from '../src/qtc-repositories.js';
import {
  PostgresAuthorizationRepository,
  PostgresEmployeeRepository,
  PostgresOrganizationRepository,
  PostgresSecurityStore,
} from '../src/repositories.js';
import { AuthenticationService, hashSessionToken, PasswordHasher } from '../src/security.js';
import { ownedCommercialGraph } from './fixtures/owned-commercial-graph.js';

// WF-A（TD-WF-013）：两处「用户可纠正的输入错误」在真库上走到 4xx。此前唯一约束与触发器的
// RAISE EXCEPTION 没有被映射，一律落到 500：
//   - 用已存在的客户编号再建一个客户（customers_tenant_id_customer_number_key）→ 409；
//   - 评估人审批自己发起的信用决定（enforce_credit_approval_separation，职责分离）→ 403。
// 走完整的应用分发（buildApp + 真实仓储 + 真实会话），数据库真的拒绝一次。映射只做在这
// 两个端点上，所以这里同时钉住「相邻情形仍然照旧」。
describe('TD-WF-013 correctable input errors reach 4xx against real PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof ownedCommercialGraph>> | undefined;
  const state = () => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    return fixture;
  };
  // 会话与 buildApp 的装配方式与 owned-commercial-graph.ts 相同（同一 schema、同一批行）。
  // 每名员工只有一个身份（identities.employee_id 唯一），夹具已经建好；这里只为该身份
  // 新开一条会话。令牌只存在于本闭包，不进入任何断言输出。
  const session = async (employeeId: string) => {
    const { db, context } = state();
    const token = randomBytes(32).toString('base64url');
    const inserted = await db.query(
      "INSERT INTO sessions(identity_id,organization_id,token_hash,expires_at) SELECT id,$2,$3,now()+interval '1 hour' FROM identities WHERE employee_id=$1 RETURNING id",
      [employeeId, context.actor.companyId, hashSessionToken(token, sessionSecret)],
    );
    if (!inserted.rowCount) throw new Error('Synthetic identity missing');
    return token;
  };
  let sessionSecret = '';
  let app: ReturnType<typeof buildApp> | undefined;

  beforeEach(async () => {
    fixture = await ownedCommercialGraph();
    sessionSecret = randomBytes(32).toString('hex');
    const { db } = state();
    const store = new PostgresSecurityStore(db);
    app = buildApp({
      auth: new AuthenticationService(
        store,
        new PasswordHasher({
          saltBytes: 16,
          keyLength: 32,
          cost: 16384,
          blockSize: 8,
          parallelization: 1,
        }),
        { secret: sessionSecret, ttlSeconds: 3600, idleSeconds: 3600 },
        store,
      ),
      organizations: new PostgresOrganizationRepository(db),
      employees: new PostgresEmployeeRepository(db),
      authorization: new PostgresAuthorizationRepository(db),
      crm: new PostgresCrmRepository(db),
      commercial: new PostgresCommercialRepository(db),
      quoteToCash: new PostgresQuoteToCashRepository(db),
    });
  }, 60_000);
  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
    app = undefined;
  });

  const dispatch = (request: {
    token: string;
    method: 'GET' | 'POST' | 'PUT';
    pathname: string;
    body?: Record<string, unknown>;
    key?: string;
  }) => {
    if (!app) throw new Error('Application not built');
    return app.dispatch({
      method: request.method,
      pathname: request.pathname,
      headers: {
        authorization: `Bearer ${request.token}`,
        'content-type': 'application/json',
        'x-correlation-id': randomUUID(),
        ...(request.key === undefined ? {} : { 'idempotency-key': request.key }),
      },
      ...(request.body === undefined ? {} : { body: request.body }),
    });
  };
  // 计数助手：取不到行即抛错，返回确定的数字（不用可选值做加减）。
  const count = async (sql: string, values: readonly unknown[]) => {
    const row = (await state().db.query<{ n: number }>(sql, values)).rows[0];
    if (!row) throw new Error('Count query returned no row');
    return row.n;
  };
  // 错误信封：恰好 code / message / correlationId 三个键；correlationId 每次请求随机生成，
  // 只断言它是非空字符串。
  const expectError = (
    response: { body: unknown },
    expected: Readonly<{ code: string; message: string }>,
  ) => {
    const error = bodyOf(response).error;
    if (typeof error !== 'object' || error === null || Array.isArray(error))
      throw new Error('Expected an error envelope');
    const envelope = error as Record<string, unknown>;
    expect(Object.keys(envelope).sort()).toEqual(['code', 'correlationId', 'message']);
    expect(envelope.code).toBe(expected.code);
    expect(envelope.message).toBe(expected.message);
    if (typeof envelope.correlationId !== 'string' || !envelope.correlationId)
      throw new Error('Expected a correlation id');
  };
  const customerCount = () =>
    count('SELECT count(*)::integer n FROM customers WHERE tenant_id=$1', [
      state().context.actor.companyId,
    ]);
  const approvalCount = () =>
    count('SELECT count(*)::integer n FROM credit_approvals WHERE tenant_id=$1', [
      state().context.actor.companyId,
    ]);
  // 响应体是 unknown；收窄成记录后再断言（不用 any）。
  const bodyOf = (response: { body: unknown }): Record<string, unknown> => {
    if (typeof response.body !== 'object' || response.body === null || Array.isArray(response.body))
      throw new Error('Expected a JSON object body');
    return response.body as Record<string, unknown>;
  };

  it('duplicate customer number → 409「客户编号已存在」; nothing is written; the raw database message stays out of the response', async () => {
    const { db, context } = state();
    const existing = (
      await db.query<{ customer_number: string }>(
        'SELECT customer_number FROM customers WHERE id=$1 AND tenant_id=$2',
        [state().graph.customerId, context.actor.companyId],
      )
    ).rows[0];
    if (!existing) throw new Error('Fixture customer missing');
    const before = await customerCount();
    const token = await session(context.actor.employeeId);
    const response = await dispatch({
      token,
      method: 'POST',
      pathname: '/api/v1/customers',
      body: { name: 'Another name entirely', customerNumber: existing.customer_number },
    });
    expect(response.statusCode).toBe(409);
    expectError(response, { code: 'conflict', message: '客户编号已存在' });
    expect(JSON.stringify(response.body)).not.toMatch(
      /duplicate key|Key \(tenant_id|already exists/u,
    );
    expect(await customerCount()).toBe(before);
    // 客户创建的审计事件数量不变（夹具建过 1 个客户）。
    const createdEvents = await db.query(
      "SELECT 1 FROM audit_events WHERE action='customer.created' AND organization_id=$1",
      [context.actor.companyId],
    );
    expect(createdEvents.rowCount).toBe(before);
  });

  // 发起人自己另发一条评估（同一已签发报价的下一版决定，夹具里那条已被审批人批掉），
  // 返回新决定的 id。夹具里只有一条已签发报价与一条有效额度，用 SQL 取出它们的 id。
  const evaluateAsOwner = async (evaluator: string) => {
    const { db, context } = state();
    const tenant = context.actor.companyId;
    const issued = (
      await db.query<{ revision: string; snapshot: string }>(
        `SELECT r.id revision,s.id snapshot FROM quote_revisions r JOIN quote_issued_snapshots s ON s.quote_revision_id=r.id AND s.tenant_id=r.tenant_id
         WHERE r.tenant_id=$1 AND r.status='ISSUED' AND r.valid_until>now() ORDER BY r.created_at DESC LIMIT 1`,
        [tenant],
      )
    ).rows[0];
    if (!issued) throw new Error('Fixture issued quote missing');
    const limit = (
      await db.query<{ id: string }>(
        'SELECT id FROM credit_limits WHERE tenant_id=$1 AND customer_id=$2 AND expires_at>now() ORDER BY effective_at DESC LIMIT 1',
        [tenant, state().graph.customerId],
      )
    ).rows[0];
    if (!limit) throw new Error('Fixture credit limit missing');
    const created = await dispatch({
      token: evaluator,
      method: 'POST',
      pathname: '/api/v1/credit-decisions',
      key: randomUUID(),
      body: {
        customerId: state().graph.customerId,
        quoteRevisionId: issued.revision,
        quoteSnapshotId: issued.snapshot,
        creditLimitId: limit.id,
        validUntil: '2099-03-31T23:59:59.000Z',
      },
    });
    expect(created.statusCode).toBe(201);
    const decisionId = bodyOf(created).id;
    if (typeof decisionId !== 'string') throw new Error('Credit decision id missing');
    return decisionId;
  };

  it('self-approval on the bridge track PUT /state → 403 with a Chinese explanation; the decision stays pending and no approval row is written', async () => {
    const { db, context } = state();
    const tenant = context.actor.companyId;
    const evaluator = await session(context.actor.employeeId);
    const decisionId = await evaluateAsOwner(evaluator);
    const before = await approvalCount();
    const response = await dispatch({
      token: evaluator,
      method: 'PUT',
      pathname: `/api/v1/credit-decisions/${decisionId}/state`,
      key: randomUUID(),
      body: { decision: 'APPROVED', reason: 'Trying to approve my own evaluation' },
    });
    expect(response.statusCode).toBe(403);
    expectError(response, {
      code: 'forbidden',
      message: '职责分离：发起信用评估的人不能审批这条信用决定，请由另一位审批人处理',
    });
    expect(JSON.stringify(response.body)).not.toMatch(/credit evaluator|PL\/pgSQL|RAISE/u);
    expect(await approvalCount()).toBe(before);
    // 决定仍待审批，也没有留下 credit.decided 证据。
    expect(
      (
        await db.query(
          'SELECT effective_status FROM effective_credit_decisions WHERE tenant_id=$1 AND id=$2',
          [tenant, decisionId],
        )
      ).rows,
    ).toEqual([{ effective_status: 'PENDING_APPROVAL' }]);
    const decided = await db.query(
      "SELECT 1 FROM audit_events WHERE action='credit.decided' AND target_id=$1 AND organization_id=$2",
      [decisionId, tenant],
    );
    expect(decided.rowCount).toBe(0);
    // 同一条决定由另一位审批人来批：照常成功（映射没有把正常路径一起挡掉）。
    const approver = await session(state().reviewerEmployee);
    const approved = await dispatch({
      token: approver,
      method: 'PUT',
      pathname: `/api/v1/credit-decisions/${decisionId}/state`,
      key: randomUUID(),
      body: { decision: 'APPROVED', reason: 'Independent approval' },
    });
    expect(approved.statusCode).toBe(200);
    expect(bodyOf(approved)).toEqual({ id: decisionId, effectiveStatus: 'APPROVED' });
    expect(await approvalCount()).toBe(before + 1);
  });

  it('the legacy POST /approve track is untouched: the same self-approval there is still 500 (out of scope, tracked separately)', async () => {
    const evaluator = await session(state().context.actor.employeeId);
    const decisionId = await evaluateAsOwner(evaluator);
    const before = await approvalCount();
    const response = await dispatch({
      token: evaluator,
      method: 'POST',
      pathname: `/api/v1/credit-decisions/${decisionId}/approve`,
      key: randomUUID(),
      body: { decision: 'APPROVED', reason: 'Trying to approve my own evaluation' },
    });
    expect(response.statusCode).toBe(500);
    expectError(response, { code: 'internal_error', message: 'Internal server error' });
    // 数据库照样拒绝（职责分离没有被绕过），只是这条轨没有映射成 4xx。
    expect(await approvalCount()).toBe(before);
  });

  it('a different unique violation on the same endpoint (same normalized name) is still 500 — out of scope, tracked separately', async () => {
    const { db, context } = state();
    const existing = (
      await db.query<{ name: string }>('SELECT name FROM customers WHERE id=$1 AND tenant_id=$2', [
        state().graph.customerId,
        context.actor.companyId,
      ])
    ).rows[0];
    if (!existing) throw new Error('Fixture customer missing');
    const token = await session(context.actor.employeeId);
    const response = await dispatch({
      token,
      method: 'POST',
      pathname: '/api/v1/customers',
      body: { name: `  ${existing.name}  `, customerNumber: 'CUST-WFA-NEW-NUMBER' },
    });
    expect(response.statusCode).toBe(500);
    expectError(response, { code: 'internal_error', message: 'Internal server error' });
    const written = await db.query(
      "SELECT 1 FROM customers WHERE tenant_id=$1 AND customer_number='CUST-WFA-NEW-NUMBER'",
      [context.actor.companyId],
    );
    expect(written.rowCount).toBe(0);
  });
});
