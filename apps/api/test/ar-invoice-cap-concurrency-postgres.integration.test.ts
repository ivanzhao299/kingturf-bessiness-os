import { randomUUID } from 'node:crypto';
import { Database } from '@kingturf/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '@kingturf/database';
import { PostgresQuoteToCashRepository } from '../src/qtc-repositories.js';
import { ownedCommercialGraph } from './fixtures/owned-commercial-graph.js';
import { ownedHttpApi } from './fixtures/owned-http-api.js';
import { copyReleasedOrder } from './fixtures/released-order-copy.js';

// TD-FIN-003（FN2）续：并发与口径钉定（真库）。前置校验本体见
// ar-invoice-cap-postgres.integration.test.ts。
//   · 并发：校验在 postAr 的事务里、持有「租户:客户:credit-ledger」事务级 advisory 锁之后执行；
//     订单只属于一个客户，同单开票因此串行。用例先在另一个事务里占住这把锁，等两个请求都
//     阻塞在锁上（pg_locks 里未授予的行）再放行——与机器快慢无关，不用 sleep 赌先后。
//   · 口径：PostgresQuoteToCashReadRepository.invoicedOrderAmount 的求和，与迁移 0026 触发器
//     derive_credit_exposure 派生的未开票额、与 evaluateCredit 写入的敞口快照，在同一组数据上
//     必须相等。任何一侧改了口径（例如让贷项通知冲减、改按未核销余额），这里即红。
const DAY = 86_400_000;
const SLOW = 30_000;
const dueIn = (days: number): string => new Date(Date.now() + days * DAY).toISOString();

type Graph = Awaited<ReturnType<typeof ownedCommercialGraph>>;
type PostInput = Parameters<PostgresQuoteToCashRepository['postAr']>[0];

/** numeric(24,6) 文本（固定 6 位小数）→ 以微单位计的整数，不经浮点。 */
const minorUnits = (value: string): bigint => BigInt(value.replace('.', ''));
const fromMinorUnits = (value: bigint): string => {
  const digits = (value < 0n ? -value : value).toString().padStart(7, '0');
  return `${value < 0n ? '-' : ''}${digits.slice(0, -6)}.${digits.slice(-6)}`;
};

