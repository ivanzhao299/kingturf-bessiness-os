import { signal } from '@preact/signals';
import {
  DataTable,
  DetailDrawer,
  PageHeader,
  StatusBadge,
  type DataTableColumn,
  type StatusTone,
} from '@kingturf/ui';
import type { CostMatrixPage, CostMatrixQuery } from '../types';
import type { CostMatrixConsolePorts, CostMatrixRow } from './cost-matrix-ports';
import { CompareBar, ComparePanel, type ComparisonState } from './cost-matrix-console-compare';
import { CreateDrawer, FactorForm } from './cost-matrix-console-forms';
import { FocusAnchor } from './focus-anchor';
import { ConsoleNotice } from './console-notice';
import {
  closeForm,
  comparisonActions,
  costMatrixActions,
  fail,
  runQueryFor,
  type MatrixSignalBundle,
} from './cost-matrix-console-actions';

// U3-COM-4（ADR-0014 分域重写）：规格成本矩阵控制台——原 vanilla ledger/detail 能力面
// 等价迁移（summaries 服务端分页与筛选、矩阵详情、因子增改、重算、报价成本决策 handoff）。
// COM-UX：主列表支持行选择（≤ 4 个模型）并发起因子对比（同因子取价来源并排 + 最优值标记）；
// 表单子组件拆至 cost-matrix-console-forms（G1 行数预算）。
export type MatrixFormKind = 'create' | 'addFactor' | 'editFactor' | null;

export type MatrixPageState = Readonly<{
  page: CostMatrixPage;
  query: CostMatrixQuery;
  search: string;
  productFamily: string;
  loadError: string;
  submitError: string;
  // TD-WF-014①（WFD 补齐）：最近一次写操作的成功提示。
  notice: string;
  loading: boolean;
  selected: CostMatrixRow | null;
  activeForm: MatrixFormKind;
  editingFactor: CostMatrixRow | null;
  permissions: ReadonlySet<string>;
  ports: CostMatrixConsolePorts;
  open: (matrix: CostMatrixRow | null) => void;
  openAsync: (matrix: CostMatrixRow) => Promise<void>;
  openForm: (kind: MatrixFormKind, factor?: CostMatrixRow) => void;
  closeForm: () => void;
  setSearch: (next: string) => void;
  setProductFamily: (next: string) => void;
  setAttention: (next: CostMatrixQuery['attention']) => void;
  setSort: (next: CostMatrixQuery['sort']) => void;
  gotoPage: (page: number) => void;
  runRefresh: () => Promise<void>;
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
  runAddFactor: (values: Readonly<Record<string, string>>) => Promise<void>;
  runUpdateFactor: (values: Readonly<Record<string, string>>) => Promise<void>;
  runCalculate: (mode: 'TAX_INCLUSIVE' | 'TAX_EXCLUSIVE') => Promise<void>;
  runQuoteCostDecision: () => Promise<void>;
  /** COM-UX 因子对比：已勾选的模型 id（插入序，≤ MAX_COMPARE_MODELS）。 */
  selectedIds: ReadonlySet<string>;
  compareLimitNotice: boolean;
  comparison: ComparisonState | null;
  setSelection: (next: ReadonlySet<string>) => void;
  clearSelection: () => void;
  openComparison: () => Promise<void>;
  closeComparison: () => void;
}>;

const ATTENTION_LABELS: Readonly<Record<string, string>> = {
  NEEDS_INPUT: '待录入',
  NEEDS_CALCULATION: '待核算',
  READY_FOR_QUOTE: '可报价',
  IN_QUOTE: '已入报价',
};

const statusTone = (attention: unknown): StatusTone => {
  if (attention === 'READY_FOR_QUOTE' || attention === 'IN_QUOTE') return 'success';
  if (attention === 'NEEDS_CALCULATION') return 'warning';
  return 'info';
};

