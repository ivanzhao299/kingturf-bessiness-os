import { signal, type Signal } from '@preact/signals';
import {
  DataTable,
  DetailDrawer,
  FormSection,
  PageHeader,
  StatusBadge,
  type DataTableColumn,
  type FormSectionField,
} from '@kingturf/ui';
import type { CustomerConsolePorts, CustomerRow } from './customer-ports';
import { Customer360Detail, type Customer360State } from './customer-console-360';
import {
  customerStatsOf,
  customerStatusLabel,
  customerStatusTone,
  recordOf,
  type CustomerCreditSummary,
  type CustomerStats,
} from '../../crm/crm-ux';
import { failureMessage } from '../../shared/api-error-message';

// U3-CRM-2（ADR-0014 分域重写）：客户控制台——原 vanilla customer-records 能力面
// 等价迁移（新建/客户 360 详情/联系人/活动时间线/商机关联/归属历史）。
// CRM-UX：列表顶部统计卡 + 360 抽屉增强（时间线/联系人卡/商机漏斗/信用概要），
// 详见 customer-console-360.tsx；写路径、载荷与权限门不变。
type CustomerFormKind = 'create' | null;
type CustomerStatusFilter = 'ALL' | 'PROSPECT' | 'ACTIVE' | 'INACTIVE';
const STATUS_FILTERS: readonly CustomerStatusFilter[] = ['ALL', 'PROSPECT', 'ACTIVE', 'INACTIVE'];

type CustomerBundle = Readonly<{
  customers: Signal<readonly CustomerRow[]>;
  statusFilter: Signal<CustomerStatusFilter>;
  search: Signal<string>;
  loadError: Signal<string>;
  submitError: Signal<string>;
  loading: Signal<boolean>;
  selected: Signal<CustomerRow | null>;
  view360: Signal<Readonly<Record<string, unknown>> | null>;
  activeForm: Signal<CustomerFormKind>;
  contactForm: Signal<boolean>;
  activityForm: Signal<boolean>;
  activityTypeFilter: Signal<string>;
  contactsVisible: Signal<boolean>;
  highlight: Signal<string>;
  credit: Signal<CustomerCreditSummary | null | undefined>;
  shownCount: Signal<number>;
}>;

type CustomerPageState = Customer360State &
  Readonly<{
    customers: readonly CustomerRow[];
    stats: CustomerStats;
    /** 高价值客户口径（宿主注入；未注入时不渲染该卡）。 */
    highValue: Readonly<{ label: string; hint: string; count: number }> | null;
    shownCount: number;
    statusFilter: CustomerStatusFilter;
    search: string;
    loadError: string;
    submitError: string;
    loading: boolean;
    selected: CustomerRow | null;
    view360: Readonly<Record<string, unknown>> | null;
    activeForm: CustomerFormKind;
    permissions: ReadonlySet<string>;
    ports: CustomerConsolePorts;
    open: (row: CustomerRow | null) => void;
    openForm: (kind: CustomerFormKind) => void;
    contactForm: boolean;
    openContactForm: () => void;
    closeContactForm: () => void;
    runAddContact: (values: Readonly<Record<string, string>>) => Promise<void>;
    activityForm: boolean;
    openActivityForm: () => void;
    closeActivityForm: () => void;
    runAddActivity: (values: Readonly<Record<string, string>>) => Promise<void>;
    closeForm: () => void;
    setStatusFilter: (next: CustomerStatusFilter) => void;
    setSearch: (next: string) => void;
    runRefresh: () => Promise<void>;
    runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
    showMore: () => void;
  }>;

const columns = (state: CustomerPageState): readonly DataTableColumn<CustomerRow>[] => [
  {
    key: 'customerNumber',
    header: '客户编号',
    field: (row) => state.ports.textValue(row.customerNumber, '—'),
  },
  {
    key: 'name',
    header: '客户名称',
    field: (row) => state.ports.textValue(row.name, '客户'),
    render: (row) => <span>{state.ports.textValue(row.name, '客户')}</span>,
  },
  {
    key: 'status',
    header: '状态',
    field: (row) => state.ports.textValue(row.status, 'PROSPECT'),
    render: (row) => {
      const status = state.ports.textValue(row.status, 'PROSPECT');
      return (
        <StatusBadge tone={customerStatusTone(status)}>{customerStatusLabel(status)}</StatusBadge>
      );
    },
  },
  {
    key: 'owner',
    header: '负责人',
    field: (row) => state.ports.textValue(row.ownerId, '—'),
    render: (row) => state.ports.textValue(row.ownerId, '未分配').slice(0, 8),
  },
  {
    key: 'actions',
    header: '操作',
    field: () => '查看',
    render: (row) => (
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-customer-open"
        onClick={() => {
          state.open(row);
        }}
      >
        查看
      </button>
    ),
  },
];

