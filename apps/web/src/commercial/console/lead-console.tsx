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
import type { LeadConsolePorts, LeadRow } from './lead-ports';

// U3-CRM-1（ADR-0014 分域重写）：线索控制台——原 vanilla lead-records 能力面等价迁移
// （新建/认领/变更状态/分配改派/释放公海；列表/搜索/分页/详情抽屉）。
type LeadFormKind = 'create' | 'transition' | 'assign' | null;

type LeadPageState = Readonly<{
  leads: readonly LeadRow[];
  shownCount: number;
  statusFilter: 'ALL' | 'POOL' | 'CLAIMED' | 'QUALIFIED' | 'DISQUALIFIED' | 'CONVERTED';
  search: string;
  loadError: string;
  submitError: string;
  loading: boolean;
  selected: LeadRow | null;
  activeForm: LeadFormKind;
  permissions: ReadonlySet<string>;
  ports: LeadConsolePorts;
  open: (row: LeadRow | null) => void;
  openForm: (kind: LeadFormKind) => void;
  closeForm: () => void;
  setStatusFilter: (
    next: 'ALL' | 'POOL' | 'CLAIMED' | 'QUALIFIED' | 'DISQUALIFIED' | 'CONVERTED',
  ) => void;
  setSearch: (next: string) => void;
  runRefresh: () => Promise<void>;
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
  runState: (row: LeadRow, body: Record<string, unknown>) => Promise<void>;
  showMore: () => void;
}>;

const STATUS_LABELS: Readonly<Record<string, string>> = {
  POOL: '公海',
  CLAIMED: '已认领',
  QUALIFIED: '已确认',
  DISQUALIFIED: '无效线索',
  CONVERTED: '已转化',
};

const statusTone = (status: unknown): StatusTone => {
  if (status === 'QUALIFIED' || status === 'CONVERTED') return 'success';
  if (status === 'DISQUALIFIED') return 'danger';
  if (status === 'CLAIMED') return 'info';
  return 'neutral';
};

const columns = (state: LeadPageState): readonly DataTableColumn<LeadRow>[] => [
  {
    key: 'title',
    header: '线索标题',
    field: (row) => state.ports.textValue(row.title, '线索'),
    render: (row) => (
      <span>
        {state.ports.textValue(row.title, '线索')} · {state.ports.textValue(row.source, '—')}
      </span>
    ),
  },
  {
    key: 'status',
    header: '状态',
    field: (row) => state.ports.textValue(row.status, 'POOL'),
    render: (row) => {
      const status = state.ports.textValue(row.status, 'POOL');
      return <StatusBadge tone={statusTone(status)}>{STATUS_LABELS[status] ?? status}</StatusBadge>;
    },
  },
  {
    key: 'owner',
    header: '负责人',
    field: (row) => state.ports.textValue(row.ownerId, '—'),
    render: (row) => state.ports.textValue(row.ownerId, '未分配').slice(0, 8),
  },
  {
    key: 'createdAt',
    header: '创建时间',
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
        data-testid="kt-lead-open"
        onClick={() => {
          state.open(row);
        }}
      >
        查看
      </button>
    ),
  },
];

const filteredLeads = (state: LeadPageState): readonly LeadRow[] =>
  state.leads.filter((row) => {
    if (state.statusFilter !== 'ALL' && row.status !== state.statusFilter) return false;
    if (state.search === '') return true;
    const haystack =
      `${state.ports.textValue(row.title, '')}${state.ports.textValue(row.source, '')}${state.ports.textValue(row.status, '')}`.toLowerCase();
    return haystack.includes(state.search.toLowerCase());
  });

const LeadDetail = ({ state }: Readonly<{ state: LeadPageState }>) => {
  const lead = state.selected;
  if (!lead) return null;
  const { ports } = state;
  return (
    <div class="console-summary" data-testid="kt-lead-detail">
      <p>
        <span class="console-label">状态</span>
        <StatusBadge tone={statusTone(lead.status)}>
          {STATUS_LABELS[ports.textValue(lead.status, 'POOL')] ?? '—'}
        </StatusBadge>
        <span class="console-label">来源</span>
        {ports.textValue(lead.source, '—')}
        <span class="console-label">负责人</span>
        {ports.textValue(lead.ownerId, '未分配').slice(0, 8)}
      </p>
      <p>
        <span class="console-label">关联客户</span>
        {ports.textValue(lead.customerId, '—').slice(0, 8)}
        <span class="console-label">创建</span>
        {ports.textValue(lead.createdAt, '—').slice(0, 10)}
      </p>
    </div>
  );
};

