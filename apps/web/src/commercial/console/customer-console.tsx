import { signal, type Signal } from '@preact/signals';
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
import { businessEventLabel } from '../../shared/business-labels';
import type { CustomerConsolePorts, CustomerRow } from './customer-ports';

// U3-CRM-2（ADR-0014 分域重写）：客户控制台——原 vanilla customer-records 能力面
// 等价迁移（新建/客户 360 详情/联系人/活动时间线/商机关联/归属历史）。
type CustomerFormKind = 'create' | null;

type CustomerPageState = Readonly<{
  customers: readonly CustomerRow[];
  shownCount: number;
  statusFilter: 'ALL' | 'PROSPECT' | 'ACTIVE' | 'INACTIVE';
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
  activityTypeFilter: string;
  setActivityTypeFilter: (next: string) => void;
  closeForm: () => void;
  setStatusFilter: (next: 'ALL' | 'PROSPECT' | 'ACTIVE' | 'INACTIVE') => void;
  setSearch: (next: string) => void;
  runRefresh: () => Promise<void>;
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
  showMore: () => void;
}>;

const STATUS_LABELS: Readonly<Record<string, string>> = {
  PROSPECT: '潜在客户',
  ACTIVE: '活跃客户',
  INACTIVE: '非活跃',
};

const statusTone = (status: unknown): StatusTone => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'INACTIVE') return 'neutral';
  return 'info';
};

const recordOf = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

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

const Customer360Detail = ({
  view,
  ports,
  typeFilter,
  onTypeFilter,
}: Readonly<{
  view: Readonly<Record<string, unknown>>;
  ports: CustomerConsolePorts;
  typeFilter: string;
  onTypeFilter: (next: string) => void;
}>) => {
  const customer = recordOf(view.customer);
  const contacts = Array.isArray(view.contacts) ? view.contacts : [];
  const activities = Array.isArray(view.activities) ? view.activities : [];
  const opportunities = Array.isArray(view.opportunities) ? view.opportunities : [];
  const activityTypes = [
    ...new Set(
      activities
        .map((activity) => ports.textValue(recordOf(activity).type, ''))
        .filter((type) => type !== ''),
    ),
  ];
  const visibleActivities =
    typeFilter === ''
      ? activities
      : activities.filter(
          (activity) => ports.textValue(recordOf(activity).type, '') === typeFilter,
        );
  return (
    <div class="console-summary" data-testid="kt-customer-360">
      <p>
        <span class="console-label">编号</span>
        {ports.textValue(customer.customerNumber, '—')}
        <span class="console-label">状态</span>
        {ports.textValue(customer.status, '—')}
      </p>
      <div data-testid="kt-customer-contacts">
        <span class="console-label">联系人</span>

        {contacts.map((contact) => {
          const item = recordOf(contact);
          return (
            <p key={ports.textValue(item.id ?? item.name, '')}>
              {ports.textValue(item.name, '—')} · {ports.textValue(item.title, '—')} ·{' '}
              {ports.textValue(item.email, '—')} · {ports.textValue(item.phone, '—')}
            </p>
          );
        })}
        {contacts.length === 0 ? <p>暂无联系人</p> : null}
      </div>
      <div data-testid="kt-customer-activities">
        <span class="console-label">活动时间线</span>
        {activityTypes.length > 1 ? (
          <select
            class="console-input"
            data-testid="kt-customer-activity-type-filter"
            value={typeFilter}
            onChange={(event) => {
              onTypeFilter((event.target as HTMLSelectElement).value);
            }}
          >
            <option value="">全部类型</option>
            {activityTypes.map((type) => (
              <option key={type} value={type}>
                {businessEventLabel(type)}
              </option>
            ))}
          </select>
        ) : null}
        {visibleActivities.map((activity) => {
          const item = recordOf(activity);
          return (
            <p key={ports.textValue(item.id ?? item.summary, '')}>
              {businessEventLabel(item.type)} · {ports.textValue(item.summary, '—')} ·{' '}
              {ports.textValue(item.occurredAt, '—').slice(0, 10)}
            </p>
          );
        })}
        {activities.length === 0 ? (
          <p>暂无活动</p>
        ) : visibleActivities.length === 0 ? (
          <p>该类型暂无活动</p>
        ) : null}
      </div>
      <div data-testid="kt-customer-opportunities">
        <span class="console-label">商机关联</span>
        {opportunities.map((opportunity) => {
          const item = recordOf(opportunity);
          return (
            <p key={ports.textValue(item.id ?? item.name, '')}>
              {ports.textValue(item.name, '—')} · {ports.textValue(item.status, '—')} ·{' '}
              {ports.textValue((item as { value?: { amount?: unknown } }).value?.amount, '—')}
            </p>
          );
        })}
        {opportunities.length === 0 ? <p>暂无商机关联</p> : null}
      </div>
    </div>
  );
};

