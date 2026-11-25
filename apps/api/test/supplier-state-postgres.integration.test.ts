import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database, SqlClient } from '@kingturf/database';
import type { JsonObject } from '@kingturf/types';
import { PostgresProcurementRepository } from '../src/procurement-repositories.js';
import { controlledTransaction, outcome } from './fixtures/controlled-transaction.js';
import { ownedProcurementApp } from './fixtures/owned-procurement-app.js';

// PROC-5（TD-PROC-002）：供应商状态端点 PUT /api/v1/suppliers/:id/state 在真库上的回归。走完整的
// 应用分发（buildApp + 真实仓储 + 真实会话），每条合法与非法迁移、幂等、并发、权限、租户边界
// 都真的执行一次。迁移规则（主协调裁定）：三个状态之间目标不同于当前即可迁移，共六条；
// 目标与当前相同的三条拒绝（409 + 中文）。
const identifier = (item: JsonObject, key = 'id'): string => {
  const value = item[key];
  if (typeof value !== 'string') throw new Error('Fixture identifier missing');
  return value;
};
const bodyOf = (response: { body: unknown }): Record<string, unknown> => {
  if (typeof response.body !== 'object' || response.body === null || Array.isArray(response.body))
    throw new Error('Expected a JSON object body');
  return response.body as Record<string, unknown>;
};
const errorOf = (response: { body: unknown }): Record<string, unknown> => {
  const error = bodyOf(response).error;
  if (typeof error !== 'object' || error === null || Array.isArray(error))
    throw new Error('Expected an error envelope');
  return error as Record<string, unknown>;
};
type Status = 'ACTIVE' | 'ON_HOLD' | 'INACTIVE';
const LABEL: Readonly<Record<Status, string>> = {
  ACTIVE: '已启用',
  ON_HOLD: '暂停',
  INACTIVE: '已停用',
};

