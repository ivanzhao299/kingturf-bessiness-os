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
  PendingQualifications,
  QualificationBadges,
  QualificationList,
  QuoteComparison,
  QuoteHistory,
  qualificationCounts,
} from './supplier-console-detail';
import type { SupplierConsolePorts, SupplierRow } from './supplier-ports';
import { failureMessage } from '../../shared/api-error-message';

// U3-PROC-1（ADR-0014 分域重写）：供应商控制台——原 vanilla supplier-register 能力面
// 等价迁移（新建供应商/物料准入审核（扩展 approve|conditional|reject）/列表/状态筛选/
// 检索/详情抽屉（资质+联系信息+报价历史））。供应商停用写路径 legacy 不存在
// （suppliers.status 无任何迁移端点），行为守恒不新增——状态仅读侧展示。
// PROC-UX：资质状态四色徽章（列表列 + 抽屉）与报价历史对比（同一物料多供应商并排）；
// 详情子组件见 supplier-console-detail.tsx。
type SupplierFormKind = 'create' | 'qualify' | null;

type SupplierPageState = Readonly<{
  suppliers: readonly SupplierRow[];
  quotes: readonly SupplierRow[];
  statusFilter: 'ALL' | 'ACTIVE' | 'ON_HOLD' | 'INACTIVE';
  search: string;
  loadError: string;
  submitError: string;
  loading: boolean;
  selected: SupplierRow | null;
  activeForm: SupplierFormKind;
  permissions: ReadonlySet<string>;
  ports: SupplierConsolePorts;
  // 当前时间源（报价有效期判定；测试可注入固定时钟）。
  now: () => Date;
  open: (row: SupplierRow | null) => void;
  openForm: (kind: SupplierFormKind) => void;
  closeForm: () => void;
  setStatusFilter: (next: 'ALL' | 'ACTIVE' | 'ON_HOLD' | 'INACTIVE') => void;
  setSearch: (next: string) => void;
  runRefresh: () => Promise<void>;
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
  runQualify: (
    row: SupplierRow,
    action: 'approve' | 'conditional' | 'reject',
    values: Readonly<Record<string, string>>,
  ) => Promise<void>;
  shownCount: number;
  showMore: () => void;
}>;

// businessStateLabel 同口径的中文标签。ON_HOLD 此前没有标签，筛选按钮与状态徽章直接显示枚举原文
// （TD-WF-014③）；它与「已停用」是两个状态（INACTIVE 才是停用），所以译作「暂停」。
const STATUS_LABELS: Readonly<Record<string, string>> = {
  ACTIVE: '已启用',
  ON_HOLD: '暂停',
  INACTIVE: '已停用',
};

const statusTone = (status: unknown): StatusTone => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'INACTIVE') return 'danger';
  if (status === 'ON_HOLD') return 'warning';
  return 'neutral';
};

const recordText = (
  ports: SupplierConsolePorts,
  row: SupplierRow,
  camel: string,
  snake: string,
  fallback = '',
) => ports.recordText(row, camel, snake, fallback);

// 已准入计数：legacy 卡片口径（status==='APPROVED' 的资质数）。
const approvedCount = (state: SupplierPageState, row: SupplierRow): number =>
  qualificationCounts(state.ports, row).APPROVED;

const contactText = (ports: SupplierConsolePorts, row: SupplierRow, key: string): string => {
  const contact = row.contact;
  if (typeof contact !== 'object' || contact === null || Array.isArray(contact)) return '—';
  return ports.textValue((contact as Record<string, unknown>)[key], '—');
};

