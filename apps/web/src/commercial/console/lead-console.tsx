import { signal } from '@preact/signals';
import type { TargetedKeyboardEvent } from 'preact';
import {
  DataTable,
  DetailDrawer,
  FormSection,
  PageHeader,
  StatusBadge,
  type DataTableColumn,
  type FormSectionField,
} from '@kingturf/ui';
import type { LeadConsolePorts, LeadRow } from './lead-ports';
import {
  LeadOwnerCell,
  LeadTitleCell,
  LeadUpdatedCell,
  leadOwnerName,
  leadOwnerText,
  leadUnassignedLabel,
  type LeadCardContext,
} from './lead-console-cards';
import { Avatar } from '../../crm/crm-ux-parts';
import {
  dateTimeLabelOf,
  isPoolLead,
  leadStatusLabel,
  leadStatusTone,
  type LeadTab,
} from '../../crm/crm-ux';
import { failureMessage } from '../../shared/api-error-message';

// U3-CRM-1（ADR-0014 分域重写）：线索控制台——原 vanilla lead-records 能力面等价迁移
// （新建/认领/变更状态/分配改派/释放公海；列表/搜索/分页/详情抽屉）。
// CRM-UX：公海/私海分栏 + 线索卡富化（来源图标/负责人头像/最近更新）。写路径、载荷
// 与权限门不变；分栏只是同一份可见线索（CrmController.leads = 公海 ∪ 已分配）的两种视图。
type LeadFormKind = 'create' | 'transition' | 'assign' | null;
type LeadStatusFilter = 'ALL' | 'CLAIMED' | 'QUALIFIED' | 'DISQUALIFIED' | 'CONVERTED';

type LeadPageState = Readonly<{
  leads: readonly LeadRow[];
  shownCount: number;
  /** 当前生效分栏（不在可用分栏内时回落到首个可用分栏）。 */
  tab: LeadTab;
  tabs: readonly LeadTab[];
  statusFilter: LeadStatusFilter;
  search: string;
  loadError: string;
  submitError: string;
  loading: boolean;
  selected: LeadRow | null;
  activeForm: LeadFormKind;
  /** 相对时间基准（宿主注入；缺省系统时钟）。 */
  now: number;
  permissions: ReadonlySet<string>;
  ports: LeadConsolePorts;
  open: (row: LeadRow | null) => void;
  openForm: (kind: LeadFormKind) => void;
  closeForm: () => void;
  setTab: (next: LeadTab) => void;
  setStatusFilter: (next: LeadStatusFilter) => void;
  setSearch: (next: string) => void;
  runRefresh: () => Promise<void>;
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
  runState: (row: LeadRow, body: Record<string, unknown>) => Promise<void>;
  showMore: () => void;
}>;

const TAB_LABELS: Readonly<Record<LeadTab, string>> = { POOL: '公海', PRIVATE: '私海' };
const TAB_TEST_IDS: Readonly<Record<LeadTab, string>> = {
  POOL: 'kt-lead-tab-pool',
  PRIVATE: 'kt-lead-tab-private',
};
const PRIVATE_STATUS_FILTERS: readonly LeadStatusFilter[] = [
  'ALL',
  'CLAIMED',
  'QUALIFIED',
  'DISQUALIFIED',
  'CONVERTED',
];

/**
 * 可用分栏：有读权限即常显（空态照常呈现）；无权限但当前可见数据里已有该类线索时也显示
 *（如仅 lead:read 的角色在 COMPANY 范围下仍能看到公海行），保证没有任何可见线索因分栏而丢失。
 */
const leadTabs = (
  permissions: ReadonlySet<string>,
  leads: readonly LeadRow[],
): readonly LeadTab[] => {
  const hasPool = permissions.has('lead-pool:read') || leads.some(isPoolLead);
  const hasPrivate = permissions.has('lead:read') || leads.some((row) => !isPoolLead(row));
  return [...(hasPool ? ['POOL' as const] : []), ...(hasPrivate ? ['PRIVATE' as const] : [])];
};

const tabRows = (state: LeadPageState): readonly LeadRow[] =>
  state.leads.filter((row) => isPoolLead(row) === (state.tab === 'POOL'));

const filteredLeads = (state: LeadPageState): readonly LeadRow[] =>
  tabRows(state).filter((row) => {
    if (
      state.tab === 'PRIVATE' &&
      state.statusFilter !== 'ALL' &&
      row.status !== state.statusFilter
    )
      return false;
    if (state.search === '') return true;
    const haystack =
      `${state.ports.textValue(row.title, '')}${state.ports.textValue(row.source, '')}${state.ports.textValue(row.status, '')}${leadStatusLabel(row.status)}`.toLowerCase();
    return haystack.includes(state.search.toLowerCase());
  });

