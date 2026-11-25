import { signal } from '@preact/signals';
import {
  DataTable,
  DetailDrawer,
  FormSection,
  PageHeader,
  StatusBadge,
  type DataTableColumn,
  type FormSectionField,
  type StatusTone,
} from '@kingturf/ui';
import type { PolicyConsolePorts, PolicyRow } from './policy-ports';
import { failureMessage } from '../../shared/api-error-message';
import { syncSelected } from './selected-sync';
import { FocusAnchor } from './focus-anchor';

// U3-COM-6（ADR-0014 分域重写）：销售政策控制台——原 vanilla policy workbench 能力面
// 等价迁移（新建/版本发布/政策评估；列表/筛选/详情抽屉含版本与毛利规则）。
type PolicyFormKind = 'create' | 'version' | null;

type PolicyPageState = Readonly<{
  policies: readonly PolicyRow[];
  evaluations: readonly PolicyRow[];
  statusFilter: 'ALL' | 'PUBLISHED' | 'DRAFT' | 'RETIRED';
  search: string;
  loadError: string;
  submitError: string;
  loading: boolean;
  selected: PolicyRow | null;
  activeForm: PolicyFormKind;
  permissions: ReadonlySet<string>;
  ports: PolicyConsolePorts;
  open: (row: PolicyRow | null) => void;
  openForm: (kind: PolicyFormKind) => void;
  closeForm: () => void;
  setStatusFilter: (next: 'ALL' | 'PUBLISHED' | 'DRAFT' | 'RETIRED') => void;
  setSearch: (next: string) => void;
  showMore: () => void;
  runRefresh: () => Promise<void>;
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
  runVersion: (row: PolicyRow, values: Readonly<Record<string, string>>) => Promise<void>;
  runEvaluate: (values: Readonly<Record<string, string>>) => Promise<void>;
}>;

const STATUS_LABELS: Readonly<Record<string, string>> = {
  PUBLISHED: '已发布',
  DRAFT: '草稿',
  RETIRED: '已退役',
};

const statusTone = (status: unknown): StatusTone => {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'RETIRED') return 'neutral';
  return 'info';
};

// vanilla policy-view 同源的政策规则构造（最低毛利红线 + 折扣上限）。
const policyRules = (values: Readonly<Record<string, string>>) => {
  const minimumMargin = Math.round(Number(values.minimumMargin ?? 0) * 100);
  const maximumDiscount = Math.round(Number(values.maximumDiscount ?? 0) * 100);
  return {
    rules: [
      {
        when: {
          op: 'lt',
          left: { op: 'input', path: 'marginBasisPoints' },
          right: { op: 'literal', value: minimumMargin },
        },
        effect: {
          passed: false,
          approvalRequired: true,
          minimumMarginBasisPoints: minimumMargin,
        },
        reason: `毛利率低于 ${values.minimumMargin ?? '0'}% 红线`,
      },
      {
        when: {
          op: 'gt',
          left: { op: 'input', path: 'discountBasisPoints' },
          right: { op: 'literal', value: maximumDiscount },
        },
        effect: { approvalRequired: true, maximumDiscountBasisPoints: maximumDiscount },
        reason: `折扣超过 ${values.maximumDiscount ?? '0'}% 上限`,
      },
    ],
    publish: true,
  };
};

const MARGIN_FIELDS: readonly FormSectionField[] = [
  { name: 'minimumMargin', label: '最低毛利率（%）', type: 'number', required: true, value: '20' },
  { name: 'maximumDiscount', label: '最大折扣（%）', type: 'number', required: true, value: '10' },
];

