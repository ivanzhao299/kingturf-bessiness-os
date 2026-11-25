// U3-PROC-2 / PROC-2：询价控制台宿主——RFQ 区迁移至 Preact（U3-PROC-2）；PROC-2 自
// console-entry 拆出（TD-PROC-005 增长点，同 bom-host.ts 范式），并随采购域子路由化成为
// #/procurement/rfqs 的路由视图：节段自身携带 data-route-view、直接挂工作区根（与其它商业
// 控制台宿主同口径；挂载与否由 procurement-view 按该路由可见性决定）。详情经桥轨 additive
// GET /api/v1/procurement-rfqs/:id，失败回退列表行。
import type { OperationsViewContext } from '../operations-view-ports';
import { el } from '../../dom';
import {
  itemVersionChoicesOf,
  ITEM_VERSIONS_PATH,
  perView,
  type ItemVersionChoice,
} from './console-choices';
import type { RfqConsolePorts } from './rfq-ports';

export function appendRfqConsole(context: OperationsViewContext, workspace: HTMLElement): void {
  const { controller, permissions } = context;
  const recordText = context.ports.recordText;
  // 物料版本选项与原 vanilla 采购询价表单同源（已发布制造物料版本行）。TD-WF-007：按最新视图计算。
  const readItemVersionChoices = perView(controller.views, ITEM_VERSIONS_PATH, (rows) =>
    itemVersionChoicesOf(rows, recordText),
  );
  const ports: RfqConsolePorts = {
    permissions,
    initialRfqs: controller.views.get('/api/v1/procurement-rfqs') ?? [],
    get itemVersionChoices(): readonly ItemVersionChoice[] {
      return readItemVersionChoices();
    },
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
  section.setAttribute('data-route-view', 'procurement/rfqs');
  workspace.append(section);
  void import('./mount').then(({ mountCommercialConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountCommercialConsole(section, { kind: 'rfqs', ports });
  });
}
