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
import type { SolutionConsolePorts, SolutionRow } from './solution-ports';

// U3-COM-2（ADR-0014 分域重写）：技术方案 Preact 控制台——原 vanilla solution
// workbench 能力面等价迁移（新建/修订/定稿、规格与上一版差异标记），列表页
// 解剖模板（筛选/客户端分页/抽屉详情）；页面不依赖 SalesViewController。
type SolutionPageState = Readonly<{
  solutions: readonly SolutionRow[];
  shownCount: number;
  statusFilter: 'ALL' | 'DRAFT' | 'FINAL';
  search: string;
  loadError: string;
  loading: boolean;
  selected: SolutionRow | null;
  activeForm: 'edit' | 'publish' | null;
  creating: boolean;
  permissions: ReadonlySet<string>;
  ports: SolutionConsolePorts;
  open: (solution: SolutionRow | null) => void;
  openForm: (form: 'edit' | 'publish') => void;
  openCreate: () => void;
  closeCreate: () => void;
  setStatusFilter: (next: 'ALL' | 'DRAFT' | 'FINAL') => void;
  setSearch: (next: string) => void;
  showMore: () => void;
  runRefresh: () => Promise<void>;
  runRevise: (solution: SolutionRow, payload: Record<string, unknown>) => Promise<void>;
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
}>;

// 与 vanilla solutionFields 同源（域常量单一来源：ctr-fields/solution 语义）。
const SPEC_FIELDS: readonly (readonly [string, string, boolean])[] = [
  ['productFamily', '产品系列', false],
  ['pileHeightMm', '草高（mm）', true],
  ['dtex', '草丝纤度（分特）', true],
  ['yarnMaterial', '草丝材质与形态', false],
  ['gauge', '行距', false],
  ['stitchRate', '簇密度（针/㎡）', true],
  ['backing', '底布系统', false],
  ['rollWidthMeters', '卷宽（米）', true],
  ['drainageRate', '排水能力（升/分钟/㎡）', true],
  ['infill', '填充建议', false],
  ['warrantyYears', '质保年限', true],
];

const recordOf = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const statusTone = (status: unknown): StatusTone => (status === 'FINAL' ? 'success' : 'info');

const solutionFormFields = (
  state: SolutionPageState,
  solution: SolutionRow | null,
): readonly FormSectionField[] => {
  const { ports } = state;
  const eligibleCtrs = ports.initialCtrs.filter((item) => item.status === 'APPROVED');
  const specification = recordOf(recordOf(solution).specification);
  const assumptions = Array.isArray(recordOf(solution).assumptions)
    ? (recordOf(solution).assumptions as readonly unknown[])
    : [];
  return [
    ...(solution
      ? []
      : [
          {
            name: 'code',
            label: '方案编号',
            required: true,
            placeholder: 'TS-2026-001',
          } satisfies FormSectionField,
        ]),
    {
      name: 'ctrVersionId',
      label: '已批准技术需求版本',
      type: 'select',
      required: true,
      value:
        typeof recordOf(solution).ctrVersionId === 'string'
          ? String(recordOf(solution).ctrVersionId)
          : '',
      options: eligibleCtrs.map((item) => ({
        value: String(item.id),
        label: `${ports.textValue(item.code, '技术需求')} · 第 ${ports.textValue(item.version, '1')} 版 · ${ports.textValue(item.title, '')}`,
      })),
    },
    ...SPEC_FIELDS.map(
      ([key, label, numeric]): FormSectionField => ({
        name: key,
        label,
        ...(numeric ? { type: 'number' as const } : {}),
        required: true,
        value: ports.formValue(specification[key]),
        ...(key === 'yarnMaterial' ? { placeholder: '聚乙烯单丝 + 曲丝' } : {}),
        ...(key === 'gauge' ? { placeholder: '3/4 英寸' } : {}),
      }),
    ),
    {
      name: 'assumptions',
      label: '工程假设（每行一项）',
      type: 'textarea',
      required: true,
      value: assumptions.map(String).join('\n'),
    },
    ...(solution
      ? []
      : [
          {
            name: 'state',
            label: '方案状态',
            type: 'select',
            required: true,
            options: [
              { value: 'DRAFT', label: '草稿' },
              { value: 'FINAL', label: '定稿（可进入成本核算）' },
            ],
          } satisfies FormSectionField,
        ]),
  ];
};

