import { FormSection, type FormSectionField } from '@kingturf/ui';
import type { QuotePageState } from './quote-console';

// U3-COM-3（G1 拆分）：报价表单子组件（新建/修订/批准/签发），与主列表页共享状态面。
export { ReviseForm, ApproveForm, IssueForm, CreateForm };

const ReviseForm = ({ state }: Readonly<{ state: QuotePageState }>) => {
  const quote = state.selected;
  if (!quote) return null;
  return (
    <FormSection
      title="创建报价修订"
      description="基于当前签发版本调整整单折扣与有效期；原签发快照保持只读。"
      fields={[
        {
          name: 'discountPercent',
          label: '新整单折扣（%）',
          type: 'number',
          required: true,
          value: String((Number(quote.discount ?? 0) * 100) / Number(quote.subtotal ?? 1)),
        },
        { name: 'validUntil', label: '新有效期至', type: 'date', required: true },
      ]}
      submitLabel="校验并创建修订"
      onSubmit={(values) => state.runRevise(quote, values)}
    />
  );
};

const ApproveForm = ({ state }: Readonly<{ state: QuotePageState }>) => (
  <FormSection
    title="批准报价"
    description="审批决定和理由将进入不可变证据链。"
    fields={[{ name: 'reason', label: '审批意见', type: 'textarea', required: true }]}
    submitLabel="确认批准"
    onSubmit={(values) => {
      if (state.selected) void state.runCommand(state.selected, 'approve', values);
    }}
  />
);

const IssueForm = ({ state }: Readonly<{ state: QuotePageState }>) => (
  <FormSection
    title="签发报价"
    description="签发后将生成只读快照，后续合同只能引用该快照。"
    fields={[]}
    submitLabel="确认签发"
    onSubmit={(values) => {
      if (state.selected) void state.runCommand(state.selected, 'issue', values);
    }}
  />
);

const CreateForm = ({ state }: Readonly<{ state: QuotePageState }>) => {
  const { ports } = state;
  const fields: readonly FormSectionField[] = [
    { name: 'quoteNumber', label: '报价编号', required: true, placeholder: 'Q-2026-001' },
    {
      name: 'costDecisionId',
      label: '成本决策',
      type: 'select',
      required: true,
      ...(ports.initialSnapshot.preferredCostDecisionId
        ? { value: ports.initialSnapshot.preferredCostDecisionId }
        : {}),
      options: state.snapshot.costs.map((item) => ({
        value: ports.textValue(item.id, ''),
        label: `${ports.textValue(item.currency, '')} ${ports.textValue(item.total, '—')} · ${ports.textValue(item.id, '').slice(0, 8)}`,
      })),
    },
    {
      name: 'policyVersionId',
      label: '销售政策版本',
      type: 'select',
      required: true,
      options: state.snapshot.policies.map((item) => ({
        value: ports.textValue(item.id, ''),
        label: `${ports.textValue(item.code, '政策')} · 第 ${ports.textValue(item.version, '1')} 版`,
      })),
    },
    {
      name: 'turfQuantity',
      label: '草坪数量（㎡）',
      type: 'number',
      required: true,
      value: '8050',
    },
    {
      name: 'turfPrice',
      label: '草坪销售单价（元/㎡）',
      type: 'number',
      required: true,
      value: '108',
    },
    {
      name: 'installationQuantity',
      label: '铺装数量（㎡）',
      type: 'number',
      required: true,
      value: '8050',
    },
    {
      name: 'installationPrice',
      label: '铺装销售单价（元/㎡）',
      type: 'number',
      required: true,
      value: '28',
    },
    {
      name: 'serviceQuantity',
      label: '项目服务项数量',
      type: 'number',
      required: true,
      value: '1',
    },
    {
      name: 'servicePrice',
      label: '项目服务费（元）',
      type: 'number',
      required: true,
      value: '60000',
    },
    { name: 'discountPercent', label: '整单折扣（%）', type: 'number', required: true, value: '0' },
    { name: 'validUntil', label: '报价有效期至', type: 'date', required: true },
  ];
  return (
    <FormSection
      title="新建销售报价"
      description="系统先校验销售政策，再由服务器重算每一行、折扣与毛利。"
      fields={fields}
      submitLabel="校验并创建报价"
      onSubmit={(values) => state.runCreate(values)}
    />
  );
};
