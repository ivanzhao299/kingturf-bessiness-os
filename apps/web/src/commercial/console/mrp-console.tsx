// MFG-6（ADR-0014 分域重写）：物料需求计划控制台——原 vanilla「物料需求与建议审批」页面等价迁移
//（三张新建表单与建议决定的载荷逐字节一致）+ 治理模块同款形态：汇总卡（口径写在卡上，写后重算）、
// 页内页签（建议 / 计算批次 / 需求信号 / 计划政策——主协调裁定保持单一路由）、建议主表（服务端
// 筛选 / 搜索 / 排序 / 键集分页）、详情抽屉（解释树、冻结覆盖、流转记录、执行工单）。
// 默认看最新批次（与 legacy 页面只展示 latestRun 同源），历史批次可切换。
// e2e 契约：批次标题与建议行里的 SKU 各是独占文本元素（kt-mrp-run-heading / kt-mrp-proposal-sku）；
// 解释证据在详情抽屉内。
import type { TargetedKeyboardEvent } from 'preact';
import { PageHeader, SummaryCards, type SummaryCardItem } from '@kingturf/ui';
import type { MrpConsolePorts } from './mrp-ports';
import {
  MRP_TABS,
  TAB_LABELS,
  TAB_READ,
  records,
  summaryOf,
  textOf,
  type MrpTab,
} from './mrp-state';
import {
  createMrpBundle,
  latestRunId,
  createMrpLoaders,
  createMrpMutations,
  type MrpViewState,
} from './mrp-console-actions';
import { ConsoleConfirmDialog } from './console-confirm';
import { ConsoleNotice } from './console-notice';
import { MrpProposals } from './mrp-proposals';
import { MrpProposalDrawer } from './mrp-detail';
import { MrpDecisionDrawer, MrpFormDrawer } from './mrp-forms';
import { MrpRuns, MrpDemands, MrpPolicies } from './mrp-inputs';
import './commercial-ux.css';
import './mrp-console.css';

const TAB_TEST_IDS: Readonly<Record<MrpTab, string>> = {
  proposals: 'kt-mrp-tab-proposals',
  runs: 'kt-mrp-tab-runs',
  demands: 'kt-mrp-tab-demands',
  policies: 'kt-mrp-tab-policies',
};

// 汇总卡：口径写在卡上；读不到某个列表时显示「—」并说明原因。可点的卡切到对应的页签。
const MrpSummaryCards = ({ state }: Readonly<{ state: MrpViewState }>) => {
  const { summary, permissions } = state;
  const hint = (tab: MrpTab, value: number | null, description: string): string => {
    if (!permissions.has(TAB_READ[tab])) return `没有 ${TAB_READ[tab]} 读权限`;
    return value === null ? '数据暂未加载' : description;
  };
  const latestNumber = summary.latest ? textOf(summary.latest.run_number) : '';
  const count = (tab: MrpTab, value: number | null, unit: string): string => {
    if (!permissions.has(TAB_READ[tab])) return '—';
    return value === null ? '—' : `${String(value)}${unit}`;
  };
  const onTab = (tab: MrpTab) => (): void => {
    state.setTab(tab);
    if (tab === 'proposals') state.showPending();
  };
  const items: readonly SummaryCardItem[] = [
    {
      id: 'policies',
      label: '计划政策',
      value: count('policies', summary.policies, ' 项'),
      hint: hint('policies', summary.policies, '按生效时间追加，不可修改'),
      onSelect: onTab('policies'),
      active: state.tab === 'policies',
    },
    {
      id: 'demands',
      label: '需求信号',
      value: count('demands', summary.demands, ' 项'),
      hint: hint('demands', summary.demands, '运行计算时固定为需求快照'),
      onSelect: onTab('demands'),
      active: state.tab === 'demands',
    },
    {
      id: 'runs',
      label: '计算批次',
      value: count('runs', summary.runs, ' 次'),
      hint: hint('runs', summary.runs, latestNumber ? `最新 ${latestNumber}` : '还没有运行过计算'),
      onSelect: onTab('runs'),
      active: state.tab === 'runs',
    },
    {
      id: 'pending',
      label: '当前待处理建议',
      value: count('proposals', summary.runs === null ? null : summary.pending, ' 项'),
      hint: hint(
        'proposals',
        summary.runs,
        summary.latest
          ? `最新批次共 ${String(summary.total)} 项 · 已审批 ${String(summary.approved)} / 已下达 ${String(summary.released)}`
          : '还没有计算批次',
      ),
      tone: summary.pending > 0 ? 'warning' : undefined,
      onSelect: onTab('proposals'),
      active:
        state.tab === 'proposals' &&
        state.stateFilter === 'PROPOSED' &&
        state.runId === latestRunId(state.snapshot),
    },
  ];
  return <SummaryCards label="物料计划汇总" testId="kt-mrp-summary" items={items} />;
};