const columns = (state: MatrixPageState): readonly DataTableColumn<CostMatrixRow>[] => [
  {
    key: 'code',
    header: '规格模型',
    sortable: false,
    field: (row) => state.ports.textValue(row.code, ''),
    render: (row) => (
      <span>
        {state.ports.textValue(row.code, '矩阵')} · {state.ports.textValue(row.name, '')}
      </span>
    ),
  },
  {
    key: 'attention',
    header: '状态',
    field: (row) => state.ports.textValue(row.attention, ''),
    render: (row) => {
      const attention = state.ports.textValue(row.attention, '');
      return (
        <StatusBadge tone={statusTone(attention)}>
          {ATTENTION_LABELS[attention] ?? '全部'}
        </StatusBadge>
      );
    },
  },
  {
    key: 'factorCount',
    header: '因子数',
    field: (row) => (Array.isArray(row.factors) ? row.factors.length : 0),
    render: (row) => String(Array.isArray(row.factors) ? row.factors.length : 0),
  },
  {
    key: 'updatedAt',
    header: '最近更新',
    field: (row) => state.ports.textValue(row.updatedAt, ''),
    render: (row) => state.ports.textValue(row.updatedAt, '—').slice(0, 10),
  },
  {
    key: 'actions',
    header: '操作',
    field: () => '查看',
    render: (row) => (
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-matrix-open"
        onClick={() => {
          void state.openAsync(row);
        }}
      >
        查看
      </button>
    ),
  },
];

const MatrixDetail = ({ state }: Readonly<{ state: MatrixPageState }>) => {
  const matrix = state.selected;
  if (!matrix) return null;
  const { ports } = state;
  const factors = Array.isArray(matrix.factors) ? matrix.factors : [];
  const calculations = Array.isArray(matrix.calculations) ? matrix.calculations : [];
  const latest = calculations.length > 0 ? ports.recordValue(calculations[0]) : null;
  return (
    <div class="console-summary" data-testid="kt-matrix-detail">
      <p>
        <span class="console-label">币种</span>
        {ports.textValue(matrix.currency, 'CNY')}
        <span class="console-label">默认税率</span>
        {ports.textValue(matrix.defaultTaxRate, '—')}
        {matrix.isSystemPreset === true ? <StatusBadge tone="info">系统预置</StatusBadge> : null}
      </p>
      <dl data-testid="kt-matrix-factors">
        {factors.map((factor) => {
          const item = ports.recordValue(factor);
          return (
            <p key={ports.textValue(item.factorCode ?? item.factorName, '因子')}>
              {ports.textValue(item.factorCode, '')} {ports.textValue(item.factorName, '')} ·{' '}
              {ports.textValue(item.category, '')} · {ports.textValue(item.quantity, '—')}{' '}
              {ports.textValue(item.unitCode, '')} · {ports.textValue(item.total, '—')}
            </p>
          );
        })}
      </dl>
      <div data-testid="kt-matrix-calculations">
        <span class="console-label">核算历史</span>
        {latest ? (
          <p>
            {ports.textValue(latest.pricingMode, '') === 'TAX_EXCLUSIVE' ? '未税成本' : '含税成本'}{' '}
            · {ports.textValue(latest.total, '—')} · {ports.textValue(latest.calculatedAt, '')}
          </p>
        ) : (
          <p>尚未核算</p>
        )}
      </div>
    </div>
  );
};