const LeadDrawer = ({ state }: Readonly<{ state: LeadPageState }>) => {
  const lead = state.selected;
  if (!lead) return null;
  const { ports, permissions } = state;
  const status = ports.textValue(lead.status, 'POOL');
  const version = Number(lead.version ?? -1);
  const hasVersion = Number.isInteger(version) && version >= 0;
  const owner = lead.ownerId === undefined ? null : (lead.ownerId ?? null);
  const assignmentPermission = owner === null ? 'lead:assign' : 'lead:reassign';
  const mayClaim = status === 'POOL' && hasVersion && permissions.has('lead-pool:claim');
  const mayTransition = hasVersion && permissions.has('lead:lifecycle');
  const mayAssign = hasVersion && permissions.has(assignmentPermission);
  const mayRelease =
    typeof lead.ownerId === 'string' &&
    status === 'CLAIMED' &&
    hasVersion &&
    permissions.has('lead-pool:release');
  const employeeChoices = state.ports.employeeChoices;
  return (
    <DetailDrawer
      title={`线索详情 · ${ports.textValue(lead.title, '线索')}`}
      onClose={() => {
        state.open(null);
      }}
    >
      <LeadDetail state={state} />
      {state.submitError !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-lead-submit-error">
          {state.submitError}
        </p>
      ) : null}
      {state.activeForm === null ? (
        <div class="console-actions" data-testid="kt-lead-actions">
          {mayClaim ? (
            <button
              type="button"
              class="primary"
              data-testid="kt-lead-claim"
              onClick={() => {
                void state.runState(lead, { action: 'claim', expectedVersion: version });
              }}
            >
              认领
            </button>
          ) : null}
          {mayTransition ? (
            <button
              type="button"
              class="secondary"
              data-testid="kt-lead-transition"
              onClick={() => {
                state.openForm('transition');
              }}
            >
              变更状态
            </button>
          ) : null}
          {mayAssign ? (
            <button
              type="button"
              class="secondary"
              data-testid="kt-lead-assign"
              onClick={() => {
                state.openForm('assign');
              }}
            >
              {owner === null ? '分配' : '改派'}
            </button>
          ) : null}
          {mayRelease ? (
            <button
              type="button"
              class="secondary"
              data-testid="kt-lead-release"
              onClick={() => {
                void state.runState(lead, {
                  action: 'release',
                  expectedVersion: version,
                  reason: '释放至线索公海',
                });
              }}
            >
              释放公海
            </button>
          ) : null}
        </div>
      ) : null}
      {state.activeForm === 'transition' ? (
        <FormSection
          title="变更线索状态"
          description="线索状态变更将写入审计记录。"
          fields={[
            {
              name: 'status',
              label: '目标状态',
              type: 'select',
              required: true,
              options: [
                { value: 'QUALIFIED', label: '已确认' },
                { value: 'DISQUALIFIED', label: '无效线索' },
                { value: 'CONVERTED', label: '已转化' },
              ],
            },
            { name: 'reason', label: '变更原因', type: 'textarea', required: true },
          ]}
          submitLabel="确认变更"
          onSubmit={(values) =>
            state.runState(lead, {
              action: 'transition',
              status: values.status ?? '',
              expectedVersion: version,
              reason: values.reason ?? '',
            })
          }
        />
      ) : null}
      {state.activeForm === 'assign' ? (
        <FormSection
          title={owner === null ? '分配线索' : '改派线索'}
          description="指定负责人并保留分配原因。"
          fields={[
            employeeChoices.length > 0
              ? ({
                  name: 'assigneeId',
                  label: '负责人',
                  type: 'select',
                  required: true,
                  options: employeeChoices,
                } satisfies FormSectionField)
              : ({
                  name: 'assigneeId',
                  label: '负责人编号',
                  required: true,
                } satisfies FormSectionField),
            { name: 'reason', label: '分配原因', type: 'textarea', required: true },
          ]}
          submitLabel="确认分配"
          onSubmit={(values) =>
            state.runState(lead, {
              action: owner === null ? 'assign' : 'reassign',
              assigneeId: values.assigneeId ?? '',
              expectedVersion: version,
              reason: values.reason ?? '',
            })
          }
        />
      ) : null}
    </DetailDrawer>
  );
};

const CreateDrawer = ({ state }: Readonly<{ state: LeadPageState }>) => (
  <DetailDrawer title="新建线索" onClose={state.closeForm}>
    <FormSection
      title="新建线索"
      description="线索默认进入公海，具备权限的销售人员可以认领。"
      fields={[
        {
          name: 'title',
          label: '线索标题',
          required: true,
          placeholder: '例如：学校运动场改造项目',
          minLength: 2,
          maxLength: 160,
        },
        {
          name: 'source',
          label: '线索来源',
          type: 'select',
          required: true,
          options: [
            { value: '展会', label: '展会' },
            { value: '网站', label: '网站' },
            { value: '转介绍', label: '转介绍' },
            { value: '主动开发', label: '主动开发' },
          ],
        },
      ]}
      submitLabel="创建线索"
      onSubmit={(values) => state.runCreate(values)}
    />
  </DetailDrawer>
);