const columns = (state: SupplierPageState): readonly DataTableColumn<SupplierRow>[] => [
  {
    key: 'supplier',
    header: '供应商',
    field: (row) => recordText(state.ports, row, 'supplierNumber', 'supplier_number'),
    render: (row) => (
      <span>
        {recordText(state.ports, row, 'supplierNumber', 'supplier_number')} ·{' '}
        {recordText(state.ports, row, 'name', 'name')}
      </span>
    ),
  },
  {
    key: 'status',
    header: '状态',
    field: (row) => recordText(state.ports, row, 'status', 'status'),
    render: (row) => {
      const status = recordText(state.ports, row, 'status', 'status');
      return <StatusBadge tone={statusTone(status)}>{STATUS_LABELS[status] ?? status}</StatusBadge>;
    },
  },
  {
    key: 'qualifications',
    header: '物料准入',
    field: (row) => approvedCount(state, row),
    render: (row) => (
      <QualificationBadges state={state} row={row} testId="kt-supplier-qualifications-cell" />
    ),
  },
  {
    key: 'paymentTerms',
    header: '账期',
    field: (row) =>
      Number(recordText(state.ports, row, 'paymentTermsDays', 'payment_terms_days', '0')),
    render: (row) =>
      `${recordText(state.ports, row, 'paymentTermsDays', 'payment_terms_days', '—')} 天 · ${recordText(state.ports, row, 'currency', 'currency', '—')}`,
  },
  {
    key: 'actions',
    header: '操作',
    field: () => '查看',
    render: (row) => (
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-supplier-open"
        onClick={() => {
          state.open(row);
        }}
      >
        查看
      </button>
    ),
  },
];

const filteredSuppliers = (state: SupplierPageState): readonly SupplierRow[] =>
  state.suppliers.filter((row) => {
    const status = recordText(state.ports, row, 'status', 'status');
    if (state.statusFilter !== 'ALL' && status !== state.statusFilter) return false;
    if (state.search === '') return true;
    const haystack =
      `${recordText(state.ports, row, 'supplierNumber', 'supplier_number')}${recordText(state.ports, row, 'name', 'name')}${status}`.toLowerCase();
    return haystack.includes(state.search.toLowerCase());
  });

const SupplierDrawer = ({ state }: Readonly<{ state: SupplierPageState }>) => {
  const row = state.selected;
  if (!row) return null;
  const { ports, permissions } = state;
  const status = recordText(ports, row, 'status', 'status');
  const rating = Number(
    recordText(ports, row, 'qualityRatingBasisPoints', 'quality_rating_basis_points', '0'),
  );
  const ratingText = Number.isFinite(rating) && rating >= 0 ? `${String(rating / 100)} / 100` : '—';
  const mayQualify = permissions.has('supplier:manage');
  return (
    // 宽抽屉：资质记录、报价历史与多供应商对比表在缺省宽度里读不了（TD-PROC-008 残余，PROC-3）。
    <DetailDrawer
      size="wide"
      title={`供应商详情 · ${recordText(ports, row, 'name', 'name')}`}
      onClose={() => {
        state.open(null);
      }}
    >
      <div class="console-summary" data-testid="kt-supplier-detail">
        <p>
          <span class="console-label">状态</span>
          <StatusBadge tone={statusTone(status)}>{STATUS_LABELS[status] ?? status}</StatusBadge>
          <span class="console-label">编号</span>
          {recordText(ports, row, 'supplierNumber', 'supplier_number')}
          <span class="console-label">币种</span>
          {recordText(ports, row, 'currency', 'currency', '—')}
        </p>
        <p>
          <span class="console-label">账期</span>
          {`${recordText(ports, row, 'paymentTermsDays', 'payment_terms_days', '—')} 天`}
          <span class="console-label">质量评分</span>
          {ratingText}
        </p>
        <p>
          <span class="console-label">联系人</span>
          {contactText(ports, row, 'name')}
          <span class="console-label">联系电话</span>
          {contactText(ports, row, 'phone')}
        </p>
        <p>
          <span class="console-label">资质状态</span>
          <QualificationBadges state={state} row={row} testId="kt-supplier-qualification-badges" />
        </p>
      </div>
      {/* TD-WF-005 / TD-WF-012：行内表单开着时，提交失败显示在该表单自己的提示区（FormSection 的
          error，紧挨提交按钮）；这里的错误位只留给不经表单的动作。 */}
      {state.activeForm === null && state.submitError !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-supplier-submit-error">
          {state.submitError}
        </p>
      ) : null}
      {state.activeForm === null ? (
        <div class="console-actions" data-testid="kt-supplier-actions">
          {mayQualify ? (
            <button
              type="button"
              class="primary"
              data-testid="kt-supplier-qualify"
              onClick={() => {
                state.openForm('qualify');
              }}
            >
              物料准入审核
            </button>
          ) : null}
        </div>
      ) : null}
      <p class="console-label">资质记录</p>
      <QualificationList state={state} />
      <PendingQualifications state={state} />
      <QuoteHistory state={state} />
      <QuoteComparison state={state} />
      {state.activeForm === 'qualify' ? (
        <FormSection
          title="供应商物料准入审核"
          description="准入引用精确的已发布物料版本，并保留审核证据和有效期。"
          fields={[
            {
              name: 'action',
              label: '审核结论',
              type: 'select',
              required: true,
              options: [
                { value: 'approve', label: '批准（APPROVED）' },
                { value: 'conditional', label: '有条件批准（CONDITIONAL）' },
                { value: 'reject', label: '驳回（REJECTED）' },
              ],
            },
            ...(state.ports.itemVersionChoices.length > 0
              ? [
                  {
                    name: 'itemVersionId',
                    label: '物料版本',
                    type: 'select',
                    required: true,
                    options: state.ports.itemVersionChoices,
                  } satisfies FormSectionField,
                ]
              : [
                  {
                    name: 'itemVersionId',
                    label: '物料版本编号',
                    required: true,
                  } satisfies FormSectionField,
                ]),
            { name: 'validFrom', label: '有效起始日', type: 'date', required: true },
            { name: 'validTo', label: '有效截止日', type: 'date', required: true },
            {
              name: 'minimumOrderQuantity',
              label: '最小订购量',
              type: 'number',
              required: true,
              value: '0',
            },
            { name: 'leadTimeDays', label: '交期（天）', type: 'number', required: true },
            { name: 'evidenceReference', label: '审核证据编号', required: true },
          ]}
          submitLabel="提交审核"
          error={state.submitError}
          onSubmit={(values) =>
            state.runQualify(
              row,
              values.action === 'conditional' || values.action === 'reject'
                ? values.action
                : 'approve',
              values,
            )
          }
        />
      ) : null}
    </DetailDrawer>
  );
};