const emptyCopy = (
  state: LeadPageState,
  tabCount: number,
): Readonly<{ title: string; description: string }> => {
  if (tabCount > 0) return { title: '没有匹配的线索', description: '换个关键词或状态筛选试试' };
  return state.tab === 'POOL'
    ? { title: '公海暂无线索', description: '新线索默认进入公海，具备权限的同事可以直接认领' }
    : { title: '暂无已认领线索', description: '认领公海线索后会出现在这里' };
};

const cardContext = (state: LeadPageState): LeadCardContext => ({
  employeeChoices: state.ports.employeeChoices,
  now: state.now,
  open: (row) => {
    state.open(row);
  },
});

const columns = (state: LeadPageState): readonly DataTableColumn<LeadRow>[] => [
  {
    key: 'title',
    header: '线索标题',
    field: (row) => state.ports.textValue(row.title, '线索'),
    render: (row) => <LeadTitleCell row={row} context={cardContext(state)} />,
  },
  {
    key: 'status',
    header: '状态',
    field: (row) => state.ports.textValue(row.status, 'POOL'),
    render: (row) => {
      const status = state.ports.textValue(row.status, 'POOL');
      return <StatusBadge tone={leadStatusTone(status)}>{leadStatusLabel(status)}</StatusBadge>;
    },
  },
  {
    key: 'owner',
    header: '负责人',
    field: (row) => leadOwnerText(row, state.ports.employeeChoices),
    render: (row) => <LeadOwnerCell row={row} context={cardContext(state)} />,
  },
  {
    key: 'updatedAt',
    header: '最近更新',
    field: (row) => state.ports.textValue(row.updatedAt, ''),
    render: (row) => <LeadUpdatedCell row={row} context={cardContext(state)} />,
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

const neighborTab = (
  key: string,
  tabs: readonly LeadTab[],
  current: LeadTab,
): LeadTab | undefined => {
  const index = tabs.indexOf(current);
  if (key === 'ArrowRight') return tabs[index + 1];
  if (key === 'ArrowLeft') return tabs[index - 1];
  if (key === 'Home') return tabs[0];
  if (key === 'End') return tabs[tabs.length - 1];
  return undefined;
};

/** 公海/私海分栏（WAI-ARIA tabs：方向键/Home/End 切换并跟随焦点）。仅一个分栏可用时不渲染。 */
const LeadTabs = ({ state }: Readonly<{ state: LeadPageState }>) => {
  if (state.tabs.length < 2) return null;
  const counts: Readonly<Record<LeadTab, number>> = {
    POOL: state.leads.filter(isPoolLead).length,
    PRIVATE: state.leads.length - state.leads.filter(isPoolLead).length,
  };
  const onKeyDown = (event: TargetedKeyboardEvent<HTMLButtonElement>, current: LeadTab): void => {
    const next = neighborTab(event.key, state.tabs, current);
    if (next === undefined) return;
    event.preventDefault();
    state.setTab(next);
    const host = event.currentTarget as HTMLElement;
    host.parentElement?.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus();
  };
  return (
    <div class="crm-tabs" role="tablist" aria-label="线索分栏" data-testid="kt-lead-tabs">
      {state.tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          class="crm-tab"
          id={TAB_TEST_IDS[tab]}
          data-tab={tab}
          aria-selected={state.tab === tab}
          aria-controls="kt-lead-panel"
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
          <span class="crm-tab-count">{String(counts[tab])}</span>
        </button>
      ))}
    </div>
  );
};