const LeadView = (state: LeadPageState) => {
  const visible = filteredLeads(state);
  const shown = visible.slice(0, state.shownCount);
  const mayCreate = state.permissions.has('lead:create');
  return (
    <div class="commercial-console-page" data-testid="kt-lead-page">
      <PageHeader
        title={state.ports.poolMode ? '线索公海' : '销售线索'}
        description="线索默认进入公海，具备权限的销售人员可以认领"
        actions={
          <>
            <button
              type="button"
              class="secondary"
              data-testid="kt-lead-refresh"
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
                data-testid="kt-lead-create"
                onClick={() => {
                  state.openForm('create');
                }}
              >
                ＋ 新建线索
              </button>
            ) : null}
          </>
        }
      />
      <div class="commercial-console-filters">
        {(['ALL', 'POOL', 'CLAIMED', 'QUALIFIED', 'DISQUALIFIED', 'CONVERTED'] as const).map(
          (option) => (
            <button
              key={option}
              type="button"
              class={
                state.statusFilter === option ? 'secondary compact active' : 'secondary compact'
              }
              data-testid={`kt-lead-filter-${option.toLowerCase()}`}
              onClick={() => {
                state.setStatusFilter(option);
              }}
            >
              {option === 'ALL' ? '全部' : (STATUS_LABELS[option] ?? option)}
            </button>
          ),
        )}
        <input
          type="search"
          placeholder="搜索线索标题、来源或状态"
          data-testid="kt-lead-search"
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
        rowId={(row) => state.ports.textValue(row.id ?? row.title, 'row')}
        caption="线索主列表（状态、来源与负责人）"
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
        emptyTitle="暂无线索"
        emptyDescription="新建线索后会出现在这里"
      />
      {state.selected ? <LeadDrawer state={state} /> : null}
      {state.activeForm === 'create' ? <CreateDrawer state={state} /> : null}
    </div>
  );
};

export function LeadConsolePage(ports: LeadConsolePorts) {
  const bundle = {
    leads: signal<readonly LeadRow[]>([...ports.initialLeads]),
    statusFilter: signal<'ALL' | 'POOL' | 'CLAIMED' | 'QUALIFIED' | 'DISQUALIFIED' | 'CONVERTED'>(
      'ALL',
    ),
    search: signal(''),
    loadError: signal(''),
    submitError: signal(''),
    loading: signal(false),
    selected: signal<LeadRow | null>(null),
    activeForm: signal<LeadFormKind>(null),
    shownCount: signal(20),
  };

  const fail = (error: unknown, fallback: string): void => {
    const message = error instanceof Error ? error.message : fallback;
    if (bundle.selected.value !== null || bundle.activeForm.value !== null)
      bundle.submitError.value = message;
    else bundle.loadError.value = message;
  };
  const closeForm = (): void => {
    bundle.activeForm.value = null;
    bundle.submitError.value = '';
  };

  const runRefresh = async (): Promise<void> => {
    bundle.loading.value = true;
    try {
      bundle.leads.value = await ports.refresh();
      bundle.loadError.value = '';
    } catch (error: unknown) {
      fail(error, '线索加载失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const runCreate = async (values: Readonly<Record<string, string>>): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit('/api/v1/leads', {
        title: values.title ?? '',
        source: values.source ?? '',
        customerId: null,
        pool: true,
      });
      bundle.leads.value = await ports.refresh();
      closeForm();
    } catch (error: unknown) {
      fail(error, '线索创建失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const runState = async (row: LeadRow, body: Record<string, unknown>): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit(
        `/api/v1/leads/${ports.textValue(row.id, '')}/state`,
        { ...body, lead: row },
        'PUT',
      );
      bundle.leads.value = await ports.refresh();
      closeForm();
    } catch (error: unknown) {
      fail(error, '线索状态流转失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const state = (): LeadPageState => ({
    leads: bundle.leads.value,
    shownCount: bundle.shownCount.value,
    statusFilter: bundle.statusFilter.value,
    search: bundle.search.value,
    loadError: bundle.loadError.value,
    submitError: bundle.submitError.value,
    loading: bundle.loading.value,
    selected: bundle.selected.value,
    activeForm: bundle.activeForm.value,
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
    runState,
  });

  const Page = () => LeadView(state());
  return Page;
}
