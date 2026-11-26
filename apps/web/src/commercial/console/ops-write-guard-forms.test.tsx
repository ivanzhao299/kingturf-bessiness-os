// TD-OPS-006 / TD-OPS-007（2026-11-26 项目所有者裁定）：质量与投诉表单对「留空」与「过短」的界面侧口径。
// 用真实 FormSection 挂载表单配置：留空的可空字段不触发必填提示、提交能到达 onSubmit，载荷里
// 留空字段是空串；投诉描述不足 10 个字符被表单自己拦下并给出中文提示。
import { act } from 'preact/test-utils';
import { expect, it } from 'vitest';
import { h, render } from 'preact';
import { FormSection } from '@kingturf/ui';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { operationsContext } from '../../../test/fixtures/operations-context';
import { complaintCreate, complaintNcr } from './complaint-forms';
import { newQualityPlan, qualityResult } from './quality-forms';
import { trimOpsValues, type OpsForm } from './ops-form';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
type Values = Readonly<Record<string, string>>;
type Attempt = Readonly<{ submitted: Values | null; alert: string }>;

/** 挂载表单配置，填入给定值（未给出的字段保持留空）后点提交，返回回调收到的值与提示区文字。 */
const attempt = async (form: OpsForm, values: Values = {}): Promise<Attempt> => {
  const host = installGlobalTestDom().document.createElement('div');
  let submitted: Values | null = null;
  render(
    h(FormSection, {
      title: form.title,
      submitLabel: '提交',
      fields: form.fields,
      onSubmit: (next: Values) => {
        submitted = next;
      },
    }),
    host,
  );
  await act(async () => {
    await tick();
  });
  for (const [name, value] of Object.entries(values)) {
    const control = host.querySelector(`[name="${name}"]`) as TestElement | null;
    if (!control) throw new Error(`missing control ${name}`);
    control.value = value;
    control.dispatchEvent(new Event('input', { bubbles: true }));
    await act(async () => {
      await tick();
    });
  }
  (host.querySelector('button[type="submit"]') as TestElement).click();
  await act(async () => {
    await tick();
  });
  const alert = host.querySelector('form.form-section [role="alert"]');
  return { submitted, alert: alert?.textContent ?? '' };
};
const fieldNamed = (form: OpsForm, name: string) =>
  form.fields.find((field) => field.name === name);
const required: Values = {
  code: 'QP-2',
  name: '计划',
  itemVersionId: 'item',
  inspectionStage: 'FINAL',
  effectiveAt: '2026-11-26T12:00:00.000Z',
  characteristicCode: 'LENGTH',
  characteristicName: '长度',
};
const resultRequired: Values = { characteristicId: 'length', idempotencyKey: 'K-2' };
const ncrRequired: Values = {
  ncrNumber: 'NCR-1',
  defectType: '起球',
  affectedScope: '单批两卷',
  investigatorId: 'employee-1',
  evidenceReference: 'E-1',
};

