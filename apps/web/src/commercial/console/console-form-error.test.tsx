// TD-WF-005（写流程真浏览器冒烟发现）：新建抽屉里服务端拒绝后界面没有任何提示——各控制台把失败
// 写进自己的 submitError，而新建抽屉没有错误位。现在表单把它经 FormSection 的 error 显示在自己的
// 提示区（紧挨提交按钮）；抽屉顶部的错误位只留给不经表单的动作；打开与关闭表单时清空。
// 场景取自冒烟里复现的几处：重复客户编号（500）、供应商评分越界（400）、未准入供应商下订单
// （409）、超量收货（409），以及写流程冒烟 WS-P2-10 的报价新建。
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { CustomerConsolePage } from './customer-console';
import type { CustomerConsolePorts } from './customer-ports';
import { GoodsReceiptConsolePage } from './gr-console';
import type { GoodsReceiptConsolePorts } from './gr-ports';
import { ItemConsolePage } from './item-console';
import type { ItemConsolePorts, ItemRow } from './item-ports';
import { LeadConsolePage } from './lead-console';
import type { LeadConsolePorts, LeadRow } from './lead-ports';
import { OpportunityListPage } from './opportunity-list';
import type { OpportunityListPorts } from './opportunity-list';
import { PurchaseOrderConsolePage } from './po-console';
import type { PurchaseOrderConsolePorts } from './po-ports';
import { QuoteConsolePage } from './quote-console';
import type { QuoteConsolePorts, QuoteSnapshot } from './quote-ports';
import { SolutionConsolePage } from './solution-console';
import type { SolutionConsolePorts, SolutionRow } from './solution-ports';
import { SupplierConsolePage } from './supplier-console';
import type { SupplierConsolePorts } from './supplier-ports';
import { CtrConsolePage } from './ctr-console';
import type { CtrConsolePorts, CtrRow } from './ctr-ports';
import { technicalSolutionOpportunityId } from '../ctr-fields';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const textValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;

const recordText = (
  record: Readonly<Record<string, unknown>>,
  camel: string,
  snake: string,
  fallback = '',
): string => textValue(record[camel] ?? record[snake], fallback);

// .tsx 里泛型箭头函数要写成 <Ports,>（否则被当成 JSX 标签）。
const mount = <Ports,>(factory: (ports: Ports) => ComponentType, ports: Ports): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(factory(ports), {}), host);
  return host;
};

const byTestId = (host: TestElement, id: string): TestElement =>
  element(host.querySelector(`[data-testid="${id}"]`));

const click = async (host: TestElement, id: string): Promise<void> => {
  byTestId(host, id).click();
  await flush();
};

/** 给当前抽屉表单里的一个控件赋值并触发 input（输入框、下拉框同法）。 */
const fill = async (host: TestElement, name: string, value: string): Promise<void> => {
  const drawer = element(host.querySelector('.detail-drawer'));
  const control = drawer
    .querySelectorAll('input,textarea,select')
    .find((item) => (item as TestElement).getAttribute('name') === name);
  if (!control) throw new Error(`missing field ${name}`);
  (control as TestElement).value = value;
  (control as TestElement).dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
};

const submitDrawer = async (host: TestElement): Promise<void> => {
  const drawer = element(host.querySelector('.detail-drawer'));
  element(drawer.querySelector('button[type="submit"]')).click();
  // 第一轮让端口的失败落进状态，第二轮让随之而来的渲染落地。
  await flush();
  await flush();
};

/** 当前抽屉里表单自己的提示区（FormSection 的 role="alert"）。 */
const formAlert = (host: TestElement): TestElement =>
  element(
    element(host.querySelector('.detail-drawer form.form-section')).querySelector('[role="alert"]'),
  );

