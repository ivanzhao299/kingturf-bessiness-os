// U3-MFG-4 工单控制台白盒行为测试（原 vanilla 工单卡片/流转表单的载荷 oracle 等价迁移；
// e2e 黑盒文案契约静态钉定：WO-KT-2026-001 独占元素、状态徽章、完工进度、详情抽屉的
// 工序步骤/物料分配/报工时间线/成品序列/事件台账、创建与流转载荷逐字节一致、失败路径、
// 车间执行入口挂载）。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { ProductionOrderConsolePage } from './production-order-console';
import type {
  ProductionOrderConsolePorts,
  ProductionOrderPage,
  ProductionOrderRow,
} from './production-order-ports';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};
const at = (nodes: readonly unknown[], index = 0): TestElement => {
  const node = nodes[index];
  if (!node) throw new Error(`expected element at ${String(index)}`);
  return node as TestElement;
};

const order = (overrides: Partial<ProductionOrderRow> = {}): ProductionOrderRow => ({
  id: 'wo-1',
  tenant_id: 't',
  order_number: 'WO-KT-2026-001',
  item_version_id: 'v-1',
  routing_version_id: 'r-1',
  planned_quantity: 1000,
  planned_start_at: '2026-08-13',
  planned_due_at: '2026-08-20',
  source_reference: 'MRP-KT-2026-001',
  sku: 'FG-KT-PRO-50',
  itemName: '金特夫 50mm 景观草',
  state: 'DRAFT',
  operations: [
    { id: 'op-1', sequence: 10, operation_code: 'TUFT', name: '簇绒', work_center: 'WC-1' },
    { id: 'op-2', sequence: 20, operation_code: 'COAT', name: '背胶', work_center: 'WC-2' },
  ],
  materials: [{ id: 'm-1', transaction_type: 'ISSUE', quantity: 1287.5 }],
  reports: [{ id: 'r-1', production_order_operation_id: 'op-1', good_quantity: 1000 }],
  rolls: [{ id: 'roll-1', roll_number: 'ROLL-1', quantity: 1000, status: 'QUARANTINE' }],
  events: [
    { id: 'e-1', state: 'DRAFT', sequence: 1, reason: 'Production order created' },
    { id: 'e-2', state: 'RELEASED', sequence: 2, reason: 'ready' },
  ],
  ...overrides,
});

const progress = {
  id: 'op-1',
  sequence: 10,
  operationCode: 'TUFT',
  operationName: '簇绒',
  workCenter: 'WC-TUFT-01',
  plannedQuantity: 1000,
  reportedGoodQuantity: 1000,
  reportedScrapQuantity: 12.5,
  reportCount: 1,
  laborMinutes: 60,
  machineMinutes: 55,
  completed: true,
};
const detailRow = (overrides: Partial<ProductionOrderRow> = {}): ProductionOrderRow => ({
  ...order({ state: 'IN_PROGRESS' }),
  operationProgress: [
    progress,
    {
      ...progress,
      id: 'op-2',
      sequence: 20,
      operationCode: 'COAT',
      operationName: '背胶',
      completed: false,
    },
  ],
  reportTimeline: [
    {
      id: 'r-1',
      productionOrderOperationId: 'op-1',
      sequence: 10,
      operationCode: 'TUFT',
      operationName: '簇绒',
      goodQuantity: 1000,
      scrapQuantity: 12.5,
      laborMinutes: 60,
      machineMinutes: 55,
      startedAt: '2026-08-17T08:00:00+00:00',
      completedAt: '2026-08-17T09:00:00+00:00',
      notes: '簇绒完成',
      operatorId: 'e-1',
      createdAt: '2026-08-17T09:01:00+00:00',
    },
  ],
  materialRequirements: [
    {
      lineNumber: 1,
      componentItemVersionId: 'raw-1',
      sku: 'RM-YARN',
      itemName: '草纱',
      baseUnitCode: 'KG',
      plannedQuantity: 1287.5,
      actualQuantity: 1285.5,
      allocationStatus: 'PARTIAL',
    },
  ],
  ...overrides,
});

