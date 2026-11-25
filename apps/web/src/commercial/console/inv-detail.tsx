import { DetailDrawer, FormSection } from '@kingturf/ui';
import { useState } from 'preact/hooks';
import { ConsoleNotice } from './console-notice';
import { FocusAnchor } from './focus-anchor';
import { FinFacts, FinTable, finRecord, finRows, finText, finWhen, type FinRow } from './fin-kit';
import {
  movementFields,
  movementOptions,
  movementSourceChoices,
  optionLabel,
  qualityOptions,
  sourceTypeOptions,
} from './inv-data';
import type { Choice } from './console-choices';

const MOVEMENT_LABELS = [
  ...movementOptions,
  { value: 'RECEIPT', label: '收货' },
  { value: 'TRANSFER_IN', label: '调拨入库' },
  { value: 'TRANSFER_OUT', label: '调拨出库' },
];
type MoveSubmit = (
  values: Readonly<Record<string, string>>,
  sourceType: string,
  sourceId: string,
) => Promise<void>;

export function MovementForm({
  balance,
  orders,
  error,
  submit,
}: Readonly<{
  balance: FinRow;
  orders: readonly Choice[];
  error: string;
  submit: MoveSubmit;
}>) {
  const [type, setType] = useState('WORK-ORDER');
  const [sourceId, setSource] = useState('');
  const choices = ['WORK-ORDER', 'PRODUCTION_ORDER'].includes(type)
    ? orders
    : movementSourceChoices(balance, type);
  return (
    <div>
      <div class="sq-rfq-fields">
        <label>
          业务来源类型
          <select
            value={type}
            name="sourceType"
            onChange={(event) => {
              setType(event.currentTarget.value);
              setSource('');
            }}
          >
            {sourceTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          业务来源
          <select
            aria-required="true"
            value={sourceId}
            name="sourceId"
            onChange={(event) => {
              setSource(event.currentTarget.value);
            }}
          >
            <option value="">{choices.length ? '请选择业务来源' : '暂无可选业务来源'}</option>
            {choices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <FormSection
        title="登记库存移动"
        description="移动记录不可修改，出库数量不得造成负库存。"
        fields={movementFields}
        error={error}
        submitLabel="追加库存移动"
        onSubmit={(values) => submit(values, type, sourceId)}
      />
    </div>
  );
}

export function InventoryDetail({
  balance,
  moving,
  move,
  cancel,
  close,
  orders,
  actors,
  error,
  notice,
  onSubmit,
}: Readonly<{
  balance: FinRow;
  moving: boolean;
  move: (() => void) | undefined;
  cancel: () => void;
  close: () => void;
  orders: readonly Choice[];
  actors: ReadonlyMap<string, string>;
  error: string;
  notice: string;
  onSubmit: MoveSubmit;
}>) {
  const origin = finRecord(balance.origin);
  const originType = finText(origin, 'type');
  const source = finText(origin, 'number', 'id');
  const number = finText(balance, 'lotNumber');
  return (
    <DetailDrawer
      title={`批次库存详情 · ${number}`}
      size="wide"
      onClose={close}
      footer={<ConsoleNotice message={notice} />}
    >
      <div data-testid="kt-inv-detail">
        <FocusAnchor token={moving ? 'move' : 'details'} />
        <FinFacts
          items={[
            ['物料', `${finText(balance, 'sku')} · ${finText(balance, 'itemName')}`],
            ['库位', finText(balance, 'locationCode')],
            ['结存', finText(balance, 'quantity')],
            ['质量状态', optionLabel(qualityOptions, finText(balance, 'qualityStatus'))],
            [
              '批次来源',
              originType
                ? `${originType === 'RECEIPT' ? '收货单' : '生产入库'} · ${source || '—'}`
                : '—',
            ],
          ]}
        />
        {move && !moving ? (
          <button type="button" class="secondary" data-testid="kt-inv-move" onClick={move}>
            领用 / 退料 / 盘点
          </button>
        ) : null}
        {moving ? (
          <>
            <MovementForm balance={balance} error={error} orders={orders} submit={onSubmit} />
            <button type="button" class="secondary" onClick={cancel}>
              返回流水
            </button>
          </>
        ) : null}
        <h3>库存移动流水</h3>
        <FinTable
          testId="kt-inv-movements"
          head={['时间', '类型', '数量', '来源', '操作人']}
          empty="暂无移动"
          rows={finRows(balance.movements).map((row) => {
            const actor = finText(row, 'actor_id');
            const sourceId = finText(row, 'source_id');
            const work = orders.find((order) => order.value === sourceId);
            return [
              finWhen(row, 'occurred_at'),
              optionLabel(MOVEMENT_LABELS, finText(row, 'movement_type')),
              finText(row, 'quantity_delta'),
              `${optionLabel(sourceTypeOptions, finText(row, 'source_type'))} · ${work?.label ?? sourceId}`,
              actors.get(actor) ?? (actor || '—'),
            ];
          })}
        />
      </div>
    </DetailDrawer>
  );
}
