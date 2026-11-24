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
import { STACKED_COMPARE_WIDTH } from './compare-stack';
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

const openRfqCompare = async (): Promise<TestElement> => {
  const host = installGlobalTestDom().document.createElement('div');
  const ports: RfqConsolePorts = {
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
  render(h(RfqConsolePage(ports) as ComponentType, {}), host);
  element(host.querySelector('[data-testid="kt-rfq-open"]')).click();
  await settle();
  return element(host.querySelector('[data-testid="kt-rfq-quotes"]'));
};

const openSupplierCompare = async (): Promise<TestElement> => {
  const host = installGlobalTestDom().document.createElement('div');
  const ports: SupplierConsolePorts = {
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
  render(h(SupplierConsolePage(ports) as ComponentType, {}), host);
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

describe('采购域样式表（静态守卫）', () => {
  const stylesheet = readFileSync(new URL('./procurement-console.css', import.meta.url), 'utf8');
  const rule = (selector: string): string => {
    const start = stylesheet.indexOf(`${selector} {`);
    if (start < 0) throw new Error(`procurement-console.css has no rule for ${selector}`);
    return stylesheet.slice(start, stylesheet.indexOf('}', start));
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

  it('样式表经采购域宿主静态图并入主 CSS 包（裁定15）', () => {
    const host = readFileSync(new URL('../procurement-view.ts', import.meta.url), 'utf8');
    expect(host).toContain("import './console/procurement-console.css';");
  });
});
