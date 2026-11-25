import { h, render } from 'preact';
import { describe, expect, it, vi } from 'vitest';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { MrpConsolePage } from './mrp-console';
import { explanationOf } from './mrp-explanation';
import type { MrpConsolePorts, MrpRow, MrpSnapshot } from './mrp-ports';
import { textOf } from './mrp-state';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const element = (host: TestElement, selector: string): TestElement => {
  const node = host.querySelector(selector);
  if (!node) throw new Error(`missing ${selector}`);
  return node as TestElement;
};
const byId = (host: TestElement, id: string): TestElement =>
  element(host, `[data-testid="kt-mrp-${id}"]`);
const open = async (host: TestElement, id: string): Promise<void> => {
  byId(host, id).click();
  await flush();
};
const formValues = async (host: TestElement, values: Record<string, string>): Promise<void> => {
  for (const [name, value] of Object.entries(values)) {
    const control = element(host, `[name="${name}"]`);
    control.value = value;
    control.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
  }
};
const submitForm = async (host: TestElement): Promise<void> => {
  element(host, '.form-section button[type="submit"]').click();
  await flush();
};
const confirm = async (host: TestElement, label: string): Promise<void> => {
  const buttons = element(host, '.confirm-dialog').querySelectorAll('button');
  const button = buttons.find((candidate) => candidate.textContent === label);
  if (!button) throw new Error(`missing ${label}`);
  (button as TestElement).click();
  await flush();
};

const row = (effectiveState = 'PROPOSED'): MrpRow => ({
  id: 'proposal-1',
  mrp_run_id: 'latest',
  item_version_id: 'component',
  sku: 'COMPONENT',
  itemName: '原料',
  due_at: '2026-12-01',
  start_at: '2026-11-27',
  quantity: 10,
  proposal_type: 'PURCHASE',
  effectiveState,
  frozen: true,
  explanation: {
    freezeUntil: '2026-11-29',
    grossDemand: 9,
    safetyStock: 1,
    onHand: 0,
    scheduledReceipts: 0,
    netRequirement: 628.75,
    plannedQuantity: 1000,
  },
  events: [{ sequence: 1, state: 'PROPOSED' }],
});
const snapshot = (proposal = row()): MrpSnapshot => ({
  policies: [],
  demands: [],
  runs: [
    { id: 'latest', run_number: 'RUN-2', status: 'COMPUTED', proposals: [proposal] },
    { id: 'old', run_number: 'RUN-1', status: 'COMPUTED', proposals: [] },
  ],
});
const setup = (overrides: Partial<MrpConsolePorts> = {}, proposal = row()) => {
  const initial = snapshot(proposal);
  const submit = vi.fn<MrpConsolePorts['submit']>().mockResolvedValue(null);
  const refresh = vi.fn<MrpConsolePorts['refresh']>().mockResolvedValue(initial);
  const fetchProposals = vi
    .fn<MrpConsolePorts['fetchProposals']>()
    .mockResolvedValue({ items: [proposal], nextCursor: null });
  const loadRunDetail = vi
    .fn<MrpConsolePorts['loadRunDetail']>()
    .mockResolvedValue({ proposals: [proposal] });
  const host = installGlobalTestDom().document.createElement('div');
  render(
    h(
      MrpConsolePage({
        permissions: new Set([
          'mrp:read',
          'mrp-policy:read',
          'mrp:run',
          'mrp-policy:manage',
          'mrp:approve',
          'mrp:release',
        ]),
        initial,
        submit,
        refresh,
        fetchProposals,
        loadRunDetail,
        itemVersionChoices: [{ value: 'component', label: 'COMPONENT · 原料' }],
        recordText: (record, camel, snake, fallback = '') =>
          textOf(record[camel] ?? record[snake]) || fallback,
        textValue: textOf,
        businessStateLabel: textOf,
        operationsNextAction: () => '核对建议',
        ...overrides,
      }),
      {},
    ),
    host,
  );
  return { host, submit, refresh, fetchProposals, loadRunDetail };
};

