// U3-MFG-3 工艺路线控制台白盒行为测试（Preact 分域重写后的行为面；原 vanilla
// 「创建标准工艺路线」表单载荷 oracle 等价迁移——单工序 TUFT 逐字节一致/多工序
// sequence 按行序 10/20/30… 重排；e2e 黑盒文案契约静态钉定：RT-KT-PRO-50 独占
// 元素、`已发布 · 第 1 版` 徽章、产品 SKU 不独占、无草稿时无「发布版本」；左树
// 成品/半成品计数、顺序步骤视图、行级发布、失败路径与竞态守卫）。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { RoutingConsolePage } from './routing-console';
import type { RoutingConsolePorts, RoutingPage, RoutingRow } from './routing-ports';
import { operationsOf } from './routing-state';

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

const operation = (sequence: number, operationCode: string, run: string): RoutingRow => ({
  id: `op-${String(sequence)}`,
  sequence,
  operation_code: operationCode,
  name: operationCode === 'TUFT' ? '簇绒' : operationCode,
  work_center_code: `WC-${operationCode}-01`,
  setup_minutes: 60,
  run_minutes_per_unit: Number(run),
  instructions: {},
});

const routingRow = (overrides: Partial<RoutingRow> = {}): RoutingRow => ({
  id: 'routingv-1',
  routingId: 'routing-root',
  code: 'RT-KT-PRO-50',
  name: '50mm 景观草标准工艺',
  productItemId: 'item-root',
  version: 1,
  status: 'PUBLISHED',
  effective_at: '2026-01-01T00:00:00+00:00',
  operations: [operation(10, 'TUFT', '0.8')],
  ...overrides,
});

const detail: RoutingRow = {
  id: 'routing-root',
  code: 'RT-KT-PRO-50',
  name: '50mm 景观草标准工艺',
  productItemId: 'item-root',
  created_at: '2026-12-01T00:00:00+00:00',
  product: {
    itemId: 'item-root',
    sku: 'FG-KT-PRO-50',
    name: '金特夫 50mm 景观草',
    itemType: 'FINISHED_GOOD',
    baseUnitCode: 'M2',
  },
  versions: [
    routingRow({
      id: 'routingv-2',
      version: 2,
      status: 'DRAFT',
      published_at: null,
      operations: [operation(10, 'TUFT', '0.8'), operation(20, 'COAT', '0.5')],
    }),
    routingRow({ id: 'routingv-1' }),
  ],
};

const portsFor = (
  routings: readonly RoutingRow[] = [routingRow()],
  extraPermissions: readonly string[] = [],
  overrides: Partial<RoutingConsolePorts> = {},
): RoutingConsolePorts => ({
  permissions: new Set(['routing:read', ...extraPermissions]),
  initialRoutings: routings,
  itemVersionChoices: [
    { value: 'prodv-1', label: 'FG-KT-PRO-50 · 金特夫 50mm 景观草', itemId: 'item-root' },
  ],
  productTypeOf: (productItemId) => (productItemId === 'item-root' ? 'FINISHED_GOOD' : ''),
  recordText: (record, camel, snake, fallback = '') => {
    const value = record[camel] ?? record[snake] ?? fallback;
    return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
  },
  textValue: (value, fallback = '') =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
  businessStateLabel: (value) => String(value),
  fetchPage: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  loadDetail: vi.fn().mockResolvedValue(null),
  submit: vi.fn().mockResolvedValue(null),
  refresh: vi.fn().mockResolvedValue(routings),
  ...overrides,
});

const mount = (ports: RoutingConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(RoutingConsolePage(ports) as ComponentType, {}), host);
  return host;
};

const byTestId = (host: TestElement, id: string): TestElement => {
  const found = host.querySelector(`[data-testid="${id}"]`);
  if (!found) throw new Error(`missing ${id}`);
  return element(found);
};

// 同名首行字段（路线名称 name ↔ 工序名称 name）按序号消歧：match 为同名字段的序。
const type = async (
  host: TestElement,
  scope: string,
  name: string,
  value: string,
  match = 0,
): Promise<void> => {
  const controls = element(host.querySelector(scope))
    .querySelectorAll('input,textarea,select')
    .filter((item) => (item as TestElement).getAttribute('name') === name);
  const control = controls[match] as TestElement | undefined;
  if (!control) throw new Error(`missing field ${name}#${String(match)}`);
  control.value = value;
  control.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
};

const buttonByText = (host: TestElement, text: string): TestElement | undefined =>
  host.querySelectorAll('button').find((item) => (item as TestElement).textContent === text) as
    | TestElement
    | undefined;

