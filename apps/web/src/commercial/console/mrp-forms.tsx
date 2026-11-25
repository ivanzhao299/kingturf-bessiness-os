// MFG-6：表单抽屉——新建计划政策 / 登记需求信号 / 运行物料需求计算 / 建议决定（批准、拒绝、下达）。
// 字段、类型与默认值同 legacy openForm 表单（载荷构造在 mrp-state.ts，逐字节一致）；提交失败的原因
// 显示在表单自己的提示区（FormSection 的 error）。运行计算与建议决定在表单核对之后先过确认框
//（ConsoleConfirmDialog：说明对哪条建议做什么、之后会怎样），确认后才发请求。
import { DetailDrawer, FormSection, StatusBadge, type FormSectionField } from '@kingturf/ui';
import { STATE_LABELS, TYPE_LABELS, dayOf, rowText, stateTone } from './mrp-state';
import type { MrpDecision, MrpViewState } from './mrp-console-actions';

type Props = Readonly<{ state: MrpViewState }>;
const MAKE_OR_BUY: readonly Readonly<{ value: string; label: string }>[] = [
  { value: 'MAKE', label: '自制' },
  { value: 'BUY', label: '采购' },
];
const isDecision = (form: MrpViewState['activeForm']): form is MrpDecision =>
  form === 'approve' || form === 'reject' || form === 'release';

export const MrpFormDrawer = ({ state }: Props) => {
  const { ports } = state;
  const item = (label: string): FormSectionField => ({
    name: 'itemVersionId',
    label,
    type: 'select',
    required: true,
    options: ports.itemVersionChoices,
    ...(ports.itemVersionChoices.length === 0 ? { hint: '当前没有可选的已发布物料版本' } : {}),
  });
  if (state.activeForm === 'policy')
    return (
      <DetailDrawer title="新建物料计划政策" onClose={state.closeForm}>
        <FormSection
          title="新建物料计划政策"
          description="政策按生效时间追加，固定安全库存、批量、交期和制造/采购方式。"
          fields={[
            item('物料版本'),
            {
              name: 'makeOrBuy',
              label: '供应方式',
              type: 'select',
              required: true,
              options: MAKE_OR_BUY,
            },
            { name: 'safetyStock', label: '安全库存', type: 'number', required: true, value: '0' },
            {
              name: 'minimumOrderQuantity',
              label: '最小批量',
              type: 'number',
              required: true,
              value: '0',
            },
            {
              name: 'orderMultiple',
              label: '批量倍数',
              type: 'number',
              required: true,
              value: '1',
            },
            {
              name: 'leadTimeDays',
              label: '提前期（天）',
              type: 'number',
              required: true,
              value: '0',
            },
            {
              name: 'freezeWindowDays',
              label: '冻结窗口（天）',
              type: 'number',
              required: true,
              value: '0',
            },
            { name: 'effectiveAt', label: '生效日期', type: 'date', required: true },
          ]}
          submitLabel="保存政策"
          error={state.submitError}
          onSubmit={state.runPolicy}
        />
      </DetailDrawer>
    );
  if (state.activeForm === 'demand')
    return (
      <DetailDrawer title="登记独立需求" onClose={state.closeForm}>
        <FormSection
          title="登记独立需求"
          description="需求必须引用已发布物料和业务来源，运行时生成不可变快照。"
          fields={[
            item('需求物料'),
            { name: 'sourceType', label: '来源类型', required: true, value: 'SALES-FORECAST' },
            {
              name: 'sourceId',
              label: '来源业务编号',
              required: true,
              hint: '来源业务单据的标识（UUID）；来源类型是 SALES_ORDER 时须是已放行的销售订单',
            },
            { name: 'requiredAt', label: '需求日期', type: 'date', required: true },
            { name: 'quantity', label: '需求数量', type: 'number', required: true },
            { name: 'priority', label: '优先级', type: 'number', required: true, value: '100' },
          ]}
          submitLabel="保存需求"
          error={state.submitError}
          onSubmit={state.runDemand}
        />
      </DetailDrawer>
    );
  if (state.activeForm === 'run')
    return (
      <DetailDrawer title="运行物料需求计算" onClose={state.closeForm}>
        <FormSection
          title="运行物料需求计算"
          description="运行将固定需求、BOM、政策、合格库存和在途采购快照，并生成可解释建议。"
          fields={[
            { name: 'runNumber', label: '运行编号', required: true },
            { name: 'asOf', label: '计划基准日', type: 'date', required: true },
            { name: 'horizonEnd', label: '计划截止日', type: 'date', required: true },
          ]}
          submitLabel="开始计算"
          error={state.submitError}
          onSubmit={state.runRun}
        />
      </DetailDrawer>
    );
  return null;
};

const DECISION: Readonly<Record<MrpDecision, Readonly<{ title: string; description: string }>>> = {
  approve: {
    title: '批准物料需求建议',
    description: '决定将追加到不可变事件台账。冻结建议必须提供覆盖审批编号。',
  },
  reject: {
    title: '拒绝物料需求建议',
    description: '决定将追加到不可变事件台账。冻结建议必须提供覆盖审批编号。',
  },
  release: {
    title: '下达物料需求建议',
    description: '下达会记录放行决定，请核对数量、日期和供应方式。',
  },
};

// 建议决定表单：先写理由与凭证，点「下一步」出确认框。冻结窗口内的建议多一个覆盖审批编号字段
//（与 legacy 表单同条件出现）。
export const MrpDecisionDrawer = ({ state }: Props) => {
  const form = state.activeForm;
  const target = state.target;
  if (!isDecision(form) || !target) return null;
  const text = (camel: string, snake: string, fallback = ''): string =>
    rowText(state.ports.recordText, target, camel, snake, fallback);
  const status = text('effectiveState', 'effectiveState');
  const fields: readonly FormSectionField[] =
    form === 'release'
      ? [
          { name: 'reason', label: '释放理由', type: 'textarea', required: true },
          { name: 'evidenceReference', label: '计划凭证编号', required: true },
        ]
      : [
          { name: 'reason', label: '决定理由', type: 'textarea', required: true },
          { name: 'approval', label: '审批证据编号', required: true },
          ...(target.frozen === true
            ? [{ name: 'freezeOverrideApproval', label: '冻结覆盖审批编号', required: true }]
            : []),
        ];
  return (
    <DetailDrawer title={DECISION[form].title} onClose={state.closeForm}>
      <div class="console-summary" data-testid="kt-mrp-decision-target">
        <p>
          <span class="console-label">物料</span>
          {`${text('sku', 'sku', '—')} · ${text('itemName', 'itemName')}`}
          <span class="console-label">建议</span>
          {`${TYPE_LABELS[text('proposalType', 'proposal_type')] ?? '建议'} ${text('quantity', 'quantity')}`}
        </p>
        <p>
          <span class="console-label">开始 → 需求日期</span>
          {`${dayOf(target.start_at)} → ${dayOf(target.due_at)}`}
          <span class="console-label">当前</span>
          <StatusBadge tone={stateTone(status)}>{STATE_LABELS[status] ?? status}</StatusBadge>
          {target.frozen === true ? <StatusBadge tone="warning">冻结窗口内</StatusBadge> : null}
        </p>
      </div>
      <FormSection
        title={DECISION[form].title}
        description={DECISION[form].description}
        fields={fields}
        submitLabel="下一步"
        error={state.submitError}
        onSubmit={state.runDecision}
      />
    </DetailDrawer>
  );
};