/** 抽屉里显示着文字的错误节点：抽屉顶部的错误位与表单的提示区都算。 */
const errorNodes = (host: TestElement): readonly TestElement[] =>
  host
    .querySelectorAll(
      '.detail-drawer .console-error, .detail-drawer .form-error, .detail-drawer [role="alert"]',
    )
    .filter((node) => node.textContent.trim() !== '')
    .map(element);

/**
 * JSX 注释若漏了外面的花括号就是一段可见文本（WF-B 施工时真发生过一次，prettier 不会报错）。
 * 这些抽屉都带着说明接入方式的注释：页面文字里不应出现注释标记。
 */
const expectNoLeakedComment = (host: TestElement): void => {
  for (const marker of ['/*', '*/', 'TD-WF-']) expect(host.textContent).not.toContain(marker);
};

/** 新建表单被拒后的共同断言：原因只出现在表单提示区这一处，抽屉仍然开着。
 *  焦点（提示出现时移入提示区）由 FormSection 的组件测试专责钉定（TD-WF-012 的三条用例直接
 *  控制渲染时序）；这里的组合用例经过控制台的状态机，在慢 runner 上焦点断言会与「错误出现」
 *  和「提交按钮恢复」两次渲染的先后交错（两次发布 verify 各翻车一次，本地均绿），故不在此处
 *  断言焦点，只断言本层的职责：提示在表单里、全文唯一、没有泄漏的注释。 */
const expectShownInFormOnly = (host: TestElement, message: string): void => {
  expect(host.querySelector('.detail-drawer')).not.toBeNull();
  expect(formAlert(host).textContent).toBe(message);
  const shown = errorNodes(host);
  expect(shown).toHaveLength(1);
  expect(shown[0]).toBe(formAlert(host));
  expect(host.textContent).toContain(message);
  expectNoLeakedComment(host);
};

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 夹具 ───────────────────────────────────────────────────────────────────
const customer = {
  id: 'customer-1',
  customerNumber: 'C-2026-001',
  name: '国际学校',
  status: 'PROSPECT',
  ownerId: 'employee-1',
  version: 3,
  createdAt: new Date(2026, 10, 5, 9).toISOString(),
};

const item: ItemRow = {
  id: 'item-v1',
  itemId: 'item-root',
  sku: 'FG-KT-PRO-50',
  name: '金特夫 50mm 景观草',
  itemType: 'FINISHED_GOOD',
  baseUnitCode: 'M2',
  version: 1,
  status: 'PUBLISHED',
  specification: { pileHeightMm: 50 },
  effective_at: '2026-01-01T00:00:00.000Z',
  published_at: '2026-01-02T00:00:00.000Z',
};

const poolLead: LeadRow = {
  id: 'lead-1',
  title: '学校运动场改造项目',
  source: '展会',
  status: 'POOL',
  ownerId: null,
  customerId: null,
  version: 1,
  createdAt: '2026-11-20T00:00:00.000Z',
  updatedAt: '2026-11-20T00:00:00.000Z',
};
const claimedLead: LeadRow = {
  ...poolLead,
  id: 'lead-2',
  title: '网站线索',
  status: 'CLAIMED',
  ownerId: 'employee-1',
};

const quoteRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'quote-r2',
  quoteId: 'quote-1',
  opportunityId: 'op-1',
  quoteNumber: 'Q-2026-001',
  revision: 2,
  status: 'APPROVED',
  ctrVersionId: 'ctr-v1-aaaa',
  technicalSolutionRevisionId: 'solution-1-aa',
  costDecisionId: 'cost-1-aaaa',
  policyVersionId: 'policy-1-aa',
  currency: 'CNY',
  subtotal: '1000000',
  discount: '0',
  total: '1000000',
  costTotal: '752209',
  margin: '247791',
  marginBasisPoints: 2477,
  validUntil: '2026-12-31T23:59:59.000Z',
  issuedAt: null,
  lines: [],
  ...overrides,
});

