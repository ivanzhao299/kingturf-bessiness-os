import { el, setOperationStatus } from '../dom';

export type FormField = Readonly<{
  name: string;
  label: string;
  type?:
    | 'text'
    | 'password'
    | 'email'
    | 'tel'
    | 'number'
    | 'date'
    | 'datetime-local'
    | 'select'
    | 'textarea';
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
export function openForm(
  host: HTMLElement,
  title: string,
  description: string,
  fields: readonly FormField[],
  submitLabel: string,
  onSubmit: (values: Readonly<Record<string, string>>) => Promise<void>,
  options: Readonly<{ className?: string }> = {},
): void {
  const dialog = el('dialog', `form-dialog ${options.className ?? ''}`.trim());
  const form = el('form', 'entity-form');
  form.setAttribute('method', 'dialog');
  const heading = el('div', 'dialog-heading');
  heading.append(
    el('p', 'eyebrow', '业务流程'),
    el('h2', '', title),
    el('p', 'muted', description),
  );
  form.append(heading);
  let dirty = false;
  for (const field of fields) {
    if (field.section) form.append(el('h3', 'form-section-heading', field.section));
    const label = el('label', field.fullWidth ? 'form-field full-width' : 'form-field');
    const fieldLabel = el('span', '', field.label);
    if (field.required) fieldLabel.append(el('em', 'required-mark', '必填'));
    label.append(fieldLabel);
    const control =
      field.type === 'textarea'
        ? el('textarea')
        : field.type === 'select'
          ? el('select')
          : el('input');
    control.setAttribute('name', field.name);
    if (field.required) {
      control.setAttribute('required', '');
      control.setAttribute('aria-required', 'true');
    }
    if (field.placeholder) control.setAttribute('placeholder', field.placeholder);
    if (field.minLength !== undefined) control.setAttribute('minlength', String(field.minLength));
    if (field.maxLength !== undefined) control.setAttribute('maxlength', String(field.maxLength));
    if (field.min !== undefined) control.setAttribute('min', String(field.min));
    if (field.max !== undefined) control.setAttribute('max', String(field.max));
    if (field.step !== undefined) control.setAttribute('step', String(field.step));
    if (control instanceof HTMLInputElement)
      control.type = ['password', 'email', 'tel', 'number', 'date'].includes(field.type ?? '')
        ? (field.type as 'password' | 'email' | 'tel' | 'number' | 'date')
        : 'text';
    if (control instanceof HTMLSelectElement)
      for (const option of field.options ?? []) {
        const item = el('option', '', option.label);
        item.value = option.value;
        control.append(item);
      }
    if (field.value !== undefined && 'value' in control) control.value = field.value;
    label.append(control);
    if (field.hint) label.append(el('small', 'field-hint', field.hint));
    control.addEventListener('invalid', () => {
      control.setAttribute('aria-invalid', 'true');
      label.classList.add('invalid');
    });
    control.addEventListener('input', () => {
      dirty = true;
      if (control.checkValidity()) {
        control.removeAttribute('aria-invalid');
        label.classList.remove('invalid');
      }
    });
    form.append(label);
  }
  const error = el('p', 'form-error');
  error.setAttribute('role', 'alert');
  error.tabIndex = -1;
  const progress = el('p', 'form-progress');
  progress.setAttribute('role', 'status');
  progress.setAttribute('aria-live', 'polite');
  const actions = el('div', 'dialog-actions');
  const cancel = el('button', 'secondary', '取消');
  cancel.type = 'button';
  cancel.addEventListener('click', () => {
    if (
      dirty &&
      typeof globalThis.confirm === 'function' &&
      !globalThis.confirm('当前修改尚未保存，确定关闭吗？')
    )
      return;
    dialog.close();
  });
  const submit = el('button', 'primary', submitLabel);
  submit.type = 'submit';
  let confirmationCheckbox: HTMLInputElement | null = null;
  const sensitive = /删除|停用|取消|驳回|拒绝|追回|关闭|释放/u.test(submitLabel);
  if (sensitive) {
    const confirmation = el('label', 'operation-confirmation');
    const checkbox = el('input');
    checkbox.type = 'checkbox';
    confirmationCheckbox = checkbox;
    confirmation.append(checkbox, el('span', '', '我已核对当前单据、操作理由及其对后续流程的影响'));
    submit.disabled = true;
    checkbox.addEventListener('change', () => {
      submit.disabled = !checkbox.checked;
    });
    form.append(
      el('p', 'operation-warning', '此操作会改变业务状态并写入审计记录，请确认后继续。'),
      confirmation,
    );
  }
  actions.append(cancel, submit);
  form.append(error, progress, actions);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (form.getAttribute('aria-busy') === 'true') return;
    error.textContent = '';
    if (!form.checkValidity()) {
      const invalid = Array.from(form.elements).filter(
        (item) =>
          (item instanceof HTMLInputElement ||
            item instanceof HTMLSelectElement ||
            item instanceof HTMLTextAreaElement) &&
          !item.checkValidity(),
      );
      error.textContent = `请检查 ${String(invalid.length)} 个必填或格式不正确的字段`;
      const firstInvalid = invalid[0];
      if (firstInvalid instanceof HTMLElement) firstInvalid.focus();
      form.reportValidity();
      return;
    }
    setOperationStatus(error, 'idle');
    setOperationStatus(progress, 'loading', '正在提交，请勿重复操作…');
    form.setAttribute('aria-busy', 'true');
    submit.disabled = true;
    cancel.disabled = true;
    submit.textContent = '处理中…';
    const values = Object.fromEntries(
      [...new FormData(form).entries()].map(([key, entry]) => [
        key,
        typeof entry === 'string' ? entry.trim() : '',
      ]),
    );
    void onSubmit(values)
      .then(() => {
        dirty = false;
        setOperationStatus(progress, 'success', '操作成功');
        dialog.close();
      })
      .catch((failure: unknown) => {
        setOperationStatus(
          error,
          'error',
          failure instanceof Error ? failure.message : '操作失败，请稍后重试',
        );
        setOperationStatus(progress, 'idle');
        error.focus();
      })
      .finally(() => {
        form.removeAttribute('aria-busy');
        cancel.disabled = false;
        submit.disabled = confirmationCheckbox?.checked === false;
        submit.textContent = submitLabel;
      });
  });
  dialog.append(form);
  host.append(dialog);
  dialog.addEventListener('cancel', (event) => {
    if (
      dirty &&
      typeof globalThis.confirm === 'function' &&
      !globalThis.confirm('当前修改尚未保存，确定关闭吗？')
    )
      event.preventDefault();
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
  });
  dialog.showModal();
}
export function openFileForm(
  host: HTMLElement,
  title: string,
  onSubmit: (file: File) => Promise<void>,
): void {
  const dialog = el('dialog', 'form-dialog');
  const form = el('form', 'entity-form');
  const heading = el('div', 'dialog-heading');
  heading.append(
    el('p', 'eyebrow', '技术需求证据'),
    el('h2', '', title),
    el('p', 'muted', '附件最大 25 MB；提交技术需求后附件集合将被冻结。'),
  );
  const label = el('label', 'form-field file-field');
  label.append(el('span', '', '选择技术资料或客户需求文件'));
  const input = el('input');
  input.type = 'file';
  input.required = true;
  input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt';
  label.append(input);
  const error = el('p', 'form-error');
  error.setAttribute('role', 'alert');
  const actions = el('div', 'dialog-actions');
  const cancel = el('button', 'secondary', '取消');
  cancel.type = 'button';
  cancel.addEventListener('click', () => {
    dialog.close();
  });
  const submit = el('button', 'primary', '上传并关联');
  submit.type = 'submit';
  actions.append(cancel, submit);
  form.append(heading, label, error, actions);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 26_214_400) {
      error.textContent = '文件超过 25 MB 限制';
      return;
    }
    submit.disabled = true;
    submit.textContent = '上传中…';
    void onSubmit(file)
      .then(() => {
        dialog.close();
      })
      .catch((failure: unknown) => {
        error.textContent = failure instanceof Error ? failure.message : '附件上传失败';
      })
      .finally(() => {
        submit.disabled = false;
        submit.textContent = '上传并关联';
      });
  });
  dialog.append(form);
  host.append(dialog);
  dialog.addEventListener('close', () => {
    dialog.remove();
  });
  dialog.showModal();
}
