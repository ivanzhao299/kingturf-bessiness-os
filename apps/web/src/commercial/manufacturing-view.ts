import { el } from '../dom';
import type { OperationsViewContext } from './operations-view-ports';
import {
  manufacturingSubRoutes,
  visibleManufacturingSurfaces,
  type ManufacturingConsoleId,
} from './manufacturing-surfaces';
import { appendManufacturingSummary } from './manufacturing-summary';
import { appendManufacturingItemConsole } from './console/item-host';
import { appendManufacturingBomConsole } from './console/bom-host';
import { appendManufacturingRoutingConsole } from './console/routing-host';

// MFG-3B（TD-MFG-003）：制造主数据子路由化。子路由 → 控制台宿主；宿主节段自身即路由视图
// （携带 data-route-view，直接挂工作区根，与其它商业控制台宿主同口径）。
// 第三个参数：宿主的 refresh 端口在 controller.load 重读完成后调用它（见 appendManufacturingView）。
const CONSOLE_HOSTS: Readonly<
  Record<
    ManufacturingConsoleId,
    (context: OperationsViewContext, workspace: HTMLElement, onRefreshed?: () => void) => void
  >
> = {
  items: appendManufacturingItemConsole,
  boms: appendManufacturingBomConsole,
  routings: appendManufacturingRoutingConsole,
};

export function appendManufacturingView(context: OperationsViewContext, panel: HTMLElement): void {
  const { workspace, permissions, controller } = context;
  const { recordText } = context.ports;
  // MFG-3B：概览页（#/manufacturing-master）——顶部三张汇总卡（物料 / BOM / 工艺路线各显示
  // 已发布与草稿的版本行数），目标子路由可见时可点入。原 U3-MFG-1/2/3 三个控制台（分类
  // 导航 + 主表 + 详情/新建抽屉、版本对比/组件层级树/草稿发布、顺序步骤视图/工序编辑器/
  // 草稿发布）自此各迁一条子路由（物料管理 / BOM 管理 / 工艺路线），见下方装配。面板的
  // class 与 data-testid 原样保留（旧书签与导航巡检依赖）。
  panel.setAttribute('data-testid', 'manufacturing-workbench');
  panel.append(
    el('p', 'eyebrow', '制造主数据'),
    el('h2', '', '制造主数据概览'),
    el('p', 'commercial-help', '物料、BOM 与工艺路线版本状态汇总；各控制台见子页'),
  );
  const refreshSummary = appendManufacturingSummary(
    panel,
    () => ({
      items: controller.views.get('/api/v1/manufacturing-items'),
      boms: controller.views.get('/api/v1/manufacturing-boms'),
      routings: controller.views.get('/api/v1/manufacturing-routings'),
    }),
    recordText,
    new Set<string>(manufacturingSubRoutes(permissions)),
  );
  workspace.append(panel);
  // 子路由页：每个控制台独占一条路由，只在该路由对当前账号可见时挂载（可见性与菜单同源）。
  // 路由视图只构建一次：控制台新建 / 发布 / 刷新后数据已是新快照而概览面板不会重建，所以把
  // 汇总卡的重算函数交给宿主，由其 refresh 端口在重读完成后调用。
  for (const surface of visibleManufacturingSurfaces(permissions))
    CONSOLE_HOSTS[surface.id](context, workspace, refreshSummary);
}