const MatrixDrawer = ({ state }: Readonly<{ state: MatrixPageState }>) => {
  const matrix = state.selected;
  if (!matrix) return null;
  const mayManage = state.permissions.has('cost-matrix:manage');
  const mayCalculate = state.permissions.has('cost-matrix:calculate');
  const mayEvaluate = state.permissions.has('cost:evaluate');
  const calculations = Array.isArray(matrix.calculations) ? matrix.calculations : [];
  const latest = calculations.length > 0 ? state.ports.recordValue(calculations[0]) : null;
  const factors = Array.isArray(matrix.factors) ? matrix.factors : [];
  return (
    <DetailDrawer
      title={`规格成本模型 · ${state.ports.textValue(matrix.code, '矩阵')}`}
      onClose={() => {
        state.open(null);
      }}
      // TD-WF-014①：写成功的提示放在抽屉底部，不随抽屉体滚走。
      footer={state.notice === '' ? undefined : <ConsoleNotice message={state.notice} />}
    >
      <MatrixDetail state={state} />
      {/* TD-WF-005 / TD-WF-012：行内表单开着时，提交失败显示在该表单自己的提示区（FormSection 的
          error，紧挨提交按钮）；这里的错误位只留给不经表单的动作。 */}
      {state.activeForm === null && state.submitError !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-matrix-submit-error">
          {state.submitError}
        </p>
      ) : null}
      {state.activeForm === null ? (
        <div class="console-actions" data-testid="kt-matrix-actions">
          {mayManage && !matrix.isSystemPreset ? (
            <button
              type="button"
              class="secondary"
              data-testid="kt-matrix-add-factor"
              onClick={() => {
                state.openForm('addFactor');
              }}
            >
              添加因子
            </button>
          ) : null}
          {mayCalculate ? (
            <button
              type="button"
              class="primary"
              data-testid="kt-matrix-calculate"
              onClick={() => {
                void state.runCalculate('TAX_INCLUSIVE');
              }}
            >
              重算（含税）
            </button>
          ) : null}
          {mayCalculate ? (
            <button
              type="button"
              class="secondary"
              data-testid="kt-matrix-calculate-exclusive"
              onClick={() => {
                void state.runCalculate('TAX_EXCLUSIVE');
              }}
            >
              重算（未税）
            </button>
          ) : null}
          {mayEvaluate && latest && typeof latest.id === 'string' ? (
            <button
              type="button"
              class="primary"
              data-testid="kt-matrix-quote-decision"
              onClick={() => {
                void state.runQuoteCostDecision();
              }}
            >
              生成报价成本决策
            </button>
          ) : null}
          {mayManage && factors.length > 0 && !matrix.isSystemPreset ? (
            <span class="console-hint">点击因子行可编辑（见下方因子表单选择）</span>
          ) : null}
        </div>
      ) : null}
      {mayManage && factors.length > 0 && !matrix.isSystemPreset && state.activeForm === null ? (
        <div data-testid="kt-matrix-factor-list">
          {factors.map((factor) => {
            const item = state.ports.recordValue(factor);
            const factorRecord: Readonly<Record<string, unknown>> = item;
            return (
              <p key={state.ports.textValue(item.factorCode ?? item.factorName, '因子')}>
                <button
                  type="button"
                  class="text-button"
                  data-testid="kt-matrix-edit-factor"
                  onClick={() => {
                    state.openForm('editFactor', factorRecord);
                  }}
                >
                  {state.ports.textValue(item.factorCode, '')}{' '}
                  {state.ports.textValue(item.factorName, '')}
                </button>
              </p>
            );
          })}
        </div>
      ) : null}
      {state.activeForm === 'addFactor' || state.activeForm === 'editFactor' ? (
        <FactorForm state={state} />
      ) : null}
      {/* TD-WF-014④：因子表单开合后，把键盘焦点带回抽屉。 */}
      <FocusAnchor token={String(state.activeForm)} />
    </DetailDrawer>
  );
};