const columns = (state: PolicyPageState): readonly DataTableColumn<PolicyRow>[] => [
  {
    key: 'code',
    header: '销售政策',
    field: (row) => state.ports.textValue(row.code, '政策'),
    render: (row) => (
      <span>
        {state.ports.textValue(row.code, '政策')} · 第 {state.ports.textValue(row.version, '1')} 版
      </span>
    ),
  },
  {
    key: 'status',
    header: '状态',
    field: (row) => state.ports.textValue(row.status, 'DRAFT'),
    render: (row) => (
      <StatusBadge tone={statusTone(row.status)}>
        {STATUS_LABELS[state.ports.textValue(row.status, 'DRAFT')] ?? '—'}
      </StatusBadge>
    ),
  },
  {
    key: 'name',
    header: '名称',
    field: (row) => state.ports.textValue(row.name, ''),
    render: (row) => (
      <span>
        {state.ports.textValue(row.name, '')} ·{' '}
        {String((Array.isArray(row.rules) ? row.rules : []).length)} 条规则
      </span>
    ),
  },
  {
    key: 'publishedAt',
    header: '发布时间',
    field: (row) => state.ports.textValue(row.publishedAt, ''),
    render: (row) => state.ports.textValue(row.publishedAt, '—').slice(0, 10),
  },
  {
    key: 'actions',
    header: '操作',
    field: () => '查看',
    render: (row) => (
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-policy-open"
        onClick={() => {
          state.open(row);
        }}
      >
        查看
      </button>
    ),
  },
];

const filteredPolicies = (state: PolicyPageState): readonly PolicyRow[] =>
  state.policies.filter((row) => {
    if (state.statusFilter !== 'ALL' && row.status !== state.statusFilter) return false;
    if (state.search === '') return true;
    return state.ports.textValue(row.code, '').toLowerCase().includes(state.search.toLowerCase());
  });

const PolicyDetail = ({ state }: Readonly<{ state: PolicyPageState }>) => {
  const policy = state.selected;
  if (!policy) return null;
  const { ports } = state;
  const rules = Array.isArray(policy.rules) ? policy.rules : [];
  const versions = state.policies.filter((item) => item.definitionId === policy.definitionId);
  return (
    <div class="console-summary" data-testid="kt-policy-detail">
      <p>
        <span class="console-label">状态</span>
        <StatusBadge tone={statusTone(policy.status)}>
          {STATUS_LABELS[ports.textValue(policy.status, 'DRAFT')] ?? '—'}
        </StatusBadge>
        <span class="console-label">名称</span>
        {ports.textValue(policy.name, '—')}
        <span class="console-label">发布</span>
        {ports.textValue(policy.publishedAt, '—').slice(0, 10)}
      </p>
      <div data-testid="kt-policy-rules">
        <span class="console-label">毛利规则</span>
        {rules.map((rule) => {
          const item = ports.recordValue(rule);
          const effect = ports.recordValue(item.effect);
          const reason = ports.textValue(item.reason, '规则');
          return (
            <p key={reason}>
              {reason}
              {effect.minimumMarginBasisPoints !== undefined
                ? ` · 最低毛利 ${String(Number(effect.minimumMarginBasisPoints) / 100)}%`
                : ''}
              {effect.maximumDiscountBasisPoints !== undefined
                ? ` · 最大折扣 ${String(Number(effect.maximumDiscountBasisPoints) / 100)}%`
                : ''}
            </p>
          );
        })}
      </div>
      <div data-testid="kt-policy-versions">
        <span class="console-label">版本历史</span>
        {versions
          .slice()
          .sort((left, right) => Number(left.version ?? 0) - Number(right.version ?? 0))
          .map((item) => (
            <p key={ports.textValue(item.id, '')}>
              第 {ports.textValue(item.version, '1')} 版 ·{' '}
              {STATUS_LABELS[ports.textValue(item.status, 'DRAFT')] ?? '—'} ·{' '}
              {ports.textValue(item.publishedAt, '—').slice(0, 10)}
            </p>
          ))}
      </div>
    </div>
  );
};

