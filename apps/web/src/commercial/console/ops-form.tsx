import { signal } from '@preact/signals';
import { FormSection, type FormSectionField } from '@kingturf/ui';
import { failureMessage } from '../../shared/api-error-message';
import { confirmFormWrite, createConfirm } from './console-confirm';

type Values = Readonly<Record<string, string>>;
export type OpsWrite = readonly [path: string, body: Record<string, unknown>];
export type OpsForm = Readonly<{
  title: string;
  description: string;
  fields: readonly FormSectionField[];
  submitLabel: string;
  payload: (values: Values) => OpsWrite;
  confirm?: string | undefined;
}>;

export const opsForm = (
  title: string,
  description: string,
  fields: readonly FormSectionField[],
  submitLabel: string,
  payload: OpsForm['payload'],
  confirm?: string,
): OpsForm => ({ title, description, fields, submitLabel, payload, confirm });

export const trimOpsValues = (values: Values): Values =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));

export function createOpsWriter(
  submit: (path: string, body: Record<string, unknown>) => Promise<unknown>,
  refresh: () => Promise<void>,
) {
  const form = signal<OpsForm | null>(null);
  const error = signal('');
  const notice = signal('');
  const busy = signal(false);
  const confirmation = createConfirm();
  const open = (next: OpsForm) => {
    error.value = '';
    notice.value = '';
    form.value = next;
  };
  const close = () => {
    form.value = null;
    error.value = '';
  };
  const write = async (values: Values): Promise<void> => {
    const current = form.peek();
    if (!current || busy.peek()) return;
    busy.value = true;
    error.value = '';
    try {
      if (
        current.confirm &&
        !(await confirmFormWrite(confirmation, {
          title: current.title,
          message: current.confirm,
          confirmLabel: current.submitLabel,
          destructive: true,
        }))
      )
        return;
      const [path, body] = current.payload(trimOpsValues(values));
      await submit(path, body);
      close();
      notice.value = `${current.title}成功`;
    } catch (cause: unknown) {
      error.value = failureMessage(cause, `${current.title}失败`);
      return;
    } finally {
      busy.value = false;
    }
    try {
      await refresh();
    } catch (cause: unknown) {
      notice.value += `。${failureMessage(cause, '刷新业务数据失败')}`;
    }
  };
  return { form, error, notice, busy, confirmation, open, close, write };
}

export type OpsWriter = ReturnType<typeof createOpsWriter>;

export const OpsInlineForm = ({ model }: Readonly<{ model: OpsWriter }>) => {
  const form = model.form.value;
  if (!form) return null;
  return (
    <div key={form.title}>
      <FormSection {...form} error={model.error.value} onSubmit={model.write} />
      <button
        type="button"
        class="secondary compact"
        disabled={model.busy.value}
        onClick={model.close}
      >
        返回
      </button>
    </div>
  );
};
