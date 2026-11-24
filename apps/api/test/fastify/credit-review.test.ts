import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { ApiDependencies } from '../../src/app.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// WF-A（TD-WF-013）：credit-review Fastify 组的 PUT 审批在仓储拒绝时的契约。
// 评估人审批自己发起的信用决定由数据库触发器 enforce_credit_approval_separation 拒绝
//（迁移 0026，RAISE EXCEPTION → SQLSTATE P0001）；本端点把它映射成 403 + 中文说明
//（此前是 500）。映射只做在这个端点、只认这一条消息；其余异常仍 500 且不回显原始消息。
// 解析链与 200 路径本身（幂等键必填、decision 取值、调用实参）在 legacy
// qtc-credit-approval-route-contract 里有逐字断言，这里钉的是桥轨 PUT 的同一形状。
const tenant = '11111111-1111-4111-8111-111111111111';
const decisionId = '55555555-5555-4555-8555-555555555555';
const actor = { companyId: tenant, employeeId: 'e-1' };
const SELF_APPROVAL_MESSAGE =
  '职责分离：发起信用评估的人不能审批这条信用决定，请由另一位审批人处理';
const selfApproval = () =>
  Object.assign(new Error('credit evaluator cannot approve own decision'), {
    code: 'P0001',
    where: 'PL/pgSQL function enforce_credit_approval_separation() line 2 at RAISE',
  });
type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
// qtc 仓储替身：只把被测的那个方法换成替身，其余保持 vi.fn()。
const qtc = (
  overrides: {
    approveCredit?: ReturnType<typeof vi.fn>;
    evaluateCredit?: ReturnType<typeof vi.fn>;
  } = {},
) =>
  ({
    list: vi.fn(),
    setCreditLimit: vi.fn(),
    evaluateCredit: overrides.evaluateCredit ?? vi.fn(),
    approveCredit:
      overrides.approveCredit ??
      vi.fn().mockResolvedValue({ id: decisionId, effectiveStatus: 'APPROVED' }),
  }) as unknown as Qtc;
type Grant = { scopes: string[]; fields: readonly string[] | null };
const scopeFor = (
  repository: Qtc | null,
  grants: Readonly<Record<string, Grant>> = {
    'credit:approve': { scopes: ['COMPANY'], fields: null },
    'credit:read': { scopes: ['COMPANY'], fields: null },
  },
) => ({
  authorization: {
    actor,
    permissions: new Map(Object.entries(grants)),
  } as unknown as AuthorizationContext,
  dependencies: { quoteToCash: repository, commercial: {} } as unknown as ApiDependencies,
  correlationId: 'corr-1',
});
const approve = (
  scope: ReturnType<typeof scopeFor>,
  body: Record<string, unknown> = { decision: 'APPROVED', reason: '额度充足' },
  headers: Record<string, string> = { 'idempotency-key': 'key-1' },
) =>
  dispatchFastifyRouteGroup(
    {
      method: 'PUT',
      pathname: `/api/v1/credit-decisions/${decisionId}/state`,
      headers: { 'x-correlation-id': 'corr-1', ...headers },
      body,
    },
    scope,
  );
// 响应体是 unknown；收窄成记录后再读字段（不用 any）。
const recordOf = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Expected a JSON object');
  return value as Record<string, unknown>;
};
const errorOf = (response: { body: unknown } | null) => recordOf(recordOf(response?.body).error);

