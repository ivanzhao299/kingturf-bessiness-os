import { describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
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

/** 表单自己的提示区（role=alert，紧挨提交按钮）。 */
const alertOf = (host: ReturnType<typeof mountDom>): TestElement =>
  asElement(host.container.querySelector('form.form-section [role="alert"]'));

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
  // TD-UI-013 起必填字段为空时焦点交给缺填的字段（见下方「必填的文本类输入」一组）；这两条守的是
  // TD-WF-012 的另一半：不是缺填造成的提示（这里是未勾选敏感词确认）仍把提示滚进可视区并获焦。
  const unconfirmedCompany: readonly FormSectionField[] = [
    { name: 'company', label: '公司名称', required: true, value: '金特夫' },
  ];
  const UNCONFIRMED_MESSAGE = '请先勾选确认，再停用条目';
  const mountUnconfirmed = (host: ReturnType<typeof mountDom>): void => {
    mount(
      <FormSection
        title="停用条目"
        fields={unconfirmedCompany}
        submitLabel="停用条目"
        onSubmit={() => undefined}
      />,
      host,
    );
  };

  it('scrolls the alert into view and moves focus to it when a validation message appears（TD-WF-012）', async () => {
    const host = mountDom();
    mountUnconfirmed(host);
    const alert = alertOf(host);
    // 提示区可被程序聚焦，但不在 Tab 序列里（连按 Tab 不会被它截住）。
    expect(alert.tabIndex).toBe(-1);
    const scroll = watchScroll(alert);
    expect(host.document.activeElement).not.toBe(alert);
    submitButton(host).click();
    await flush();
    expect(alertOf(host).textContent).toBe(UNCONFIRMED_MESSAGE);
    // 已经完全可见时「nearest」不滚动，否则做最小滚动——相对所有可滚动祖先（抽屉体也算）。
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' });
    expect(host.document.activeElement).toBe(alert);
  });

  it('does it again when a later submit leaves the very same message（同一条提示再次出现）', async () => {
    const host = mountDom();
    mountUnconfirmed(host);
    const alert = alertOf(host);
    const scroll = watchScroll(alert);
    submitButton(host).click();
    await flush();
    // 用户把焦点移回输入框（或输入框本来就在视口上方）后再次提交，提示一字不差。
    fieldControl(host, 'company').focus();
    submitButton(host).click();
    await flush();
    expect(alertOf(host).textContent).toBe(UNCONFIRMED_MESSAGE);
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
  // 回归（TD-WF-009，写流程真浏览器冒烟发现）：必填下拉默认是空选，提交被浏览器原生校验拦下，
  // 提示语言随浏览器（本环境为英文 "Please select an item in the list."），submit 事件根本不触发。
  // 现在必填下拉不带原生 required（保留 aria-required），由表单自己的校验给中文提示。
  const colourFields: readonly FormSectionField[] = [
    {
      name: 'colour',
      label: '颜色',
      type: 'select',
      required: true,
      options: [
        { value: 'green', label: '绿' },
        { value: 'blue', label: '蓝' },
      ],
    },
    {
      name: 'finish',
      label: '表面处理',
      type: 'select',
      options: [{ value: 'smooth', label: '平' }],
    },
    { name: 'batch', label: '批次号', required: true },
  ];

  it('drops the native required from a required select and keeps aria-required（必填下拉）', () => {
    const host = mountDom();
    mount(
      <FormSection
        title="规格"
        fields={colourFields}
        submitLabel="保存"
        onSubmit={() => undefined}
      />,
      host,
    );
    const colour = fieldControl(host, 'colour');
    // 原生 required 一在，浏览器就先于表单拦下提交并弹出随浏览器语言的提示。
    expect(colour.hasAttribute('required')).toBe(false);
    expect(colour.getAttribute('aria-required')).toBe('true');
    expect(asElement(colour.parentNode).querySelector('.required-mark')?.textContent).toBe('必填');
    // TD-UI-013（TD-WF-009 的延伸）：其它类型的必填字段同样不带原生 required（保留 aria-required）。
    expect(fieldControl(host, 'batch').hasAttribute('required')).toBe(false);
    expect(fieldControl(host, 'batch').getAttribute('aria-required')).toBe('true');
    // 非必填下拉两者都不带。
    const finish = fieldControl(host, 'finish');
    expect(finish.hasAttribute('required')).toBe(false);
    expect(finish.hasAttribute('aria-required')).toBe(false);
  });

  it('gives a Chinese message for an untouched required select instead of the browser bubble', async () => {
    const host = mountDom();
    const submitted: Readonly<Record<string, string>>[] = [];
    mount(
      <FormSection
        title="规格"
        fields={colourFields}
        submitLabel="保存"
        onSubmit={(values) => {
          submitted.push(values);
        }}
      />,
      host,
    );
    const colour = fieldControl(host, 'colour');
    colour.focus();
    const scroll = vi.fn();
    Object.defineProperty(colour, 'scrollIntoView', { value: scroll, configurable: true });
    submitButton(host).click();
    await flush();
    expect(submitted).toEqual([]);
    const alert = asElement(host.container.querySelector('[role="alert"]'));
    expect(alert.textContent).toBe('请选择颜色');
    expect(colour.getAttribute('aria-invalid')).toBe('true');
    expect(asElement(colour.parentNode).classList.contains('invalid')).toBe(true);
    // 第一个出错的字段是下拉：提示里说的是「选择」而不是「填写」，焦点也在这个下拉上
    // （与文本类输入同一规则；此前落在提示区）。
    expect(host.document.activeElement).toBe(colour);
    // 选好之后再提交：提示消失，请求带上下拉选项的 value。
    colour.value = 'green';
    colour.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(colour.hasAttribute('aria-invalid')).toBe(false);
    const batch = fieldControl(host, 'batch');
    batch.value = 'B-001';
    batch.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    submitButton(host).click();
    await flush();
    expect(submitted).toEqual([{ colour: 'green', finish: '', batch: 'B-001' }]);
    expect(alert.textContent).toBe('');
  });
});

// TD-UI-013（TD-WF-009 的延伸，原 WFB-3）：必填的文本类输入此前仍带原生 required，空值提交先被浏览器拦下
// 并弹出语言随浏览器的提示（本环境为英文 "Please fill out this field."），表单的 submit 事件根本不触发，
// 连下拉的中文提示也看不到。现在所有必填字段都不带原生 required（保留 aria-required）：由表单给出中文
// 「请填写{标签}」，提示区滚进可视区，键盘焦点交给第一个缺填的字段（原生气泡也是把焦点放到这个控件上）。
// 格式校验（type=email、min / max 等）这一批不动，仍由浏览器做。
describe('FormSection：必填的文本类输入（TD-UI-013）', () => {
  const textTypes: readonly (readonly [string, FormSectionField['type']])[] = [
    ['单行文本（缺省类型）', undefined],
    ['单行文本（显式类型）', 'text'],
    ['密码', 'password'],
    ['邮箱', 'email'],
    ['电话', 'tel'],
    ['数字', 'number'],
    ['日期', 'date'],
    ['日期时间', 'datetime-local'],
    ['多行文本', 'textarea'],
  ];

  it.each(textTypes)(
    '%s：空值提交不带原生 required，给出中文提示并把焦点交给该字段',
    async (kind, type) => {
      const host = mountDom();
      const submitted: Readonly<Record<string, string>>[] = [];
      const label = `${kind}字段`;
      mount(
        <FormSection
          title="创建线索"
          // 缺省类型不传 type 键（与各控制台的文本字段写法一致）。
          fields={[
            { name: 'value', label, required: true, ...(type === undefined ? {} : { type }) },
          ]}
          submitLabel="创建线索"
          onSubmit={(values) => {
            submitted.push(values);
          }}
        />,
        host,
      );
      const control = fieldControl(host, 'value');
      // 原生 required 一在，浏览器就先于表单拦下提交并弹出随浏览器语言的提示。
      expect(control.hasAttribute('required')).toBe(false);
      expect(control.getAttribute('aria-required')).toBe('true');
      expect(asElement(control.parentNode).querySelector('.required-mark')?.textContent).toBe(
        '必填',
      );
      const alert = alertOf(host);
      const scroll = vi.fn();
      Object.defineProperty(alert, 'scrollIntoView', { value: scroll, configurable: true });
      expect(host.document.activeElement).not.toBe(control);
      submitButton(host).click();
      await flush();
      // 请求没有发出：提示是表单自己给的中文，字段标为无效，焦点在这个字段上。
      expect(submitted).toEqual([]);
      expect(alertOf(host).textContent).toBe(`请填写${label}`);
      expect(control.getAttribute('aria-invalid')).toBe('true');
      expect(asElement(control.parentNode).classList.contains('invalid')).toBe(true);
      expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' });
      expect(host.document.activeElement).toBe(control);
    },
  );

  // 焦点落在字段顺序里第一个缺填的字段上，与提示区说的是同一个字段。
  it('moves focus to the first missing field in field order', async () => {
    const host = mountDom();
    mount(
      <FormSection
        title="新建销售报价"
        fields={[
          { name: 'quoteNumber', label: '报价编号', required: true, value: 'Q-2026-001' },
          { name: 'turfPrice', label: '草坪销售单价（元/㎡）', type: 'number', required: true },
          { name: 'validUntil', label: '报价有效期至', type: 'date', required: true },
        ]}
        submitLabel="校验并创建报价"
        onSubmit={() => undefined}
      />,
      host,
    );
    submitButton(host).click();
    await flush();
    expect(alertOf(host).textContent).toBe('请填写草坪销售单价（元/㎡）');
    expect(host.document.activeElement).toBe(fieldControl(host, 'turfPrice'));
  });

  it('moves focus to a required select when it is the first missing field, even if a later text field is empty too', async () => {
    const host = mountDom();
    mount(
      <FormSection
        title="规格"
        fields={[
          {
            name: 'colour',
            label: '颜色',
            type: 'select',
            required: true,
            options: [{ value: 'green', label: '绿' }],
          },
          { name: 'batch', label: '批次号', required: true },
        ]}
        submitLabel="保存"
        onSubmit={() => undefined}
      />,
      host,
    );
    submitButton(host).click();
    await flush();
    // 提示与焦点说的是同一个字段：第一个出错的下拉。
    expect(alertOf(host).textContent).toBe('请选择颜色');
    expect(host.document.activeElement).toBe(fieldControl(host, 'colour'));
  });

  it('scrolls the missing field into view even when focus alone does not scroll the drawer', async () => {
    const host = mountDom();
    mount(
      <FormSection
        title="新建线索"
        fields={[{ name: 'title', label: '线索标题', required: true }]}
        submitLabel="创建线索"
        onSubmit={() => undefined}
      />,
      host,
    );
    const control = fieldControl(host, 'title');
    const focus = vi.spyOn(control, 'focus');
    const scroll = vi.fn();
    Object.defineProperty(control, 'scrollIntoView', { value: scroll, configurable: true });
    submitButton(host).click();
    await flush();
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' });
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(host.document.activeElement).toBe(control);
  });

  // 不是缺填造成的提示：焦点仍在提示区。
  it('keeps the focus on the alert when the first failing field is a format error', async () => {
    const host = mountDom();
    mount(
      <FormSection
        title="开通身份"
        fields={[
          {
            name: 'loginEmail',
            label: '登录邮箱',
            type: 'email',
            required: true,
            value: 'not-an-email',
          },
          { name: 'quota', label: '配额', type: 'number', required: true },
        ]}
        submitLabel="开通"
        onSubmit={() => undefined}
      />,
      host,
    );
    submitButton(host).click();
    await flush();
    expect(alertOf(host).textContent).toBe('登录邮箱格式不正确');
    expect(host.document.activeElement).toBe(alertOf(host));
  });

  it('gives the focus back to the alert once the missing field is filled and a later submit fails elsewhere', async () => {
    const host = mountDom();
    mount(
      <FormSection
        title="停用条目"
        fields={[{ name: 'reason', label: '停用原因', type: 'textarea', required: true }]}
        submitLabel="停用条目"
        onSubmit={() => undefined}
      />,
      host,
    );
    submitButton(host).click();
    await flush();
    expect(alertOf(host).textContent).toBe('请填写停用原因');
    expect(host.document.activeElement).toBe(fieldControl(host, 'reason'));
    const reason = fieldControl(host, 'reason');
    reason.value = '不再合作';
    reason.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    submitButton(host).click();
    await flush();
    // 缺填补上之后卡在敏感词确认上：这条提示不是缺填造成的，焦点回到提示区。
    expect(alertOf(host).textContent).toBe('请先勾选确认，再停用条目');
    expect(host.document.activeElement).toBe(alertOf(host));
  });
});

// TD-WF-014⑥（写流程冒烟 WS-P3-06）：表单值的状态只在挂载那一刻初始化。新建 BOM / 工艺路线里
// 「添加组件行 / 工序」是在挂载之后追加字段，这些字段在状态里没有条目，此前渲染成空、提交也是空——
// 第 1 行有默认值 1 / 0，第 2 行起没有。现在状态里没有的字段取字段配置的默认值。
describe('FormSection：挂载之后才出现的字段', () => {
  const firstRow: readonly FormSectionField[] = [
    { name: 'quantity', label: '单位用量', type: 'number', required: true, value: '1' },
    { name: 'scrap', label: '损耗（基点）', type: 'number', required: true, value: '0' },
  ];
  const secondRow: readonly FormSectionField[] = [
    { name: 'r2:quantity', label: '单位用量', type: 'number', required: true, value: '1' },
    { name: 'r2:scrap', label: '损耗（基点）', type: 'number', required: true, value: '0' },
  ];
  const mountRows = (
    host: ReturnType<typeof mountDom>,
    extra: readonly FormSectionField[] = [],
  ): Readonly<{
    rows: ReturnType<typeof signal<number>>;
    submitted: Readonly<Record<string, string>>[];
  }> => {
    const rows = signal(1);
    const submitted: Readonly<Record<string, string>>[] = [];
    const App = () => (
      <FormSection
        title="新建标准 BOM"
        fields={[...firstRow, ...extra, ...(rows.value === 1 ? [] : secondRow)]}
        submitLabel="保存"
        onSubmit={(values) => {
          submitted.push(values);
        }}
      />
    );
    mount(<App />, host);
    return { rows, submitted };
  };

  it('a field added after mount shows its configured default, the same as the first row, and submits it', async () => {
    const host = mountDom();
    const { rows, submitted } = mountRows(host);
    expect(fieldControl(host, 'quantity').value).toBe('1');
    rows.value = 2;
    await flush();
    // 第 2 行与首行同样的默认值。
    expect(fieldControl(host, 'r2:quantity').value).toBe(fieldControl(host, 'quantity').value);
    expect(fieldControl(host, 'r2:scrap').value).toBe(fieldControl(host, 'scrap').value);
    expect(fieldControl(host, 'r2:quantity').value).toBe('1');
    expect(fieldControl(host, 'r2:scrap').value).toBe('0');
    submitButton(host).click();
    await flush();
    expect(submitted).toEqual([{ quantity: '1', scrap: '0', 'r2:quantity': '1', 'r2:scrap': '0' }]);
  });

  it('a late field can be edited, and the edited value is the one submitted', async () => {
    const host = mountDom();
    const { rows, submitted } = mountRows(host);
    rows.value = 2;
    await flush();
    const late = fieldControl(host, 'r2:quantity');
    late.value = '2.5';
    late.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    // 首行不受影响。
    expect(fieldControl(host, 'quantity').value).toBe('1');
    submitButton(host).click();
    await flush();
    expect(submitted).toEqual([
      { quantity: '1', scrap: '0', 'r2:quantity': '2.5', 'r2:scrap': '0' },
    ]);
  });

  // 行为守恒：挂载时就在的字段，其值仍是挂载那一刻的快照——配置的默认值之后变了也不跟着变。
  it('a field present at mount keeps its mount-time value when its configured default changes later', async () => {
    const host = mountDom();
    const defaultOf = signal('1');
    const submitted: Readonly<Record<string, string>>[] = [];
    const App = () => (
      <FormSection
        title="新建标准 BOM"
        fields={[{ name: 'quantity', label: '单位用量', value: defaultOf.value }]}
        submitLabel="保存"
        onSubmit={(values) => {
          submitted.push(values);
        }}
      />
    );
    mount(<App />, host);
    defaultOf.value = '9';
    await flush();
    expect(fieldControl(host, 'quantity').value).toBe('1');
    submitButton(host).click();
    await flush();
    expect(submitted).toEqual([{ quantity: '1' }]);
  });
});
