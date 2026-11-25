import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../test/fixtures/preact-dom';
import { CtrConsolePage } from './commercial/console/ctr-console';
import type { CtrConsolePorts, CtrRow } from './commercial/console/ctr-ports';

// U3-COM-5：技术需求控制台真实回调契约（原 ctr-view 行为面的等价迁移——
// 创建载荷/修订门/状态流转 PUT/批准驳回/附件上传；错误经提交错误面呈现）。
const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const requirementInput = {
  application: '足球场',
  projectRegion: '青岛',
  performanceStandard: '客户技术规范',
  pileHeight: '50.5',
  quantity: '8000.25',
  color: '双色翠绿',
  baseCondition: '沥青',
  drainageRequirement: '30分钟',
  fireRating: '项目规范',
  warrantyYears: '8',
  delivery: '固定交付',
};
// Independently spelled output oracle: not generated with the production mapper.
const requirements = {
  application: '足球场',
  projectRegion: '青岛',
  performanceStandard: '客户技术规范',
  pileHeightMm: 50.5,
  quantitySquareMeters: 8000.25,
  color: '双色翠绿',
  baseCondition: '沥青',
  drainageRequirement: '30分钟',
  fireRating: '项目规范',
  warrantyYears: 8,
  delivery: '固定交付',
};
const draft: CtrRow = {
  id: 'version-1',
  ctrId: 'ctr-1',
  code: 'CTR-1',
  title: '学校需求',
  version: 1,
  status: 'DRAFT',
  requirements,
  attachments: [],
};

const portsFor = (
  ctrs: readonly CtrRow[],
  extraPermissions: readonly string[] = [],
  overrides: Partial<CtrConsolePorts> = {},
): CtrConsolePorts => ({
  permissions: new Set(['ctr:read', ...extraPermissions]),
  initialCtrs: ctrs,
  initialSolutions: [],
  opportunities: [{ id: 'opportunity-1', name: '学校项目' }],
  textValue: (value, fallback = '') =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
  recordValue: (value) =>
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {},
  displayRequirement: (value) =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : '—',
  submit: vi.fn().mockResolvedValue(null),
  uploadAttachment: vi.fn().mockResolvedValue(undefined),
  refresh: vi.fn().mockResolvedValue({ ctrs, solutions: [] }),
  ...overrides,
});

