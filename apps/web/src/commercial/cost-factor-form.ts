import type { FormField } from '../shared/forms';
import type { CostViewContext, CostFactorOptions, PricingViewPorts } from './pricing-view-ports';

export function createCostFactorFields(
  options: CostFactorOptions,
  textValue: PricingViewPorts['textValue'],
): CostViewContext['factorFields'] {
  const { itemVersions, categoryOptions, sourceOptions, unitOptions } = options;
  const factorFields = (
    matrix: Record<string, unknown>,
    factor?: Record<string, unknown>,
  ): readonly FormField[] => [
    ...(factor
      ? []
      : [
          {
            name: 'factorCode',
            label: '因子编号',
            required: true,
            placeholder: 'YARN-PE',
            section: '基本信息',
          },
        ]),
    {
      name: 'factorName',
      label: '因子名称',
      required: true,
      value: textValue(factor?.factorName, ''),
      placeholder: 'PE 草丝',
      ...(factor ? { section: '基本信息' } : {}),
    },
    {
      name: 'category',
      label: '成本类别',
      type: 'select',
      required: true,
      value: textValue(factor?.category, 'DIRECT_MATERIAL'),
      options: categoryOptions,
    },
    {
      name: 'sourceType',
      label: '价格来源',
      type: 'select',
      required: true,
      value: textValue(factor?.sourceType, 'MARKET_REFERENCE'),
      options: sourceOptions,
      section: '耗用与价格',
    },
    ...(itemVersions.length
      ? [
          {
            name: 'sourceItemVersionId',
            label: '关联采购物料',
            type: 'select' as const,
            required: false,
            value: textValue(factor?.sourceItemVersionId, ''),
            options: [{ value: '', label: '市场/计划因子无需关联' }, ...itemVersions],
          },
        ]
      : []),
    {
      name: 'quantity',
      label: '单位产品耗用量',
      type: 'number',
      required: true,
      step: 0.000001,
      value: textValue(factor?.quantity, '1'),
    },
    {
      name: 'unitCode',
      label: '耗用单位',
      type: 'select',
      required: true,
      value: textValue(factor?.unitCode, 'KG'),
      options: unitOptions,
    },
    {
      name: 'manualUnitPriceTaxInclusive',
      label: '含税单价 / 回退价',
      type: 'number',
      required: true,
      step: 0.000001,
      value: textValue(factor?.manualUnitPriceTaxInclusive, '1'),
    },
    {
      name: 'taxRate',
      label: '税率（小数）',
      type: 'number',
      required: true,
      step: 0.000001,
      value: textValue(factor?.taxRate, textValue(matrix.defaultTaxRate, '0.13')),
    },
    {
      name: 'priceSourceName',
      label: '来源名称',
      required: true,
      value: textValue(factor?.priceSourceName, ''),
      placeholder: '采购合同、供应商报价或市场数据平台',
      section: '价格依据与追溯',
    },
    {
      name: 'priceSourceReference',
      label: '单号 / 合同号 / 来源链接',
      value: textValue(factor?.priceSourceReference, ''),
    },
    {
      name: 'priceEffectiveAt',
      label: '价格生效日期',
      type: 'date',
      value: textValue(factor?.priceEffectiveAt, ''),
    },
    {
      name: 'sortOrder',
      label: '显示顺序',
      type: 'number',
      required: true,
      value: textValue(factor?.sortOrder, '0'),
    },
    {
      name: 'priceNote',
      label: '取数说明',
      type: 'textarea',
      value: textValue(factor?.priceNote, ''),
      fullWidth: true,
    },
  ];
  return factorFields;
}

export const factorPayload = (
  values: Readonly<Record<string, string>>,
  includeCode: boolean,
): Record<string, unknown> => ({
  ...(includeCode ? { factorCode: values.factorCode ?? '' } : {}),
  factorName: values.factorName ?? '',
  category: values.category ?? 'DIRECT_MATERIAL',
  sourceType: values.sourceType ?? 'MANUAL',
  ...(values.sourceItemVersionId ? { sourceItemVersionId: values.sourceItemVersionId } : {}),
  quantity: values.quantity ?? '1',
  unitCode: values.unitCode ?? 'EA',
  manualUnitPriceTaxInclusive: values.manualUnitPriceTaxInclusive ?? '0',
  taxRate: values.taxRate ?? '0.13',
  priceSourceName: values.priceSourceName ?? '人工录入',
  ...(values.priceSourceReference ? { priceSourceReference: values.priceSourceReference } : {}),
  ...(values.priceEffectiveAt ? { priceEffectiveAt: values.priceEffectiveAt } : {}),
  ...(values.priceNote ? { priceNote: values.priceNote } : {}),
  adjustable: true,
  sortOrder: Number(values.sortOrder ?? 0),
});
