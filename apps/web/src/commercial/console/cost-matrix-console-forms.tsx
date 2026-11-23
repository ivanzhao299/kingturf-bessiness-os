import { DetailDrawer, FormSection, type FormSectionField } from '@kingturf/ui';
import {
  CATEGORY_OPTIONS,
  SOURCE_OPTIONS,
  UNIT_OPTIONS,
  createCostFactorFields,
} from '../cost-factor-form';
import type { MatrixPageState } from './cost-matrix-console';

// COM-UX（G1 拆分）：成本矩阵新建/因子表单子组件，与主列表页共享状态面。
export { CreateDrawer, FactorForm };

const recordOf = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const FactorForm = ({ state }: Readonly<{ state: MatrixPageState }>) => {
  const matrix = state.selected;
  if (!matrix) return null;
  const editing = state.activeForm === 'editFactor';
  const factor = editing ? (state.editingFactor ?? {}) : undefined;
  const fields = createCostFactorFields(
    {
      itemVersions: state.ports.itemVersions,
      categoryOptions: CATEGORY_OPTIONS,
      sourceOptions: SOURCE_OPTIONS,
      unitOptions: UNIT_OPTIONS,
    },
    state.ports.textValue,
  )(recordOf(matrix), factor) as readonly FormSectionField[];
  return (
    <FormSection
      title={editing ? '更新因子' : '添加因子'}
      description={
        editing ? '因子调整将进入矩阵版本与核算依据。' : '因子来源与数量将进入矩阵版本依据。'
      }
      fields={fields}
      submitLabel={editing ? '保存因子' : '添加因子'}
      onSubmit={(values) => (editing ? state.runUpdateFactor(values) : state.runAddFactor(values))}
    />
  );
};

const CreateDrawer = ({ state }: Readonly<{ state: MatrixPageState }>) => {
  const { ports } = state;
  return (
    <DetailDrawer title="新建规格成本模型" onClose={state.closeForm}>
      <FormSection
        title="新建规格成本模型"
        description="每种成品规格独立维护成本因子、税率和价格来源。"
        fields={[
          { name: 'code', label: '规格模型编号', required: true, placeholder: 'KT-50-3/8' },
          { name: 'name', label: '产品规格名称', required: true, placeholder: '50mm 单丝加密型' },
          ...(ports.itemVersions.length
            ? [
                {
                  name: 'productItemVersionId',
                  label: '关联成品规格',
                  type: 'select' as const,
                  options: [{ value: '', label: '暂不关联' }, ...ports.itemVersions],
                } satisfies FormSectionField,
              ]
            : []),
          {
            name: 'currency',
            label: '币种',
            type: 'select',
            required: true,
            options: [{ value: 'CNY', label: '人民币' }],
          },
          {
            name: 'defaultTaxRate',
            label: '默认税率',
            type: 'number',
            required: true,
            value: '0.13',
          },
        ]}
        submitLabel="创建规格模型"
        onSubmit={(values) => state.runCreate(values)}
      />
    </DetailDrawer>
  );
};
