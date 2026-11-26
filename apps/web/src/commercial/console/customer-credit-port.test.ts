import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrmController } from '../../crm/controller';
import { creditSummaryFromLedgers, creditUsageOf } from '../../crm/crm-ux';
import type { CrmApi, CrmPermission } from '../../crm/types';
import type { CustomerConsolePorts } from './customer-ports';
import { creditPortFor } from './customer-credit-port';

// TD-CRM-006：客户 360 信用概要由前端直连既有信用端点（/api/v1/credit-limits、/credit-decisions）。
// 这里钉定：① 无 credit:read 不注入端口、不请求；② 有权限时经 CRM 控制器各请求一次并合成概要；
// ③ 客户没有信用记录 → null（卡片空态）；④ 台账 → 概要的逐字段口径。请求失败的卡片形态见
// customer-console.test.tsx（端口替身拒绝 → 卡内原因 + 重试）。
const NOW = Date.parse('2026-11-26T00:00:00Z');
const at = (day: string): string => `${day}T00:00:00+00:00`;

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const limits = [
  {
    customer_id: 'c1',
    currency: 'USD',
    amount: 50000,
    effective_at: at('2026-06-01'),
    expires_at: at('2026-12-01'),
  },
  {
    customer_id: 'c1',
    currency: 'CNY',
    amount: 1000000,
    effective_at: at('2026-01-01'),
    expires_at: at('2027-01-01'),
  },
];
const decisions = [
  { customer_id: 'c2', effective_status: 'REJECTED', currency: 'EUR', exposureAmount: 1 },
  {
    customer_id: 'c1',
    effective_status: 'APPROVED',
    decided_at: '2026-11-20T01:00:00+00:00',
    currency: 'CNY',
    exposureAmount: 750000,
  },
  { customer_id: 'c1', effective_status: 'REJECTED', currency: 'CNY', exposureAmount: 10 },
];

const apiDouble = (credit: boolean) => {
  const listCreditLimits = vi.fn().mockResolvedValue(limits);
  const listCreditDecisions = vi.fn().mockResolvedValue(decisions);
  const api = (credit ? { listCreditLimits, listCreditDecisions } : {}) as unknown as CrmApi;
  return { api, listCreditLimits, listCreditDecisions };
};

const permissionsWith = (...keys: readonly CrmPermission[]): ReadonlySet<CrmPermission> =>
  new Set(keys);

describe('creditPortFor（宿主端口装配）', () => {
  it('无 credit:read：不注入 loadCredit，也不发任何信用请求', () => {
    const { api, listCreditLimits, listCreditDecisions } = apiDouble(true);
    const controller = new CrmController(permissionsWith('customer:read'), api);
    const port = creditPortFor(controller.permissions, controller);
    expect('loadCredit' in port).toBe(false);
    expect(listCreditLimits).not.toHaveBeenCalled();
    expect(listCreditDecisions).not.toHaveBeenCalled();
  });

  it('有 credit:read：注入端口；经控制器对两个端点各请求一次并合成该客户的概要', async () => {
    const { api, listCreditLimits, listCreditDecisions } = apiDouble(true);
    const controller = new CrmController(permissionsWith('customer:read', 'credit:read'), api);
    const port = creditPortFor(controller.permissions, controller);
    const loadCredit = (port as CustomerConsolePorts).loadCredit;
    if (!loadCredit) throw new Error('loadCredit port missing');
    expect(await loadCredit('c1')).toEqual({
      limit: { currency: 'USD', amount: 50000 },
      exposure: { currency: 'CNY', amount: 750000 },
      decision: { status: 'APPROVED', decidedAt: '2026-11-20T01:00:00+00:00' },
    });
    expect(listCreditLimits).toHaveBeenCalledTimes(1);
    expect(listCreditDecisions).toHaveBeenCalledTimes(1);
  });

  it('HTTP 客户端不带信用读取方法（旧替身）：即使有权限也不注入', () => {
    const controller = new CrmController(
      permissionsWith('customer:read', 'credit:read'),
      apiDouble(false).api,
    );
    expect('loadCredit' in creditPortFor(controller.permissions, controller)).toBe(false);
  });
});

describe('creditSummaryFromLedgers（台账 → 概要口径）', () => {
  it('额度取当前生效中最新生效的一条；敞口与最近决定取该客户首条决定；别的客户不计', () => {
    const summary = creditSummaryFromLedgers('c1', limits, decisions, NOW);
    expect(summary).toEqual({
      limit: { currency: 'USD', amount: 50000 },
      exposure: { currency: 'CNY', amount: 750000 },
      decision: { status: 'APPROVED', decidedAt: '2026-11-20T01:00:00+00:00' },
    });
    if (!summary) throw new Error('summary missing');
    // 多币种：各按自身币种保留，币种不同时使用率不可计算（现有卡片 UI 口径）。
    expect(creditUsageOf(summary)).toEqual({ ratio: null, level: 'ok' });
  });

  it('未生效或已过期的额度不算当前额度；没有生效额度时额度为空', () => {
    const window = [
      { ...limits[0], customer_id: 'c9', expires_at: at('2026-06-15') },
      { ...limits[1], customer_id: 'c9', effective_at: at('2027-01-01') },
    ];
    const summary = creditSummaryFromLedgers('c9', window, [], NOW);
    expect(summary).toBeNull();
    const pending = creditSummaryFromLedgers(
      'c9',
      window,
      [{ customer_id: 'c9', status: 'PENDING_APPROVAL', currency: 'CNY' }],
      NOW,
    );
    expect(pending).toEqual({
      limit: null,
      exposure: null,
      decision: { status: 'PENDING_APPROVAL', decidedAt: '' },
    });
  });

  it('沿用端点顺序取行：跳过未生效额度，最近决定按创建顺序取首条，不按审批时间重排', () => {
    const summary = creditSummaryFromLedgers(
      'c1',
      [{ ...limits[0], effective_at: at('2026-12-01') }, ...limits],
      [
        {
          customer_id: 'c1',
          created_at: at('2026-11-25'),
          effective_status: 'PENDING_APPROVAL',
          decided_at: null,
          currency: 'USD',
          exposureAmount: '12000.000000',
        },
        {
          customer_id: 'c1',
          created_at: at('2026-11-24'),
          effective_status: 'APPROVED',
          decided_at: at('2026-11-26'),
          currency: 'CNY',
          exposureAmount: '750000.000000',
        },
      ],
      NOW,
    );
    expect(summary).toEqual({
      limit: { currency: 'USD', amount: 50_000 },
      exposure: { currency: 'USD', amount: 12_000 },
      decision: { status: 'PENDING_APPROVAL', decidedAt: '' },
    });
  });

  it('客户没有信用记录或客户编号为空 → null（卡片空态）', () => {
    expect(creditSummaryFromLedgers('c-none', limits, decisions, NOW)).toBeNull();
    expect(creditSummaryFromLedgers('', limits, decisions, NOW)).toBeNull();
    expect(creditSummaryFromLedgers(undefined, limits, decisions, NOW)).toBeNull();
  });
});
