import { DetailDrawer, FormSection } from '@kingturf/ui';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { el } from '../../dom';
import { failureMessage } from '../../shared/api-error-message';
import type { OperationsViewContext } from '../operations-view-ports';
import { ConsoleNotice } from './console-notice';
import { LOCATIONS, locationFields, locationPayload } from './inv-data';

export function InventoryLocationDrawer({
  close,
  error,
  submit,
}: Readonly<{
  close: () => void;
  error: string;
  submit: (values: Readonly<Record<string, string>>) => Promise<void>;
}>) {
  return (
    <DetailDrawer title="新建库存库位" onClose={close}>
      <FormSection
        title="库位信息"
        fields={locationFields}
        error={error}
        submitLabel="保存库位"
        onSubmit={submit}
      />
    </DetailDrawer>
  );
}

type Controller = OperationsViewContext['controller'];
// The location POST succeeded even if the overview gets rebuilt before another read.
const firstLocationCreated = new WeakSet<Controller>();

function FirstLocationEntry({ controller }: Readonly<{ controller: Controller }>) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function save(values: Readonly<Record<string, string>>) {
    setError('');
    const payload = locationPayload(values);
    try {
      await controller.submit(LOCATIONS, payload);
    } catch (failure: unknown) {
      setError(failureMessage(failure, '新建库位失败'));
      return;
    }
    firstLocationCreated.add(controller);
    setNotice(`已建立库位 ${payload.code ?? ''}`);
    setOpen(false);
  }

  return (
    <>
      {notice ? (
        <ConsoleNotice message={notice} />
      ) : (
        <button
          type="button"
          class="secondary"
          data-testid="kt-inv-create-first-location"
          onClick={() => {
            setError('');
            setOpen(true);
          }}
        >
          ＋ 建立首个库位
        </button>
      )}
      {open ? (
        <InventoryLocationDrawer
          close={() => {
            setOpen(false);
          }}
          error={error}
          submit={save}
        />
      ) : null}
    </>
  );
}

export function appendFirstInventoryLocation(
  { controller, permissions }: OperationsViewContext,
  panel: HTMLElement,
): void {
  if (
    !permissions.has('inventory:move') ||
    permissions.has('inventory:read') ||
    controller.views.get(LOCATIONS)?.length !== 0 ||
    firstLocationCreated.has(controller)
  )
    return;
  const host = el('div');
  panel.append(host);
  render(<FirstLocationEntry controller={controller} />, host);
}