const LeadDetail = ({ state }: Readonly<{ state: LeadPageState }>) => {
  const lead = state.selected;
  if (!lead) return null;
  const { ports } = state;
  const ownerName = leadOwnerName(lead, ports.employeeChoices);
  const ownerText = leadOwnerText(lead, ports.employeeChoices);
  const updated = dateTimeLabelOf(lead.updatedAt);
  return (
    <div class="console-summary" data-testid="kt-lead-detail">
      <p>
        <span class="console-label">状态</span>
        <StatusBadge tone={leadStatusTone(lead.status)}>
          {leadStatusLabel(ports.textValue(lead.status, 'POOL'))}
        </StatusBadge>
        <span class="console-label">来源</span>
        {ports.textValue(lead.source, '—')}
        <span class="console-label">负责人</span>
        <span class="crm-owner" data-tone={ownerText === '' ? 'empty' : 'named'}>
          <Avatar name={ownerName} />
          {ownerText === '' ? leadUnassignedLabel(lead) : ownerText}
        </span>
      </p>
      <p>
        <span class="console-label">关联客户</span>
        {ports.textValue(lead.customerId, '—').slice(0, 8)}
        <span class="console-label">创建</span>
        {ports.textValue(lead.createdAt, '—').slice(0, 10)}
        <span class="console-label">最近更新</span>
        {updated === '' ? '—' : updated}
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

const PAGE_COPY: Readonly<Record<LeadTab, Readonly<{ title: string; description: string }>>> = {
  POOL: { title: '线索公海', description: '尚未被认领的线索，具备权限的销售人员可以直接认领' },
  PRIVATE: {
    title: '销售线索',
    description: '已认领的线索在这里按状态推进；可认领的线索见「公海」',
  },
};

const LeadView = (state: LeadPageState) => {
  const visible = filteredLeads(state);
  const shown = visible.slice(0, state.shownCount);
  const mayCreate = state.permissions.has('lead:create');
  const pool = state.tab === 'POOL';
  const empty = emptyCopy(state, tabRows(state).length);
  return (
    <div class="commercial-console-page crm-ux" data-testid="kt-lead-page">
      <PageHeader
        title={PAGE_COPY[state.tab].title}
        description={PAGE_COPY[state.tab].description}
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
      <div class="crm-toolbar commercial-console-filters">
        <LeadTabs state={state} />
        {pool
          ? null
          : PRIVATE_STATUS_FILTERS.map((option) => (
              <button
                key={option}
                type="button"
                class="secondary compact crm-filter"
                aria-pressed={state.statusFilter === option}
                data-testid={`kt-lead-filter-${option.toLowerCase()}`}
                onClick={() => {
                  state.setStatusFilter(option);
                }}
              >
                {option === 'ALL' ? '全部' : leadStatusLabel(option)}
              </button>
            ))}
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
      <div role="tabpanel" id="kt-lead-panel" aria-labelledby={TAB_TEST_IDS[state.tab]}>
        <DataTable
          columns={columns(state)}
          rows={shown}
          rowId={(row) => state.ports.textValue(row.id ?? row.title, 'row')}
          caption={
            pool ? '公海线索列表（来源、负责人与最近更新）' : '销售线索主列表（状态、来源与负责人）'
          }
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
          emptyTitle={empty.title}
          emptyDescription={empty.description}
        />
      </div>
      {state.selected ? <LeadDrawer state={state} /> : null}
      {state.activeForm === 'create' ? <CreateDrawer state={state} /> : null}
    </div>
  );
};

export function LeadConsolePage(ports: LeadConsolePorts) {
  const defaultTab: LeadTab =
    ports.poolMode || !ports.permissions.has('lead:read') ? 'POOL' : 'PRIVATE';
  const bundle = {
    leads: signal<readonly LeadRow[]>([...ports.initialLeads]),
    tab: signal<LeadTab>(defaultTab),
    statusFilter: signal<LeadStatusFilter>('ALL'),
    search: signal(''),
    loadError: signal(''),
    submitError: signal(''),
    loading: signal(false),
    selected: signal<LeadRow | null>(null),
    activeForm: signal<LeadFormKind>(null),
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

  // 刷新后抽屉同步到最新行对象（认领/释放后状态与可用操作随之变化）；记录已不在
  // 可见范围（如释放后无公海权限）则关闭抽屉，避免停留在过期对象上继续操作。
  const syncSelected = (): void => {
    const current = bundle.selected.value;
    if (current === null || ports.textValue(current.id, '') === '') return;
    const id = ports.textValue(current.id, '');
    bundle.selected.value =
      bundle.leads.value.find((row) => ports.textValue(row.id, '') === id) ?? null;
  };

  const runRefresh = async (): Promise<void> => {
    bundle.loading.value = true;
    try {
      bundle.leads.value = await ports.refresh();
      bundle.loadError.value = '';
      syncSelected();
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
      // 新线索进入公海：切到公海分栏让结果可见（无公海视图时保持当前分栏）。
      if (leadTabs(ports.permissions, bundle.leads.value).includes('POOL'))
        bundle.tab.value = 'POOL';
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
      syncSelected();
      closeForm();
    } catch (error: unknown) {
      fail(error, '线索状态流转失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const state = (): LeadPageState => {
    const tabs = leadTabs(ports.permissions, bundle.leads.value);
    return {
      leads: bundle.leads.value,
      shownCount: bundle.shownCount.value,
      tab: tabs.includes(bundle.tab.value) ? bundle.tab.value : (tabs[0] ?? bundle.tab.value),
      tabs,
      statusFilter: bundle.statusFilter.value,
      search: bundle.search.value,
      loadError: bundle.loadError.value,
      submitError: bundle.submitError.value,
      loading: bundle.loading.value,
      selected: bundle.selected.value,
      activeForm: bundle.activeForm.value,
      now: ports.now?.() ?? Date.now(),
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
      setTab: (next) => {
        bundle.tab.value = next;
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
      runRefresh,
      runCreate,
      runState,
    };
  };

  const Page = () => LeadView(state());
  return Page;
}