const submitDrawer = async (host: TestElement): Promise<void> => {
  element(
    element(host.querySelector('.detail-drawer')).querySelector('button[type="submit"]'),
  ).click();
  await flush();
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('U3-MFG-3 工艺路线控制台：默认视图与 e2e 文案契约', () => {
  it('默认视图渲染全量快照；路线编码独占元素、状态徽章逐字 `已发布 · 第 1 版`', () => {
    const ports = portsFor();
    const host = mount(ports);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(byTestId(host, 'kt-routing-code').textContent).toBe('RT-KT-PRO-50');
    const badges = host
      .querySelectorAll('.status-badge')
      .map((node) => node.textContent.replace(/\s+/gu, ' '));
    expect(badges).toEqual(['已发布 · 第 1 版']);
    expect(host.textContent).toContain('产品 item-root');
    expect(ports.fetchPage).not.toHaveBeenCalled();
  });

  it('左树计数按路线根去重并经 productTypeOf 归类；权限门（manage/只读）', () => {
    const draft = routingRow({
      id: 'routingv-d',
      routingId: 'routing-draft',
      code: 'RT-KT-PRO-60',
      status: 'DRAFT',
    });
    const semi = routingRow({
      id: 'semi-routingv',
      routingId: 'semi-root',
      code: 'RT-SEMI',
      productItemId: 'semi-root',
    });
    const host = mount(
      portsFor([routingRow(), draft, semi], ['routing:manage'], {
        productTypeOf: (productItemId) =>
          productItemId === 'item-root'
            ? 'FINISHED_GOOD'
            : productItemId === 'semi-root'
              ? 'SEMI_FINISHED'
              : '',
      }),
    );
    expect(byTestId(host, 'kt-routing-product-all').textContent).toContain('3');
    expect(byTestId(host, 'kt-routing-product-finished_good').textContent).toContain('2');
    expect(byTestId(host, 'kt-routing-product-semi_finished').textContent).toContain('1');
    expect(host.querySelectorAll('[data-testid="kt-routing-publish"]')).toHaveLength(1);
    expect(byTestId(host, 'kt-routing-create')).not.toBeNull();
    const readonly = mount(portsFor());
    expect(readonly.querySelector('[data-testid="kt-routing-create"]')).toBe(null);
    expect(readonly.querySelectorAll('[data-testid="kt-routing-publish"]')).toHaveLength(0);
  });

  it('无草稿时「发布版本」计数为 0（e2e 黑盒契约）', () => {
    const host = mount(portsFor([routingRow()], ['routing:manage']));
    expect(host.textContent).not.toContain('发布版本');
  });
});

describe('U3-MFG-3 工艺路线控制台：筛选 / 检索 / 分页一体化', () => {
  it('产品类型/版本状态切换走服务端分页；回到全部沿用快照', async () => {
    const page: RoutingPage = { items: [routingRow()], nextCursor: null };
    const ports = portsFor(undefined, [], { fetchPage: vi.fn().mockResolvedValue(page) });
    const host = mount(ports);
    byTestId(host, 'kt-routing-product-semi_finished').click();
    await flush();
    expect(ports.fetchPage).toHaveBeenCalledExactlyOnceWith({
      productType: 'SEMI_FINISHED',
      limit: 50,
    });
    byTestId(host, 'kt-routing-status-all').click();
    await flush();
    // 状态回全部仍处于产品类型过滤态：第二次服务端请求仅带 productType。
    expect(ports.fetchPage).toHaveBeenCalledTimes(2);
    expect(ports.fetchPage).toHaveBeenLastCalledWith({ productType: 'SEMI_FINISHED', limit: 50 });
    byTestId(host, 'kt-routing-product-all').click();
    await flush();
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(ports.fetchPage).toHaveBeenCalledTimes(2);
  });

  it('关键字回车提交；nextCursor 非空时继续加载并追加行', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [routingRow()], nextCursor: 'RT-KT-PRO-50.1' })
      .mockResolvedValueOnce({
        items: [routingRow({ id: 'routingv-2', routingId: 'r2', code: 'RT-KT-PRO-60' })],
        nextCursor: null,
      });
    const host = mount(portsFor(undefined, [], { fetchPage }));
    byTestId(host, 'kt-routing-search').value = ' PRO ';
    byTestId(host, 'kt-routing-search').dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    byTestId(host, 'kt-routing-search-submit').click();
    await flush();
    expect(fetchPage).toHaveBeenLastCalledWith({ query: 'PRO', limit: 50 });
    element(buttonByText(host, '继续加载')).click();
    await flush();
    expect(fetchPage).toHaveBeenLastCalledWith({
      query: 'PRO',
      limit: 50,
      cursor: 'RT-KT-PRO-50.1',
    });
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('筛选空态/装载错态分离；动作失败呈独立告警不隐藏列表', async () => {
    const host = mount(portsFor());
    byTestId(host, 'kt-routing-status-retired').click();
    await flush();
    expect(host.textContent).toContain('没有符合条件的工艺路线版本');
    const failing = portsFor(undefined, [], {
      fetchPage: vi.fn().mockRejectedValue(new Error('路线服务不可用')),
    });
    const failed = mount(failing);
    byTestId(failed, 'kt-routing-status-draft').click();
    await flush();
    await flush();
    expect(failed.querySelector('.data-table-error')).not.toBeNull();
    const publishFailing = portsFor(
      [routingRow({ id: 'routingv-d', status: 'DRAFT', code: 'RT-KT-DRAFT' })],
      ['routing:manage'],
      { submit: vi.fn().mockRejectedValue(new Error('publish rejected')) },
    );
    const failedPublish = mount(publishFailing);
    at(failedPublish.querySelectorAll('[data-testid="kt-routing-publish"]')).click();
    await flush();
    await flush();
    expect(byTestId(failedPublish, 'kt-routing-action-error').textContent).toContain(
      'publish rejected',
    );
    expect(failedPublish.querySelector('.data-table-error')).toBe(null);
    expect(failedPublish.querySelectorAll('tbody tr')).toHaveLength(1);
  });
});

