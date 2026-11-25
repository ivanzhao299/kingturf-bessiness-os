// U3-MFG-2 BOM 控制台白盒行为测试（Preact 分域重写后的行为面；原 vanilla「创建标准
// BOM」表单载荷 oracle 等价迁移——单行无替代料逐字节一致/多行经前缀字段聚合；e2e
// 黑盒文案契约静态钉定：BOM 编码独占元素、`已发布 · 第 1 版` 徽章、表内产品 SKU 不
// 独占成元素（不与物料控制台 exact 定位撞 strict mode）、无草稿时无「发布版本」；
// 左树成品/半成品计数（productTypeOf 预聚）、层级树折叠/替代料标记、版本对比三类
// 差异高亮、行级发布、失败路径与竞态守卫。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { confirmAction } from '../../../test/fixtures/confirm-dialog';
import { BomConsolePage } from './bom-console';
import type { BomConsolePorts, BomPage, BomRow } from './bom-ports';
import { diffVersions } from './bom-state';

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

const component = (itemId: string, sku: string, version = 1): BomRow => ({
  itemId,
  sku,
  name: sku,
  version,
  itemType: 'RAW_MATERIAL',
  baseUnitCode: 'KG',
});
const lineOf = (
  component: BomRow,
  quantity: number,
  scrapBasisPoints = 300,
  substitutes: readonly BomRow[] = [],
): BomRow => ({
  lineNumber: 1,
  quantity,
  scrapBasisPoints,
  component,
  substitutes,
});
const versionRow = (overrides: Partial<BomRow> = {}): BomRow => ({
  id: 'bomv-1',
  version: 1,
  status: 'PUBLISHED',
  output_quantity: 1,
  effective_at: '2026-01-01T00:00:00+00:00',
  published_at: '2026-01-02T00:00:00+00:00',
  lines: [],
  ...overrides,
});

const bomRow = (overrides: Partial<BomRow> = {}): BomRow => ({
  id: 'bomv-1',
  bomId: 'bom-root',
  code: 'BOM-KT-PRO-50',
  name: '50mm 景观草标准 BOM',
  productItemId: 'item-root',
  version: 1,
  status: 'PUBLISHED',
  effective_at: '2026-01-01T00:00:00+00:00',
  lines: [],
  ...overrides,
});

const yarn = component('yarn-root', 'RM-KT-YARN-12000');
const alt = component('alt-root', 'RM-KT-YARN-11000');
const semi = { ...component('semi-root', 'SF-KT-TUFT-50'), itemType: 'SEMI_FINISHED' };
const listRow = bomRow({ lines: [lineOf(yarn, 1.25, 300, [{ ...alt, priority: 1 }])] });

const detail: BomRow = {
  id: 'bom-root',
  code: 'BOM-KT-PRO-50',
  name: '50mm 景观草标准 BOM',
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
    versionRow({
      id: 'bomv-2',
      version: 2,
      status: 'DRAFT',
      published_at: null,
      lines: [lineOf(yarn, 2, 500, [{ ...alt, priority: 1 }])],
    }),
    versionRow({ id: 'bomv-1', lines: [lineOf(yarn, 1.25, 300, [{ ...alt, priority: 1 }])] }),
  ],
  tree: [
    versionRow({
      id: 'bomv-1',
      lines: [
        {
          ...lineOf(yarn, 1.25, 300, [{ ...alt, priority: 1 }]),
          bom: {
            bomVersionId: 'semi-bomv-1',
            code: 'BOM-SEMI',
            name: '半成品 BOM',
            version: 1,
            status: 'PUBLISHED',
            lines: [{ ...lineOf(yarn, 0.5, 0), bom: null }],
          },
        },
      ],
    }),
  ],
};

