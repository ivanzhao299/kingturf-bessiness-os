// U3-PROC-1 / PROC-2：供应商控制台宿主——供应商区迁移至 Preact（U3-PROC-1）；PROC-2 自
// console-entry 拆出（TD-PROC-005 增长点，同 bom-host.ts 范式），并随采购域子路由化成为
// #/procurement/suppliers 的路由视图：节段自身携带 data-route-view、直接挂工作区根（与其它
// 商业控制台宿主同口径；挂载与否由 procurement-view 按该路由可见性决定）。详情只读列表快照；
// 新建经 legacy POST 同链。
import type { OperationsViewContext } from '../operations-view-ports';
import { el } from '../../dom';
import {
  itemVersionChoicesOf,
  ITEM_VERSIONS_PATH,
  perView,
  type ItemVersionChoice,
} from './console-choices';
import type { SupplierConsolePorts } from './supplier-ports';

export function appendSupplierConsole(
  context: OperationsViewContext,
  workspace: HTMLElement,
): void {
  const { controller, permissions } = context;
  const recordText = context.ports.recordText;
  // 物料版本选项与原 vanilla 物料准入表单同源（已发布制造物料版本行）。TD-WF-007：按最新视图计算，
  // 不再是挂载时的快照——别处刚发布的物料，这里打开表单就能选到。
  const readItemVersionChoices = perView(controller.views, ITEM_VERSIONS_PATH, (rows) =>
    itemVersionChoicesOf(rows, recordText),
  );
  const snapshot = () => ({
    suppliers: controller.views.get('/api/v1/suppliers') ?? [],
    quotes: controller.views.get('/api/v1/supplier-quotes') ?? [],
  });
  const ports: SupplierConsolePorts = {
    permissions,
    initialSuppliers: snapshot().suppliers,
    get itemVersionChoices(): readonly ItemVersionChoice[] {
      return readItemVersionChoices();
    },
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
  section.setAttribute('data-route-view', 'procurement/suppliers');
  workspace.append(section);
  void import('./mount').then(({ mountCommercialConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountCommercialConsole(section, { kind: 'suppliers', ports });
  });
}