const snapshot = (): QuoteSnapshot => ({
  quotes: [quoteRow()],
  costs: [
    {
      id: 'cost-1',
      opportunityId: 'op-1',
      technicalSolutionRevisionId: 'solution-1',
      currency: 'CNY',
      total: '652050',
    },
  ],
  policies: [{ id: 'policy-1', code: 'SP-1', version: 1, status: 'PUBLISHED' }],
  solutions: [{ id: 'solution-1', ctrVersionId: 'ctr-v1' }],
  ctrs: [{ id: 'ctr-v1', opportunityId: 'op-1', code: 'CTR-1', version: 1, status: 'APPROVED' }],
  preferredCostDecisionId: '',
});

const QUOTE_FORM: readonly (readonly [string, string])[] = [
  ['quoteNumber', 'Q-2026-009'],
  ['costDecisionId', 'cost-1'],
  ['policyVersionId', 'policy-1'],
  ['turfQuantity', '8050'],
  ['turfPrice', '108'],
  ['installationQuantity', '8050'],
  ['installationPrice', '28'],
  ['serviceQuantity', '1'],
  ['servicePrice', '60000'],
  ['discountPercent', '0'],
  ['validUntil', '2026-12-31'],
];

// 方案表单的必填项（与 solution-console.test.tsx 的 FULL_FORM 同一份）。
const SOLUTION_FORM: readonly (readonly [string, string])[] = [
  ['ctrVersionId', 'ctr-v1'],
  ['productFamily', 'KingTurf Pro'],
  ['pileHeightMm', '50'],
  ['dtex', '8800'],
  ['yarnMaterial', '聚乙烯单丝 + 曲丝'],
  ['gauge', '3/4 英寸'],
  ['stitchRate', '10500'],
  ['backing', 'SBR + 网格布'],
  ['rollWidthMeters', '4'],
  ['drainageRate', '60'],
  ['infill', '石英砂'],
  ['warrantyYears', '8'],
  ['assumptions', '满足足球场日常训练'],
];

const solutionRow = (overrides: Record<string, unknown> = {}): SolutionRow => ({
  id: 'solution-v2',
  technicalSolutionId: 'solution-1',
  opportunityId: 'op-1',
  code: 'TS-1',
  revision: 2,
  status: 'DRAFT',
  ctrVersionId: 'ctr-v1',
  specification: { productFamily: 'KingTurf Pro', pileHeightMm: 50 },
  assumptions: ['满足足球场日常训练'],
  createdAt: '2026-11-20T08:00:00.000Z',
  ...overrides,
});

const submittedCtr: CtrRow = {
  id: 'version-1',
  ctrId: 'ctr-1',
  code: 'CTR-1',
  title: '学校需求',
  version: 1,
  status: 'SUBMITTED',
  requirements: {},
  attachments: [],
};

// ── 用例 ───────────────────────────────────────────────────────────────────
/** 报价控制台的端口：权限、列表里那一条报价的状态，以及要覆盖的端口。 */
const quotePorts = (
  permissions: readonly string[],
  status: string,
  overrides: Partial<QuoteConsolePorts> = {},
): QuoteConsolePorts => ({
  permissions: new Set(['quote:read', ...permissions]),
  initialSnapshot: { ...snapshot(), quotes: [quoteRow({ status })] },
  textValue,
  recordValue: (value) =>
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {},
  decimalValue: (value) => String(Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000),
  printIssuedQuote: vi.fn(),
  submit: vi.fn().mockResolvedValue({}),
  command: vi.fn().mockResolvedValue(undefined),
  clearPreferredCostDecisionId: vi.fn(),
  refresh: vi.fn().mockResolvedValue(snapshot()),
  ...overrides,
});