const portsFor = (
  boms: readonly BomRow[] = [listRow],
  extraPermissions: readonly string[] = [],
  overrides: Partial<BomConsolePorts> = {},
): BomConsolePorts => ({
  permissions: new Set(['bom:read', ...extraPermissions]),
  initialBoms: boms,
  itemVersionChoices: [
    { value: 'prodv-1', label: 'FG-KT-PRO-50 · 金特夫 50mm 景观草', itemId: 'item-root' },
    { value: 'yarnv-1', label: 'RM-KT-YARN-12000 · 12000D 直丝草纱', itemId: 'yarn-root' },
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
  refresh: vi.fn().mockResolvedValue(boms),
  ...overrides,
});

const mount = (ports: BomConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(BomConsolePage(ports) as ComponentType, {}), host);
  return host;
};

const byTestId = (host: TestElement, id: string): TestElement => {
  const found = host.querySelector(`[data-testid="${id}"]`);
  if (!found) throw new Error(`missing ${id}`);
  return element(found);
};

const type = async (
  host: TestElement,
  scope: string,
  name: string,
  value: string,
): Promise<void> => {
  const control = element(host.querySelector(scope))
    .querySelectorAll('input,textarea,select')
    .find((item) => (item as TestElement).getAttribute('name') === name) as TestElement | undefined;
  if (!control) throw new Error(`missing field ${name}`);
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

describe('U3-MFG-2 BOM 控制台：默认视图与 e2e 文案契约', () => {
  it('默认视图渲染全量快照；BOM 编码独占元素、状态徽章逐字 `已发布 · 第 1 版`', () => {
    const ports = portsFor();
    const host = mount(ports);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(byTestId(host, 'kt-bom-code').textContent).toBe('BOM-KT-PRO-50');
    const badges = host
      .querySelectorAll('.status-badge')
      .map((node) => node.textContent.replace(/\s+/gu, ' '));
    expect(badges).toEqual(['已发布 · 第 1 版']);
    // 产品 SKU 并入复合文本、不独占成元素（不与物料控制台 exact 定位撞 strict mode）。
    expect(host.textContent).toContain('产品 item-root');
    expect(ports.fetchPage).not.toHaveBeenCalled();
  });

  it('左树计数按 BOM 根去重并经 productTypeOf 归类；持 manage 权限时草稿行有行级发布', () => {
    const draft = bomRow({
      id: 'bomv-d',
      code: 'BOM-KT-PRO-60',
      productItemId: 'item-root',
      status: 'DRAFT',
    });
    const semiBom = bomRow({
      id: 'semi-bomv',
      bomId: 'semi-root',
      code: 'BOM-SEMI',
      productItemId: 'semi-root',
    });
    const host = mount(
      portsFor([listRow, draft, semiBom], ['bom:manage'], {
        productTypeOf: (productItemId) =>
          productItemId === 'item-root'
            ? 'FINISHED_GOOD'
            : productItemId === 'semi-root'
              ? 'SEMI_FINISHED'
              : '',
      }),
    );
    expect(byTestId(host, 'kt-bom-product-all').textContent).toContain('3');
    expect(byTestId(host, 'kt-bom-product-finished_good').textContent).toContain('2');
    expect(byTestId(host, 'kt-bom-product-semi_finished').textContent).toContain('1');
    expect(host.querySelectorAll('[data-testid="kt-bom-publish"]')).toHaveLength(1);
    expect(byTestId(host, 'kt-bom-create')).not.toBeNull();
  });

  it('无草稿时「发布版本」计数为 0；无 bom:manage 时无新建入口（e2e 黑盒契约）', () => {
    const host = mount(portsFor([listRow], ['bom:manage']));
    expect(host.textContent).not.toContain('发布版本');
    const readonly = mount(portsFor());
    expect(readonly.querySelector('[data-testid="kt-bom-create"]')).toBe(null);
    expect(readonly.querySelectorAll('[data-testid="kt-bom-publish"]')).toHaveLength(0);
  });
});

describe('U3-MFG-2 BOM 控制台：筛选 / 检索 / 分页一体化', () => {
  it('产品类型/版本状态切换走服务端分页，回到全部沿用快照', async () => {
    const page: BomPage = { items: [listRow], nextCursor: null };
    const ports = portsFor(undefined, [], { fetchPage: vi.fn().mockResolvedValue(page) });
    const host = mount(ports);
    byTestId(host, 'kt-bom-product-semi_finished').click();
    await flush();
    expect(ports.fetchPage).toHaveBeenCalledExactlyOnceWith({
      productType: 'SEMI_FINISHED',
      limit: 50,
    });
    byTestId(host, 'kt-bom-status-draft').click();
    await flush();
    expect(ports.fetchPage).toHaveBeenLastCalledWith({
      productType: 'SEMI_FINISHED',
      status: 'DRAFT',
      limit: 50,
    });
    byTestId(host, 'kt-bom-product-all').click();
    await flush();
    // 回到全部但仍按版本状态过滤：第三次服务端请求仅带 status。
    expect(ports.fetchPage).toHaveBeenCalledTimes(3);
    expect(ports.fetchPage).toHaveBeenLastCalledWith({ status: 'DRAFT', limit: 50 });
    byTestId(host, 'kt-bom-status-all').click();
    await flush();
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(ports.fetchPage).toHaveBeenCalledTimes(3);
  });

  it('关键字回车提交与清除；nextCursor 非空时继续加载并追加行', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [listRow], nextCursor: 'BOM-KT-PRO-50.1' })
      .mockResolvedValueOnce({
        items: [bomRow({ id: 'bomv-2', code: 'BOM-KT-PRO-60' })],
        nextCursor: null,
      });
    const host = mount(portsFor(undefined, [], { fetchPage }));
    byTestId(host, 'kt-bom-search').value = ' PRO ';
    byTestId(host, 'kt-bom-search').dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    byTestId(host, 'kt-bom-search-submit').click();
    await flush();
    expect(fetchPage).toHaveBeenLastCalledWith({ query: 'PRO', limit: 50 });
    element(buttonByText(host, '继续加载')).click();
    await flush();
    expect(fetchPage).toHaveBeenLastCalledWith({
      query: 'PRO',
      limit: 50,
      cursor: 'BOM-KT-PRO-50.1',
    });
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(byTestId(host, 'kt-bom-search-applied').textContent).toContain('PRO');
    byTestId(host, 'kt-bom-search-clear').click();
    await flush();
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('筛选空态/装载错态分离；动作失败呈独立告警不隐藏列表', async () => {
    const host = mount(portsFor());
    byTestId(host, 'kt-bom-status-retired').click();
    await flush();
    expect(host.textContent).toContain('没有符合条件的 BOM 版本');
    const failing = portsFor(undefined, [], {
      fetchPage: vi.fn().mockRejectedValue(new Error('BOM 服务不可用')),
    });
    const failed = mount(failing);
    byTestId(failed, 'kt-bom-status-draft').click();
    await flush();
    await flush();
    expect(failed.querySelector('.data-table-error')).not.toBeNull();
    const publishFailing = portsFor([bomRow({ id: 'bomv-d', status: 'DRAFT' })], ['bom:manage'], {
      submit: vi.fn().mockRejectedValue(new Error('publish rejected')),
    });
    const failedPublish = mount(publishFailing);
    at(failedPublish.querySelectorAll('[data-testid="kt-bom-publish"]')).click();
    // TD-WF-014②：发布不可逆，单击先出确认框，确认后才发请求。
    await flush();
    expect(publishFailing.submit).not.toHaveBeenCalled();
    await confirmAction(failedPublish, '发布版本', '确认发布');
    await flush();
    expect(byTestId(failedPublish, 'kt-bom-action-error').textContent).toContain(
      'publish rejected',
    );
    expect(failedPublish.querySelector('.data-table-error')).toBe(null);
    expect(failedPublish.querySelectorAll('tbody tr')).toHaveLength(1);
  });
});

