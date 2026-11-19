import { useState } from 'preact/hooks';

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
  const sensitive = SENSITIVE_SUBMIT.test(props.submitLabel);

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
    void props.onSubmit(values);
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
        if (field.step !== undefined) constraints.step = field.step;
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
      <p class="form-error" role="alert">
        {error}
      </p>
      <button type="submit" class="primary">
        {props.submitLabel}
      </button>
    </form>
  );
};