const MatrixView = (state: MatrixPageState) => {
  const { ports } = state;
  const mayCreate = state.permissions.has('cost-matrix:manage');
  const recalculateOnPage = state.page.items.filter(
    (matrix) => matrix.needsRecalculation === true,
  ).length;
  return (
    <div class="commercial-console-page" data-testid="kt-matrix-page">
      <PageHeader
        title="规格成本模型台账"
        description={ports.roleGuidance(state.permissions)}
        actions={
          <>
            <button
              type="button"
              class="secondary"
              data-testid="kt-matrix-refresh"
              onClick={() => {
                void state.runRefresh();
              }}
            >
              刷新
            </button>
            {mayCreate ? (
              <button
                type="button"
                class="primary"
                data-testid="kt-matrix-create"
                onClick={() => {
                  state.openForm('create');
                }}
              >
                ＋ 新建规格模型
              </button>
            ) : null}
          </>
        }
      />
      <div class="commercial-console-metrics" data-testid="kt-matrix-summary">
        <article class="pipeline-metric info">
          <span>本页矩阵</span>
          <strong>{String(state.page.total)}</strong>
        </article>
        <article class={`pipeline-metric ${recalculateOnPage > 0 ? 'attention' : ''}`}>
          <span>本页待重新核算</span>
          <strong>{String(recalculateOnPage)}</strong>
        </article>
      </div>
      {state.selected ? null : <ConsoleNotice message={state.notice} />}
      <div class="commercial-console-filters">
        <input
          type="search"
          aria-label="搜索成本模型"
          placeholder="按编号/名称检索"
          data-testid="kt-matrix-search"
          value={state.search}
          onInput={(event) => {
            state.setSearch((event.target as { value?: string }).value ?? '');
          }}
        />
        <input
          type="search"
          aria-label="按产品系列筛选"
          placeholder="按产品系列筛选"
          data-testid="kt-matrix-family"
          value={state.productFamily}
          onInput={(event) => {
            state.setProductFamily((event.target as { value?: string }).value ?? '');
          }}
        />
        <select
          aria-label="按状态筛选"
          data-testid="kt-matrix-attention"
          value={state.query.attention}
          onInput={(event) => {
            state.setAttention(
              (event.target as { value?: string }).value as CostMatrixQuery['attention'],
            );
          }}
        >
          {['ALL', 'NEEDS_INPUT', 'NEEDS_CALCULATION', 'READY_FOR_QUOTE', 'IN_QUOTE'].map(
            (option) => (
              <option key={option} value={option}>
                {option === 'ALL' ? '全部' : (ATTENTION_LABELS[option] ?? option)}
              </option>
            ),
          )}
        </select>
        <select
          aria-label="排序方式"
          data-testid="kt-matrix-sort"
          value={state.query.sort}
          onInput={(event) => {
            state.setSort((event.target as { value?: string }).value as CostMatrixQuery['sort']);
          }}
        >
          {['ATTENTION', 'CODE', 'UPDATED', 'COST_DESC'].map((option) => (
            <option key={option} value={option}>
              {
                { ATTENTION: '按状态', CODE: '按编号', UPDATED: '按更新', COST_DESC: '按成本' }[
                  option
                ]
              }
            </option>
          ))}
        </select>
      </div>
      {state.loadError !== '' ? (
        <p class="console-error" role="alert">
          {state.loadError}
        </p>
      ) : null}
      <CompareBar state={state} />
      <ComparePanel state={state} />
      <DataTable
        columns={columns(state)}
        rows={state.page.items}
        rowId={(row) => ports.textValue(row.id ?? row.code, 'row')}
        caption="规格成本模型台账（服务端分页）"
        loading={state.loading}
        selection={{ selected: state.selectedIds, onChange: state.setSelection }}
        pagination={{
          loadedCount: state.page.items.length,
          hasMore: state.page.page * state.page.pageSize < state.page.total,
          loading: false,
          onLoadMore: () => {
            state.gotoPage(state.page.page + 1);
          },
        }}
        {...(state.loadError === '' ? {} : { error: state.loadError })}
        emptyTitle="暂无规格成本模型"
        emptyDescription="新建规格模型后会出现在这里"
      />
      <div class="data-table-footer">
        <span class="table-footnote">
          第 {String(state.page.page)} /{' '}
          {String(Math.max(1, Math.ceil(state.page.total / state.page.pageSize)))} 页
        </span>
        <button
          type="button"
          class="secondary compact"
          disabled={state.page.page <= 1}
          data-testid="kt-matrix-prev"
          onClick={() => {
            state.gotoPage(state.page.page - 1);
          }}
        >
          上一页
        </button>
        <button
          type="button"
          class="secondary compact"
          disabled={state.page.page * state.page.pageSize >= state.page.total}
          data-testid="kt-matrix-next"
          onClick={() => {
            state.gotoPage(state.page.page + 1);
          }}
        >
          下一页
        </button>
      </div>
      {state.selected ? <MatrixDrawer state={state} /> : null}
      {state.activeForm === 'create' ? <CreateDrawer state={state} /> : null}
      {/* TD-WF-014①：详情抽屉没开着时，写成功的提示显示在页头下方。 */}
    </div>
  );
};