const PolicyDrawer = ({ state }: Readonly<{ state: PolicyPageState }>) => {
  const policy = state.selected;
  if (!policy) return null;
  const { ports, permissions } = state;
  const mayManage = permissions.has('sales-policy:manage');
  const isLatest =
    Number(policy.version ?? 0) ===
    Math.max(
      ...state.policies
        .filter((item) => item.definitionId === policy.definitionId)
        .map((item) => Number(item.version ?? 0)),
    );
  return (
    <DetailDrawer
      title={`政策详情 · ${ports.textValue(policy.code, '政策')} · 第 ${ports.textValue(policy.version, '1')} 版`}
      onClose={() => {
        state.open(null);
      }}
    >
      <PolicyDetail state={state} />
      {/* TD-WF-005 / TD-WF-012：行内表单开着时，提交失败显示在该表单自己的提示区（FormSection 的
          error，紧挨提交按钮）；这里的错误位只留给不经表单的动作。 */}
      {state.activeForm === null && state.submitError !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-policy-submit-error">
          {state.submitError}
        </p>
      ) : null}
      {mayManage && isLatest && state.activeForm === null ? (
        <div class="console-actions" data-testid="kt-policy-actions">
          <button
            type="button"
            class="secondary"
            data-testid="kt-policy-new-version"
            onClick={() => {
              state.openForm('version');
            }}
          >
            新建政策版本
          </button>
        </div>
      ) : null}
      {state.activeForm === 'version' ? (
        <FormSection
          title={`修订 ${ports.textValue(policy.code, '销售政策')}`}
          description="新版本只影响后续评估，历史政策决策保持原版本引用。"
          fields={MARGIN_FIELDS}
          submitLabel="发布新版本"
          error={state.submitError}
          onSubmit={(values) => state.runVersion(policy, values)}
        />
      ) : null}
      {/* TD-WF-014④：新版本表单开合后，把键盘焦点带回抽屉。 */}
      <FocusAnchor token={String(state.activeForm)} />
    </DetailDrawer>
  );
};

const CreateDrawer = ({ state }: Readonly<{ state: PolicyPageState }>) => (
  <DetailDrawer title="新建销售政策" onClose={state.closeForm}>
    <FormSection
      title="新建销售政策"
      description="低于最低毛利率将阻止通过；超过折扣上限将要求人工审批。"
      fields={[
        { name: 'code', label: '政策编号', required: true, placeholder: 'SP-2026-01' },
        { name: 'name', label: '政策名称', required: true, placeholder: '标准销售政策' },
        ...MARGIN_FIELDS,
      ]}
      submitLabel="发布政策"
      error={state.submitError}
      onSubmit={(values) => state.runCreate(values)}
    />
  </DetailDrawer>
);

const EvaluateForm = ({ state }: Readonly<{ state: PolicyPageState }>) => {
  const { ports } = state;
  const published = state.policies.filter((item: PolicyRow) => item.status === 'PUBLISHED');
  const costs = state.ports.initialCosts;
  if (published.length === 0 || costs.length === 0) return null;
  return (
    <FormSection
      title="执行政策评估"
      description="按已发布政策与成本决策评估毛利与折扣。"
      fields={[
        {
          name: 'policyVersionId',
          label: '已发布政策',
          type: 'select',
          required: true,
          options: published.map((item) => ({
            value: ports.textValue(item.id, ''),
            label: `${ports.textValue(item.code, '政策')} · 第 ${ports.textValue(item.version, '1')} 版`,
          })),
        },
        {
          name: 'costDecisionId',
          label: '成本决策',
          type: 'select',
          required: true,
          options: costs.map((item) => ({
            value: ports.textValue(item.id, ''),
            label: `${ports.textValue(item.currency, '')} ${ports.textValue(item.total, '—')} · ${ports.textValue(item.id, '').slice(0, 8)}`,
          })),
        },
        { name: 'margin', label: '拟定毛利（%）', type: 'number', required: true, value: '0' },
        { name: 'discount', label: '拟定折扣（%）', type: 'number', required: true, value: '0' },
      ]}
      submitLabel="执行政策评估"
      onSubmit={(values) => state.runEvaluate(values)}
    />
  );
};

