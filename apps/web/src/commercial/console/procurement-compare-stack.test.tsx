// PROC-2（TD-PROC-008）对比表「矩阵 / 窄容器堆叠卡片」行为测试。
// 抽屉体内容宽不超过 STACKED_COMPARE_WIDTH 时，询价「报价对比矩阵」与供应商「报价历史对比」
// 改按供应商堆叠的卡片（每家供应商一张卡，卡内列出行项）；其余情况与不可测宽度时保持矩阵。
// mini-DOM 没有 ResizeObserver——矩阵形态即既有契约（见 rfq-console.test.tsx /
// supplier-console.test.tsx，零改动）；本文件以可控替身发宽度，验证堆叠形态与两态切换。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import {
  COMPARE_TOKEN_MAX_CODE_LENGTH,
  STACKED_COMPARE_WIDTH,
  splitCompareTokens,
} from './compare-stack';
import { RfqConsolePage } from './rfq-console';
import type { RfqConsolePorts, RfqRow } from './rfq-ports';
import { SupplierConsolePage } from './supplier-console';
import type { SupplierConsolePorts, SupplierRow } from './supplier-ports';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
const settle = async (): Promise<void> => {
  await flush();
  await flush();
};

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};
const cellsOf = (root: TestElement, testId: string): readonly TestElement[] =>
  root.querySelectorAll(`[data-testid="${testId}"]`).map(element);
const badgesOf = (root: TestElement, label: string): number =>
  root.querySelectorAll('.status-badge').filter((badge) => badge.textContent === label).length;

// ---- 可控的 ResizeObserver 替身：observe 时按当前宽度通知，测试可改宽度模拟容器变化 ----
type ObserverCallback = (entries: readonly Readonly<{ contentRect: { width: number } }>[]) => void;
let observedWidth = 0;
let observers: readonly FakeResizeObserver[] = [];
class FakeResizeObserver {
  public readonly callback: ObserverCallback;
  public constructor(callback: ObserverCallback) {
    this.callback = callback;
    observers = [...observers, this];
  }
  public observe(): void {
    this.callback([{ contentRect: { width: observedWidth } }]);
  }
  public disconnect(): void {
    observers = observers.filter((observer) => observer !== this);
  }
  public resize(width: number): void {
    this.callback([{ contentRect: { width } }]);
  }
}
const containerWidth = (width: number): void => {
  observedWidth = width;
  for (const observer of observers) observer.resize(width);
};
// 桌面抽屉体内容宽（480px 抽屉 − 左右内边距）与 390px 手机视口下的抽屉体内容宽。
const DESKTOP_DRAWER_WIDTH = 440;
const PHONE_DRAWER_WIDTH = 311;

afterEach(() => {
  observers = [];
  observedWidth = 0;
  vi.unstubAllGlobals();
});

// ---- 夹具（与两份既有控制台测试同形） ----
const NOW = new Date('2026-11-23T10:00:00.000Z');
const textOf = (record: Record<string, unknown>, camel: string, snake: string): unknown =>
  record[camel] ?? record[snake];
const asText = (value: unknown, fallback = ''): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;

const issuedRfq: RfqRow = {
  id: 'rfq-2',
  rfq_number: 'RFQ-KT-YARN-2026-002',
  status: 'ISSUED',
  response_due_at: '2026-12-01T23:59:59.000Z',
  currency: 'CNY',
  lines: [
    { id: 'line-1', lineNumber: 1, sku: 'RM-YARN', itemName: '草纱', quantity: '6000' },
    { id: 'line-2', lineNumber: 2, sku: 'RM-BACKING', itemName: '底布', quantity: '800' },
  ],
};
const quoteLine = (lineNumber: number, unitPrice: string): Record<string, unknown> => ({
  id: `ql-${String(lineNumber)}`,
  lineNumber,
  sku: lineNumber === 1 ? 'RM-YARN' : 'RM-BACKING',
  unit_price: unitPrice,
  promised_at: '2026-12-10',
  minimum_order_quantity: '1000.000000',
});
// 两家有效报价 + 一家已失效的低价报价（不参与推荐）。
const rfqQuotes: readonly Record<string, unknown>[] = [
  {
    id: 'q-1',
    quote_reference: 'SQ-KT-YARN-2026-001',
    supplierName: '青岛金特夫草纱战略供应商',
    received_at: '2026-11-10T00:00:00.000Z',
    valid_until: '2026-12-31',
    lines: [quoteLine(1, '12.500000'), quoteLine(2, '4.500000')],
  },
  {
    id: 'q-2',
    quote_reference: 'SQ-KT-YARN-2026-002',
    supplierName: '江苏草纱二厂',
    received_at: '2026-11-11T00:00:00.000Z',
    valid_until: '2026-12-31',
    lines: [quoteLine(1, '11.800000'), quoteLine(2, '4.900000')],
  },
  {
    id: 'q-3',
    quote_reference: 'SQ-KT-YARN-2026-003',
    supplierName: '宁波背胶厂',
    received_at: '2026-11-01T00:00:00.000Z',
    valid_until: '2026-11-12',
    lines: [quoteLine(1, '9.900000')],
  },
];

