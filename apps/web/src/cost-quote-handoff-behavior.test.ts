import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { openForm } from './shared/forms';
import { createCostQuoteButton } from './commercial/cost-matrix-detail';
import type { CostDetailContext } from './commercial/pricing-view-ports';
import { createBehaviorElement, htmlElement } from '../test/fixtures/behavior-dom';

vi.mock('./shared/forms', () => ({ openForm: vi.fn() }));
const form = vi.mocked(openForm);
const unused = (): never => {
  throw new Error('Unexpected cost port');
};
function setup(permissions = ['quote:read', 'quote:create']) {
  const workspace = htmlElement(createBehaviorElement('main'));
  Object.defineProperty(workspace, 'isConnected', { value: true, writable: true });
  const refreshed = htmlElement(createBehaviorElement('main'));
  Object.defineProperty(refreshed, 'isConnected', { value: true });
  const create = vi.fn();
  Object.defineProperty(refreshed, 'querySelector', {
    value: vi.fn((selector: string) => {
      expect(selector).toBe('[data-create-quote]');
      return { click: create };
    }),
  });
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  const submit = vi.fn(() => {
    context.controller.revisionState = { costDecisionId: 'decision-1' };
    return Promise.resolve();
  });
  const prepareQuoteRoute = vi.fn<(isCurrent: () => boolean) => Promise<boolean>>((isCurrent) =>
    Promise.resolve(isCurrent()),
  );
  const rebuildWorkspace = vi.fn(() => refreshed);
  const replaceRouteView = vi.fn();
  // Named variable permits testing the future narrow port against the old implementation (RED).
  const ports = {
    textValue: (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback),
    recordValue: unused,
    displayTime: unused,
    currencyLabel: unused,
    decimalValue: unused,
    printIssuedQuote: unused,
    costMatrixAuditLabel: unused,
    costMatrixRoleGuidance: unused,
    replaceRouteView,
    rebuildWorkspace,
    prepareQuoteRoute,
  };
  const context: CostDetailContext = {
    workspace,
    status: htmlElement(createBehaviorElement('p')),
    permissions: new Set(permissions),
    ports,
    controller: {
      views: new Map(),
      message: 'before',
      revisionState: null,
      preferredQuoteCostDecisionId: '',
      selectedCostMatrixId: 'matrix-1',
      costMatrixQuery: {
        page: 1,
        pageSize: 20,
        query: '',
        productFamily: '',
        attention: 'ALL',
        sort: 'ATTENTION',
      },
      costMatrixTotal: 1,
      costMatrixDetails: new Map(),
      submit,
      load: unused,
      loadCostMatrixPage: vi.fn(() => Promise.resolve(true)),
      refreshSelectedCostMatrix: vi.fn(() => Promise.resolve()),
      openCostMatrix: unused,
      closeCostMatrix: unused,
      refreshViews: vi.fn(() => Promise.resolve()),
      quoteCommand: unused,
    },
    itemVersions: [],
    categoryOptions: [],
    sourceOptions: [],
    unitOptions: [],
    costPanel: workspace,
    models: [],
    publishedModels: [{ id: 'model-1' }],
    solutions: [{ id: 'solution-1' }],
    matrices: [],
    matrixSection: workspace,
    costDialogHost: () => workspace,
    setCostStatus: unused,
    replaceCostMatrixSection: unused,
    refreshCostWorkspace: unused,
    openMatrix: unused,
    factorFields: unused,
    selectedId: 'matrix-1',
    selectedMatrix: { id: 'matrix-1', name: '模型甲' },
    latest: { id: 'calculation-1' },
    factors: [],
    calculations: [],
    auditTrail: [],
  };
  const run = () => {
    createCostQuoteButton(context).click();
    const call = form.mock.calls.at(-1);
    if (!call) throw new Error('Cost form missing');
    return call[5]({ technicalSolutionRevisionId: 'solution-1', modelVersionId: 'model-1' });
  };
  return {
    context,
    workspace,
    submit,
    prepareQuoteRoute,
    rebuildWorkspace,
    replaceRouteView,
    create,
    frames,
    run,
  };
}
beforeEach(() => {
  form.mockClear();
  vi.stubGlobal('document', { createElement: createBehaviorElement });
  vi.stubGlobal('location', { hash: '#/costing' });
});
afterEach(() => vi.unstubAllGlobals());

