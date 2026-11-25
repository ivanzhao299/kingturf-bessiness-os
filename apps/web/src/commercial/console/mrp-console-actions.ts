// MFG-6：物料需求计划控制台动作工厂（沿 production-order-actions 先例）。装载 / 筛选 / 详情闭包
//（createMrpLoaders）与变更闭包（createMrpMutations：三张新建表单 + 建议决定）分离；bundle 为页面
// signal 束的最小面，请求序号守卫丢弃过期响应。
import { signal, type Signal } from '@preact/signals';
import type { MrpConsolePorts, MrpPage, MrpProposalQuery, MrpRow, MrpSnapshot } from './mrp-ports';
import {
  askConfirm,
  createConfirm,
  type ConfirmRequest,
  type ConfirmSignal,
} from './console-confirm';
import { syncSelected } from './selected-sync';
import { failureMessage } from '../../shared/api-error-message';
import {
  decisionPayload,
  demandPayload,
  dayOf,
  idOf,
  policyPayload,
  records,
  releasePayload,
  runPayload,
  textOf,
  rowText,
  type MrpSummary,
  type MrpTab,
  type StateFilter,
} from './mrp-state';

export type MrpForm = 'policy' | 'demand' | 'run' | 'approve' | 'reject' | 'release';
export type MrpDecision = 'approve' | 'reject' | 'release';
const DECISIONS: readonly MrpDecision[] = ['approve', 'reject', 'release'];

export type MrpBundle = Readonly<{
  snapshot: Signal<MrpSnapshot>;
  tab: Signal<MrpTab>;
  // 建议页签正在看的计算批次；缺省是最新批次（与 legacy 页面只展示 latestRun 同源）。
  runId: Signal<string>;
  stateFilter: Signal<StateFilter>;
  overrideOnly: Signal<boolean>;
  search: Signal<string>;
  appliedQuery: Signal<string>;
  proposals: Signal<readonly MrpRow[]>;
  nextCursor: Signal<string | null>;
  loading: Signal<boolean>;
  loadingMore: Signal<boolean>;
  loadError: Signal<string>;
  actionError: Signal<string>;
  submitError: Signal<string>;
  selected: Signal<MrpRow | null>;
  detail: Signal<MrpRow | null>;
  detailLoading: Signal<boolean>;
  detailError: Signal<string>;
  submitting: Signal<boolean>;
  activeForm: Signal<MrpForm | null>;
  // 建议决定表单针对的那条建议（从列表行或详情抽屉发起）。
  target: Signal<MrpRow | null>;
  confirm: ConfirmSignal;
  notice: Signal<string>;
  // 三个快照页签（批次 / 需求 / 政策）的搜索词与首屏行数（其余经「继续加载」展开）。
  inputSearch: Signal<string>;
  shownCount: Signal<number>;
}>;
export const PROPOSAL_PAGE_SIZE = 50;
export const SNAPSHOT_PAGE_SIZE = 20;

const latestOf = (snapshot: MrpSnapshot): MrpRow | null => snapshot.runs?.[0] ?? null;
export const latestRunId = (snapshot: MrpSnapshot): string => {
  const latest = latestOf(snapshot);
  return latest ? idOf(latest) : '';
};

