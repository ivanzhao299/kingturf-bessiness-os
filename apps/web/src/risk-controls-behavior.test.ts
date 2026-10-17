import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openForm } from './shared/forms';
import {
  appendOrderRiskEvaluation,
  createOrderRiskPolicyCard,
  createRiskPolicyButton,
} from './commercial/order360-risk-controls';
import type { FulfillmentViewContext } from './commercial/fulfillment-view-ports';
import type { CommercialPermission } from './commercial/permissions';
import {
  createBehaviorElement,
  findElement,
  flushBehaviorPromises,
  htmlElement,
} from '../test/fixtures/behavior-dom';
vi.mock('./shared/forms', () => ({ openForm: vi.fn() }));
const form = vi.mocked(openForm);
const unused = (): never => {
  throw new Error('Unexpected fulfillment port');
};
const textValue = (value: unknown, fallback: string) =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;
const rules = [
  { code: 'LOW_MARGIN' },
  { code: 'OVERDUE_AR' },
  { code: 'CREDIT_EXPIRY' },
  { code: 'CONTRACT_SIGNATURE' },
  { code: 'ORDER_RELEASE_GATE' },
];
const policy = {
  id: 'version-1',
  policy_id: 'policy-1',
  code: 'RISK-1',
  version: 2,
  status: 'PUBLISHED',
  minimum_margin_basis_points: 2555,
  overdue_grace_days: 3,
  credit_warning_days: 15,
};
const setup = (permissions: readonly CommercialPermission[] = []) => {
  const workspace = createBehaviorElement('main'),
    status = createBehaviorElement('p');
  status.textContent = 'before';
  const submit = vi.fn<FulfillmentViewContext['controller']['submit']>(() => Promise.resolve());
  const load = vi.fn(() => Promise.resolve());
  const context: FulfillmentViewContext = {
    workspace: htmlElement(workspace),
    status: htmlElement(status),
    permissions: new Set(permissions),
    controller: {
      opportunities: [],
      views: new Map(),
      message: 'loaded',
      submit,
      load,
      employees: [{ id: 'employee-1', displayName: '员工甲' }],
      loadOrder360: unused,
    },
    ports: {
      recordValue: unused,
      recordText: (record, camel, snake, fallback = '') =>
        textValue(record[camel] ?? record[snake], fallback),
      textValue,
      displayMoney: unused,
      decimalValue: unused,
      inventoryLocationOption: unused,
      businessStateLabel: unused,
      operationsNextAction: unused,
      shipmentGateLabel: unused,
      businessEventLabel: unused,
      businessEventDetailLabel: unused,
    },
  };
  const click = (text: string) => {
    findElement(
      workspace,
      (node) => node.tagName === 'BUTTON' && node.textContent === text,
    ).click();
    const call = form.mock.calls.at(-1);
    if (!call) throw new Error('Risk form missing');
    return { fields: call[3], run: call[5] };
  };
  return { context, workspace, status, submit, load, click };
};
beforeEach(() => {
  form.mockClear();
  vi.stubGlobal('document', { createElement: createBehaviorElement });
});
afterEach(() => vi.unstubAllGlobals());