const CreateDrawer = ({ state }: Readonly<{ state: SupplierPageState }>) => (
  <DetailDrawer title="新建供应商" onClose={state.closeForm}>
    <FormSection
      title="新建供应商"
      description="建立供应商编号、结算条件和质量评级。"
      fields={[
        { name: 'supplierNumber', label: '供应商编号', required: true },
        { name: 'name', label: '供应商名称', required: true },
        {
          name: 'paymentTermsDays',
          label: '账期（天）',
          type: 'number',
          required: true,
          value: '30',
        },
        {
          name: 'qualityRating',
          label: '质量评分（0-100）',
          type: 'number',
          required: true,
          value: '90',
        },
        { name: 'contactName', label: '联系人', required: true },
        { name: 'contactPhone', label: '联系电话', type: 'tel', required: true },
      ]}
      submitLabel="保存供应商"
      error={state.submitError}
      onSubmit={(values) => state.runCreate(values)}
    />
  </DetailDrawer>
);

const SupplierView = (state: SupplierPageState) => {
  const visible = filteredSuppliers(state);
  const shown = visible.slice(0, state.shownCount);
  const mayCreate = state.permissions.has('supplier:manage');
  return (
    <div class="commercial-console-page" data-testid="kt-supplier-page">
      <PageHeader
        title="供应商与准入"
        description="供应商准入、资质审核与联系信息"
        actions={
          <>
            <button
              type="button"
              class="secondary"
              data-testid="kt-supplier-refresh"
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
                data-testid="kt-supplier-create"
                onClick={() => {
                  state.openForm('create');
                }}
              >
                ＋ 新建供应商
              </button>
            ) : null}
          </>
        }
      />
      <div class="commercial-console-filters">
        {(['ALL', 'ACTIVE', 'ON_HOLD', 'INACTIVE'] as const).map((option) => (
          <button
            key={option}
            type="button"
            class={state.statusFilter === option ? 'secondary compact active' : 'secondary compact'}
            data-testid={`kt-supplier-filter-${option.toLowerCase()}`}
            onClick={() => {
              state.setStatusFilter(option);
            }}
          >
            {option === 'ALL' ? '全部' : (STATUS_LABELS[option] ?? option)}
          </button>
        ))}
        <input
          type="search"
          placeholder="搜索供应商编号、名称或状态"
          data-testid="kt-supplier-search"
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
        rowId={(row) => state.ports.textValue(row.id ?? row.supplier_number, 'row')}
        caption="供应商主列表（状态、物料准入与账期）"
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
        emptyTitle="暂无供应商"
        emptyDescription="新建供应商后会出现在这里"
      />
      {state.selected ? <SupplierDrawer state={state} /> : null}
      {state.activeForm === 'create' ? <CreateDrawer state={state} /> : null}
    </div>
  );
};

