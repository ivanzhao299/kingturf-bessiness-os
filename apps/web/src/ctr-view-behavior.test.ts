import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import {
  installGlobalTestDom,
  TestDocument,
  TestEvent,
  type TestElement,
} from '../test/fixtures/preact-dom';
import { confirmAction, dismissConfirm } from '../test/fixtures/confirm-dialog';
import { noticeOf } from '../test/fixtures/console-notice';
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

// Preact 的 useEffect 在本测试环境里没有 requestAnimationFrame，要等约 35 毫秒（hooks 的 RAF_TIMEOUT）之后才执行；
// 测试 DOM 的 focus() 写的是「最近安装的文档」，与节点属于哪个文档无关。于是上一个用例打开抽屉时排下的 effect
// （把焦点移进抽屉）可能在本用例进行到一半时才执行，改写本用例的焦点——确认框「初焦在确认按钮」这类断言会时过时
// 不过（单跑通过、整文件跑不稳）。每个用例结束时把这个窗口等过去，遗留的 effect 就落在本用例里。
// 夹具本身的这个缺陷（focus 不按节点所属的文档记录）另行登记，留给主协调裁定是否从根上修。
afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise((resolve) => setTimeout(resolve, 60));
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
    // WFD（TD-WF-014② 的规则）：提交评审是单击即生效、随后冻结的动作，先出确认框，确认后才发请求。
    await flush();
    expect(ports.submit).not.toHaveBeenCalled();
    await confirmAction(host, '提交评审', '确认提交');
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
    await confirmAction(failingHost, '提交评审', '确认提交');
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
      await confirmAction(host, '提交评审', '确认提交');
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

  // WFD 补齐（TD-WF-014① / ② 在本控制台的缺口）：写成功有状态行；提交评审先确认；失败原因显示在触发的
  // 表单 / 动作区并转成中文。
  describe('写反馈：确认框、状态行、失败原因（WFD）', () => {
    it('提交评审的确认框：不确认就不发请求，焦点回到「提交评审」；Esc 同样取消', async () => {
      const ports = portsFor([draft], ['ctr:submit']);
      const host = mount(ports);
      element(host.querySelector('[data-testid="kt-ctr-open"]')).click();
      await flush();
      const trigger = element(host.querySelector('[data-testid="kt-ctr-submit"]'));
      trigger.focus();
      trigger.click();
      await flush();
      const dialog = element(host.querySelector('[role="alertdialog"]'));
      // 说明写清对象与后果；提交不是破坏性动作，初焦落在「确认提交」上。
      expect(dialog.textContent).toContain('提交评审');
      expect(dialog.textContent).toContain('CTR-1 · 第 1 版');
      expect(dialog.textContent).toContain('冻结为不可变快照');
      const buttons = dialog.querySelectorAll('button');
      expect(buttons.map((button) => button.textContent.trim())).toEqual(['取消', '确认提交']);
      expect(TestDocument.current.activeElement).toBe(buttons[1]);
      await dismissConfirm(host);
      expect(host.querySelector('[role="alertdialog"]')).toBe(null);
      expect(ports.submit).not.toHaveBeenCalled();
      expect(TestDocument.current.activeElement).toBe(trigger);

      trigger.click();
      await flush();
      element(host.querySelector('[role="alertdialog"]'))
        .querySelectorAll('button')[0]
        ?.dispatchEvent(new TestEvent('keydown', { key: 'Escape' }));
      await flush();
      expect(host.querySelector('[role="alertdialog"]')).toBe(null);
      expect(ports.submit).not.toHaveBeenCalled();
      expect(TestDocument.current.activeElement).toBe(trigger);
    });

    it('提交评审成功：抽屉里出现状态行「已提交评审」，初焦进入的确认框关闭后请求才发出', async () => {
      const submitted: CtrRow = { ...draft, status: 'SUBMITTED' };
      const ports = portsFor([draft], ['ctr:submit', 'ctr:approve'], {
        refresh: vi.fn().mockResolvedValue({ ctrs: [submitted], solutions: [] }),
      });
      const host = mount(ports);
      element(host.querySelector('[data-testid="kt-ctr-open"]')).click();
      await flush();
      expect(noticeOf(host).text).toBe('');
      element(host.querySelector('[data-testid="kt-ctr-submit"]')).click();
      await flush();
      expect(ports.submit).not.toHaveBeenCalled();
      await confirmAction(host, '提交评审', '确认提交');
      await flush();
      await flush();
      expect(ports.submit).toHaveBeenCalledTimes(1);
      // 抽屉开着：状态行在抽屉底部。
      expect(noticeOf(host)).toEqual({ text: '已提交评审：CTR-1', inDrawer: true });
      // 按钮被换成批准 / 驳回之后焦点仍在抽屉里（关闭按钮），没有掉到页面主体。
      const active = TestDocument.current.activeElement as TestElement | null;
      expect(active?.classList.contains('drawer-close')).toBe(true);
    });

    it('新建成功：页头下方出现状态行；打开下一条记录时清空', async () => {
      const created: CtrRow = { ...draft, id: 'version-new', ctrId: 'ctr-new', code: 'CTR-NEW' };
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
      await flush();
      expect(noticeOf(host)).toEqual({ text: '已创建技术需求 CTR-NEW', inDrawer: false });
      element(host.querySelectorAll('[data-testid="kt-ctr-open"]')[0]).click();
      await flush();
      expect(noticeOf(host).text).toBe('');
    });

    it.each([
      ['批准', 'APPROVED', 'kt-ctr-approve', '已批准技术需求 CTR-1'],
      ['驳回', 'REJECTED', 'kt-ctr-reject', '已驳回技术需求 CTR-1'],
    ] as const)(
      '%s：经表单（理由必填）直接提交，成功后状态行在抽屉底部',
      async (_l, decision, testId, text) => {
        const decided: CtrRow = { ...draft, status: decision };
        const ports = portsFor([{ ...draft, status: 'SUBMITTED' }], ['ctr:approve'], {
          refresh: vi.fn().mockResolvedValue({ ctrs: [decided], solutions: [] }),
        });
        const host = mount(ports);
        element(host.querySelector('[data-testid="kt-ctr-open"]')).click();
        await flush();
        element(host.querySelector(`[data-testid="${testId}"]`)).click();
        await flush();
        // 表单已经写明动作并要求填理由：不再出确认框。
        expect(host.querySelector('[role="alertdialog"]')).toBe(null);
        fillField(host, 'reason', 'fixed decision evidence');
        await flush();
        const confirmation = host.querySelector('[data-confirmation="true"]');
        if (confirmation) {
          (confirmation as { click(): void }).click();
          await flush();
        }
        await submitDrawer(host);
        await flush();
        await flush();
        expect(ports.submit).toHaveBeenCalledTimes(1);
        expect(noticeOf(host)).toEqual({ text, inDrawer: true });
      },
    );

    it('新建修订与上传附件成功后各有一条状态行', async () => {
      const second: CtrRow = { ...draft, id: 'version-2', version: 2, status: 'DRAFT' };
      const firstApproved: CtrRow = { ...draft, status: 'APPROVED' };
      const revise = portsFor([firstApproved], ['ctr:update'], {
        refresh: vi.fn().mockResolvedValue({ ctrs: [firstApproved, second], solutions: [] }),
      });
      const reviseHost = mount(revise);
      element(reviseHost.querySelector('[data-testid="kt-ctr-open"]')).click();
      await flush();
      element(reviseHost.querySelector('[data-testid="kt-ctr-revise"]')).click();
      await flush();
      for (const [name, value] of Object.entries(requirementInput))
        fillField(reviseHost, name, value);
      await flush();
      await submitDrawer(reviseHost);
      await flush();
      await flush();
      expect(noticeOf(reviseHost)).toEqual({ text: '已创建修订草稿 CTR-1', inDrawer: true });

      const upload = portsFor([draft], ['ctr:update', 'attachment:manage']);
      const uploadHost = mount(upload);
      element(uploadHost.querySelector('[data-testid="kt-ctr-open"]')).click();
      await flush();
      const input = element(
        element(uploadHost.querySelector('[data-testid="kt-ctr-upload"]')).querySelector(
          'input[type="file"]',
        ),
      );
      Object.defineProperty(input, 'files', { value: [new File(['fixed'], 'fixed.pdf')] });
      input.dispatchEvent(new Event('change'));
      await flush();
      await flush();
      expect(noticeOf(uploadHost)).toEqual({ text: '已上传附件 fixed.pdf', inDrawer: true });
    });

    it('失败原因显示在触发它的位置并转成中文：提交评审在动作区，批准 / 新建在表单提示区', async () => {
      const rejected = { submit: vi.fn().mockRejectedValue(new Error('Internal server error')) };
      // 提交评审（不经表单的单击动作）：抽屉顶部的错误位。
      const review = portsFor([draft], ['ctr:submit'], rejected);
      const reviewHost = mount(review);
      element(reviewHost.querySelector('[data-testid="kt-ctr-open"]')).click();
      await flush();
      element(reviewHost.querySelector('[data-testid="kt-ctr-submit"]')).click();
      await flush();
      await confirmAction(reviewHost, '提交评审', '确认提交');
      await flush();
      expect(
        element(reviewHost.querySelector('[data-testid="kt-ctr-submit-error"]')).textContent,
      ).toBe('服务器处理请求时出错，请稍后重试');
      expect(noticeOf(reviewHost).text).toBe('');
      // 批准（行内表单）：表单自己的提示区，抽屉顶部的错误位让位。
      const approve = portsFor([{ ...draft, status: 'SUBMITTED' }], ['ctr:approve'], rejected);
      const approveHost = mount(approve);
      element(approveHost.querySelector('[data-testid="kt-ctr-open"]')).click();
      await flush();
      element(approveHost.querySelector('[data-testid="kt-ctr-approve"]')).click();
      await flush();
      fillField(approveHost, 'reason', 'fixed decision evidence');
      await flush();
      await submitDrawer(approveHost);
      await flush();
      const formAlert = element(
        approveHost.querySelector('.detail-drawer form.form-section [role="alert"]'),
      );
      expect(formAlert.textContent).toBe('服务器处理请求时出错，请稍后重试');
      expect(approveHost.querySelector('[data-testid="kt-ctr-submit-error"]')).toBe(null);
      // 新建（新建抽屉的表单）：表单提示区。
      const create = portsFor([draft], ['ctr:create'], rejected);
      const createHost = mount(create);
      element(createHost.querySelector('[data-testid="kt-ctr-create"]')).click();
      await flush();
      for (const [name, value] of CREATE_FORM) fillField(createHost, name, value);
      await flush();
      await submitDrawer(createHost);
      await flush();
      expect(
        element(createHost.querySelector('.detail-drawer form.form-section [role="alert"]'))
          .textContent,
      ).toBe('服务器处理请求时出错，请稍后重试');
      expect(noticeOf(createHost).text).toBe('');
    });
  });
});
