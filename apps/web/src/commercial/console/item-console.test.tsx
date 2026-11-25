// U3-MFG-1 物料管理控制台白盒行为测试（Preact 分域重写后的行为面；原 vanilla
// 「创建物料版本」表单载荷 oracle 等价迁移——publish 恒 false/effectiveAt 归一/
// 规格数值化；e2e 黑盒文案契约静态钉定：SKU 独占元素、`已发布 · 第 N 版` 徽章、
// 无草稿时无「发布版本」；分类/状态/关键字服务端筛选与游标续载；行级发布；
// 详情抽屉聚合与读权限门控；三态呈现）。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import {
  installGlobalTestDom,
  TestDocument,
  TestNode,
  type TestElement,
} from '../../../test/fixtures/preact-dom';
import {
  confirmAction,
  confirmDialogOf,
  dismissConfirm,
} from '../../../test/fixtures/confirm-dialog';
import { ItemConsolePage } from './item-console';
import { noticeOf } from '../../../test/fixtures/console-notice';
import type { ItemConsolePorts, ItemPage, ItemRow } from './item-ports';
import { countAllItems, countByCategory, specEntries, specificationOf } from './item-state';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const version = (overrides: Partial<ItemRow> = {}): ItemRow => ({
  id: 'item-v1',
  itemId: 'item-root',
  sku: 'FG-KT-PRO-50',
  name: '金特夫 50mm 景观草',
  itemType: 'FINISHED_GOOD',
  baseUnitCode: 'M2',
  version: 1,
  status: 'PUBLISHED',
  specification: { pileHeightMm: 50, gauge: '3/8' },
  effective_at: '2026-01-01T00:00:00+00:00',
  published_at: '2026-01-02T00:00:00+00:00',
  ...overrides,
});

// 同物料双版本（v2 草稿）+ 另一物料：分类计数须按物料根去重。
const published = version();
const draft = version({ id: 'item-v2', version: 2, status: 'DRAFT', published_at: null });
const yarn = version({
  id: 'yarn-v1',
  itemId: 'yarn-root',
  sku: 'RM-KT-YARN-12000',
  name: '12000D 直丝草纱',
  itemType: 'RAW_MATERIAL',
  baseUnitCode: 'KG',
  specification: { dtex: 12000, color: '双色绿' },
});

const detail: ItemRow = {
  id: 'item-root',
  sku: 'FG-KT-PRO-50',
  name: '金特夫 50mm 景观草',
  itemType: 'FINISHED_GOOD',
  baseUnitCode: 'M2',
  created_at: '2026-12-01T00:00:00+00:00',
  versions: [draft, published],
  boms: [
    {
      id: 'bom-1',
      code: 'BOM-KT-PRO-50',
      name: '50mm 景观草标准 BOM',
      versions: [{ id: 'bom-v1', version: 1, status: 'PUBLISHED' }],
    },
  ],
  usedIn: [],
  routings: [
    {
      id: 'rt-1',
      code: 'RT-KT-PRO-50',
      name: '50mm 景观草标准工艺',
      versions: [{ id: 'rt-v1', version: 1, status: 'PUBLISHED' }],
    },
  ],
  productionOrders: [
    {
      id: 'wo-1',
      orderNumber: 'WO-KT-2026-001',
      state: 'CLOSED',
      plannedQuantity: 1000,
      plannedDueAt: '2026-08-20',
    },
  ],
};

const portsFor = (
  items: readonly ItemRow[] = [published, draft, yarn],
  extraPermissions: readonly string[] = [],
  overrides: Partial<ItemConsolePorts> = {},
): ItemConsolePorts => ({
  permissions: new Set(['manufacturing-item:read', ...extraPermissions]),
  initialItems: items,
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
  refresh: vi.fn().mockResolvedValue(items),
  ...overrides,
});

const mount = (ports: ItemConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(ItemConsolePage(ports) as ComponentType, {}), host);
  return host;
};

const byTestId = (host: TestElement, id: string): TestElement => {
  const found = host.querySelector(`[data-testid="${id}"]`);
  if (!found) throw new Error(`missing ${id}`);
  return element(found);
};

// 每次输入后让出一帧：真实浏览器中每次击键是独立事件循环任务（渲染间发生）。
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