describe('U3-MFG-3 工艺路线控制台：详情抽屉（顺序步骤视图）', () => {
  it('查看行经 loadDetail 聚合产品/版本历史与工序升序步骤视图', async () => {
    const ports = portsFor(undefined, ['routing:manage'], {
      loadDetail: vi.fn().mockResolvedValue(detail),
    });
    const host = mount(ports);
    byTestId(host, 'kt-routing-open').click();
    await flush();
    await flush();
    expect(ports.loadDetail).toHaveBeenCalledExactlyOnceWith('routing-root');
    const drawer = element(host.querySelector('.detail-drawer'));
    expect(
      element(drawer.querySelector('[data-testid="kt-routing-detail-summary"]')).textContent,
    ).toContain('FG-KT-PRO-50 · 金特夫 50mm 景观草');
    expect(drawer.querySelectorAll('[data-testid="kt-routing-version"]')).toHaveLength(2);
    expect(drawer.querySelectorAll('[data-testid="kt-routing-publish-version"]')).toHaveLength(1);
    const steps = drawer.querySelectorAll('[data-testid="kt-routing-step-no"]');
    expect(steps).toHaveLength(2);
    expect(steps.map((node) => node.textContent)).toEqual(['1', '2']);
    expect(drawer.textContent).toContain('工作中心 WC-TUFT-01');
    expect(drawer.textContent).toContain('单件 0.8 分钟');
  });

  it('详情读取失败回退列表行；抽屉内发布草稿走 PUT publish 同链后重取详情', async () => {
    const loadDetail = vi.fn().mockRejectedValue(new Error('network'));
    const ports = portsFor(
      [routingRow({ id: 'routingv-d', status: 'DRAFT', code: 'RT-KT-DRAFT' })],
      ['routing:manage'],
      { loadDetail },
    );
    const host = mount(ports);
    byTestId(host, 'kt-routing-open').click();
    await flush();
    await flush();
    expect(host.querySelector('.detail-drawer')).not.toBeNull();
    expect(host.querySelectorAll('[data-testid="kt-routing-version"]')).toHaveLength(1);
    byTestId(element(host.querySelector('.detail-drawer')), 'kt-routing-publish-version').click();
    await flush();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/manufacturing-routings/routingv-d/publish',
      {},
      'PUT',
    );
    expect(loadDetail).toHaveBeenCalledTimes(2);
  });
});

