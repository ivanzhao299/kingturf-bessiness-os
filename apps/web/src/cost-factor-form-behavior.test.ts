import { describe, expect, it } from 'vitest';
import { createCostFactorFields, factorPayload } from './commercial/cost-factor-form';
const textValue = (value: unknown, fallback: string) =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;
const options = {
  itemVersions: [{ value: 'item-1', label: '原料' }],
  categoryOptions: [{ value: 'DIRECT_MATERIAL', label: '材料' }],
  sourceOptions: [{ value: 'SUPPLIER_QUOTE', label: '供应商报价' }],
  unitOptions: [{ value: 'KG', label: '千克' }],
};

describe('cost factor field and payload contracts', () => {
  it('constructs new factor defaults/options and preserves optional purchase binding choice', () => {
    const fields = createCostFactorFields(options, textValue)({ defaultTaxRate: '0.09' });
    const field = (name: string) => fields.find((item) => item.name === name);
    expect(field('factorCode')).toMatchObject({ required: true, section: '基本信息' });
    expect(field('sourceItemVersionId')?.options).toEqual([
      { value: '', label: '市场/计划因子无需关联' },
      { value: 'item-1', label: '原料' },
    ]);
    expect(field('category')?.options).toBe(options.categoryOptions);
    expect(field('unitCode')?.options).toBe(options.unitOptions);
    expect(field('sourceType')?.options).toBe(options.sourceOptions);
    expect(field('sourceType')?.value).toBe('MARKET_REFERENCE');
    expect(field('taxRate')?.value).toBe('0.09');
    expect(field('quantity')).toMatchObject({ value: '1', step: 0.000001 });
    expect(field('priceNote')?.fullWidth).toBe(true);
  });

  it('edits original decimal strings and omits new-only code or unavailable item selector', () => {
    const fields = createCostFactorFields({ ...options, itemVersions: [] }, textValue)(
      {},
      {
        factorName: 'PE草丝',
        category: 'DIRECT_MATERIAL',
        sourceType: 'SUPPLIER_QUOTE',
        quantity: '1.234567',
        taxRate: '0.13',
        unitCode: 'KG',
        manualUnitPriceTaxInclusive: '12.345678',
        priceSourceName: '供应商甲',
        priceSourceReference: 'SQ-1',
        priceEffectiveAt: '2026-10-17',
        sortOrder: 4,
        priceNote: '固定',
      },
    );
    expect(fields.some((field) => ['factorCode', 'sourceItemVersionId'].includes(field.name))).toBe(
      false,
    );
    expect(fields.find((field) => field.name === 'factorName')).toMatchObject({
      value: 'PE草丝',
      section: '基本信息',
    });
    expect(fields.find((field) => field.name === 'quantity')?.value).toBe('1.234567');
    expect(fields.find((field) => field.name === 'manualUnitPriceTaxInclusive')?.value).toBe(
      '12.345678',
    );
    expect(fields.find((field) => field.name === 'sortOrder')?.value).toBe('4');
  });

  it('maps a full new factor without numeric coercion of decimals and preserves trace fields', () => {
    expect(
      factorPayload(
        {
          factorCode: 'YARN-1',
          factorName: 'PE草丝',
          category: 'DIRECT_MATERIAL',
          sourceType: 'SUPPLIER_QUOTE',
          sourceItemVersionId: 'item-1',
          quantity: '1.234567',
          unitCode: 'KG',
          manualUnitPriceTaxInclusive: '12.345678',
          taxRate: '0.13',
          priceSourceName: '供应商甲',
          priceSourceReference: 'SQ-1',
          priceEffectiveAt: '2026-10-17',
          priceNote: '固定',
          sortOrder: '4',
        },
        true,
      ),
    ).toEqual({
      factorCode: 'YARN-1',
      factorName: 'PE草丝',
      category: 'DIRECT_MATERIAL',
      sourceType: 'SUPPLIER_QUOTE',
      sourceItemVersionId: 'item-1',
      quantity: '1.234567',
      unitCode: 'KG',
      manualUnitPriceTaxInclusive: '12.345678',
      taxRate: '0.13',
      priceSourceName: '供应商甲',
      priceSourceReference: 'SQ-1',
      priceEffectiveAt: '2026-10-17',
      priceNote: '固定',
      adjustable: true,
      sortOrder: 4,
    });
  });

  it('keeps current defaults and omits blank optional keys and edit code', () => {
    expect(
      factorPayload(
        {
          factorCode: 'must-not-edit',
          sourceItemVersionId: '',
          priceSourceReference: '',
          priceEffectiveAt: '',
          priceNote: '',
        },
        false,
      ),
    ).toEqual({
      factorName: '',
      category: 'DIRECT_MATERIAL',
      sourceType: 'MANUAL',
      quantity: '1',
      unitCode: 'EA',
      manualUnitPriceTaxInclusive: '0',
      taxRate: '0.13',
      priceSourceName: '人工录入',
      adjustable: true,
      sortOrder: 0,
    });
  });
});
