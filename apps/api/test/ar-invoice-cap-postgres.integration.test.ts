import { randomUUID } from 'node:crypto';
import type { AuthorizationContext } from '@kingturf/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';
import { PostgresQuoteToCashRepository } from '../src/qtc-repositories.js';
import { ownedCommercialGraph } from './fixtures/owned-commercial-graph.js';
import { copyReleasedOrder } from './fixtures/released-order-copy.js';

// TD-FIN-003（FN2）：超额开票准入的真库契约。
// 裁定（项目所有者，2026-11-26）：累计开票不得超过订单金额——超过则拒绝；不设尾差容差（精确比较）。
// 校验在 PostgresQuoteToCashRepository.postAr 的事务内、持有「租户:客户:credit-ledger」事务级
// advisory 锁之后执行；两条 HTTP 轨（桥轨 routes/fastify/ar-open-items.ts、legacy routes/qtc-ar-post.ts）
// 都调这一个方法。SQL 只在这里真正执行（仓储替身执行不到 SQL）。
// 夹具：ownedCommercialGraph 经真实应用分派建出完整商业图，其中演示图订单（950000）已被夹具自己
// 全额开票（SENSITIVE-AR = 订单金额）——正是 fin1-6 记录的场景。
// 用例按声明顺序执行：前两例必须在复制出未开票订单之前跑完（否则同客其它订单的未开票额会抵掉
// 负数，23514 不再出现）。
const DAY = 86_400_000;
const SLOW = 30_000;
const dueIn = (days: number): string => new Date(Date.now() + days * DAY).toISOString();
const ORDER_TOTAL = '950000';

type Graph = Awaited<ReturnType<typeof ownedCommercialGraph>>;
type PostInput = Parameters<PostgresQuoteToCashRepository['postAr']>[0];
type Attempt = Promise<Record<string, unknown>>;

const capMessage = (invoiced: string, posted: string, combined: string): string =>
  `累计开票金额超过订单金额，已拒绝过账：订单金额 CNY ${ORDER_TOTAL}，已开票 ${invoiced}，本次 ${posted}，合计 ${combined}`;