const supplier: SupplierRow = {
  id: 'supplier-1',
  supplier_number: 'SUP-1',
  name: '草纱供应商',
  status: 'ACTIVE',
  currency: 'CNY',
  qualifications: [],
};
const pricedQuote = (
  id: string,
  supplierId: string,
  supplierName: string,
  reference: string,
  receivedAt: string,
  unitPrice: string,
  validUntil: string,
): SupplierRow => ({
  id,
  supplier_id: supplierId,
  supplierName,
  quote_reference: reference,
  received_at: receivedAt,
  valid_until: validUntil,
  lines: [
    {
      id: `${id}-l1`,
      lineNumber: 1,
      itemVersionId: 'item-v1',
      unit_price: unitPrice,
      minimum_order_quantity: '1000.000000',
      promised_at: '2026-12-10',
    },
  ],
});
// item-v1 四条报价：本供应商现价 12.5（有效）与历史 13.2（失效）、背胶供应商 11.8（有效最低）、
// 宁波草纱三厂 10.0（失效低价——不参与最优）。
const pricedQuotes: readonly SupplierRow[] = [
  pricedQuote(
    'quote-1',
    'supplier-1',
    '草纱供应商',
    'SQ-1',
    '2026-11-01T00:00:00.000Z',
    '12.500000',
    '2026-12-31',
  ),
  pricedQuote(
    'quote-2',
    'supplier-2',
    '背胶供应商',
    'SQ-2',
    '2026-11-05T00:00:00.000Z',
    '11.800000',
    '2026-12-31',
  ),
  pricedQuote(
    'quote-3',
    'supplier-3',
    '宁波草纱三厂',
    'SQ-3',
    '2026-10-01T00:00:00.000Z',
    '10.000000',
    '2026-11-01',
  ),
  pricedQuote(
    'quote-4',
    'supplier-1',
    '草纱供应商',
    'SQ-0',
    '2026-09-01T00:00:00.000Z',
    '13.200000',
    '2026-10-31',
  ),
];

// 两个控制台各自的端口夹具（下面几处渲染共用；mini-DOM 没有 closest，取抽屉要从宿主根上查）。
const rfqPorts: RfqConsolePorts = {
  permissions: new Set(['procurement:read']),
  initialRfqs: [issuedRfq],
  itemVersionChoices: [{ value: 'item-v1', label: 'RM-YARN · 草纱' }],
  recordText: (record, camel, snake, fallback = '') =>
    asText(textOf(record, camel, snake), fallback),
  textValue: asText,
  submit: vi.fn().mockResolvedValue(null),
  loadDetail: vi.fn().mockResolvedValue({ ...issuedRfq, quotes: rfqQuotes }),
  now: () => NOW,
  refresh: vi.fn().mockResolvedValue([issuedRfq]),
};
const supplierPorts: SupplierConsolePorts = {
  permissions: new Set(['supplier:read']),
  initialSuppliers: [supplier],
  itemVersionChoices: [{ value: 'item-v1', label: 'RM-YARN · 草纱' }],
  initialQuotes: pricedQuotes,
  recordText: (record, camel, snake, fallback = '') =>
    asText(textOf(record, camel, snake), fallback),
  textValue: asText,
  submit: vi.fn().mockResolvedValue(null),
  now: () => NOW,
  refresh: vi.fn().mockResolvedValue({ suppliers: [supplier], quotes: pricedQuotes }),
};

const openRfqCompare = async (): Promise<TestElement> => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(RfqConsolePage(rfqPorts) as ComponentType, {}), host);
  element(host.querySelector('[data-testid="kt-rfq-open"]')).click();
  await settle();
  return element(host.querySelector('[data-testid="kt-rfq-quotes"]'));
};

const openSupplierCompare = async (): Promise<TestElement> => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(SupplierConsolePage(supplierPorts) as ComponentType, {}), host);
  element(host.querySelector('[data-testid="kt-supplier-open"]')).click();
  await settle();
  return element(host.querySelector('[data-testid="kt-supplier-compare"]'));
};