describe('PROC-5 supplier state endpoint against real PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof ownedProcurementApp>> | undefined;
  let token: string;
  let supplierId: string, itemVersionId: string;
  const state = () => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    return fixture;
  };
  // 一个已启用、已准入某物料的供应商。
  const newSupplier = async (supplierNumber: string): Promise<string> => {
    const { repository, context } = state();
    const created = await repository.createSupplier(
      {
        supplierNumber,
        name: `Supplier ${supplierNumber}`,
        currency: 'CNY',
        paymentTermsDays: 30,
        qualityRatingBasisPoints: 9000,
        contact: {},
      },
      context,
      randomUUID(),
    );
    await repository.qualifySupplier(
      identifier(created),
      {
        itemVersionId,
        status: 'APPROVED',
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
        minimumOrderQuantity: '1',
        leadTimeDays: 2,
        evidence: { reviewed: true },
      },
      context,
      randomUUID(),
    );
    return identifier(created);
  };
  const put = (
    target: string,
    status: Status,
    options: Readonly<{ token?: string; key?: string | null }> = {},
  ) =>
    state().dispatch({
      token: options.token ?? token,
      method: 'PUT',
      pathname: `/api/v1/suppliers/${target}/state`,
      body: { status },
      ...(options.key === null ? {} : { key: options.key ?? randomUUID() }),
    });
  const rowOf = async (target: string) => {
    const row = (
      await state().db.query<{ status: Status; updated_at: Date }>(
        'SELECT status,updated_at FROM suppliers WHERE id=$1',
        [target],
      )
    ).rows[0];
    if (!row) throw new Error('Supplier row missing');
    return row;
  };
  // 某个供应商的全部状态变更证据：审计行与 outbox 行按关联 ID 配对，outbox 按版本升序。
  const evidenceOf = async (target: string) =>
    (
      await state().db.query<{
        versions: number[];
        events: { version: number; status: Status; actor_id: string }[];
        audit: { outcome: string; metadata: { status: Status }; organization_id: string }[];
      }>(
        `SELECT
           (SELECT coalesce(jsonb_agg(aggregate_version ORDER BY aggregate_version),'[]') FROM domain_event_outbox o WHERE o.aggregate_id=$1 AND o.event_type='supplier.status-changed') versions,
           (SELECT coalesce(jsonb_agg(jsonb_build_object('version',o.aggregate_version,'status',o.payload->>'status','actor_id',o.actor_id) ORDER BY o.aggregate_version),'[]') FROM domain_event_outbox o WHERE o.aggregate_id=$1 AND o.event_type='supplier.status-changed') events,
           (SELECT coalesce(jsonb_agg(jsonb_build_object('outcome',a.outcome,'metadata',a.metadata,'organization_id',a.organization_id) ORDER BY a.occurred_at),'[]') FROM audit_events a WHERE a.target_id=$1 AND a.action='supplier.status-changed') audit`,
        [target],
      )
    ).rows[0];
  const retained = async (key: string) =>
    (
      await state().db.query<{ command_type: string; subject_id: string; payload: unknown }>(
        'SELECT command_type,subject_id,payload FROM commercial_command_results WHERE tenant_id=$1 AND idempotency_key=$2',
        [state().company, key],
      )
    ).rows;
  const pairedEvidence = async (target: string) =>
    (
      await state().db.query<{ paired: number; audit: number; outbox: number }>(
        `SELECT
           (SELECT count(*)::integer FROM audit_events a JOIN domain_event_outbox o ON o.correlation_id=a.correlation_id AND o.tenant_id=a.organization_id AND o.aggregate_id=a.target_id WHERE a.target_id=$1 AND a.action='supplier.status-changed' AND o.event_type='supplier.status-changed') paired,
           (SELECT count(*)::integer FROM audit_events WHERE target_id=$1 AND action='supplier.status-changed') audit,
           (SELECT count(*)::integer FROM domain_event_outbox WHERE aggregate_id=$1 AND event_type='supplier.status-changed') outbox`,
        [target],
      )
    ).rows[0];

  beforeEach(async () => {
    fixture = await ownedProcurementApp('supplier_state_pg');
    token = await state().session(state().employee, 'ALL');
    itemVersionId = identifier(
      await state().manufacturing.createItem(
        {
          sku: 'RAW-1',
          name: 'RAW-1',
          itemType: 'RAW_MATERIAL',
          baseUnitCode: 'KG',
          specification: {},
          effectiveAt: '2026-01-01T00:00:00Z',
          publish: true,
        },
        state().context,
        randomUUID(),
      ),
    );
    supplierId = await newSupplier('SUP-1');
  }, 60_000);
  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it('every legal transition succeeds: six pairs over two suppliers, each 200 + { id, status }, the row follows and updated_at moves', async () => {
    const second = await newSupplier('SUP-2');
    // 两条链合起来恰好覆盖六条合法迁移。
    const chains: readonly (readonly [string, readonly Status[]])[] = [
      [supplierId, ['ON_HOLD', 'INACTIVE', 'ACTIVE']],
      // ACTIVE → INACTIVE → ON_HOLD → ACTIVE
      [second, ['INACTIVE', 'ON_HOLD', 'ACTIVE']],
    ];
    for (const [target, path] of chains) {
      expect((await rowOf(target)).status).toBe('ACTIVE');
      for (const status of path) {
        const before = await rowOf(target);
        const response = await put(target, status);
        expect(response.statusCode).toBe(200);
        expect(bodyOf(response)).toEqual({ id: target, status });
        const after = await rowOf(target);
        expect(after.status).toBe(status);
        expect(after.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime());
      }
    }
  });

  it('the three same-status requests are refused with 409 + Chinese; status, updated_at and evidence stay untouched', async () => {
    for (const status of ['ACTIVE', 'ON_HOLD', 'INACTIVE'] as const) {
      const target = await newSupplier(`SUP-SAME-${status}`);
      // 先把供应商放到目标状态（ACTIVE 是新建后的初始状态）。
      if (status !== 'ACTIVE') expect((await put(target, status)).statusCode).toBe(200);
      const before = await rowOf(target);
      const key = randomUUID();
      const response = await put(target, status, { key });
      expect(response.statusCode).toBe(409);
      expect(errorOf(response)).toMatchObject({
        code: 'conflict',
        message: `供应商当前为「${LABEL[status]}」，不能变更为「${LABEL[status]}」`,
      });
      // 信封恰为 code / message / correlationId 三键。
      expect(Object.keys(errorOf(response)).sort()).toEqual(['code', 'correlationId', 'message']);
      expect(await rowOf(target)).toEqual(before);
      const evidence = await evidenceOf(target);
      expect(evidence?.versions).toEqual(status === 'ACTIVE' ? [] : [1]);
      expect(await retained(key)).toEqual([]);
    }
  });

  it('replaying the same key returns the retained result without writing again, even after the supplier moved on', async () => {
    const key = randomUUID();
    const first = await put(supplierId, 'ON_HOLD', { key });
    expect(first.statusCode).toBe(200);
    const afterFirst = await rowOf(supplierId);
    const replay = await put(supplierId, 'ON_HOLD', { key });
    expect(replay.statusCode).toBe(200);
    expect(bodyOf(replay)).toEqual(bodyOf(first));
    expect(await rowOf(supplierId)).toEqual(afterFirst);
    // 之后供应商又变了状态：重放旧键仍返回当时留存的结果，不会把供应商改回去。
    expect((await put(supplierId, 'INACTIVE')).statusCode).toBe(200);
    const lateReplay = await put(supplierId, 'ON_HOLD', { key });
    expect(lateReplay.statusCode).toBe(200);
    expect(bodyOf(lateReplay)).toEqual({ id: supplierId, status: 'ON_HOLD' });
    expect((await rowOf(supplierId)).status).toBe('INACTIVE');
    expect((await evidenceOf(supplierId))?.versions).toEqual([1, 2]);
    expect(await retained(key)).toEqual([
      {
        command_type: 'supplier.status-changed',
        subject_id: supplierId,
        payload: { id: supplierId, status: 'ON_HOLD' },
      },
    ]);
  });

  it('a key bound to one command is refused for another command: another status, another supplier, another actor', async () => {
    const key = randomUUID();
    expect((await put(supplierId, 'ON_HOLD', { key })).statusCode).toBe(200);
    const other = await newSupplier('SUP-OTHER');
    const colleague = await state().session(await state().addEmployee(), ['supplier:manage']);
    const before = await Promise.all([rowOf(supplierId), rowOf(other)]);
    for (const response of [
      await put(supplierId, 'INACTIVE', { key }),
      await put(other, 'ON_HOLD', { key }),
      await put(supplierId, 'ON_HOLD', { key, token: colleague }),
    ]) {
      expect(response.statusCode).toBe(409);
      expect(errorOf(response)).toMatchObject({
        code: 'conflict',
        message: 'Idempotency key is bound to another command',
      });
    }
    expect(await Promise.all([rowOf(supplierId), rowOf(other)])).toEqual(before);
    expect((await evidenceOf(other))?.versions).toEqual([]);
    expect((await evidenceOf(supplierId))?.versions).toEqual([1]);
  });

  it('a supplier can be held and restored again and again: each change gets the next evidence version', async () => {
    const path: readonly Status[] = ['ON_HOLD', 'ACTIVE', 'INACTIVE', 'ON_HOLD', 'ACTIVE'];
    for (const status of path) expect((await put(supplierId, status)).statusCode).toBe(200);
    const evidence = await evidenceOf(supplierId);
    // 固定版本 1 的证据写入在第二次变更时会撞 outbox 的唯一约束——所以这里版本必须递增。
    expect(evidence?.versions).toEqual([1, 2, 3, 4, 5]);
    expect(evidence?.events.map((event) => event.status)).toEqual(path);
    expect(evidence?.audit.map((row) => row.metadata.status)).toEqual(path);
    for (const row of evidence?.audit ?? []) {
      expect(row.outcome).toBe('SUCCESS');
      expect(row.organization_id).toBe(state().company);
    }
    for (const event of evidence?.events ?? []) expect(event.actor_id).toBe(state().employee);
    // 每条审计行与一条 outbox 行成对（同一关联 ID）。
    expect(await pairedEvidence(supplierId)).toEqual({ paired: 5, audit: 5, outbox: 5 });
    // 那条唯一约束是真的：再往同一供应商写一个版本 1 的事件会被数据库拒绝。
    await expect(
      state().db.query(
        "INSERT INTO domain_event_outbox(tenant_id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,occurred_at,correlation_id,payload) VALUES($1,'supplier.status-changed',1,'supplier',$2,1,now(),$3,'{}')",
        [state().company, supplierId, randomUUID()],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('concurrent requests with different keys are serialized by the row lock: both succeed, the last one wins, versions stay consecutive', async () => {
    const [held, deactivated] = await Promise.all([
      put(supplierId, 'ON_HOLD'),
      put(supplierId, 'INACTIVE'),
    ]);
    expect(held.statusCode).toBe(200);
    expect(deactivated.statusCode).toBe(200);
    const final = await rowOf(supplierId);
    expect(['ON_HOLD', 'INACTIVE']).toContain(final.status);
    const evidence = await evidenceOf(supplierId);
    expect(evidence?.versions).toEqual([1, 2]);
    // 最后落库的状态，就是版本最高的那条事件记录的状态。
    expect(evidence?.events.at(-1)?.status).toBe(final.status);
    expect(await pairedEvidence(supplierId)).toEqual({ paired: 2, audit: 2, outbox: 2 });
  });

  it('concurrent requests with different keys but the same target: exactly one succeeds, the other sees the updated status', async () => {
    const [left, right] = await Promise.all([
      put(supplierId, 'ON_HOLD'),
      put(supplierId, 'ON_HOLD'),
    ]);
    const codes = [left.statusCode, right.statusCode].sort();
    // 两个请求都基于「当前是已启用」发出；行锁让后到的那个读到「暂停」，于是被拒。
    expect(codes).toEqual([200, 409]);
    const refused = left.statusCode === 409 ? left : right;
    expect(errorOf(refused).message).toBe('供应商当前为「暂停」，不能变更为「暂停」');
    expect((await rowOf(supplierId)).status).toBe('ON_HOLD');
    expect((await evidenceOf(supplierId))?.versions).toEqual([1]);
  });

  it('concurrent requests sharing one key all get the same result and leave exactly one change behind', async () => {
    const key = randomUUID();
    const responses = await Promise.all([
      put(supplierId, 'INACTIVE', { key }),
      put(supplierId, 'INACTIVE', { key }),
      put(supplierId, 'INACTIVE', { key }),
    ]);
    for (const response of responses) {
      expect(response.statusCode).toBe(200);
      expect(bodyOf(response)).toEqual({ id: supplierId, status: 'INACTIVE' });
    }
    expect((await rowOf(supplierId)).status).toBe('INACTIVE');
    expect((await evidenceOf(supplierId))?.versions).toEqual([1]);
    expect(await retained(key)).toHaveLength(1);
  });

  // 上面三条并发用例靠 Promise.all 让两个请求同时出发，它们是否真的交错取决于时序。这一条把交错
  // 固定下来：把第一次变更的全部写做完、停在提交之前，再发起第二次——第二次必须被第一次持有的
  // 行锁挡住，等第一次提交之后，按已提交的状态判定。仓储层直接驱动，SQL 与证据都走真实连接。
  const waitForBlockedBy = async (db: Database, blocker: number): Promise<void> => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const blocked = (
        await db.query<{ n: number }>(
          'SELECT count(*)::integer n FROM pg_stat_activity WHERE $1::int=ANY(pg_blocking_pids(pid))',
          [blocker],
        )
      ).rows[0]?.n;
      if ((blocked ?? 0) > 0) return;
      await delay(20);
    }
    throw new Error('Expected the second change to be blocked by the uncommitted first one');
  };
  it('deterministic interleaving: a change sent while another is uncommitted waits for it, then is judged on the committed status', async () => {
    const { db, context } = state();
    const change = (
      client: SqlClient & Pick<Database, 'transaction'>,
      target: string,
      status: Status,
    ) =>
      outcome(
        new PostgresProcurementRepository(client).setSupplierStatus(
          target,
          status,
          randomUUID(),
          context,
          randomUUID(),
        ),
      );
    // 两个闸门都记下来：用例中途失败也要放行，否则被暂停的事务会占着连接、拖住收尾。
    const gates: { release: () => void }[] = [];
    try {
      // 同一个目标状态：第二次等到的是「已暂停」，于是被拒。
      const first = controlledTransaction(db, true);
      gates.push(first);
      const held = change(first.db, supplierId, 'ON_HOLD');
      await first.written;
      const duplicate = change(db, supplierId, 'ON_HOLD');
      await waitForBlockedBy(db, await first.started);
      first.release();
      expect(await held).toEqual({ ok: true, value: { id: supplierId, status: 'ON_HOLD' } });
      const refused = await duplicate;
      expect(refused.ok).toBe(false);
      expect(refused.ok ? {} : refused.error).toMatchObject({
        code: 'conflict',
        message: '供应商当前为「暂停」，不能变更为「暂停」',
      });
      expect((await rowOf(supplierId)).status).toBe('ON_HOLD');
      expect((await evidenceOf(supplierId))?.versions).toEqual([1]);

      // 另一个目标状态：第二次在第一次之上生效，得到下一个版本。
      const other = await newSupplier('SUP-RACE');
      const leading = controlledTransaction(db, true);
      gates.push(leading);
      const heldFirst = change(leading.db, other, 'ON_HOLD');
      await leading.written;
      const onTop = change(db, other, 'INACTIVE');
      await waitForBlockedBy(db, await leading.started);
      leading.release();
      expect(await heldFirst).toEqual({ ok: true, value: { id: other, status: 'ON_HOLD' } });
      expect(await onTop).toEqual({ ok: true, value: { id: other, status: 'INACTIVE' } });
      expect((await rowOf(other)).status).toBe('INACTIVE');
      expect((await evidenceOf(other))?.events.map((event) => event.status)).toEqual([
        'ON_HOLD',
        'INACTIVE',
      ]);
    } finally {
      for (const gate of gates) gate.release();
    }
  });

  it('requires supplier:manage: read-only or no supplier permission → 403 and nothing changes', async () => {
    const readOnly = await state().session(await state().addEmployee(), ['supplier:read']);
    const none = await state().session(await state().addEmployee(), []);
    const before = await rowOf(supplierId);
    for (const session of [readOnly, none]) {
      const response = await put(supplierId, 'ON_HOLD', { token: session });
      expect(response.statusCode).toBe(403);
      expect(errorOf(response).code).toBe('forbidden');
    }
    expect(await rowOf(supplierId)).toEqual(before);
    expect((await evidenceOf(supplierId))?.versions).toEqual([]);
  });

  it('a manager without supplier:read still changes the status; the response then carries only the id', async () => {
    const manager = await state().session(await state().addEmployee(), ['supplier:manage']);
    const response = await put(supplierId, 'ON_HOLD', { token: manager });
    expect(response.statusCode).toBe(200);
    expect(bodyOf(response)).toEqual({ id: supplierId });
    expect((await rowOf(supplierId)).status).toBe('ON_HOLD');
  });

  it('malformed requests are refused before anything is written: no key, unknown status, unknown field, non-uuid path', async () => {
    const before = await rowOf(supplierId);
    for (const [response, message] of [
      [await put(supplierId, 'ON_HOLD', { key: null }), 'Idempotency-Key is required'],
      [await put(supplierId, 'PAUSED' as Status), 'status must be ON_HOLD, INACTIVE or ACTIVE'],
    ] as const) {
      expect(response.statusCode).toBe(400);
      expect(errorOf(response).message).toBe(message);
    }
    const extraField = await state().dispatch({
      token,
      method: 'PUT',
      pathname: `/api/v1/suppliers/${supplierId}/state`,
      body: { status: 'ON_HOLD', reason: 'not allowed' },
      key: randomUUID(),
    });
    expect(extraField.statusCode).toBe(400);
    expect(errorOf(extraField).message).toBe('Unsupported fields: reason');
    const badId = await put('99999999-9999-9999-9999-999999999999', 'ON_HOLD');
    expect(badId.statusCode).toBe(400);
    expect(errorOf(badId).message).toBe('supplierId must be a UUID');
    expect(await rowOf(supplierId)).toEqual(before);
    expect((await evidenceOf(supplierId))?.versions).toEqual([]);
  });

  it('stays tenant-bounded: another company gets 404 and cannot change the supplier', async () => {
    const outsider = await state().session(state().otherEmployee, 'ALL');
    const before = await rowOf(supplierId);
    const response = await put(supplierId, 'INACTIVE', { token: outsider });
    expect(response.statusCode).toBe(404);
    expect(errorOf(response)).toMatchObject({ code: 'not_found', message: 'Supplier not found' });
    expect(await rowOf(supplierId)).toEqual(before);
    expect((await evidenceOf(supplierId))?.versions).toEqual([]);
  });

  it('is read-your-writes through the API, and suspending then restoring really closes then reopens new purchase orders', async () => {
    const { dispatch } = state();
    const detail = async () =>
      bodyOf(await dispatch({ token, method: 'GET', pathname: `/api/v1/suppliers/${supplierId}` }))
        .status;
    const order = (poNumber: string) =>
      dispatch({
        token,
        method: 'POST',
        pathname: '/api/v1/purchase-orders',
        body: {
          poNumber,
          supplierId,
          supplierQuoteId: null,
          currency: 'CNY',
          issue: true,
          lines: [{ itemVersionId, quantity: '1', unitPrice: '1', requiredAt: '2026-02-01' }],
        },
        key: randomUUID(),
      });
    expect(await detail()).toBe('ACTIVE');
    expect((await put(supplierId, 'ON_HOLD')).statusCode).toBe(200);
    expect(await detail()).toBe('ON_HOLD');
    // 状态筛选跟着变：暂停的供应商出现在「暂停」里，不再出现在「已启用」里。
    const filtered = async (status: Status) =>
      bodyOf(
        await dispatch({
          token,
          method: 'GET',
          pathname: `/api/v1/suppliers?status=${status}`,
        }),
      ).items as { id: string }[];
    expect((await filtered('ON_HOLD')).map((row) => row.id)).toEqual([supplierId]);
    expect(await filtered('ACTIVE')).toEqual([]);
    const refused = await order('PO-WHILE-HELD');
    expect(refused.statusCode).toBe(409);
    expect((await put(supplierId, 'ACTIVE')).statusCode).toBe(200);
    expect(await detail()).toBe('ACTIVE');
    expect((await order('PO-AFTER-RESTORE')).statusCode).toBe(201);
  });
});
