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
import { ctrRequirementFields } from '../ctr-fields';
import type { CtrConsolePorts, CtrRow } from './ctr-ports';
import {
  BaselineSelect,
  ChangeCell,
  DiffList,
  DiffSummary,
  countChanges,
  diffFields,
  previousVersion,
  sortVersions,
  versionNumber,
} from './solution-console-diff';
import { FocusAnchor } from './focus-anchor';
import { ctrActions, type CtrSignalBundle } from './ctr-console-actions';

// U3-COM-5（ADR-0014 分域重写）：技术需求单控制台——原 vanilla ctr workbench 能力面
// 等价迁移（新建/修订/提交评审/批准驳回/上传附件；列表/筛选/详情抽屉含版本差异）。
// COM-UX：版本差异升级为字段级红绿标记（需求字段 + 标题，可改选更早版本作基准），
// 列表新增「较上一版」列；差异原语与方案页共用 solution-console-diff。
export type CtrFormKind = 'create' | 'revise' | null;

export type CtrPageState = Readonly<{
  ctrs: readonly CtrRow[];
  statusFilter: 'ALL' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  search: string;
  loadError: string;
  submitError: string;
  loading: boolean;
  selected: CtrRow | null;
  activeForm: CtrFormKind;
  permissions: ReadonlySet<string>;
  ports: CtrConsolePorts;
  open: (row: CtrRow | null) => void;
  openForm: (kind: CtrFormKind) => void;
  openDecision: (decision: 'APPROVED' | 'REJECTED') => void;
  decision: 'APPROVED' | 'REJECTED' | null;
  closeForm: () => void;
  showMore: () => void;
  /** 版本差异的基准版本 id；空串 = 默认取上一版。 */
  baselineId: string;
  setBaseline: (id: string) => void;
  setStatusFilter: (next: 'ALL' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED') => void;
  setSearch: (next: string) => void;
  runRefresh: () => Promise<void>;
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
  runRevise: (row: CtrRow, values: Readonly<Record<string, string>>) => Promise<void>;
  runState: (row: CtrRow, body: Record<string, unknown>) => Promise<void>;
  runUpload: (row: CtrRow, file: File) => Promise<void>;
}>;

const STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  APPROVED: '已批准',
  REJECTED: '已驳回',
};

const statusTone = (status: unknown): StatusTone => {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'SUBMITTED') return 'warning';
  return 'info';
};

// vanilla ctr-view 创建/修订表单的需求字段（requirements 载荷逐字段同构）。
const REQUIREMENT_FIELDS = (
  requirements: Readonly<Record<string, unknown>>,
  display: (value: unknown) => string,
): readonly FormSectionField[] => [
  {
    name: 'application',
    label: '应用场景',
    type: 'select',
    required: true,
    value: display(requirements.application),
    options: [
      { value: '足球场', label: '足球场' },
      { value: '休闲景观', label: '休闲景观' },
      { value: '多功能运动场', label: '多功能运动场' },
      { value: '门球场', label: '门球场' },
      { value: '幼儿园活动区', label: '幼儿园活动区' },
      { value: '屋顶及露台', label: '屋顶及露台' },
    ],
  },
  {
    name: 'projectRegion',
    label: '项目地区',
    required: true,
    value: display(requirements.projectRegion),
    placeholder: '山东青岛',
  },
  {
    name: 'performanceStandard',
    label: '执行标准',
    type: 'select',
    required: true,
    value: display(requirements.performanceStandard),
    options: [
      { value: '企业验收标准', label: '企业验收标准' },
      { value: 'GB/T 20394', label: 'GB/T 20394 体育用人造草' },
      { value: '国际足联场地质量标准', label: '国际足联场地质量标准' },
      { value: '客户技术规范', label: '客户技术规范' },
    ],
  },
  {
    name: 'pileHeight',
    label: '草高（mm）',
    type: 'number',
    required: true,
    value: display(requirements.pileHeightMm),
    placeholder: '50',
  },
  {
    name: 'quantity',
    label: '预计面积（㎡）',
    type: 'number',
    required: true,
    value: display(requirements.quantitySquareMeters),
    placeholder: '8000',
  },
  {
    name: 'color',
    label: '颜色要求',
    required: true,
    value: display(requirements.color),
    placeholder: '双色翠绿',
  },
  {
    name: 'baseCondition',
    label: '场地基础条件',
    required: true,
    value: display(requirements.baseCondition),
  },
  {
    name: 'drainageRequirement',
    label: '排水要求',
    required: true,
    value: display(requirements.drainageRequirement),
  },
  {
    name: 'fireRating',
    label: '阻燃要求',
    required: true,
    value: display(requirements.fireRating),
  },
  {
    name: 'warrantyYears',
    label: '质保年限',
    type: 'number',
    required: true,
    value: display(requirements.warrantyYears),
  },
  {
    name: 'delivery',
    label: '交付要求',
    type: 'textarea',
    required: true,
    value: display(requirements.delivery),
  },
];