describe('U3-MFG-2 BOM 控制台：详情抽屉（层级树/替代料/对比）', () => {
  it('查看行经 loadDetail 聚合产品/版本历史/组件层级树与替代料标记', async () => {
    const ports = portsFor(undefined, ['bom:manage'], {
      loadDetail: vi.fn().mockResolvedValue(detail),
    });
    const host = mount(ports);
    byTestId(host, 'kt-bom-open').click();
    await flush();
    await flush();
    expect(ports.loadDetail).toHaveBeenCalledExactlyOnceWith('bom-root');
    const drawer = element(host.querySelector('.detail-drawer'));
    expect(
      element(drawer.querySelector('[data-testid="kt-bom-detail-summary"]')).textContent,
    ).toContain('FG-KT-PRO-50 · 金特夫 50mm 景观草');
    expect(drawer.querySelectorAll('[data-testid="kt-bom-version"]')).toHaveLength(2);
    expect(drawer.querySelectorAll('[data-testid="kt-bom-publish-version"]')).toHaveLength(1);
    expect(drawer.querySelectorAll('[data-testid="kt-bom-substitute"]')).toHaveLength(1);
    // 子 BOM 展开：SF-KT-TUFT-50 行挂 BOM-SEMI 子树（可折叠）。
    expect(drawer.textContent).toContain('↳ 子 BOM BOM-SEMI');
    const toggle = byTestId(drawer, 'kt-bom-tree-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    await flush();
    expect(byTestId(drawer, 'kt-bom-tree-toggle').getAttribute('aria-expanded')).toBe('false');
    expect(drawer.textContent).not.toContain('↳ 子 BOM BOM-SEMI');
    toggle.click();
    await flush();
    expect(drawer.textContent).toContain('↳ 子 BOM BOM-SEMI');
  });

  it('版本对比：新增/删除/变化三类差异高亮与选择器联动', async () => {
    const ports = portsFor(undefined, [], { loadDetail: vi.fn().mockResolvedValue(detail) });
    const host = mount(ports);
    byTestId(host, 'kt-bom-open').click();
    await flush();
    await flush();
    // 默认对比：v2（草稿最新）vs v1。
    expect(byTestId(host, 'kt-bom-compare-count').textContent).toContain('差异 1 处');
    expect(host.querySelectorAll('[data-testid="kt-bom-diff-changed"]')).toHaveLength(1);
    expect(host.querySelector('[data-testid="kt-bom-diff-added"]')).toBe(null);
    expect(host.querySelector('[data-testid="kt-bom-diff-removed"]')).toBe(null);
    expect(host.querySelector('.bom-diff-field')?.textContent).toContain('用量：1.25 → 2');
    // 选择器同版本守卫：把「较新」选成与「较旧」相同的版本被忽略（不触发对比重算）。
    byTestId(host, 'kt-bom-compare-a').value = 'bomv-1';
    byTestId(host, 'kt-bom-compare-a').dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(byTestId(host, 'kt-bom-compare-count').textContent).toContain('差异 1 处');
  });

  it('详情读取失败回退列表行；抽屉内发布草稿走 PUT publish 同链后重取详情', async () => {
    const loadDetail = vi.fn().mockRejectedValue(new Error('network'));
    const ports = portsFor(
      [bomRow({ id: 'bomv-d', status: 'DRAFT', code: 'BOM-KT-DRAFT' })],
      ['bom:manage'],
      { loadDetail },
    );
    const host = mount(ports);
    byTestId(host, 'kt-bom-open').click();
    await flush();
    await flush();
    expect(host.querySelector('.detail-drawer')).not.toBeNull();
    expect(host.querySelectorAll('[data-testid="kt-bom-version"]')).toHaveLength(1);
    const drawer = element(host.querySelector('.detail-drawer'));
    byTestId(drawer, 'kt-bom-publish-version').click();
    // TD-WF-014②：发布不可逆，单击先出确认框，确认后才发请求。
    await flush();
    expect(ports.submit).not.toHaveBeenCalled();
    await confirmAction(host, '发布版本', '确认发布');
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/manufacturing-boms/bomv-d/publish',
      {},
      'PUT',
    );
    expect(loadDetail).toHaveBeenCalledTimes(2);
  });
});

