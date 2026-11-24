// U3-MFG-3（ADR-0014 分域重写）：新建工艺路线抽屉——产品版本选择 + 工序编辑器
//（增删工序、上移下移排序；字段与 legacy 表单一致）。单工序、无额外字段的载荷与
// vanilla「创建标准工艺路线」表单逐字节一致（publish 恒 false；sequence 按行序
// 10/20/30… 重排；instructions {}）。
import { DetailDrawer, FormSection, type FormSectionField } from '@kingturf/ui';
import type { RoutingViewState } from './routing-state';

type CreateProps = Readonly<{ state: RoutingViewState }>;

const today = (): string => new Date().toISOString().slice(0, 10);

// 工序行字段（每行：工序编码/名称/工作中心/准备/单件）一律带行前缀——首工序行的
// name 与路线级名称字段同名，FormSection 按字段名存状态会互相覆盖（载荷形状不受
// 字段名影响）；sequence 由行序重排，不是表单字段。
const operationFields = (row: string): readonly FormSectionField[] => {
  const name = (field: string): string => `${row}:${field}`;
  return [
    { name: name('operationCode'), label: '工序编码', required: true, maxLength: 64 },
    { name: name('name'), label: '工序名称', required: true },
    { name: name('workCenterCode'), label: '工作中心', required: true, maxLength: 64 },
    {
      name: name('setupMinutes'),
      label: '准备工时（分钟）',
      type: 'number',
      required: true,
      value: '60',
    },
    {
      name: name('runMinutesPerUnit'),
      label: '单件工时（分钟）',
      type: 'number',
      required: true,
      value: '0.8',
    },
  ];
};

const OperationToolbar = ({ state }: CreateProps) => (
  <div class="mfg-create-options" data-testid="kt-routing-op-toolbar">
    <div class="console-chips" data-testid="kt-routing-op-rows">
      {state.operationRows.map((row, index) => (
        <span key={row} class="console-chip" data-testid="kt-routing-op-chip">
          {`工序行 ${String(index + 1)}`}
          <button
            type="button"
            class="mfg-chip-remove"
            aria-label="上移该工序"
            data-testid="kt-routing-op-up"
            disabled={index === 0}
            onClick={() => {
              state.moveOperationRow(row, 'up');
            }}
          >
            ↑
          </button>
          <button
            type="button"
            class="mfg-chip-remove"
            aria-label="下移该工序"
            data-testid="kt-routing-op-down"
            disabled={index === state.operationRows.length - 1}
            onClick={() => {
              state.moveOperationRow(row, 'down');
            }}
          >
            ↓
          </button>
          {row !== 'o1' ? (
            <button
              type="button"
              class="mfg-chip-remove"
              aria-label="移除该工序"
              data-testid="kt-routing-op-remove"
              onClick={() => {
                state.removeOperationRow(row);
              }}
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-routing-op-add"
        onClick={state.addOperationRow}
      >
        ＋ 添加工序
      </button>
    </div>
    <p class="console-hint">工序按行序自动编号（10/20/30…）；上移/下移调整执行顺序。</p>
  </div>
);

export const RoutingCreateDrawer = ({ state }: CreateProps) => (
  <DetailDrawer title="新建工艺路线" onClose={state.closeForm}>
    <OperationToolbar state={state} />
    {/* 提交失败的原因显示在表单自己的提示区（FormSection 的 error）：此前它在抽屉顶部，
        工序行多的时候，滚到提交按钮时已经在视口上方（TD-WF-012）。 */}
    <FormSection
      title="创建标准工艺路线"
      description="定义成品的标准工序及节拍；保存后为草稿，确认后可发布并冻结历史。"
      fields={[
        { name: 'code', label: '路线编码', required: true, maxLength: 64 },
        { name: 'name', label: '路线名称', required: true },
        {
          name: 'product',
          label: '成品版本',
          type: 'select',
          required: true,
          options: state.ports.itemVersionChoices,
        },
        ...state.operationRows.flatMap((row) => operationFields(row)),
        {
          name: 'effectiveAt',
          label: '生效日期',
          type: 'date',
          required: true,
          value: today(),
        },
      ]}
      submitLabel="保存路线草稿"
      error={state.submitError}
      onSubmit={(values) => state.runCreate(values)}
    />
  </DetailDrawer>
);