describe('TD-FIN-003 invoice cap: concurrency and ledger caliber on the real ledger', () => {
  let fixture: Graph | undefined;
  let repository: PostgresQuoteToCashRepository;
  let http: Awaited<ReturnType<typeof ownedHttpApi>> | undefined;
  let user: Awaited<ReturnType<NonNullable<typeof http>['user']>>;
  const state = (): Graph => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    return fixture;
  };
  const tenant = (): string => state().context.actor.companyId;
  const customer = (): string => state().graph.customerId;
  const order = (): string => state().graph.orderId;
  const copy = (orderNumber: string): Promise<string> =>
    copyReleasedOrder(state().db, { orderId: order(), companyId: tenant() }, orderNumber);
  const post = (input: PostInput): Promise<Record<string, unknown>> =>
    repository.postAr(input, randomUUID(), state().context, randomUUID());
  const invoice = (salesOrderId: string, documentNumber: string, amount: string): PostInput => ({
    customerId: customer(),
    salesOrderId,
    documentNumber,
    documentType: 'INVOICE',
    currency: 'CNY',
    amount,
    dueAt: dueIn(30),
  });
  // 等到 expected 个后端正阻塞在 lockKey 这把 advisory 锁上。
  const waitForWaiters = async (lockKey: string, expected: number): Promise<void> => {
    const deadline = Date.now() + 15_000;
    for (;;) {
      const waiting =
        (
          await state().db.query<{ n: number }>(
            "SELECT count(*)::int n FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE l.locktype='advisory' AND NOT l.granted AND l.classid=((hashtextextended($1,0)>>32)&4294967295)::oid AND l.objid=(hashtextextended($1,0)&4294967295)::oid AND l.database=(SELECT oid FROM pg_database WHERE datname=current_database()) AND a.state='active' AND a.wait_event_type='Lock' AND a.wait_event='advisory'",
            [lockKey],
          )
        ).rows[0]?.n ?? 0;
      if (waiting === expected) {
        console.info(
          `FN2: pg_locks + pg_stat_activity confirmed ${String(waiting)} advisory waiters`,
        );
        return;
      }
      if (Date.now() > deadline)
        throw new Error(
          `Expected ${String(expected)} advisory lock waiters, saw ${String(waiting)}`,
        );
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 20);
      });
    }
  };
  const creditPins = async () => {
    const pins = (
      await state().db.query<{
        quote_revision_id: string;
        quote_snapshot_id: string;
        credit_limit_id: string;
      }>(
        'SELECT o.quote_revision_id,o.quote_snapshot_id,d.credit_limit_id FROM sales_orders o JOIN credit_decisions d ON d.id=o.credit_decision_id AND d.tenant_id=o.tenant_id WHERE o.id=$1 AND o.tenant_id=$2',
        [order(), tenant()],
      )
    ).rows[0];
    if (!pins) throw new Error('Released order pins missing');
    return {
      customerId: customer(),
      quoteRevisionId: pins.quote_revision_id,
      quoteSnapshotId: pins.quote_snapshot_id,
      creditLimitId: pins.credit_limit_id,
      validUntil: '2099-01-01T00:00:00Z',
    };
  };

  beforeAll(async () => {
    fixture = await ownedCommercialGraph();
    repository = new PostgresQuoteToCashRepository(state().db);
    expect((await state().db.query('SHOW default_transaction_isolation')).rows).toEqual([
      { default_transaction_isolation: 'read committed' },
    ]);
    expect(
      await state().db.transaction(
        async (tx) => (await tx.query('SHOW transaction_isolation')).rows,
      ),
    ).toEqual([{ transaction_isolation: 'read committed' }]);
    http = await ownedHttpApi(state());
    user = await http.user(state().context.actor.employeeId, tenant());
    await user.grant(['ar:post', 'ar:read', 'credit:evaluate', 'credit:read'], ['COMPANY']);
  }, 60_000);
  afterAll(async () => {
    try {
      await http?.close();
    } finally {
      await fixture?.close();
      fixture = undefined;
    }
  });

  it(
    '真实 HTTP：超额开票 409、零新增，随后信用评估仍为 201',
    async () => {
      const count = async () =>
        (
          await state().db.query(
            'SELECT (SELECT count(*)::int FROM ar_documents) documents,(SELECT count(*)::int FROM ar_open_items) items,(SELECT count(*)::int FROM audit_events) audit,(SELECT count(*)::int FROM domain_event_outbox) events,(SELECT count(*)::int FROM commercial_command_results) commands',
          )
        ).rows;
      const before = await count();
      const rejected = await user.request(
        '/api/v1/ar-open-items',
        'POST',
        invoice(order(), 'INV-CAP-REAL-HTTP', '0.000001'),
        randomUUID(),
      );
      const rejection: unknown = await rejected.json();
      const afterRejected = await count();
      const credit = await user.request(
        '/api/v1/credit-decisions',
        'POST',
        await creditPins(),
        randomUUID(),
      );
      const creditBody: unknown = await credit.json();
      console.info(
        `FN2: real HTTP invoice=${String(rejected.status)}, credit=${String(credit.status)}`,
      );
      expect(rejected.status).toBe(409);
      expect(afterRejected).toEqual(before);
      expect(rejection).toMatchObject({
        error: {
          code: 'conflict',
          message:
            '累计开票金额超过订单金额，已拒绝过账：订单金额 CNY 950000，已开票 950000，本次 0.000001，合计 950000.000001',
        },
      });
      // 信用评估会写自身证据，先前拒绝的请求仍不得产生应收单据或开放项。
      expect(credit.status).toBe(201);
      expect(creditBody).toMatchObject({ effectiveStatus: 'PENDING_APPROVAL' });
      const after = await count();
      expect(after[0]).toMatchObject({ documents: before[0]?.documents, items: before[0]?.items });
    },
    SLOW,
  );

  it(
    '口径钉定：累计开票求和、触发器派生的未开票额、evaluateCredit 三者同式',
    async () => {
      const { db, context } = state();
      const tenantId = tenant();
      // 数据要能区分口径：已全额开票且有过核销分配的订单（夹具）、挂在订单上的贷项通知、
      // 部分开票的订单、未开票订单。
      await post({
        ...invoice(order(), 'CN-CAP-CALIBER', '1000'),
        documentType: 'CREDIT_NOTE',
      });
      const partial = await copy('CAP-ORDER-PARTIAL');
      await post(invoice(partial, 'INV-CAP-CALIBER-PARTIAL', '800000'));
      await copy('CAP-ORDER-OPEN');
      const orders = (
        await db.query<{ id: string; total: string }>(
          "SELECT o.id,o.total::text total FROM sales_orders o WHERE o.tenant_id=$1 AND o.customer_id=$2 AND o.currency='CNY' AND o.status='RELEASED' ORDER BY o.id",
          [tenantId, customer()],
        )
      ).rows;
      expect(orders).toHaveLength(3);
      let uninvoiced = 0n;
      for (const row of orders)
        uninvoiced +=
          minorUnits(row.total) -
          minorUnits(await repository.invoicedOrderAmount(db, tenantId, row.id));
      // 950000 − 950000（全额）+ 950000 − 800000（部分）+ 950000 − 0（未开票）。
      const expected = fromMinorUnits(uninvoiced);
      expect(expected).toBe('1100000.000000');
      // 触发器一侧：直接插敞口快照，各金额由 derive_credit_exposure 在服务端派生。
      const trigger = (
        await db.query<{ amount: string; exposure: string }>(
          "INSERT INTO credit_exposure_snapshots(tenant_id,customer_id,currency,actor_id,correlation_id,idempotency_key) VALUES($1,$2,'CNY',$3,$4,$5) RETURNING uninvoiced_order_amount::text amount,exposure_amount::text exposure",
          [tenantId, customer(), context.actor.employeeId, randomUUID(), randomUUID()],
        )
      ).rows[0];
      expect(trigger?.amount).toBe(expected);
      // evaluateCredit 自算的结果也要比对；只看其快照不足以发现 SQL 漂移，因为触发器会覆盖快照金额。
      const decision = await repository.evaluateCredit(
        await creditPins(),
        randomUUID(),
        context,
        randomUUID(),
      );
      expect(decision.exposureAmount).toBe(trigger?.exposure);
      const snapshotId = decision.exposureSnapshotId;
      if (typeof snapshotId !== 'string') throw new Error('Exposure snapshot id missing');
      expect(
        (
          await db.query<{ amount: string }>(
            'SELECT uninvoiced_order_amount::text amount FROM credit_exposure_snapshots WHERE id=$1',
            [snapshotId],
          )
        ).rows,
      ).toEqual([{ amount: expected }]);
    },
    SLOW,
  );

  it(
    '并发：合计超额的两个开票请求恰有一个成功，台账恰新增一行',
    async () => {
      const spare = await copy('CAP-ORDER-RACE');
      await post(invoice(spare, 'INV-CAP-RACE-SEED', '800000')); // 剩余可开票 150000
      const lockKey = `${tenant()}:${customer()}:credit-ledger`;
      const connection = process.env.DATABASE_URL;
      if (!connection) throw new Error('DATABASE_URL required');
      // 另一个连接池里的事务占住同一把锁；放行即 COMMIT。
      const holder = new Database(connection);
      let settled: Promise<PromiseSettledResult<Response>[]> | undefined;
      try {
        await holder.transaction(async (tx: SqlClient) => {
          expect((await tx.query('SHOW transaction_isolation')).rows).toEqual([
            { transaction_isolation: 'read committed' },
          ]);
          await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [lockKey]);
          settled = Promise.allSettled([
            user.request(
              '/api/v1/ar-open-items',
              'POST',
              invoice(spare, 'INV-CAP-RACE-A', '100000'),
              randomUUID(),
            ),
            user.request(
              '/api/v1/ar-open-items',
              'POST',
              invoice(spare, 'INV-CAP-RACE-B', '100000'),
              randomUUID(),
            ),
          ]);
          await waitForWaiters(lockKey, 2);
        });
      } finally {
        await holder.close();
      }
      if (!settled) throw new Error('Concurrent HTTP requests not dispatched');
      const results = await Promise.all(
        (await settled).map(async (result) => {
          if (result.status !== 'fulfilled') throw result.reason;
          const body: unknown = await result.value.json();
          return { status: result.value.status, body };
        }),
      );
      console.info(
        `FN2: concurrent HTTP statuses=${results
          .map((result) => String(result.status))
          .sort()
          .join(',')}`,
      );
      expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
      expect(results.find((result) => result.status === 409)?.body).toMatchObject({
        error: {
          code: 'conflict',
          message:
            '累计开票金额超过订单金额，已拒绝过账：订单金额 CNY 950000，已开票 900000，本次 100000，合计 1000000',
        },
      });
      expect(
        (
          await state().db.query<{ n: number; total: string }>(
            'SELECT count(*)::int n,sum(d.amount)::text total FROM ar_documents d WHERE d.sales_order_id=$1',
            [spare],
          )
        ).rows,
      ).toEqual([{ n: 2, total: '900000.000000' }]);
    },
    SLOW,
  );
});
