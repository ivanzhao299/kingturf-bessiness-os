import { signal } from '@preact/signals';
import {
  DataTable,
  DetailDrawer,
  EmptyState,
  FormSection,
  PageHeader,
  StatusBadge,
  type DataTableColumn,
  type FormSectionField,
  type StatusTone,
} from '@kingturf/ui';
import type { OpportunityPipelineSummary } from '../readiness';
import type { Opportunity } from '../types';

// U3-COM-1（ADR-0014 分域重写）：商机列表页 Preact 控制台——原 vanilla pipeline-board
// 的能力面等价迁移（看板概要/新建/阶段推进/逾期标记），端口层收敛为最小 Props 面
//（页面不依赖 SalesViewController，行为测试注入 double）。
export type OpportunityCreator = Readonly<{ id: string; name?: string | null }>;

export type OpportunityListPorts = Readonly<{
  permissions: ReadonlySet<string>;
  initialOpportunities: readonly Opportunity[];
  customers: readonly OpportunityCreator[];
  /** 逾期判定的「今天」（YYYY-MM-DD）；测试注入固定值保证确定性。 */
  today: string;
  displayMoney: (currency: unknown, value: unknown) => string;
  pipelineSummary: (
    opportunities: readonly Opportunity[],
    today?: string,
  ) => OpportunityPipelineSummary;
  createOpportunity: (payload: Record<string, unknown>) => Promise<readonly Opportunity[]>;
  transitionOpportunity: (
    opportunity: Opportunity,
    status: string,
    reason: string,
  ) => Promise<readonly Opportunity[]>;
  refresh: () => Promise<readonly Opportunity[]>;
}>;

const STAGE_LABELS: readonly (readonly [string, string])[] = [
  ['OPEN', '初步接洽'],
  ['QUALIFIED', '需求确认'],
  ['PROPOSAL', '方案报价'],
  ['WON', '赢单'],
  ['LOST', '输单'],
  ['CANCELLED', '已取消'],
];

const NEXT_STAGE: Readonly<Record<string, string>> = {
  OPEN: 'QUALIFIED',
  QUALIFIED: 'PROPOSAL',
  PROPOSAL: 'WON',
};

const stageLabel = (status: unknown): string => {
  const key = typeof status === 'string' ? status : '';
  return STAGE_LABELS.find(([stage]) => stage === key)?.[1] ?? (key === '' ? '—' : key);
};

const stageTone = (status: unknown): StatusTone => {
  if (status === 'WON') return 'success';
  if (status === 'LOST') return 'danger';
  if (status === 'PROPOSAL' || status === 'QUALIFIED') return 'info';
  return 'neutral';
};

// 与 opportunityPipelineSummary/readiness 相同的逾期规则（原卡片 overdue 语义保持）。
export const isOpportunityOverdue = (opportunity: Opportunity, today: string): boolean =>
  !['WON', 'LOST'].includes(opportunity.status ?? 'OPEN') &&
  Boolean(opportunity.expectedCloseDate) &&
  String(opportunity.expectedCloseDate).slice(0, 10) < today;

type OpportunityPageState = Readonly<{
  items: readonly Opportunity[];
  summary: OpportunityPipelineSummary;
  loading: boolean;
  loadError: string;
  selected: Opportunity | null;
  creating: boolean;
  permissions: ReadonlySet<string>;
  today: string;
  customers: readonly OpportunityCreator[];
  displayMoney: (currency: unknown, value: unknown) => string;
  open: (opportunity: Opportunity | null) => void;
  openCreate: () => void;
  closeCreate: () => void;
  runTransition: (opportunity: Opportunity, status: string, reason: string) => Promise<void>;
  runCreate: (payload: Record<string, unknown>) => Promise<void>;
  runRefresh: () => Promise<void>;
}>;

const summaryMetrics = (
  summary: OpportunityPipelineSummary,
): readonly (readonly [string, number, StatusTone])[] => [
  ['在途商机', summary.active, 'neutral'],
  ['已逾期', summary.overdue, summary.overdue > 0 ? 'danger' : 'success'],
  ['30 天内预计成交', summary.closingSoon, 'info'],
  ['未关联客户', summary.customerMissing, summary.customerMissing > 0 ? 'warning' : 'success'],
];