const writeCases = [
  {
    id: 'create-policy',
    path: '/api/v1/mrp-policies',
    confirmation: '',
    values: {
      itemVersionId: 'component',
      makeOrBuy: 'BUY',
      safetyStock: '0.5',
      minimumOrderQuantity: '3',
      orderMultiple: '2',
      leadTimeDays: '4',
      freezeWindowDays: '5',
      effectiveAt: '2026-11-01',
    },
    wire: '{"itemVersionId":"component","makeOrBuy":"BUY","safetyStock":"0.5","minimumOrderQuantity":"3","orderMultiple":"2","leadTimeDays":4,"freezeWindowDays":5,"effectiveAt":"2026-11-01T00:00:00.000Z"}',
  },
  {
    id: 'create-demand',
    path: '/api/v1/mrp-demands',
    confirmation: '',
    values: {
      itemVersionId: 'component',
      sourceType: ' SALES-FORECAST ',
      sourceId: ' source-1 ',
      requiredAt: '2026-11-02',
      quantity: '3.5',
      priority: '2',
    },
    wire: '{"itemVersionId":"component","sourceType":"SALES-FORECAST","sourceId":"source-1","requiredAt":"2026-11-02","quantity":"3.5","priority":2}',
  },
  {
    id: 'run',
    path: '/api/v1/mrp-runs',
    confirmation: '确认运行',
    values: { runNumber: ' RUN-3 ', asOf: '2026-11-01', horizonEnd: '2026-12-01' },
    wire: '{"runNumber":"RUN-3","asOf":"2026-11-01T00:00:00.000Z","horizonEnd":"2026-12-01"}',
  },
  ...(['approve', 'reject'] as const).map((id) => ({
    id,
    path: `/api/v1/mrp-proposals/proposal-1/${id}`,
    confirmation: id === 'approve' ? '确认批准' : '确认拒绝',
    values: { reason: ' 核对 ', approval: ' EV ', freezeOverrideApproval: ' FREEZE ' },
    wire: '{"reason":"核对","evidence":{"approval":"EV","freezeOverrideApproval":"FREEZE"}}',
  })),
  {
    id: 'release',
    path: '/api/v1/mrp-proposals/proposal-1/release',
    confirmation: '确认下达',
    values: { reason: ' 核对 ', evidenceReference: ' REF ' },
    wire: '{"reason":"核对","evidence":{"reference":"REF"}}',
  },
];