const filteredCustomers = (state: CustomerPageState): readonly CustomerRow[] =>
  state.customers.filter((row) => {
    if (state.statusFilter !== 'ALL' && row.status !== state.statusFilter) return false;
    if (state.search === '') return true;
    const haystack =
      `${state.ports.textValue(row.name, '')}${state.ports.textValue(row.customerNumber, '')}`.toLowerCase();
    return haystack.includes(state.search.toLowerCase());
  });

const percentOf = (part: number, total: number): string =>
  total === 0 ? '—' : `${String(Math.round((part / total) * 100))}%`;

const StatCard = ({
  testId,
  label,
  value,
  hint,
}: Readonly<{ testId: string; label: string; value: string; hint: string }>) => (
  <div class="crm-stat" data-testid={testId}>
    <span class="crm-stat-label">{label}</span>
    <strong class="crm-stat-value">{value}</strong>
    <span class="crm-stat-hint">{hint}</span>
  </div>
);

/** 客户列表顶部统计：基于已加载的可见客户全集；高价值卡仅在宿主给出口径时呈现。 */
const StatsBar = ({ state }: Readonly<{ state: CustomerPageState }>) => {
  const { stats } = state;
  return (
    <div class="crm-stats" data-testid="kt-customer-stats">
      <StatCard
        testId="kt-customer-stat-total"
        label="客户总数"
        value={stats.capped ? `${String(stats.total)}+` : String(stats.total)}
        hint={stats.capped ? '已达单次加载上限' : '当前可见范围'}
      />
      <StatCard
        testId="kt-customer-stat-active"
        label="活跃客户"
        value={String(stats.active)}
        hint={`占可见客户 ${percentOf(stats.active, stats.total)}`}
      />
      <StatCard
        testId="kt-customer-stat-new"
        label="新增本月"
        value={String(stats.newThisMonth)}
        hint="按创建时间统计"
      />
      {state.highValue === null ? null : (
        <StatCard
          testId="kt-customer-stat-high-value"
          label={state.highValue.label}
          value={String(state.highValue.count)}
          hint={state.highValue.hint}
        />
      )}
    </div>
  );
};

const CustomerDrawer = ({ state }: Readonly<{ state: CustomerPageState }>) => {
  const customer = state.selected;
  if (!customer) return null;
  const { ports, permissions } = state;
  const status = ports.textValue(customer.status, 'PROSPECT');
  return (
    <DetailDrawer
      title={`客户详情 · ${ports.textValue(customer.name, '客户')}`}
      onClose={() => {
        state.open(null);
      }}
    >
      {/* 操作区置顶：打开抽屉即可记录联系人/活动，无需滚过 360 内容。 */}
      <div class="console-actions" data-testid="kt-customer-actions">
        <StatusBadge tone={customerStatusTone(status)}>{customerStatusLabel(status)}</StatusBadge>
        <span class="console-label">编号</span>
        {ports.textValue(customer.customerNumber, '—')}
        {permissions.has('customer:update') && !state.contactForm ? (
          <button
            type="button"
            class="text-button"
            data-testid="kt-customer-add-contact"
            onClick={() => {
              state.openContactForm();
            }}
          >
            添加联系人
          </button>
        ) : null}
        {permissions.has('customer-activity:create') && !state.activityForm ? (
          <button
            type="button"
            class="text-button"
            data-testid="kt-customer-add-activity"
            onClick={() => {
              state.openActivityForm();
            }}
          >
            添加活动
          </button>
        ) : null}
      </div>
      {state.submitError !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-customer-submit-error">
          {state.submitError}
        </p>
      ) : null}
      {state.contactForm ? (
        <FormSection
          title="添加联系人"
          description="联系方式至少提供邮箱或电话之一；归一化后写入客户档案。"
          fields={[
            { name: 'name', label: '姓名', required: true },
            { name: 'title', label: '职务' },
            { name: 'email', label: '邮箱' },
            { name: 'phone', label: '电话' },
            {
              name: 'primary',
              label: '设为主联系人',
              type: 'select',
              required: true,
              options: [
                { value: 'false', label: '否' },
                { value: 'true', label: '是' },
              ],
            } satisfies FormSectionField,
          ]}
          submitLabel="保存联系人"
          onSubmit={(values) => {
            void state.runAddContact(values);
          }}
        />
      ) : null}
      {state.activityForm ? (
        <FormSection
          title="添加活动"
          description="活动记录写入客户时间线；发生时间默认为当前时间。"
          fields={
            [
              {
                name: 'activityType',
                label: '活动类型',
                type: 'select',
                required: true,
                options: [
                  { value: '拜访', label: '拜访' },
                  { value: '电话', label: '电话' },
                  { value: '邮件', label: '邮件' },
                  { value: '展会', label: '展会' },
                ],
              } satisfies FormSectionField,
              { name: 'summary', label: '活动摘要', required: true },
              { name: 'occurredAt', label: '发生时间（留空为当前时间）', type: 'date' },
            ] satisfies readonly FormSectionField[]
          }
          submitLabel="保存活动"
          onSubmit={(values) => {
            void state.runAddActivity(values);
          }}
        />
      ) : null}
      {state.view360 ? (
        <Customer360Detail {...state} />
      ) : (
        <p class="console-hint">客户 360 加载中…</p>
      )}
    </DetailDrawer>
  );
};

