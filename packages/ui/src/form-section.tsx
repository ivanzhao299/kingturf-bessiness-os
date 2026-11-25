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

type ControlNode = AlertNode;

// 提交被表单校验拦下时要聚焦的字段：只有第一个出错的字段是「必填且为空」时才把焦点交给它
// （下拉与文本类输入同一规则）；格式不合法等其它提示仍由提示区承载并获焦。按字段顺序取第一个，
// 与提示区显示的是同一条。
const focusTargetOf = (
  fields: readonly FormSectionField[],
  values: Readonly<Record<string, string>>,
): string | null => {
  for (const field of fields) {
    const value = values[field.name] ?? '';
    if (validateField(field, value) === null) continue;
    return field.required === true && value.trim() === '' ? field.name : null;
  }
  return null;
};

// 手写镜像 openForm 的原生约束校验语义（测试 DOM 无原生 checkValidity，语义保持一致）。
const validateField = (field: FormSectionField, value: string): string | null => {
  // 必填字段为空时说「请选择」（下拉）或「请填写」（其余）。必填字段一律不带原生 required（见下方的
  // 约束输出），这条提示是用户看到的唯一一条——此前是浏览器自己的、语言随浏览器的气泡。
  if (field.required === true && value.trim() === '')
    return field.type === 'select' ? `请选择${field.label}` : `请填写${field.label}`;
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
  // 字段配置的默认值，按当前字段在每次渲染时重新计算。
  const defaults: Record<string, string> = {};
  for (const field of props.fields) defaults[field.name] = field.value ?? '';
  // 用户输入过的值。状态只在挂载那一刻按当时的字段初始化一次，之后只在输入时追加条目。
  const [entered, setValues] = useState<Readonly<Record<string, string>>>(defaults);
  // 渲染、校验与提交用的值：输入过的字段取状态，其余取字段配置的默认值。
  // TD-WF-014⑥：挂载之后才出现的字段（新建 BOM / 工艺路线里追加的组件行、工序行）在状态里没有条目，
  // 此前因此渲染成空、提交也是空——这些行从第 2 行起就没有默认值。合并是纯计算，不触发重渲染，
  // 也不依赖 effect 的时序；挂载时就在的字段行为不变（它们的条目一直在状态里）。
  const values: Readonly<Record<string, string>> = { ...defaults, ...entered };
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
  // TD-UI-013：这次提交因为必填字段为空被拦下时，要聚焦的第一个缺填字段；null 表示提示区自己拿焦点。
  const [missing, setMissing] = useState<string | null>(null);
  // 各字段的控件节点（按字段名），聚焦缺填字段时用。
  const controls = useRef<Record<string, ControlNode | null>>({});
  useEffect(() => {
    if (shownError === '') return;
    const node = alertRef.current as unknown as AlertNode | null;
    if (node === null) return;
    // 已经完全可见时「nearest」不滚动，否则做最小滚动——相对所有可滚动祖先（抽屉体也算）。
    node.scrollIntoView?.({ block: 'nearest' });
    // TD-UI-013：必填字段为空时焦点交给第一个缺填的字段（见 focusMissingField）；其它情况
    // （未勾选确认、外部错误）焦点仍在提示区。
    const field = missing === null ? undefined : controls.current[missing];
    if (field !== undefined && field !== null) {
      // nearest 按各滚动容器裁切判断。字段已获焦时，再调用 focus 不一定会滚动它。
      field.scrollIntoView?.({ block: 'nearest' });
      field.focus({ preventScroll: true });
    } else node.focus({ preventScroll: true });
  }, [attempt, shownError, missing]);

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
      setMissing(focusTargetOf(props.fields, values));
      return;
    }
    if (sensitive && !confirmed) {
      setError(`请先勾选确认，再${props.submitLabel}`);
      setMissing(null);
      return;
    }
    setError('');
    setMissing(null);
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
          // TD-WF-009 / TD-UI-013：必填字段不带原生 required（保留 aria-required）。带了的话，空值提交会先被
          // 浏览器拦下并弹出语言随浏览器的提示，表单的 submit 事件根本不触发；现在由 validateField 给出
          // 中文提示，并把焦点移到第一个缺填的字段（原生气泡也是把焦点放到这个控件上）。格式校验
          // （type=email、min / max 等）不动，仍由浏览器做。
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
              ref={(node: unknown) => {
                controls.current[field.name] = node as ControlNode | null;
              }}
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