it('TD-OPS-006: blank limits, result notes and temporary containment are optional and leave as empty strings', async () => {
  const { context } = operationsContext();
  const plan = newQualityPlan([]);
  const result = qualityResult('inspection', [], () => new Date('2026-11-26T12:00:00.000Z'));
  const ncr = complaintNcr(context, { version: 3 }, 'complaint-1');
  const cases = [
    { form: plan, blanks: ['lowerLimit', 'upperLimit'], values: required },
    { form: result, blanks: ['notes'], values: resultRequired },
    { form: ncr, blanks: ['temporaryContainment'], values: ncrRequired },
  ] as const;
  for (const { form, blanks, values } of cases) {
    for (const name of blanks) expect(fieldNamed(form, name)?.required).not.toBe(true);
    const outcome = await attempt(form, values);
    expect(outcome.alert).toBe('');
    if (!outcome.submitted) throw new Error(`submit did not reach onSubmit: ${form.title}`);
    for (const name of blanks) expect(outcome.submitted[name]).toBe('');
    // 留空字段在载荷里是空串（不是 null、也不是缺键）——与真库用例的请求体同一形态。
    const [, body] = form.payload(trimOpsValues(outcome.submitted));
    for (const name of blanks) {
      const rows = body.characteristics as readonly Record<string, unknown>[] | undefined;
      const raw = rows?.[0] ?? body;
      expect(JSON.stringify(raw[name])).toBe('""');
    }
  }
  expect(
    JSON.stringify(
      plan.payload(
        trimOpsValues({
          ...required,
          samplingMethod: '全检',
          acceptanceRule: '全部必检项通过',
          lowerLimit: '',
          upperLimit: '',
        }),
      ),
    ),
  ).toBe(
    '["/api/v1/quality-plans",{"code":"QP-2","name":"计划","itemVersionId":"item","inspectionStage":"FINAL","samplingMethod":"全检","acceptanceRule":{"description":"全部必检项通过"},"effectiveAt":"2026-11-26T12:00:00.000Z","characteristics":[{"code":"LENGTH","name":"长度","dataType":"NUMERIC","lowerLimit":"","upperLimit":"","required":true,"instructions":""}],"publish":true}]',
  );
  expect(
    JSON.stringify(
      result.payload(
        trimOpsValues({ ...resultRequired, measuredNumeric: '10.5', passed: 'true', notes: '' }),
      ),
    ),
  ).toBe(
    '["/api/v1/quality-inspections/inspection/results",{"characteristicId":"length","measuredNumeric":"10.5","passed":true,"notes":"","occurredAt":"2026-11-26T12:00:00.000Z","idempotencyKey":"K-2"}]',
  );
  expect(
    JSON.stringify(
      ncr.payload(
        trimOpsValues({ ...ncrRequired, quarantinedQuantity: '0', temporaryContainment: '' }),
      ),
    ),
  ).toBe(
    '["/api/v1/complaints/complaint-1/ncrs",{"ncrNumber":"NCR-1","defectType":"起球","affectedScope":"单批两卷","investigatorId":"employee-1","quarantinedQuantity":"0","temporaryContainment":"","complaintExpectedVersion":3,"evidence":{"reference":"E-1"},"idempotencyKey":"CMP-FIXED-COMMAND-KEY"}]',
  );
});

it('TD-OPS-007: the complaint description states the 10-character minimum; 9 are blocked by the form, 10 are sent trimmed', async () => {
  const { context } = operationsContext();
  const form = complaintCreate(
    {
      ...context,
      controller: {
        ...context.controller,
        customers: [{ id: 'customer-1', name: '客户甲' }],
      },
    },
    [{ id: 'policy-1', severity: 'MAJOR', policyCode: 'STD', version: 1 }],
  );
  expect(fieldNamed(form, 'description')).toEqual({
    name: 'description',
    label: '问题描述',
    type: 'textarea',
    required: true,
    minLength: 10,
    hint: '至少 10 个字符，不计首尾空白。',
  });
  const values: Values = {
    complaintNumber: 'CMP-1',
    customerId: 'customer-1',
    slaPolicyVersionId: 'policy-1',
    channel: 'EMAIL',
    occurredAt: '2026-11-26T12:00:00.000Z',
    reportedAt: '2026-11-26T12:00:00.000Z',
    customerRequest: '请更换',
    customerReference: 'E-1',
  };
  const nine = await attempt(form, { ...values, description: '客户反映草坪有起球' });
  expect(nine.submitted).toBeNull();
  expect(nine.alert).toBe('问题描述至少 10 个字符');
  const ten = await attempt(form, { ...values, description: ' 客户反映新草坪有起球 ' });
  expect(ten.alert).toBe('');
  if (!ten.submitted) throw new Error('submit did not reach onSubmit');
  expect(JSON.stringify(form.payload(trimOpsValues(ten.submitted)))).toBe(
    '["/api/v1/complaints",{"complaintNumber":"CMP-1","customerId":"customer-1","slaPolicyVersionId":"policy-1","channel":"EMAIL","defectCategory":"OTHER","severity":"MAJOR","occurredAt":"2026-11-26T12:00:00.000Z","reportedAt":"2026-11-26T12:00:00.000Z","description":"客户反映新草坪有起球","customerRequest":"请更换","initialSnapshot":{"customerReference":"E-1"},"idempotencyKey":"CMP-FIXED-COMMAND-KEY"}]',
  );
});
