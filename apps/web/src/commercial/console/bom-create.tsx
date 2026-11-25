// U3-MFG-2（ADR-0014 分域重写）：新建 BOM 抽屉——选产品 → 添加组件行（用量/损耗率/
// 可选替代料）→ 保存草稿。单行无替代料的载荷与原 vanilla「创建标准 BOM」表单逐字节
// 一致（productItemId 取所选版本行的 itemId、outputQuantity '1'、publish 恒 false、
// effectiveAt 归一 `T00:00:00.000Z`、替代料 priority 1/conversionFactor '1'）。
import {
  VersionSourceHint,
  productVersionOptions,
  versionOptions,
  versionDay,
  versionRecords,
  versionText,
} from './manufacturing-version-ui';
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
  state: BomViewState,
): readonly FormSectionField[] => {
  const name = (field: string): string => (row === 'r1' ? field : `${row}:${field}`);
  const source = state.versionSource;
  const initial = versionRecords(source?.lines)[Number(row.slice(1)) - 1];
  const componentId = versionText(
    initial?.componentItemVersionId ?? initial?.component_item_version_id,
  );
  return [
    {
      name: name('component'),
      label: '组件版本',
      type: 'select',
      required: true,
      options: versionOptions(choices, componentId),
      ...(initial ? { value: componentId } : {}),
    },
    {
      name: name('quantity'),
      label: '单位用量',
      type: 'number',
      required: true,
      value: versionText(initial?.quantityText ?? initial?.quantity, '1'),
    },
    {
      name: name('scrap'),
      label: '损耗（基点）',
      type: 'number',
      required: true,
      value: versionText(initial?.scrapBasisPoints ?? initial?.scrap_basis_points, '0'),
    },
    ...(source
      ? (state.substituteRows[row] ?? []).flatMap((id, index): readonly FormSectionField[] => {
          const original = versionRecords(initial?.substitutes)[Number(id.slice(1)) - 1];
          const prefix = `${row}:${id}`;
          const itemId = versionText(
            original?.itemVersionId ?? original?.substitute_item_version_id,
          );
          return [
            {
              name: `${prefix}:item`,
              label: `替代料 ${String(index + 1)} 版本`,
              type: 'select',
              required: true,
              options: versionOptions(choices, itemId, versionText(original?.sku, '来源版本')),
              value: itemId,
            },
            {
              name: `${prefix}:priority`,
              label: '替代优先级',
              type: 'number',
              required: true,
              value: versionText(original?.priority, String(index + 1)),
            },
            {
              name: `${prefix}:factor`,
              label: '替代换算系数',
              type: 'number',
              required: true,
              value: versionText(
                original?.conversionFactorText ??
                  original?.conversionFactor ??
                  original?.conversion_factor,
                '1',
              ),
            },
          ];
        })
      : [
          {
            name: name('substitute'),
            label: '替代料版本（可选）',
            type: 'select' as const,
            options: [{ value: '', label: '无替代料' }, ...choices],
          },
        ]),
  ];
};

export const BomCreateDrawer = ({ state }: CreateProps) => {
  const rows = state.componentRows;
  const choices = state.ports.itemVersionChoices;
  const source = state.versionSource;
  return (
    <DetailDrawer title={source ? '新建 BOM 版本' : '新建 BOM'} onClose={state.closeForm}>
      <div class="mfg-create-options" data-testid="kt-bom-create-options">
        {source ? (
          <VersionSourceHint source={source} />
        ) : (
          <p class="console-hint">
            从已发布物料版本选择成品与组件；保存后为草稿，确认后可发布并冻结历史。
          </p>
        )}
        <div class="console-chips" data-testid="kt-bom-rows">
          {rows.map((row, index) => (
            <span key={row} class="console-chip" data-testid="kt-bom-row-chip">
              {`组件行 ${String(index + 1)}`}
              <button
                type="button"
                disabled={source !== null && rows.length <= 1}
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
        {source
          ? rows.map((row, index) => (
              <div class="console-chips" key={row}>
                <button
                  type="button"
                  class="secondary compact"
                  data-testid="kt-bom-substitute-add"
                  onClick={() => {
                    state.addSubstitute(row);
                  }}
                >{`第 ${String(index + 1)} 行添加替代料`}</button>
                {(state.substituteRows[row] ?? []).map((sub, subIndex) => (
                  <button
                    key={sub}
                    type="button"
                    class="secondary compact"
                    data-testid="kt-bom-substitute-remove"
                    onClick={() => {
                      state.removeSubstitute(row, sub);
                    }}
                  >{`移除替代料 ${String(subIndex + 1)}`}</button>
                ))}
              </div>
            ))
          : null}
      </div>
      {/* 提交失败的原因显示在表单自己的提示区（FormSection 的 error）：此前它在抽屉顶部，
          组件行多的时候，滚到提交按钮时已经在视口上方（TD-WF-012）。 */}
      <FormSection
        title={source ? '编辑草稿内容' : '新建标准 BOM'}
        description="从已发布物料版本选择成品、组件和可选替代料。"
        fields={[
          ...(source
            ? []
            : [
                { name: 'code', label: 'BOM 编码', required: true, maxLength: 64 },
                { name: 'name', label: 'BOM 名称', required: true },
              ]),
          {
            name: 'product',
            label: '成品版本',
            type: 'select',
            required: true,
            options: productVersionOptions(
              choices,
              source,
              state.detail?.productItemId ?? state.selected?.productItemId,
            ),
            ...(source
              ? {
                  value: versionText(source.product_item_version_id ?? source.productItemVersionId),
                }
              : {}),
          },
          ...(source
            ? [
                {
                  name: 'outputQuantity',
                  label: 'BOM 产出量',
                  type: 'number' as const,
                  required: true,
                  value: versionText(
                    source.outputQuantityText ?? source.outputQuantity ?? source.output_quantity,
                  ),
                },
              ]
            : []),
          ...rows.flatMap((row) => rowFields(choices, row, state)),
          {
            name: 'effectiveAt',
            label: '生效日期',
            type: 'date',
            required: true,
            value: source ? versionDay(source) : today(),
          },
        ]}
        submitLabel="保存 BOM 草稿"
        error={state.submitError}
        onSubmit={(values) => state.runCreate(values)}
      />
    </DetailDrawer>
  );
};
