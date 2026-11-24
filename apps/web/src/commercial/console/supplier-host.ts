// U3-PROC-1：供应商控制台宿主——供应商区迁移至 Preact。suppliers 非独立 AppRoute，
// 宿主挂载于 procurement-workbench 面板内且刻意不携带 data-route-view（父面板的
// procurement 路由可见性统一治理——挂工作区根会在其它路由下常显，属接线缺陷）。
// PROC-2：自 console-entry 拆出（TD-PROC-005 增长点，同 bom-host.ts 范式）；行为不变。
import type { OperationsViewContext } from '../operations-view-ports';
import { el } from '../../dom';
import type { SupplierConsolePorts } from './supplier-ports';

export function appendSupplierConsole(context: OperationsViewContext, target: HTMLElement): void {
  const { controller, permissions } = context;
  const recordText = context.ports.recordText;
  // 物料版本选项与原 vanilla 物料准入表单同源（已发布制造物料版本行）。
  const itemVersionChoices = (controller.views.get('/api/v1/manufacturing-items') ?? [])
    .filter((item) => recordText(item, 'status', 'status') === 'PUBLISHED')
    .map((item) => ({
      value: recordText(item, 'id', 'id'),
      label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
    }));
  const snapshot = () => ({
    suppliers: controller.views.get('/api/v1/suppliers') ?? [],
    quotes: controller.views.get('/api/v1/supplier-quotes') ?? [],
  });
  const ports: SupplierConsolePorts = {
    permissions,
    initialSuppliers: snapshot().suppliers,
    itemVersionChoices,
    initialQuotes: snapshot().quotes,
    recordText: (record, camel, snake, fallback) => recordText(record, camel, snake, fallback),
    textValue: (value, fallback = '') =>
      typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
    submit: async (path, payload, method) => {
      await controller.submit(path, payload, method);
      return null;
    },
    refresh: async () => {
      await controller.load();
      return snapshot();
    },
  };
  const section = el('section', 'commercial-console suppliers-console');
  section.setAttribute('data-testid', 'kt-proc-suppliers');
  target.append(section);
  void import('./mount').then(({ mountCommercialConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountCommercialConsole(section, { kind: 'suppliers', ports });
  });
}