describe('新建表单被服务端拒绝：原因显示在表单自己的提示区，且只显示这一处', () => {
  it('客户：重复的客户编号（500）', async () => {
    const ports: CustomerConsolePorts = {
      permissions: new Set(['customer:read', 'customer:create']),
      initialCustomers: [customer],
      opportunities: [],
      textValue,
      submit: vi.fn().mockRejectedValue(new Error('Internal server error')),
      createContact: vi.fn().mockResolvedValue(null),
      createActivity: vi.fn().mockResolvedValue(null),
      load360: vi.fn().mockResolvedValue(null),
      refresh: vi.fn().mockResolvedValue([customer]),
    };
    const host = mount(CustomerConsolePage, ports);
    await click(host, 'kt-customer-create');
    await fill(host, 'name', '国际学校（重复编号）');
    await fill(host, 'customerNumber', customer.customerNumber);
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledTimes(1);
    expectShownInFormOnly(host, '服务器处理请求时出错，请稍后重试');
  });

  it('供应商：质量评分越界（400）', async () => {
    const ports: SupplierConsolePorts = {
      permissions: new Set(['supplier:read', 'supplier:manage']),
      initialSuppliers: [],
      initialQuotes: [],
      itemVersionChoices: [],
      recordText,
      textValue,
      submit: vi
        .fn()
        .mockRejectedValue(
          new Error('qualityRatingBasisPoints must be an integer between 0 and 10000'),
        ),
      now: () => new Date('2026-11-23T10:00:00.000Z'),
      refresh: vi.fn().mockResolvedValue({ suppliers: [], quotes: [] }),
    };
    const host = mount(SupplierConsolePage, ports);
    await click(host, 'kt-supplier-create');
    await fill(host, 'supplierNumber', 'SUP-E2E-001');
    await fill(host, 'name', '评分越界的供应商');
    await fill(host, 'qualityRating', '500');
    await fill(host, 'contactName', '李采购');
    await fill(host, 'contactPhone', '0532-00001111');
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledTimes(1);
    expectShownInFormOnly(host, 'qualityRatingBasisPoints 必须是 0 到 10000 之间的整数');
  });

  it('采购订单：供应商尚未准入该物料（409）', async () => {
    const ports: PurchaseOrderConsolePorts = {
      permissions: new Set(['procurement:read', 'procurement:manage']),
      initialOrders: [],
      itemVersionChoices: [{ value: 'item-v1', label: 'RM-YARN · 草纱' }],
      supplierChoices: [{ value: 'supplier-1', label: 'SUP-1 · 青岛金特夫草纱战略供应商' }],
      initialDocuments: [],
      recordText,
      textValue,
      decimalValue: (value) => value.toFixed(2),
      businessStateLabel: (value, fallback = '') =>
        typeof value === 'string' && value.length > 0 ? value : fallback,
      submit: vi.fn().mockRejectedValue(new Error('Supplier is not qualified for this item')),
      uploadContractDocument: vi.fn().mockResolvedValue({}),
      loadDetail: vi.fn().mockResolvedValue(null),
      refresh: vi.fn().mockResolvedValue({ orders: [], documents: [] }),
    };
    const host = mount(PurchaseOrderConsolePage, ports);
    await click(host, 'kt-po-create');
    await fill(host, 'poNumber', 'PO-E2E-001');
    await fill(host, 'supplierId', 'supplier-1');
    await fill(host, 'itemVersionId', 'item-v1');
    await fill(host, 'quantity', '800');
    await fill(host, 'unitPrice', '53');
    await fill(host, 'requiredAt', '2026-12-15');
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledTimes(1);
    expectShownInFormOnly(host, 'Supplier is not qualified for this item');
  });

  it('收货：数量超过未收量（409）', async () => {
    const ports: GoodsReceiptConsolePorts = {
      permissions: new Set(['procurement:read', 'procurement:manage']),
      initialReceipts: [],
      openOrderLineChoices: [
        { value: 'po-1|line-1', label: 'PO-KT-YARN-2026-001 · RM-YARN · 未收 5000.00' },
      ],
      locationChoices: [{ value: 'RAW-A01', label: 'RAW-A01 · 原料一区' }],
      recordText,
      textValue,
      decimalValue: (value) => value.toFixed(2),
      submit: vi.fn().mockRejectedValue(new Error('Received quantity exceeds the open quantity')),
      loadDetail: vi.fn().mockResolvedValue(null),
      refresh: vi.fn().mockResolvedValue([]),
    };
    const host = mount(GoodsReceiptConsolePage, ports);
    await click(host, 'kt-gr-create');
    await fill(host, 'orderLine', 'po-1|line-1');
    await fill(host, 'receiptNumber', 'GR-E2E-001');
    await fill(host, 'sourceReference', 'DN-E2E-001');
    await fill(host, 'lotNumber', 'LOT-E2E-001');
    await fill(host, 'locationCode', 'RAW-A01');
    await fill(host, 'quantity', '2000');
    await fill(host, 'manufacturedAt', '2026-11-01');
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledTimes(1);
    expectShownInFormOnly(host, 'Received quantity exceeds the open quantity');
  });

  it('线索：关掉抽屉再打开，上一次的失败原因不再出现', async () => {
    const leads = [poolLead, claimedLead];
    const ports: LeadConsolePorts = {
      permissions: new Set(['lead:read', 'lead:create']),
      initialLeads: leads,
      poolMode: false,
      employeeChoices: [{ value: 'employee-1', label: '销售一号' }],
      textValue,
      submit: vi.fn().mockRejectedValue(new Error('线索创建失败，请稍后重试')),
      refresh: vi.fn().mockResolvedValue(leads),
    };
    const host = mount(LeadConsolePage, ports);
    await click(host, 'kt-lead-create');
    await fill(host, 'title', '双击也不会重复的线索');
    await fill(host, 'source', '展会');
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledTimes(1);
    expectShownInFormOnly(host, '线索创建失败，请稍后重试');
    element(element(host.querySelector('.detail-drawer')).querySelector('.drawer-close')).click();
    await flush();
    expect(host.querySelector('.detail-drawer')).toBeNull();
    await click(host, 'kt-lead-create');
    expect(formAlert(host).textContent).toBe('');
    expect(errorNodes(host)).toHaveLength(0);
    expectNoLeakedComment(host);
  });

  it('报价：原因不再渲染在抽屉顶部（写流程冒烟 WS-P2-10 的场景）', async () => {
    const ports = quotePorts(['quote:create'], 'APPROVED', {
      submit: vi.fn().mockRejectedValue(new Error('销售政策未通过：毛利率低于 22% 红线')),
    });
    const host = mount(QuoteConsolePage, ports);
    await click(host, 'kt-quote-create');
    for (const [name, value] of QUOTE_FORM) await fill(host, name, value);
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledTimes(1);
    // 抽屉顶部那个错误位已撤：原因在表单提示区，紧挨着用户刚才点的提交按钮。
    expect(host.querySelector('[data-testid="kt-quote-submit-error"]')).toBeNull();
    expectShownInFormOnly(host, '销售政策未通过：毛利率低于 22% 红线');
  });

  it('物料：原因不再渲染在抽屉顶部', async () => {
    const ports: ItemConsolePorts = {
      permissions: new Set(['manufacturing-item:read', 'manufacturing-item:manage']),
      initialItems: [item],
      recordText,
      textValue,
      businessStateLabel: (value) => String(value),
      fetchPage: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      loadDetail: vi.fn().mockResolvedValue(null),
      submit: vi.fn().mockRejectedValue(new Error('sku 已存在')),
      refresh: vi.fn().mockResolvedValue([item]),
    };
    const host = mount(ItemConsolePage, ports);
    await click(host, 'kt-item-create');
    await fill(host, 'sku', 'FG-KT-PRO-50');
    await fill(host, 'name', '重复的 SKU');
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-testid="kt-item-create-error"]')).toBeNull();
    expectShownInFormOnly(host, 'sku 已存在');
  });
});

