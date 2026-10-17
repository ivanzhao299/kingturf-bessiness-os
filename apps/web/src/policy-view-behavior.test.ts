import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openForm } from './shared/forms';
import { appendPolicyView } from './commercial/policy-view';
import type { PricingViewContext } from './commercial/pricing-view-ports';
import { createBehaviorElement, findElement, htmlElement } from '../test/fixtures/behavior-dom';

vi.mock('./shared/forms', () => ({ openForm: vi.fn() }));
const form = vi.mocked(openForm);
const unused = (): never => {
  throw new Error('Unexpected pricing port');
};
const textValue = (value: unknown, fallback: string) =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;
// Fixed rule oracle is independent of production percentage conversion.
const rules = [
  {
    when: {
      op: 'lt',
      left: { op: 'input', path: 'marginBasisPoints' },
      right: { op: 'literal', value: 2055 },
    },
    effect: { passed: false, approvalRequired: true, minimumMarginBasisPoints: 2055 },
    reason: '毛利率低于 20.55% 红线',
  },
  {
    when: {
      op: 'gt',
      left: { op: 'input', path: 'discountBasisPoints' },
      right: { op: 'literal', value: 1026 },
    },
    effect: { approvalRequired: true, maximumDiscountBasisPoints: 1026 },
    reason: '折扣超过 10.256% 上限',
  },
];
const setup = (
  permissions: readonly string[] = [],
  views = new Map<string, readonly Record<string, unknown>[]>(),
) => {
  const workspace = createBehaviorElement('main'),
    status = createBehaviorElement('p');
  status.textContent = 'before';
  const submit = vi.fn<PricingViewContext['controller']['submit']>(() => Promise.resolve());
  const load = vi.fn(() => Promise.resolve());
  const context: PricingViewContext = {
    workspace: htmlElement(workspace),
    status: htmlElement(status),
    permissions: new Set(permissions),
    controller: {
      views,
      message: 'loaded',
      revisionState: null,
      preferredQuoteCostDecisionId: '',
      selectedCostMatrixId: '',
      costMatrixQuery: {
        page: 1,
        pageSize: 20,
        query: '',
        productFamily: '',
        attention: 'ALL',
        sort: 'ATTENTION',
      },
      costMatrixTotal: 0,
      costMatrixDetails: new Map(),
      submit,
      load,
      loadCostMatrixPage: unused,
      refreshSelectedCostMatrix: unused,
      openCostMatrix: unused,
      closeCostMatrix: unused,
      refreshViews: unused,
      quoteCommand: unused,
    },
    ports: {
      textValue,
      recordValue: unused,
      displayTime: unused,
      currencyLabel: unused,
      decimalValue: unused,
      printIssuedQuote: unused,
      costMatrixAuditLabel: unused,
      costMatrixRoleGuidance: unused,
      replaceRouteView: unused,
      rebuildWorkspace: unused,
    },
  };
  const mount = () => {
    appendPolicyView(context);
  };
  const click = (text: string) => {
    findElement(
      workspace,
      (node) => node.tagName === 'BUTTON' && node.textContent === text,
    ).click();
    const call = form.mock.calls.at(-1);
    if (!call) throw new Error('Policy form missing');
    expect(call[0]).toBe(context.workspace);
    return { fields: call[3], run: call[5], title: call[1] };
  };
  return { context, workspace, status, submit, load, mount, click };
};
beforeEach(() => {
  form.mockClear();
  vi.stubGlobal('document', { createElement: createBehaviorElement });
});
afterEach(() => vi.unstubAllGlobals());
const published = {
  id: 'policy-v2',
  definitionId: 'definition-1',
  code: 'SP-1',
  name: '政策甲',
  version: 2,
  status: 'PUBLISHED',
  rules: [],
};

