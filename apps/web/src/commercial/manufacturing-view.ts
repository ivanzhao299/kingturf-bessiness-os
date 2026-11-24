import { el } from '../dom';
import type { OperationsViewContext } from './operations-view-ports';
import { appendManufacturingItemConsole } from './console-entry';
import { appendManufacturingBomConsole } from './console/bom-host';
import { appendManufacturingRoutingConsole } from './console/routing-host';

export function appendManufacturingView(context: OperationsViewContext, panel: HTMLElement): void {
  const { workspace, permissions } = context;
  panel.setAttribute('data-testid', 'manufacturing-workbench');
  panel.append(
    el('p', 'eyebrow', '制造主数据'),
    el('h2', '', '制造主数据工作台'),
    el('p', 'commercial-help', '物料、BOM 与工艺路线版本'),
  );
  // U3-MFG-1：物料区迁移至 Preact 控制台（分类导航 + 主表 + 详情/新建抽屉）；原
  // vanilla「物料与规格版本」卡片与「创建物料版本」表单退役（裁定 17 语义）。
  if (permissions.has('manufacturing-item:read')) appendManufacturingItemConsole(context, panel);
  // U3-MFG-2：BOM 区迁移至 Preact 控制台（版本对比/组件层级树/草稿发布）；原
  // vanilla「BOM 与替代料」卡片与「创建标准 BOM」表单退役（裁定 17 语义）。
  if (permissions.has('bom:read')) appendManufacturingBomConsole(context, panel);
  // U3-MFG-3：工艺路线区迁移至 Preact 控制台（顺序步骤视图/工序编辑器/草稿发布）；
  // 原 vanilla「工艺路线与工序」卡片与「创建标准工艺路线」表单退役（裁定 17 语义，
  // manufacturing-cards/manufacturing-forms 随最后一张卡片退役整体删除）。
  if (permissions.has('routing:read')) appendManufacturingRoutingConsole(context, panel);
  workspace.append(panel);
}
