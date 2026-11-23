// CRM-UX 展示助手单测（纯函数，无 DOM）。时间用例以本地时间构造，期望与机器时区无关。
import { describe, expect, it } from 'vitest';
import {
  activityIconOf,
  amountsLabel,
  closedOpportunitiesOf,
  customerStatsOf,
  CUSTOMER_LIST_CAP,
  customerStatusLabel,
  dateTimeLabelOf,
  dayKeyOf,
  dayLabelOf,
  UNKNOWN_DAY,
  funnelOf,
  groupByDay,
  initialOf,
  isPoolLead,
  isStale,
  leadSourceIconOf,
  leadStatusLabel,
  maskEmail,
  maskPhone,
  opportunityStageLabel,
  recordOf,
  relativeTimeOf,
  relatedOf,
  sortActivities,
  textOf,
  timeOf,
} from './crm-ux';

const NOW = new Date(2026, 10, 23, 10, 0).getTime();
// 本地 2026-11-<day> <hour>:<minute> 的 ISO 串。
const at = (day: number, hour: number, minute = 0): string =>
  new Date(2026, 10, day, hour, minute).toISOString();

describe('CRM-UX 时间呈现', () => {
  it('timeOf/dayKeyOf：ISO 串按本地日历取键，不可解析返回 null', () => {
    expect(timeOf(at(23, 9, 30))).toBe(new Date(2026, 10, 23, 9, 30).getTime());
    expect(dayKeyOf(at(23, 9, 30))).toBe('2026-11-23');
    expect(dayKeyOf('2026-02-05T00:00:00Z')).toMatch(/^2026-02-0[45]$/u);
    expect(timeOf('')).toBeNull();
    expect(timeOf(undefined)).toBeNull();
    expect(timeOf('not-a-date')).toBeNull();
    expect(dayKeyOf(null)).toBeNull();
  });

  it('relativeTimeOf：分钟/小时/昨天/天数/超 30 天回落日期', () => {
    expect(relativeTimeOf(at(23, 9, 30), NOW)).toBe('30 分钟前');
    expect(relativeTimeOf(at(23, 9), NOW)).toBe('1 小时前');
    expect(relativeTimeOf(at(23, 0, 1), NOW)).toBe('9 小时前');
    expect(relativeTimeOf(at(22, 23, 30), NOW)).toBe('昨天');
    expect(relativeTimeOf(at(21, 23, 30), NOW)).toBe('2 天前');
    expect(relativeTimeOf(new Date(2026, 9, 23, 10, 0).toISOString(), NOW)).toBe('2026-10-23');
    expect(relativeTimeOf(new Date(2026, 9, 24, 10, 0).toISOString(), NOW)).toBe('30 天前');
    expect(relativeTimeOf(new Date(NOW - 10_000).toISOString(), NOW)).toBe('刚刚');
    expect(relativeTimeOf(new Date(NOW + 3_600_000).toISOString(), NOW)).toBe('刚刚');
    expect(relativeTimeOf('bad', NOW)).toBe('');
  });

  it('dayLabelOf：今天/昨天/带星期的日期，未知键不抛错', () => {
    expect(dayLabelOf('2026-11-23', NOW)).toBe('今天');
    expect(dayLabelOf('2026-11-22', NOW)).toBe('昨天');
    expect(dayLabelOf('2026-11-18', NOW)).toBe('2026年11月18日 周三');
    expect(dayLabelOf(UNKNOWN_DAY, NOW)).toBe('时间未知');
    expect(dayLabelOf('garbage', NOW)).toBe('时间未知');
  });

  it('dateTimeLabelOf：YYYY-MM-DD HH:mm，不可解析为空串', () => {
    expect(dateTimeLabelOf(at(20, 8, 5))).toBe('2026-11-20 08:05');
    expect(dateTimeLabelOf('')).toBe('');
    expect(dateTimeLabelOf({})).toBe('');
  });

  it('isStale：超过 7 天为滞留，未来时间与不可解析不算滞留', () => {
    expect(isStale(at(15, 9), NOW)).toBe(true);
    expect(isStale(at(17, 9), NOW)).toBe(false);
    expect(isStale(new Date(2026, 10, 24, 9).toISOString(), NOW)).toBe(false);
    expect(isStale('nope', NOW)).toBe(false);
  });
});