const CreateDrawer = ({ state }: Readonly<{ state: CustomerPageState }>) => (
  <DetailDrawer title="新建客户" onClose={state.closeForm}>
    <FormSection
      title="新建客户"
      description="客户档案创建后即可关联线索、商机与合同。"
      fields={
        [
          { name: 'name', label: '客户名称', required: true, placeholder: '例如：国际学校' },
          { name: 'customerNumber', label: '客户编号', required: true, placeholder: 'C-2026-001' },
          { name: 'tags', label: '标签（逗号分隔）' },
        ] satisfies readonly FormSectionField[]
      }
      submitLabel="创建客户"
      onSubmit={(values) => state.runCreate(values)}
    />
  </DetailDrawer>
);

const CustomerView = (state: CustomerPageState) => {
  const visible = filteredCustomers(state);
  const shown = visible.slice(0, state.shownCount);
  const mayCreate = state.permissions.has('customer:create');
  const filtered = state.statusFilter !== 'ALL' || state.search !== '';
  return (
    <div class="commercial-console-page crm-ux" data-testid="kt-customer-page">
      <PageHeader
        title="客户管理"
        description="客户档案、联系人、活动与商机全链路"
        actions={
          <>
            <button
              type="button"
              class="secondary"
              data-testid="kt-customer-refresh"
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
                data-testid="kt-customer-create"
                onClick={() => {
                  state.openForm('create');
                }}
              >
                ＋ 新建客户
              </button>
            ) : null}
          </>
        }
      />
      <StatsBar state={state} />
      <div class="crm-toolbar commercial-console-filters">
        {STATUS_FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            class="secondary compact crm-filter"
            aria-pressed={state.statusFilter === option}
            data-testid={`kt-customer-filter-${option.toLowerCase()}`}
            onClick={() => {
              state.setStatusFilter(option);
            }}
          >
            {option === 'ALL' ? '全部' : customerStatusLabel(option)}
          </button>
        ))}
        <input
          type="search"
          placeholder="按名称或编号检索"
          data-testid="kt-customer-search"
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
        rowId={(row) => state.ports.textValue(row.id ?? row.customerNumber, 'row')}
        caption="客户主列表（状态、负责人）"
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
        emptyTitle={filtered ? '没有匹配的客户' : '暂无客户'}
        emptyDescription={filtered ? '换个关键词或状态筛选试试' : '新建客户后会出现在这里'}
      />
      {state.selected ? <CustomerDrawer state={state} /> : null}
      {state.activeForm === 'create' ? <CreateDrawer state={state} /> : null}
    </div>
  );
};

