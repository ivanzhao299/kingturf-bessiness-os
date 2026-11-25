// U3-MFG-1（ADR-0014 分域重写）：新建物料抽屉——载荷与原 vanilla「创建物料版本」
// 表单逐字节一致（publish 恒 false：保存为草稿，发布为独立的行级动作）；规格参数
// 按物料类型动态预设，自定义键值行始终可加。
import { VersionSourceHint, versionDay } from './manufacturing-version-ui';
import { DetailDrawer, FormSection, type FormSectionField } from '@kingturf/ui';
import {
  CATEGORY_LABELS,
  ITEM_CATEGORIES,
  SPEC_PRESETS,
  specPreset,
  type ItemCategory,
  type ItemViewState,
} from './item-state';

type CreateProps = Readonly<{ state: ItemViewState }>;

// 生效日期默认当天（vanilla 表单同源）。
const today = (): string => new Date().toISOString().slice(0, 10);

const baseFields = (): readonly FormSectionField[] => [
  {
    name: 'sku',
    label: 'SKU 编码',
    required: true,
    placeholder: 'FG-KT-PRO-50',
    maxLength: 64,
    hint: '1–64 位大写字母、数字、下划线或连字符',
  },
  { name: 'name', label: '物料名称', required: true },
  {
    name: 'baseUnitCode',
    label: '基本单位',
    required: true,
    value: 'M2',
    hint: '须为已登记的计量单位代码，常用：EA / KG / M / M2 / HOUR',
  },
  { name: 'effectiveAt', label: '生效日期', type: 'date', required: true, value: today() },
];

// 规格行 → 表单字段：预设行只填值（标签即参数名），自定义行填参数名与值。
const specFields = (state: ItemViewState): readonly FormSectionField[] =>
  state.specRows.flatMap((row): readonly FormSectionField[] => {
    const preset = specPreset(row.preset);
    if (row.preset !== '' && preset)
      return [
        {
          name: `spec:${row.id}:value`,
          label: preset.label,
          type: preset.numeric ? 'number' : 'text',
          required: true,
          hint: `参数键 ${preset.key}`,
          ...(row.original ? { value: row.original.text } : {}),
        },
      ];
    return [
      {
        name: `spec:${row.id}:key`,
        label: '自定义参数名',
        required: true,
        placeholder: '如 pileHeightMm',
        ...(row.original ? { value: row.original.key } : {}),
      },
      {
        name: `spec:${row.id}:value`,
        label: '自定义参数值',
        required: !row.original || typeof row.original.value !== 'string',
        ...(row.original ? { value: row.original.text } : {}),
      },
    ];
  });

const SpecToolbar = ({ state }: CreateProps) => (
  <div class="mfg-create-options" data-testid="kt-item-spec-toolbar">
    {!state.versionSource ? (
      <label class="form-field">
        <span>
          物料类型
          <em class="required-mark">必填</em>
        </span>
        <select
          data-testid="kt-item-create-type"
          value={state.createType}
          onInput={(event) => {
            const next = (event.target as { value?: string }).value ?? '';
            if ((ITEM_CATEGORIES as readonly string[]).includes(next))
              state.setCreateType(next as ItemCategory);
          }}
        >
          {ITEM_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </label>
    ) : null}
    <div data-testid="kt-item-spec-presets">
      <p class="console-label">规格参数（可选，按物料类型给出）</p>
      <div class="console-chips">
        {SPEC_PRESETS[state.createType].map((preset) => (
          <button
            key={preset.key}
            type="button"
            class="secondary compact"
            data-testid="kt-item-spec-preset"
            onClick={() => {
              state.addSpecRow(preset.key);
            }}
          >
            {`＋ ${preset.label}`}
          </button>
        ))}
        <button
          type="button"
          class="secondary compact"
          data-testid="kt-item-spec-custom"
          onClick={() => {
            state.addSpecRow('');
          }}
        >
          ＋ 自定义参数
        </button>
      </div>
    </div>
    {state.specRows.length > 0 ? (
      <div class="console-chips" data-testid="kt-item-spec-rows">
        {state.specRows.map((row) => (
          <span key={row.id} class="console-chip" data-testid="kt-item-spec-row">
            {row.preset === '' ? '自定义参数' : (specPreset(row.preset)?.label ?? row.preset)}
            <button
              type="button"
              class="mfg-chip-remove"
              aria-label="移除该规格参数"
              data-testid="kt-item-spec-remove"
              onClick={() => {
                state.removeSpecRow(row.id);
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    ) : null}
  </div>
);

export const ItemCreateDrawer = ({ state }: CreateProps) => (
  <DetailDrawer title={state.versionSource ? '新建物料版本' : '新建物料'} onClose={state.closeForm}>
    {state.versionSource ? <VersionSourceHint source={state.versionSource} /> : null}
    <SpecToolbar state={state} />
    {/* 提交失败的原因显示在表单自己的提示区（FormSection 的 error）：此前它在抽屉顶部，
        规格行多的时候，滚到提交按钮时已经在视口上方（TD-WF-012）。 */}
    <FormSection
      title={state.versionSource ? '编辑草稿内容' : '新建物料'}
      description="建立稳定 SKU 和规格版本；保存后为草稿，确认后可发布并冻结历史。"
      fields={[
        ...(state.versionSource
          ? [
              {
                name: 'effectiveAt',
                label: '生效日期',
                type: 'date' as const,
                required: true,
                value: versionDay(state.versionSource),
              },
            ]
          : baseFields()),
        ...specFields(state),
      ]}
      submitLabel="保存草稿"
      error={state.submitError}
      onSubmit={(values) => state.runCreate(values)}
    />
  </DetailDrawer>
);