const columns = (state: OpportunityPageState): readonly DataTableColumn<Opportunity>[] => [
  {
    key: 'name',
    header: '商机名称',
    sortable: true,
    field: (row) => row.name ?? row.id,
  },
  {
    key: 'status',
    header: '阶段',
    sortable: true,
    field: (row) => stageLabel(row.status),
    render: (row) => (
      <StatusBadge tone={stageTone(row.status)}>{stageLabel(row.status)}</StatusBadge>
    ),
  },
  {
    key: 'value',
    header: '预计金额',
    sortable: true,
    field: (row) => row.value?.amount ?? '',
    render: (row) =>
      row.value ? state.displayMoney(row.value.currency, row.value.amount) : '金额受限',
  },
  {
    key: 'probability',
    header: '赢率',
    sortable: true,
    field: (row) => (row.probabilityBasisPoints ?? 0) / 100,
    render: (row) => `${String((row.probabilityBasisPoints ?? 0) / 100)}%`,
  },
  {
    key: 'expectedCloseDate',
    header: '预计成交日期',
    sortable: true,
    field: (row) => row.expectedCloseDate ?? '',
    render: (row) => (
      <span data-overdue={isOpportunityOverdue(row, state.today) ? 'true' : 'false'}>
        {row.expectedCloseDate?.slice(0, 10) ?? '日期未定'}
        {isOpportunityOverdue(row, state.today) ? (
          <em class="commercial-console-overdue">成交日期已逾期</em>
        ) : null}
      </span>
    ),
  },
  {
    key: 'actions',
    header: '操作',
    field: () => '查看',
    render: (row) => (
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-opportunity-open"
        onClick={() => {
          state.open(row);
        }}
      >
        查看
      </button>
    ),
  },
];

const OpportunitySummary = ({ state }: Readonly<{ state: OpportunityPageState }>) => (
  <div class="commercial-console-metrics" data-testid="kt-opportunity-summary">
    {summaryMetrics(state.summary).map(([label, value, tone]) => (
      <article class={`pipeline-metric ${tone}`} key={label}>
        <span>{label}</span>
        <strong>{String(value)}</strong>
      </article>
    ))}
  </div>
);

const OpportunityDrawer = ({ state }: Readonly<{ state: OpportunityPageState }>) => {
  const opportunity = state.selected;
  if (!opportunity) return null;
  const nextStage =
    opportunity.status === undefined ? null : (NEXT_STAGE[opportunity.status] ?? null);
  return (
    <DetailDrawer
      title={`商机详情 · ${opportunity.name ?? opportunity.id}`}
      onClose={() => {
        state.open(null);
      }}
    >
      <div class="console-summary" data-testid="kt-opportunity-detail">
        <p>
          <span class="console-label">阶段</span>
          <StatusBadge tone={stageTone(opportunity.status)}>
            {stageLabel(opportunity.status)}
          </StatusBadge>
          <span class="console-label">赢率</span>
          {String((opportunity.probabilityBasisPoints ?? 0) / 100)}%
          <span class="console-label">预计成交</span>
          {opportunity.expectedCloseDate?.slice(0, 10) ?? '日期未定'}
        </p>
        <p>
          <span class="console-label">预计金额</span>
          {opportunity.value
            ? state.displayMoney(opportunity.value.currency, opportunity.value.amount)
            : '金额受限'}
          <span class="console-label">版本</span>
          {String(opportunity.version ?? '—')}
        </p>
      </div>
      {nextStage && state.permissions.has('opportunity:lifecycle') ? (
        <div data-testid="kt-opportunity-transition">
          <FormSection
            title="推进商机阶段"
            description={`从「${stageLabel(opportunity.status)}」推进至「${stageLabel(nextStage)}」。`}
            fields={[{ name: 'reason', label: '推进依据', type: 'textarea', required: true }]}
            submitLabel="确认推进"
            onSubmit={(values) => state.runTransition(opportunity, nextStage, values.reason ?? '')}
          />
        </div>
      ) : (
        <EmptyState title="暂无可用操作" description="推进商机需要 lifecycle 权限或已到终态" />
      )}
    </DetailDrawer>
  );
};

const createFields = (customers: readonly OpportunityCreator[]): readonly FormSectionField[] => [
  {
    name: 'customerId',
    label: '关联客户',
    type: 'select',
    options: [
      { value: 'none', label: '暂不关联客户' },
      ...customers.map((customer) => ({
        value: customer.id,
        label: customer.name ?? customer.id,
      })),
    ],
  },
  { name: 'name', label: '商机名称', required: true, placeholder: '例如：国际学校足球场项目' },
  { name: 'value', label: '预计金额', type: 'number', required: true, placeholder: '500000' },
  {
    name: 'currency',
    label: '币种',
    type: 'select',
    required: true,
    options: [
      { value: 'CNY', label: '人民币' },
      { value: 'USD', label: '美元 USD' },
      { value: 'EUR', label: '欧元 EUR' },
    ],
  },
  {
    name: 'probability',
    label: '成交概率（%）',
    type: 'number',
    required: true,
    placeholder: '30',
  },
  { name: 'expectedCloseDate', label: '预计成交日期', type: 'date', required: true },
];

