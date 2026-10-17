import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openFileForm, openForm, type FormField } from './shared/forms';
import {
  BehaviorElement,
  BehaviorInput,
  BehaviorSelect,
  BehaviorTextarea,
  createBehaviorElement,
  findElement,
  flushBehaviorPromises,
  htmlElement,
} from '../test/fixtures/behavior-dom';

// Native FormData and native validity are injected ports, not reimplemented browser algorithms.
let entries: [string, FormDataEntryValue][];
const formData = vi.fn<(form: unknown) => void>();
class ControlledFormData {
  public constructor(form: unknown) {
    formData(form);
  }
  public entries(): IterableIterator<[string, FormDataEntryValue]> {
    return entries.values();
  }
}
const deferred = () => {
  let resolve: () => void = () => {
    throw new Error('Not initialized');
  };
  let reject: (reason: unknown) => void = () => {
    throw new Error('Not initialized');
  };
  const promise = new Promise<void>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
};
const fields: readonly FormField[] = [
  {
    name: 'name',
    label: '名称',
    required: true,
    placeholder: '请输入',
    value: 'original',
    minLength: 2,
    maxLength: 30,
    min: 0,
    max: 9,
    step: 0.5,
    hint: '固定提示',
    section: '分组',
    fullWidth: true,
  },
  {
    name: 'kind',
    label: '类别',
    type: 'select',
    options: [
      { value: 'A', label: '甲' },
      { value: 'B', label: '乙' },
    ],
    value: 'B',
  },
  { name: 'notes', label: '记录', type: 'textarea', value: 'note' },
];
const setup = (submitLabel = '保存', customFields = fields) => {
  const host = createBehaviorElement('main');
  const submit = vi.fn<(values: Readonly<Record<string, string>>) => Promise<void>>(() =>
    Promise.resolve(),
  );
  openForm(htmlElement(host), '固定标题', '固定说明', customFields, submitLabel, submit, {
    className: 'wide',
  });
  const dialog = findElement(host, (node) => node.tagName === 'DIALOG');
  const form = findElement(dialog, (node) => node.tagName === 'FORM');
  return {
    host,
    dialog,
    form,
    submit,
    save: findElement(form, (node) => node.tagName === 'BUTTON' && node.type === 'submit'),
    cancel: findElement(form, (node) => node.tagName === 'BUTTON' && node.type === 'button'),
    error: findElement(form, (node) => node.classList.contains('form-error')),
    progress: findElement(form, (node) => node.classList.contains('form-progress')),
    send: () => form.dispatchEvent(new Event('submit', { cancelable: true })),
  };
};
beforeEach(() => {
  entries = [];
  formData.mockClear();
  vi.stubGlobal('document', { createElement: createBehaviorElement });
  vi.stubGlobal('HTMLElement', BehaviorElement);
  vi.stubGlobal('HTMLInputElement', BehaviorInput);
  vi.stubGlobal('HTMLSelectElement', BehaviorSelect);
  vi.stubGlobal('HTMLTextAreaElement', BehaviorTextarea);
  vi.stubGlobal('FormData', ControlledFormData);
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('real form orchestration through explicit DOM/native ports', () => {
  it('renders field metadata, choices, sections and accessible status without inventing native validation', () => {
    const f = setup();
    expect(f.dialog.open).toBe(true);
    expect(f.dialog.className).toBe('form-dialog wide');
    expect(f.form.getAttribute('method')).toBe('dialog');
    expect(f.dialog.textContent).toContain('固定标题');
    const input = findElement(f.form, (node) => node.getAttribute('name') === 'name');
    expect(input.parentElement?.className).toBe('form-field full-width');
    expect(input.value).toBe('original');
    for (const [attribute, value] of Object.entries({
      required: '',
      'aria-required': 'true',
      placeholder: '请输入',
      minlength: '2',
      maxlength: '30',
      min: '0',
      max: '9',
      step: '0.5',
    }))
      expect(input.getAttribute(attribute)).toBe(value);
    expect(f.form.textContent).toContain('分组');
    expect(f.form.textContent).toContain('固定提示');
    const select = findElement(f.form, (node) => node.tagName === 'SELECT');
    expect(select.value).toBe('B');
    expect(select.children.map((node) => [node.value, node.textContent])).toEqual([
      ['A', '甲'],
      ['B', '乙'],
    ]);
    expect(findElement(f.form, (node) => node.tagName === 'TEXTAREA').value).toBe('note');
    expect(f.error.getAttribute('role')).toBe('alert');
    expect(f.progress.getAttribute('aria-live')).toBe('polite');
  });

  it.each(['password', 'email', 'tel', 'number', 'date', 'datetime-local'] as const)(
    'preserves current input type mapping for %s',
    (type) => {
      const f = setup('保存', [{ name: 'value', label: '值', type }]);
      expect(findElement(f.form, (node) => node.tagName === 'INPUT').type).toBe(
        type === 'datetime-local' ? 'text' : type,
      );
    },
  );

  it('observes external validity, focuses first invalid control and clears error decoration after valid input', () => {
    const f = setup();
    const controls = f.form.elements.filter((node) => node.tagName !== 'BUTTON');
    const first = controls[0],
      second = controls[1];
    if (!first || !second) throw new Error('Controls missing');
    first.validity = false;
    second.validity = false;
    first.dispatchEvent(new Event('invalid'));
    expect(first.getAttribute('aria-invalid')).toBe('true');
    expect(first.parentElement?.classList.contains('invalid')).toBe(true);
    expect(f.send()).toBe(false);
    expect(f.error.textContent).toBe('请检查 2 个必填或格式不正确的字段');
    expect(first.focusCalls).toBe(1);
    expect(f.form.reportValidityCalls).toBe(1);
    expect(f.submit).not.toHaveBeenCalled();
    expect(formData).not.toHaveBeenCalled();
    first.dispatchEvent(new Event('input'));
    expect(first.getAttribute('aria-invalid')).toBe('true');
    first.validity = true;
    first.dispatchEvent(new Event('input'));
    expect(first.getAttribute('aria-invalid')).toBeNull();
    expect(first.parentElement?.classList.contains('invalid')).toBe(false);
  });

  it('trims native entries, guards duplicate submits and closes/removes only after success', async () => {
    const f = setup();
    const pending = deferred();
    f.submit.mockReturnValueOnce(pending.promise);
    entries = [
      ['name', '  Alice  '],
      ['blank', '  '],
      ['attachment', new File(['x'], 'fixed.txt')],
    ];
    expect(f.send()).toBe(false);
    expect(f.submit).toHaveBeenCalledExactlyOnceWith({ name: 'Alice', blank: '', attachment: '' });
    expect(formData).toHaveBeenCalledTimes(1);
    expect(formData.mock.calls[0]?.[0]).toBe(f.form);
    expect(f.form.getAttribute('aria-busy')).toBe('true');
    expect(f.progress.dataset.state).toBe('loading');
    expect(f.progress.getAttribute('aria-busy')).toBe('true');
    expect(f.save.textContent).toBe('处理中…');
    expect(f.save.disabled).toBe(true);
    expect(f.cancel.disabled).toBe(true);
    expect(f.dialog.parentElement).toBe(f.host);
    f.send();
    expect(f.submit).toHaveBeenCalledTimes(1);
    pending.resolve();
    await flushBehaviorPromises();
    expect(f.dialog.open).toBe(false);
    expect(f.dialog.parentElement).toBeNull();
    expect(f.host.children).toEqual([]);
    expect(f.progress.dataset.state).toBe('success');
    expect(f.progress.getAttribute('aria-busy')).toBeNull();
    expect(f.form.getAttribute('aria-busy')).toBeNull();
    expect(f.cancel.disabled).toBe(false);
    expect(f.save.disabled).toBe(false);
    expect(f.save.textContent).toBe('保存');
  });

  it.each([new Error('fixed failure'), 'non-error'])(
    'keeps failed form open, restores buttons and retries (%j)',
    async (failure) => {
      const f = setup();
      const pending = deferred();
      f.submit.mockReturnValueOnce(pending.promise);
      f.send();
      pending.reject(failure);
      await flushBehaviorPromises();
      expect(f.dialog.open).toBe(true);
      expect(f.dialog.parentElement).toBe(f.host);
      expect(f.error.textContent).toBe(
        failure instanceof Error ? 'fixed failure' : '操作失败，请稍后重试',
      );
      expect(f.error.dataset.state).toBe('error');
      expect(f.error.focusCalls).toBe(1);
      expect(f.progress.dataset.state).toBe('idle');
      expect(f.form.getAttribute('aria-busy')).toBeNull();
      expect(f.save.disabled).toBe(false);
      expect(f.cancel.disabled).toBe(false);
      f.send();
      await flushBehaviorPromises();
      expect(f.submit).toHaveBeenCalledTimes(2);
      expect(f.dialog.parentElement).toBeNull();
    },
  );

  it.each(['删除', '停用', '取消', '驳回', '拒绝', '追回', '关闭', '释放'])(
    'enables sensitive %s button only when checked and restores checkbox state after failure',
    async (label) => {
      const f = setup(label);
      const checkbox = findElement(f.form, (node) => node.type === 'checkbox');
      expect(f.save.disabled).toBe(true);
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
      expect(f.save.disabled).toBe(false);
      const pending = deferred();
      f.submit.mockReturnValueOnce(pending.promise);
      f.send();
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change'));
      pending.reject(new Error('fixed rejection'));
      await flushBehaviorPromises();
      expect(f.dialog.open).toBe(true);
      expect(f.save.disabled).toBe(true);
      expect(f.save.textContent).toBe(label);
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
      expect(f.save.disabled).toBe(false);
    },
  );

  it('confirms dirty cancel/escape, permits clean cancel and handles absent confirm port', () => {
    const f = setup();
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    findElement(f.form, (node) => node.tagName === 'INPUT').dispatchEvent(new Event('input'));
    f.cancel.click();
    expect(f.dialog.open).toBe(true);
    expect(f.dialog.dispatchEvent(new Event('cancel', { cancelable: true }))).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(2);
    confirm.mockReturnValue(true);
    expect(f.dialog.dispatchEvent(new Event('cancel', { cancelable: true }))).toBe(true);
    // The double does not perform a browser's default Escape close.
    f.cancel.click();
    expect(f.dialog.parentElement).toBeNull();
    const clean = setup();
    confirm.mockClear();
    clean.cancel.click();
    expect(confirm).not.toHaveBeenCalled();
    expect(clean.dialog.parentElement).toBeNull();
    const noConfirm = setup();
    vi.stubGlobal('confirm', undefined);
    findElement(noConfirm.form, (node) => node.tagName === 'INPUT').dispatchEvent(
      new Event('input'),
    );
    expect(noConfirm.dialog.dispatchEvent(new Event('cancel', { cancelable: true }))).toBe(true);
    noConfirm.cancel.click();
    expect(noConfirm.dialog.parentElement).toBeNull();
  });
});

describe('real file form callback orchestration', () => {
  const setupFile = () => {
    const host = createBehaviorElement('main');
    const submit = vi.fn<(file: File) => Promise<void>>(() => Promise.resolve());
    openFileForm(htmlElement(host), '技术资料', submit);
    const dialog = findElement(host, (node) => node.tagName === 'DIALOG');
    const form = findElement(dialog, (node) => node.tagName === 'FORM');
    return {
      host,
      dialog,
      form,
      submit,
      input: findElement(form, (node) => node.type === 'file'),
      button: findElement(form, (node) => node.type === 'submit'),
      error: findElement(form, (node) => node.classList.contains('form-error')),
      send: () => form.dispatchEvent(new Event('submit', { cancelable: true })),
    };
  };
  it('ignores no file, rejects over 25MiB, accepts exact limit with original File reference', async () => {
    const f = setupFile();
    expect(f.input.required).toBe(true);
    expect(f.input.accept).toBe('.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt');
    f.send();
    expect(f.submit).not.toHaveBeenCalled();
    const file = new File([], 'fixed.pdf', { type: 'application/pdf' });
    // No large allocation: inject File.size metadata, not a fabricated upload response.
    Object.defineProperty(file, 'size', { value: 26_214_401, configurable: true });
    f.input.files = [file];
    f.send();
    expect(f.error.textContent).toBe('文件超过 25 MB 限制');
    expect(f.submit).not.toHaveBeenCalled();
    Object.defineProperty(file, 'size', { value: 26_214_400 });
    const pending = deferred();
    f.submit.mockReturnValueOnce(pending.promise);
    f.send();
    expect(f.submit.mock.calls[0]?.[0]).toBe(file);
    expect(f.button.disabled).toBe(true);
    expect(f.button.textContent).toBe('上传中…');
    expect(f.dialog.open).toBe(true);
    pending.resolve();
    await flushBehaviorPromises();
    expect(f.dialog.parentElement).toBeNull();
    expect(f.button.disabled).toBe(false);
    expect(f.button.textContent).toBe('上传并关联');
  });

  it.each([new Error('fixed upload failure'), null])(
    'preserves failure and restores upload control for retry (%j)',
    async (failure) => {
      const f = setupFile();
      f.input.files = [new File(['fixed'], 'fixed.txt')];
      f.submit.mockRejectedValueOnce(failure);
      f.send();
      await flushBehaviorPromises();
      expect(f.error.textContent).toBe(
        failure instanceof Error ? 'fixed upload failure' : '附件上传失败',
      );
      expect(f.dialog.parentElement).toBe(f.host);
      expect(f.button.disabled).toBe(false);
      f.send();
      await flushBehaviorPromises();
      expect(f.submit).toHaveBeenCalledTimes(2);
      expect(f.dialog.parentElement).toBeNull();
    },
  );

  it('removes a cancelled file form without invoking upload', () => {
    const f = setupFile();
    findElement(f.form, (node) => node.type === 'button').click();
    expect(f.dialog.parentElement).toBeNull();
    expect(f.submit).not.toHaveBeenCalled();
  });
});