describe('U3-MFG-3 工艺路线控制台：新建工艺路线（工序编辑器）', () => {
  it('单工序 TUFT 载荷与 vanilla 表单逐字节一致（publish false / sequence 10）', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-24T12:00:00Z'));
    try {
      const ports = portsFor([routingRow()], ['routing:manage']);
      const host = mount(ports);
      byTestId(host, 'kt-routing-create').click();
      await flush();
      await type(host, '.detail-drawer', 'code', ' RT-KT-PRO-51 ');
      await type(host, '.detail-drawer', 'name', '运动草标准工艺');
      const drawer = element(host.querySelector('.detail-drawer'));
      const product = drawer
        .querySelectorAll('select')
        .find((item) => (item as TestElement).getAttribute('name') === 'product') as TestElement;
      product.value = 'prodv-1';
      product.dispatchEvent(new Event('input', { bubbles: true }));
      await flush();
      await type(host, '.detail-drawer', 'o1:operationCode', 'TUFT');
      await type(host, '.detail-drawer', 'o1:name', '簇绒');
      await type(host, '.detail-drawer', 'o1:workCenterCode', 'WC-TUFT-01');
      await type(host, '.detail-drawer', 'o1:setupMinutes', '60');
      await type(host, '.detail-drawer', 'o1:runMinutesPerUnit', '0.8');
      await type(host, '.detail-drawer', 'effectiveAt', '2026-11-25');
      await submitDrawer(host);
      expect(ports.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/manufacturing-routings', {
        code: ' RT-KT-PRO-51 ',
        name: '运动草标准工艺',
        productItemId: 'item-root',
        productItemVersionId: 'prodv-1',
        effectiveAt: '2026-11-25T00:00:00.000Z',
        operations: [
          {
            operationCode: 'TUFT',
            name: '簇绒',
            workCenterCode: 'WC-TUFT-01',
            sequence: 10,
            setupMinutes: '60',
            runMinutesPerUnit: '0.8',
            instructions: {},
          },
        ],
        publish: false,
      });
      expect(ports.refresh).toHaveBeenCalledTimes(1);
      expect(host.querySelector('.detail-drawer')).toBe(null);
    } finally {
      vi.useRealTimers();
    }
  });

  it('多工序：添加行 sequence 按行序重排；上移/下移交换后行序跟随', async () => {
    const ports = portsFor([routingRow()], ['routing:manage']);
    const host = mount(ports);
    byTestId(host, 'kt-routing-create').click();
    await flush();
    byTestId(host, 'kt-routing-op-add').click();
    await flush();
    byTestId(host, 'kt-routing-op-add').click();
    await flush();
    expect(host.querySelectorAll('[data-testid="kt-routing-op-chip"]')).toHaveLength(3);
    // 第二行上移 → 行序 [r2, o1, o3]；载荷 sequence 依行序 10/20/30。
    at(host.querySelectorAll('[data-testid="kt-routing-op-up"]'), 1).click();
    await flush();
    expect(host.querySelectorAll('[data-testid="kt-routing-op-chip"]')).toHaveLength(3);
    await type(host, '.detail-drawer', 'code', 'RT-KT-PRO-52');
    await type(host, '.detail-drawer', 'name', 'RT');
    const drawer = element(host.querySelector('.detail-drawer'));
    const product = drawer
      .querySelectorAll('select')
      .find((item) => (item as TestElement).getAttribute('name') === 'product') as TestElement;
    product.value = 'prodv-1';
    product.dispatchEvent(new Event('input', { bubbles: true }));
    await type(host, '.detail-drawer', 'o1:operationCode', 'PACK');
    await type(host, '.detail-drawer', 'o1:name', '裁切包装');
    await type(host, '.detail-drawer', 'o1:workCenterCode', 'WC-PACK-01');
    await type(host, '.detail-drawer', 'o1:setupMinutes', '20');
    await type(host, '.detail-drawer', 'o1:runMinutesPerUnit', '0.2');
    await type(host, '.detail-drawer', 'o2:operationCode', 'TUFT');
    await type(host, '.detail-drawer', 'o2:name', '簇绒');
    await type(host, '.detail-drawer', 'o2:workCenterCode', 'WC-TUFT-01');
    await type(host, '.detail-drawer', 'o2:setupMinutes', '60');
    await type(host, '.detail-drawer', 'o2:runMinutesPerUnit', '0.8');
    await type(host, '.detail-drawer', 'o3:operationCode', 'COAT');
    await type(host, '.detail-drawer', 'o3:name', '背胶');
    await type(host, '.detail-drawer', 'o3:workCenterCode', 'WC-COAT-01');
    await type(host, '.detail-drawer', 'o3:setupMinutes', '45');
    await type(host, '.detail-drawer', 'o3:runMinutesPerUnit', '0.5');
    await type(host, '.detail-drawer', 'effectiveAt', '2026-11-25');
    await submitDrawer(host);
    const operations = (
      vi.mocked(ports.submit).mock.calls[0]?.[1] as {
        operations: { operationCode: string; sequence: number }[];
      }
    ).operations;
    // 上移第二行（TUFT）后行序 [o2, o1, o3]：TUFT → PACK → COAT，sequence 依行序。
    expect(operations.map((item) => item.operationCode)).toEqual(['TUFT', 'PACK', 'COAT']);
    expect(operations.map((item) => item.sequence)).toEqual([10, 20, 30]);
  });

  it('移除中间工序行不串值（首工序行无移除按钮，追加行字段前缀随行）', async () => {
    const ports = portsFor([routingRow()], ['routing:manage'], {
      submit: vi.fn().mockRejectedValue(new Error('产品版本不存在')),
    });
    const host = mount(ports);
    byTestId(host, 'kt-routing-create').click();
    await flush();
    byTestId(host, 'kt-routing-op-add').click();
    await flush();
    byTestId(host, 'kt-routing-op-add').click();
    await flush();
    at(host.querySelectorAll('[data-testid="kt-routing-op-remove"]'), 0).click();
    await flush();
    expect(host.querySelectorAll('[data-testid="kt-routing-op-chip"]')).toHaveLength(2);
    const drawer = element(host.querySelector('.detail-drawer'));
    expect(
      drawer
        .querySelectorAll('input,select')
        .find((item) => (item as TestElement).getAttribute('name') === 'o2:operationCode'),
    ).toBe(undefined);
    expect(
      drawer
        .querySelectorAll('input,select')
        .find((item) => (item as TestElement).getAttribute('name') === 'o3:operationCode'),
    ).not.toBe(undefined);
  });

  it('创建失败保留抽屉并呈现错误（必填齐全时提交）', async () => {
    const ports = portsFor([routingRow()], ['routing:manage'], {
      submit: vi.fn().mockRejectedValue(new Error('产品版本不存在')),
    });
    const host = mount(ports);
    byTestId(host, 'kt-routing-create').click();
    await flush();
    await type(host, '.detail-drawer', 'code', 'RT-KT-PRO-53');
    await type(host, '.detail-drawer', 'name', '运动草标准工艺', 0);
    const drawer = element(host.querySelector('.detail-drawer'));
    const product = drawer
      .querySelectorAll('select')
      .find((item) => (item as TestElement).getAttribute('name') === 'product') as TestElement;
    product.value = 'prodv-1';
    product.dispatchEvent(new Event('input', { bubbles: true }));
    await type(host, '.detail-drawer', 'o1:operationCode', 'TUFT');
    await type(host, '.detail-drawer', 'o1:name', '簇绒');
    await type(host, '.detail-drawer', 'o1:workCenterCode', 'WC-TUFT-01');
    await type(host, '.detail-drawer', 'o1:setupMinutes', '60');
    await type(host, '.detail-drawer', 'o1:runMinutesPerUnit', '0.8');
    await type(host, '.detail-drawer', 'effectiveAt', '2026-11-25');
    await submitDrawer(host);
    // TD-WF-005 / TD-WF-012：创建失败的原因改显示在表单自己的提示区（紧挨提交按钮）；
    // 抽屉顶部那个错误位（kt-routing-create-error）已撤。
    expect(
      element(
        element(host.querySelector('.detail-drawer form.form-section')).querySelector(
          '[role="alert"]',
        ),
      ).textContent,
    ).toContain('产品版本不存在');
    expect(host.querySelector('.detail-drawer')).not.toBeNull();
    expect(ports.refresh).not.toHaveBeenCalled();
  });
});

describe('U3-MFG-3 纯展示助手：operationsOf 行序编号', () => {
  it('sequence 按行序 10/20/30 重排；工序行字段一律带行前缀（防与路线级字段同名互覆）', () => {
    const operations = operationsOf(['o1', 'o2'], {
      'o1:operationCode': 'TUFT',
      'o1:name': '簇绒',
      'o1:workCenterCode': 'WC-TUFT-01',
      'o1:setupMinutes': '60',
      'o1:runMinutesPerUnit': '0.8',
      'o2:operationCode': 'COAT',
      'o2:name': '背胶',
      'o2:workCenterCode': 'WC-COAT-01',
      'o2:setupMinutes': '45',
      'o2:runMinutesPerUnit': '0.5',
    });
    expect(operations.map((item) => item.sequence)).toEqual([10, 20]);
    expect(operations[0]).toEqual({
      operationCode: 'TUFT',
      name: '簇绒',
      workCenterCode: 'WC-TUFT-01',
      sequence: 10,
      setupMinutes: '60',
      runMinutesPerUnit: '0.8',
      instructions: {},
    });
    expect(operations[1]?.operationCode).toBe('COAT');
  });
});