describe('询价报价对比 · 窄容器堆叠卡片', () => {
  it('宽度不可测（无 ResizeObserver）时保持矩阵，不渲染卡片', async () => {
    const compare = await openRfqCompare();
    expect(compare.querySelector('table')).not.toBe(null);
    expect(compare.querySelector('[data-testid="kt-rfq-quote-card"]')).toBe(null);
    // 行项 × 供应商 = 2 行 × 3 家；宁波背胶厂未报行 2，仍占一格（呈 —）。
    expect(cellsOf(compare, 'kt-rfq-matrix-cell')).toHaveLength(6);
  });

  it('容器宽度不超过阈值：每家供应商一张卡，卡内列出行项，矩阵不再渲染', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    containerWidth(PHONE_DRAWER_WIDTH);
    const compare = await openRfqCompare();
    expect(compare.querySelector('table')).toBe(null);
    const cards = cellsOf(compare, 'kt-rfq-quote-card');
    expect(cards.map((card) => card.getAttribute('data-quote'))).toEqual(['q-1', 'q-2', 'q-3']);
    // 卡片标题 = 供应商；报价单 · 收于 · 有效至 与图例同一文案。
    expect(cards[0]?.querySelector('strong')?.textContent).toBe('青岛金特夫草纱战略供应商');
    expect(cards[0]?.textContent).toContain(
      'SQ-KT-YARN-2026-001 · 收于 2026-11-10 · 有效至 2026-12-31',
    );
    // 卡内按行项列出全部询价行（行项描述与矩阵首列同一文案）。
    const firstLines = cellsOf(element(cards[0]), 'kt-rfq-card-line');
    expect(firstLines).toHaveLength(2);
    expect(firstLines[0]?.textContent).toContain('行 1 · RM-YARN · 草纱 · 数量 6000');
    expect(firstLines[0]?.textContent).toContain('单价 12.5');
    expect(firstLines[0]?.textContent).toContain('MOQ 1000 · 交期 2026-12-10');
    expect(firstLines[1]?.textContent).toContain('行 2 · RM-BACKING · 底布 · 数量 800');
    expect(firstLines[1]?.textContent).toContain('单价 4.5');
    // 单元格沿用矩阵的标识：报价归属与推荐判定同源（失效低价不参与推荐）；每张卡列出
    // 全部询价行，未报价的行与矩阵同样呈 —（卡序 = 矩阵列序，卡内行序 = 矩阵行序）。
    const cells = cellsOf(compare, 'kt-rfq-matrix-cell');
    expect(cells.map((cell) => cell.getAttribute('data-quote'))).toEqual([
      'q-1',
      'q-1',
      'q-2',
      'q-2',
      'q-3',
      'q-3',
    ]);
    expect(cells.map((cell) => cell.getAttribute('data-recommended'))).toEqual([
      'false',
      'true',
      'true',
      'false',
      'false',
      'false',
    ]);
    expect(cells[4]?.textContent).toContain('单价 9.9');
    expect(cells[5]?.textContent).toContain('单价 —');
    expect(cells[5]?.textContent).toContain('MOQ — · 交期 —');
    expect(badgesOf(compare, '推荐')).toBe(2);
    // 已失效报价的每个单元格各标一次（与矩阵相同）。
    expect(badgesOf(compare, '已失效')).toBe(2);
    // 区块标签与报价单图例守恒。
    expect(compare.textContent).toContain('报价对比（行项 × 供应商）');
    expect(compare.querySelector('[data-testid="kt-rfq-quote-legend"]')).not.toBe(null);
    expect(compare.textContent).toContain('推荐 = 有效报价中单价最低（并列同标）');
  });

  it('容器由窄变宽后回到矩阵（阈值含边界）', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    containerWidth(PHONE_DRAWER_WIDTH);
    const compare = await openRfqCompare();
    expect(cellsOf(compare, 'kt-rfq-quote-card')).toHaveLength(3);
    containerWidth(STACKED_COMPARE_WIDTH);
    await settle();
    expect(cellsOf(compare, 'kt-rfq-quote-card')).toHaveLength(3);
    containerWidth(STACKED_COMPARE_WIDTH + 1);
    await settle();
    expect(compare.querySelector('[data-testid="kt-rfq-quote-card"]')).toBe(null);
    expect(compare.querySelector('table')).not.toBe(null);
    // 同一份报价在两态下的推荐判定一致（矩阵按行优先遍历：行 1 三家、行 2 三家）。
    expect(
      cellsOf(compare, 'kt-rfq-matrix-cell').map((cell) => cell.getAttribute('data-recommended')),
    ).toEqual(['false', 'true', 'false', 'true', 'false', 'false']);
    containerWidth(PHONE_DRAWER_WIDTH);
    await settle();
    expect(compare.querySelector('table')).toBe(null);
    expect(cellsOf(compare, 'kt-rfq-quote-card')).toHaveLength(3);
  });

  it('桌面抽屉体宽度（440px）保持矩阵', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    containerWidth(DESKTOP_DRAWER_WIDTH);
    const compare = await openRfqCompare();
    expect(compare.querySelector('table')).not.toBe(null);
    expect(compare.querySelector('[data-testid="kt-rfq-quote-card"]')).toBe(null);
  });
});

describe('供应商报价历史对比 · 窄容器堆叠卡片', () => {
  it('宽度不可测（无 ResizeObserver）时保持矩阵，不渲染卡片', async () => {
    const compare = await openSupplierCompare();
    expect(compare.querySelector('table')).not.toBe(null);
    expect(compare.querySelector('[data-testid="kt-supplier-compare-card"]')).toBe(null);
  });

  it('容器宽度不超过阈值：同一物料下每家供应商一张卡，卡内列出该供应商的报价行', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    containerWidth(PHONE_DRAWER_WIDTH);
    const compare = await openSupplierCompare();
    expect(compare.querySelector('table')).toBe(null);
    // 物料分组保留：仍是「每个物料一组」，标签守恒。
    const items = cellsOf(compare, 'kt-supplier-compare-item');
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent).toContain('RM-YARN · 草纱');
    expect(compare.textContent).toContain('报价历史对比（同一物料 · 多供应商单价，最优高亮）');
    // 卡序 = 各供应商最优报价在矩阵排序中的次序（有效低价在前，失效报价在后）。
    const cards = cellsOf(compare, 'kt-supplier-compare-card');
    expect(cards.map((card) => card.getAttribute('data-supplier'))).toEqual([
      'supplier-2',
      'supplier-1',
      'supplier-3',
    ]);
    expect(cards.map((card) => card.querySelector('strong')?.textContent)).toEqual([
      '背胶供应商',
      '草纱供应商',
      '宁波草纱三厂',
    ]);
    // 本供应商的卡只标一次（矩阵里每行各标一次）。
    expect(badgesOf(element(cards[1]), '本供应商')).toBe(1);
    expect(badgesOf(compare, '本供应商')).toBe(1);
    // 每张卡内列出该供应商的全部报价行：价格、最优、条款、报价单与失效标记同矩阵单元格。
    const pricesOf = (card: TestElement): readonly (string | null)[] =>
      cellsOf(card, 'kt-supplier-compare-price').map((price) => price.textContent);
    expect(pricesOf(element(cards[0]))).toEqual(['11.8最优']);
    expect(pricesOf(element(cards[1]))).toEqual(['12.5', '13.2']);
    expect(pricesOf(element(cards[2]))).toEqual(['10']);
    expect(
      cellsOf(compare, 'kt-supplier-compare-price').map((price) => price.getAttribute('data-best')),
    ).toEqual(['true', 'false', 'false', 'false']);
    const current = element(cards[1]);
    expect(cellsOf(current, 'kt-supplier-compare-line')).toHaveLength(2);
    expect(current.textContent).toContain('MOQ 1000 · 2026-12-10');
    expect(current.textContent).toContain('SQ-1 · 2026-11-01 · 2026-12-31');
    expect(current.textContent).toContain('SQ-0 · 2026-09-01 · 2026-10-31');
    expect(badgesOf(compare, '已失效')).toBe(2);
    expect(badgesOf(compare, '最优')).toBe(1);
  });

  it('容器由窄变宽后回到矩阵，同一批报价的两态判定一致', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    containerWidth(PHONE_DRAWER_WIDTH);
    const compare = await openSupplierCompare();
    expect(compare.querySelector('table')).toBe(null);
    containerWidth(DESKTOP_DRAWER_WIDTH);
    await settle();
    expect(compare.querySelector('[data-testid="kt-supplier-compare-card"]')).toBe(null);
    expect(compare.querySelector('table')).not.toBe(null);
    expect(compare.textContent).toContain('单价（CNY）');
    expect(cellsOf(compare, 'kt-supplier-compare-price').map((price) => price.textContent)).toEqual(
      ['11.8最优', '12.5', '10', '13.2'],
    );
    expect(badgesOf(compare, '本供应商')).toBe(2);
    expect(badgesOf(compare, '已失效')).toBe(2);
    expect(badgesOf(compare, '最优')).toBe(1);
  });
});