const solutionPayload = (values: Readonly<Record<string, string>>, final: boolean) => ({
  ctrVersionId: values.ctrVersionId ?? '',
  specification: {
    productFamily: values.productFamily ?? '',
    pileHeightMm: Number(values.pileHeightMm ?? 0),
    dtex: Number(values.dtex ?? 0),
    yarnMaterial: values.yarnMaterial ?? '',
    gauge: values.gauge ?? '',
    stitchRate: Number(values.stitchRate ?? 0),
    backing: values.backing ?? '',
    rollWidthMeters: Number(values.rollWidthMeters ?? 0),
    drainageRate: Number(values.drainageRate ?? 0),
    infill: values.infill ?? '',
    warrantyYears: Number(values.warrantyYears ?? 0),
  },
  assumptions: (values.assumptions ?? '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean),
  final,
});

const SolutionSummary = ({ state }: Readonly<{ state: SolutionPageState }>) => {
  const solution = state.selected;
  if (!solution) return null;
  const specification = recordOf(solution.specification);
  const previous = state.solutions.find(
    (item) =>
      item.technicalSolutionId === solution.technicalSolutionId &&
      Number(item.revision) === Number(solution.revision) - 1,
  );
  const previousSpecification = recordOf(previous?.specification);
  return (
    <div class="console-summary" data-testid="kt-solution-detail">
      <p>
        <span class="console-label">状态</span>
        <StatusBadge tone={statusTone(solution.status)}>
          {state.ports.textValue(solution.status, 'DRAFT') === 'FINAL' ? '定稿' : '草稿'}
        </StatusBadge>
        <span class="console-label">技术需求版本</span>
        {state.ports.textValue(solution.ctrVersionId, '—')}
        <span class="console-label">创建</span>
        {state.ports.textValue(solution.createdAt, '—').slice(0, 10)}
      </p>
      <dl class="ctr-specification" data-testid="kt-solution-spec">
        {SPEC_FIELDS.map(([key, label]) => {
          const current = state.ports.displayRequirement(specification[key]);
          const prior = state.ports.displayRequirement(previousSpecification[key]);
          const changed = previous !== undefined && current !== prior;
          return (
            <span key={key}>
              <span class="console-label">{label}</span>
              {changed ? `${current}（上一版：${prior}）` : current}
            </span>
          );
        })}
      </dl>
      <p>
        <span class="console-label">工程假设</span>
        {(Array.isArray(solution.assumptions) ? solution.assumptions : []).map(String).join('；') ||
          '—'}
      </p>
    </div>
  );
};

const SolutionDrawer = ({ state }: Readonly<{ state: SolutionPageState }>) => {
  const solution = state.selected;
  if (!solution) return null;
  const mayRevise = state.permissions.has('technical-solution:update');
  return (
    <DetailDrawer
      title={`方案详情 · ${state.ports.textValue(solution.code, '方案')} · 第 ${state.ports.textValue(solution.revision, '1')} 版`}
      onClose={() => {
        state.open(null);
      }}
    >
      <SolutionSummary state={state} />
      {mayRevise && state.activeForm === null ? (
        <div class="console-actions" data-testid="kt-solution-actions">
          <button
            type="button"
            class="secondary"
            data-testid="kt-solution-edit"
            onClick={() => {
              state.openForm('edit');
            }}
          >
            编辑（保存新修订）
          </button>
          <button
            type="button"
            class="primary"
            data-testid="kt-solution-publish"
            onClick={() => {
              state.openForm('publish');
            }}
          >
            定稿发布
          </button>
        </div>
      ) : null}
      {mayRevise && state.activeForm !== null ? (
        <FormSection
          title={state.activeForm === 'publish' ? '定稿发布（不可变修订）' : '保存新修订'}
          description={
            state.activeForm === 'publish'
              ? '定稿后方案可进入成本核算；修订不可变，将生成新的不可变版本。'
              : '新修订将保留旧版本及其技术需求引用。'
          }
          fields={solutionFormFields(state, solution)}
          submitLabel={state.activeForm === 'publish' ? '保存并定稿' : '保存新修订'}
          onSubmit={(values) =>
            state.runRevise(solution, solutionPayload(values, state.activeForm === 'publish'))
          }
        />
      ) : null}
    </DetailDrawer>
  );
};

const CreateDrawer = ({ state }: Readonly<{ state: SolutionPageState }>) => (
  <DetailDrawer title="新建技术方案" onClose={state.closeCreate}>
    <FormSection
      title="新建技术方案"
      description="方案的每项规格都将关联到选定的已批准技术需求版本。"
      fields={solutionFormFields(state, null)}
      submitLabel="保存技术方案"
      onSubmit={(values) => state.runCreate(values)}
    />
  </DetailDrawer>
);

const columns = (state: SolutionPageState): readonly DataTableColumn<SolutionRow>[] => [
  {
    key: 'code',
    header: '方案',
    sortable: true,
    field: (row) => state.ports.textValue(row.code, '方案'),
    render: (row) => (
      <span>
        {state.ports.textValue(row.code, '方案')} · 第 {state.ports.textValue(row.revision, '1')} 版
      </span>
    ),
  },
  {
    key: 'status',
    header: '状态',
    sortable: true,
    field: (row) => state.ports.textValue(row.status, 'DRAFT'),
    render: (row) => (
      <StatusBadge tone={statusTone(row.status)}>
        {row.status === 'FINAL' ? '定稿' : '草稿'}
      </StatusBadge>
    ),
  },
  {
    key: 'ctrVersionId',
    header: '技术需求版本',
    field: (row) => state.ports.textValue(row.ctrVersionId, '—'),
  },
  {
    key: 'createdAt',
    header: '创建时间',
    sortable: true,
    field: (row) => state.ports.textValue(row.createdAt, ''),
    render: (row) => state.ports.textValue(row.createdAt, '—').slice(0, 10),
  },
  {
    key: 'actions',
    header: '操作',
    field: () => '查看',
    render: (row) => (
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-solution-open"
        onClick={() => {
          state.open(row);
        }}
      >
        查看
      </button>
    ),
  },
];

const filteredSolutions = (state: SolutionPageState): readonly SolutionRow[] =>
  state.solutions.filter((row) => {
    if (state.statusFilter !== 'ALL' && row.status !== state.statusFilter) return false;
    if (state.search === '') return true;
    const code = state.ports.textValue(row.code, '');
    return code.toLowerCase().includes(state.search.toLowerCase());
  });

const SolutionView = (state: SolutionPageState) => {
  const visible = filteredSolutions(state);
  const shown = visible.slice(0, state.shownCount);
  const mayCreate =
    state.permissions.has('technical-solution:create') &&
    state.ports.initialCtrs.some((item) => item.status === 'APPROVED');
  return (
    <div class="commercial-console-page" data-testid="kt-solution-page">
      <PageHeader
        title="技术方案"
        description="产品规格、工程条件与版本修订"
        actions={
          <>
            <button
              type="button"
              class="secondary"
              data-testid="kt-solution-refresh"
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
                data-testid="kt-solution-create"
                onClick={() => {
                  state.openCreate();
                }}
              >
                ＋ 新建技术方案
              </button>
            ) : null}
          </>
        }
      />
      <div class="commercial-console-filters">
        {(['ALL', 'DRAFT', 'FINAL'] as const).map((option) => (
          <button
            key={option}
            type="button"
            class={state.statusFilter === option ? 'secondary compact active' : 'secondary compact'}
            data-testid={`kt-solution-filter-${option.toLowerCase()}`}
            onClick={() => {
              state.setStatusFilter(option);
            }}
          >
            {option === 'ALL' ? '全部' : option === 'DRAFT' ? '草稿' : '定稿'}
          </button>
        ))}
        <input
          type="search"
          placeholder="按方案编号检索"
          data-testid="kt-solution-search"
          value={state.search}
          onInput={(event) => {
            state.setSearch((event.target as { value?: string }).value ?? '');
          }}
        />
      </div>
      <DataTable
        columns={columns(state)}
        rows={shown}
        rowId={(row) => state.ports.textValue(row.id ?? row.technicalSolutionId, 'row')}
        caption="技术方案主列表（版本、状态与技术需求引用）"
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
        emptyTitle="暂无技术方案"
        emptyDescription="请先批准技术需求，再建立结构化方案。"
      />
      {state.selected ? <SolutionDrawer state={state} /> : null}
      {state.creating ? <CreateDrawer state={state} /> : null}
      {state.selected === null && state.solutions.length === 0 && state.loadError === '' ? (
        <EmptyState title="暂无技术方案" description="请先批准技术需求，再建立结构化方案。" />
      ) : null}
    </div>
  );
};