// querySelectorAll 返回 TestNode[]：按序取元素并以 nodeType 收窄（同 element 口径）。
const at = (nodes: readonly TestNode[], index = 0): TestElement => {
  const node = nodes[index];
  if (node?.nodeType !== 1) throw new Error(`expected element at ${String(index)}`);
  return node as TestElement;
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

describe('U3-MFG-1 物料控制台：默认视图与 e2e 文案契约', () => {
  it('默认视图渲染全量快照；SKU 独占元素、状态徽章逐字 `已发布 · 第 1 版`', () => {
    const ports = portsFor();
    const host = mount(ports);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3);
    const skus = host
      .querySelectorAll('[data-testid="kt-item-sku"]')
      .map((node) => node.textContent);
    expect(skus).toEqual(['FG-KT-PRO-50', 'FG-KT-PRO-50', 'RM-KT-YARN-12000']);
    const badges = host
      .querySelectorAll('.status-badge')
      .map((node) => node.textContent.replace(/\s+/gu, ' '));
    expect(badges.filter((text) => text === '已发布 · 第 1 版')).toHaveLength(2);
    expect(badges.filter((text) => text === '草稿 · 第 2 版')).toHaveLength(1);
    // 行内不再出现 BOM/工艺路线编码的独占元素（e2e exact 定位器须唯一命中 vanilla 卡片）。
    expect(host.textContent).not.toContain('BOM-KT-PRO-50');
    expect(host.textContent).not.toContain('RT-KT-PRO-50');
    expect(ports.fetchPage).not.toHaveBeenCalled();
  });

  it('分类计数按物料根去重；持 manage 权限时草稿行有「发布版本」行级操作', () => {
    const host = mount(portsFor([published, draft, yarn], ['manufacturing-item:manage']));
    expect(byTestId(host, 'kt-item-category-all').textContent).toContain('2');
    expect(byTestId(host, 'kt-item-category-finished_good').textContent).toContain('1');
    expect(byTestId(host, 'kt-item-category-raw_material').textContent).toContain('1');
    expect(byTestId(host, 'kt-item-category-packaging').textContent).toContain('0');
    expect(host.querySelectorAll('[data-testid="kt-item-publish"]')).toHaveLength(1);
    expect(host.querySelector('[data-testid="kt-item-sku"][aria-hidden]')).toBe(null);
    expect(byTestId(host, 'kt-item-create')).not.toBeNull();
  });

  it('无草稿版本时「发布版本」文案计数为 0（e2e 黑盒契约）', () => {
    const host = mount(portsFor([published, yarn], ['manufacturing-item:manage']));
    expect(host.textContent).not.toContain('发布版本');
  });

  it('权限门：无 manufacturing-item:manage 时无新建入口、草稿行无发布按钮', () => {
    const host = mount(portsFor());
    expect(host.querySelector('[data-testid="kt-item-create"]')).toBe(null);
    expect(host.querySelectorAll('[data-testid="kt-item-publish"]')).toHaveLength(0);
    expect(host.textContent).toContain('草稿 · 第 2 版');
  });
});