export function SupplierConsolePage(ports: SupplierConsolePorts) {
  const bundle = {
    suppliers: signal<readonly SupplierRow[]>([...ports.initialSuppliers]),
    quotes: signal<readonly SupplierRow[]>([...ports.initialQuotes]),
    statusFilter: signal<'ALL' | 'ACTIVE' | 'ON_HOLD' | 'INACTIVE'>('ALL'),
    search: signal(''),
    loadError: signal(''),
    submitError: signal(''),
    loading: signal(false),
    selected: signal<SupplierRow | null>(null),
    activeForm: signal<SupplierFormKind>(null),
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

  const runRefresh = async (): Promise<void> => {
    bundle.loading.value = true;
    try {
      const snapshot = await ports.refresh();
      bundle.suppliers.value = snapshot.suppliers;
      bundle.quotes.value = snapshot.quotes;
      bundle.loadError.value = '';
    } catch (error: unknown) {
      fail(error, '供应商加载失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  // 创建载荷与原 vanilla 表单逐字节一致（currency 固定 CNY、评分×100、contact 对象）。
  const runCreate = async (values: Readonly<Record<string, string>>): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit('/api/v1/suppliers', {
        supplierNumber: values.supplierNumber ?? '',
        name: values.name ?? '',
        currency: 'CNY',
        paymentTermsDays: Number(values.paymentTermsDays ?? '0'),
        qualityRatingBasisPoints: Number(values.qualityRating ?? '0') * 100,
        contact: { name: values.contactName ?? '', phone: values.contactPhone ?? '' },
      });
      const snapshot = await ports.refresh();
      bundle.suppliers.value = snapshot.suppliers;
      bundle.quotes.value = snapshot.quotes;
      closeForm();
    } catch (error: unknown) {
      fail(error, '供应商创建失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  // 资质审核走统一动作端点（PUT qualification；approve|conditional|reject 分派
  // legacy qualifySupplier 同链——evidence 结构与原 vanilla 物料准入表单一致）。
  const runQualify = async (
    row: SupplierRow,
    action: 'approve' | 'conditional' | 'reject',
    values: Readonly<Record<string, string>>,
  ): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit(
        `/api/v1/suppliers/${ports.textValue(row.id, '')}/qualification`,
        {
          action,
          itemVersionId: values.itemVersionId ?? '',
          validFrom: values.validFrom ?? '',
          validTo: values.validTo ?? '',
          minimumOrderQuantity: values.minimumOrderQuantity ?? '0',
          leadTimeDays: Number(values.leadTimeDays ?? '0'),
          evidence: { reference: values.evidenceReference ?? '' },
        },
        'PUT',
      );
      const snapshot = await ports.refresh();
      bundle.suppliers.value = snapshot.suppliers;
      bundle.quotes.value = snapshot.quotes;
      closeForm();
    } catch (error: unknown) {
      fail(error, '物料准入审核失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const state = (): SupplierPageState => ({
    suppliers: bundle.suppliers.value,
    quotes: bundle.quotes.value,
    statusFilter: bundle.statusFilter.value,
    search: bundle.search.value,
    loadError: bundle.loadError.value,
    submitError: bundle.submitError.value,
    loading: bundle.loading.value,
    selected: bundle.selected.value,
    activeForm: bundle.activeForm.value,
    permissions: ports.permissions,
    ports,
    now: () => ports.now?.() ?? new Date(),
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
    shownCount: bundle.shownCount.value,
    runRefresh,
    runCreate,
    runQualify,
  });

  const Page = () => SupplierView(state());
  return Page;
}