export function CostMatrixConsolePage(ports: CostMatrixConsolePorts) {
  const bundle: MatrixSignalBundle = {
    page: signal<CostMatrixPage>(ports.initialPage),
    query: signal<CostMatrixQuery>({ ...ports.initialQuery }),
    search: signal(ports.initialQuery.query),
    productFamily: signal(ports.initialQuery.productFamily),
    loadError: signal(''),
    submitError: signal(''),
    loading: signal(false),
    selected: signal<CostMatrixRow | null>(null),
    activeForm: signal<MatrixFormKind>(null),
    editingFactor: signal<CostMatrixRow | null>(null),
    selectedIds: signal<ReadonlySet<string>>(new Set()),
    compareLimitNotice: signal(false),
    comparison: signal<ComparisonState | null>(null),
    notice: signal(''),
  };

  const runQuery = async (next: CostMatrixQuery): Promise<void> => {
    await runQueryFor(ports, bundle, next);
  };

  const state = (): MatrixPageState => ({
    page: bundle.page.value,
    query: bundle.query.value,
    search: bundle.search.value,
    productFamily: bundle.productFamily.value,
    loadError: bundle.loadError.value,
    submitError: bundle.submitError.value,
    notice: bundle.notice.value,
    loading: bundle.loading.value,
    selected: bundle.selected.value,
    activeForm: bundle.activeForm.value,
    editingFactor: bundle.editingFactor.value,
    permissions: ports.permissions,
    ports,
    // 开始下一个动作时清掉上一次的成功提示（与 submitError 同一处）。
    open: (matrix) => {
      bundle.selected.value = matrix;
      bundle.activeForm.value = null;
      bundle.editingFactor.value = null;
      bundle.submitError.value = '';
      bundle.notice.value = '';
    },
    openAsync: async (matrix) => {
      bundle.selected.value = matrix;
      bundle.activeForm.value = null;
      bundle.editingFactor.value = null;
      bundle.submitError.value = '';
      bundle.notice.value = '';
      try {
        const fresh = await ports.loadMatrix(ports.textValue(matrix.id ?? matrix.code, ''));
        if (fresh && bundle.selected.value === matrix) bundle.selected.value = fresh;
      } catch (error: unknown) {
        fail(error, bundle, '矩阵详情加载失败');
      }
    },
    openForm: (kind, factor) => {
      bundle.activeForm.value = kind;
      bundle.editingFactor.value = factor ?? null;
      bundle.submitError.value = '';
      bundle.notice.value = '';
    },
    closeForm: () => {
      closeForm(bundle);
    },
    setSearch: (next) => {
      bundle.search.value = next;
      void runQuery({ ...bundle.query.value, page: 1, query: next.trim().slice(0, 120) });
    },
    setProductFamily: (next) => {
      bundle.productFamily.value = next;
      void runQuery({ ...bundle.query.value, page: 1, productFamily: next.trim().slice(0, 80) });
    },
    setAttention: (next) => {
      void runQuery({ ...bundle.query.value, page: 1, attention: next });
    },
    setSort: (next) => {
      void runQuery({ ...bundle.query.value, page: 1, sort: next });
    },
    gotoPage: (next) => {
      void runQuery({ ...bundle.query.value, page: Math.max(1, next) });
    },
    runRefresh: async () => {
      await runQuery(bundle.query.value);
    },
    ...costMatrixActions(ports, bundle),
    selectedIds: bundle.selectedIds.value,
    compareLimitNotice: bundle.compareLimitNotice.value,
    comparison: bundle.comparison.value,
    ...comparisonActions(ports, bundle),
  });

  const Page = () => MatrixView(state());
  return Page;
}
