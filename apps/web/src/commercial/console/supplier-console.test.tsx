// U3-PROC-1 供应商控制台白盒行为测试（Preact 分域重写后的行为面；
// 原 vanilla supplier-register 创建/物料准入载荷 oracle 逐条等价迁移——
// 创建固定载荷（CNY/评分×100/contact 对象）、PUT qualification 审核载荷、
// 权限门、状态筛选/检索、报价历史、刷新错误面）。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { SupplierConsolePage } from './supplier-console';
import type { SupplierConsolePorts, SupplierRow } from './supplier-ports';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const supplier: SupplierRow = {
  id: 'supplier-1',
  supplier_number: 'SUP-1',
  name: '草纱供应商',
  status: 'ACTIVE',
  currency: 'CNY',
  payment_terms_days: 30,
  quality_rating_basis_points: 9200,
  contact: { name: '王经理', phone: '13800000000' },
  qualifications: [
    { id: 'q-1', status: 'APPROVED', sku: 'RM-YARN', itemName: '草纱', itemVersion: 1 },
  ],
};

const onHoldSupplier: SupplierRow = {
  ...supplier,
  id: 'supplier-2',
  supplier_number: 'SUP-2',
  name: '背胶供应商',
  status: 'ON_HOLD',
  qualifications: [],
};

const quote: SupplierRow = {
  id: 'quote-1',
  supplier_id: 'supplier-1',
  quote_reference: 'SQ-1',
  received_at: '2026-11-01T00:00:00.000Z',
  valid_until: '2026-12-31',
};

const portsFor = (
  suppliers: readonly SupplierRow[] = [supplier],
  extraPermissions: readonly string[] = [],
  overrides: Partial<SupplierConsolePorts> = {},
): SupplierConsolePorts => ({
  permissions: new Set(['supplier:read', ...extraPermissions]),
  initialSuppliers: suppliers,
  itemVersionChoices: [{ value: 'item-v1', label: 'RM-YARN · 草纱' }],
  initialQuotes: [quote],
  recordText: (record, camel, snake, fallback = '') => {
    const value = record[camel] ?? record[snake] ?? fallback;
    return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
  },
  textValue: (value, fallback = '') =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
  submit: vi.fn().mockResolvedValue(null),
  refresh: vi.fn().mockResolvedValue({ suppliers, quotes: [quote] }),
  ...overrides,
});

const mount = (ports: SupplierConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(SupplierConsolePage(ports) as ComponentType, {}), host);
  return host;
};