describe('credit-review fastify bridge track: self-approval (TD-WF-013)', () => {
  it('PUT state：评估人自批（触发器 P0001）→ 403，带中文说明，不回显数据库原始消息', async () => {
    const approveCredit = vi.fn().mockRejectedValue(selfApproval());
    const response = await approve(scopeFor(qtc({ approveCredit })));
    expect(response?.statusCode).toBe(403);
    expect(errorOf(response)).toEqual({
      code: 'forbidden',
      message: SELF_APPROVAL_MESSAGE,
      correlationId: 'corr-1',
    });
    expect(JSON.stringify(response?.body)).not.toMatch(/credit evaluator|PL\/pgSQL|RAISE/u);
    // 被拒的调用没有带着别的东西：实参与正常审批完全一样。
    expect(approveCredit.mock.calls[0]?.slice(0, 4)).toEqual([
      decisionId,
      'APPROVED',
      '额度充足',
      'key-1',
    ]);
  });

  it('PUT state：批准与拒绝两种决定遇自批都是 403 + 同一说明', async () => {
    for (const decision of ['APPROVED', 'REJECTED'] as const) {
      const response = await approve(
        scopeFor(qtc({ approveCredit: vi.fn().mockRejectedValue(selfApproval()) })),
        { decision, reason: '额度不足' },
      );
      expect(response?.statusCode).toBe(403);
      expect(errorOf(response).message).toBe(SELF_APPROVAL_MESSAGE);
    }
  });

  it('PUT state：成功路径不受影响——调用实参正确，200 + 载荷', async () => {
    const approveCredit = vi
      .fn()
      .mockResolvedValue({ id: decisionId, effectiveStatus: 'APPROVED' });
    const response = await approve(
      scopeFor(qtc({ approveCredit }), {
        'credit:approve': { scopes: ['COMPANY'], fields: null },
        'credit:read': { scopes: ['COMPANY'], fields: ['effectiveStatus'] },
      }),
    );
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ id: decisionId, effectiveStatus: 'APPROVED' });
    expect(approveCredit.mock.calls[0]?.slice(0, 4)).toEqual([
      decisionId,
      'APPROVED',
      '额度充足',
      'key-1',
    ]);
    expect(approveCredit.mock.calls[0]?.[4]).toMatchObject({
      actor,
      scopes: ['COMPANY'],
      anchors: [],
    });
    expect(approveCredit.mock.calls[0]?.[5]).toBe('corr-1');
  });

  it('PUT state：其它数据库错误保持 500 且响应不含原始消息（不做全局映射）', async () => {
    const failures = [
      // 同为触发器拒绝（P0001），但不是职责分离那一条。
      Object.assign(new Error('credit decision requires exact unexpired issued quote snapshot'), {
        code: 'P0001',
      }),
      Object.assign(new Error('some other guard rejected this'), { code: 'P0001' }),
      // 消息相同但不是 P0001：不认。
      Object.assign(new Error('credit evaluator cannot approve own decision'), { code: 'XX000' }),
      Object.assign(
        new Error(
          'duplicate key value violates unique constraint "credit_approvals_one_effective_decision"',
        ),
        { code: '23505', constraint: 'credit_approvals_one_effective_decision' },
      ),
    ];
    for (const failure of failures) {
      const response = await approve(
        scopeFor(qtc({ approveCredit: vi.fn().mockRejectedValue(failure) })),
      );
      expect(response?.statusCode).toBe(500);
      expect(response?.body).toEqual({
        error: {
          code: 'internal_error',
          message: 'Internal server error',
          correlationId: 'corr-1',
        },
      });
    }
  });

  it('PUT state：仓储的 DomainError 照旧按原状态码映射（404 / 409 不受影响）', async () => {
    const notFound = await approve(
      scopeFor(
        qtc({
          approveCredit: vi
            .fn()
            .mockRejectedValue(new DomainError('not_found', 'Credit decision not found')),
        }),
      ),
    );
    expect(notFound?.statusCode).toBe(404);
    expect(errorOf(notFound)).toMatchObject({
      code: 'not_found',
      message: 'Credit decision not found',
    });
    const conflict = await approve(
      scopeFor(
        qtc({
          approveCredit: vi
            .fn()
            .mockRejectedValue(
              new DomainError('conflict', 'Idempotency-Key was used for a different command'),
            ),
        }),
      ),
    );
    expect(conflict?.statusCode).toBe(409);
    expect(errorOf(conflict)).toMatchObject({ code: 'conflict' });
  });

  it('PUT state：解析链与授权负例的消息保持不变（映射只包住仓储调用）', async () => {
    const approveCredit = vi
      .fn()
      .mockResolvedValue({ id: decisionId, effectiveStatus: 'APPROVED' });
    const repository = qtc({ approveCredit });
    const missingKey = await approve(scopeFor(repository), undefined, {});
    expect(missingKey?.statusCode).toBe(400);
    expect(errorOf(missingKey).message).toBe('Idempotency-Key is required');
    const unsupported = await approve(scopeFor(repository), { decision: 'PENDING', reason: 'x' });
    expect(unsupported?.statusCode).toBe(400);
    expect(errorOf(unsupported).message).toBe('decision is unsupported');
    const extra = await approve(scopeFor(repository), {
      decision: 'APPROVED',
      reason: 'x',
      note: 'y',
    });
    expect(extra?.statusCode).toBe(400);
    expect(errorOf(extra).message).toBe('Unsupported fields: note');
    // 认领清单只匹配十六进制段：非 UUID 的路径不由桥处理，原样返回 null 落回 legacy 轨
    //（既有行为，与本次映射无关）。
    const unclaimed = await dispatchFastifyRouteGroup(
      {
        method: 'PUT',
        pathname: '/api/v1/credit-decisions/not-a-uuid/state',
        headers: { 'x-correlation-id': 'corr-1', 'idempotency-key': 'key-1' },
        body: { decision: 'APPROVED', reason: 'x' },
      },
      scopeFor(repository),
    );
    expect(unclaimed).toBeNull();
    expect(approveCredit).not.toHaveBeenCalled();
    const denied = await approve(
      scopeFor(repository, { 'credit:read': { scopes: ['COMPANY'], fields: null } }),
    );
    expect(denied?.statusCode).toBe(403);
    expect(errorOf(denied).message).toBe('Permission denied');
    expect(approveCredit).not.toHaveBeenCalled();
  });

  it('映射只做在 PUT state：POST 评估遇到同一条触发器消息仍是 500', async () => {
    const evaluateCredit = vi.fn().mockRejectedValue(selfApproval());
    const response = await dispatchFastifyRouteGroup(
      {
        method: 'POST',
        pathname: '/api/v1/credit-decisions',
        headers: { 'x-correlation-id': 'corr-1', 'idempotency-key': 'key-1' },
        body: {
          customerId: '22222222-2222-4222-8222-222222222222',
          quoteRevisionId: '33333333-3333-4333-8333-333333333333',
          quoteSnapshotId: '44444444-4444-4444-8444-444444444444',
          creditLimitId: '66666666-6666-4666-8666-666666666666',
          validUntil: '2099-03-31T23:59:59.000Z',
        },
      },
      scopeFor(qtc({ evaluateCredit }), {
        'credit:evaluate': { scopes: ['COMPANY'], fields: null },
      }),
    );
    expect(response?.statusCode).toBe(500);
    expect(errorOf(response).code).toBe('internal_error');
  });
});
