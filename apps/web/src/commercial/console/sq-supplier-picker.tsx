// TD-PROC-021：登记供应商报价的供应商候选。候选清单沿用旧版（账号可读的全部供应商），每一家
// 带状态徽章；处于暂停 / 已停用的照常列出，但不可被选中（单选钮禁用）。原生下拉框的选项里放
// 不下徽章，所以用一组单选钮呈现。服务端的资格守卫不变——被禁选的供应商即使因已有值而处于
// 选中，提交也会在表单里被拦下（见 sq-data.ts 的 quoteSupplierBlock）。
import { StatusBadge } from '@kingturf/ui';
import { SUPPLIER_STATUS_LABELS, supplierStatusTone } from './supplier-status';
import type { SupplierChoice } from './sq-data';

type PickerProps = Readonly<{
  suppliers: readonly SupplierChoice[];
  value: string;
  onChange: (supplierId: string) => void;
}>;

export const SupplierPicker = ({ suppliers, value, onChange }: PickerProps) => (
  <div class="sq-supplier-picker" data-testid="kt-sq-supplier-picker">
    <span class="sq-supplier-picker-label">
      供应商
      <em class="required-mark">必填</em>
    </span>
    {suppliers.length === 0 ? (
      <p class="console-label" data-testid="kt-sq-supplier-empty">
        暂无可选供应商
      </p>
    ) : (
      <div
        role="radiogroup"
        aria-label="供应商"
        aria-required="true"
        class="sq-supplier-candidates"
        data-testid="kt-sq-supplier-choices"
      >
        {suppliers.map((choice) => {
          const blocked = choice.status !== 'ACTIVE';
          const selected = value === choice.value;
          return (
            <label
              key={choice.value}
              class={`sq-supplier-candidate${blocked ? ' blocked' : ''}${selected ? ' selected' : ''}`}
              data-testid="kt-sq-supplier-choice"
              data-supplier-id={choice.value}
              data-status={choice.status}
              data-selected={selected ? 'true' : 'false'}
            >
              <input
                type="radio"
                name="supplierId"
                value={choice.value}
                checked={selected}
                disabled={blocked}
                onChange={() => {
                  // 禁用的单选钮在浏览器里不会触发 change；这里再守一道，不依赖控件本身。
                  if (blocked) return;
                  onChange(choice.value);
                }}
              />
              <span class="sq-supplier-candidate-name">{choice.label}</span>
              <StatusBadge tone={supplierStatusTone(choice.status)}>
                {SUPPLIER_STATUS_LABELS[choice.status] ?? choice.status}
              </StatusBadge>
            </label>
          );
        })}
      </div>
    )}
  </div>
);
