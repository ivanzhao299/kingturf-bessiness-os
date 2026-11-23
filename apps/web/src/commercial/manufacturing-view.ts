import { el } from '../dom';
import type { OperationsViewContext } from './operations-view-ports';
import { createManufacturingCard } from './manufacturing-cards';
import { appendManufacturingItemConsole } from './console-entry';
import { appendManufacturingBomConsole } from './console/bom-host';

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
  const grid = el('div', 'manufacturing-grid');
  // BOM/工艺路线两区保持 vanilla（U3-MFG-2/3 迁移）。
  // U3-MFG-2：BOM 区迁移至 Preact 控制台（版本对比/组件层级树/草稿发布）；原
  // vanilla「BOM 与替代料」卡片与「创建标准 BOM」表单退役（裁定 17 语义）。
  if (permissions.has('bom:read')) appendManufacturingBomConsole(context, panel);
  const definitions = [
    {
      title: '工艺路线与工序',
      path: '/api/v1/manufacturing-routings',
      read: 'routing:read',
      manage: 'routing:manage',
      publish: 'manufacturing-routing',
      example: {
        code: 'RT-KT-PRO-50',
        name: '50mm 标准工艺',
        productItemId: '产品主编号',
        productItemVersionId: '产品版本编号',
        effectiveAt: new Date().toISOString(),
        operations: [
          {
            operationCode: 'TUFT',
            name: '簇绒',
            workCenterCode: 'WC-TUFT-01',
            sequence: 10,
            setupMinutes: '60',
            runMinutesPerUnit: '0.8',
            instructions: {},
          },
        ],
        publish: false,
      },
    },
  ] as const;
  for (const definition of definitions) {
    if (!permissions.has(definition.read)) continue;
    const card = createManufacturingCard(context, definition);
    grid.append(card);
  }
  panel.append(grid);
  workspace.append(panel);
}