// 参与版本比对的字段：需求标题 + 全部需求字段。
const DIFF_FIELDS: readonly (readonly [string, string])[] = [
  ['title', '需求标题'],
  ...ctrRequirementFields,
];
const rowId = (ports: CtrConsolePorts, row: CtrRow): string => ports.textValue(row.id, '');
const diffSource = (ports: CtrConsolePorts, row: CtrRow): Readonly<Record<string, unknown>> => ({
  title: row.title,
  ...ports.recordValue(row.requirements),
});
// 同一需求单根的全部版本（按版本号升序）。
const versionsOf = (rows: readonly CtrRow[], row: CtrRow): readonly CtrRow[] =>
  sortVersions(
    rows.filter((item) => item.ctrId === row.ctrId),
    (item) => versionNumber(item, 'version'),
  );
const changesAgainst = (ports: CtrConsolePorts, row: CtrRow, baseline: CtrRow | null): number =>
  baseline
    ? countChanges(
        diffFields(
          DIFF_FIELDS,
          diffSource(ports, row),
          diffSource(ports, baseline),
          ports.displayRequirement,
        ),
      )
    : 0;
const changesFromPrevious = (
  ports: CtrConsolePorts,
  rows: readonly CtrRow[],
  row: CtrRow,
): Readonly<{ count: number; hasBaseline: boolean }> => {
  const baseline = previousVersion(versionsOf(rows, row), row, (item) => rowId(ports, item));
  return { count: changesAgainst(ports, row, baseline), hasBaseline: baseline !== null };
};

const columns = (state: CtrPageState): readonly DataTableColumn<CtrRow>[] => [
  {
    key: 'code',
    header: '技术需求单',
    field: (row) => state.ports.textValue(row.code, '技术需求单'),
    render: (row) => (
      <span>
        {state.ports.textValue(row.code, '技术需求单')} ·{' '}
        {state.ports.textValue(row.title, '未命名需求')}
      </span>
    ),
  },
  {
    key: 'version',
    header: '版本',
    field: (row) => Number(row.version ?? 0),
    render: (row) => `第 ${state.ports.textValue(row.version, '1')} 版`,
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
    key: 'attachments',
    header: '附件',
    field: (row) => (Array.isArray(row.attachments) ? row.attachments.length : 0),
  },
  {
    key: 'changes',
    header: '较上一版',
    field: (row) => {
      const changes = changesFromPrevious(state.ports, state.ctrs, row);
      return changes.hasBaseline ? changes.count : -1;
    },
    render: (row) => {
      const changes = changesFromPrevious(state.ports, state.ctrs, row);
      return <ChangeCell count={changes.count} hasBaseline={changes.hasBaseline} />;
    },
  },
  {
    key: 'actions',
    header: '操作',
    field: () => '查看',
    render: (row) => (
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-ctr-open"
        onClick={() => {
          state.open(row);
        }}
      >
        查看
      </button>
    ),
  },
];

const filteredCtrs = (state: CtrPageState): readonly CtrRow[] =>
  state.ctrs.filter((row) => {
    if (state.statusFilter !== 'ALL' && row.status !== state.statusFilter) return false;
    if (state.search === '') return true;
    return state.ports.textValue(row.code, '').toLowerCase().includes(state.search.toLowerCase());
  });