// G2 压平：360 详情加载（选中行变化即异步拉取；失败经提交错误面呈现）。
function loadDetail(bundle: CustomerBundle, ports: CustomerConsolePorts, row: CustomerRow): void {
  const id = ports.textValue(row.id ?? row.customerNumber, '');
  bundle.credit.value = undefined;
  ports
    .load360(id)
    .then((view) => {
      if (bundle.selected.value !== row) return;
      bundle.view360.value = view;
      // 360 响应未内嵌信用分区且宿主提供数据通道时，另行加载（辅助信息：失败即隐藏，不打扰主流程）。
      if (view === null || Object.keys(recordOf(view.credit)).length > 0) return;
      if (ports.loadCredit === undefined) return;
      ports
        .loadCredit(id)
        .then((summary) => {
          if (bundle.selected.value === row) bundle.credit.value = summary;
        })
        .catch(() => {
          if (bundle.selected.value === row) bundle.credit.value = undefined;
        });
    })
    .catch((error: unknown) => {
      fail(error, bundle, '客户 360 加载失败');
    });
}

const fail = (
  error: unknown,
  bundle: Pick<CustomerBundle, 'selected' | 'activeForm' | 'submitError' | 'loadError'>,
  fallback: string,
): void => {
  const message = failureMessage(error, fallback);
  if (bundle.selected.value !== null || bundle.activeForm.value !== null)
    bundle.submitError.value = message;
  else bundle.loadError.value = message;
};

/** 提交成功后重取 360：抽屉仍是同一客户才落位，随后收起对应表单。 */
const reload360 = async (
  bundle: CustomerBundle,
  ports: CustomerConsolePorts,
  form: 'contactForm' | 'activityForm',
): Promise<void> => {
  const customer = bundle.selected.value;
  if (!customer) return;
  const fresh = await ports.load360(ports.textValue(customer.id, ''));
  if (fresh !== null && bundle.selected.value === customer) bundle.view360.value = fresh;
  bundle[form].value = false;
  bundle.submitError.value = '';
};

// 表单未填的可选字段初值是空串而非 undefined：空串必须归一为 null，否则服务端会对 ''
// 做联系方式格式校验并拒绝（"Contact phone is malformed"）。
const blankToNull = (value: string | undefined): string | null =>
  value === undefined || value === '' ? null : value;

const addActivity = async (
  bundle: CustomerBundle,
  ports: CustomerConsolePorts,
  values: Readonly<Record<string, string>>,
): Promise<void> => {
  const customer = bundle.selected.value;
  if (!customer) return;
  bundle.loading.value = true;
  bundle.submitError.value = '';
  try {
    await ports.createActivity(ports.textValue(customer.id, ''), {
      leadId: null,
      type: values.activityType ?? '拜访',
      occurredAt: values.occurredAt
        ? new Date(`${values.occurredAt}T00:00:00`).toISOString()
        : new Date().toISOString(),
      summary: values.summary ?? '',
      details: {},
    });
    await reload360(bundle, ports, 'activityForm');
  } catch (error: unknown) {
    fail(error, bundle, '活动创建失败');
  } finally {
    bundle.loading.value = false;
  }
};

const addContact = async (
  bundle: CustomerBundle,
  ports: CustomerConsolePorts,
  values: Readonly<Record<string, string>>,
): Promise<void> => {
  const customer = bundle.selected.value;
  if (!customer) return;
  bundle.loading.value = true;
  bundle.submitError.value = '';
  try {
    await ports.createContact(ports.textValue(customer.id, ''), {
      name: values.name ?? '',
      // TD-CRM-004：表单未填的可选字段初值是空串，须归一为 null（服务端对 '' 做格式校验并拒绝）。
      title: blankToNull(values.title),
      email: blankToNull(values.email),
      phone: blankToNull(values.phone),
      primary: values.primary === 'true',
    });
    await reload360(bundle, ports, 'contactForm');
  } catch (error: unknown) {
    fail(error, bundle, '联系人创建失败');
  } finally {
    bundle.loading.value = false;
  }
};