describe('CRM-UX 敏感字段遮蔽', () => {
  it('邮箱保留首字符与域名；无 @ 时仅留末两位', () => {
    expect(maskEmail('buyer@example.test')).toBe('b***@example.test');
    expect(maskEmail('a@example.test')).toBe('a***@example.test');
    expect(maskEmail('@example.test')).toBe('***********st');
    expect(maskEmail('abcdef')).toBe('****ef');
    expect(maskEmail('ab')).toBe('**');
    expect(maskEmail('')).toBe('');
  });

  it('电话保留前 3 后 4；不足 7 位仅留末两位', () => {
    expect(maskPhone('13812345678')).toBe('138****5678');
    expect(maskPhone('+8613812345678')).toBe('+86*******5678');
    expect(maskPhone('654321')).toBe('****21');
    expect(maskPhone('951')).toBe('*51');
    expect(maskPhone('12')).toBe('**');
  });

  it('initialOf：取首字，拉丁名转大写，按码点切分', () => {
    expect(initialOf('张三')).toBe('张');
    expect(initialOf('  buyer zhang')).toBe('B');
    expect(initialOf('𠀋 sampler')).toBe('𠀋');
    expect(initialOf(undefined)).toBe('');
    expect(initialOf('   ')).toBe('');
  });
});

describe('CRM-UX 文案与图标映射', () => {
  it('状态文案：已知键取中文，未知键原样返回', () => {
    expect(leadStatusLabel('CLAIMED')).toBe('已认领');
    expect(leadStatusLabel('WHATEVER')).toBe('WHATEVER');
    expect(leadStatusLabel(undefined)).toBe('公海');
    expect(customerStatusLabel('ACTIVE')).toBe('活跃客户');
    expect(customerStatusLabel('MYSTERY')).toBe('MYSTERY');
    expect(opportunityStageLabel('PROPOSAL')).toBe('方案报价');
    expect(opportunityStageLabel('X')).toBe('X');
    expect(opportunityStageLabel(undefined)).toBe('—');
  });

  it('来源图标：命中语义词取对应图标，其余回落通用', () => {
    expect(leadSourceIconOf('展会')).toBe('expo');
    expect(leadSourceIconOf('网站')).toBe('website');
    expect(leadSourceIconOf('转介绍')).toBe('referral');
    expect(leadSourceIconOf('主动开发')).toBe('outreach');
    expect(leadSourceIconOf('陌拜')).toBe('outreach');
    expect(leadSourceIconOf('老客户')).toBe('other');
    expect(leadSourceIconOf(undefined)).toBe('other');
  });

  it('活动图标：拜访/电话/邮件/展会/记录各有图形，其余通用', () => {
    expect(activityIconOf('拜访')).toBe('visit');
    expect(activityIconOf('电话')).toBe('call');
    expect(activityIconOf('邮件')).toBe('mail');
    expect(activityIconOf('展会')).toBe('expo');
    expect(activityIconOf('NOTE')).toBe('note');
    expect(activityIconOf('CALL')).toBe('call');
    expect(activityIconOf('SIGNING')).toBe('other');
  });

  it('recordOf/textOf：非对象与非标量收敛', () => {
    expect(recordOf(null)).toEqual({});
    expect(recordOf('x')).toEqual({});
    expect(recordOf({ a: 1 })).toEqual({ a: 1 });
    expect(textOf(12)).toBe('12');
    expect(textOf(null, 'f')).toBe('f');
  });

  it('isPoolLead：仅 status=POOL 归公海，其余（含 NEW）归私海', () => {
    expect(isPoolLead({ status: 'POOL' })).toBe(true);
    expect(isPoolLead({ status: 'NEW' })).toBe(false);
    expect(isPoolLead({})).toBe(false);
    expect(isPoolLead(undefined)).toBe(false);
  });
});

describe('CRM-UX 商机漏斗', () => {
  const opportunity = (id: string, status: string, amount?: string, currency = 'CNY') => ({
    id,
    status,
    value: amount === undefined ? undefined : { amount, currency },
  });

  it('按阶段计数并按币种合计金额；条宽相对最大阶段', () => {
    const funnel = funnelOf([
      opportunity('o1', 'OPEN', '100.000000'),
      opportunity('o2', 'OPEN', '50', 'USD'),
      opportunity('o3', 'WON', '300'),
      opportunity('o4', 'LOST', '999'),
      opportunity('o5', 'CANCELLED', '999'),
    ]);
    expect(funnel.map((stage) => [stage.stage, stage.count, stage.share])).toEqual([
      ['OPEN', 2, 1],
      ['QUALIFIED', 0, 0],
      ['PROPOSAL', 0, 0],
      ['WON', 1, 0.5],
    ]);
    expect(funnel[0]?.amounts).toEqual([
      { currency: 'CNY', amount: 100 },
      { currency: 'USD', amount: 50 },
    ]);
    expect(funnel[0]?.label).toBe('初步接洽');
  });

  it('金额缺失或非法的商机计入数量但不计入金额', () => {
    const funnel = funnelOf([
      opportunity('o1', 'OPEN'),
      opportunity('o2', 'OPEN', 'abc'),
      opportunity('o3', 'OPEN', '-5'),
    ]);
    expect(funnel[0]?.count).toBe(3);
    expect(funnel[0]?.amounts).toEqual([]);
  });

  it('无商机时各阶段为零且不产生 NaN', () => {
    for (const stage of funnelOf([])) {
      expect(stage.count).toBe(0);
      expect(stage.share).toBe(0);
    }
    expect(closedOpportunitiesOf([])).toEqual({ lost: 0, cancelled: 0 });
  });

  it('closedOpportunitiesOf 分别统计输单与已取消；amountsLabel 按币种格式化', () => {
    const closed = closedOpportunitiesOf([
      opportunity('o1', 'LOST'),
      opportunity('o2', 'LOST'),
      opportunity('o3', 'CANCELLED'),
      opportunity('o4', 'WON'),
    ]);
    expect(closed).toEqual({ lost: 2, cancelled: 1 });
    expect(amountsLabel([{ currency: 'CNY', amount: 1_250_000 }])).toMatch(/1,250,000/u);
    expect(
      amountsLabel([
        { currency: 'CNY', amount: 1 },
        { currency: 'USD', amount: 2 },
      ]),
    ).toMatch(/ · /u);
    expect(amountsLabel([])).toBe('');
  });
});

