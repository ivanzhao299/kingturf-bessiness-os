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
import {
  CATEGORY_OPTIONS,
  SOURCE_OPTIONS,
  UNIT_OPTIONS,
  createCostFactorFields,
} from '../cost-factor-form';
import type { CostMatrixPage, CostMatrixQuery } from '../types';
import type { CostMatrixConsolePorts, CostMatrixRow } from './cost-matrix-ports';

// U3-COM-4（ADR-0014 分域重写）：规格成本矩阵控制台——原 vanilla ledger/detail 能力面
// 等价迁移（summaries 服务端分页与筛选、矩阵详情、因子增改、重算、报价成本决策 handoff）。
type MatrixFormKind = 'create' | 'addFactor' | 'editFactor' | null;

type MatrixPageState = Readonly<{
  page: CostMatrixPage;
  query: CostMatrixQuery;
  search: string;
  productFamily: string;
  loadError: string;
  submitError: string;
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
    >
      <MatrixDetail state={state} />
      {state.submitError !== '' ? (
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
    </DetailDrawer>
  );
};

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

const recordOf = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

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
      <div class="commercial-console-filters">
        <input
          type="search"
          placeholder="按编号/名称检索"
          data-testid="kt-matrix-search"
          value={state.search}
          onInput={(event) => {
            state.setSearch((event.target as { value?: string }).value ?? '');
          }}
        />
        <input
          type="search"
          placeholder="按产品系列筛选"
          data-testid="kt-matrix-family"
          value={state.productFamily}
          onInput={(event) => {
            state.setProductFamily((event.target as { value?: string }).value ?? '');
          }}
        />
        <select
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
      <DataTable
        columns={columns(state)}
        rows={state.page.items}
        rowId={(row) => ports.textValue(row.id ?? row.code, 'row')}
        caption="规格成本模型台账（服务端分页）"
        loading={state.loading}
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
    </div>
  );
};

