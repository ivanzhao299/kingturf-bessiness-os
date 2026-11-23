import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openForm } from './shared/forms';
import { openRoutingVersionForm } from './commercial/manufacturing-forms';
import { operationsContext } from '../test/fixtures/operations-context';
vi.mock('./shared/forms', () => ({ openForm: vi.fn() }));
const form = vi.mocked(openForm);
const opened = () => {
  const call = form.mock.calls.at(-1);
  if (!call) throw new Error('Manufacturing form missing');
  return { fields: call[3], run: call[5] };
};
const items = [
  { id: 'product-version', itemId: 'product-root' },
  { id: 'component-version', itemId: 'component-root' },
];
const options = [
  { value: 'product-version', label: '成品' },
  { value: 'component-version', label: '原料' },
];
beforeEach(() => {
  form.mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('manufacturing form fixed draft payloads', () => {
  // 物料版本表单用例随 U3-MFG-1 迁入 item-console.test.tsx（创建载荷 oracle 同批改写）。
  // BOM 版本表单用例随 U3-MFG-2 迁入 bom-console.test.tsx（创建载荷 oracle 同批改写）。
  it('creates ordered fixed routing operations and propagates finish rejection', async () => {
    const f = operationsContext(),
      finish = vi.fn<(payload: Record<string, unknown>) => Promise<void>>(() => Promise.resolve());
    openRoutingVersionForm(f.context, items, options, finish);
    const current = opened();
    expect(current.fields.find((field) => field.name === 'product')?.options).toBe(options);
    expect(
      current.fields
        .filter((field) => ['tuftRate', 'coatRate', 'packRate'].includes(field.name))
        .map((field) => field.value),
    ).toEqual(['0.8', '0.5', '0.2']);
    await current.run({
      code: 'ROUTE-1',
      name: '标准路线',
      product: 'product-version',
      tuftRate: '0.85',
      coatRate: '0.55',
      packRate: '0.25',
      effectiveAt: '2026-10-18',
    });
    expect(finish).toHaveBeenCalledExactlyOnceWith({
      code: 'ROUTE-1',
      name: '标准路线',
      productItemId: 'product-root',
      productItemVersionId: 'product-version',
      effectiveAt: '2026-10-18T00:00:00.000Z',
      publish: false,
      operations: [
        {
          operationCode: 'TUFT',
          name: '簇绒',
          workCenterCode: 'WC-TUFT-01',
          sequence: 10,
          setupMinutes: '60',
          runMinutesPerUnit: '0.85',
          instructions: {},
        },
        {
          operationCode: 'COAT',
          name: '背胶',
          workCenterCode: 'WC-COAT-01',
          sequence: 20,
          setupMinutes: '45',
          runMinutesPerUnit: '0.55',
          instructions: {},
        },
        {
          operationCode: 'PACK',
          name: '裁切包装',
          workCenterCode: 'WC-PACK-01',
          sequence: 30,
          setupMinutes: '20',
          runMinutesPerUnit: '0.25',
          instructions: {},
        },
      ],
    });
    finish.mockRejectedValueOnce(new Error('finish rejected'));
    await expect(current.run({})).rejects.toThrow('finish rejected');
    expect(f.submit).not.toHaveBeenCalled();
  });
});