const CtrDetail = ({ state }: Readonly<{ state: CtrPageState }>) => {
  const row = state.selected;
  if (!row) return null;
  const { ports } = state;
  const idOf = (item: CtrRow): string => rowId(ports, item);
  const versions = versionsOf(state.ctrs, row);
  const baseline =
    state.baselineId === ''
      ? previousVersion(versions, row, idOf)
      : (versions.find((item) => idOf(item) === state.baselineId) ?? null);
  const solutions = state.ports.initialSolutions.filter((item) => item.ctrVersionId === row.id);
  const attachments = Array.isArray(row.attachments) ? row.attachments : [];
  return (
    <div class="console-summary" data-testid="kt-ctr-detail">
      <p>
        <span class="console-label">状态</span>
        <StatusBadge tone={statusTone(row.status)}>
          {STATUS_LABELS[ports.textValue(row.status, 'DRAFT')] ?? '—'}
        </StatusBadge>
        <span class="console-label">关联商机</span>
        {ports.textValue(row.opportunityId, '—').slice(0, 8)}
        <span class="console-label">快照</span>
        {ports.textValue(row.snapshotHash, '—').slice(0, 8)}
      </p>
      <div class="com-diff-toolbar">
        <DiffSummary
          changed={changesAgainst(ports, row, baseline)}
          hasBaseline={baseline !== null}
          baseline={`第 ${ports.textValue(baseline?.version, '1')} 版`}
        />
        <BaselineSelect
          versions={versions.map((item) => ({
            id: idOf(item),
            number: versionNumber(item, 'version'),
          }))}
          currentNumber={versionNumber(row, 'version')}
          selectedId={baseline ? idOf(baseline) : ''}
          onSelect={state.setBaseline}
        />
      </div>
      <DiffList
        fields={diffFields(
          DIFF_FIELDS,
          diffSource(ports, row),
          baseline ? diffSource(ports, baseline) : null,
          ports.displayRequirement,
        )}
        testId="kt-ctr-spec"
      />
      <p>
        <span class="console-label">技术方案关联</span>
        {solutions.length === 0
          ? '—'
          : solutions
              .map(
                (item) =>
                  `${ports.textValue(item.code, '方案')} · 第 ${ports.textValue(item.revision, '1')} 版 · ${ports.textValue(item.status, '')}`,
              )
              .join('；')}
      </p>
      <p>
        <span class="console-label">附件</span>
        {`${String(attachments.length)} 个`}
      </p>
    </div>
  );
};