const portsFor = (
  orders: readonly ProductionOrderRow[] = [order()],
  extraPermissions: readonly string[] = [],
  overrides: Partial<ProductionOrderConsolePorts> = {},
): ProductionOrderConsolePorts => ({
  permissions: new Set(['production:read', ...extraPermissions]),
  initialOrders: orders,
  itemVersionChoices: [{ value: 'v-1', label: 'FG-KT-PRO-50 · 金特夫 50mm 景观草' }],
  routingChoices: [{ value: 'r-1', label: 'RT-KT-PRO-50 · 50mm 景观草标准工艺' }],
  recordText: (record, camel, snake, fallback = '') => {
    const value = record[camel] ?? record[snake] ?? fallback;
    return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
  },
  textValue: (value, fallback = '') =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
  businessStateLabel: (value) =>
    ({ ISSUE: '领料', RETURN: '退料', QUARANTINE: '待检隔离' })[String(value)] ?? String(value),
  operationsNextAction: (state) => `next:${String(state)}`,
  fetchPage: vi
    .fn<() => Promise<ProductionOrderPage>>()
    .mockResolvedValue({ items: [], nextCursor: null }),
  loadDetail: vi.fn().mockResolvedValue(null),
  submit: vi.fn().mockResolvedValue(null),
  refresh: vi.fn().mockResolvedValue(orders),
  mountExecution: vi.fn(() => vi.fn()),
  ...overrides,
});

const mount = (ports: ProductionOrderConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(ProductionOrderConsolePage(ports) as ComponentType, {}), host);
  return host;
};

const byTestId = (host: TestElement, id: string): TestElement => {
  const found = host.querySelector(`[data-testid="${id}"]`);
  if (!found) throw new Error(`missing ${id}`);
  return element(found);
};
const optional = (host: TestElement, id: string): TestElement | null =>
  (host.querySelector(`[data-testid="${id}"]`) as TestElement | null) ?? null;

// 搜索框无 name 语义（data-testid 定位）；表单字段按 name 定位。
const typeSearch = async (host: TestElement, value: string): Promise<void> => {
  const control = byTestId(host, 'kt-wo-search');
  control.value = value;
  control.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
};

const type = async (host: TestElement, name: string, value: string): Promise<void> => {
  const controls = host
    .querySelectorAll('input,textarea,select')
    .filter((item) => (item as TestElement).getAttribute('name') === name);
  const control = controls[0] as TestElement | undefined;
  if (!control) throw new Error(`missing field ${name}`);
  control.value = value;
  control.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
};

const submitDrawer = async (host: TestElement): Promise<void> => {
  element(
    element(host.querySelector('.detail-drawer')).querySelector('button[type="submit"]'),
  ).click();
  await flush();
};

