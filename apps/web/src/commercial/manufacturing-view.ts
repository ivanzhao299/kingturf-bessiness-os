import { el } from '../dom';
import type { OperationsViewContext } from './operations-view-ports';
import { createManufacturingCard } from './manufacturing-cards';

export function appendManufacturingView(context: OperationsViewContext, panel: HTMLElement): void {
  const { workspace, permissions } = context;
  panel.setAttribute('data-testid', 'manufacturing-workbench');
  panel.append(
    el('p', 'eyebrow', '制造主数据'),
    el('h2', '', '制造主数据工作台'),
    el('p', 'commercial-help', '物料、BOM 与工艺路线版本'),
  );
  const grid = el('div', 'manufacturing-grid');
  const definitions = [
    {
      title: '物料与规格版本',
      path: '/api/v1/manufacturing-items',
      read: 'manufacturing-item:read',
      manage: 'manufacturing-item:manage',
      publish: 'manufacturing-item',
      example: {
        sku: 'FG-KT-PRO-50',
        name: '金特夫 50mm 景观草',
        itemType: 'FINISHED_GOOD',
        baseUnitCode: 'M2',
        specification: { pileHeightMm: 50 },
        effectiveAt: new Date().toISOString(),
        publish: false,
      },
    },
    {
      title: 'BOM 与替代料',
      path: '/api/v1/manufacturing-boms',
      read: 'bom:read',
      manage: 'bom:manage',
      publish: 'manufacturing-bom',
      example: {
        code: 'BOM-KT-PRO-50',
        name: '50mm 标准 BOM',
        productItemId: '产品主编号',
        productItemVersionId: '产品版本编号',
        outputQuantity: '1',
        effectiveAt: new Date().toISOString(),
        lines: [
          {
            componentItemVersionId: '组件版本编号',
            quantity: '1.25',
            scrapBasisPoints: 300,
            substitutes: [],
          },
        ],
        publish: false,
      },
    },
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