export function SolutionConsolePage(ports: SolutionConsolePorts) {
  const solutions = signal<readonly SolutionRow[]>([...ports.initialSolutions]);
  const shownCount = signal(20);
  const statusFilter = signal<'ALL' | 'DRAFT' | 'FINAL'>('ALL');
  const search = signal('');
  const loadError = signal('');
  const loading = signal(false);
  const selected = signal<SolutionRow | null>(null);
  const activeForm = signal<'edit' | 'publish' | null>(null);
  const creating = signal(false);

  const runRefresh = async (): Promise<void> => {
    loading.value = true;
    try {
      const fresh = await ports.refresh();
      solutions.value = fresh.solutions;
      loadError.value = '';
    } catch (error: unknown) {
      loadError.value = error instanceof Error ? error.message : '技术方案加载失败';
    } finally {
      loading.value = false;
    }
  };

  const runRevise = async (
    solution: SolutionRow,
    payload: Record<string, unknown>,
  ): Promise<void> => {
    loading.value = true;
    try {
      await ports.submit(
        `/api/v1/technical-solutions/${ports.textValue(solution.technicalSolutionId, '')}`,
        payload,
        'PUT',
      );
      const fresh = await ports.refresh();
      solutions.value = fresh.solutions;
      selected.value = null;
      activeForm.value = null;
      loadError.value = '';
    } catch (error: unknown) {
      loadError.value = error instanceof Error ? error.message : '方案修订保存失败';
    } finally {
      loading.value = false;
    }
  };

  const runCreate = async (values: Readonly<Record<string, string>>): Promise<void> => {
    loading.value = true;
    try {
      await ports.submit(
        '/api/v1/technical-solutions',
        {
          opportunityId: ports.technicalSolutionOpportunityId(
            ports.initialCtrs,
            values.ctrVersionId ?? '',
          ),
          code: values.code ?? '',
          ...solutionPayload(values, values.state === 'FINAL'),
        },
        'POST',
      );
      const fresh = await ports.refresh();
      solutions.value = fresh.solutions;
      creating.value = false;
      loadError.value = '';
    } catch (error: unknown) {
      loadError.value = error instanceof Error ? error.message : '技术方案创建失败';
    } finally {
      loading.value = false;
    }
  };

  const state = (): SolutionPageState => ({
    solutions: solutions.value,
    shownCount: shownCount.value,
    statusFilter: statusFilter.value,
    search: search.value,
    loadError: loadError.value,
    loading: loading.value,
    selected: selected.value,
    activeForm: activeForm.value,
    creating: creating.value,
    permissions: ports.permissions,
    ports,
    open: (solution) => {
      selected.value = solution;
      activeForm.value = null;
    },
    openForm: (form) => {
      activeForm.value = form;
    },
    openCreate: () => {
      creating.value = true;
    },
    closeCreate: () => {
      creating.value = false;
    },
    setStatusFilter: (next) => {
      statusFilter.value = next;
    },
    setSearch: (next) => {
      search.value = next;
    },
    showMore: () => {
      shownCount.value = shownCount.value + 20;
    },
    runRefresh,
    runRevise,
    runCreate,
  });

  const Page = () => SolutionView(state());
  return Page;
}