describe('详情抽屉：行内表单的失败给表单，不经表单的动作仍用抽屉顶部的错误位', () => {
  const leadPorts = (submit: ReturnType<typeof vi.fn>): LeadConsolePorts => ({
    permissions: new Set(['lead:read', 'lead:lifecycle']),
    initialLeads: [claimedLead],
    poolMode: false,
    employeeChoices: [{ value: 'employee-1', label: '销售一号' }],
    textValue,
    submit,
    refresh: vi.fn().mockResolvedValue([claimedLead]),
  });

  it('变更状态（行内表单）失败：原因只显示在该表单的提示区', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('Lead version is stale'));
    const host = mount(LeadConsolePage, leadPorts(submit));
    await click(host, 'kt-lead-open');
    await click(host, 'kt-lead-transition');
    await fill(host, 'status', 'QUALIFIED');
    await fill(host, 'reason', '已确认有效');
    await submitDrawer(host);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-testid="kt-lead-submit-error"]')).toBeNull();
    expectShownInFormOnly(host, '这条记录已在别处被修改，请刷新后重试');
  });

  it('改派（行内表单）失败：同上', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('Lead version is stale'));
    const permissions = new Set(['lead:read', 'lead:reassign']);
    const ports = { ...leadPorts(submit), permissions };
    const host = mount(LeadConsolePage, ports);
    await click(host, 'kt-lead-open');
    await click(host, 'kt-lead-assign');
    await fill(host, 'assigneeId', 'employee-1');
    await fill(host, 'reason', '改派给同事');
    await submitDrawer(host);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-testid="kt-lead-submit-error"]')).toBeNull();
    expectShownInFormOnly(host, '这条记录已在别处被修改，请刷新后重试');
  });

  it('认领（不经表单的动作）失败：原因仍在抽屉顶部的错误位，表单的提示区不存在', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('Lead version is stale'));
    const permissions = new Set(['lead:read', 'lead-pool:claim']);
    const ports = {
      ...leadPorts(submit),
      permissions,
      initialLeads: [poolLead, claimedLead],
      refresh: vi.fn().mockResolvedValue([poolLead, claimedLead]),
    };
    const host = mount(LeadConsolePage, ports);
    // 公海线索不在默认的私海分栏里：先切到公海。
    await click(host, 'kt-lead-tab-pool');
    await click(host, 'kt-lead-open');
    await click(host, 'kt-lead-claim');
    expect(submit).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.detail-drawer form.form-section')).toBeNull();
    const shown = errorNodes(host);
    expect(shown).toHaveLength(1);
    expect(shown[0]).toBe(byTestId(host, 'kt-lead-submit-error'));
    expect(shown[0]?.textContent).toBe('这条记录已在别处被修改，请刷新后重试');
    expectNoLeakedComment(host);
  });

  it('报价的批准（行内表单）失败：原因只显示在该表单的提示区', async () => {
    const ports = quotePorts(['quote:approve'], 'DRAFT', {
      command: vi.fn().mockRejectedValue(new Error('Quote version conflict')),
    });
    const host = mount(QuoteConsolePage, ports);
    await click(host, 'kt-quote-open');
    await click(host, 'kt-quote-approve');
    await fill(host, 'reason', '报价口径已复核');
    await submitDrawer(host);
    expect(ports.command).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-testid="kt-quote-submit-error"]')).toBeNull();
    expectShownInFormOnly(host, '这条记录已在别处被修改，请刷新后重试');
  });

  it('技术需求的审批（行内表单）失败：原因只显示在该表单的提示区', async () => {
    const ports: CtrConsolePorts = {
      permissions: new Set(['ctr:read', 'ctr:approve']),
      initialCtrs: [submittedCtr],
      initialSolutions: [],
      opportunities: [{ id: 'opportunity-1', name: '学校项目' }],
      textValue,
      recordValue: (value) =>
        typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {},
      displayRequirement: (value) => textValue(value, '—'),
      submit: vi.fn().mockRejectedValue(new Error('CTR version not found')),
      uploadAttachment: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue({ ctrs: [submittedCtr], solutions: [] }),
    };
    const host = mount(CtrConsolePage, ports);
    await click(host, 'kt-ctr-open');
    await click(host, 'kt-ctr-approve');
    await fill(host, 'reason', '同意');
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-testid="kt-ctr-submit-error"]')).toBeNull();
    expectShownInFormOnly(host, 'CTR version not found');
  });
});

