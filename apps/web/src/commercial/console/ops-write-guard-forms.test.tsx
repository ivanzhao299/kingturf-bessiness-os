// TD-OPS-007（2026-11-26 项目所有者裁定，沿用现值）：投诉描述的界面侧口径。
// 用真实 FormSection 挂载表单配置：不足 10 个字符被表单自己拦下并给出中文提示，恰好 10 个字符
// 去首尾空白后发出。
import { act } from 'preact/test-utils';
import { expect, it } from 'vitest';
import { h, render } from 'preact';
import { FormSection } from '@kingturf/ui';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { operationsContext } from '../../../test/fixtures/operations-context';
import { complaintCreate } from './complaint-forms';
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
