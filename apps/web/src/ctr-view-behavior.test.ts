import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openFileForm, openForm } from './shared/forms';
import { appendCtrView } from './commercial/ctr-view';
import type { SalesViewController, SalesViewPorts } from './commercial/sales-view-ports';
import { createBehaviorElement, findElement, htmlElement } from '../test/fixtures/behavior-dom';

vi.mock('./shared/forms', () => ({ openForm: vi.fn(), openFileForm: vi.fn() }));
const form = vi.mocked(openForm),
  fileForm = vi.mocked(openFileForm);
const unused = (): never => {
  throw new Error('Unexpected sales port');
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
const setup = (
  records: readonly Record<string, unknown>[] = [],
  permissions: readonly string[] = [],
) => {
  const workspace = createBehaviorElement('main'),
    status = createBehaviorElement('p');
  status.textContent = 'before';
  const submit = vi.fn<SalesViewController['submit']>(() => Promise.resolve());
  const load = vi.fn(() => Promise.resolve());
  const upload = vi.fn<SalesViewController['uploadCtrAttachment']>(() => Promise.resolve());
  const controller: SalesViewController = {
    opportunities: [{ id: 'opportunity-1', name: '学校项目' }],
    customers: [],
    views: new Map([['/api/v1/ctrs', records]]),
    message: 'loaded',
    submit,
    load,
    transitionOpportunity: unused,
    uploadCtrAttachment: upload,
  };
  const displayRequirement = (value: unknown): string =>
    typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '—';
  const ports: SalesViewPorts = {
    recordValue: (value) =>
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {},
    displayRequirement,
    formValue: unused,
    textValue: unused,
    displayMoney: unused,
    ctrRequirementFields: [
      ['pileHeightMm', '草高'],
      ['color', '颜色'],
    ],
    technicalSolutionOpportunityId: unused,
    opportunityPipelineSummary: unused,
    replaceRouteView: unused,
    rebuildWorkspace: unused,
  };
  const mount = () => {
    appendCtrView(
      htmlElement(workspace),
      htmlElement(status),
      controller,
      new Set(permissions),
      ports,
    );
  };
  const click = (text: string, root = workspace) => {
    findElement(root, (node) => node.tagName === 'BUTTON' && node.textContent === text).click();
    const call = form.mock.calls.at(-1);
    if (!call) throw new Error('Form missing');
    expect(call[0]).toBe(htmlElement(workspace));
    return { fields: call[3], run: call[5], title: call[1] };
  };
  return { workspace, status, controller, submit, load, upload, mount, click };
};
const draft = {
  id: 'version-1',
  ctrId: 'ctr-1',
  code: 'CTR-1',
  title: '学校需求',
  version: 1,
  status: 'DRAFT',
  requirements,
  attachments: [],
};
beforeEach(() => {
  form.mockClear();
  fileForm.mockClear();
  vi.stubGlobal('document', { createElement: createBehaviorElement });
});
afterEach(() => vi.unstubAllGlobals());

describe('technical requirement view real callback contracts', () => {
  it('renders empty state and hides creation and mutation without permission', () => {
    const empty = setup();
    empty.mount();
    expect(empty.workspace.textContent).toContain('暂无技术需求单');
    expect(empty.workspace.descendants().filter((node) => node.tagName === 'BUTTON')).toEqual([]);
    const f = setup([draft, { ...draft, id: 'version-2', version: 2, status: 'SUBMITTED' }]);
    f.mount();
    expect(f.workspace.descendants().filter((node) => node.tagName === 'BUTTON')).toEqual([]);
    expect(form).not.toHaveBeenCalled();
  });

  it('creates fixed typed requirements and waits for reload before reading current message', async () => {
    const f = setup([], ['ctr:create']);
    f.mount();
    const opened = f.click('＋ 新建技术需求');
    expect(opened.fields[0]?.options).toEqual([{ value: 'opportunity-1', label: '学校项目' }]);
    expect(opened.fields.find((field) => field.name === 'warrantyYears')?.value).toBe('8');
    let finish: () => void = unused;
    f.load.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = opened.run({
      opportunityId: 'opportunity-1',
      code: 'CTR-NEW',
      title: '新需求',
      ...requirementInput,
    });
    expect(f.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/ctrs', {
      opportunityId: 'opportunity-1',
      code: 'CTR-NEW',
      title: '新需求',
      requirements,
    });
    await Promise.resolve();
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.status.textContent).toBe('before');
    f.controller.message = 'reloaded new message';
    finish();
    await pending;
    expect(f.status.textContent).toBe('reloaded new message');
    f.status.textContent = 'unchanged';
    f.submit.mockRejectedValueOnce(new Error('creation rejected'));
    await expect(opened.run({ ...requirementInput })).rejects.toThrow('creation rejected');
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.status.textContent).toBe('unchanged');
  });

  it('offers revision only for the latest non-draft root and preserves numeric/prefill fields', async () => {
    const records = [
      { ...draft, status: 'APPROVED' },
      {
        ...draft,
        id: 'version-2',
        version: 2,
        status: 'REJECTED',
        requirements: { ...requirements, color: '新版绿' },
        attachments: [{ id: 'a' }],
      },
      { id: 'orphan', status: 'APPROVED', version: 9 },
    ];
    const f = setup(records, ['ctr:update']);
    f.mount();
    expect(
      f.workspace
        .descendants()
        .filter((node) => node.tagName === 'BUTTON' && node.textContent === '新建修订'),
    ).toHaveLength(1);
    const rows = f.workspace.descendants().filter((node) => node.classList.contains('ctr-row'));
    const latest = rows[1];
    if (!latest) throw new Error('Latest row missing');
    expect(latest.textContent).toContain('新版绿（上一版：双色翠绿）');
    expect(latest.textContent).toContain('1 个附件');
    expect(
      latest
        .descendants()
        .filter((node) => node.classList.contains('changed'))
        .map((node) => node.textContent),
    ).toEqual(['新版绿（上一版：双色翠绿）']);
    expect(rows[2]?.textContent).toContain('技术需求单未命名需求');
    const opened = f.click('新建修订', latest);
    expect(opened.title).toBe('新建 CTR-1 修订');
    expect(opened.fields.find((field) => field.name === 'pileHeight')?.value).toBe('50.5');
    expect(opened.fields.find((field) => field.name === 'color')?.value).toBe('新版绿');
    await opened.run({ title: '修订需求', ...requirementInput });
    expect(f.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/ctrs/ctr-1/versions', {
      title: '修订需求',
      requirements,
    });
    expect(f.load).toHaveBeenCalledTimes(1);
    f.submit.mockRejectedValueOnce(new Error('revision rejected'));
    await expect(opened.run({})).rejects.toThrow('revision rejected');
    expect(f.load).toHaveBeenCalledTimes(1);
  });

  it('does not revise an older published revision when the latest root version is still draft', () => {
    const f = setup(
      [
        { ...draft, status: 'APPROVED' },
        { ...draft, id: 'version-2', version: 2 },
      ],
      ['ctr:update'],
    );
    f.mount();
    expect(f.workspace.descendants().filter((node) => node.tagName === 'BUTTON')).toEqual([]);
  });

  it.each([
    ['DRAFT', ['ctr:update']],
    ['DRAFT', ['attachment:manage']],
    ['SUBMITTED', ['ctr:update', 'attachment:manage']],
  ] as const)('does not offer upload for %s with incomplete gate %j', (state, permissions) => {
    const f = setup([{ ...draft, status: state }], permissions);
    f.mount();
    expect(f.workspace.descendants().some((node) => node.textContent === '上传附件')).toBe(false);
    expect(fileForm).not.toHaveBeenCalled();
  });

  it('uploads the original file against version id, then uses controller message without extra reload', async () => {
    const f = setup([draft], ['ctr:update', 'attachment:manage']);
    f.mount();
    findElement(
      f.workspace,
      (node) => node.tagName === 'BUTTON' && node.textContent === '上传附件',
    ).click();
    const call = fileForm.mock.calls[0];
    if (!call) throw new Error('File form missing');
    expect(call[0]).toBe(htmlElement(f.workspace));
    expect(call[1]).toBe('为 CTR-1 第 1 版上传附件');
    const file = new File(['fixed'], 'fixed.pdf');
    await call[2](file);
    expect(f.upload).toHaveBeenCalledTimes(1);
    expect(f.upload.mock.calls[0]?.[0]).toBe('version-1');
    expect(f.upload.mock.calls[0]?.[1]).toBe(file);
    expect(f.status.textContent).toBe('loaded');
    expect(f.load).not.toHaveBeenCalled();
    f.status.textContent = 'unchanged';
    f.upload.mockRejectedValueOnce(new Error('upload rejected'));
    await expect(call[2](file)).rejects.toThrow('upload rejected');
    expect(f.status.textContent).toBe('unchanged');
  });

  it('submits expected version without inventing reload and does not write success after rejection', async () => {
    const f = setup([draft], ['ctr:submit']);
    f.mount();
    const opened = f.click('提交评审');
    expect(opened.fields).toEqual([]);
    await opened.run({});
    expect(f.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/ctr-versions/version-1/submit', {
      expectedVersion: 1,
    });
    expect(f.status.textContent).toBe('技术需求已提交并生成不可变快照');
    expect(f.load).not.toHaveBeenCalled();
    f.status.textContent = 'unchanged';
    f.submit.mockRejectedValueOnce(new Error('submit rejected'));
    await expect(opened.run({})).rejects.toThrow('submit rejected');
    expect(f.status.textContent).toBe('unchanged');
  });

  it.each([
    ['批准', 'APPROVED'],
    ['驳回', 'REJECTED'],
  ] as const)('binds %s decision with fixed evidence reason', async (label, decision) => {
    const f = setup([{ ...draft, status: 'SUBMITTED' }], ['ctr:approve']);
    f.mount();
    const opened = f.click(label);
    expect(opened.fields).toEqual([
      { name: 'reason', label: '审批意见', type: 'textarea', required: true },
    ]);
    await opened.run({ reason: 'fixed decision evidence' });
    expect(f.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/ctr-versions/version-1/decision', {
      decision,
      reason: 'fixed decision evidence',
    });
    expect(f.status.textContent).toBe(`技术需求已${label}`);
    expect(f.load).not.toHaveBeenCalled();
    f.status.textContent = 'unchanged';
    f.submit.mockRejectedValueOnce(new Error('decision rejected'));
    await expect(opened.run({ reason: 'fixed decision evidence' })).rejects.toThrow(
      'decision rejected',
    );
    expect(f.status.textContent).toBe('unchanged');
  });
});