const drawerOf = (host: TestElement): TestElement => element(host.querySelector('.detail-drawer'));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('U3-MFG-4 工单控制台：默认视图与 e2e 文案契约', () => {
  it('默认视图按作业队列排序；工单号独占元素、状态徽章、完工进度与来源编号', () => {
    const rows = [
      order({ id: 'wo-closed', order_number: 'WO-CLOSED', state: 'CLOSED' }),
      order({ id: 'wo-active', order_number: 'WO-ACTIVE', state: 'IN_PROGRESS', reports: [] }),
      order(),
      order({ id: 'wo-rel', order_number: 'WO-REL', state: 'RELEASED' }),
    ];
    const ports = portsFor(rows);
    const host = mount(ports);
    const numbers = host
      .querySelectorAll('[data-testid="kt-wo-number"]')
      .map((node) => (node as TestElement).textContent);
    expect(numbers).toEqual(['WO-ACTIVE', 'WO-REL', 'WO-KT-2026-001', 'WO-CLOSED']);
    expect(ports.fetchPage).not.toHaveBeenCalled();
    expect(host.textContent).toContain('共 4 张工单 · 累计报工 3 条 · 成品卷 4 卷');
    expect(host.textContent).toContain('MRP-KT-2026-001');
  });

  it('状态汇总卡计数正确，点选即筛选（再点回全部）', async () => {
    const rows = [
      order(),
      order({ id: 'wo-2', order_number: 'WO-2', state: 'DRAFT' }),
      order({ id: 'wo-3', order_number: 'WO-3', state: 'CLOSED' }),
    ];
    const fetchPage = vi.fn().mockResolvedValue({
      items: [order({ id: 'wo-page', order_number: 'WO-PAGE' })],
      nextCursor: null,
    });
    const host = mount(portsFor(rows, [], { fetchPage }));
    expect(byTestId(host, 'kt-wo-summary-total').textContent).toContain('共 3 张工单');
    expect(byTestId(host, 'kt-wo-status-draft').textContent).toContain('2');
    expect(byTestId(host, 'kt-wo-status-in_progress').textContent).toContain('0');
    byTestId(host, 'kt-wo-status-draft').click();
    await flush();
    expect(fetchPage).toHaveBeenCalledExactlyOnceWith({ state: 'DRAFT', limit: 50 });
    expect(
      host
        .querySelectorAll('[data-testid="kt-wo-number"]')
        .map((node) => (node as TestElement).textContent),
    ).toEqual(['WO-PAGE']);
    byTestId(host, 'kt-wo-status-draft').click();
    await flush();
    expect(host.textContent).toContain('WO-3');
  });

  it('权限门：无 production:plan 无新建；行级下一步按各能力键显示对应文案', () => {
    const rows = [
      order({ state: 'DRAFT' }),
      order({ id: 'wo-rel', order_number: 'WO-REL', state: 'RELEASED' }),
      order({ id: 'wo-prog', order_number: 'WO-PROG', state: 'IN_PROGRESS' }),
      order({ id: 'wo-done', order_number: 'WO-DONE', state: 'COMPLETED' }),
      order({ id: 'wo-closed', order_number: 'WO-CLOSED', state: 'CLOSED' }),
    ];
    const host = mount(
      portsFor(rows, ['production:plan', 'production:report', 'production:close']),
    );
    expect(optional(host, 'kt-wo-create')).not.toBeNull();
    const readonly = mount(portsFor(rows));
    expect(optional(readonly, 'kt-wo-create')).toBeNull();
    // 行序为 legacy 作业队列（进行中 → 已放行 → 已完成 → 草稿 → 已关闭）。
    const labels = host
      .querySelectorAll('[data-testid="kt-wo-next-action"]')
      .map((node) => (node as TestElement).textContent);
    expect(labels).toEqual(['完工确认', '开始生产', '关闭工单', '下达工单']);
    const readonlyLabels = readonly
      .querySelectorAll('[data-testid="kt-wo-next-action"]')
      .map((node) => (node as TestElement).textContent);
    expect(readonlyLabels).toEqual([]);
  });

  it('搜索走服务端 query；清除回快照；空态与错态分离', async () => {
    const fetchPage = vi
      .fn<() => Promise<ProductionOrderPage>>()
      .mockResolvedValue({ items: [], nextCursor: null });
    const host = mount(portsFor([order()], [], { fetchPage }));
    await typeSearch(host, ' KT-2026 ');
    byTestId(host, 'kt-wo-search-submit').click();
    await flush();
    expect(fetchPage).toHaveBeenCalledExactlyOnceWith({ query: 'KT-2026', limit: 50 });
    expect(host.textContent).toContain('没有符合条件的生产工单');
    byTestId(host, 'kt-wo-search-clear').click();
    await flush();
    expect(host.textContent).toContain('WO-KT-2026-001');
    const failing = portsFor([order()], [], {
      fetchPage: vi.fn().mockRejectedValue(new Error('bridge down')),
    });
    const broken = mount(failing);
    await typeSearch(broken, 'x');
    byTestId(broken, 'kt-wo-search-submit').click();
    await flush();
    expect(byTestId(broken, 'kt-wo-load-error').textContent).toBe('bridge down');
  });

  it('筛选态继续加载按游标追加', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [order()], nextCursor: 'cursor-1' })
      .mockResolvedValueOnce({
        items: [order({ id: 'wo-2', order_number: 'WO-2' })],
        nextCursor: null,
      });
    const host = mount(portsFor([order()], [], { fetchPage }));
    await typeSearch(host, 'KT');
    byTestId(host, 'kt-wo-search-submit').click();
    await flush();
    expect(host.textContent).toContain('已加载 1 条记录');
    const loadMore = host
      .querySelectorAll('button')
      .find((node) => (node as TestElement).textContent === '继续加载');
    if (!loadMore) throw new Error('missing load-more button');
    (loadMore as TestElement).click();
    await flush();
    expect(fetchPage).toHaveBeenLastCalledWith({ query: 'KT', limit: 50, cursor: 'cursor-1' });
    expect(
      host
        .querySelectorAll('[data-testid="kt-wo-number"]')
        .map((node) => (node as TestElement).textContent),
    ).toEqual(['WO-KT-2026-001', 'WO-2']);
  });
});