it('waits for cold quote dependencies before publishing success and opening the preselected dialog', async () => {
  const f = setup();
  let finish: (ready: boolean) => void = unused;
  f.prepareQuoteRoute.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  const pending = f.run();
  await vi.waitFor(() => {
    expect(f.prepareQuoteRoute).toHaveBeenCalledOnce();
  });
  expect(f.submit).toHaveBeenCalledWith(
    '/api/v1/cost-matrix-calculations/calculation-1/quote-cost-decision',
    {
      technicalSolutionRevisionId: 'solution-1',
      modelVersionId: 'model-1',
    },
  );
  expect(f.context.controller.preferredQuoteCostDecisionId).toBe('decision-1');
  expect(f.context.controller.message).toBe('before');
  expect(f.rebuildWorkspace).not.toHaveBeenCalled();
  expect(globalThis.location.hash).toBe('#/costing');
  // A real route read used to overwrite the cue. Publish it only after that read finishes.
  f.context.controller.message = '已加载 0 个商机';
  finish(true);
  await pending;
  expect(f.context.controller.message).toBe('模型甲已形成报价成本快照，正在进入销售报价');
  expect(f.replaceRouteView).toHaveBeenCalledOnce();
  expect(globalThis.location.hash).toBe('#/quotes');
  expect(f.create).not.toHaveBeenCalled();
  f.frames[0]?.(0);
  expect(f.create).toHaveBeenCalledOnce();
});

it.each(['route', 'workspace'] as const)(
  'does not publish or navigate a cancelled %s handoff',
  async (reason) => {
    const f = setup();
    f.prepareQuoteRoute.mockImplementationOnce(() => {
      if (reason === 'route') globalThis.location.hash = '#/contracts';
      if (reason === 'workspace')
        Object.defineProperty(f.workspace, 'isConnected', { value: false });
      return Promise.resolve(true);
    });
    await f.run();
    expect(f.prepareQuoteRoute).toHaveBeenCalledOnce();
    expect(f.context.controller.message).toBe('before');
    expect(f.rebuildWorkspace).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
    expect(globalThis.location.hash).toBe(reason === 'route' ? '#/contracts' : '#/costing');
  },
);

it.each([[], ['quote:read'], ['quote:create']].map((permissions) => [permissions]))(
  'keeps the no-quote-permission completion without route preparation (%j)',
  async (permissions) => {
    const f = setup(permissions);
    await f.run();
    expect(f.prepareQuoteRoute).not.toHaveBeenCalled();
    expect(f.context.controller.message).toBe('模型甲已进入报价成本池，等待报价编制专员处理');
    expect(f.rebuildWorkspace).toHaveBeenCalledOnce();
    expect(globalThis.location.hash).toBe('#/costing');
    expect(f.frames).toHaveLength(0);
  },
);

it.each(['error', 'throw'] as const)(
  'keeps the frozen decision without resubmission after quote preparation %s',
  async (failure) => {
    const f = setup();
    f.prepareQuoteRoute.mockImplementationOnce(() => {
      if (failure === 'throw') return Promise.reject(new Error('offline'));
      return Promise.resolve(false);
    });
    await expect(f.run()).resolves.toBeUndefined();
    expect(f.submit).toHaveBeenCalledOnce();
    expect(f.context.controller.preferredQuoteCostDecisionId).toBe('decision-1');
    expect(f.context.controller.message).toBe(
      '模型甲已进入报价成本池，销售报价暂不可用，请稍后重试',
    );
    expect(f.rebuildWorkspace).toHaveBeenCalledOnce();
    expect(f.create).not.toHaveBeenCalled();
    expect(globalThis.location.hash).toBe('#/costing');
  },
);