const EvaluationsList = ({ state }: Readonly<{ state: PolicyPageState }>) => {
  const { ports } = state;
  const evaluations = state.evaluations;
  return (
    <div class="commercial-console-metrics" data-testid="kt-policy-evaluations">
      {evaluations.map((evaluation) => {
        const passed = evaluation.passed === true;
        const approval = evaluation.approvalRequired === true;
        const reasons = Array.isArray(evaluation.reasons) ? evaluation.reasons : [];
        return (
          <article class="decision-card" key={ports.textValue(evaluation.id, '评估')}>
            <p class="eyebrow">销售政策判定</p>
            <strong class={passed ? 'decision-pass' : 'decision-fail'}>
              {passed ? '政策通过' : '政策未通过'}
            </strong>
            <p class="muted">{approval ? '需要人工审批' : '无需额外审批'}</p>
            <p class="version-pin">
              {`政策 ${ports.textValue(evaluation.policyVersionId, '').slice(0, 8)} · 成本 ${ports.textValue(evaluation.costDecisionId, '').slice(0, 8)}`}
            </p>
            {reasons.map((reason) => (
              <p class="rule-hit" key={ports.textValue(reason, '规则')}>
                {ports.textValue(reason, '规则命中')}
              </p>
            ))}
            <p class="policy-boundary">
              {`最低毛利率 ${String(Number(evaluation.minimumMarginBasisPoints ?? 0) / 100)}% · 最大折扣 ${String(Number(evaluation.maximumDiscountBasisPoints ?? 0) / 100)}%`}
            </p>
            <code class="input-hash">{ports.textValue(evaluation.inputHash, '')}</code>
          </article>
        );
      })}
      {evaluations.length === 0 ? <p class="pipeline-empty">暂无销售政策评估结果。</p> : null}
    </div>
  );
};

const PolicyView = (state: PolicyPageState) => {
  const visible = filteredPolicies(state);
  const shown = visible.slice(0, 20);
  const mayManage = state.permissions.has('sales-policy:manage');
  return (
    <div class="commercial-console-page" data-testid="kt-policy-page">
      <PageHeader
        title="销售政策评估"
        description="毛利、折扣与审批政策"
        actions={
          mayManage ? (
            <button
              type="button"
              class="primary"
              data-testid="kt-policy-create"
              onClick={() => {
                state.openForm('create');
              }}
            >
              ＋ 新建销售政策
            </button>
          ) : null
        }
      />
      <div class="commercial-console-filters">
        {(['ALL', 'PUBLISHED', 'DRAFT', 'RETIRED'] as const).map((option) => (
          <button
            key={option}
            type="button"
            class={state.statusFilter === option ? 'secondary compact active' : 'secondary compact'}
            data-testid={`kt-policy-filter-${option.toLowerCase()}`}
            onClick={() => {
              state.setStatusFilter(option);
            }}
          >
            {option === 'ALL' ? '全部' : (STATUS_LABELS[option] ?? option)}
          </button>
        ))}
        <input
          type="search"
          placeholder="按编号检索"
          data-testid="kt-policy-search"
          value={state.search}
          onInput={(event) => {
            state.setSearch((event.target as { value?: string }).value ?? '');
          }}
        />
      </div>
      {state.loadError !== '' ? (
        <p class="console-error" role="alert">
          {state.loadError}
        </p>
      ) : null}
      <DataTable
        columns={columns(state)}
        rows={shown}
        rowId={(row) => state.ports.textValue(row.id ?? row.code, 'row')}
        caption="销售政策主列表（版本、状态与规则）"
        loading={state.loading}
        pagination={{
          loadedCount: shown.length,
          hasMore: visible.length > shown.length,
          loading: false,
          onLoadMore: () => {
            state.showMore();
          },
        }}
        {...(state.loadError === '' ? {} : { error: state.loadError })}
        emptyTitle="暂无销售政策"
        emptyDescription="新建销售政策后会出现在这里"
      />
      {state.selected ? <PolicyDrawer state={state} /> : null}
      {state.activeForm === 'create' ? <CreateDrawer state={state} /> : null}
      <EvaluationsList state={state} />
      {state.permissions.has('sales-policy:evaluate') ? <EvaluateForm state={state} /> : null}
    </div>
  );
};

