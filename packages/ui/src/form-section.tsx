import { useEffect, useRef, useState } from 'preact/hooks';

export type FormSectionFieldType =
  | 'text'
  | 'password'
  | 'email'
  | 'tel'
  | 'number'
  | 'date'
  | 'datetime-local'
  | 'select'
  | 'textarea';

// 与 shared/forms.ts FormField 同构的字段子集（兼容既有表单校验语义的载体）。
export type FormSectionField = Readonly<{
  name: string;
  label: string;
  type?: FormSectionFieldType;
  required?: boolean;
  placeholder?: string;
  value?: string;
  hint?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  section?: string;
  fullWidth?: boolean;
  options?: readonly Readonly<{ value: string; label: string }>[];
}>;

export type FormSectionProps = Readonly<{
  title: string;
  description?: string;
  fields: readonly FormSectionField[];
  submitLabel: string;
  /**
   * 外部提交错误（TD-WF-005）：调用方在 onSubmit 失败后写进来的原因，显示在表单自己的提示区
   * （与校验提示同一个 role="alert"，紧挨提交按钮）。空串或缺省表示没有；表单自身的校验提示
   * 优先。调用方在打开与关闭表单时把它清空。
   */
  error?: string;
  onSubmit: (values: Readonly<Record<string, string>>) => Promise<void> | void;
}>;

// 与 apps/web/src/shared/forms.ts 相同的敏感词集合（B3 语义兼容，不另立口径）。
const SENSITIVE_SUBMIT = /删除|停用|取消|撤销|驳回|拒绝|追回|关闭|释放/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

const controlTag = (field: FormSectionField): 'input' | 'textarea' | 'select' => {
  if (field.type === 'textarea') return 'textarea';
  if (field.type === 'select') return 'select';
  return 'input';
};

// 提示区节点：浏览器 HTMLElement 与测试 DOM double 通用（不用 instanceof）；double 没有 scrollIntoView。
type AlertNode = Readonly<{
  scrollIntoView?: (options?: ScrollIntoViewOptions) => void;
  focus: (options?: { preventScroll?: boolean }) => void;
}>;

// 手写镜像 openForm 的原生约束校验语义（测试 DOM 无原生 checkValidity，语义保持一致）。
const validateField = (field: FormSectionField, value: string): string | null => {
  if (field.required === true && value.trim() === '') return `请填写${field.label}`;
  if (value === '') return null;
  if (field.type === 'email' && !EMAIL_PATTERN.test(value)) return `${field.label}格式不正确`;
  if (field.maxLength !== undefined && value.length > field.maxLength)
    return `${field.label}不能超过 ${String(field.maxLength)} 个字符`;
  if (field.minLength !== undefined && value.length < field.minLength)
    return `${field.label}至少 ${String(field.minLength)} 个字符`;
  if (field.type === 'number') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return `${field.label}必须是数字`;
    if (field.min !== undefined && numeric < field.min)
      return `${field.label}不能小于 ${String(field.min)}`;
    if (field.max !== undefined && numeric > field.max)
      return `${field.label}不能大于 ${String(field.max)}`;
  }
  return null;
};

