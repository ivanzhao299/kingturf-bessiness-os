// U3-PROC-2：询价控制台宿主——RFQ 区迁移至 Preact（同供应商宿主口径：挂
// procurement-workbench 面板内、不带 data-route-view；详情经桥轨 additive
// GET /api/v1/procurement-rfqs/:id，失败回退列表行）。
// PROC-2：自 console-entry 拆出（TD-PROC-005 增长点，同 bom-host.ts 范式）；行为不变。
import type { OperationsViewContext } from '../operations-view-ports';
import { el } from '../../dom';
import type { RfqConsolePorts } from './rfq-ports';

export function appendRfqConsole(context: OperationsViewContext, target: HTMLElement): void {
  const { controller, permissions } = context;
  const recordText = context.ports.recordText;
  // 物料版本选项与原 vanilla 采购询价表单同源（已发布制造物料版本行）。
  const itemVersionChoices = (controller.views.get('/api/v1/manufacturing-items') ?? [])
    .filter((item) => recordText(item, 'status', 'status') === 'PUBLISHED')
    .map((item) => ({
      value: recordText(item, 'id', 'id'),
      label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
    }));
  const ports: RfqConsolePorts = {
    permissions,
    initialRfqs: controller.views.get('/api/v1/procurement-rfqs') ?? [],
    itemVersionChoices,
    recordText: (record, camel, snake, fallback) => recordText(record, camel, snake, fallback),
    textValue: (value, fallback = '') =>
      typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
    submit: async (path, payload, method) => {
      await controller.submit(path, payload, method);
      return null;
    },
    loadDetail: async (rfqId) => {
      const read = controller.api.get;
      if (!read) return null;
      return await read(`/api/v1/procurement-rfqs/${rfqId}`);
    },
    refresh: async () => {
      await controller.load();
      return controller.views.get('/api/v1/procurement-rfqs') ?? [];
    },
  };
  const section = el('section', 'commercial-console rfqs-console');
  section.setAttribute('data-testid', 'kt-proc-rfqs');
  target.append(section);
  void import('./mount').then(({ mountCommercialConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountCommercialConsole(section, { kind: 'rfqs', ports });
  });
}