const fillField = (host: TestElement, name: string, value: string): void => {
  const drawer = element(host.querySelector('.detail-drawer'));
  const select = drawer
    .querySelectorAll('select')
    .find((item) => (item as TestElement).getAttribute('name') === name) as TestElement | undefined;
  if (select) {
    select.value = value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  const input = drawer
    .querySelectorAll('input,textarea')
    .find((item) => (item as TestElement).getAttribute('name') === name) as TestElement | undefined;
  if (!input) throw new Error(`missing field ${name}`);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const submitDrawer = async (host: TestElement): Promise<void> => {
  element(
    element(host.querySelector('.detail-drawer')).querySelector('button[type="submit"]'),
  ).click();
  await flush();
};

const CREATE_FORM: readonly (readonly [string, string])[] = [
  ['supplierNumber', 'SUP-KT-YARN-002'],
  ['name', '青岛草纱第二供应商'],
  ['paymentTermsDays', '45'],
  ['qualityRating', '92'],
  ['contactName', '李经理'],
  ['contactPhone', '13900000000'],
];

const QUALIFY_FORM: readonly (readonly [string, string])[] = [
  ['action', 'approve'],
  ['itemVersionId', 'item-v1'],
  ['validFrom', '2026-11-01'],
  ['validTo', '2027-10-31'],
  ['minimumOrderQuantity', '1000'],
  ['leadTimeDays', '14'],
  ['evidenceReference', 'QA-2026-011'],
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('U3-PROC-1 供应商控制台', () => {
  it('创建供应商使用 vanilla 同款固定载荷（CNY/评分×100/contact 对象）并在刷新后收起抽屉', async () => {
    const ports = portsFor([], ['supplier:manage']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-supplier-create"]')).click();
    await flush();
    for (const [name, value] of CREATE_FORM) fillField(host, name, value);
    await flush();
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/suppliers', {
      supplierNumber: 'SUP-KT-YARN-002',
      name: '青岛草纱第二供应商',
      currency: 'CNY',
      paymentTermsDays: 45,
      qualityRatingBasisPoints: 9200,
      contact: { name: '李经理', phone: '13900000000' },
    });
    expect(ports.refresh).toHaveBeenCalledTimes(1);
  });

  it('物料准入审核：approve 走 PUT qualification 统一动作端点并保留 evidence 结构', async () => {
    const ports = portsFor([supplier], ['supplier:manage']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-supplier-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-supplier-qualify"]')).click();
    await flush();
    for (const [name, value] of QUALIFY_FORM) fillField(host, name, value);
    await flush();
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/suppliers/supplier-1/qualification',
      {
        action: 'approve',
        itemVersionId: 'item-v1',
        validFrom: '2026-11-01',
        validTo: '2027-10-31',
        minimumOrderQuantity: '1000',
        leadTimeDays: 14,
        evidence: { reference: 'QA-2026-011' },
      },
      'PUT',
    );
    expect(ports.refresh).toHaveBeenCalledTimes(1);
  });

  it('驳回（reject）经同一端点映射 action=reject', async () => {
    const ports = portsFor([supplier], ['supplier:manage']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-supplier-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-supplier-qualify"]')).click();
    await flush();
    fillField(host, 'action', 'reject');
    fillField(host, 'itemVersionId', 'item-v1');
    fillField(host, 'validFrom', '2026-11-01');
    fillField(host, 'validTo', '2027-10-31');
    fillField(host, 'minimumOrderQuantity', '0');
    fillField(host, 'leadTimeDays', '7');
    fillField(host, 'evidenceReference', 'QA-2026-012');
    await flush();
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/suppliers/supplier-1/qualification',
      expect.objectContaining({ action: 'reject', evidence: { reference: 'QA-2026-012' } }),
      'PUT',
    );
  });

  it('权限门：无 supplier:manage 时不出现新建按钮与审核入口', async () => {
    const ports = portsFor([supplier]);
    const host = mount(ports);
    expect(host.querySelector('[data-testid="kt-supplier-create"]')).toBe(null);
    element(host.querySelector('[data-testid="kt-supplier-open"]')).click();
    await flush();
    expect(host.querySelector('[data-testid="kt-supplier-qualify"]')).toBe(null);
    expect(ports.submit).not.toHaveBeenCalled();
  });

  it('状态筛选与检索：ON_HOLD 过滤 + 编号检索命中', async () => {
    const ports = portsFor([supplier, onHoldSupplier]);
    const host = mount(ports);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
    element(host.querySelector('[data-testid="kt-supplier-filter-on_hold"]')).click();
    await flush();
    expect(host.textContent).toContain('SUP-2');
    expect(host.textContent).not.toContain('SUP-1');
    const search = element(host.querySelector('[data-testid="kt-supplier-search"]'));
    search.value = 'SUP-1';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    element(host.querySelector('[data-testid="kt-supplier-filter-all"]')).click();
    await flush();
    expect(host.textContent).toContain('SUP-1');
    expect(host.textContent).not.toContain('SUP-2');
  });

  it('详情抽屉展示资质记录与按 supplierId 过滤的报价历史', async () => {
    const ports = portsFor([supplier]);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-supplier-open"]')).click();
    await flush();
    const detail = element(host.querySelector('[data-testid="kt-supplier-detail"]'));
    expect(detail.textContent).toContain('SUP-1');
    expect(detail.textContent).toContain('王经理');
    expect(detail.textContent).toContain('92 / 100');
    const qualifications = element(
      host.querySelector('[data-testid="kt-supplier-qualifications"]'),
    );
    expect(qualifications.textContent).toContain('RM-YARN · 草纱');
    const quotes = element(host.querySelector('[data-testid="kt-supplier-quotes"]'));
    expect(quotes.textContent).toContain('SQ-1');
    expect(quotes.textContent).toContain('2026-12-31');
  });

  it('刷新失败时错误经 DataTable error 面暴露', async () => {
    const ports = portsFor([supplier], [], {
      refresh: vi.fn().mockRejectedValue(new Error('供应商加载失败')),
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-supplier-refresh"]')).click();
    await flush();
    await flush();
    expect(host.querySelector('.data-table-error')).not.toBeNull();
    expect(host.textContent).toContain('供应商加载失败');
  });
});