// 页内页签（WAI-ARIA tabs：方向键 / Home / End 切换并跟随焦点）。单一路由 material-planning。
const MrpTabs = ({ state }: Readonly<{ state: MrpViewState }>) => {
  const selectedRun = state.snapshot.runs?.find((run) => textOf(run.id) === state.runId);
  const counts: Readonly<Record<MrpTab, string>> = {
    proposals: state.snapshot.runs !== null ? String(records(selectedRun?.proposals).length) : '—',
    runs: String(state.summary.runs ?? '—'),
    demands: String(state.summary.demands ?? '—'),
    policies: String(state.summary.policies ?? '—'),
  };
  const neighbor = (key: string, current: MrpTab): MrpTab | undefined => {
    const index = MRP_TABS.indexOf(current);
    if (key === 'ArrowRight') return MRP_TABS[(index + 1) % MRP_TABS.length];
    if (key === 'ArrowLeft') return MRP_TABS[(index - 1 + MRP_TABS.length) % MRP_TABS.length];
    if (key === 'Home') return MRP_TABS[0];
    if (key === 'End') return MRP_TABS.at(-1);
    return undefined;
  };
  const onKeyDown = (event: TargetedKeyboardEvent<HTMLButtonElement>, current: MrpTab): void => {
    const next = neighbor(event.key, current);
    if (next === undefined) return;
    event.preventDefault();
    state.setTab(next);
    const host = event.currentTarget as HTMLElement;
    host.parentElement?.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus();
  };
  return (
    <div class="mrp-tabs" role="tablist" aria-label="物料计划分区" data-testid="kt-mrp-tabs">
      {MRP_TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          class="mrp-tab"
          id={TAB_TEST_IDS[tab]}
          data-tab={tab}
          aria-selected={state.tab === tab}
          aria-controls="kt-mrp-panel"
          tabIndex={state.tab === tab ? 0 : -1}
          data-testid={TAB_TEST_IDS[tab]}
          onClick={() => {
            state.setTab(tab);
          }}
          onKeyDown={(event) => {
            onKeyDown(event, tab);
          }}
        >
          {TAB_LABELS[tab]}
          <span class="mrp-tab-count">{counts[tab]}</span>
        </button>
      ))}
    </div>
  );
};

const MrpPanel = ({ state }: Readonly<{ state: MrpViewState }>) => {
  if (!state.canRead(state.tab))
    return (
      <p class="console-hint" data-testid="kt-mrp-unreadable">
        {`— 没有读取${TAB_LABELS[state.tab]}的权限（${TAB_READ[state.tab]}）`}
      </p>
    );
  const rows =
    state.tab === 'policies'
      ? state.snapshot.policies
      : state.tab === 'demands'
        ? state.snapshot.demands
        : state.snapshot.runs;
  if (rows === null) return <p class="console-hint">— 数据暂未加载，可刷新重试。</p>;
  if (state.tab === 'proposals') return <MrpProposals state={state} />;
  if (state.tab === 'runs') return <MrpRuns state={state} />;
  if (state.tab === 'demands') return <MrpDemands state={state} />;
  return <MrpPolicies state={state} />;
};

