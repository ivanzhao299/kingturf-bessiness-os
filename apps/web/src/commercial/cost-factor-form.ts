import type { FormField } from '../shared/forms';
import type { PricingViewPorts } from './pricing-view-ports';

// U3-COM-4（G 防重复）：因子域常量单一来源（cost-view 与矩阵控制台共用）。
export type CostFactorOptions = Readonly<{
  itemVersions: readonly Readonly<{ value: string; label: string }>[];
  categoryOptions: readonly Readonly<{ value: string; label: string }>[];
  sourceOptions: readonly Readonly<{ value: string; label: string }>[];
  unitOptions: readonly Readonly<{ value: string; label: string }>[];
}>;

export const CATEGORY_OPTIONS = [
  ['DIRECT_MATERIAL', '直接材料'],
  ['DIRECT_LABOR', '直接人工'],
  ['DIRECT_ENERGY', '直接能源'],
  ['DIRECT_OVERHEAD', '直接制造费用'],
  ['FIXED', '固定成本（预留）'],
  ['PERSONNEL', '人员成本（预留）'],
  ['FINANCE', '财务费用（预留）'],
  ['MARKETING', '营销费用（预留）'],
  ['OTHER', '其他费用'],
].map(([value, label]) => ({ value: value ?? '', label: label ?? '' }));

export const SOURCE_OPTIONS = [
  { value: 'PURCHASE_ORDER', label: '已下达采购订单 / 合同价' },
  { value: 'SUPPLIER_QUOTE', label: '有效供应商报价' },
  { value: 'MARKET_REFERENCE', label: '市场公开参考价' },
  { value: 'INTERNAL_BENCHMARK', label: '企业计划成本基准' },
  { value: 'MANUAL', label: '临时手工录入' },
];

export const UNIT_OPTIONS = [
  { value: 'KG', label: '千克 kg' },
  { value: 'M2', label: '平方米 m²' },
  { value: 'HOUR', label: '工时' },
  { value: 'KWH', label: '千瓦时 kWh' },
  { value: 'EA', label: '项 / 件' },
];

export const itemVersionOptions = (
  items: readonly Record<string, unknown>[],
  textValue: PricingViewPorts['textValue'],
) =>
  items.flatMap((item) =>
    (Array.isArray(item.versions) ? item.versions : []).map((candidate) => {
      const version = candidate as Record<string, unknown>;
      return {
        value: textValue(version.id, ''),
        label: `${textValue(item.sku, '物料')} · ${textValue(item.name, '')} · 第 ${textValue(version.version, '1')} 版`,
      };
    }),
  );

export function createCostFactorFields(
  options: CostFactorOptions,
  textValue: PricingViewPorts['textValue'],
): (matrix: Record<string, unknown>, factor?: Record<string, unknown>) => readonly FormField[] {
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