const CustomerDrawer = ({ state }: Readonly<{ state: CustomerPageState }>) => {
  const customer = state.selected;
  if (!customer) return null;
  const { ports } = state;
  const status = ports.textValue(customer.status, 'PROSPECT');
  return (
    <DetailDrawer
      title={`客户详情 · ${ports.textValue(customer.name, '客户')}`}
      onClose={() => {
        state.open(null);
      }}
    >
      {state.view360 ? (
        <Customer360Detail
          view={state.view360}
          ports={state.ports}
          typeFilter={state.activityTypeFilter}
          onTypeFilter={state.setActivityTypeFilter}
        />
      ) : (
        <p class="console-hint">客户 360 加载中…</p>
      )}
      {state.submitError !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-customer-submit-error">
          {state.submitError}
        </p>
      ) : null}
      <div class="console-actions">
        <StatusBadge tone={statusTone(status)}>{STATUS_LABELS[status] ?? status}</StatusBadge>
        {state.permissions.has('customer:update') && !state.contactForm ? (
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
        {state.permissions.has('customer-activity:create') && !state.activityForm ? (
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
  return (
    <div class="commercial-console-page" data-testid="kt-customer-page">
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
      <div class="commercial-console-filters">
        {(['ALL', 'PROSPECT', 'ACTIVE', 'INACTIVE'] as const).map((option) => (
          <button
            key={option}
            type="button"
            class={state.statusFilter === option ? 'secondary compact active' : 'secondary compact'}
            data-testid={`kt-customer-filter-${option.toLowerCase()}`}
            onClick={() => {
              state.setStatusFilter(option);
            }}
          >
            {option === 'ALL' ? '全部' : (STATUS_LABELS[option] ?? option)}
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
        emptyTitle="暂无客户"
        emptyDescription="新建客户后会出现在这里"
      />
      {state.selected ? <CustomerDrawer state={state} /> : null}
      {state.activeForm === 'create' ? <CreateDrawer state={state} /> : null}
    </div>
  );
};

// G2 压平：360 详情加载（选中行变化即异步拉取；失败经提交错误面呈现）。
function loadDetail(
  bundle: {
    selected: Signal<CustomerRow | null>;
    view360: Signal<Readonly<Record<string, unknown>> | null>;
    submitError: Signal<string>;
    loadError: Signal<string>;
    activeForm: Signal<CustomerFormKind>;
  },
  ports: CustomerConsolePorts,
  row: CustomerRow,
): void {
  const id = ports.textValue(row.id ?? row.customerNumber, '');
  ports
    .load360(id)
    .then((view) => {
      if (bundle.selected.value === row) bundle.view360.value = view;
    })
    .catch((error: unknown) => {
      fail(error, bundle, '客户 360 加载失败');
    });
}

const fail = (
  error: unknown,
  bundle: {
    selected: Signal<CustomerRow | null>;
    activeForm: Signal<CustomerFormKind>;
    submitError: Signal<string>;
    loadError: Signal<string>;
  },
  fallback: string,
): void => {
  const message = error instanceof Error ? error.message : fallback;
  if (bundle.selected.value !== null || bundle.activeForm.value !== null)
    bundle.submitError.value = message;
  else bundle.loadError.value = message;
};

export function CustomerConsolePage(ports: CustomerConsolePorts) {
  const bundle = {
    customers: signal<readonly CustomerRow[]>([...ports.initialCustomers]),
    statusFilter: signal<'ALL' | 'PROSPECT' | 'ACTIVE' | 'INACTIVE'>('ALL'),
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
    shownCount: signal(20),
  };

  const closeForm = (): void => {
    bundle.activeForm.value = null;
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

  const runAddActivity = async (values: Readonly<Record<string, string>>): Promise<void> => {
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
      const fresh = await ports.load360(ports.textValue(customer.id, ''));
      if (fresh && bundle.selected.value === customer) bundle.view360.value = fresh;
      bundle.activityForm.value = false;
      bundle.submitError.value = '';
    } catch (error: unknown) {
      fail(error, bundle, '活动创建失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const runAddContact = async (values: Readonly<Record<string, string>>): Promise<void> => {
    const customer = bundle.selected.value;
    if (!customer) return;
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.createContact(ports.textValue(customer.id, ''), {
        name: values.name ?? '',
        title: values.title ?? null,
        email: values.email ?? null,
        phone: values.phone ?? null,
        primary: values.primary === 'true',
      });
      const fresh = await ports.load360(ports.textValue(customer.id, ''));
      if (fresh && bundle.selected.value === customer) bundle.view360.value = fresh;
      bundle.contactForm.value = false;
      bundle.submitError.value = '';
    } catch (error: unknown) {
      fail(error, bundle, '联系人创建失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const state = (): CustomerPageState => ({
    customers: bundle.customers.value,
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
    open: (row) => {
      bundle.selected.value = row;
      bundle.activeForm.value = null;
      bundle.submitError.value = '';
      bundle.activityTypeFilter.value = '';
      if (row !== null) loadDetail(bundle, ports, row);
    },
    openForm: (kind) => {
      bundle.activeForm.value = kind;
      bundle.submitError.value = '';
    },
    contactForm: bundle.contactForm.value,
    openContactForm: () => {
      bundle.contactForm.value = true;
      bundle.submitError.value = '';
    },
    closeContactForm: () => {
      bundle.contactForm.value = false;
      bundle.submitError.value = '';
    },
    activityForm: bundle.activityForm.value,
    openActivityForm: () => {
      bundle.activityForm.value = true;
      bundle.submitError.value = '';
    },
    closeActivityForm: () => {
      bundle.activityForm.value = false;
      bundle.submitError.value = '';
    },
    runAddActivity,
    activityTypeFilter: bundle.activityTypeFilter.value,
    setActivityTypeFilter: (next) => {
      bundle.activityTypeFilter.value = next;
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
    runAddContact,
  });

  const Page = () => CustomerView(state());
  return Page;
}