const CtrDrawer = ({ state }: Readonly<{ state: CtrPageState }>) => {
  const row = state.selected;
  if (!row) return null;
  const { ports, permissions } = state;
  const status = ports.textValue(row.status, 'DRAFT');
  const version = Number(row.version ?? 1);
  const mayUpload =
    status === 'DRAFT' && permissions.has('ctr:update') && permissions.has('attachment:manage');
  const mayRevise =
    permissions.has('ctr:update') && status !== 'DRAFT' && row.isLatestVersion === true;
  const requirements = ports.recordValue(row.requirements);
  return (
    <DetailDrawer
      title={`技术需求详情 · ${ports.textValue(row.code, '技术需求单')} · 第 ${ports.textValue(row.version, '1')} 版`}
      onClose={() => {
        state.open(null);
      }}
    >
      <CtrDetail state={state} />
      {/* TD-WF-005 / TD-WF-012：行内表单开着时，提交失败显示在该表单自己的提示区（FormSection 的
          error，紧挨提交按钮）；这里的错误位只留给不经表单的动作。 */}
      {state.decision === null && state.activeForm === null && state.submitError !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-ctr-submit-error">
          {state.submitError}
        </p>
      ) : null}
      {state.activeForm === null ? (
        <div class="console-actions" data-testid="kt-ctr-actions">
          {mayUpload ? (
            <label class="secondary" data-testid="kt-ctr-upload">
              上传附件
              <input
                type="file"
                hidden
                onChange={(event) => {
                  const file = (event.target as { files?: FileList | null }).files?.[0];
                  if (file) void state.runUpload(row, file);
                }}
              />
            </label>
          ) : null}
          {status === 'DRAFT' && permissions.has('ctr:submit') ? (
            <button
              type="button"
              class="primary"
              data-testid="kt-ctr-submit"
              onClick={() => {
                void state.runState(row, {
                  action: 'submit',
                  expectedVersion: version,
                });
              }}
            >
              提交评审
            </button>
          ) : null}
          {status === 'SUBMITTED' && permissions.has('ctr:approve') ? (
            <button
              type="button"
              class="primary"
              data-testid="kt-ctr-approve"
              onClick={() => {
                state.openDecision('APPROVED');
              }}
            >
              批准
            </button>
          ) : null}
          {status === 'SUBMITTED' && permissions.has('ctr:approve') ? (
            <button
              type="button"
              class="secondary"
              data-testid="kt-ctr-reject"
              onClick={() => {
                state.openDecision('REJECTED');
              }}
            >
              驳回
            </button>
          ) : null}
          {mayRevise ? (
            <button
              type="button"
              class="secondary"
              data-testid="kt-ctr-revise"
              onClick={() => {
                state.openForm('revise');
              }}
            >
              新建修订
            </button>
          ) : null}
        </div>
      ) : null}
      {state.decision !== null ? (
        <FormSection
          title={`${state.decision === 'APPROVED' ? '批准' : '驳回'}技术需求`}
          description="审批决定和理由将永久保留。"
          fields={[{ name: 'reason', label: '审批意见', type: 'textarea', required: true }]}
          submitLabel={`确认${state.decision === 'APPROVED' ? '批准' : '驳回'}`}
          error={state.submitError}
          onSubmit={(values) =>
            state.runState(row, {
              action: 'decide',
              decision: state.decision,
              reason: values.reason ?? '',
            })
          }
        />
      ) : null}
      {state.activeForm === 'revise' ? (
        <FormSection
          title={`新建 ${ports.textValue(row.code, 'CTR')} 修订`}
          description={`基于第 ${ports.textValue(row.version, '1')} 版创建新的可编辑草稿，历史版本保持不变。`}
          fields={[
            {
              name: 'title',
              label: '需求标题',
              required: true,
              value: ports.textValue(row.title, ''),
            },
            ...REQUIREMENT_FIELDS(requirements, ports.displayRequirement),
          ]}
          submitLabel="创建修订草稿"
          error={state.submitError}
          onSubmit={(values) => state.runRevise(row, values)}
        />
      ) : null}
      {/* TD-WF-014④：审批 / 驳回、修订的行内表单开合后，把键盘焦点带回抽屉。 */}
      <FocusAnchor token={`${String(state.activeForm)}|${String(state.decision)}`} />
    </DetailDrawer>
  );
};

const CreateDrawer = ({ state }: Readonly<{ state: CtrPageState }>) => {
  const { ports } = state;
  return (
    <DetailDrawer title="新建技术需求" onClose={state.closeForm}>
      <FormSection
        title="新建技术需求"
        description="技术需求单必须关联一个商机，提交前可以继续创建修订版本。"
        fields={[
          {
            name: 'opportunityId',
            label: '关联商机',
            type: 'select',
            required: true,
            options: ports.opportunities.map((item) => ({
              value: item.id,
              label: item.name ?? item.id,
            })),
          },
          { name: 'code', label: '技术需求单编号', required: true, placeholder: 'JSXQ-2026-001' },
          {
            name: 'title',
            label: '需求标题',
            required: true,
            placeholder: '学校足球场人造草坪技术需求',
          },
          ...REQUIREMENT_FIELDS({}, ports.displayRequirement),
        ]}
        submitLabel="创建技术需求"
        error={state.submitError}
        onSubmit={(values) => state.runCreate(values)}
      />
    </DetailDrawer>
  );
};

