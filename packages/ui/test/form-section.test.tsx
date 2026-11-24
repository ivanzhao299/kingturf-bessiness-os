import { describe, expect, it } from 'vitest';
import { FormSection, type FormSectionField } from '../src/form-section';
import { asElement, flush, mount, mountDom } from './render';
import { TestEvent } from './dom';
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

  // 回归（TD-UI-009，写流程真浏览器冒烟发现）：数字输入框不写 step 时浏览器按步长 1 做原生校验，
  // 小数被拦下且 submit 事件根本不触发（工艺路线「单件工时」默认值 0.8 自己就过不了）。
  // 未指定 step 即 step="any"，指定的照常输出，非数字字段不输出（按真实 DOM 的 step 属性读取）。
  it('lets number fields take decimals unless a step is given（原生校验与手写校验同口径）', () => {
    const host = mountDom();
    mount(
      <FormSection
        title="工序"
        submitLabel="保存"
        fields={[
          { name: 'run', label: '单件工时（分钟）', type: 'number', value: '0.8' },
          { name: 'sequence', label: '序号', type: 'number', step: 10 },
          { name: 'due', label: '交期', type: 'date' },
          { name: 'note', label: '说明' },
        ]}
        onSubmit={() => undefined}
      />,
      host,
    );
    expect(fieldControl(host, 'run').step).toBe('any');
    expect(fieldControl(host, 'sequence').step).toBe('10');
    expect(fieldControl(host, 'due').step).toBe('');
    expect(fieldControl(host, 'note').step).toBe('');
  });

  // 回归（TD-WF-004，写流程真浏览器冒烟发现）：双击「创建线索」写入两条。提交未结算期间再次
  // 触发 submit（双击、回车、慢网下的重复点击）必须被同步拦下——不能只靠按钮置灰，因为 submit
  // 事件也可以由回车触发，且替身与真实浏览器一样不会因 disabled 自动吞掉事件。
  it('submits once while the previous submit is still pending（防重复提交）', async () => {
    const host = mountDom();
    let calls = 0;
    let release: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    mount(
      <FormSection
        title="创建线索"
        fields={[{ name: 'company', label: '公司名称', required: true, value: '金特夫' }]}
        submitLabel="创建线索"
        onSubmit={() => {
          calls += 1;
          return pending;
        }}
      />,
      host,
    );
    const form = host.container.querySelector('form');
    if (!form) throw new Error('form not rendered');
    const button = submitButton(host);
    const submit = (): void => {
      form.dispatchEvent(new TestEvent('submit'));
    };
    submit();
    submit();
    submit();
    // 结算前：按钮置灰并声明忙碌，再次触发不再调用 onSubmit。
    await flush();
    expect(calls).toBe(1);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    submit();
    expect(calls).toBe(1);
    release();
    // 结算发生在 Promise 的回调里：第一轮刷新让回调执行，第二轮让结算后的渲染落地。
    await flush();
    await flush();
    // 结算后：按钮恢复可点，之后的提交照常进行。
    expect(button.disabled).toBe(false);
    // Preact 对值为 false 的 ARIA 属性写入 "false" 而不是移除（对辅助技术是合法取值）。
    expect(button.getAttribute('aria-busy')).not.toBe('true');
    submit();
    expect(calls).toBe(2);
  });

  it('lets the form be submitted again after a failed submit（失败后可重试）', async () => {
    const host = mountDom();
    let calls = 0;
    mount(
      <FormSection
        title="创建线索"
        fields={[{ name: 'company', label: '公司名称', required: true, value: '金特夫' }]}
        submitLabel="创建线索"
        onSubmit={() => {
          calls += 1;
          return Promise.reject(new Error('网络错误'));
        }}
      />,
      host,
    );
    submitButton(host).click();
    await flush();
    expect(calls).toBe(1);
    expect(submitButton(host).disabled).toBe(false);
    submitButton(host).click();
    await flush();
    expect(calls).toBe(2);
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