describe('risk policy and order risk control callback contracts', () => {
  it('creates policy with numeric thresholds, fixed rules and UTC start of effective date', async () => {
    const f = setup();
    // Factory is not a permission guard; caller permission rendering is outside this test.
    htmlElement(f.workspace).append(createRiskPolicyButton(f.context));
    const opened = f.click('＋ 新建风险政策');
    expect(opened.fields.find((field) => field.name === 'minimumMarginBasisPoints')?.value).toBe(
      '2500',
    );
    await opened.run({
      code: 'RISK-NEW',
      name: '风险政策',
      minimumMarginBasisPoints: '2555',
      overdueGraceDays: '3',
      creditWarningDays: '15',
      effectiveAt: '2026-10-17',
    });
    expect(f.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/risk-policies', {
      code: 'RISK-NEW',
      name: '风险政策',
      minimumMarginBasisPoints: 2555,
      overdueGraceDays: 3,
      creditWarningDays: 15,
      effectiveAt: '2026-10-17T00:00:00.000Z',
      rules,
      publish: true,
    });
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.status.textContent).toBe('loaded');
    await expect(opened.run({ effectiveAt: 'invalid' })).rejects.toThrow(RangeError);
    expect(f.submit).toHaveBeenCalledTimes(1);
    f.status.textContent = 'unchanged';
    f.submit.mockRejectedValueOnce(new Error('create rejected'));
    await expect(opened.run({ effectiveAt: '2026-10-17' })).rejects.toThrow('create rejected');
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.status.textContent).toBe('unchanged');
  });

  it('gates publish/revision by state and permission and publishes exact version only before reload', async () => {
    for (const state of ['DRAFT', 'PUBLISHED', 'RETIRED']) {
      const denied = setup();
      const card = createOrderRiskPolicyCard(
        denied.context,
        { ...policy, status: state },
        () => '25.55',
      );
      htmlElement(denied.workspace).append(card);
      expect(denied.workspace.descendants().filter((node) => node.tagName === 'BUTTON')).toEqual(
        [],
      );
    }
    const f = setup(['risk-policy:manage']);
    const card = createOrderRiskPolicyCard(
      f.context,
      { ...policy, status: 'DRAFT' },
      () => '25.55',
    );
    htmlElement(f.workspace).append(card);
    let finish: () => void = unused;
    f.submit.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    findElement(
      f.workspace,
      (node) => node.tagName === 'BUTTON' && node.textContent === '发布版本',
    ).click();
    expect(f.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/risk-policy-versions/version-1/publish',
      {},
    );
    expect(f.load).not.toHaveBeenCalled();
    finish();
    await flushBehaviorPromises();
    expect(f.load).toHaveBeenCalledTimes(1);
  });

  it('revises published root with snake-case prefills, fixed rules and without implicit publish', async () => {
    const f = setup(['risk-policy:manage']);
    const percent = vi.fn(() => '25.55');
    htmlElement(f.workspace).append(createOrderRiskPolicyCard(f.context, policy, percent));
    expect(percent).toHaveBeenCalledExactlyOnceWith('2555');
    expect(f.workspace.textContent).toContain('毛利门槛 25.55% · 逾期宽限 3 天 · 信用预警 15 天');
    const opened = f.click('创建新版本');
    expect(opened.fields.slice(0, 3).map((field) => field.value)).toEqual(['2555', '3', '15']);
    await opened.run({
      minimumMarginBasisPoints: '2600',
      overdueGraceDays: '4',
      creditWarningDays: '16',
      effectiveAt: '2026-10-18',
    });
    expect(f.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/risk-policies/policy-1/versions', {
      minimumMarginBasisPoints: 2600,
      overdueGraceDays: 4,
      creditWarningDays: 16,
      effectiveAt: '2026-10-18T00:00:00.000Z',
      rules,
    });
    expect(f.load).toHaveBeenCalledTimes(1);
    f.status.textContent = 'unchanged';
    f.submit.mockRejectedValueOnce(new Error('revision rejected'));
    await expect(opened.run({ effectiveAt: '2026-10-18' })).rejects.toThrow('revision rejected');
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.status.textContent).toBe('unchanged');
  });

  it.each([
    [[], [], [policy]],
    [['risk:evaluate'], [], [policy]],
    [['risk:evaluate'], [{ id: 'order-1' }], []],
  ] as const)(
    'requires permission and nonempty input collections (%j)',
    (permissions, orders, policies) => {
      const f = setup(permissions);
      appendOrderRiskEvaluation(f.context, orders, policies, htmlElement(f.workspace));
      expect(f.workspace.children).toEqual([]);
      expect(form).not.toHaveBeenCalled();
    },
  );

  it('pins only published options and employee, uses UTC end-of-date and waits for current load message', async () => {
    const f = setup(['risk:evaluate']);
    appendOrderRiskEvaluation(
      f.context,
      [{ id: 'order-1', order_number: 'SO-1' }],
      [{ ...policy, status: 'DRAFT' }, policy],
      htmlElement(f.workspace),
    );
    const opened = f.click('运行订单风险评价');
    expect(opened.fields[0]?.options).toEqual([{ value: 'order-1', label: 'SO-1' }]);
    expect(opened.fields[1]?.options).toEqual([{ value: 'version-1', label: 'RISK-1 第 2 版' }]);
    expect(opened.fields[2]?.options).toEqual([{ value: 'employee-1', label: '员工甲' }]);
    const values = {
      salesOrderId: 'order-1',
      policyVersionId: 'version-1',
      assigneeEmployeeId: 'employee-1',
      validUntil: '2026-10-18',
      dueAt: '2026-10-19',
    };
    let finish: () => void = unused;
    f.load.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = opened.run(values);
    expect(f.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/risk-evaluations', {
      salesOrderId: 'order-1',
      policyVersionId: 'version-1',
      assigneeEmployeeId: 'employee-1',
      validUntil: '2026-10-18T23:59:59.000Z',
      dueAt: '2026-10-19T23:59:59.000Z',
    });
    await Promise.resolve();
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.status.textContent).toBe('before');
    f.context.controller.message = 'risk loaded';
    finish();
    await pending;
    expect(f.status.textContent).toBe('risk loaded');
    await expect(opened.run({ ...values, dueAt: 'invalid' })).rejects.toThrow(RangeError);
    expect(f.submit).toHaveBeenCalledTimes(1);
    f.status.textContent = 'unchanged';
    f.submit.mockRejectedValueOnce(new Error('evaluation rejected'));
    await expect(opened.run(values)).rejects.toThrow('evaluation rejected');
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.status.textContent).toBe('unchanged');
  });
});