describe('提交失败不再写进加载错误面', () => {
  it('商机：新建失败后看板原样保留，原因在新建表单里', async () => {
    const opportunity = {
      id: 'op-1',
      name: '国际学校足球场',
      status: 'OPEN',
      value: { amount: '500000.000000', currency: 'CNY' },
      probabilityBasisPoints: 3000,
      expectedCloseDate: '2026-10-01',
      version: 1,
    };
    const ports: OpportunityListPorts = {
      permissions: new Set(['opportunity:read', 'opportunity:create']),
      initialOpportunities: [opportunity] as never,
      customers: [{ id: 'customer-1', name: 'Acme Turf' }],
      today: '2026-10-08',
      displayMoney: (_currency, value) => `¥${String(value)}`,
      pipelineSummary: (items) => ({
        active: items.length,
        overdue: 0,
        closingSoon: 0,
        customerMissing: items.filter((item) => !item.customerId).length,
      }),
      createOpportunity: vi.fn().mockRejectedValue(new Error('Opportunity version conflict')),
      transitionOpportunity: vi.fn().mockResolvedValue([]),
      refresh: vi.fn().mockResolvedValue([]),
    };
    const host = mount(OpportunityListPage, ports);
    await click(host, 'kt-opportunity-create');
    await fill(host, 'name', '新的商机');
    await fill(host, 'value', '500000');
    await fill(host, 'currency', 'CNY');
    await fill(host, 'probability', '30');
    await fill(host, 'expectedCloseDate', '2027-03-01');
    await submitDrawer(host);
    expect(ports.createOpportunity).toHaveBeenCalledTimes(1);
    expectShownInFormOnly(host, '这条记录已在别处被修改，请刷新后重试');
    // 此前这次失败走 loadError：管道视图下整个看板被一条错误替换。
    expect(host.querySelector('[data-testid="kt-opportunity-error"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-opportunity-pipeline"]')).not.toBeNull();
    expect(host.textContent).toContain('国际学校足球场');
    // 关掉抽屉后看板照旧，没有留下错误。
    element(element(host.querySelector('.detail-drawer')).querySelector('.drawer-close')).click();
    await flush();
    expect(host.querySelector('.detail-drawer')).toBeNull();
    expect(host.querySelector('[data-testid="kt-opportunity-error"]')).toBeNull();
    expect(host.textContent).toContain('国际学校足球场');
    expect(host.textContent).not.toContain('已在别处被修改');
  });

  const solutionPorts = (
    submit: ReturnType<typeof vi.fn>,
    permissions: readonly string[],
  ): SolutionConsolePorts => ({
    permissions: new Set(['technical-solution:read', ...permissions]),
    initialSolutions: [solutionRow()],
    initialCtrs: [
      {
        id: 'ctr-v1',
        opportunityId: 'op-1',
        code: 'CTR-1',
        version: 1,
        status: 'APPROVED',
        title: '足球草',
      },
    ],
    technicalSolutionOpportunityId,
    textValue,
    formValue: textValue,
    displayRequirement: (value) => textValue(value, '—'),
    submit,
    refresh: vi.fn().mockResolvedValue({
      solutions: [solutionRow()],
      ctrs: [
        {
          id: 'ctr-v1',
          opportunityId: 'op-1',
          code: 'CTR-1',
          version: 1,
          status: 'APPROVED',
          title: '足球草',
        },
      ],
    }),
  });

  it('技术方案：新建失败后表格的错误面不出现', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('Solution revision could not be created'));
    const host = mount(SolutionConsolePage, solutionPorts(submit, ['technical-solution:create']));
    await click(host, 'kt-solution-create');
    for (const [name, value] of [['code', 'TS-2026-001'], ...SOLUTION_FORM, ['state', 'DRAFT']])
      await fill(host, name, value);
    await submitDrawer(host);
    expect(submit).toHaveBeenCalledTimes(1);
    expectShownInFormOnly(host, 'Solution revision could not be created');
    expect(host.querySelector('.data-table-error')).toBeNull();
  });

  it('技术方案：修订失败后表格的错误面不出现', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('Solution revision could not be created'));
    const host = mount(SolutionConsolePage, solutionPorts(submit, ['technical-solution:update']));
    await click(host, 'kt-solution-open');
    await click(host, 'kt-solution-edit');
    for (const [name, value] of SOLUTION_FORM) await fill(host, name, value);
    await submitDrawer(host);
    expect(submit).toHaveBeenCalledTimes(1);
    expectShownInFormOnly(host, 'Solution revision could not be created');
    expect(host.querySelector('.data-table-error')).toBeNull();
  });
});