// 页面每次渲染时从 signal 束拼出的只读视图（子组件只拿到这一份）。
export type MrpViewState = Readonly<{
  ports: MrpConsolePorts;
  permissions: ReadonlySet<string>;
  summary: MrpSummary;
  // 三个列表的最新快照（写后重读）；读不到的列表为 null。
  snapshot: MrpSnapshot;
  tab: MrpTab;
  runId: string;
  stateFilter: StateFilter;
  overrideOnly: boolean;
  search: string;
  appliedQuery: string;
  proposals: readonly MrpRow[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  loadError: string;
  actionError: string;
  submitError: string;
  selected: MrpRow | null;
  detail: MrpRow | null;
  detailLoading: boolean;
  detailError: string;
  activeForm: MrpForm | null;
  target: MrpRow | null;
  confirm: ConfirmSignal;
  notice: string;
  shownCount: number;
  inputSearch: string;
  mayManagePolicy: boolean;
  mayRun: boolean;
  mayApprove: boolean;
  mayRelease: boolean;
  // 当前账号能不能读这个页签的内容（没有读权限时页签里显示「—」并说明原因）。
  canRead: (tab: MrpTab) => boolean;
  showPending: () => void;
  setTab: (tab: MrpTab) => void;
  setRun: (runId: string) => void;
  setStateFilter: (next: StateFilter) => void;
  setOverrideOnly: (next: boolean) => void;
  setSearch: (next: string) => void;
  applySearch: () => void;
  clearSearch: () => void;
  showMore: () => void;
  setInputSearch: (next: string) => void;
  loadMore: () => void;
  runRefresh: () => Promise<void>;
  open: (row: MrpRow | null) => void;
  openForm: (form: MrpForm, target?: MrpRow | null) => void;
  closeForm: () => void;
  runPolicy: (values: Readonly<Record<string, string>>) => Promise<void>;
  runDemand: (values: Readonly<Record<string, string>>) => Promise<void>;
  // 运行计算与建议决定先出确认框：表单提交只负责校验与组织确认内容，请求在确认之后才发。
  runRun: (values: Readonly<Record<string, string>>) => void;
  runDecision: (values: Readonly<Record<string, string>>) => void;
}>;

export const createMrpBundle = (initial: MrpSnapshot): MrpBundle => ({
  snapshot: signal(initial),
  tab: signal<MrpTab>('proposals'),
  runId: signal(latestRunId(initial)),
  stateFilter: signal<StateFilter>('ALL'),
  overrideOnly: signal(false),
  search: signal(''),
  appliedQuery: signal(''),
  proposals: signal<readonly MrpRow[]>([]),
  nextCursor: signal<string | null>(null),
  loading: signal(false),
  loadingMore: signal(false),
  loadError: signal(''),
  actionError: signal(''),
  submitError: signal(''),
  selected: signal<MrpRow | null>(null),
  detail: signal<MrpRow | null>(null),
  detailLoading: signal(false),
  detailError: signal(''),
  submitting: signal(false),
  activeForm: signal<MrpForm | null>(null),
  target: signal<MrpRow | null>(null),
  confirm: createConfirm(),
  notice: signal(''),
  inputSearch: signal(''),
  shownCount: signal(SNAPSHOT_PAGE_SIZE),
});

// 行级与抽屉里的「下一步」：待处理 → 批准 / 拒绝（mrp:approve），已审批 → 下达（mrp:release）。
// 与 legacy 卡片的按钮条件逐条一致。
export const decisionActions = (
  state: MrpViewState,
  row: MrpRow,
): readonly Readonly<{ form: MrpDecision; label: string }>[] => {
  const status = rowText(state.ports.recordText, row, 'effectiveState', 'effectiveState');
  if (status === 'PROPOSED' && state.mayApprove)
    return [
      { form: 'approve', label: '批准' },
      { form: 'reject', label: '拒绝' },
    ];
  if (status === 'APPROVED' && state.mayRelease) return [{ form: 'release', label: '下达' }];
  return [];
};

// 装载 / 筛选 / 详情闭包（变更动作经 createMrpMutations 注入 io）。
export function createMrpLoaders(ports: MrpConsolePorts, bundle: MrpBundle) {
  let requestSequence = 0;
  let detailSequence = 0;
  // 失败文案统一经 failureMessage：接口的常见英文消息转成中文，其余原样（TD-WF-006）。
  const messageOf = failureMessage;
  const loadFailed = (error: unknown, fallback: string): void => {
    bundle.loadError.value = messageOf(error, fallback);
  };
  const actionFailed = (error: unknown, fallback: string): void => {
    // 抽屉或表单开着时错误就近显示在里面，否则显示在页签上方。
    if (bundle.selected.value !== null || bundle.activeForm.value !== null)
      bundle.submitError.value = messageOf(error, fallback);
    else bundle.actionError.value = messageOf(error, fallback);
  };
  const queryOf = (cursor?: string): MrpProposalQuery => ({
    runId: bundle.runId.value,
    ...(bundle.stateFilter.value === 'ALL' ? {} : { state: bundle.stateFilter.value }),
    ...(bundle.overrideOnly.value ? { freezeOverride: true } : {}),
    ...(bundle.appliedQuery.value === '' ? {} : { query: bundle.appliedQuery.value }),
    limit: PROPOSAL_PAGE_SIZE,
    ...(cursor ? { cursor } : {}),
  });
  const loadProposals = async (): Promise<void> => {
    const sequence = ++requestSequence;
    bundle.loadingMore.value = false;
    bundle.nextCursor.value = null;
    bundle.loadError.value = '';
    if (!ports.permissions.has('mrp:read') || bundle.runId.value === '') {
      bundle.proposals.value = [];
      bundle.loading.value = false;
      return;
    }
    bundle.loading.value = true;
    try {
      const page: MrpPage = await ports.fetchProposals(queryOf());
      if (sequence !== requestSequence) return;
      bundle.proposals.value = page.items;
      bundle.nextCursor.value = page.nextCursor;
      bundle.loadError.value = '';
    } catch (error: unknown) {
      if (sequence === requestSequence) {
        bundle.proposals.value = [];
        loadFailed(error, '物料需求建议加载失败');
      }
    } finally {
      if (sequence === requestSequence) bundle.loading.value = false;
    }
  };
  const loadMore = async (): Promise<void> => {
    const cursor = bundle.nextCursor.value;
    if (cursor === null || bundle.loadingMore.value) return;
    const sequence = requestSequence;
    bundle.loadingMore.value = true;
    try {
      const page = await ports.fetchProposals(queryOf(cursor));
      if (sequence !== requestSequence) return;
      bundle.proposals.value = [...bundle.proposals.value, ...page.items];
      bundle.nextCursor.value = page.nextCursor;
      bundle.loadError.value = '';
    } catch (error: unknown) {
      if (sequence === requestSequence) loadFailed(error, '继续加载失败');
    } finally {
      if (sequence === requestSequence) bundle.loadingMore.value = false;
    }
  };
  const reloadDetail = async (): Promise<void> => {
    const row = bundle.selected.value;
    const runId = row ? textOf(row.mrp_run_id) : '';
    if (!row || runId === '') return;
    const sequence = ++detailSequence;
    bundle.detailLoading.value = true;
    bundle.detail.value = null;
    bundle.detailError.value = '';
    try {
      const detail = await ports.loadRunDetail(runId);
      // 迟到的详情只在期间没有关掉抽屉时生效。
      if (sequence === detailSequence) {
        bundle.detail.value = detail;
        if (!detail) bundle.detailError.value = '找不到计算批次详情';
      }
    } catch (error: unknown) {
      if (sequence === detailSequence)
        bundle.detailError.value = messageOf(error, '计算批次详情加载失败');
    } finally {
      if (sequence === detailSequence) bundle.detailLoading.value = false;
    }
  };
  // 选中的批次不在最新快照里时回到最新批次。
  const settleRun = (): void => {
    const runs = bundle.snapshot.value.runs;
    if (!runs) return;
    if (!runs.some((run) => idOf(run) === bundle.runId.value))
      bundle.runId.value = latestRunId(bundle.snapshot.value);
  };
  const allProposals = (): readonly MrpRow[] =>
    (bundle.snapshot.value.runs ?? []).flatMap((run) => records(run.proposals));

  const sync = async (): Promise<void> => {
    bundle.loading.value = true;
    try {
      bundle.snapshot.value = await ports.refresh();
      settleRun();
      await loadProposals();
      // 详情抽屉开着：换成刷新后的行并重读详情（状态、按钮、流转记录随之更新）。
      if (syncSelected({ selected: bundle.selected, rows: allProposals(), idOf }))
        await reloadDetail();
    } catch (error: unknown) {
      loadFailed(error, '物料计划刷新失败');
      bundle.loading.value = false;
    }
  };
  // 用户开始下一个动作（打开别的记录或表单、切换筛选）时清掉上一次的成功提示与错误。
  const resetFeedback = (): void => {
    bundle.submitError.value = '';
    bundle.actionError.value = '';
    bundle.notice.value = '';
  };

  return {
    sync,
    loadProposals,
    loadMore,
    reloadDetail,
    actionFailed,
    open: (row: MrpRow | null): void => {
      if (bundle.submitting.value) return;
      resetFeedback();
      bundle.activeForm.value = null;
      bundle.target.value = null;
      bundle.selected.value = row;
      bundle.detail.value = null;
      if (row === null) {
        detailSequence += 1;
        bundle.detailLoading.value = false;
      } else void reloadDetail();
    },
    openForm: (form: MrpForm, target: MrpRow | null = null): void => {
      if (bundle.submitting.value) return;
      resetFeedback();
      bundle.activeForm.value = form;
      bundle.target.value = target;
    },
    // 切换页签时清掉快照页签的搜索词：它只过滤当前页签。
    setTab: (tab: MrpTab): void => {
      bundle.tab.value = tab;
      bundle.inputSearch.value = '';
      bundle.shownCount.value = SNAPSHOT_PAGE_SIZE;
    },
    showPending: (): void => {
      bundle.runId.value = latestRunId(bundle.snapshot.value);
      bundle.stateFilter.value = 'PROPOSED';
      bundle.overrideOnly.value = false;
      bundle.search.value = '';
      bundle.appliedQuery.value = '';
      bundle.proposals.value = [];
      void loadProposals();
    },
    setRun: (runId: string): void => {
      resetFeedback();
      bundle.runId.value = runId;
      bundle.proposals.value = [];
      void loadProposals();
    },
    setStateFilter: (next: StateFilter): void => {
      bundle.stateFilter.value = next;
      void loadProposals();
    },
    setOverrideOnly: (next: boolean): void => {
      bundle.overrideOnly.value = next;
      void loadProposals();
    },
    setSearch: (next: string): void => {
      bundle.search.value = next;
    },
    applySearch: (): void => {
      bundle.appliedQuery.value = bundle.search.value.trim();
      void loadProposals();
    },
    clearSearch: (): void => {
      bundle.search.value = '';
      bundle.appliedQuery.value = '';
      void loadProposals();
    },
    showMore: (): void => {
      bundle.shownCount.value = bundle.shownCount.value + SNAPSHOT_PAGE_SIZE;
    },
    setInputSearch: (next: string): void => {
      bundle.inputSearch.value = next;
      bundle.shownCount.value = SNAPSHOT_PAGE_SIZE;
    },
  };
}

// 变更动作工厂。三张新建表单与建议决定的载荷和 legacy openForm 表单逐字节一致（载荷构造在
// mrp-state.ts）；运行计算、批准、拒绝、下达先过确认框（ConsoleConfirmDialog），成功后写状态行，
// 失败原因显示在发起它的表单里。
export function createMrpMutations(
  ports: MrpConsolePorts,
  bundle: MrpBundle,
  io: Readonly<{
    sync: () => Promise<void>;
    loadProposals: () => Promise<void>;
    actionFailed: (error: unknown, fallback: string) => void;
  }>,
) {
  const FALLBACK: Readonly<Record<MrpForm, string>> = {
    policy: '计划政策保存失败',
    demand: '需求信号登记失败',
    run: '物料需求计算失败',
    approve: '批准失败',
    reject: '拒绝失败',
    release: '下达失败',
  };
  const closeForm = (): void => {
    bundle.activeForm.value = null;
    bundle.target.value = null;
    bundle.submitError.value = '';
  };
  const itemLabel = (itemVersionId: string): string =>
    ports.itemVersionChoices.find((choice) => choice.value === itemVersionId)?.label ??
    itemVersionId;
  const commit = async (
    form: MrpForm,
    path: string,
    payload: Record<string, unknown>,
    notice: string,
    // 新建了一个计算批次：写后切到最新批次。
    switchToLatest = false,
  ): Promise<void> => {
    if (bundle.submitting.value || bundle.activeForm.value !== form) return;
    bundle.submitting.value = true;
    bundle.submitError.value = '';
    bundle.actionError.value = '';
    try {
      await ports.submit(path, payload);
    } catch (error: unknown) {
      io.actionFailed(error, FALLBACK[form]);
      return;
    } finally {
      bundle.submitting.value = false;
    }
    closeForm();
    bundle.notice.value = notice;
    await io.sync();
    if (switchToLatest && bundle.runId.value !== latestRunId(bundle.snapshot.value)) {
      bundle.runId.value = latestRunId(bundle.snapshot.value);
      await io.loadProposals();
    }
  };

  return {
    closeForm: () => {
      if (!bundle.submitting.value) closeForm();
    },
    runPolicy: async (values: Readonly<Record<string, string>>): Promise<void> => {
      const payload = policyPayload(values);
      await commit(
        'policy',
        '/api/v1/mrp-policies',
        payload,
        `已新建计划政策 ${itemLabel(values.itemVersionId?.trim() ?? '')}`,
      );
    },
    runDemand: async (values: Readonly<Record<string, string>>): Promise<void> => {
      const payload = demandPayload(values);
      await commit(
        'demand',
        '/api/v1/mrp-demands',
        payload,
        `已登记需求信号 ${itemLabel(values.itemVersionId?.trim() ?? '')} · 需求 ${values.quantity?.trim() ?? ''}`,
      );
    },
    // 运行计算：先确认（说明会固定哪些输入、批次建立后不能改），确认后才发请求。
    runRun: (values: Readonly<Record<string, string>>): void => {
      if (bundle.submitting.value || bundle.confirm.value !== null) return;
      const payload = runPayload(values);
      const runNumber = values.runNumber?.trim() ?? '';
      bundle.submitError.value = '';
      const request: ConfirmRequest = {
        title: '运行物料需求计算',
        message: `将固定需求、BOM、政策、合格库存与在途采购的快照，生成运行编号 ${runNumber} 的建议批次；批次建立后输入不可修改。`,
        confirmLabel: '确认运行',
        run: () =>
          void commit('run', '/api/v1/mrp-runs', payload, `已运行物料需求计算 ${runNumber}`, true),
      };
      askConfirm(bundle.confirm, request);
    },
    // 建议决定（批准 / 拒绝 / 下达）：表单核对之后先确认，说明对哪条建议做什么、之后会怎样。
    runDecision: (values: Readonly<Record<string, string>>): void => {
      if (bundle.submitting.value || bundle.confirm.value !== null) return;
      const form = bundle.activeForm.value;
      const target = bundle.target.value;
      if (!target || (form !== 'approve' && form !== 'reject' && form !== 'release')) return;
      const payload = form === 'release' ? releasePayload(values) : decisionPayload(values);
      const sku = textOf(target.sku);
      const quantity = textOf(target.quantity);
      const dates = `${dayOf(target.start_at)} → ${dayOf(target.due_at)}`;
      const path = `/api/v1/mrp-proposals/${idOf(target)}/${form}`;
      const done = `已${form === 'release' ? '下达' : form === 'approve' ? '批准' : '拒绝'} ${sku} 的物料需求建议`;
      const explanation = target.explanation;
      const freezeUntil =
        typeof explanation === 'object' && explanation !== null
          ? textOf((explanation as MrpRow).freezeUntil)
          : '';
      const override = values.freezeOverrideApproval?.trim() ?? '';
      const request: ConfirmRequest =
        form === 'release'
          ? {
              title: '下达物料需求建议',
              message: `${sku} · 建议 ${quantity} · ${dates}。下达会记录放行决定，后续可据此安排采购或生产。`,
              confirmLabel: '确认下达',
              run: () => void commit(form, path, payload, done),
            }
          : form === 'approve'
            ? {
                title: '批准物料需求建议',
                message: `${sku} · 建议 ${quantity} · ${dates}。批准后建议进入待下达，决定会追加到不可变事件台账，不能改成拒绝。${override ? `这条建议在冻结窗口内（至 ${freezeUntil}），已填写覆盖审批编号 ${override}。` : ''}`,
                confirmLabel: '确认批准',
                run: () => void commit(form, path, payload, done),
              }
            : {
                title: '拒绝物料需求建议',
                message: `${sku} · 建议 ${quantity} · ${dates}。拒绝后这条建议结束，需要重新计算或调整需求；决定不可撤回。`,
                confirmLabel: '确认拒绝',
                // 破坏性动作：确认框的初焦落在「取消」上。
                destructive: true,
                run: () => void commit(form, path, payload, done),
              };
      bundle.submitError.value = '';
      askConfirm(bundle.confirm, request);
    },
    isDecision: (form: MrpForm | null): form is MrpDecision =>
      form !== null && (DECISIONS as readonly string[]).includes(form),
  };
}
