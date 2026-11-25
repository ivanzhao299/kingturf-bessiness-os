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
} from '@kingturf/ui';
import type { StatusTone } from '@kingturf/ui';
import type { OpportunityPipelineSummary } from '../readiness';
import type { Opportunity } from '../types';
import {
  PipelineBoard,
  dropTarget,
  isOpportunityOverdue,
  stageLabel,
  stageTargets,
  stageTone,
} from './opportunity-list-pipeline';
import { failureMessage } from '../../shared/api-error-message';
import { ConsoleNotice } from './console-notice';

// U3-COM-1（ADR-0014 分域重写）：商机列表页 Preact 控制台——原 vanilla pipeline-board
// 的能力面等价迁移（看板概要/新建/阶段推进/逾期标记），端口层收敛为最小 Props 面
//（页面不依赖 SalesViewController，行为测试注入 double）。
// COM-UX：默认呈现按阶段分列的管道视图（卡片按钮/把手拖拽切换阶段），原主列表保留为
// 可切换的列表视图；两条路径的阶段推进都走同一 transition 端口与依据必填语义。
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

export type PendingMove = Readonly<{ opportunity: Opportunity; target: string }>;

export type OpportunityViewMode = 'pipeline' | 'list';

export type OpportunityPageState = Readonly<{
  items: readonly Opportunity[];
  summary: OpportunityPipelineSummary;
  loading: boolean;
  loadError: string;
  selected: Opportunity | null;
  creating: boolean;
  /** 新建表单的提交错误（TD-WF-005）：显示在该表单的提示区，不进 loadError。 */
  createError: string;
  /** 详情抽屉里「推进商机阶段」表单的提交错误（WFD）：显示在该表单的提示区，不进 loadError。 */
  drawerError: string;
  /** TD-WF-014①（WFD 补齐）：最近一次写操作的成功提示（同时是读屏播报的内容）。 */
  notice: string;
  permissions: ReadonlySet<string>;
  today: string;
  customers: readonly OpportunityCreator[];
  displayMoney: (currency: unknown, value: unknown) => string;
  view: OpportunityViewMode;
  setView: (next: OpportunityViewMode) => void;
  pendingMove: PendingMove | null;
  moveError: string;
  focusTarget: string;
  /** 正在拖拽的商机 id 与其下方的目标列（空串 = 无）。 */
  dragging: string;
  over: string;
  armDrag: (id: string) => void;
  beginDrag: (opportunity: Opportunity) => boolean;
  endDrag: () => void;
  acceptsDrop: (columnKey: string) => boolean;
  hoverColumn: (columnKey: string) => void;
  leaveColumn: () => void;
  dropOn: (columnKey: string) => void;
  requestMove: (opportunity: Opportunity, target: string) => void;
  cancelMove: () => void;
  confirmMove: (reason: string) => Promise<void>;
  restoreFocus: (id: string) => void;
  clearFocusTarget: () => void;
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
  // 抽屉内只提供顺序推进（与原 NEXT_STAGE 语义一致）；关闭出口见看板卡片操作。
  const nextStage = stageTargets(opportunity.status)[0] ?? null;
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
            // WFD：失败原因显示在这张表单自己的提示区。此前它走 loadError——管道视图下整个看板被一条
            // 错误替换，而抽屉还开着挡在前面，用户在抽屉里什么也看不到。
            error={state.drawerError}
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
      error={state.createError}
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

const ViewToggle = ({ state }: Readonly<{ state: OpportunityPageState }>) => (
  <div class="com-view-toggle" role="group" aria-label="商机视图切换">
    {(['pipeline', 'list'] as const).map((mode) => (
      <button
        key={mode}
        type="button"
        class="secondary compact"
        aria-pressed={state.view === mode}
        data-testid={`kt-opportunity-view-${mode}`}
        onClick={() => {
          state.setView(mode);
        }}
      >
        {mode === 'pipeline' ? '管道视图' : '列表视图'}
      </button>
    ))}
  </div>
);

const OpportunityBody = (state: OpportunityPageState) => {
  if (state.view === 'list')
    return (
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
    );
  if (state.loadError !== '')
    return (
      <p class="console-error" role="alert" data-testid="kt-opportunity-error">
        {state.loadError}
      </p>
    );
  if (state.items.length === 0 && !state.loading)
    return (
      <EmptyState
        title="暂无商机"
        description="新建商机后会按阶段出现在这里，拖动卡片或使用卡片按钮即可推进阶段。"
        {...(state.permissions.has('opportunity:create')
          ? {
              action: (
                <button
                  type="button"
                  class="primary"
                  data-testid="kt-opportunity-create-empty"
                  onClick={state.openCreate}
                >
                  ＋ 新建商机
                </button>
              ),
            }
          : {})}
      />
    );
  return <PipelineBoard state={state} />;
};

const OpportunityView = (state: OpportunityPageState) => (
  <div class="commercial-console-page" data-testid="kt-opportunity-page">
    <PageHeader
      title="商机阶段看板"
      description="按阶段推进预计金额、赢率与成交日期"
      actions={
        <>
          <ViewToggle state={state} />
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
    <ConsoleNotice message={state.notice} />
    <OpportunitySummary state={state} />
    {OpportunityBody(state)}
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
  const createError = signal('');
  // WFD：详情抽屉里推进表单的提交错误。
  const drawerError = signal('');
  const view = signal<OpportunityViewMode>('pipeline');
  const pendingMove = signal<PendingMove | null>(null);
  const moveError = signal('');
  const notice = signal('');
  const focusTarget = signal('');
  const dragging = signal('');
  const over = signal('');
  // 把手按下才允许拖动（非响应式标记：只在事件间传递，不触发渲染）。
  const dragArm = { id: '' };

  // 失败文案统一经 failureMessage：接口的常见英文消息转成中文，其余原样（TD-WF-006）。
  const messageOf = failureMessage;
  const applyItems = (next: readonly Opportunity[]): void => {
    items.value = next;
    loadError.value = '';
  };
  const fail = (error: unknown, fallback: string): void => {
    loadError.value = messageOf(error, fallback);
  };
  const mayManage = (): boolean => ports.permissions.has('opportunity:lifecycle');
  const draggedItem = (): Opportunity | undefined =>
    items.value.find((item) => item.id === dragging.value);

  const runTransition = async (
    opportunity: Opportunity,
    status: string,
    reason: string,
  ): Promise<void> => {
    loading.value = true;
    drawerError.value = '';
    moveError.value = '';
    try {
      applyItems(await ports.transitionOpportunity(opportunity, status, reason));
      selected.value = null;
      moveError.value = '';
      notice.value = `已将「${opportunity.name ?? opportunity.id}」移动到「${stageLabel(status)}」`;
      // 卡片发起的移动：确认卡卸载，焦点交给已落入新列的同一张卡片。
      if (pendingMove.value?.opportunity.id === opportunity.id) {
        pendingMove.value = null;
        focusTarget.value = opportunity.id;
      }
    } catch (error: unknown) {
      // 卡片流失败就地呈现并保留已输入依据；抽屉流失败（WFD）同样显示在抽屉里那张表单的提示区。
      if (pendingMove.value?.opportunity.id === opportunity.id)
        moveError.value = messageOf(error, '商机阶段推进失败');
      else drawerError.value = messageOf(error, '商机阶段推进失败');
    } finally {
      loading.value = false;
    }
  };

  const runCreate = async (payload: Record<string, unknown>): Promise<void> => {
    loading.value = true;
    // 提交失败的原因只给新建表单（TD-WF-005）。此前它走 fail → loadError：管道视图下整个看板被
    // 一条错误替换，而创建抽屉还开着挡在前面，用户看到的是「点了没反应」。
    createError.value = '';
    try {
      applyItems(await ports.createOpportunity(payload));
      creating.value = false;
      notice.value =
        typeof payload.name === 'string' ? `已创建商机「${payload.name}」` : '已创建商机';
    } catch (error: unknown) {
      createError.value = messageOf(error, '商机创建失败');
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

  const endDrag = (): void => {
    dragging.value = '';
    over.value = '';
    dragArm.id = '';
  };
  const confirmMove = async (reason: string): Promise<void> => {
    const move = pendingMove.value;
    if (move) await runTransition(move.opportunity, move.target, reason);
  };
  const requestMove = (opportunity: Opportunity, target: string): void => {
    pendingMove.value = { opportunity, target };
    moveError.value = '';
    notice.value = '';
  };

  const state = (): OpportunityPageState => ({
    items: items.value,
    summary: ports.pipelineSummary(items.value, ports.today),
    loading: loading.value,
    loadError: loadError.value,
    selected: selected.value,
    creating: creating.value,
    createError: createError.value,
    drawerError: drawerError.value,
    notice: notice.value,
    permissions: ports.permissions,
    today: ports.today,
    customers: ports.customers,
    displayMoney: ports.displayMoney,
    view: view.value,
    setView: (next) => {
      view.value = next;
    },
    pendingMove: pendingMove.value,
    moveError: moveError.value,
    focusTarget: focusTarget.value,
    dragging: dragging.value,
    over: over.value,
    armDrag: (id) => {
      dragArm.id = id;
    },
    beginDrag: (opportunity) => {
      if (dragArm.id !== opportunity.id || !mayManage()) return false;
      dragging.value = opportunity.id;
      return true;
    },
    endDrag,
    // 事件处理读实时 signal 而非渲染快照：dragover/drop 不依赖上一帧是否已重绘。
    acceptsDrop: (columnKey) => dropTarget(draggedItem()?.status, columnKey) !== null,
    hoverColumn: (columnKey) => {
      if (over.value !== columnKey) over.value = columnKey;
    },
    leaveColumn: () => {
      over.value = '';
    },
    dropOn: (columnKey) => {
      const dragged = draggedItem();
      const target = dropTarget(dragged?.status, columnKey);
      endDrag();
      if (dragged && target !== null && mayManage()) requestMove(dragged, target);
    },
    requestMove,
    cancelMove: () => {
      pendingMove.value = null;
      moveError.value = '';
    },
    confirmMove,
    restoreFocus: (id) => {
      focusTarget.value = id;
    },
    clearFocusTarget: () => {
      focusTarget.value = '';
    },
    // 开始下一个动作时清掉上一次的成功提示（与 createError / drawerError 同一处）。
    open: (opportunity) => {
      selected.value = opportunity;
      drawerError.value = '';
      notice.value = '';
    },
    openCreate: () => {
      creating.value = true;
      createError.value = '';
      notice.value = '';
    },
    closeCreate: () => {
      creating.value = false;
      createError.value = '';
      notice.value = '';
    },
    runTransition,
    runCreate,
    runRefresh,
  });

  const Page = () => OpportunityView(state());
  return Page;
}