// 配置页/抽屉内结构化表单区（解剖模板「结构化表单」）：兼容既有表单校验/敏感词语义。
export const FormSection = (props: FormSectionProps) => {
  const initial: Record<string, string> = {};
  for (const field of props.fields) initial[field.name] = field.value ?? '';
  const [values, setValues] = useState<Readonly<Record<string, string>>>(initial);
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // TD-WF-004：重入标志必须是同步的 ref。双击的两次 submit 事件在同一轮事件循环里先后到达，
  // 上一次的状态更新此时还没渲染，只靠 submitting 拦不住第二次；submit 事件也可以由回车触发，
  // 所以不能只靠提交按钮置灰。
  const inFlight = useRef(false);
  const sensitive = SENSITIVE_SUBMIT.test(props.submitLabel);
  // 提示区显示的内容：表单自己的校验提示优先，其次是调用方传入的外部提交错误。
  const shownError = error !== '' ? error : (props.error ?? '');
  // TD-WF-012：提示出现时既不滚动也不聚焦，长表单提交失败后它在视口外（抽屉顶部的错误位在
  // 抽屉体已滚到提交按钮时位于视口上方），用户看到的是「点了没反应」。每次处理 submit 记一笔，
  // 只要这次提交留下了提示，就把提示滚进可视区并把键盘焦点移过去。按「这次提交」而不是按
  // 「文案变了」触发：用户可能把焦点移回表单顶部再次按回车，提示一字不差但仍在视口外。
  const alertRef = useRef<HTMLParagraphElement | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (shownError === '') return;
    const node = alertRef.current as unknown as AlertNode | null;
    if (node === null) return;
    // 已经完全可见时「nearest」不滚动，否则做最小滚动——相对所有可滚动祖先（抽屉体也算）。
    node.scrollIntoView?.({ block: 'nearest' });
    node.focus({ preventScroll: true });
  }, [attempt, shownError]);

  const onInput = (field: FormSectionField, value: string): void => {
    setValues((current) => ({ ...current, [field.name]: value }));
    setInvalid((current) => {
      if (!current.has(field.name)) return current;
      const next = new Set(current);
      if (validateField(field, value) === null) next.delete(field.name);
      else next.add(field.name);
      return next;
    });
  };

  const onSubmit = (event: Event): void => {
    event.preventDefault();
    if (inFlight.current) return;
    setAttempt((current) => current + 1);
    const nextInvalid = new Set<string>();
    let firstMessage = '';
    for (const field of props.fields) {
      const message = validateField(field, values[field.name] ?? '');
      if (message !== null) {
        nextInvalid.add(field.name);
        if (firstMessage === '') firstMessage = message;
      }
    }
    if (nextInvalid.size > 0) {
      setInvalid(nextInvalid);
      setError(firstMessage);
      return;
    }
    if (sensitive && !confirmed) {
      setError(`请先勾选确认，再${props.submitLabel}`);
      return;
    }
    setError('');
    inFlight.current = true;
    setSubmitting(true);
    // 提交失败的 Promise 必须在这里接住：此前是 void 掉，被拒绝时成为未处理的拒绝（浏览器里
    // 是一条未捕获错误），表单也没有任何提示。各控制台的 onSubmit 自己捕获业务错误并写进
    // 状态，这里只是不让漏出来的拒绝逃逸。
    const settle = (): void => {
      inFlight.current = false;
      setSubmitting(false);
    };
    try {
      const result = props.onSubmit(values);
      if (result instanceof Promise) void result.then(settle, settle);
      else settle();
    } catch {
      settle();
    }
  };

  return (
    <form class="form-section" onSubmit={onSubmit}>
      <header class="form-section-heading">
        <h3>{props.title}</h3>
        {props.description !== undefined && props.description !== '' ? (
          <p class="muted">{props.description}</p>
        ) : null}
      </header>
      {props.fields.map((field) => {
        const Tag = controlTag(field);
        const isInvalid = invalid.has(field.name);
        const constraints: Record<string, string | number | boolean> = {};
        if (field.required === true) {
          constraints.required = true;
          constraints['aria-required'] = 'true';
        }
        if (isInvalid) constraints['aria-invalid'] = 'true';
        if (field.placeholder !== undefined) constraints.placeholder = field.placeholder;
        if (field.minLength !== undefined) constraints.minLength = field.minLength;
        if (field.maxLength !== undefined) constraints.maxLength = field.maxLength;
        if (field.min !== undefined) constraints.min = field.min;
        if (field.max !== undefined) constraints.max = field.max;
        // TD-UI-009：浏览器对未写 step 的数字输入按步长 1 做原生校验，小数被拦下且 submit 事件不触发；
        // 上面的手写校验不限步长，二者据此对齐——未指定 step 即接受任意小数（整数口径由服务端校验）。
        if (field.step !== undefined) constraints.step = field.step;
        else if (field.type === 'number') constraints.step = 'any';
        if (Tag === 'input' && field.type !== undefined && field.type !== 'textarea')
          constraints.type = field.type;
        return (
          <label
            key={field.name}
            class={`form-field${field.fullWidth === true ? ' full-width' : ''}${isInvalid ? ' invalid' : ''}`}
          >
            <span>
              {field.label}
              {field.required === true ? <em class="required-mark">必填</em> : null}
            </span>
            <Tag
              name={field.name}
              {...constraints}
              value={values[field.name] ?? ''}
              onInput={(event: Event) => {
                const target = event.target as unknown as { value: string };
                onInput(field, target.value);
              }}
            >
              {field.type === 'select'
                ? (field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))
                : null}
            </Tag>
            {field.hint !== undefined && field.hint !== '' ? (
              <small class="field-hint">{field.hint}</small>
            ) : null}
          </label>
        );
      })}
      {sensitive ? (
        <label class="operation-confirmation">
          <input
            type="checkbox"
            data-confirmation="true"
            checked={confirmed}
            onClick={() => {
              setConfirmed(!confirmed);
            }}
          />
          {`我确认要${props.submitLabel}`}
        </label>
      ) : null}
      {/* tabIndex=-1：可被程序聚焦（提示出现时焦点移到这里），但不进入 Tab 序列。 */}
      <p ref={alertRef} class="form-error" role="alert" tabIndex={-1}>
        {shownError}
      </p>
      <button type="submit" class="primary" disabled={submitting} aria-busy={submitting}>
        {submitting ? '提交中…' : props.submitLabel}
      </button>
    </form>
  );
};