describe('U3-MFG-2 BOM 控制台：新建 BOM', () => {
  it('单行无替代料的创建载荷与 vanilla 表单逐字节一致（publish false / outputQuantity 1）', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-23T12:00:00Z'));
    try {
      const ports = portsFor([listRow], ['bom:manage']);
      const host = mount(ports);
      byTestId(host, 'kt-bom-create').click();
      await flush();
      await type(host, '.detail-drawer', 'code', ' BOM-KT-PRO-51 ');
      await type(host, '.detail-drawer', 'name', '运动草 BOM');
      const product = element(host.querySelector('.detail-drawer'))
        .querySelectorAll('select')
        .find((item) => (item as TestElement).getAttribute('name') === 'product') as TestElement;
      product.value = 'prodv-1';
      product.dispatchEvent(new Event('input', { bubbles: true }));
      await flush();
      const componentSelect = element(host.querySelector('.detail-drawer'))
        .querySelectorAll('select')
        .find((item) => (item as TestElement).getAttribute('name') === 'component') as TestElement;
      componentSelect.value = 'yarnv-1';
      componentSelect.dispatchEvent(new Event('input', { bubbles: true }));
      await flush();
      await type(host, '.detail-drawer', 'quantity', '1.25');
      await type(host, '.detail-drawer', 'scrap', '300');
      await type(host, '.detail-drawer', 'effectiveAt', '2026-11-24');
      await submitDrawer(host);
      expect(ports.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/manufacturing-boms', {
        code: ' BOM-KT-PRO-51 ',
        name: '运动草 BOM',
        productItemId: 'item-root',
        productItemVersionId: 'prodv-1',
        outputQuantity: '1',
        effectiveAt: '2026-11-24T00:00:00.000Z',
        lines: [
          {
            componentItemVersionId: 'yarnv-1',
            quantity: '1.25',
            scrapBasisPoints: 300,
            substitutes: [],
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

  it('多行组件经前缀字段聚合；可选替代料转 substitutes 数组；创建失败保留抽屉', async () => {
    const ports = portsFor([listRow], ['bom:manage'], {
      submit: vi.fn().mockRejectedValue(new Error('组件版本不存在')),
    });
    const host = mount(ports);
    byTestId(host, 'kt-bom-create').click();
    await flush();
    byTestId(host, 'kt-bom-row-add').click();
    await flush();
    await type(host, '.detail-drawer', 'code', 'BOM-KT-PRO-52');
    await type(host, '.detail-drawer', 'name', 'BOM');
    const drawer = element(host.querySelector('.detail-drawer'));
    const selects = drawer.querySelectorAll('select');
    const product = selects.find(
      (item) => (item as TestElement).getAttribute('name') === 'product',
    ) as TestElement;
    product.value = 'prodv-1';
    product.dispatchEvent(new Event('input', { bubbles: true }));
    const first = selects.find(
      (item) => (item as TestElement).getAttribute('name') === 'component',
    ) as TestElement;
    first.value = 'yarnv-1';
    first.dispatchEvent(new Event('input', { bubbles: true }));
    await type(host, '.detail-drawer', 'quantity', '1');
    await type(host, '.detail-drawer', 'scrap', '0');
    await type(host, '.detail-drawer', 'substitute', 'yarnv-1');
    await type(host, '.detail-drawer', 'r2:component', 'yarnv-1');
    await type(host, '.detail-drawer', 'r2:quantity', '0.5');
    await type(host, '.detail-drawer', 'r2:scrap', '100');
    await type(host, '.detail-drawer', 'effectiveAt', '2026-11-24');
    await submitDrawer(host);
    expect(vi.mocked(ports.submit).mock.calls[0]?.[1]).toMatchObject({
      lines: [
        {
          componentItemVersionId: 'yarnv-1',
          quantity: '1',
          scrapBasisPoints: 0,
          substitutes: [{ itemVersionId: 'yarnv-1', priority: 1, conversionFactor: '1' }],
        },
        {
          componentItemVersionId: 'yarnv-1',
          quantity: '0.5',
          scrapBasisPoints: 100,
          substitutes: [],
        },
      ],
    });
    // TD-WF-005 / TD-WF-012：创建失败的原因改显示在表单自己的提示区（紧挨提交按钮）；
    // 抽屉顶部那个错误位（kt-bom-create-error）已撤。
    expect(
      element(
        element(host.querySelector('.detail-drawer form.form-section')).querySelector(
          '[role="alert"]',
        ),
      ).textContent,
    ).toContain('组件版本不存在');
    expect(host.querySelector('.detail-drawer')).not.toBeNull();
  });

  it('移除中间组件行不串值；行 chip 计数联动', async () => {
    const ports = portsFor([listRow], ['bom:manage']);
    const host = mount(ports);
    byTestId(host, 'kt-bom-create').click();
    await flush();
    byTestId(host, 'kt-bom-row-add').click();
    await flush();
    byTestId(host, 'kt-bom-row-add').click();
    await flush();
    expect(host.querySelectorAll('[data-testid="kt-bom-row-chip"]')).toHaveLength(3);
    at(host.querySelectorAll('[data-testid="kt-bom-row-remove"]'), 1).click();
    await flush();
    expect(host.querySelectorAll('[data-testid="kt-bom-row-chip"]')).toHaveLength(2);
    // r2 已移除：其字段不应再出现在表单中。
    const drawer = element(host.querySelector('.detail-drawer'));
    expect(
      drawer
        .querySelectorAll('input,select')
        .find((item) => (item as TestElement).getAttribute('name') === 'r2:component'),
    ).toBe(undefined);
    expect(
      drawer
        .querySelectorAll('input,select')
        .find((item) => (item as TestElement).getAttribute('name') === 'r3:component'),
    ).not.toBe(undefined);
  });
});

describe('U3-MFG-2 纯展示助手：diffVersions 三类差异', () => {
  it('新增/删除/变化（用量、损耗率、替代料）分类与字段级 old→new', () => {
    const backing = component('backing-root', 'RM-BACKING-PP');
    const base = versionRow({
      id: 'v1',
      lines: [lineOf(yarn, 1.25, 300, [{ ...alt, priority: 1 }]), lineOf(semi, 2)],
    });
    const next = versionRow({
      id: 'v2',
      lines: [lineOf(yarn, 1.5, 300, [{ ...alt, priority: 2 }]), lineOf(backing, 1)],
    });
    const diffs = diffVersions(next, base);
    const kinds = diffs.map((diff) => diff.kind).sort();
    expect(kinds).toEqual(['ADDED', 'CHANGED', 'REMOVED']);
    const changed = diffs.find((diff) => diff.kind === 'CHANGED');
    expect(changed?.changes.map((change) => change.label)).toEqual(['用量', '替代料']);
    expect(changed?.changes[0]).toEqual({ label: '用量', from: '1.25', to: '1.5' });
    expect(changed?.changes[1]).toEqual({ label: '替代料', from: 'v1', to: 'v1' });
    expect(diffs.find((diff) => diff.kind === 'ADDED')?.component.sku).toBe('RM-BACKING-PP');
    expect(diffs.find((diff) => diff.kind === 'REMOVED')?.component.sku).toBe('SF-KT-TUFT-50');
    // 一致行项：diff 为空。
    expect(diffVersions(base, versionRow({ id: 'v1', lines: base.lines }))).toEqual([]);
  });
});
