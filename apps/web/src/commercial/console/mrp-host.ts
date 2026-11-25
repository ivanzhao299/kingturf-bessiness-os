// MFG-6：物料需求计划控制台宿主——原 vanilla「物料需求与建议审批」页面（mrp-view / mrp-actions /
// mrp-run / mrp-proposals）迁移至 Preact；面板 .mrp-workbench 及其 data-testid、路由标记保持不变。
// 三个列表沿用路由加载的全量快照（controller.views 同源），写后按来源重读——汇总卡与
// 页签按取数回调读最新快照；建议主表与批次详情走桥轨 additive 端点（GET /api/v1/mrp-proposals、
// GET /api/v1/mrp-runs/:id）。物料下拉按最新视图计算（console-choices），不再是挂载时的快照。
import { el } from '../../dom';
import type { CommercialController } from '../store/controller';
import type { OperationsViewContext } from '../operations-view-ports';
import { ITEM_VERSIONS_PATH, itemVersionChoicesOf, perView } from './console-choices';
import type {
  MrpChoice,
  MrpConsolePorts,
  MrpPage,
  MrpProposalQuery,
  MrpSnapshot,
} from './mrp-ports';

const POLICIES_PATH = '/api/v1/mrp-policies';
const DEMANDS_PATH = '/api/v1/mrp-demands';
const RUNS_PATH = '/api/v1/mrp-runs';
const PROPOSALS_PATH = '/api/v1/mrp-proposals';

const pageUrl = (query: MrpProposalQuery): string => {
  const params = new URLSearchParams(
    Object.entries(query).map(([key, value]) => [key, value === true ? 'true' : String(value)]),
  ).toString();
  return params ? `${PROPOSALS_PATH}?${params}` : PROPOSALS_PATH;
};

export function appendMrpConsole(
  context: OperationsViewContext & { controller: Pick<CommercialController, 'refreshViews'> },
  panel: HTMLElement,
): void {
  const { controller, permissions, status } = context;
  const { recordText, businessStateLabel, operationsNextAction } = context.ports;
  const read = controller.api.get;
  // 取数回调：每次取值都读 controller.views（写操作之后的重读即是最新数据）；没有读权限的列表
  // 为 null，页面上显示「—」并说明原因。
  const snapshot = (): MrpSnapshot => ({
    policies: permissions.has('mrp-policy:read')
      ? (controller.views.get(POLICIES_PATH) ?? null)
      : null,
    demands: permissions.has('mrp:read') ? (controller.views.get(DEMANDS_PATH) ?? null) : null,
    runs: permissions.has('mrp:read') ? (controller.views.get(RUNS_PATH) ?? null) : null,
  });
  // 物料版本选项与 legacy 表单同源同公式（label = `SKU · 名称`，value = 版本行 id）。
  const readItemVersionChoices = perView(controller.views, ITEM_VERSIONS_PATH, (rows) =>
    itemVersionChoicesOf(rows, recordText),
  );
  const ports: MrpConsolePorts = {
    permissions,
    initial: snapshot(),
    get itemVersionChoices(): readonly MrpChoice[] {
      return readItemVersionChoices();
    },
    recordText: (record, camel, snake, fallback) => recordText(record, camel, snake, fallback),
    textValue: (value, fallback = '') =>
      typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
    businessStateLabel: (value, fallback) => businessStateLabel(value, fallback),
    operationsNextAction: (state) =>
      typeof state === 'string' ? operationsNextAction('mrp', state) : '',
    fetchProposals: async (query): Promise<MrpPage> => {
      if (!read) return { items: [], nextCursor: null };
      const page = await read(pageUrl(query));
      return {
        items: Array.isArray(page.items) ? page.items : [],
        nextCursor: typeof page.nextCursor === 'string' ? page.nextCursor : null,
      };
    },
    loadRunDetail: async (runId) => {
      if (!read) return null;
      return await read(`${RUNS_PATH}/${encodeURIComponent(runId)}`);
    },
    submit: async (path, payload, method) => {
      await controller.submit(path, payload, method);
      return null;
    },
    refresh: async () => {
      const sources = [
        ['mrp-policy:read', POLICIES_PATH],
        ['mrp:read', DEMANDS_PATH],
        ['mrp:read', RUNS_PATH],
        ['manufacturing-item:read', ITEM_VERSIONS_PATH],
      ] as const;
      await controller.refreshViews(
        sources.filter(([capability]) => permissions.has(capability)).map(([, path]) => path),
      );
      status.textContent = controller.message;
      return snapshot();
    },
  };
  const section = el('section', 'commercial-console mrp-console');
  section.setAttribute('data-testid', 'kt-mrp-console');
  panel.append(section);
  void import('./mount').then(({ mountCommercialConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountCommercialConsole(section, { kind: 'material-planning', ports });
  });
}
