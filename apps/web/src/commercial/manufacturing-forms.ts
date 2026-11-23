import { openForm } from '../shared/forms';
import type { OperationsViewContext } from './operations-view-ports';

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