export function PolicyConsolePage(ports: PolicyConsolePorts) {
  const bundle = {
    policies: signal<readonly PolicyRow[]>([...ports.initialPolicies]),
    costs: signal<readonly PolicyRow[]>([...ports.initialCosts]),
    evaluations: signal<readonly PolicyRow[]>([...ports.initialEvaluations]),
    statusFilter: signal<'ALL' | 'PUBLISHED' | 'DRAFT' | 'RETIRED'>('ALL'),
    search: signal(''),
    loadError: signal(''),
    submitError: signal(''),
    loading: signal(false),
    selected: signal<PolicyRow | null>(null),
    activeForm: signal<PolicyFormKind>(null),
    shownCount: signal(20),
  };

  const fail = (error: unknown, fallback: string): void => {
    const message = failureMessage(error, fallback);
    if (bundle.selected.value !== null || bundle.activeForm.value !== null)
      bundle.submitError.value = message;
    else bundle.loadError.value = message;
  };
  const closeForm = (): void => {
    bundle.activeForm.value = null;
    bundle.submitError.value = '';
  };

  // TD-WF-008：列表换新的之后，抽屉里开着的那条也换成刷新后的行（已不在列表里则关闭抽屉）。
  const applyPolicies = (policies: readonly PolicyRow[]): void => {
    bundle.policies.value = policies;
    syncSelected({
      selected: bundle.selected,
      rows: policies,
      idOf: (row) => ports.textValue(row.id ?? row.code, ''),
    });
  };

  const runRefresh = async (): Promise<void> => {
    bundle.loading.value = true;
    try {
      const fresh = await ports.refresh();
      applyPolicies(fresh.policies);
      bundle.costs.value = fresh.costs;
      bundle.evaluations.value = fresh.evaluations;
      bundle.loadError.value = '';
    } catch (error: unknown) {
      fail(error, '销售政策加载失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const runCreate = async (values: Readonly<Record<string, string>>): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit('/api/v1/sales-policies', {
        code: values.code ?? '',
        name: values.name ?? '',
        ...policyRules(values),
      });
      const fresh = await ports.refresh();
      applyPolicies(fresh.policies);
      closeForm();
    } catch (error: unknown) {
      fail(error, '销售政策创建失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const runVersion = async (
    policy: PolicyRow,
    values: Readonly<Record<string, string>>,
  ): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit(
        `/api/v1/sales-policies/${ports.textValue(policy.definitionId, '')}/versions`,
        policyRules(values),
        'PUT',
      );
      const fresh = await ports.refresh();
      applyPolicies(fresh.policies);
      closeForm();
    } catch (error: unknown) {
      fail(error, '政策版本发布失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const runEvaluate = async (values: Readonly<Record<string, string>>): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit('/api/v1/sales-policy-evaluations', {
        policyVersionId: values.policyVersionId ?? '',
        costDecisionId: values.costDecisionId ?? '',
        context: {
          marginBasisPoints: Math.round(Number(values.margin ?? 0) * 100),
          discountBasisPoints: Math.round(Number(values.discount ?? 0) * 100),
        },
      });
      const fresh = await ports.refresh();
      bundle.evaluations.value = fresh.evaluations;
      bundle.loadError.value = '';
    } catch (error: unknown) {
      fail(error, '政策评估失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const state = (): PolicyPageState => ({
    policies: bundle.policies.value,
    statusFilter: bundle.statusFilter.value,
    search: bundle.search.value,
    loadError: bundle.loadError.value,
    submitError: bundle.submitError.value,
    loading: bundle.loading.value,
    selected: bundle.selected.value,
    activeForm: bundle.activeForm.value,
    evaluations: bundle.evaluations.value,
    permissions: ports.permissions,
    ports,
    open: (row) => {
      bundle.selected.value = row;
      bundle.activeForm.value = null;
      bundle.submitError.value = '';
    },
    openForm: (kind) => {
      bundle.activeForm.value = kind;
      bundle.submitError.value = '';
    },
    closeForm,
    setStatusFilter: (next) => {
      bundle.statusFilter.value = next;
    },
    setSearch: (next) => {
      bundle.search.value = next;
    },
    showMore: () => {
      bundle.shownCount.value = bundle.shownCount.value + 20;
    },
    runRefresh,
    runCreate,
    runVersion,
    runEvaluate,
  });

  const Page = () => PolicyView(state());
  return Page;
}