// PROC-3（TD-PROC-008 残余）：两个详情抽屉用宽抽屉。对比矩阵在缺省的 480px 里四列并排，
// 日期在连字符处断行、供应商名每行约 5 字；加宽后矩阵在桌面上放得下。
describe('采购域详情抽屉 · 宽度', () => {
  // 渲染控制台、点开一条详情，取抽屉的 data-size（mini-DOM 没有 closest，所以从宿主根上查）。
  const drawerSizeAfterOpen = async (
    page: ComponentType,
    opener: string,
  ): Promise<string | null> => {
    const host = installGlobalTestDom().document.createElement('div');
    render(h(page, {}), host);
    element(host.querySelector(`[data-testid="${opener}"]`)).click();
    await settle();
    return element(host.querySelector('.detail-drawer')).getAttribute('data-size');
  };

  it('询价与供应商两个详情抽屉带 data-size="wide"', async () => {
    expect(
      await drawerSizeAfterOpen(RfqConsolePage(rfqPorts) as ComponentType, 'kt-rfq-open'),
    ).toBe('wide');
    expect(
      await drawerSizeAfterOpen(
        SupplierConsolePage(supplierPorts) as ComponentType,
        'kt-supplier-open',
      ),
    ).toBe('wide');
  });

  it('只有这两个详情抽屉加宽：同一批控制台里的新建类抽屉保持缺省尺寸', () => {
    // 新建抽屉经 openForm 打开；这里从源码守，避免为一个属性去驱动整条表单流程。
    // 两个文件里 size="wide" 恰好各出现一次，且紧邻「详情」标题；新建抽屉不带 size。
    const read = (file: string): string => readFileSync(new URL(file, import.meta.url), 'utf8');
    for (const [file, detailTitle] of [
      ['./rfq-console.tsx', '询价单详情'],
      ['./supplier-console.tsx', '供应商详情'],
    ] as const) {
      const source = read(file);
      const wide = [...source.matchAll(/size="wide"/gu)];
      expect(wide, `${file} 里 size="wide" 的次数`).toHaveLength(1);
      // 唯一一处在详情抽屉上：其后 200 字符内就是详情标题。
      const at = wide[0]?.index ?? -1;
      expect(at).toBeGreaterThanOrEqual(0);
      expect(source.slice(at, at + 200)).toContain(detailTitle);
      // 其余 DetailDrawer（新建类）不带 size。
      const drawers = [...source.matchAll(/<DetailDrawer\b[^>]*>/gsu)];
      expect(drawers.length, `${file} 里 DetailDrawer 的个数`).toBeGreaterThan(1);
      const sized = drawers.filter((match) => /\bsize=/u.test(match[0]));
      expect(sized).toHaveLength(1);
    }
  });
});