const CreateDrawer = ({ state }: Readonly<{ state: OpportunityPageState }>) => (
  <DetailDrawer title="新建商机" onClose={state.closeCreate}>
    <FormSection
      title="新建商机"
      description="建立销售机会并设置初始金额、赢率与预计成交日期。"
      fields={createFields(state.customers)}
      submitLabel="创建商机"
      onSubmit={(values) =>
        state.runCreate({
          // 与原 openForm 提交载荷逐字段同构（customerId null 化、概率 % → 基点）。
          customerId: values.customerId === 'none' ? null : (values.customerId ?? null),
          leadId: null,
          name: values.name ?? '',
          value: values.value ?? '',
          currency: values.currency ?? 'CNY',
          probabilityBasisPoints: Math.round(Number(values.probability ?? 0) * 100),
          expectedCloseDate: values.expectedCloseDate ?? '',
        })
      }
    />
  </DetailDrawer>
);

const OpportunityView = (state: OpportunityPageState) => (
  <div class="commercial-console-page" data-testid="kt-opportunity-page">
    <PageHeader
      title="商机阶段看板"
      description="按阶段推进预计金额、赢率与成交日期"
      actions={
        <>
          <button
            type="button"
            class="secondary"
            data-testid="kt-opportunity-refresh"
            onClick={() => {
              void state.runRefresh();
            }}
          >
            刷新
          </button>
          {state.permissions.has('opportunity:create') ? (
            <button
              type="button"
              class="primary"
              data-testid="kt-opportunity-create"
              onClick={() => {
                state.openCreate();
              }}
            >
              ＋ 新建商机
            </button>
          ) : null}
        </>
      }
    />
    <OpportunitySummary state={state} />
    <DataTable
      columns={columns(state)}
      rows={state.items}
      rowId={(row) => row.id}
      caption="商机主列表（阶段、金额、赢率与预计成交）"
      loading={state.loading}
      {...(state.loadError === '' ? {} : { error: state.loadError })}
      emptyTitle="暂无商机"
      emptyDescription="新建商机后会出现在这里"
    />
    {state.selected ? <OpportunityDrawer state={state} /> : null}
    {state.creating ? <CreateDrawer state={state} /> : null}
  </div>
);

export function OpportunityListPage(ports: OpportunityListPorts) {
  const items = signal<readonly Opportunity[]>([...ports.initialOpportunities]);
  const loading = signal(false);
  const loadError = signal('');
  const selected = signal<Opportunity | null>(null);
  const creating = signal(false);

  const applyItems = (next: readonly Opportunity[]): void => {
    items.value = next;
    loadError.value = '';
  };
  const fail = (error: unknown, fallback: string): void => {
    loadError.value = error instanceof Error ? error.message : fallback;
  };

  const runTransition = async (opportunity: Opportunity, status: string, reason: string) => {
    loading.value = true;
    try {
      applyItems(await ports.transitionOpportunity(opportunity, status, reason));
      selected.value = null;
    } catch (error: unknown) {
      fail(error, '商机阶段推进失败');
    } finally {
      loading.value = false;
    }
  };

  const runCreate = async (payload: Record<string, unknown>) => {
    loading.value = true;
    try {
      applyItems(await ports.createOpportunity(payload));
      creating.value = false;
    } catch (error: unknown) {
      fail(error, '商机创建失败');
    } finally {
      loading.value = false;
    }
  };

  const runRefresh = async (): Promise<void> => {
    loading.value = true;
    try {
      applyItems(await ports.refresh());
    } catch (error: unknown) {
      fail(error, '商机列表加载失败');
    } finally {
      loading.value = false;
    }
  };

  const state = (): OpportunityPageState => ({
    items: items.value,
    summary: ports.pipelineSummary(items.value, ports.today),
    loading: loading.value,
    loadError: loadError.value,
    selected: selected.value,
    creating: creating.value,
    permissions: ports.permissions,
    today: ports.today,
    customers: ports.customers,
    displayMoney: ports.displayMoney,
    open: (opportunity) => {
      selected.value = opportunity;
    },
    openCreate: () => {
      creating.value = true;
    },
    closeCreate: () => {
      creating.value = false;
    },
    runTransition,
    runCreate,
    runRefresh,
  });

  const Page = () => OpportunityView(state());
  return Page;
}