describe('CRM-UX 客户统计', () => {
  const customer = (id: string, status: string, createdAt?: string) => ({
    id,
    status,
    ...(createdAt === undefined ? {} : { createdAt }),
  });

  it('总数/活跃/新增本月基于已加载全集', () => {
    expect(
      customerStatsOf(
        [
          customer('a', 'ACTIVE', at(5, 9)),
          customer('b', 'PROSPECT', new Date(2026, 9, 31, 9).toISOString()), // 上月
          customer('c', 'ACTIVE', at(1, 9)),
          customer('d', 'INACTIVE'),
        ],
        NOW,
      ),
    ).toEqual({ total: 4, capped: false, active: 2, newThisMonth: 2 });
  });

  it('列表触顶（100 行）时标记 capped，供界面显示 100+', () => {
    const rows = Array.from({ length: CUSTOMER_LIST_CAP }, (_, index) =>
      customer(`c-${String(index)}`, 'ACTIVE', at(2, 9)),
    );
    expect(customerStatsOf(rows, NOW)).toEqual({
      total: 100,
      capped: true,
      active: 100,
      newThisMonth: 100,
    });
    expect(customerStatsOf(rows.slice(0, 99), NOW).capped).toBe(false);
  });

  it('月初/月末边界：仅当月创建计入新增', () => {
    const stats = customerStatsOf(
      [
        customer('a', 'ACTIVE', new Date(2026, 10, 1, 0, 0).toISOString()),
        customer('b', 'ACTIVE', new Date(2026, 9, 31, 23, 59).toISOString()),
      ],
      NOW,
    );
    expect(stats.newThisMonth).toBe(1);
  });
});

describe('CRM-UX 活动关联与分组', () => {
  const leads = [{ id: 'l1' }, { id: 'l2' }];
  const opportunities = [
    { id: 'o1', leadId: 'l1' },
    { id: 'o2', leadId: 'l2' },
    { id: 'o3', leadId: null },
  ];

  it('relatedOf：按线索挂载与 details.opportunityId 解析关联对象', () => {
    expect(relatedOf({ leadId: 'l1' }, leads, opportunities)).toEqual({
      leads: [{ id: 'l1' }],
      opportunities: [{ id: 'o1', leadId: 'l1' }],
    });
    expect(relatedOf({ details: { opportunityId: 'o2' } }, leads, opportunities)).toEqual({
      leads: [],
      opportunities: [{ id: 'o2', leadId: 'l2' }],
    });
    expect(relatedOf({ leadId: null, details: {} }, leads, opportunities)).toEqual({
      leads: [],
      opportunities: [],
    });
  });

  it('sortActivities：时间倒序，不可解析排最后，同值保持原序', () => {
    const rows = [
      { id: 'a', occurredAt: at(20, 9) },
      { id: 'bad', occurredAt: 'nope' },
      { id: 'b', occurredAt: at(22, 9) },
      { id: 'c', occurredAt: at(20, 9) },
    ];
    expect(sortActivities(rows).map((row) => row.id)).toEqual(['b', 'a', 'c', 'bad']);
  });

  it('groupByDay：按本地自然日分组并保持输入顺序，不可解析归入未知组', () => {
    const rows = [
      { id: 'a', occurredAt: at(22, 18) },
      { id: 'b', occurredAt: at(21, 9) },
      { id: 'c', occurredAt: at(22, 8) },
      { id: 'd', occurredAt: 'bad' },
    ];
    const groups = groupByDay(rows, (row) => row.occurredAt);
    expect(groups.map((group) => [group.key, group.rows.map((row) => row.id)])).toEqual([
      ['2026-11-22', ['a', 'c']],
      ['2026-11-21', ['b']],
      [UNKNOWN_DAY, ['d']],
    ]);
  });
});