describe('sales policy real view callback contracts', () => {
  it('creates published fixed rules with independent basis-point rounding oracle and waits for load', async () => {
    const f = setup(['sales-policy:manage']);
    f.mount();
    const opened = f.click('新建销售政策');
    expect(opened.fields.find((field) => field.name === 'minimumMargin')?.value).toBe('20');
    expect(opened.fields.find((field) => field.name === 'maximumDiscount')?.value).toBe('10');
    let finish: () => void = unused;
    f.load.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = opened.run({
      code: 'SP-NEW',
      name: '新政策',
      minimumMargin: '20.55',
      maximumDiscount: '10.256',
    });
    expect(f.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/sales-policies', {
      code: 'SP-NEW',
      name: '新政策',
      rules,
      publish: true,
    });
    await Promise.resolve();
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.status.textContent).toBe('before');
    f.context.controller.message = 'new policy loaded';
    finish();
    await pending;
    expect(f.status.textContent).toBe('new policy loaded');
    f.status.textContent = 'unchanged';
    f.submit.mockRejectedValueOnce(new Error('policy rejected'));
    await expect(opened.run({})).rejects.toThrow('policy rejected');
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.status.textContent).toBe('unchanged');
  });

  it('revises only latest definition version and keeps immutable rule payload independent', async () => {
    const views = new Map([
      ['/api/v1/sales-policies', [published, { ...published, id: 'policy-v1', version: 1 }]],
    ]);
    const f = setup(['sales-policy:manage'], views);
    f.mount();
    expect(
      f.workspace
        .descendants()
        .filter((node) => node.tagName === 'BUTTON' && node.textContent === '新建政策版本'),
    ).toHaveLength(1);
    expect(
      findElement(
        f.workspace,
        (node) => node.tagName === 'BUTTON' && node.textContent === '新建政策版本',
      ).parentElement?.textContent,
    ).toContain('第 2 版');
    const opened = f.click('新建政策版本');
    expect(opened.title).toBe('修订 SP-1');
    await opened.run({ minimumMargin: '20.55', maximumDiscount: '10.256' });
    expect(f.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/sales-policies/definition-1/versions',
      { rules, publish: true },
    );
    expect(f.load).toHaveBeenCalledTimes(1);
    f.status.textContent = 'unchanged';
    f.submit.mockRejectedValueOnce(new Error('revision rejected'));
    await expect(opened.run({})).rejects.toThrow('revision rejected');
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.status.textContent).toBe('unchanged');
  });

  it.each([
    [[], [published], [{ id: 'cost-1' }]],
    [['sales-policy:evaluate'], [{ ...published, status: 'DRAFT' }], [{ id: 'cost-1' }]],
    [['sales-policy:evaluate'], [published], []],
  ] as const)(
    'gates evaluations with permission/published policy/cost availability (%j)',
    (permissions, policies, costs) => {
      const f = setup(
        permissions,
        new Map<string, readonly Record<string, unknown>[]>([
          ['/api/v1/sales-policies', policies],
          ['/api/v1/cost-evaluations', costs],
        ]),
      );
      f.mount();
      expect(f.workspace.descendants().filter((node) => node.tagName === 'BUTTON')).toEqual([]);
      expect(f.workspace.textContent).toContain('暂无销售政策评估结果。');
      expect(form).not.toHaveBeenCalled();
    },
  );

  it('evaluates pinned published policy and cost with fixed basis points and renders current decisions', async () => {
    const views = new Map<string, readonly Record<string, unknown>[]>([
      [
        '/api/v1/sales-policies',
        [{ ...published, id: 'draft-policy', status: 'DRAFT' }, published],
      ],
      ['/api/v1/cost-evaluations', [{ id: 'cost-123456789', currency: 'CNY', total: '125.50' }]],
      [
        '/api/v1/sales-policy-evaluations',
        [
          {
            passed: true,
            approvalRequired: false,
            policyVersionId: 'policy-v2-long',
            costDecisionId: 'cost-123456789',
            reasons: ['固定理由'],
            minimumMarginBasisPoints: 2055,
            maximumDiscountBasisPoints: 1026,
            inputHash: 'hash-fixed',
          },
          { passed: false, approvalRequired: true, reasons: null },
        ],
      ],
    ]);
    const f = setup(['sales-policy:evaluate'], views);
    f.mount();
    const opened = f.click('＋ 评估报价政策');
    expect(opened.fields[0]?.options).toEqual([{ value: 'policy-v2', label: 'SP-1 · 第 2 版' }]);
    expect(opened.fields[1]?.options).toEqual([
      { value: 'cost-123456789', label: 'CNY 125.50 · cost-123' },
    ]);
    await opened.run({
      policyVersionId: 'policy-v2',
      costDecisionId: 'cost-123456789',
      margin: '30.125',
      discount: '2.255',
    });
    expect(f.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/sales-policy-evaluations', {
      policyVersionId: 'policy-v2',
      costDecisionId: 'cost-123456789',
      context: { marginBasisPoints: 3013, discountBasisPoints: 226 },
    });
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.workspace.textContent).toContain('政策通过');
    expect(f.workspace.textContent).toContain('政策未通过');
    expect(f.workspace.textContent).toContain('无需额外审批');
    expect(f.workspace.textContent).toContain('需要人工审批');
    expect(f.workspace.textContent).toContain('最低毛利率 20.55% · 最大折扣 10.26%');
    expect(f.workspace.textContent).toContain('固定理由');
    expect(f.workspace.textContent).toContain('hash-fixed');
    f.status.textContent = 'unchanged';
    f.submit.mockRejectedValueOnce(new Error('evaluation rejected'));
    await expect(opened.run({})).rejects.toThrow('evaluation rejected');
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.status.textContent).toBe('unchanged');
  });
});