const CtrView = (state: CtrPageState) => {
  const visible = filteredCtrs(state);
  const shown = visible.slice(0, 20);
  const mayCreate = state.permissions.has('ctr:create');
  return (
    <div class="commercial-console-page" data-testid="kt-ctr-page">
      <PageHeader
        title="技术需求单"
        description="结构化记录场景、规格、数量和交付要求，提交后形成不可变快照"
        actions={
          mayCreate ? (
            <button
              type="button"
              class="primary"
              data-testid="kt-ctr-create"
              onClick={() => {
                state.openForm('create');
              }}
            >
              ＋ 新建技术需求
            </button>
          ) : null
        }
      />
      <div class="commercial-console-filters">
        {(['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const).map((option) => (
          <button
            key={option}
            type="button"
            class={state.statusFilter === option ? 'secondary compact active' : 'secondary compact'}
            data-testid={`kt-ctr-filter-${option.toLowerCase()}`}
            onClick={() => {
              state.setStatusFilter(option);
            }}
          >
            {option === 'ALL' ? '全部' : (STATUS_LABELS[option] ?? option)}
          </button>
        ))}
        <input
          type="search"
          aria-label="按技术需求单编号检索"
          placeholder="按编号检索"
          data-testid="kt-ctr-search"
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
        caption="技术需求单主列表（版本、状态与附件）"
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
        emptyTitle="暂无技术需求单"
        emptyDescription="请先从已确认需求的商机创建。"
      />
      {state.selected ? <CtrDrawer state={state} /> : null}
      {state.activeForm === 'create' ? <CreateDrawer state={state} /> : null}
    </div>
  );
};

export function CtrConsolePage(ports: CtrConsolePorts) {
  // G5 拆分：状态面与动作工厂（ctr-console-actions.ts）分开。
  const bundle: CtrSignalBundle = {
    ctrs: signal<readonly CtrRow[]>([...ports.initialCtrs]),
    solutions: signal<readonly CtrRow[]>([...ports.initialSolutions]),
    statusFilter: signal<'ALL' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'>('ALL'),
    search: signal(''),
    loadError: signal(''),
    submitError: signal(''),
    loading: signal(false),
    selected: signal<CtrRow | null>(null),
    activeForm: signal<CtrFormKind>(null),
    decision: signal<'APPROVED' | 'REJECTED' | null>(null),
    shownCount: signal(20),
    baselineId: signal(''),
  };
  const actions = ctrActions(ports, bundle);

  const latestVersionByCtr = new Map<string, number>();
  for (const item of bundle.ctrs.value) {
    const rootId = typeof item.ctrId === 'string' ? item.ctrId : '';
    const revision = typeof item.version === 'number' ? item.version : 0;
    latestVersionByCtr.set(rootId, Math.max(latestVersionByCtr.get(rootId) ?? 0, revision));
  }
  const withLatest = bundle.ctrs.value.map((item) => ({
    ...item,
    isLatestVersion:
      Number(item.version ?? 0) ===
      latestVersionByCtr.get(typeof item.ctrId === 'string' ? item.ctrId : ''),
  }));

  const state = (): CtrPageState => ({
    ctrs: withLatest,
    statusFilter: bundle.statusFilter.value,
    search: bundle.search.value,
    loadError: bundle.loadError.value,
    submitError: bundle.submitError.value,
    loading: bundle.loading.value,
    selected: bundle.selected.value,
    activeForm: bundle.activeForm.value,
    decision: bundle.decision.value,
    permissions: ports.permissions,
    ports,
    open: (row) => {
      bundle.selected.value = row;
      bundle.activeForm.value = null;
      bundle.decision.value = null;
      bundle.baselineId.value = '';
      bundle.submitError.value = '';
    },
    openForm: (kind) => {
      bundle.activeForm.value = kind;
      bundle.decision.value = null;
      bundle.submitError.value = '';
    },
    baselineId: bundle.baselineId.value,
    setBaseline: (id) => {
      bundle.baselineId.value = id;
    },
    setStatusFilter: (next) => {
      bundle.statusFilter.value = next;
    },
    setSearch: (next) => {
      bundle.search.value = next;
    },
    showMore: () => {
      bundle.shownCount.value = bundle.shownCount.value + 20;
    },
    ...actions,
    openDecision: (decision) => {
      bundle.decision.value = decision;
    },
  });

  const Page = () => CtrView(state());
  return Page;
}
