// U3-MFG-2（ADR-0014 分域重写）：新建 BOM 抽屉——选产品 → 添加组件行（用量/损耗率/
// 可选替代料）→ 保存草稿。单行无替代料的载荷与原 vanilla「创建标准 BOM」表单逐字节
// 一致（productItemId 取所选版本行的 itemId、outputQuantity '1'、publish 恒 false、
// effectiveAt 归一 `T00:00:00.000Z`、替代料 priority 1/conversionFactor '1'）。
import { DetailDrawer, FormSection, type FormSectionField } from '@kingturf/ui';
import type { ItemVersionChoice } from './bom-ports';
import type { BomViewState } from './bom-state';

type CreateProps = Readonly<{ state: BomViewState }>;

const today = (): string => new Date().toISOString().slice(0, 10);

// 组件行字段（每行：组件版本/用量/损耗率/替代料）；首行用裸字段名（legacy 载荷
// 逐字节对齐），追加行带 `${row}:` 前缀。
const rowFields = (
  choices: readonly ItemVersionChoice[],
  row: string,
): readonly FormSectionField[] => {
  const name = (field: string): string => (row === 'r1' ? field : `${row}:${field}`);
  return [
    {
      name: name('component'),
      label: '组件版本',
      type: 'select',
      required: true,
      options: choices,
    },
    { name: name('quantity'), label: '单位用量', type: 'number', required: true, value: '1' },
    { name: name('scrap'), label: '损耗（基点）', type: 'number', required: true, value: '0' },
    {
      name: name('substitute'),
      label: '替代料版本（可选）',
      type: 'select',
      options: [{ value: '', label: '无替代料' }, ...choices],
    },
  ];
};

export const BomCreateDrawer = ({ state }: CreateProps) => {
  const rows = state.componentRows;
  const choices = state.ports.itemVersionChoices;
  return (
    <DetailDrawer title="新建 BOM" onClose={state.closeForm}>
      <div class="mfg-create-options" data-testid="kt-bom-create-options">
        <p class="console-hint">
          从已发布物料版本选择成品与组件；保存后为草稿，确认后可发布并冻结历史。
        </p>
        <div class="console-chips" data-testid="kt-bom-rows">
          {rows.map((row, index) => (
            <span key={row} class="console-chip" data-testid="kt-bom-row-chip">
              {`组件行 ${String(index + 1)}`}
              <button
                type="button"
                class="mfg-chip-remove"
                aria-label="移除该组件行"
                data-testid="kt-bom-row-remove"
                onClick={() => {
                  state.removeComponentRow(row);
                }}
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            class="secondary compact"
            data-testid="kt-bom-row-add"
            onClick={state.addComponentRow}
          >
            ＋ 添加组件行
          </button>
        </div>
      </div>
      {state.submitError !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-bom-create-error">
          {state.submitError}
        </p>
      ) : null}
      <FormSection
        title="新建标准 BOM"
        description="从已发布物料版本选择成品、组件和可选替代料。"
        fields={[
          { name: 'code', label: 'BOM 编码', required: true, maxLength: 64 },
          { name: 'name', label: 'BOM 名称', required: true },
          {
            name: 'product',
            label: '成品版本',
            type: 'select',
            required: true,
            options: choices,
          },
          ...rows.flatMap((row) => rowFields(choices, row)),
          {
            name: 'effectiveAt',
            label: '生效日期',
            type: 'date',
            required: true,
            value: today(),
          },
        ]}
        submitLabel="保存 BOM 草稿"
        onSubmit={(values) => state.runCreate(values)}
      />
    </DetailDrawer>
  );
};
