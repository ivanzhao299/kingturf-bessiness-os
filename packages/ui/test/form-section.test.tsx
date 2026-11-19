import { describe, expect, it } from 'vitest';
import { FormSection, type FormSectionField } from '../src/form-section';
import { asElement, flush, mount, mountDom } from './render';
import type { TestElement } from './dom';

const fields: readonly FormSectionField[] = [
  { name: 'displayName', label: '姓名', required: true, maxLength: 40, hint: '中英文均可' },
  { name: 'loginEmail', label: '登录邮箱', type: 'email', required: true },
  { name: 'quota', label: '配额', type: 'number', min: 1, max: 100 },
  { name: 'remark', label: '备注', maxLength: 10 },
];

const submitButton = (host: ReturnType<typeof mountDom>): TestElement =>
  asElement(host.container.querySelector('button[type="submit"]'));

const fieldControl = (host: ReturnType<typeof mountDom>, name: string): TestElement =>
  asElement(host.container.querySelector(`[name="${name}"]`));

describe('FormSection（兼容 shared/forms.ts 校验语义）', () => {
  it('renders labels, required marks, hints and control metadata', () => {
    const host = mountDom();
    mount(
      <FormSection
        title="开通身份"
        fields={fields}
        submitLabel="开通"
        onSubmit={() => undefined}
      />,
      host,
    );
    const section = asElement(host.container.querySelector('.form-section'));
    expect(section.querySelector('h3')?.textContent).toBe('开通身份');
    const nameControl = fieldControl(host, 'displayName');
    expect(nameControl.getAttribute('aria-required')).toBe('true');
    expect(nameControl.maxLength).toBe(40);
    expect(asElement(section.querySelector('.field-hint')).textContent).toBe('中英文均可');
    expect(asElement(section.querySelector('.required-mark')).textContent).toBe('必填');
    expect(submitButton(host).textContent).toBe('开通');
  });

  it('blocks submit and surfaces required/maxLength violations with aria-invalid semantics', async () => {
    const host = mountDom();
    const submitted: string[] = [];
    mount(
      <FormSection
        title="开通身份"
        fields={fields}
        submitLabel="开通"
        onSubmit={(values) => {
          submitted.push(values.displayName ?? '');
        }}
      />,
      host,
    );
    submitButton(host).click();
    await flush();
    const error = host.container.querySelector('[role="alert"]');
    expect(error?.textContent ?? '').toContain('姓名');
    expect(fieldControl(host, 'displayName').getAttribute('aria-invalid')).toBe('true');
    expect(submitted).toEqual([]);
    const remark = fieldControl(host, 'remark');
    remark.value = '超过十个字符的备注内容';
    remark.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
    submitButton(host).click();
    await Promise.resolve();
    expect(remark.getAttribute('aria-invalid')).toBe('true');
  });

  it('revalidates on input and clears the invalid state (dirty 语义)', async () => {
    const host = mountDom();
    mount(
      <FormSection
        title="开通身份"
        fields={fields}
        submitLabel="开通"
        onSubmit={() => undefined}
      />,
      host,
    );
    submitButton(host).click();
    await Promise.resolve();
    const name = fieldControl(host, 'displayName');
    expect(name.getAttribute('aria-invalid')).toBe('true');
    name.value = '王小明';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
    expect(name.hasAttribute('aria-invalid')).toBe(false);
  });

  it('validates email format and numeric range like the legacy engine', async () => {
    const host = mountDom();
    mount(
      <FormSection
        title="开通身份"
        fields={fields}
        submitLabel="开通"
        onSubmit={() => undefined}
      />,
      host,
    );
    const email = fieldControl(host, 'loginEmail');
    email.value = 'not-an-email';
    email.dispatchEvent(new Event('input', { bubbles: true }));
    const quota = fieldControl(host, 'quota');
    quota.value = '300';
    quota.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    submitButton(host).click();
    await flush();
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(quota.getAttribute('aria-invalid')).toBe('true');
  });

  it('submits collected values only when every field is valid', async () => {
    const host = mountDom();
    const received: Readonly<Record<string, string>>[] = [];
    mount(
      <FormSection
        title="开通身份"
        fields={fields}
        submitLabel="开通"
        onSubmit={(values) => {
          received.push(values);
        }}
      />,
      host,
    );
    for (const [name, value] of [
      ['displayName', '王小明'],
      ['loginEmail', 'wang@example.com'],
      ['quota', '10'],
    ] as const) {
      const control = fieldControl(host, name);
      control.value = value;
      control.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await flush();
    submitButton(host).click();
    await flush();
    expect(received).toEqual([
      { displayName: '王小明', loginEmail: 'wang@example.com', quota: '10', remark: '' },
    ]);
    expect(host.container.querySelector('[role="alert"]')?.textContent ?? '').toBe('');
  });

  it('requires explicit confirmation for sensitive submit labels（敏感词语义）', async () => {
    const host = mountDom();
    const submitted: string[] = [];
    mount(
      <FormSection
        title="停用账号"
        fields={fields}
        submitLabel="停用条目"
        onSubmit={() => {
          submitted.push('done');
        }}
      />,
      host,
    );
    for (const [name, value] of [
      ['displayName', '王小明'],
      ['loginEmail', 'wang@example.com'],
    ] as const) {
      const control = fieldControl(host, name);
      control.value = value;
      control.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await flush();
    submitButton(host).click();
    await flush();
    expect(submitted).toEqual([]);
    expect(host.container.querySelector('[role="alert"]')?.textContent ?? '').toContain('确认');
    const confirm = asElement(host.container.querySelector('[data-confirmation]'));
    confirm.click();
    await flush();
    submitButton(host).click();
    await flush();
    expect(submitted).toEqual(['done']);
  });
});