describe('U3-MFG-1 物料控制台：筛选 / 检索 / 分页一体化', () => {
  it('分类切换走服务端分页（itemType + limit），回到全部沿用快照不再请求', async () => {
    const page: ItemPage = { items: [yarn], nextCursor: null };
    const ports = portsFor(undefined, [], { fetchPage: vi.fn().mockResolvedValue(page) });
    const host = mount(ports);
    byTestId(host, 'kt-item-category-raw_material').click();
    await flush();
    expect(ports.fetchPage).toHaveBeenCalledExactlyOnceWith({
      itemType: 'RAW_MATERIAL',
      limit: 50,
    });
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(byTestId(host, 'kt-item-category-raw_material').getAttribute('aria-selected')).toBe(
      'true',
    );
    byTestId(host, 'kt-item-category-all').click();
    await flush();
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(ports.fetchPage).toHaveBeenCalledTimes(1);
  });

  it('版本状态与关键字（回车提交）组合为服务端查询；清除后回到快照', async () => {
    const ports = portsFor();
    const host = mount(ports);
    byTestId(host, 'kt-item-status-draft').click();
    await flush();
    expect(ports.fetchPage).toHaveBeenLastCalledWith({ status: 'DRAFT', limit: 50 });
    byTestId(host, 'kt-item-search').value = '  pro-50 ';
    byTestId(host, 'kt-item-search').dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    byTestId(host, 'kt-item-search-submit').click();
    await flush();
    expect(ports.fetchPage).toHaveBeenLastCalledWith({
      status: 'DRAFT',
      query: 'pro-50',
      limit: 50,
    });
    expect(byTestId(host, 'kt-item-search-applied').textContent).toContain('pro-50');
    byTestId(host, 'kt-item-search-clear').click();
    byTestId(host, 'kt-item-status-all').click();
    await flush();
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(host.querySelector('[data-testid="kt-item-search-clear"]')).toBe(null);
  });

  it('nextCursor 非空时「继续加载」以 cursor 续载并追加行', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [published], nextCursor: 'FG-KT-PRO-50.1' })
      .mockResolvedValueOnce({ items: [draft], nextCursor: null });
    const host = mount(portsFor(undefined, [], { fetchPage }));
    byTestId(host, 'kt-item-category-finished_good').click();
    await flush();
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
    element(buttonByText(host, '继续加载')).click();
    await flush();
    expect(fetchPage).toHaveBeenLastCalledWith({
      itemType: 'FINISHED_GOOD',
      limit: 50,
      cursor: 'FG-KT-PRO-50.1',
    });
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(buttonByText(host, '继续加载')).toBeUndefined();
  });

  it('筛选结果为空显示条件空态；筛选请求失败经 DataTable error 面暴露', async () => {
    const host = mount(portsFor());
    byTestId(host, 'kt-item-category-packaging').click();
    await flush();
    expect(host.textContent).toContain('没有符合条件的物料版本');
    const failing = portsFor(undefined, [], {
      fetchPage: vi.fn().mockRejectedValue(new Error('物料服务不可用')),
    });
    const failed = mount(failing);
    byTestId(failed, 'kt-item-category-packaging').click();
    await flush();
    await flush();
    expect(failed.querySelector('.data-table-error')).not.toBeNull();
    expect(failed.textContent).toContain('物料服务不可用');
  });

  it('刷新按钮经全量 refresh 同步快照；刷新失败暴露错误', async () => {
    const items = [published, yarn];
    const ports = portsFor(items, [], { refresh: vi.fn().mockResolvedValue([yarn]) });
    const host = mount(ports);
    byTestId(host, 'kt-item-refresh').click();
    await flush();
    await flush();
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(byTestId(host, 'kt-item-category-all').textContent).toContain('1');
    const failing = portsFor(items, [], {
      refresh: vi.fn().mockRejectedValue(new Error('物料刷新失败')),
    });
    const failed = mount(failing);
    byTestId(failed, 'kt-item-refresh').click();
    await flush();
    await flush();
    expect(failed.querySelector('.data-table-error')).not.toBeNull();
  });
});

describe('U3-MFG-1 物料控制台：行级动作', () => {
  it('草稿行「发布版本」走 legacy publish 端点后全量重读，行状态随快照更新', async () => {
    const ports = portsFor([published, draft, yarn], ['manufacturing-item:manage'], {
      refresh: vi
        .fn()
        .mockResolvedValue([published, version({ ...draft, status: 'PUBLISHED' }), yarn]),
    });
    const host = mount(ports);
    byTestId(host, 'kt-item-publish').click();
    // TD-WF-014②：发布不可逆，单击先出确认框，确认后才发请求。
    await flush();
    expect(ports.submit).not.toHaveBeenCalled();
    await confirmAction(host, '发布版本', '确认发布');
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/manufacturing-item-versions/item-v2/publish',
      {},
    );
    expect(ports.refresh).toHaveBeenCalledTimes(1);
    expect(host.querySelectorAll('[data-testid="kt-item-publish"]')).toHaveLength(0);
    expect(host.textContent).toContain('已发布 · 第 2 版');
  });

  it('发布失败在抽屉/列表提交错误面呈现', async () => {
    const ports = portsFor([published, draft], ['manufacturing-item:manage'], {
      submit: vi.fn().mockRejectedValue(new Error('publish rejected')),
    });
    const host = mount(ports);
    byTestId(host, 'kt-item-publish').click();
    // TD-WF-014②：发布不可逆，单击先出确认框，确认后才发请求。
    await flush();
    expect(ports.submit).not.toHaveBeenCalled();
    await confirmAction(host, '发布版本', '确认发布');
    await flush();
    expect(byTestId(host, 'kt-item-action-error').textContent).toContain('publish rejected');
    // 动作错误不隐藏列表：行与发布按钮保留，DataTable 不进入错态。
    expect(host.querySelectorAll('[data-testid="kt-item-publish"]')).toHaveLength(1);
    expect(host.querySelector('.data-table-error')).toBe(null);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
  });
});