// PROC-3（TD-PROC-008 残余）：对比矩阵里每个日期 / 编码 / 金额 token 各自不折行。
// mini-DOM 不算样式；这里守两件能在 DOM 层面确定的事——切分规则本身，以及矩阵确实把 token
// 标了出来、且没有改动单元格文本。真实折行见 PROC-3 证据文档的真浏览器量测。
describe('对比矩阵 · 短 token 不折行', () => {
  // 一个 token = 可选的单词标签 + （日期 | 编码 | 金额）+ 可选的尾随分隔符（ · 或 ~）。
  const TOKEN =
    /^(?:[\u4e00-\u9fffA-Z]{1,4} )?(?:\d{4}-\d{2}-\d{2}|[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+|\d+(?:\.\d+)?)(?: ?[·~])?$/u;

  it('切分出的 token 是「标签 + 日期 / 编码 / 金额」；拼回来与原文逐字相同', () => {
    const cases: readonly string[] = [
      'SQ-PROC3-JSHF-2026-002 · 2026-11-15 · 2026-12-31',
      'MOQ 1200 · 交期 2026-12-18',
      '单价 12.5',
      '行 1 · RM-KT-YARN-12000 · 12000D 直丝草纱 · 数量 5000',
      '青岛金特夫草纱战略供应商 · SQ-KT-YARN-2026-001 · 收于 2026-11-10 · 有效至 2026-12-31',
      '2026-10-01',
      '12.500000',
      '',
    ];
    for (const text of cases) {
      const parts = splitCompareTokens(text);
      expect(parts.map((part) => part.text).join(''), text).toBe(text);
      for (const part of parts.filter((entry) => entry.token))
        expect(part.text, text).toMatch(TOKEN);
    }
    // 标签与它的值是一个单元：标签后的空格不是换行点。
    expect(splitCompareTokens('单价 12.5')).toEqual([{ text: '单价 12.5', token: true }]);
    // 单元后面紧跟的分隔符并入该单元：断行只发生在分隔符之后。
    expect(splitCompareTokens('MOQ 1200 · 交期 2026-12-18')).toEqual([
      { text: 'MOQ 1200 ·', token: true },
      { text: ' ', token: false },
      { text: '交期 2026-12-18', token: true },
    ]);
    expect(splitCompareTokens('SQ-1 · 2026-11-01 · 2026-12-31')).toEqual([
      { text: 'SQ-1 ·', token: true },
      { text: ' ', token: false },
      { text: '2026-11-01 ·', token: true },
      { text: ' ', token: false },
      { text: '2026-12-31', token: true },
    ]);
    expect(splitCompareTokens('有效期 2026-01-01 ~ 2099-12-31')).toEqual([
      { text: '有效期 2026-01-01 ~', token: true },
      { text: ' ', token: false },
      { text: '2099-12-31', token: true },
    ]);
    // 普通文字后面的分隔符不并入（名称仍可在任意字之间折行）。
    expect(splitCompareTokens('PP 复合底布 · 数量 1500')).toEqual([
      { text: 'PP 复合底布 · ', token: false },
      { text: '数量 1500', token: true },
    ]);
    // 物料名称里的「11000D」是数字 + 字母，不是 token：不单独成 token，也不把后面的名称并进来。
    expect(splitCompareTokens('11000D 替代草纱 · 数量 2000')).toEqual([
      { text: '11000D 替代草纱 · ', token: false },
      { text: '数量 2000', token: true },
    ]);
    // 未报价的占位（—）不是数字：整段是普通文本，照常可折。
    expect(splitCompareTokens('MOQ — · 交期 —')).toEqual([
      { text: 'MOQ — · 交期 —', token: false },
    ]);
    // 编码里的连字符段不会被当成减号拆开，小数不被切成两段。
    expect(splitCompareTokens('SQ-KT-YARN-2026-001')).toEqual([
      { text: 'SQ-KT-YARN-2026-001', token: true },
    ]);
    expect(splitCompareTokens('12.500000')).toEqual([{ text: '12.500000', token: true }]);
  });

  // 不折行的 token 必须有长度上限：一个 40 字符的报价单号在手机上比卡片内容还宽，nowrap 会压过
  // 卡片原有的 overflow-wrap，把「断成两行」变成「溢出卡片」。阈值与 DataTable 对字符串单元格的
  // NOWRAP_MAX_LENGTH 同值；两处不得各自漂移。
  it('超过 20 个字符的编码不包 token、照常可折；长编码内部不被截出片段', () => {
    const dataTable = readFileSync(
      new URL('../../../../../packages/ui/src/data-table.tsx', import.meta.url),
      'utf8',
    );
    expect(dataTable).toContain(
      `const NOWRAP_MAX_LENGTH = ${String(COMPARE_TOKEN_MAX_CODE_LENGTH)};`,
    );
    // 恰好 20 个字符：包。
    expect(splitCompareTokens('SQ-KT-YARN-2026-0001')).toEqual([
      { text: 'SQ-KT-YARN-2026-0001', token: true },
    ]);
    // 第 21 个字符起：不包；紧随其后的日期照常是 token。
    expect(splitCompareTokens('SQ-PROC3-JSHF-2026-002 · 2026-11-15')).toEqual([
      { text: 'SQ-PROC3-JSHF-2026-002 · ', token: false },
      { text: '2026-11-15', token: true },
    ]);
    // 长编码内部：不截出后缀，形如日期的片段也不单独切出。
    expect(splitCompareTokens('SQ-KT-YARN-2026-11-25-REV-001')).toEqual([
      { text: 'SQ-KT-YARN-2026-11-25-REV-001', token: false },
    ]);
    // 短编码里形如日期的片段：整个编码是一个 token。
    expect(splitCompareTokens('SQ-2026-11-25')).toEqual([{ text: 'SQ-2026-11-25', token: true }]);
    // 紧贴字母或数字的片段不是 token。
    expect(splitCompareTokens('X1200 个')).toEqual([{ text: 'X1200 个', token: false }]);
  });

  it('询价矩阵：单元格文本不变，日期 / SKU / 金额落在 .proc-token 里，矩阵带作用域类', async () => {
    const compare = await openRfqCompare();
    const matrix = element(compare.querySelector('.proc-compare-matrix'));
    expect(matrix.querySelector('table')).not.toBe(null);
    const tokens = matrix.querySelectorAll('.proc-token').map((node) => element(node).textContent);
    for (const text of tokens) expect(text).toMatch(TOKEN);
    // 询价单元格带中文标签：标签与值是一个 token（交期 2026-12-10、单价 12.5）。
    expect(tokens).toContain('交期 2026-12-10');
    expect(tokens).toContain('单价 12.5');
    expect(tokens).toContain('MOQ 1000 ·');
    expect(tokens).toContain('行 1 ·');
    expect(tokens).toContain('数量 6000');
    // 夹具里的未报价行与失效报价同此：单元格文本与此前逐字相同。
    const firstLine = matrix.querySelector('tbody td[data-column="line"]');
    expect(firstLine?.textContent).toBe('行 1 · RM-YARN · 草纱 · 数量 6000');
    expect(matrix.querySelector('td[data-column="quote-q-3"]')?.textContent).toBe(
      '单价 9.9MOQ 1000 · 交期 2026-12-10已失效',
    );
  });

  it('供应商矩阵：单元格文本不变，报价单 / 日期 / 单价落在 .proc-token 里，矩阵带作用域类', async () => {
    const compare = await openSupplierCompare();
    const matrices = compare.querySelectorAll('.proc-compare-matrix');
    expect(matrices.length).toBe(1);
    const tokens = element(matrices[0])
      .querySelectorAll('.proc-token')
      .map((node) => element(node).textContent);
    for (const text of tokens) expect(text).toMatch(TOKEN);
    expect(tokens).toContain('SQ-1 ·');
    // 供应商矩阵的条款不带标签：日期自身是一个 token；「MOQ 1000 ·」是另一个。
    expect(tokens).toContain('2026-12-10');
    expect(tokens).toContain('MOQ 1000 ·');
    // 单元格标识与文本守恒：最优价格、条款、报价单三格。
    const prices = cellsOf(compare, 'kt-supplier-compare-price').map((cell) => cell.textContent);
    expect(prices).toEqual(['11.8最优', '12.5', '10', '13.2']);
    expect(element(matrices[0]).querySelector('td[data-column="quote"]')?.textContent).toBe(
      'SQ-2 · 2026-11-05 · 2026-12-31',
    );
    // 供应商名自成一段 .proc-supplier-name（列宽不足时两行均匀分配）；单元格文本逐字不变。
    const nameCells = element(matrices[0]).querySelectorAll('td[data-column="supplier"]');
    expect(nameCells.map((cell) => element(cell).textContent)).toEqual([
      '背胶供应商',
      '草纱供应商本供应商',
      '宁波草纱三厂',
      '草纱供应商本供应商',
    ]);
    expect(
      nameCells.flatMap((cell) =>
        cell.querySelectorAll('.proc-supplier-name').map((node) => element(node).textContent),
      ),
    ).toEqual(['背胶供应商', '草纱供应商', '宁波草纱三厂', '草纱供应商']);
  });

  it('堆叠卡片复用同一批单元格：卡片里同样带 .proc-token，矩阵的作用域类不出现', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    containerWidth(PHONE_DRAWER_WIDTH);
    const compare = await openRfqCompare();
    expect(compare.querySelector('.proc-compare-matrix')).toBe(null);
    const tokens = compare.querySelectorAll('.proc-token').map((node) => element(node).textContent);
    for (const text of tokens) expect(text).toMatch(TOKEN);
    expect(tokens).toContain('交期 2026-12-10');
  });

  // 矩阵之外的普通文本（图例、行项 / 资质 / 报价历史列表、卡片元信息）：此前日期在连字符处
  // 断行（2026-12- / 31），手机上尤其明显（PROC-2 证据 §12.6）。文本逐字不变，只是 token 不再折行。
  // 渲染控制台并点开一条详情，返回宿主根（这些列表是对比区的兄弟节点，要从根上查；
  // mini-DOM 没有 closest）。
  const openHost = async (page: ComponentType, opener: string): Promise<TestElement> => {
    const host = installGlobalTestDom().document.createElement('div');
    render(h(page, {}), host);
    element(host.querySelector(`[data-testid="${opener}"]`)).click();
    await settle();
    return host;
  };
  const tokensIn = (scope: TestElement | null): readonly string[] =>
    scope === null
      ? []
      : scope.querySelectorAll('.proc-token').map((node) => element(node).textContent);

  it('图例、卡片元信息与报价历史列表：日期与编号是 token，文本逐字不变', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    containerWidth(PHONE_DRAWER_WIDTH);
    const rfqHost = await openHost(RfqConsolePage(rfqPorts) as ComponentType, 'kt-rfq-open');
    const legend = element(rfqHost.querySelector('[data-testid="kt-rfq-quote-legend"]'));
    expect(legend.querySelector('li')?.textContent).toBe(
      '青岛金特夫草纱战略供应商 · SQ-KT-YARN-2026-001 · 收于 2026-11-10 · 有效至 2026-12-31',
    );
    // 供应商名是中文、不是 token；编号与两个「标签 + 日期」是 token。
    expect(tokensIn(legend)).toEqual([
      'SQ-KT-YARN-2026-001 ·',
      '收于 2026-11-10 ·',
      '有效至 2026-12-31',
      'SQ-KT-YARN-2026-002 ·',
      '收于 2026-11-11 ·',
      '有效至 2026-12-31',
      'SQ-KT-YARN-2026-003 ·',
      '收于 2026-11-01 ·',
      '有效至 2026-11-12',
    ]);
    // 卡片元信息（手机堆叠形态）：同一份报价在卡片头部的元信息里。
    const cardMeta = element(
      cellsOf(rfqHost, 'kt-rfq-quote-card')[0]?.querySelector('.proc-quote-card-meta'),
    );
    expect(cardMeta.textContent).toBe('SQ-KT-YARN-2026-001 · 收于 2026-11-10 · 有效至 2026-12-31');
    expect(tokensIn(cardMeta)).toEqual([
      'SQ-KT-YARN-2026-001 ·',
      '收于 2026-11-10 ·',
      '有效至 2026-12-31',
    ]);

    // 供应商抽屉的「报价历史」列表：与询价图例同一种写法（编号 · 收于 … · 有效至 …）。
    const supplierHost = await openHost(
      SupplierConsolePage(supplierPorts) as ComponentType,
      'kt-supplier-open',
    );
    const history = element(supplierHost.querySelector('[data-testid="kt-supplier-quotes"]'));
    expect(history.querySelectorAll('li').map((node) => element(node).textContent)).toEqual([
      'SQ-1 · 收于 2026-11-01 · 有效至 2026-12-31',
      'SQ-0 · 收于 2026-09-01 · 有效至 2026-10-31',
    ]);
    expect(tokensIn(history)).toEqual([
      'SQ-1 ·',
      '收于 2026-11-01 ·',
      '有效至 2026-12-31',
      'SQ-0 ·',
      '收于 2026-09-01 ·',
      '有效至 2026-10-31',
    ]);
  });

  it('询价行项列表与资质记录列表：编号 / 数量 / 有效期是 token，文本逐字不变', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const rfqHost = await openHost(RfqConsolePage(rfqPorts) as ComponentType, 'kt-rfq-open');
    const lines = element(rfqHost.querySelector('[data-testid="kt-rfq-lines"]'));
    expect(lines.querySelectorAll('li').map((node) => element(node).textContent)).toEqual([
      'RM-YARN · 草纱 · 数量 6000 · 要求到货 —',
      'RM-BACKING · 底布 · 数量 800 · 要求到货 —',
    ]);
    // 编号与「数量 + 值」是 token（各带尾随的分隔符）；「要求到货 —」是占位，不是 token。
    expect(tokensIn(lines)).toEqual(['RM-YARN ·', '数量 6000 ·', 'RM-BACKING ·', '数量 800 ·']);

    // 资质记录：徽章之后紧跟「 编号 · 名称 · v版本 · 有效期 起 ~ 止」。
    const qualified: SupplierRow = {
      ...supplier,
      qualifications: [
        {
          id: 'qual-1',
          status: 'APPROVED',
          sku: 'RM-YARN',
          itemName: '草纱',
          itemVersion: '1',
          valid_from: '2026-01-01',
          valid_to: '2099-12-31',
        },
      ],
    };
    const qualifiedPorts: SupplierConsolePorts = {
      ...supplierPorts,
      initialSuppliers: [qualified],
    };
    const supplierHost = await openHost(
      SupplierConsolePage(qualifiedPorts) as ComponentType,
      'kt-supplier-open',
    );
    const qualifications = element(
      supplierHost.querySelector('[data-testid="kt-supplier-qualifications"]'),
    );
    expect(qualifications.querySelector('li')?.textContent).toBe(
      '已批准 RM-YARN · 草纱 · v1 · 有效期 2026-01-01 ~ 2099-12-31',
    );
    // v1 不是 token（版本号紧贴字母）；有效期两端各自是 token。
    expect(tokensIn(qualifications)).toEqual(['RM-YARN ·', '有效期 2026-01-01 ~', '2099-12-31']);
  });
});