describe('U3-MFG-4 工单控制台：详情抽屉', () => {
  it('打开详情读 additive 接口；步骤视图按序、完成态、物料分配徽章、报工时间线与轨迹', async () => {
    const row = order({ state: 'IN_PROGRESS' });
    const loadDetail = vi.fn().mockResolvedValue(detailRow());
    const host = mount(portsFor([row], [], { loadDetail }));
    byTestId(host, 'kt-wo-open').click();
    await flush();
    await flush();
    expect(loadDetail).toHaveBeenCalledExactlyOnceWith('wo-1');
    const drawer = drawerOf(host);
    const steps = drawer.querySelectorAll('[data-testid="kt-wo-operation-step"]');
    expect(steps).toHaveLength(2);
    expect(at(steps, 0).getAttribute('data-state')).toBe('done');
    expect(at(steps, 1).getAttribute('data-state')).toBe('current');
    expect(steps.map((node) => (node as TestElement).textContent.includes('簇绒'))).toEqual([
      true,
      false,
    ]);
    expect(drawer.textContent).toContain('良品 1000 / 计划 1000');
    expect(drawer.textContent).toContain('人工 60 分钟 · 设备 55 分钟');
    expect(drawer.querySelector('[role="progressbar"]')).not.toBeNull();
    const requirement = byTestId(drawer, 'kt-wo-requirement');
    expect(requirement.textContent).toContain('RM-YARN');
    expect(requirement.textContent).toContain('需求 1287.5 KG');
    expect(requirement.textContent).toContain('已领 1285.5');
    expect(requirement.textContent).toContain('部分领料');
    expect(drawer.textContent).toContain('簇绒完成');
    // 报工时间线的绝对时间经 dateTimeLabelOf 本地化——此处只钉文本存在，不钉时区。
    expect(drawer.textContent).toContain('→');
    const track = byTestId(drawer, 'kt-wo-state-track');
    expect(
      track.querySelectorAll('.po-state-node').map((node) => (node as TestElement).textContent),
    ).toEqual(['草稿', '已放行', '进行中', '已完成', '已关闭']);
    expect(track.querySelector('[data-state="current"]')?.textContent).toBe('进行中');
  });

  it('详情失败回退列表行就地推算（无服务端聚合也有步骤与台账）', async () => {
    const loadDetail = vi.fn().mockRejectedValue(new Error('detail down'));
    const host = mount(portsFor([order({ state: 'IN_PROGRESS' })], [], { loadDetail }));
    byTestId(host, 'kt-wo-open').click();
    await flush();
    await flush();
    const drawer = drawerOf(host);
    expect(drawer.querySelectorAll('[data-testid="kt-wo-operation-step"]')).toHaveLength(2);
    expect(drawer.textContent).toContain('良品 1000 / 计划 1000');
    expect(drawer.textContent).toContain('领料 1287.5');
    expect(optional(drawer, 'kt-wo-requirement')).toBeNull();
  });

  it('物料需求区块仅在响应带键时渲染；关闭工单无下一步动作', async () => {
    const loadDetail = vi
      .fn()
      .mockResolvedValue(detailRow({ state: 'CLOSED', materialRequirements: [] }));
    const host = mount(portsFor([order({ state: 'CLOSED' })], [], { loadDetail }));
    byTestId(host, 'kt-wo-open').click();
    await flush();
    await flush();
    const drawer = drawerOf(host);
    expect(optional(drawer, 'kt-wo-requirements-section')).not.toBeNull();
    expect(drawer.textContent).toContain('该成品暂无已发布 BOM');
    expect(optional(drawer, 'kt-wo-transition')).toBeNull();
  });

  it('车间执行入口经宿主挂载；关闭抽屉卸载', async () => {
    const dispose = vi.fn();
    const mountExecution = vi.fn<ProductionOrderConsolePorts['mountExecution']>(() => dispose);
    const row = order({ state: 'IN_PROGRESS' });
    const host = mount(portsFor([row], ['production:report'], { mountExecution }));
    byTestId(host, 'kt-wo-open').click();
    await flush();
    await flush();
    expect(mountExecution).toHaveBeenCalledTimes(1);
    expect(mountExecution.mock.calls[0]?.[1]).toBe(row);
    element(drawerOf(host).querySelector('.drawer-close')).click();
    await flush();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});

describe('U3-MFG-4 工单控制台：载荷 oracle', () => {
  it('创建载荷与 vanilla「建立生产工单」表单逐字节一致（mrpProposalId 留空为 undefined 占位）', async () => {
    const submit = vi.fn().mockResolvedValue(null);
    const refresh = vi.fn().mockResolvedValue([order()]);
    const host = mount(portsFor([order()], ['production:plan'], { submit, refresh }));
    byTestId(host, 'kt-wo-create').click();
    await flush();
    await type(host, 'orderNumber', ' WO-9 ');
    await type(host, 'itemVersionId', 'v-1');
    await type(host, 'routingVersionId', 'r-1');
    await type(host, 'plannedQuantity', '500');
    await type(host, 'plannedStartAt', '2026-09-01');
    await type(host, 'plannedDueAt', '2026-09-08');
    await type(host, 'sourceReference', ' SO-9 ');
    await submitDrawer(host);
    await flush();
    expect(submit).toHaveBeenCalledExactlyOnceWith('/api/v1/production-orders', {
      orderNumber: 'WO-9',
      itemVersionId: 'v-1',
      routingVersionId: 'r-1',
      mrpProposalId: undefined,
      plannedQuantity: '500',
      plannedStartAt: '2026-09-01',
      plannedDueAt: '2026-09-08',
      sourceReference: 'SO-9',
    });
    // JSON 序列化丢弃 undefined 键——与 legacy openForm 载荷上线路径逐字节一致。
    expect(JSON.stringify(submit.mock.calls[0]?.[1])).toBe(
      JSON.stringify({
        orderNumber: 'WO-9',
        itemVersionId: 'v-1',
        routingVersionId: 'r-1',
        plannedQuantity: '500',
        plannedStartAt: '2026-09-01',
        plannedDueAt: '2026-09-08',
        sourceReference: 'SO-9',
      }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('流转载荷与 vanilla 流转表单同形（reason/evidence/idempotencyKey），经 PUT state 统一端点', async () => {
    const submit = vi.fn().mockResolvedValue(null);
    const refresh = vi.fn().mockResolvedValue([order({ state: 'RELEASED' })]);
    const host = mount(portsFor([order()], ['production:plan'], { submit, refresh }));
    at(host.querySelectorAll('[data-testid="kt-wo-next-action"]')).click();
    await flush();
    const drawer = drawerOf(host);
    expect(drawer.textContent).toContain('下达工单 · WO-KT-2026-001');
    expect(drawer.textContent).toContain('流转后');
    await type(drawer, 'reason', ' 已核对排产 ');
    await type(drawer, 'evidenceReference', 'EV-1');
    await submitDrawer(host);
    await flush();
    expect(submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/production-orders/wo-1/state',
      {
        action: 'release',
        reason: '已核对排产',
        evidence: { reference: 'EV-1' },
        idempotencyKey: 'WO-KT-2026-001-RELEASE-EV-1',
      },
      'PUT',
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('提交失败保留抽屉并就近显示错误；动作错误与装载错误分离', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('command rejected'));
    const host = mount(portsFor([order()], ['production:plan'], { submit }));
    at(host.querySelectorAll('[data-testid="kt-wo-next-action"]')).click();
    await flush();
    await type(drawerOf(host), 'reason', 'r');
    await type(drawerOf(host), 'evidenceReference', 'EV-2');
    await submitDrawer(host);
    await flush();
    expect(byTestId(drawerOf(host), 'kt-wo-transition-error').textContent).toBe('command rejected');
    // 抽屉未关闭：再次提交仍走同一动作。
    await submitDrawer(host);
    await flush();
    expect(submit).toHaveBeenCalledTimes(2);
  });
});

describe('U3-MFG-4 纯助手', () => {
  it('progressOf 工单完成数取各工序累计良品（封顶计划）的最小值', async () => {
    const { progressOf, formatQuantity, byLegacyPriority } =
      await import('./production-order-state');
    const row = order({
      planned_quantity: 1000,
      operations: [
        { id: 'op-1', sequence: 10, operation_code: 'TUFT', name: '簇绒', work_center: 'W' },
        { id: 'op-2', sequence: 20, operation_code: 'COAT', name: '背胶', work_center: 'W' },
      ],
      reports: [
        { production_order_operation_id: 'op-1', good_quantity: 1000 },
        { production_order_operation_id: 'op-2', good_quantity: 400 },
      ],
    });
    const progress = progressOf(row);
    expect(progress.completed).toBe(400);
    expect(progress.ratio).toBeCloseTo(0.4);
    expect(progress.operations.map((item) => item.completed)).toEqual([true, false]);
    expect(formatQuantity(1287.5)).toBe('1287.5');
    expect(formatQuantity(undefined)).toBe('0');
    expect(
      byLegacyPriority(
        [order({ state: 'DRAFT' }), order({ state: 'CLOSED' }), order({ state: 'IN_PROGRESS' })],
        (item) => String(item.state),
      ).map((item) => item.state),
    ).toEqual(['IN_PROGRESS', 'DRAFT', 'CLOSED']);
  });
});