export function CostMatrixConsolePage(ports: CostMatrixConsolePorts) {
  const page = signal<CostMatrixPage>(ports.initialPage);
  const query = signal<CostMatrixQuery>({ ...ports.initialQuery });
  const search = signal(ports.initialQuery.query);
  const productFamily = signal(ports.initialQuery.productFamily);
  const loadError = signal('');
  const submitError = signal('');
  const loading = signal(false);
  const selected = signal<CostMatrixRow | null>(null);
  const activeForm = signal<MatrixFormKind>(null);
  const editingFactor = signal<CostMatrixRow | null>(null);

  const applyPage = (next: CostMatrixPage): void => {
    page.value = next;
    loadError.value = '';
  };
  const fail = (error: unknown, fallback: string): void => {
    const message = error instanceof Error ? error.message : fallback;
    // 抽屉打开（含行级动作失败）就地呈现；列表级失败走表格错误面。
    if (selected.value !== null || activeForm.value !== null) submitError.value = message;
    else loadError.value = message;
  };
  const closeForm = (): void => {
    activeForm.value = null;
    editingFactor.value = null;
    submitError.value = '';
  };

  const runQuery = async (next: CostMatrixQuery): Promise<void> => {
    loading.value = true;
    try {
      query.value = next;
      applyPage(await ports.querySummaries(next));
    } catch (error: unknown) {
      fail(error, '规格成本模型加载失败');
    } finally {
      loading.value = false;
    }
  };

  const state = (): MatrixPageState => ({
    page: page.value,
    query: query.value,
    search: search.value,
    productFamily: productFamily.value,
    loadError: loadError.value,
    submitError: submitError.value,
    loading: loading.value,
    selected: selected.value,
    activeForm: activeForm.value,
    editingFactor: editingFactor.value,
    permissions: ports.permissions,
    ports,
    open: (matrix) => {
      selected.value = matrix;
      activeForm.value = null;
      editingFactor.value = null;
      submitError.value = '';
    },
    openAsync: async (matrix) => {
      selected.value = matrix;
      activeForm.value = null;
      editingFactor.value = null;
      submitError.value = '';
      try {
        const fresh = await ports.loadMatrix(ports.textValue(matrix.id ?? matrix.code, ''));
        if (fresh && selected.value === matrix) selected.value = fresh;
      } catch (error: unknown) {
        fail(error, '矩阵详情加载失败');
      }
    },
    openForm: (kind, factor) => {
      activeForm.value = kind;
      editingFactor.value = factor ?? null;
      submitError.value = '';
    },
    closeForm,
    setSearch: (next) => {
      search.value = next;
      void runQuery({ ...query.value, page: 1, query: next.trim().slice(0, 120) });
    },
    setProductFamily: (next) => {
      productFamily.value = next;
      void runQuery({ ...query.value, page: 1, productFamily: next.trim().slice(0, 80) });
    },
    setAttention: (next) => {
      void runQuery({ ...query.value, page: 1, attention: next });
    },
    setSort: (next) => {
      void runQuery({ ...query.value, page: 1, sort: next });
    },
    gotoPage: (next) => {
      void runQuery({ ...query.value, page: Math.max(1, next) });
    },
    runRefresh: async () => {
      await runQuery(query.value);
    },
    runCreate: async (values) => {
      loading.value = true;
      submitError.value = '';
      try {
        await ports.submit('/api/v1/cost-matrices', {
          code: values.code ?? '',
          name: values.name ?? '',
          ...(values.productItemVersionId
            ? { productItemVersionId: values.productItemVersionId }
            : {}),
          productSpecification: {},
          currency: values.currency ?? 'CNY',
          defaultTaxRate: values.defaultTaxRate ?? '0.13',
        });
        applyPage(await ports.refresh());
        closeForm();
      } catch (error: unknown) {
        fail(error, '规格模型创建失败');
      } finally {
        loading.value = false;
      }
    },
    runAddFactor: async (values) => {
      const matrix = selected.value;
      if (!matrix) return;
      loading.value = true;
      submitError.value = '';
      try {
        await ports.submit(`/api/v1/cost-matrices/${ports.textValue(matrix.id, '')}/factors`, {
          ...values,
        });
        const fresh = await ports.loadMatrix(ports.textValue(matrix.id, ''));
        if (fresh) selected.value = fresh;
        submitError.value = '';
        activeForm.value = null;
      } catch (error: unknown) {
        fail(error, '因子添加失败');
      } finally {
        loading.value = false;
      }
    },
    runUpdateFactor: async (values) => {
      const matrix = selected.value;
      const factor = editingFactor.value;
      if (!matrix || !factor) return;
      loading.value = true;
      submitError.value = '';
      try {
        await ports.submit(
          `/api/v1/cost-matrices/${ports.textValue(matrix.id, '')}/factors/${ports.textValue(factor.id, '')}`,
          { ...values },
          'PUT',
        );
        const fresh = await ports.loadMatrix(ports.textValue(matrix.id, ''));
        if (fresh) selected.value = fresh;
        closeForm();
      } catch (error: unknown) {
        fail(error, '因子保存失败');
      } finally {
        loading.value = false;
      }
    },
    runCalculate: async (mode) => {
      const matrix = selected.value;
      if (!matrix) return;
      loading.value = true;
      submitError.value = '';
      try {
        await ports.submit(`/api/v1/cost-matrices/${ports.textValue(matrix.id, '')}/calculate`, {
          pricingMode: mode,
        });
        const fresh = await ports.loadMatrix(ports.textValue(matrix.id, ''));
        if (fresh) selected.value = fresh;
      } catch (error: unknown) {
        fail(error, '矩阵重算失败');
      } finally {
        loading.value = false;
      }
    },
    runQuoteCostDecision: async () => {
      const matrix = selected.value;
      if (!matrix) return;
      const calculations = Array.isArray(matrix.calculations) ? matrix.calculations : [];
      const latest = calculations.length > 0 ? ports.recordValue(calculations[0]) : null;
      if (!latest || typeof latest.id !== 'string') return;
      loading.value = true;
      submitError.value = '';
      try {
        const result = ports.recordValue(
          await ports.submit(
            `/api/v1/cost-matrix-calculations/${ports.textValue(latest.id, '')}/quote-cost-decision`,
            {
              technicalSolutionRevisionId: ports.textValue(
                latest.technicalSolutionRevisionId ?? matrix.technicalSolutionRevisionId,
                '',
              ),
              modelVersionId: ports.textValue(latest.modelVersionId ?? matrix.version, ''),
            },
          ),
        );
        if (typeof result.costDecisionId === 'string') ports.navigateToQuotes();
      } catch (error: unknown) {
        fail(error, '报价成本决策创建失败');
      } finally {
        loading.value = false;
      }
    },
  });

  const Page = () => MatrixView(state());
  return Page;
}