describe('采购域样式表（静态守卫）', () => {
  const stylesheet = readFileSync(new URL('./procurement-console.css', import.meta.url), 'utf8');
  // 取一条规则的正文；缺省读本域样式表，也可指定别的样式表（如基座的 components.css）。
  const rule = (selector: string, source: string = stylesheet): string => {
    const start = source.indexOf(`${selector} {`);
    if (start < 0) throw new Error(`stylesheet has no rule for ${selector}`);
    return source.slice(start, source.indexOf('}', start));
  };

  it('堆叠卡片纵向堆叠且不超出所在容器', () => {
    for (const declaration of [
      'display: flex',
      'flex-direction: column',
      'min-width: 0',
      'max-width: 100%',
    ])
      expect(rule('.proc-compare-cards')).toContain(declaration);
    expect(rule('.proc-quote-line')).toContain('flex-direction: column');
    expect(rule('.proc-quote-lines')).toContain('list-style: none');
    // 文字在卡片宽度内折行，长编号可断行，不撑破卡片。
    expect(stylesheet).toMatch(/overflow-wrap: anywhere/u);
  });

  it('取值全部来自 kt tokens，不写死颜色与间距', () => {
    expect(stylesheet).not.toMatch(/#[0-9a-f]{3,8}\b/iu);
    expect(stylesheet).not.toMatch(/\brgba?\(/u);
    // 发丝线边框宽度（1px solid）与键盘焦点环宽度（2px）是 token 样式表的通行写法
    // （同 manufacturing-console.css、governance-gov-ux.css 的 a.metric），token 表无对应变量；
    // 其余间距/尺寸不得出现字面量。
    const withoutStrokeWidths = stylesheet
      .replace(/border[^:;{}]*:\s*1px solid/gu, '')
      .replace(/outline(-offset)?:\s*2px/gu, '');
    expect(withoutStrokeWidths).not.toMatch(/:\s*-?\d+(\.\d+)?(px|rem|em)\b/u);
    for (const token of ['--kt-space-3', '--kt-color-border', '--kt-radius-md'])
      expect(stylesheet).toContain(`var(${token})`);
  });

  it('可点汇总卡沿用指标卡外观：去掉链接默认样式并保留键盘焦点环', () => {
    const link = rule('a.procurement-summary-link');
    for (const declaration of ['display: block', 'color: inherit', 'text-decoration: none'])
      expect(link).toContain(declaration);
    // 焦点环不是颜色唯一信号之外的可选项：键盘用户必须看得到焦点落在哪张卡上。
    expect(stylesheet).toMatch(/a\.procurement-summary-link:focus-visible\s*\{\s*outline:/u);
  });

  it('供应商对比单元格允许徽章折行（不折行时徽章先占满列宽，名称被挤成一字一行）', () => {
    // mini-DOM 不计算样式，只能在源码层面守；行为证据见 PROC-2 证据文档的真浏览器量测
    // （桌面抽屉内「青岛金特夫草纱战略供应商」由 12 行每行 1 字恢复为正常折行）。
    const source = readFileSync(new URL('./supplier-console-detail.tsx', import.meta.url), 'utf8');
    const start = source.indexOf('const INLINE_STYLE = {');
    if (start < 0) throw new Error('supplier-console-detail.tsx has no INLINE_STYLE');
    expect(source.slice(start, source.indexOf('}', start))).toContain("flexWrap: 'wrap'");
  });

  // PROC-3：对比矩阵的列最小宽度与 token 不折行。DataTable 是全站基座，列宽只能落在对比表
  // 自己的作用域类下；真实折行与滚动见 PROC-3 证据文档的真浏览器量测。
  it('短 token 不折行', () => {
    expect(rule('.proc-token')).toContain('white-space: nowrap');
  });

  it('列最小宽度只作用于对比矩阵的作用域类，不碰 DataTable 的通用规则', () => {
    // 以长度计的 min-width（列最小宽度：数字 + 单位，或 calc(…)）只能出现在 .proc-compare-matrix
    // 之下。堆叠卡片规则里的 `min-width: 0` 是 flex 收缩所需，不是列宽，不在其列——负向断言
    // 必须紧跟冒号并自己吃掉空白，放在 \s* 之后会在空格处判断而永远成立。
    const withoutComments = stylesheet.replace(/\/\*[\s\S]*?\*\//gu, '');
    const columnWidthRules = [
      ...withoutComments.matchAll(/([^{}]+)\{([^{}]*min-width:(?!\s*0[\s;])[^{}]*)\}/gu),
    ];
    expect(columnWidthRules).toHaveLength(6);
    for (const [, selector] of columnWidthRules)
      expect(selector?.trim(), selector).toMatch(/^\.proc-compare-matrix\s/u);
    // 两张矩阵的每一列都有最小宽度：供应商四列、询价行项列与每家供应商列。
    for (const selector of [
      ".proc-compare-matrix td[data-column='supplier']",
      ".proc-compare-matrix td[data-column='price']",
      ".proc-compare-matrix td[data-column='terms']",
      ".proc-compare-matrix td[data-column='quote']",
      ".proc-compare-matrix td[data-column='line']",
      ".proc-compare-matrix td[data-column^='quote-']",
    ]) {
      expect(rule(selector), selector).toMatch(
        /min-width:\s*calc\(var\(--kt-font-size-body\) \* \d+(?:\.\d+)?\);/u,
      );
    }
    // 列宽只随字号缩放，不随字体的字形宽度缩放（ch 会）。
    expect(withoutComments).not.toMatch(/[\d.]+ch\b/u);
    // 询价矩阵的表头是供应商名：允许折行且两行均匀分配，否则列宽被名称的整行宽度撑开。
    const header = rule(".proc-compare-matrix th[data-sort-key^='quote-']");
    expect(header).toContain('white-space: normal');
    expect(header).toContain('text-wrap: balance');
    // 供应商名称在列宽不足时同样两行均匀分配。
    expect(rule('.proc-supplier-name')).toContain('text-wrap: balance');
    // 询价矩阵的表头与单元格横向内边距相同：12 个汉字的供应商名在表头里一行放得下。
    const cellPadding = rule(
      ".proc-compare-matrix td[data-column='line'],\n.proc-compare-matrix td[data-column^='quote-']",
    );
    const headerPadding = rule(
      ".proc-compare-matrix th[data-sort-key='line'],\n.proc-compare-matrix th[data-sort-key^='quote-']",
    );
    expect(headerPadding.slice(headerPadding.indexOf('{'))).toBe(
      cellPadding.slice(cellPadding.indexOf('{')),
    );
    // 组件确实把作用域类加在两张矩阵上。
    const rfq = readFileSync(new URL('./rfq-console-detail.tsx', import.meta.url), 'utf8');
    expect(rfq).toContain('class="proc-compare-matrix"');
    const supplier = readFileSync(
      new URL('./supplier-console-detail.tsx', import.meta.url),
      'utf8',
    );
    expect(supplier).toContain('class="proc-compare-matrix"');
    expect(supplier).toContain('class="proc-supplier-name"');
  });

  // 设计意图：宽抽屉里，四列的供应商矩阵与「行项 + 三家供应商」的询价矩阵整张放得下、不滚动；
  // 五家供应商放不下，在表格自己的滚动容器内横向滚动。数值全部从样式表与令牌表读出来算——
  // 改了宽抽屉宽度、抽屉体内边距令牌或任一列宽而破坏这个平衡，这里会红。
  it('列最小宽度之和：供应商矩阵与三家供应商的询价矩阵不超过宽抽屉体内容宽，五家超过', () => {
    const read = (file: string): string => readFileSync(new URL(file, import.meta.url), 'utf8');
    const number = (text: string, pattern: RegExp): number => {
      const value = pattern.exec(text)?.[1];
      if (value === undefined) throw new Error(`pattern ${String(pattern)} not found`);
      return Number(value);
    };
    const tokens = read('../../../../../packages/ui/src/tokens.css');
    const components = read('../../../../../packages/ui/src/components.css');
    const fontSize = number(tokens, /--kt-font-size-body:\s*(\d+(?:\.\d+)?)px/u);
    // 抽屉体内边距：基座规则是 var(--kt-space-5, 20px)，令牌表里 --kt-space-5 = 24px。
    const bodyPadding = number(tokens, /--kt-space-5:\s*(\d+(?:\.\d+)?)px/u);
    expect(rule('.detail-drawer .drawer-body', components)).toContain(
      'padding: var(--kt-space-5, 20px)',
    );
    const wideWidth = number(
      components,
      /\.detail-drawer\[data-size='wide'\]\s*\{\s*width:\s*min\((\d+(?:\.\d+)?)px/u,
    );
    const bodyContent = wideWidth - 2 * bodyPadding;
    const floor = (selector: string): number =>
      number(rule(selector), /min-width:\s*calc\(var\(--kt-font-size-body\) \* (\d+(?:\.\d+)?)\)/u);
    const supplierColumns = [
      ".proc-compare-matrix td[data-column='supplier']",
      ".proc-compare-matrix td[data-column='price']",
      ".proc-compare-matrix td[data-column='terms']",
      ".proc-compare-matrix td[data-column='quote']",
    ].reduce((sum, selector) => sum + floor(selector), 0);
    const line = floor(".proc-compare-matrix td[data-column='line']");
    const quote = floor(".proc-compare-matrix td[data-column^='quote-']");
    expect(supplierColumns * fontSize).toBeLessThanOrEqual(bodyContent);
    expect((line + 3 * quote) * fontSize).toBeLessThanOrEqual(bodyContent);
    expect((line + 5 * quote) * fontSize).toBeGreaterThan(bodyContent);
  });

  it('样式表经采购域宿主静态图并入主 CSS 包（裁定15）', () => {
    const host = readFileSync(new URL('../procurement-view.ts', import.meta.url), 'utf8');
    expect(host).toContain("import './console/procurement-console.css';");
  });
});