const mount = (ports: CtrConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(CtrConsolePage(ports) as ComponentType, {}), host);
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
  ['opportunityId', 'opportunity-1'],
  ['code', 'CTR-NEW'],
  ['title', '新需求'],
  ...Object.entries(requirementInput),
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('technical requirement console real callback contracts (U3-COM-5)', () => {
  it('renders empty state and hides creation without permission', () => {
    const empty = mount(portsFor([]));
    expect(empty.textContent).toContain('暂无技术需求单');
    expect(empty.querySelector('[data-testid="kt-ctr-create"]')).toBeNull();
    const noPermission = mount(portsFor([draft]));
    expect(noPermission.querySelector('[data-testid="kt-ctr-create"]')).toBeNull();
  });

  it('creates fixed typed requirements and reloads', async () => {
    const ports = portsFor([], ['ctr:create']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-ctr-create"]')).click();
    await flush();
    for (const [name, value] of CREATE_FORM) fillField(host, name, value);
    await flush();
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/ctrs', {
      opportunityId: 'opportunity-1',
      code: 'CTR-NEW',
      title: '新需求',
      requirements,
    });
    expect(ports.refresh).toHaveBeenCalledTimes(1);
  });

  it('offers revision only for the latest non-draft root and preserves prefill', async () => {
    const ports = portsFor(
      [
        {
          ...draft,
          id: 'version-2',
          version: 2,
          status: 'REJECTED',
          requirements: { ...requirements, color: '新版绿' },
        },
        { ...draft, status: 'APPROVED' },
      ],
      ['ctr:update'],
    );
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-ctr-open"]')).click();
    await flush();
    expect(host.textContent).toContain('新版绿（上一版：双色翠绿）');
    const revise = host.querySelector('[data-testid="kt-ctr-revise"]');
    expect(revise).not.toBeNull();
    element(revise).click();
    await flush();
    const drawer = element(host.querySelector('.detail-drawer'));
    const title = drawer
      .querySelectorAll('input')
      .find((item) => (item as TestElement).getAttribute('name') === 'title') as
      | TestElement
      | undefined;
    if (title) {
      title.value = '修订需求';
      title.dispatchEvent(new Event('input', { bubbles: true }));
    }
    for (const [name, value] of Object.entries(requirementInput)) fillField(host, name, value);
    await flush();
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/ctrs/ctr-1/versions', {
      title: '修订需求',
      requirements,
    });
  });

  it('does not offer revision/upload on older non-latest versions', async () => {
    const ports = portsFor(
      [
        { ...draft, status: 'APPROVED' },
        { ...draft, id: 'version-2', version: 2 },
      ],
      ['ctr:update', 'attachment:manage'],
    );
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-ctr-open"]')).click();
    await flush();
    expect(host.querySelector('[data-testid="kt-ctr-revise"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-ctr-upload"]')).toBeNull();
  });

  it('does not offer upload for incomplete gate', async () => {
    const host = mount(
      portsFor([{ ...draft, status: 'SUBMITTED' }], ['ctr:update', 'attachment:manage']),
    );
    element(host.querySelector('[data-testid="kt-ctr-open"]')).click();
    await flush();
    expect(host.querySelector('[data-testid="kt-ctr-upload"]')).toBeNull();
  });

  it('uploads the original file against version id and reloads', async () => {
    const ports = portsFor([draft], ['ctr:update', 'attachment:manage']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-ctr-open"]')).click();
    await flush();
    const input = element(
      element(host.querySelector('[data-testid="kt-ctr-upload"]')).querySelector(
        'input[type="file"]',
      ),
    );
    const file = new File(['fixed'], 'fixed.pdf');
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await flush();
    expect(ports.uploadAttachment).toHaveBeenCalledTimes(1);
    expect(ports.uploadAttachment).toHaveBeenCalledWith('version-1', file);
    expect(ports.refresh).toHaveBeenCalledTimes(1);
  });

  it('submits expected version via PUT state (no extra reload) and surfaces rejection', async () => {
    const ports = portsFor([draft], ['ctr:submit']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-ctr-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-ctr-submit"]')).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/ctr-versions/version-1/state',
      { action: 'submit', expectedVersion: 1 },
      'PUT',
    );
    const failing = portsFor([draft], ['ctr:submit'], {
      submit: vi.fn().mockRejectedValue(new Error('submit rejected')),
    });
    const failingHost = mount(failing);
    element(failingHost.querySelector('[data-testid="kt-ctr-open"]')).click();
    await flush();
    element(failingHost.querySelector('[data-testid="kt-ctr-submit"]')).click();
    await flush();
    expect(
      element(failingHost.querySelector('[data-testid="kt-ctr-submit-error"]')).textContent,
    ).toBe('submit rejected');
  });

  it.each([
    ['批准', 'APPROVED', 'kt-ctr-approve'],
    ['驳回', 'REJECTED', 'kt-ctr-reject'],
  ] as const)(
    'binds %s decision via PUT state with fixed evidence reason',
    async (label, decision, testId) => {
      const ports = portsFor([{ ...draft, status: 'SUBMITTED' }], ['ctr:approve']);
      const host = mount(ports);
      element(host.querySelector('[data-testid="kt-ctr-open"]')).click();
      await flush();
      element(host.querySelector(`[data-testid="${testId}"]`)).click();
      await flush();
      fillField(host, 'reason', 'fixed decision evidence');
      await flush();
      const confirmation = host.querySelector('[data-confirmation="true"]');
      if (confirmation) {
        (confirmation as { click(): void }).click();
        await flush();
      }
      await submitDrawer(host);
      expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
        '/api/v1/ctr-versions/version-1/state',
        { action: 'decide', decision, reason: 'fixed decision evidence' },
        'PUT',
      );
      void label;
    },
  );

  // WFD-1（写流程真浏览器量测发现）：写操作之后表格不更新。带「是否最新版」标记的列表只在页面创建时算了一次。
  describe('写操作之后列表与抽屉跟着刷新（WFD-1）', () => {
    const created: CtrRow = { ...draft, id: 'version-new', ctrId: 'ctr-new', code: 'CTR-NEW' };
    const rowTexts = (host: TestElement): readonly string[] =>
      host
        .querySelectorAll('[data-testid="kt-ctr-open"]')
        .map((button) =>
          (button.parentNode?.parentNode?.textContent ?? '').replace(/\s+/gu, ' ').trim(),
        );

    it('新建之后表格里出现新的需求单', async () => {
      const ports = portsFor([draft], ['ctr:create'], {
        refresh: vi.fn().mockResolvedValue({ ctrs: [draft, created], solutions: [] }),
      });
      const host = mount(ports);
      element(host.querySelector('[data-testid="kt-ctr-create"]')).click();
      await flush();
      for (const [name, value] of CREATE_FORM) fillField(host, name, value);
      await flush();
      await submitDrawer(host);
      await flush();
      expect(rowTexts(host).some((text) => text.includes('CTR-NEW'))).toBe(true);
    });

    it('提交评审之后表格那一行的状态变为「已提交」，抽屉里换成批准 / 驳回', async () => {
      const submitted: CtrRow = { ...draft, status: 'SUBMITTED' };
      const ports = portsFor([draft], ['ctr:submit', 'ctr:approve'], {
        refresh: vi.fn().mockResolvedValue({ ctrs: [submitted], solutions: [] }),
      });
      const host = mount(ports);
      element(host.querySelector('[data-testid="kt-ctr-open"]')).click();
      await flush();
      expect(host.textContent).toContain('草稿');
      element(host.querySelector('[data-testid="kt-ctr-submit"]')).click();
      await flush();
      await flush();
      // 表格那一行。
      const row = rowTexts(host)[0] ?? '';
      expect(row).toContain('已提交');
      expect(row).not.toContain('草稿');
      // 仍然开着的抽屉。
      const drawer = element(host.querySelector('.detail-drawer'));
      expect(drawer.querySelector('[data-testid="kt-ctr-submit"]')).toBeNull();
      expect(drawer.querySelector('[data-testid="kt-ctr-approve"]')).not.toBeNull();
    });

    it('新建修订之后表格里出现新的一版，旧的一版不再提供「新建修订」', async () => {
      const second: CtrRow = { ...draft, id: 'version-2', version: 2, status: 'DRAFT' };
      const firstApproved: CtrRow = { ...draft, status: 'APPROVED' };
      const ports = portsFor([firstApproved], ['ctr:update'], {
        refresh: vi.fn().mockResolvedValue({ ctrs: [firstApproved, second], solutions: [] }),
      });
      const host = mount(ports);
      element(host.querySelector('[data-testid="kt-ctr-open"]')).click();
      await flush();
      element(host.querySelector('[data-testid="kt-ctr-revise"]')).click();
      await flush();
      for (const [name, value] of Object.entries(requirementInput)) fillField(host, name, value);
      await flush();
      await submitDrawer(host);
      await flush();
      expect(rowTexts(host).filter((text) => text.includes('CTR-1'))).toHaveLength(2);
      expect(rowTexts(host).some((text) => text.includes('第 2 版'))).toBe(true);
      // 再打开旧的一版（已不是最新版）：没有「新建修订」。
      element(host.querySelectorAll('[data-testid="kt-ctr-open"]')[0]).click();
      await flush();
      expect(host.querySelector('[data-testid="kt-ctr-revise"]')).toBeNull();
    });
  });
});