describe('U3-MFG-1 物料控制台：新建物料', () => {
  it('创建载荷与 vanilla 表单逐字节一致（publish false / effectiveAt 归一 / 默认规格空对象）', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-23T12:00:00Z'));
    try {
      const ports = portsFor([published], ['manufacturing-item:manage']);
      const host = mount(ports);
      byTestId(host, 'kt-item-create').click();
      await flush();
      await type(host, '.detail-drawer', 'sku', ' FG-KT-PRO-51 ');
      await type(host, '.detail-drawer', 'name', '金特夫 50mm 运动草');
      await type(host, '.detail-drawer', 'effectiveAt', '2026-11-24');
      await submitDrawer(host);
      expect(ports.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/manufacturing-items', {
        sku: ' FG-KT-PRO-51 ',
        name: '金特夫 50mm 运动草',
        itemType: 'RAW_MATERIAL',
        baseUnitCode: 'M2',
        specification: {},
        effectiveAt: '2026-11-24T00:00:00.000Z',
        publish: false,
      });
      expect(ports.refresh).toHaveBeenCalledTimes(1);
      expect(host.querySelector('.detail-drawer')).toBe(null);
    } finally {
      vi.useRealTimers();
    }
  });

  it('生效日期默认当天；规格预设随物料类型切换，数值键归一为数值', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-23T12:00:00Z'));
    try {
      const ports = portsFor([], ['manufacturing-item:manage']);
      const host = mount(ports);
      byTestId(host, 'kt-item-create').click();
      await flush();
      // 默认类型「原材料」给出 旦数/颜色/层数 预设，无草高。
      const labels = () =>
        host
          .querySelectorAll('[data-testid="kt-item-spec-preset"]')
          .map((node) => node.textContent);
      expect(labels()).toEqual(['＋ 旦数（dtex）', '＋ 颜色', '＋ 层数']);
      byTestId(host, 'kt-item-create-type').value = 'FINISHED_GOOD';
      byTestId(host, 'kt-item-create-type').dispatchEvent(new Event('input', { bubbles: true }));
      await flush();
      expect(labels()).toEqual(['＋ 草高（mm）', '＋ 针距']);
      at(host.querySelectorAll('[data-testid="kt-item-spec-preset"]'), 0).click();
      await flush();
      byTestId(host, 'kt-item-spec-custom').click();
      await flush();
      await type(host, '.detail-drawer', 'sku', 'FG-KT-PRO-52');
      await type(host, '.detail-drawer', 'name', '运动草');
      await type(host, '.detail-drawer', 'spec:1:value', '50.5');
      await type(host, '.detail-drawer', 'spec:2:key', 'stitchRate');
      await type(host, '.detail-drawer', 'spec:2:value', '180');
      await submitDrawer(host);
      expect(vi.mocked(ports.submit).mock.calls[0]?.[1]).toMatchObject({
        itemType: 'FINISHED_GOOD',
        specification: { pileHeightMm: 50.5, stitchRate: 180 },
        effectiveAt: '2026-11-23T00:00:00.000Z',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('移除中间规格行不串值；创建失败保留抽屉并呈现错误', async () => {
    const ports = portsFor([], ['manufacturing-item:manage'], {
      submit: vi.fn().mockRejectedValue(new Error('sku 已存在')),
    });
    const host = mount(ports);
    byTestId(host, 'kt-item-create').click();
    await flush();
    byTestId(host, 'kt-item-spec-custom').click();
    await flush();
    byTestId(host, 'kt-item-spec-custom').click();
    await flush();
    await type(host, '.detail-drawer', 'spec:1:key', 'firstKey');
    await type(host, '.detail-drawer', 'spec:1:value', '1');
    await type(host, '.detail-drawer', 'spec:2:key', 'secondKey');
    await type(host, '.detail-drawer', 'spec:2:value', '2');
    at(host.querySelectorAll('[data-testid="kt-item-spec-remove"]'), 0).click();
    await flush();
    await type(host, '.detail-drawer', 'sku', 'FG-KT-PRO-53');
    await type(host, '.detail-drawer', 'name', '运动草');
    await submitDrawer(host);
    expect(vi.mocked(ports.submit).mock.calls[0]?.[1]).toMatchObject({
      specification: { secondKey: 2 },
    });
    // TD-WF-005 / TD-WF-012：创建失败的原因改显示在表单自己的提示区（紧挨提交按钮）；
    // 抽屉顶部那个错误位（kt-item-create-error）已撤。
    expect(
      element(
        element(host.querySelector('.detail-drawer form.form-section')).querySelector(
          '[role="alert"]',
        ),
      ).textContent,
    ).toContain('sku 已存在');
    expect(host.querySelector('.detail-drawer')).not.toBeNull();
    expect(ports.refresh).not.toHaveBeenCalled();
  });
});

describe('U3-MFG-1 物料控制台：详情抽屉', () => {
  it('查看行经 loadDetail 聚合版本历史/规格参数/关联 BOM/工艺路线/最近工单', async () => {
    const ports = portsFor(undefined, ['manufacturing-item:manage'], {
      loadDetail: vi.fn().mockResolvedValue(detail),
    });
    const host = mount(ports);
    at(host.querySelectorAll('[data-testid="kt-item-open"]')).click();
    await flush();
    await flush();
    expect(ports.loadDetail).toHaveBeenCalledExactlyOnceWith('item-root');
    const drawer = element(host.querySelector('.detail-drawer'));
    expect(
      element(drawer.querySelector('[data-testid="kt-item-detail-summary"]')).textContent,
    ).toContain('金特夫 50mm 景观草');
    expect(
      element(drawer.querySelector('[data-testid="kt-item-detail-spec"]')).textContent,
    ).toContain('pileHeightMm 50');
    expect(drawer.querySelectorAll('[data-testid="kt-item-version"]')).toHaveLength(2);
    expect(drawer.querySelectorAll('[data-testid="kt-item-publish-version"]')).toHaveLength(1);
    expect(drawer.querySelector('[data-testid="kt-item-boms"]')?.textContent).toContain(
      'BOM-KT-PRO-50',
    );
    expect(drawer.querySelector('[data-testid="kt-item-used-in"]')?.textContent).toContain(
      '暂无记录',
    );
    expect(drawer.querySelector('[data-testid="kt-item-routings"]')?.textContent).toContain(
      'RT-KT-PRO-50',
    );
    expect(drawer.querySelector('[data-testid="kt-item-orders"]')?.textContent).toContain(
      'WO-KT-2026-001',
    );
  });

  it('无对应读权限时服务端不返回聚合键——相应区块不渲染（不以「暂无」冒充）', async () => {
    const host = mount(
      portsFor(undefined, [], {
        loadDetail: vi.fn().mockResolvedValue({
          id: 'item-root',
          sku: 'FG-KT-PRO-50',
          versions: [published],
        }),
      }),
    );
    at(host.querySelectorAll('[data-testid="kt-item-open"]')).click();
    await flush();
    await flush();
    for (const id of ['kt-item-boms', 'kt-item-used-in', 'kt-item-routings', 'kt-item-orders'])
      expect(host.querySelector(`[data-testid="${id}"]`), id).toBe(null);
    expect(host.querySelectorAll('[data-testid="kt-item-version"]')).toHaveLength(1);
  });

  it('详情读取失败静默回退列表行；抽屉内发布草稿后重取详情', async () => {
    const loadDetail = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(detail);
    const ports = portsFor([published, draft], ['manufacturing-item:manage'], { loadDetail });
    const host = mount(ports);
    at(host.querySelectorAll('[data-testid="kt-item-open"]'), 1).click();
    await flush();
    await flush();
    expect(host.querySelector('.detail-drawer')).not.toBeNull();
    expect(host.querySelectorAll('[data-testid="kt-item-version"]')).toHaveLength(1);
    byTestId(host, 'kt-item-open').click();
    await flush();
    await flush();
    expect(host.querySelectorAll('[data-testid="kt-item-version"]')).toHaveLength(2);
    byTestId(host, 'kt-item-publish-version').click();
    // TD-WF-014②：发布不可逆，单击先出确认框，确认后才发请求。
    await flush();
    expect(ports.submit).not.toHaveBeenCalled();
    await confirmAction(host, '发布版本', '确认发布');
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/manufacturing-item-versions/item-v2/publish',
      {},
    );
    expect(loadDetail).toHaveBeenCalledTimes(3);
  });

  // TD-WF-014②：确认框里不确认就不发请求；关掉后焦点回到触发它的「发布版本」按钮。
  it('行内「发布版本」的确认框：写明是哪一版；不确认就不发请求，焦点回到该行的发布按钮', async () => {
    const ports = portsFor([published, draft], ['manufacturing-item:manage']);
    const host = mount(ports);
    const trigger = byTestId(host, 'kt-item-publish');
    trigger.focus();
    trigger.click();
    await flush();
    const dialog = confirmDialogOf(host);
    expect(dialog.textContent).toContain('发布版本');
    expect(dialog.textContent).toContain(
      `发布后 ${String(draft.sku)} 第 ${String(draft.version)} 版 随即冻结`,
    );
    expect(TestDocument.current.activeElement).toBe(dialog.querySelectorAll('button')[1]);
    await dismissConfirm(host);
    expect(ports.submit).not.toHaveBeenCalled();
    expect(TestDocument.current.activeElement).toBe(trigger);
    expect(host.querySelectorAll('[data-testid="kt-item-publish"]')).toHaveLength(1);
  });

  // TD-WF-014④：确认发布后「发布版本」按钮从行里消失；行内的焦点锚点把键盘焦点带回这一行的「查看」。
  it('确认发布后该行的「发布版本」按钮消失：焦点回到该行的「查看」', async () => {
    const ports = portsFor([published, draft], ['manufacturing-item:manage'], {
      refresh: vi.fn().mockResolvedValue([published, version({ ...draft, status: 'PUBLISHED' })]),
    });
    const host = mount(ports);
    byTestId(host, 'kt-item-publish').focus();
    byTestId(host, 'kt-item-publish').click();
    await flush();
    await confirmAction(host, '发布版本', '确认发布');
    await flush();
    await flush();
    expect(ports.submit).toHaveBeenCalledTimes(1);
    expect(host.querySelectorAll('[data-testid="kt-item-publish"]')).toHaveLength(0);
    expect(host.textContent).toContain('已发布 · 第 2 版');
    expect(TestDocument.current.activeElement).toBe(
      host.querySelectorAll('[data-testid="kt-item-open"]')[1],
    );
  });
});

describe('U3-MFG-1 物料控制台：失败路径与竞态', () => {
  it('创建成功但随后刷新失败：表单已关闭（不可重复提交），列表进入装载错态', async () => {
    const ports = portsFor([published], ['manufacturing-item:manage'], {
      refresh: vi.fn().mockRejectedValue(new Error('reload down')),
    });
    const host = mount(ports);
    byTestId(host, 'kt-item-create').click();
    await flush();
    await type(host, '.detail-drawer', 'sku', 'FG-KT-PRO-60');
    await type(host, '.detail-drawer', 'name', '运动草');
    await submitDrawer(host);
    await flush();
    expect(ports.submit).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.detail-drawer')).toBe(null);
    expect(host.querySelector('.data-table-error')).not.toBeNull();
    expect(host.textContent).toContain('reload down');
  });

  it('快速切换行时旧详情响应丢弃：最终详情与加载态以最后一次打开为准', async () => {
    let resolveSlow: (value: ItemRow) => void = () => undefined;
    const slow = new Promise<ItemRow>((resolve) => {
      resolveSlow = resolve;
    });
    const fast: ItemRow = { id: 'yarn-root', sku: 'RM-KT-YARN-12000', versions: [yarn] };
    const ports = portsFor(undefined, [], {
      loadDetail: vi
        .fn()
        .mockImplementation((itemId: string) =>
          itemId === 'item-root' ? slow : Promise.resolve(fast),
        ),
    });
    const host = mount(ports);
    at(host.querySelectorAll('[data-testid="kt-item-open"]')).click();
    at(host.querySelectorAll('[data-testid="kt-item-open"]'), 2).click();
    await flush();
    await flush();
    expect(host.querySelector('[data-testid="kt-item-detail-loading"]')).toBe(null);
    expect(ports.loadDetail).toHaveBeenCalledTimes(2);
    resolveSlow(detail);
    await flush();
    await flush();
    // 旧响应（item-root：2 个版本 + BOM 聚合）不得覆盖当前打开的草纱详情（1 个版本）。
    expect(host.querySelectorAll('[data-testid="kt-item-version"]')).toHaveLength(1);
    expect(host.querySelector('[data-testid="kt-item-boms"]')).toBe(null);
    expect(host.querySelector('.detail-drawer')?.textContent).toContain('RM-KT-YARN-12000');
  });
});

describe('U3-MFG-1 物料控制台：纯展示助手', () => {
  it('specificationOf：预设数值键与十进制字面量转数值，其余保留字符串，空行丢弃', () => {
    const rows = [
      { id: 'a', preset: 'pileHeightMm' },
      { id: 'b', preset: 'gauge' },
      { id: 'c', preset: '' },
      { id: 'd', preset: '' },
      { id: 'e', preset: 'nope' },
    ];
    expect(
      specificationOf(rows, {
        'spec:a:value': ' 50.5 ',
        'spec:b:value': ' 3/8 ',
        'spec:c:key': ' stitchRate ',
        'spec:c:value': '180',
        'spec:d:key': 'note',
        'spec:d:value': '   ',
        'spec:e:key': 'x1',
        'spec:e:value': '0x10',
      }),
    ).toEqual({ pileHeightMm: 50.5, gauge: '3/8', stitchRate: 180, nope: '0x10' });
  });

  it('分类计数按物料根去重；规格条目对非对象与嵌套值稳健', () => {
    expect(countAllItems([published, draft, yarn])).toBe(2);
    expect(countByCategory([published, draft, yarn], 'FINISHED_GOOD')).toBe(1);
    expect(countByCategory([{ id: 'x' }], 'FINISHED_GOOD')).toBe(0);
    // 无 itemId 的行回退以版本 id 计根；非字符串根标识不计。
    expect(countAllItems([{ id: 'x' }, { itemId: 7 }])).toBe(1);
    expect(specEntries(null)).toEqual([]);
    expect(specEntries([1])).toEqual([]);
    expect(specEntries({ a: { b: 1 }, c: 'x', d: 2 })).toEqual([
      ['a', '{"b":1}'],
      ['c', 'x'],
      ['d', '2'],
    ]);
  });
});

describe('U3-MFG-1 物料控制台：写成功后的提示（TD-WF-014①）', () => {
  it('行内发布成功：页头下方出现「已发布物料 …」——在「草稿」筛选下那一行会从列表消失，提示是唯一的反馈', async () => {
    const ports = portsFor([draft], ['manufacturing-item:manage'], {
      refresh: vi.fn().mockResolvedValue([version({ ...draft, status: 'PUBLISHED' })]),
    });
    const host = mount(ports);
    byTestId(host, 'kt-item-publish').click();
    await flush();
    await confirmAction(host, '发布版本', '确认发布');
    await flush();
    await flush();
    expect(noticeOf(host)).toEqual({ text: '已发布物料 FG-KT-PRO-50', inDrawer: false });
    expect(byTestId(host, 'console-notice').getAttribute('role')).toBe('status');
  });
});

it('continues the chosen item revision with editable, typed specification values', async () => {
  const source = {
    ...published,
    specification: { serial: '001', config: { offset: 1 }, empty: '' },
  };
  const created = {
    ...source,
    id: 'item-v3',
    version: 3,
    status: 'DRAFT',
    specification: { ...source.specification, config: { offset: 1.25 } },
  };
  const submit = vi.fn().mockResolvedValue(created);
  const host = mount(
    portsFor([source], ['manufacturing-item:manage'], {
      loadDetail: vi
        .fn()
        .mockResolvedValueOnce({ ...detail, versions: [source] })
        .mockResolvedValue({ ...detail, versions: [created, source] }),
      refresh: vi.fn().mockResolvedValue([created, source]),
      submit,
    }),
  );
  byTestId(host, 'kt-item-open').click();
  await flush();
  byTestId(host, 'kt-item-new-version').click();
  await flush();
  const drawer = element(host.querySelector('.detail-drawer'));
  expect(drawer.textContent).toContain('以第 1 版为底稿');
  expect(element(drawer.querySelector('[name="spec:source-0:value"]')).value).toBe('001');
  expect(element(drawer.querySelector('[name="spec:source-1:value"]')).value).toBe('{"offset":1}');
  await type(host, '.detail-drawer', 'spec:source-1:value', '{"offset":1.25}');
  await submitDrawer(host);
  expect(submit).toHaveBeenCalledExactlyOnceWith('/api/v1/manufacturing-items/item-root/versions', {
    copyFromVersionId: published.id,
    specification: created.specification,
  });
  expect(byTestId(host, 'kt-item-detail-spec').textContent).toContain('config {"offset":1.25}');
  expect(element(host.querySelector('.drawer-footer')).textContent).toContain('第 3 版草稿');
});