describe('MRP console', () => {
  it.each(writeCases)(
    '$id keeps the legacy request body bytes',
    async ({ id, path, confirmation, values, wire }) => {
      const { host, submit, refresh } = setup({}, row(id === 'release' ? 'APPROVED' : 'PROPOSED'));
      await flush();
      await open(host, id);
      await formValues(host, values);
      await submitForm(host);
      if (confirmation) {
        expect(submit).not.toHaveBeenCalled();
        await confirm(host, '取消');
        expect(submit).not.toHaveBeenCalled();
        await submitForm(host);
        await confirm(host, confirmation);
      }
      expect(submit).toHaveBeenCalledTimes(1);
      expect(submit.mock.calls[0]?.[0]).toBe(path);
      expect(JSON.stringify(submit.mock.calls[0]?.[1])).toBe(wire);
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(host.textContent).toMatch(/已新建|已登记|已运行|已批准|已拒绝|已下达/u);
    },
  );

  it('requires an item choice and puts the server error inside the form', async () => {
    const submit = vi
      .fn<MrpConsolePorts['submit']>()
      .mockRejectedValue(new Error('Internal server error'));
    const { host } = setup({ submit });
    await open(host, 'create-policy');
    await formValues(host, { makeOrBuy: 'BUY', effectiveAt: '2026-11-01' });
    await submitForm(host);
    expect(element(host, '.form-section [role="alert"]').textContent).toContain('请选择物料版本');
    expect(submit).not.toHaveBeenCalled();
    await formValues(host, { itemVersionId: 'component' });
    await submitForm(host);
    expect(element(host, '.form-section [role="alert"]').textContent).toContain(
      '服务器处理请求时出错',
    );
  });

  it('guards confirmed writes and refreshes the open proposal and latest batch total', async () => {
    let settle: (value: null) => void = () => undefined;
    const submit = vi.fn<MrpConsolePorts['submit']>(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    const approved = row('APPROVED');
    const refresh = vi.fn<MrpConsolePorts['refresh']>().mockResolvedValue(snapshot(approved));
    const loadRunDetail = vi
      .fn<MrpConsolePorts['loadRunDetail']>()
      .mockResolvedValueOnce({ proposals: [row()] })
      .mockResolvedValue({ proposals: [approved] });
    const { host } = setup({ submit, refresh, loadRunDetail });
    await flush();
    await open(host, 'open');
    expect(byId(host, 'formula').textContent).toContain('净需求 628.75');
    expect(byId(host, 'formula').textContent).toContain('按批量取整为 1000');
    expect(byId(host, 'freeze-warning').textContent).toContain('冻结窗口内');
    expect(host.querySelectorAll('[data-testid="kt-mrp-proposal-sku"]')).toHaveLength(1);
    await open(host, 'detail-approve');
    await formValues(host, { reason: '核对', approval: 'EV', freezeOverrideApproval: 'FREEZE' });
    await submitForm(host);
    await confirm(host, '确认批准');
    await submitForm(host);
    expect(host.querySelector('.confirm-dialog')).toBeNull();
    expect(submit).toHaveBeenCalledTimes(1);
    settle(null);
    await flush();
    expect(byId(host, 'detail-release').textContent).toBe('下达');
    expect(byId(host, 'summary').textContent).toContain('已审批 1');
    expect(byId(host, 'detail').textContent).toContain('已审批');
  });

  it('keeps a saved approval when the batch list fails to refresh', async () => {
    const approved = row('APPROVED');
    const refresh = vi
      .fn<MrpConsolePorts['refresh']>()
      .mockRejectedValue(new Error('批次列表刷新失败'));
    const loadRunDetail = vi
      .fn<MrpConsolePorts['loadRunDetail']>()
      .mockResolvedValueOnce({ proposals: [row()] })
      .mockResolvedValue({ proposals: [approved] });
    const fetchProposals = vi
      .fn<MrpConsolePorts['fetchProposals']>()
      .mockResolvedValueOnce({ items: [row()], nextCursor: null })
      .mockResolvedValue({ items: [approved], nextCursor: null });
    const { host, submit } = setup({ refresh, loadRunDetail, fetchProposals });
    await flush();
    await open(host, 'open');
    await open(host, 'detail-approve');
    await formValues(host, { reason: '核对', approval: 'EV', freezeOverrideApproval: 'FREEZE' });
    await submitForm(host);
    await confirm(host, '确认批准');
    expect(submit).toHaveBeenCalledTimes(1);
    expect(byId(host, 'detail').textContent).toContain('已审批');
    expect(byId(host, 'detail-release').textContent).toBe('下达');
    expect(host.querySelector('[data-testid="kt-mrp-detail-approve"]')).toBeNull();
    expect(byId(host, 'refresh-error').textContent).toContain('批次列表刷新失败');
    expect(element(host, '.console-notice').textContent).toContain('已批准');
  });

  it('avoids unavailable proposal requests and hides write actions for policy readers', async () => {
    const { host, fetchProposals } = setup({
      permissions: new Set(['mrp-policy:read']),
      initial: { policies: [], demands: null, runs: null },
    });
    await flush();
    expect(byId(host, 'tab-policies').getAttribute('aria-selected')).toBe('true');
    expect(host.querySelector('[data-testid="kt-mrp-create-policy"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-mrp-run"]')).toBeNull();
    await open(host, 'tab-proposals');
    expect(byId(host, 'unreadable').textContent).toContain('mrp:read');
    expect(fetchProposals).not.toHaveBeenCalled();
  });

  it('switches batch, applies filters and uses the current cursor', async () => {
    const page = { items: [row()], nextCursor: 'next' };
    const fetchProposals = vi.fn<MrpConsolePorts['fetchProposals']>().mockResolvedValue(page);
    const { host } = setup({ fetchProposals });
    await flush();
    await open(host, 'filter-override');
    expect(fetchProposals).toHaveBeenLastCalledWith({
      runId: 'latest',
      freezeOverride: true,
      limit: 50,
    });
    const search = byId(host, 'search');
    search.value = 'COMPONENT';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    await open(host, 'search-submit');
    expect(fetchProposals).toHaveBeenLastCalledWith({
      runId: 'latest',
      freezeOverride: true,
      query: 'COMPONENT',
      limit: 50,
    });
    element(host, '.data-table-footer button').click();
    await flush();
    expect(fetchProposals).toHaveBeenLastCalledWith({
      runId: 'latest',
      freezeOverride: true,
      query: 'COMPONENT',
      limit: 50,
      cursor: 'next',
    });
    await open(host, 'tab-runs');
    const buttons = host.querySelectorAll('[data-testid="kt-mrp-run-proposals"]') as TestElement[];
    buttons[1]?.click();
    await flush();
    expect(fetchProposals).toHaveBeenLastCalledWith({
      runId: 'old',
      freezeOverride: true,
      query: 'COMPONENT',
      limit: 50,
    });
    expect(byId(host, 'run-heading').textContent).toBe('RUN-1 · 已计算');
  });
});

it('retains only relevant demand paths, with per-level rounding and distinct snapshot keys', () => {
  const edge = (parent: string, component: string, outputQuantity: number) => ({
    parentItemVersionId: parent,
    componentItemVersionId: component,
    outputQuantity,
    quantity: 1,
    scrapBasisPoints: 0,
    lineNumber: 1,
  });
  const demand = (id: string) => ({
    id,
    item_version_id: 'parent',
    quantity: 1,
    required_at: '2026-12-01',
  });
  const tree = explanationOf(
    {
      bomEdges: [
        edge('parent', 'middle', 3),
        { ...edge('parent', 'other', 1), lineNumber: 2 },
        edge('middle', 'component', 2),
        edge('component', 'parent', 1),
      ],
      demandSnapshots: [demand('d1'), demand('d2'), { ...demand('d3'), required_at: '2026-12-02' }],
    },
    row(),
  );
  expect(tree.map((node) => node.key)).toEqual(['d1', 'd2']);
  expect(tree[0]?.children.map((node) => node.itemVersionId)).toEqual(['middle']);
  expect(tree[0]?.children[0]?.quantity).toBe(0.333333);
  expect(tree[0]?.children[0]?.children[0]).toMatchObject({
    target: true,
    level: 2,
    quantity: 0.166667,
    children: [],
  });
});