export function CustomerConsolePage(ports: CustomerConsolePorts) {
  const bundle: CustomerBundle = {
    customers: signal<readonly CustomerRow[]>([...ports.initialCustomers]),
    statusFilter: signal<CustomerStatusFilter>('ALL'),
    search: signal(''),
    loadError: signal(''),
    submitError: signal(''),
    loading: signal(false),
    selected: signal<CustomerRow | null>(null),
    view360: signal<Readonly<Record<string, unknown>> | null>(null),
    activeForm: signal<CustomerFormKind>(null),
    contactForm: signal(false),
    activityForm: signal(false),
    activityTypeFilter: signal(''),
    contactsVisible: signal(false),
    highlight: signal(''),
    credit: signal<CustomerCreditSummary | null | undefined>(undefined),
    shownCount: signal(20),
  };
  const closeForm = (): void => {
    bundle.activeForm.value = null;
    bundle.submitError.value = '';
  };
  const resetSubmitError = (): void => {
    bundle.submitError.value = '';
  };

  const runRefresh = async (): Promise<void> => {
    bundle.loading.value = true;
    try {
      bundle.customers.value = await ports.refresh();
      bundle.loadError.value = '';
    } catch (error: unknown) {
      fail(error, bundle, '客户加载失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const runCreate = async (values: Readonly<Record<string, string>>): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit('/api/v1/customers', {
        name: values.name ?? '',
        customerNumber: values.customerNumber ?? '',
        ...(values.tags
          ? {
              tags: values.tags
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean),
            }
          : {}),
      });
      bundle.customers.value = await ports.refresh();
      closeForm();
    } catch (error: unknown) {
      fail(error, bundle, '客户创建失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const runAddActivity = (values: Readonly<Record<string, string>>): Promise<void> =>
    addActivity(bundle, ports, values);
  const runAddContact = (values: Readonly<Record<string, string>>): Promise<void> =>
    addContact(bundle, ports, values);
  const clearHighlight = (): void => {
    bundle.highlight.value = '';
  };

  const state = (): CustomerPageState => {
    const customers = bundle.customers.value;
    const now = ports.now?.() ?? Date.now();
    return {
      customers,
      stats: customerStatsOf(customers, now),
      highValue:
        ports.highValue === undefined
          ? null
          : {
              label: ports.highValue.label,
              hint: ports.highValue.hint,
              count: ports.highValue.count(customers),
            },
      shownCount: bundle.shownCount.value,
      statusFilter: bundle.statusFilter.value,
      search: bundle.search.value,
      loadError: bundle.loadError.value,
      submitError: bundle.submitError.value,
      loading: bundle.loading.value,
      selected: bundle.selected.value,
      view360: bundle.view360.value,
      activeForm: bundle.activeForm.value,
      permissions: ports.permissions,
      ports,
      view: bundle.view360.value ?? {},
      now,
      contactsVisible: bundle.contactsVisible.value,
      setContactsVisible: (next) => {
        bundle.contactsVisible.value = next;
      },
      typeFilter: bundle.activityTypeFilter.value,
      onTypeFilter: (next) => {
        bundle.activityTypeFilter.value = next;
      },
      highlight: bundle.highlight.value,
      jumpTo: (targetId) => {
        bundle.highlight.value = targetId;
      },
      clearHighlight,
      canReadOpportunities: ports.permissions.has('opportunity:read'),
      canReadLeads: ports.permissions.has('lead:read'),
      credit: bundle.credit.value,
      open: (row) => {
        bundle.selected.value = row;
        bundle.activeForm.value = null;
        bundle.submitError.value = '';
        bundle.activityTypeFilter.value = '';
        // 切换客户时清空上一份 360 与表单：避免新数据到达前闪现上一客户的详情。
        bundle.view360.value = null;
        bundle.contactForm.value = false;
        bundle.activityForm.value = false;
        // 隐私默认：每次打开（或切换客户）联系方式回到遮蔽态。
        bundle.contactsVisible.value = false;
        if (row !== null) loadDetail(bundle, ports, row);
      },
      openForm: (kind) => {
        bundle.activeForm.value = kind;
        bundle.submitError.value = '';
      },
      contactForm: bundle.contactForm.value,
      openContactForm: () => {
        bundle.contactForm.value = true;
        bundle.activityForm.value = false;
        resetSubmitError();
      },
      closeContactForm: () => {
        bundle.contactForm.value = false;
        resetSubmitError();
      },
      runAddContact,
      activityForm: bundle.activityForm.value,
      openActivityForm: () => {
        bundle.activityForm.value = true;
        bundle.contactForm.value = false;
        resetSubmitError();
      },
      closeActivityForm: () => {
        bundle.activityForm.value = false;
        resetSubmitError();
      },
      runAddActivity,
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
    };
  };

  const Page = () => CustomerView(state());
  return Page;
}