describe('TD-FIN-003 invoice cap on the real Quote-to-Cash ledger', () => {
  let fixture: Graph | undefined;
  let repository: PostgresQuoteToCashRepository;
  const state = (): Graph => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    return fixture;
  };
  const tenant = (): string => state().context.actor.companyId;
  const customer = (): string => state().graph.customerId;
  const order = (): string => state().graph.orderId;
  const post = (input: PostInput, idempotencyKey = randomUUID()): Attempt =>
    repository.postAr(input, idempotencyKey, state().context, randomUUID());
  const invoice = (
    salesOrderId: string | null,
    documentNumber: string,
    amount: string,
    overrides: Partial<PostInput> = {},
  ): PostInput => ({
    customerId: customer(),
    salesOrderId,
    documentNumber,
    documentType: 'INVOICE',
    currency: 'CNY',
    amount,
    dueAt: dueIn(30),
    ...overrides,
  });
  // 台账与台账痕迹：应收单据、开放项、ar.posted 审计。
  const ledger = async (): Promise<unknown> =>
    (
      await state().db.query<{ documents: number; items: number; posted: number }>(
        "SELECT (SELECT count(*)::int FROM ar_documents) documents,(SELECT count(*)::int FROM ar_open_items) items,(SELECT count(*)::int FROM audit_events WHERE action='ar.posted') posted",
      )
    ).rows;
  // 复制演示图订单（同一商业图的全部钉定），得到一张未开票订单。
  const copyOrder = (orderNumber: string): Promise<string> =>
    copyReleasedOrder(state().db, { orderId: order(), companyId: tenant() }, orderNumber);
  const evaluation = async () => {
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
  // 真实应用分派（buildApp.dispatch）：legacy 轨与桥轨都走到真实仓储。认证以替身给出全权上下文。
  const dispatch = async (track: 'legacy' | 'bridge', body: Record<string, unknown>) => {
    const permissions = new Map<PermissionKey, { scopes: string[]; fields: null }>([
      ['ar:post', { scopes: ['COMPANY'], fields: null }],
      ['ar:read', { scopes: ['COMPANY'], fields: null }],
    ]);
    const authz = {
      actor: state().context.actor,
      permissions,
      scopeAnchors: new Map(),
    } as unknown as AuthorizationContext;
    const dependencies = {
      auth: { authenticate: () => Promise.resolve(authz) },
      organizations: {},
      employees: {},
      quoteToCash: repository,
      // 桥轨只在挂了 commercial 依赖时被认领（app.ts 的 if (dependencies.commercial)）。
      ...(track === 'bridge' ? { commercial: {} } : {}),
    } as unknown as ApiDependencies;
    const correlation = randomUUID();
    const response = await buildApp(dependencies).dispatch({
      method: 'POST',
      pathname: '/api/v1/ar-open-items',
      headers: {
        authorization: 'Bearer fixture',
        'x-correlation-id': correlation,
        'idempotency-key': randomUUID(),
      },
      body,
    });
    return { response, correlation };
  };

  beforeAll(async () => {
    fixture = await ownedCommercialGraph();
    repository = new PostgresQuoteToCashRepository(state().db);
  }, 60_000);
  afterAll(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it(
    '已全额开票的订单再开票：409 中文提示含三个金额，台账零新增',
    async () => {
      const before = await ledger();
      const correlation = randomUUID(),
        idempotencyKey = randomUUID();
      await expect(
        repository.postAr(
          invoice(order(), 'INV-CAP-OVER', '12.34'),
          idempotencyKey,
          state().context,
          correlation,
        ),
      ).rejects.toMatchObject({
        code: 'conflict',
        message: capMessage('950000', '12.34', '950012.34'),
      });
      expect(await ledger()).toEqual(before);
      expect(
        (
          await state().db.query<{ audit: number; events: number }>(
            'SELECT (SELECT count(*)::int FROM audit_events WHERE correlation_id=$1) audit,(SELECT count(*)::int FROM domain_event_outbox WHERE correlation_id=$1) events',
            [correlation],
          )
        ).rows,
      ).toEqual([{ audit: 0, events: 0 }]);
      expect(
        (
          await state().db.query<{ n: number }>(
            'SELECT count(*)::int n FROM commercial_command_results WHERE tenant_id=$1 AND idempotency_key=$2',
            [tenant(), idempotencyKey],
          )
        ).rows,
      ).toEqual([{ n: 0 }]);
    },
    SLOW,
  );

  it(
    '被拒绝之后，同客同币种的信用评估照常完成，不再触发未开票金额约束（23514）',
    async () => {
      await expect(
        repository.evaluateCredit(await evaluation(), randomUUID(), state().context, randomUUID()),
      ).resolves.toMatchObject({ effectiveStatus: 'PENDING_APPROVAL' });
    },
    SLOW,
  );

  it(
    '两条 HTTP 轨都回 409 与同一句提示，信封带关联 ID',
    async () => {
      const body = invoice(order(), 'INV-CAP-HTTP', '12.34');
      const before = await ledger();
      for (const track of ['legacy', 'bridge'] as const) {
        const { response, correlation } = await dispatch(track, body);
        expect(response.statusCode).toBe(409);
        expect(response.body).toEqual({
          error: {
            code: 'conflict',
            message: capMessage('950000', '12.34', '950012.34'),
            correlationId: correlation,
          },
        });
      }
      expect(await ledger()).toEqual(before);
    },
    SLOW,
  );

  it(
    '边界：恰好等于订单金额的最后一张发票仍然成功；超出 0.000001 即拒绝',
    async () => {
      const spare = await copyOrder('CAP-ORDER-BOUNDARY');
      await post(invoice(spare, 'INV-CAP-EDGE-1', '800000'));
      await expect(
        post(invoice(spare, 'INV-CAP-EDGE-OVER', '150000.000001')),
      ).rejects.toMatchObject({
        code: 'conflict',
        message: capMessage('800000', '150000.000001', '950000.000001'),
      });
      const last = invoice(spare, 'INV-CAP-EDGE-LAST', '150000');
      const idempotencyKey = randomUUID();
      const created = await post(last, idempotencyKey);
      // 幂等重放：同一键、同一请求返回原结果，不新增台账（重放先于前置校验）。
      expect(await repository.postAr(last, idempotencyKey, state().context, randomUUID())).toEqual(
        created,
      );
      await expect(post(invoice(spare, 'INV-CAP-EDGE-TINY', '0.000001'))).rejects.toMatchObject({
        code: 'conflict',
        message: capMessage('950000', '0.000001', '950000.000001'),
      });
      expect(
        (
          await state().db.query<{ n: number; total: string }>(
            'SELECT count(*)::int n,sum(d.amount)::text total FROM ar_documents d WHERE d.sales_order_id=$1',
            [spare],
          )
        ).rows,
      ).toEqual([{ n: 2, total: '950000.000000' }]);
    },
    SLOW,
  );

  it(
    '被拒绝的请求不占用幂等键：同一键随后可提交合法请求',
    async () => {
      const idempotencyKey = randomUUID();
      await expect(
        post(invoice(order(), 'INV-CAP-BURN', '1'), idempotencyKey),
      ).rejects.toMatchObject({
        code: 'conflict',
      });
      await expect(
        post(invoice(null, 'INV-CAP-RETRY', '1'), idempotencyKey),
      ).resolves.toMatchObject({ documentNumber: 'INV-CAP-RETRY' });
    },
    SLOW,
  );

  it(
    '不属本裁定的写入维持原样：挂订单的贷项通知、未挂订单的发票都不受上限约束',
    async () => {
      // 贷项通知暂不冲减累计开票（项目所有者 2026-11-26 裁定），本身也不设上限。
      await expect(
        post(invoice(order(), 'CN-CAP-NOTE', '1000', { documentType: 'CREDIT_NOTE' })),
      ).resolves.toMatchObject({ documentType: 'CREDIT_NOTE' });
      await expect(post(invoice(null, 'INV-CAP-UNLINKED', '1'))).resolves.toMatchObject({
        salesOrderId: null,
      });
    },
    SLOW,
  );

  it(
    '币种与订单不一致的请求仍由既有守卫拒绝，提示不被上限校验覆盖',
    async () => {
      const mismatched = invoice(order(), 'INV-CAP-CURRENCY', '12.34', { currency: 'USD' });
      await expect(post(mismatched)).rejects.toMatchObject({
        code: 'P0001',
        message: 'AR document is inconsistent with its sales order',
      });
      const { response, correlation } = await dispatch('bridge', mismatched);
      expect(response.statusCode).toBe(409);
      expect(response.body).toEqual({
        error: {
          code: 'conflict',
          message: '应收单据与关联销售订单的客户或币种不一致，请核对后重试',
          correlationId: correlation,
        },
      });
    },
    SLOW,
  );
});