const MrpConsoleView = (state: MrpViewState) => {
  const drawerOpen = state.selected !== null && state.activeForm === null;
  return (
    <div class="commercial-console-page" data-testid="kt-mrp-page">
      <PageHeader
        title="物料需求计划"
        description="物料需求、库存抵扣与供需建议：要生产 / 采购什么、为什么、做到哪一步"
        actions={
          <>
            <button
              type="button"
              class="secondary"
              data-testid="kt-mrp-refresh"
              disabled={state.loading}
              onClick={() => {
                void state.runRefresh();
              }}
            >
              刷新
            </button>
            {state.mayManagePolicy ? (
              <button
                type="button"
                class="secondary"
                data-testid="kt-mrp-create-policy"
                onClick={() => {
                  state.openForm('policy');
                }}
              >
                ＋ 计划政策
              </button>
            ) : null}
            {state.mayRun ? (
              <>
                <button
                  type="button"
                  class="secondary"
                  data-testid="kt-mrp-create-demand"
                  onClick={() => {
                    state.openForm('demand');
                  }}
                >
                  ＋ 需求信号
                </button>
                <button
                  type="button"
                  class="primary"
                  data-testid="kt-mrp-run"
                  onClick={() => {
                    state.openForm('run');
                  }}
                >
                  运行物料需求计算
                </button>
              </>
            ) : null}
          </>
        }
      />
      {/* 写成功的提示：详情抽屉开着时放抽屉底部（见抽屉），否则放页头下方。 */}
      {drawerOpen ? null : <ConsoleNotice message={state.notice} />}
      <MrpSummaryCards state={state} />
      <MrpTabs state={state} />
      {state.loadError !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-mrp-load-error">
          {state.loadError}
        </p>
      ) : null}
      {state.actionError !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-mrp-action-error">
          {state.actionError}
        </p>
      ) : null}
      <div
        role="tabpanel"
        id="kt-mrp-panel"
        aria-labelledby={TAB_TEST_IDS[state.tab]}
        data-testid="kt-mrp-panel"
      >
        <MrpPanel state={state} />
      </div>
      {/* 任一表单抽屉打开期间详情抽屉不渲染：两个模态抽屉不同时存在。 */}
      {drawerOpen ? <MrpProposalDrawer state={state} /> : null}
      <MrpFormDrawer state={state} />
      <MrpDecisionDrawer state={state} />
      <ConsoleConfirmDialog pending={state.confirm} />
    </div>
  );
};

export function MrpConsolePage(ports: MrpConsolePorts) {
  const bundle = createMrpBundle(ports.initial);
  if (!ports.permissions.has(TAB_READ.proposals)) bundle.tab.value = 'policies';
  const loaders = createMrpLoaders(ports, bundle);
  const mutations = createMrpMutations(ports, bundle, {
    sync: loaders.sync,
    loadProposals: loaders.loadProposals,
    actionFailed: loaders.actionFailed,
  });
  // 建议主表走桥轨列表（筛选 / 搜索 / 键集分页）；默认看最新批次。
  void loaders.loadProposals();

  const state = (): MrpViewState => ({
    ports,
    permissions: ports.permissions,
    summary: summaryOf(bundle.snapshot.value),
    snapshot: bundle.snapshot.value,
    tab: bundle.tab.value,
    runId: bundle.runId.value,
    stateFilter: bundle.stateFilter.value,
    overrideOnly: bundle.overrideOnly.value,
    search: bundle.search.value,
    appliedQuery: bundle.appliedQuery.value,
    proposals: bundle.proposals.value,
    nextCursor: bundle.nextCursor.value,
    loading: bundle.loading.value,
    loadingMore: bundle.loadingMore.value,
    loadError: bundle.loadError.value,
    actionError: bundle.actionError.value,
    submitError: bundle.submitError.value,
    selected: bundle.selected.value,
    detail: bundle.detail.value,
    detailLoading: bundle.detailLoading.value,
    detailError: bundle.detailError.value,
    activeForm: bundle.activeForm.value,
    target: bundle.target.value,
    confirm: bundle.confirm,
    notice: bundle.notice.value,
    shownCount: bundle.shownCount.value,
    inputSearch: bundle.inputSearch.value,
    mayManagePolicy: ports.permissions.has('mrp-policy:manage'),
    mayRun: ports.permissions.has('mrp:run'),
    mayApprove: ports.permissions.has('mrp:approve'),
    mayRelease: ports.permissions.has('mrp:release'),
    canRead: (tab) => ports.permissions.has(TAB_READ[tab]),
    setTab: loaders.setTab,
    showPending: loaders.showPending,
    setRun: loaders.setRun,
    setStateFilter: loaders.setStateFilter,
    setOverrideOnly: loaders.setOverrideOnly,
    setSearch: loaders.setSearch,
    applySearch: loaders.applySearch,
    clearSearch: loaders.clearSearch,
    showMore: loaders.showMore,
    setInputSearch: loaders.setInputSearch,
    loadMore: () => {
      void loaders.loadMore();
    },
    runRefresh: loaders.sync,
    open: loaders.open,
    openForm: loaders.openForm,
    closeForm: mutations.closeForm,
    runPolicy: mutations.runPolicy,
    runDemand: mutations.runDemand,
    runRun: mutations.runRun,
    runDecision: mutations.runDecision,
  });

  const Page = () => MrpConsoleView(state());
  return Page;
}
