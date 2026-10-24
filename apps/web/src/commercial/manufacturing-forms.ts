import { openForm } from '../shared/forms';
import type { OperationsViewContext } from './operations-view-ports';

export function openItemVersionForm(
  context: OperationsViewContext,
  finish: (payload: Record<string, unknown>) => Promise<void>,
): void {
  const { workspace } = context;
  openForm(
    workspace,
    '创建物料版本',
    '建立稳定 SKU 和规格版本；确认后可发布并冻结历史。',
    [
      { name: 'sku', label: 'SKU 编码', required: true, placeholder: 'FG-KT-PRO-50' },
      { name: 'name', label: '物料名称', required: true },
      {
        name: 'itemType',
        label: '物料类型',
        type: 'select',
        required: true,
        options: [
          { value: 'RAW_MATERIAL', label: '原材料' },
          { value: 'SEMI_FINISHED', label: '半成品' },
          { value: 'FINISHED_GOOD', label: '成品' },
          { value: 'PACKAGING', label: '包装物' },
        ],
      },
      { name: 'baseUnitCode', label: '基本单位', required: true, value: 'M2' },
      { name: 'pileHeightMm', label: '草高（mm，可选）', type: 'number' },
      {
        name: 'effectiveAt',
        label: '生效日期',
        type: 'date',
        required: true,
        value: new Date().toISOString().slice(0, 10),
      },
    ],
    '保存草稿',
    async (values) =>
      finish({
        sku: values.sku,
        name: values.name,
        itemType: values.itemType,
        baseUnitCode: values.baseUnitCode,
        specification: values.pileHeightMm ? { pileHeightMm: Number(values.pileHeightMm) } : {},
        effectiveAt: `${values.effectiveAt ?? ''}T00:00:00.000Z`,
        publish: false,
      }),
  );
}

export function openBomVersionForm(
  context: OperationsViewContext,
  publishedItems: readonly Record<string, unknown>[],
  itemOptions: readonly { value: string; label: string }[],
  finish: (payload: Record<string, unknown>) => Promise<void>,
): void {
  const { workspace } = context;
  openForm(
    workspace,
    '创建标准 BOM',
    '从已发布物料版本选择成品、主料和可选替代料。',
    [
      { name: 'code', label: 'BOM 编码', required: true },
      { name: 'name', label: 'BOM 名称', required: true },
      {
        name: 'product',
        label: '成品版本',
        type: 'select',
        required: true,
        options: itemOptions,
      },
      {
        name: 'component',
        label: '主料版本',
        type: 'select',
        required: true,
        options: itemOptions,
      },
      { name: 'quantity', label: '单位用量', type: 'number', required: true, value: '1' },
      {
        name: 'scrap',
        label: '损耗（基点）',
        type: 'number',
        required: true,
        value: '0',
      },
      {
        name: 'substitute',
        label: '替代料版本（可选）',
        type: 'select',
        options: [{ value: '', label: '无替代料' }, ...itemOptions],
      },
      {
        name: 'effectiveAt',
        label: '生效日期',
        type: 'date',
        required: true,
        value: new Date().toISOString().slice(0, 10),
      },
    ],
    '保存 BOM 草稿',
    async (values) => {
      const product = publishedItems.find((item) => item.id === values.product);
      return finish({
        code: values.code,
        name: values.name,
        productItemId: product?.itemId,
        productItemVersionId: values.product,
        outputQuantity: '1',
        effectiveAt: `${values.effectiveAt ?? ''}T00:00:00.000Z`,
        lines: [
          {
            componentItemVersionId: values.component,
            quantity: values.quantity,
            scrapBasisPoints: Number(values.scrap),
            substitutes: values.substitute
              ? [{ itemVersionId: values.substitute, priority: 1, conversionFactor: '1' }]
              : [],
          },
        ],
        publish: false,
      });
    },
  );
}

export function openRoutingVersionForm(
  context: OperationsViewContext,
  publishedItems: readonly Record<string, unknown>[],
  itemOptions: readonly { value: string; label: string }[],
  finish: (payload: Record<string, unknown>) => Promise<void>,
): void {
  const { workspace } = context;
  openForm(
    workspace,
    '创建标准工艺路线',
    '定义成品的簇绒、背胶和包装标准工序及节拍。',
    [
      { name: 'code', label: '路线编码', required: true },
      { name: 'name', label: '路线名称', required: true },
      {
        name: 'product',
        label: '成品版本',
        type: 'select',
        required: true,
        options: itemOptions,
      },
      {
        name: 'tuftRate',
        label: '簇绒分钟/㎡',
        type: 'number',
        required: true,
        value: '0.8',
      },
      {
        name: 'coatRate',
        label: '背胶分钟/㎡',
        type: 'number',
        required: true,
        value: '0.5',
      },
      {
        name: 'packRate',
        label: '包装分钟/㎡',
        type: 'number',
        required: true,
        value: '0.2',
      },
      {
        name: 'effectiveAt',
        label: '生效日期',
        type: 'date',
        required: true,
        value: new Date().toISOString().slice(0, 10),
      },
    ],
    '保存路线草稿',
    async (values) => {
      const product = publishedItems.find((item) => item.id === values.product);
      return finish({
        code: values.code,
        name: values.name,
        productItemId: product?.itemId,
        productItemVersionId: values.product,
        effectiveAt: `${values.effectiveAt ?? ''}T00:00:00.000Z`,
        publish: false,
        operations: [
          {
            operationCode: 'TUFT',
            name: '簇绒',
            workCenterCode: 'WC-TUFT-01',
            sequence: 10,
            setupMinutes: '60',
            runMinutesPerUnit: values.tuftRate,
            instructions: {},
          },
          {
            operationCode: 'COAT',
            name: '背胶',
            workCenterCode: 'WC-COAT-01',
            sequence: 20,
            setupMinutes: '45',
            runMinutesPerUnit: values.coatRate,
            instructions: {},
          },
          {
            operationCode: 'PACK',
            name: '裁切包装',
            workCenterCode: 'WC-PACK-01',
            sequence: 30,
            setupMinutes: '20',
            runMinutesPerUnit: values.packRate,
            instructions: {},
          },
        ],
      });
    },
  );
}
