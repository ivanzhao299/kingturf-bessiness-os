import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openForm } from './shared/forms';
import {
  openBomVersionForm,
  openItemVersionForm,
  openRoutingVersionForm,
} from './commercial/manufacturing-forms';
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
  it.each([
    ['50.5', { pileHeightMm: 50.5 }],
    ['', {}],
  ] as const)(
    'creates item specification %s without implicit publish',
    async (pileHeightMm, specification) => {
      const f = operationsContext(),
        finish = vi.fn<(payload: Record<string, unknown>) => Promise<void>>(() =>
          Promise.resolve(),
        );
      openItemVersionForm(f.context, finish);
      const current = opened();
      expect(form.mock.calls[0]?.[0]).toBe(f.context.workspace);
      expect(
        current.fields
          .find((field) => field.name === 'itemType')
          ?.options?.map((item) => item.value),
      ).toEqual(['RAW_MATERIAL', 'SEMI_FINISHED', 'FINISHED_GOOD', 'PACKAGING']);
      expect(current.fields.find((field) => field.name === 'effectiveAt')?.value).toBe(
        '2026-10-17',
      );
      await current.run({
        sku: 'FG-1',
        name: '草坪',
        itemType: 'FINISHED_GOOD',
        baseUnitCode: 'M2',
        pileHeightMm,
        effectiveAt: '2026-10-18',
      });
      expect(finish).toHaveBeenCalledExactlyOnceWith({
        sku: 'FG-1',
        name: '草坪',
        itemType: 'FINISHED_GOOD',
        baseUnitCode: 'M2',
        specification,
        effectiveAt: '2026-10-18T00:00:00.000Z',
        publish: false,
      });
      finish.mockRejectedValueOnce(new Error('finish rejected'));
      await expect(current.run({})).rejects.toThrow('finish rejected');
      expect(f.submit).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'substitute-version',
      [{ itemVersionId: 'substitute-version', priority: 1, conversionFactor: '1' }],
    ],
    ['', []],
  ] as const)(
    'binds BOM root and version, decimals and optional substitute %s',
    async (substitute, substitutes) => {
      const f = operationsContext(),
        finish = vi.fn<(payload: Record<string, unknown>) => Promise<void>>(() =>
          Promise.resolve(),
        );
      openBomVersionForm(f.context, items, options, finish);
      const current = opened();
      expect(current.fields.find((field) => field.name === 'product')?.options).toBe(options);
      expect(current.fields.find((field) => field.name === 'substitute')?.options?.[0]).toEqual({
        value: '',
        label: '无替代料',
      });
      let finishNow: () => void = () => {
        throw new Error('Not initialized');
      };
      finish.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishNow = resolve;
          }),
      );
      let settled = false;
      const pending = current
        .run({
          code: 'BOM-1',
          name: '标准BOM',
          product: 'product-version',
          component: 'component-version',
          quantity: '2.125',
          scrap: '500',
          substitute,
          effectiveAt: '2026-10-18',
        })
        .then(() => {
          settled = true;
        });
      await Promise.resolve();
      expect(settled).toBe(false);
      finishNow();
      await pending;
      expect(settled).toBe(true);
      expect(finish).toHaveBeenCalledExactlyOnceWith({
        code: 'BOM-1',
        name: '标准BOM',
        productItemId: 'product-root',
        productItemVersionId: 'product-version',
        outputQuantity: '1',
        effectiveAt: '2026-10-18T00:00:00.000Z',
        lines: [
          {
            componentItemVersionId: 'component-version',
            quantity: '2.125',
            scrapBasisPoints: 500,
            substitutes,
          },
        ],
        publish: false,
      });
      finish.mockRejectedValueOnce(new Error('BOM finish rejected'));
      await expect(current.run({})).rejects.toThrow('BOM finish rejected');
    },
  );

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
