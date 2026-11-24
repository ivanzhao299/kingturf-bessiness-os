import { describe, expect, it, vi } from 'vitest';
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

  // 回归（TD-WF-005，写流程真浏览器冒烟发现）：新建抽屉里服务端拒绝后没有任何提示——错误只写进
  // 调用方的状态，而新建抽屉没有错误位。调用方把提交错误经 error 传进来，它显示在表单自己的
  // 提示区（与校验提示同一个 role="alert"），不另开第二处。
  const harnessFields: readonly FormSectionField[] = [
    { name: 'company', label: '公司名称', required: true, value: '金特夫' },
  ];
  const ExternalErrorHarness = (props: Readonly<{ error: string }>) => (
    <FormSection
      title="创建线索"
      fields={harnessFields}
      submitLabel="创建线索"
      error={props.error}
      onSubmit={() => undefined}
    />
  );
  const alertOf = (host: ReturnType<typeof mountDom>): TestElement =>
    asElement(host.container.querySelector('form.form-section [role="alert"]'));

  it('shows an external submit error in the existing alert and nothing when there is none', async () => {
    const host = mountDom();
    mount(
      <FormSection
        title="创建线索"
        fields={harnessFields}
        submitLabel="创建线索"
        onSubmit={() => undefined}
      />,
      host,
    );
    expect(alertOf(host).textContent).toBe('');
    const message = '服务器处理请求时出错，请稍后重试';
    mount(<ExternalErrorHarness error={message} />, host);
    await flush();
    const alert = alertOf(host);
    expect(alert.textContent).toBe(message);
    // 仍是表单里唯一的一处提示，位置在提交按钮正上方（长表单下不必回滚就能看到）。
    expect(host.container.querySelectorAll('form.form-section [role="alert"]')).toHaveLength(1);
    expect(alert.nextSibling).toBe(submitButton(host));
    expect(alert.classList.contains('form-error')).toBe(true);
    // 调用方清空（重新提交、关闭或再次打开表单）后提示随之消失。
    mount(<ExternalErrorHarness error="" />, host);
    await flush();
    expect(alertOf(host).textContent).toBe('');
  });

  it("keeps the form's own validation message ahead of the external error", async () => {
    const host = mountDom();
    mount(<ExternalErrorHarness error="上一次提交被服务器拒绝" />, host);
    await flush();
    expect(alertOf(host).textContent).toBe('上一次提交被服务器拒绝');
    const company = fieldControl(host, 'company');
    company.value = '';
    company.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    submitButton(host).click();
    await flush();
    // 这次没通过表单校验、请求根本没有发出：显示的是校验提示，不是上一次的外部错误。
    expect(alertOf(host).textContent).toBe('请填写公司名称');
    expect(fieldControl(host, 'company').getAttribute('aria-invalid')).toBe('true');
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
  // 回归（TD-WF-012，写流程真浏览器冒烟发现）：提示出现时既不滚动也不聚焦，长表单提交失败后提示
  // 在视口外，用户看到的是「点了没反应」。提示留下时把它滚进可视区并把键盘焦点移过去
  // （tabindex="-1"，可程序聚焦但不进入 Tab 序列）。触发条件是「这次提交留下了提示」而不是
  // 「文案变了」：用户可能把焦点移回表单顶部再次按回车，提示文案没变但仍在视口外。
  /** 给提示区挂上 scrollIntoView 的探针（测试 DOM 没有这个方法）。 */
  const watchScroll = (alert: TestElement): ReturnType<typeof vi.fn> => {
    const scroll = vi.fn();
    Object.defineProperty(alert, 'scrollIntoView', { value: scroll, configurable: true });
    return scroll;
  };
  const blankCompany: readonly FormSectionField[] = [
    { name: 'company', label: '公司名称', required: true },
  ];

  it('scrolls the alert into view and moves focus to it when a validation message appears（TD-WF-012）', async () => {
    const host = mountDom();
    mount(
      <FormSection
        title="创建线索"
        fields={blankCompany}
        submitLabel="创建线索"
        onSubmit={() => undefined}
      />,
      host,
    );
    const alert = alertOf(host);
    // 提示区可被程序聚焦，但不在 Tab 序列里（连按 Tab 不会被它截住）。
    expect(alert.tabIndex).toBe(-1);
    const scroll = watchScroll(alert);
    expect(host.document.activeElement).not.toBe(alert);
    submitButton(host).click();
    await flush();
    expect(alertOf(host).textContent).toBe('请填写公司名称');
    // 已经完全可见时「nearest」不滚动，否则做最小滚动——相对所有可滚动祖先（抽屉体也算）。
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' });
    expect(host.document.activeElement).toBe(alert);
  });

  it('does it again when a later submit leaves the very same message（同一条提示再次出现）', async () => {
    const host = mountDom();
    mount(
      <FormSection
        title="创建线索"
        fields={blankCompany}
        submitLabel="创建线索"
        onSubmit={() => undefined}
      />,
      host,
    );
    const alert = alertOf(host);
    const scroll = watchScroll(alert);
    submitButton(host).click();
    await flush();
    // 用户把焦点移回输入框（或输入框本来就在视口上方）后再次提交，校验提示一字不差。
    fieldControl(host, 'company').focus();
    submitButton(host).click();
    await flush();
    expect(alertOf(host).textContent).toBe('请填写公司名称');
    expect(scroll).toHaveBeenCalledTimes(2);
    expect(host.document.activeElement).toBe(alert);
  });

  it('moves focus and scrolls for an external error as well, and does neither while no message is shown', async () => {
    const host = mountDom();
    mount(<ExternalErrorHarness error="" />, host);
    await flush();
    const alert = alertOf(host);
    const scroll = watchScroll(alert);
    expect(scroll).not.toHaveBeenCalled();
    mount(<ExternalErrorHarness error="服务器处理请求时出错，请稍后重试" />, host);
    await flush();
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' });
    expect(host.document.activeElement).toBe(alert);
  });

  it('leaves focus and the scroll position alone when the submit goes through', async () => {
    const host = mountDom();
    const submitted: string[] = [];
    mount(
      <FormSection
        title="创建线索"
        fields={harnessFields}
        submitLabel="创建线索"
        onSubmit={() => {
          submitted.push('done');
        }}
      />,
      host,
    );
    const scroll = watchScroll(alertOf(host));
    submitButton(host).click();
    await flush();
    expect(submitted).toEqual(['done']);
    expect(alertOf(host).textContent).toBe('');
    expect(scroll).not.toHaveBeenCalled();
    expect(host.document.activeElement).not.toBe(alertOf(host));
  });
});