// 抽屉顶部的错误位在行内表单打开时必须让位，否则同一条错误显示两处。行为用例盖到线索、客户
// （console-error-message.test.tsx）、技术需求与报价详情四处；八处的条件本身在这里机械地守：
// 条件表达式（state.submitError 之前那一段）不得为空。其余四处（供应商准入、采购合同文档、成本
// 因子、政策版本）的行为由真浏览器走查与写流程冒烟目检。
describe('抽屉顶部的错误位：八处都带着「行内表单打开时让位」的条件（源码守卫）', () => {
  const SLOTS: readonly (readonly [string, string])[] = [
    ['lead-console.tsx', 'kt-lead-submit-error'],
    ['customer-console.tsx', 'kt-customer-submit-error'],
    ['quote-console.tsx', 'kt-quote-submit-error'],
    ['supplier-console.tsx', 'kt-supplier-submit-error'],
    ['po-console.tsx', 'kt-po-submit-error'],
    ['cost-matrix-console.tsx', 'kt-matrix-submit-error'],
    ['policy-console.tsx', 'kt-policy-submit-error'],
    ['ctr-console.tsx', 'kt-ctr-submit-error'],
  ];

  it.each(SLOTS)('%s：%s 只在没有行内表单打开时显示', (file, testid) => {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    if (testid === 'kt-quote-submit-error') {
      // 签发确认框没有行内表单。报价动作区作为整体让位，签发失败才显示在这组动作内。
      expect(source).toMatch(
        /\{state\.activeForm === null \|\| state\.activeForm === 'issue' \? \(\s*<div class="console-actions" data-testid="kt-quote-actions">\s*\{state\.submitError !== '' \? \(\s*<p[^>]*data-testid="kt-quote-submit-error"/u,
      );
      return;
    }
    const slot = new RegExp(
      `\\{([^{}\\n]*?)state\\.submitError !== '' \\? \\(\\n\\s*<p class="console-error" role="alert" data-testid="${testid}">`,
      'u',
    ).exec(source);
    if (slot === null) throw new Error(`${file} 里找不到 ${testid} 的错误位`);
    // 条件为空 = 只要 submitError 有值就显示，行内表单打开时会与表单的提示区重复。
    expect(slot[1]?.trim()).not.toBe('');
  });

  it('制造域三个新建抽屉不再有自己的错误位（原因显示在表单提示区）', () => {
    const removed = [
      ['item-create.tsx', 'kt-item-create-error'],
      ['bom-create.tsx', 'kt-bom-create-error'],
      ['routing-create.tsx', 'kt-routing-create-error'],
    ] as const;
    for (const [file, testid] of removed) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      expect(source, `${file} 仍渲染 ${testid}`).not.toContain(`data-testid="${testid}"`);
      expect(source).toContain('error={state.submitError}');
    }
  });
});
