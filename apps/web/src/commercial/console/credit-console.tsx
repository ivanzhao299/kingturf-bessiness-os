import { signal } from '@preact/signals';
import {
  DataTable,
  DetailDrawer,
  FormSection,
  PageHeader,
  StatusBadge,
  type DataTableColumn,
  type StatusTone,
} from '@kingturf/ui';
import type { CreditConsolePorts, CreditRow } from './credit-ports';
import { failureMessage } from '../../shared/api-error-message';
import { FocusAnchor } from './focus-anchor';
import { ConsoleNotice } from './console-notice';
import { syncSelected } from './selected-sync';
import { CreditFlow, DecisionFlow, STATUS_LABELS } from './credit-console-flow';

// U3-COM-7（ADR-0014 分域重写）：信用审查控制台——原 vanilla credit workbench 能力面
// 等价迁移（设定额度/发起评估/批准拒绝决定；决策列表/筛选/详情抽屉含敞口与额度）。
// COM-UX：页面级审批流程图（提交→评估→审批→批准/拒绝，带计数可点选筛选）；详情抽屉以
// 逐步骤进度呈现决定所处环节，审批操作就地落在「信用审批」环节。
type CreditFormKind = 'limit' | 'evaluate' | null;

export type CreditPageState = Readonly<{
  decisions: readonly CreditRow[];
  limits: readonly CreditRow[];
  statusFilter: 'ALL' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  search: string;
  loadError: string;
  submitError: string;
  // TD-WF-014①：最近一次写操作的成功提示。
  notice: string;
  loading: boolean;
  selected: CreditRow | null;
  activeForm: CreditFormKind;
  decision: 'APPROVED' | 'REJECTED' | null;
  permissions: ReadonlySet<string>;
  ports: CreditConsolePorts;
  open: (row: CreditRow | null) => void;
  openForm: (kind: CreditFormKind) => void;
  openDecision: (decision: 'APPROVED' | 'REJECTED') => void;
  closeForm: () => void;
  setStatusFilter: (next: 'ALL' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXPIRED') => void;
  setSearch: (next: string) => void;
  runRefresh: () => Promise<void>;
  runSetLimit: (values: Readonly<Record<string, string>>) => Promise<void>;
  runEvaluate: (values: Readonly<Record<string, string>>) => Promise<void>;
  runDecision: (row: CreditRow, decision: 'APPROVED' | 'REJECTED', reason: string) => Promise<void>;
  showMore: () => void;
}>;

const recordValueOf = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const statusTone = (status: unknown): StatusTone => {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'PENDING_APPROVAL') return 'warning';
  return 'neutral';
};

const decisionStatus = (ports: CreditConsolePorts, decision: CreditRow): string =>
  ports.recordText(decision, 'effectiveStatus', 'effective_status', 'PENDING_APPROVAL');

const decisionQuoteRevisionId = (ports: CreditConsolePorts, decision: CreditRow): string =>
  ports.recordText(decision, 'quoteRevisionId', 'quote_revision_id');

// TD-WF-014⑧（写流程冒烟 WS-P3-08）：信用决定此前只用报价版本 ID 的前 8 位标识——列表「关联报价」列与
// 详情抽屉标题都是「5e93c116」这样的片段，认不出是哪个客户、哪份报价。决定行带客户与报价版本，
// 报价清单里有报价编号，客户清单里有名称：标出「客户 · 报价 编号 · 第 N 版」。
// 两样都解析不到（没有报价 / 客户的读权限，或清单里找不到）才退回 ID 片段。
export const decisionQuoteLabel = (ports: CreditConsolePorts, decision: CreditRow): string => {
  const revisionId = decisionQuoteRevisionId(ports, decision);
  const quote = ports.issuedQuotes.find((item) => ports.textValue(item.id, '') === revisionId);
  const number = quote ? ports.textValue(quote.quoteNumber, '') : '';
  if (number === '') return '';
  const revision = ports.textValue(quote?.revision, '');
  return `报价 ${number}${revision === '' ? '' : ` · 第 ${revision} 版`}`;
};

export const decisionCustomerLabel = (ports: CreditConsolePorts, decision: CreditRow): string => {
  const customerId = ports.recordText(decision, 'customerId', 'customer_id');
  return ports.customers.find((customer) => customer.id === customerId)?.name ?? '';
};

export const decisionLabel = (ports: CreditConsolePorts, decision: CreditRow): string => {
  const parts = [
    decisionCustomerLabel(ports, decision),
    decisionQuoteLabel(ports, decision),
  ].filter((part) => part !== '');
  return parts.length > 0
    ? parts.join(' · ')
    : `报价版本 ${decisionQuoteRevisionId(ports, decision).slice(0, 8)}`;
};

const columns = (state: CreditPageState): readonly DataTableColumn<CreditRow>[] => [
  {
    key: 'status',
    header: '信用状态',
    field: (row) => state.ports.recordText(row, 'effectiveStatus', 'effective_status', '—'),
    render: (row) => {
      const status = decisionStatus(state.ports, row);
      return <StatusBadge tone={statusTone(status)}>{STATUS_LABELS[status] ?? status}</StatusBadge>;
    },
  },
  {
    key: 'requested',
    header: '申请金额',
    field: (row) => Number(row.requestedAmount ?? row.requested_amount ?? 0),
    render: (row) =>
      state.ports.displayMoney(row.currency, row.requestedAmount ?? row.requested_amount),
  },
  {
    key: 'exposure',
    header: '敞口',
    field: (row) => Number(row.exposureAmount ?? row.exposure_amount ?? 0),
    render: (row) =>
      state.ports.displayMoney(row.currency, row.exposureAmount ?? row.exposure_amount),
  },
  {
    key: 'limit',
    header: '额度',
    field: (row) => Number(row.creditLimit ?? row.limit_amount ?? 0),
    render: (row) => state.ports.displayMoney(row.currency, row.creditLimit ?? row.limit_amount),
  },
  {
    key: 'quote',
    header: '关联报价',
    field: (row) => decisionLabel(state.ports, row),
    render: (row) => <span>{decisionLabel(state.ports, row)}</span>,
  },
  {
    key: 'actions',
    header: '操作',
    field: () => '查看',
    render: (row) => (
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-credit-open"
        onClick={() => {
          state.open(row);
        }}
      >
        查看
      </button>
    ),
  },
];

const filteredDecisions = (state: CreditPageState): readonly CreditRow[] =>
  state.decisions.filter((row) => {
    const status = decisionStatus(state.ports, row);
    if (state.statusFilter !== 'ALL' && status !== state.statusFilter) return false;
    if (state.search === '') return true;
    // 按报价编号或客户名称检索；报价版本 ID 仍可检索（此前只能按它检索，而界面上并不显示它）。
    const haystack = `${decisionLabel(state.ports, row)}${decisionQuoteRevisionId(state.ports, row)}`;
    return haystack.toLowerCase().includes(state.search.toLowerCase());
  });

const CreditDetail = ({ state }: Readonly<{ state: CreditPageState }>) => {
  const decision = state.selected;
  if (!decision) return null;
  const { ports } = state;
  const status = decisionStatus(ports, decision);
  return (
    <div class="console-summary" data-testid="kt-credit-detail">
      <p>
        <span class="console-label">状态</span>
        <StatusBadge tone={statusTone(status)}>{STATUS_LABELS[status] ?? status}</StatusBadge>
        <span class="console-label">敞口快照</span>
        {ports.recordText(decision, 'exposureSnapshotId', 'exposure_snapshot_id').slice(0, 8)}
      </p>
      <DecisionFlow state={state} />
      <p>
        <span class="console-label">申请</span>
        {ports.displayMoney(
          decision.currency,
          decision.requestedAmount ?? decision.requested_amount,
        )}
        <span class="console-label">敞口</span>
        {ports.displayMoney(decision.currency, decision.exposureAmount ?? decision.exposure_amount)}
        <span class="console-label">额度</span>
        {ports.displayMoney(decision.currency, decision.creditLimit ?? decision.limit_amount)}
      </p>
      <div data-testid="kt-credit-limits">
        <span class="console-label">客户额度版本</span>
        {state.limits.length === 0
          ? '—'
          : state.limits
              .map((limit) => {
                const item = recordValueOf(limit);
                return `${ports.currencyLabel(item.currency)} ${ports.recordText(item, 'amount', '—')} · ${ports.recordText(item, 'expiresAt', 'expires_at', '—').slice(0, 10)}`;
              })
              .join('；')}
      </div>
    </div>
  );
};

const CreditDrawer = ({ state }: Readonly<{ state: CreditPageState }>) => {
  const decision = state.selected;
  if (!decision) return null;
  const { ports } = state;
  return (
    <DetailDrawer
      title={`信用决定详情 · ${decisionLabel(ports, decision)}`}
      onClose={() => {
        state.open(null);
      }}
      // TD-WF-014①：写成功的提示放在抽屉底部，不随抽屉体滚走。
      footer={state.notice === '' ? undefined : <ConsoleNotice message={state.notice} />}
    >
      <CreditDetail state={state} />
      {state.submitError !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-credit-submit-error">
          {state.submitError}
        </p>
      ) : null}
      {/* 审批操作（批准/拒绝）渲染在办理进度的「信用审批」环节内，见 DecisionFlow。 */}
      {state.decision !== null ? (
        <FormSection
          title={state.decision === 'APPROVED' ? '批准信用' : '拒绝信用'}
          description="审批决定将永久保留并影响订单释放资格。"
          fields={[{ name: 'reason', label: '审批理由', type: 'textarea', required: true }]}
          // TD-WF-014⑤：提交按钮文字含敏感词时，FormSection 会在它上方渲染勾选项「我确认要」+ 按钮文字。
          // 拒绝的按钮原来叫「确认拒绝」，勾选项因此读作「我确认要确认拒绝」。按钮直接说出要做的事，
          // 勾选项就是一句通顺的话：「我确认要拒绝这条信用决定」。批准不含敏感词，没有勾选项。
          submitLabel={state.decision === 'APPROVED' ? '确认批准' : '拒绝这条信用决定'}
          // 把 Promise 交还给 FormSection：提交期间它据此置灰按钮并拦下重复提交（TD-WF-004）；
          // 批准与拒绝都是不可逆动作。
          onSubmit={(values) =>
            state.decision !== null
              ? state.runDecision(decision, state.decision, values.reason ?? '')
              : undefined
          }
          error={state.submitError}
        />
      ) : null}
      {/* TD-WF-014④：审批表单开合、决定后审批按钮消失时，把键盘焦点带回抽屉。 */}
      <FocusAnchor token={`${String(state.decision)}|${decisionStatus(ports, decision)}`} />
    </DetailDrawer>
  );
};

const LimitDrawer = ({ state }: Readonly<{ state: CreditPageState }>) => {
  const { ports } = state;
  return (
    <DetailDrawer title="设置客户信用额度" onClose={state.closeForm}>
      <FormSection
        title="设置客户信用额度"
        description="额度按客户、币种和有效期形成不可变版本记录。"
        fields={[
          {
            name: 'customerId',
            label: '客户',
            type: 'select',
            required: true,
            options: ports.customers.map((item) => ({
              value: item.id,
              label: item.name ?? item.id,
            })),
          },
          { name: 'amount', label: '信用额度', type: 'number', required: true },
          {
            name: 'currency',
            label: '币种',
            type: 'select',
            required: true,
            options: [
              { value: 'CNY', label: '人民币' },
              { value: 'USD', label: '美元 USD' },
            ],
          },
          { name: 'effectiveAt', label: '生效日期', type: 'date', required: true },
          { name: 'expiresAt', label: '失效日期', type: 'date', required: true },
        ]}
        submitLabel="保存额度"
        error={state.submitError}
        onSubmit={(values) => state.runSetLimit(values)}
      />
    </DetailDrawer>
  );
};

const EvaluateDrawer = ({ state }: Readonly<{ state: CreditPageState }>) => {
  const { ports } = state;
  const issuedQuotes = state.ports.issuedQuotes;
  return (
    <DetailDrawer title="发起信用评估" onClose={state.closeForm}>
      <FormSection
        title="发起信用评估"
        description="服务器会锁定客户信用台账并重新计算敞口，不能由前端覆盖。"
        fields={[
          {
            name: 'quoteRevisionId',
            label: '已签发报价',
            type: 'select',
            required: true,
            options: issuedQuotes.map((item) => ({
              value: ports.textValue(item.id, ''),
              label: `${ports.textValue(item.quoteNumber, '报价')} · 第 ${ports.textValue(item.revision, '1')} 版 · ${ports.textValue(item.currency, '')} ${ports.textValue(item.total, '—')}`,
            })),
          },
          {
            name: 'creditLimitId',
            label: '信用额度版本',
            type: 'select',
            required: true,
            options: state.limits.map((item) => ({
              value: ports.textValue(item.id, ''),
              label: `${ports.currencyLabel(ports.recordText(item, 'currency', 'currency', 'CNY'))} ${ports.recordText(item, 'amount', 'amount', '—')} · ${ports.recordText(item, 'expiresAt', 'expires_at', '').slice(0, 10)}`,
            })),
          },
          { name: 'validUntil', label: '信用决定有效期至', type: 'date', required: true },
        ]}
        submitLabel="执行信用评估"
        error={state.submitError}
        onSubmit={(values) => state.runEvaluate(values)}
      />
    </DetailDrawer>
  );
};

const CreditView = (state: CreditPageState) => {
  const visible = filteredDecisions(state);
  const shown = visible.slice(0, 20);
  const mayApprove = state.permissions.has('credit:approve');
  const mayEvaluate =
    state.permissions.has('credit:evaluate') &&
    state.limits.length > 0 &&
    state.ports.issuedQuotes.length > 0;
  return (
    <div class="commercial-console-page" data-testid="kt-credit-page">
      <PageHeader
        title="信用审查"
        description="客户额度、应收与信用敞口"
        actions={
          <>
            {mayApprove ? (
              <button
                type="button"
                class="secondary"
                data-testid="kt-credit-set-limit"
                onClick={() => {
                  state.openForm('limit');
                }}
              >
                设置客户额度
              </button>
            ) : null}
            {mayEvaluate ? (
              <button
                type="button"
                class="primary"
                data-testid="kt-credit-evaluate"
                onClick={() => {
                  state.openForm('evaluate');
                }}
              >
                ＋ 发起信用评估
              </button>
            ) : null}
          </>
        }
      />
      {/* TD-WF-014①：详情抽屉没开着时，写成功的提示显示在页头下方。 */}
      {state.selected ? null : <ConsoleNotice message={state.notice} />}
      <CreditFlow state={state} />
      <div class="commercial-console-filters">
        {(['ALL', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED'] as const).map((option) => (
          <button
            key={option}
            type="button"
            class={state.statusFilter === option ? 'secondary compact active' : 'secondary compact'}
            data-testid={`kt-credit-filter-${option.toLowerCase()}`}
            onClick={() => {
              state.setStatusFilter(option);
            }}
          >
            {option === 'ALL' ? '全部' : (STATUS_LABELS[option] ?? option)}
          </button>
        ))}
        <input
          type="search"
          aria-label="按报价编号检索"
          placeholder="按报价编号检索"
          data-testid="kt-credit-search"
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
        rowId={(row) => state.ports.recordText(row, 'id', 'id')}
        caption="信用决定主列表（状态、敞口与额度）"
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
        emptyTitle="暂无信用决定"
        emptyDescription="设置客户额度并发起信用评估后会出现在这里"
      />
      {state.selected ? <CreditDrawer state={state} /> : null}
      {state.activeForm === 'limit' ? <LimitDrawer state={state} /> : null}
      {state.activeForm === 'evaluate' ? <EvaluateDrawer state={state} /> : null}
    </div>
  );
};

export function CreditConsolePage(ports: CreditConsolePorts) {
  const bundle = {
    decisions: signal<readonly CreditRow[]>([...ports.initialDecisions]),
    limits: signal<readonly CreditRow[]>([...ports.initialLimits]),
    statusFilter: signal<'ALL' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXPIRED'>('ALL'),
    search: signal(''),
    loadError: signal(''),
    submitError: signal(''),
    notice: signal(''),
    loading: signal(false),
    selected: signal<CreditRow | null>(null),
    activeForm: signal<CreditFormKind>(null),
    decision: signal<'APPROVED' | 'REJECTED' | null>(null),
    shownCount: signal(20),
  };

  const fail = (error: unknown, fallback: string): void => {
    // TD-WF-006：服务端的常见拒绝原因转成中文再显示（此前直接显示英文原文）。
    const message = failureMessage(error, fallback);
    if (bundle.selected.value !== null || bundle.activeForm.value !== null)
      bundle.submitError.value = message;
    else bundle.loadError.value = message;
  };
  const closeForm = (): void => {
    bundle.activeForm.value = null;
    bundle.decision.value = null;
    bundle.submitError.value = '';
  };

  const runRefresh = async (): Promise<void> => {
    bundle.loading.value = true;
    try {
      const fresh = await ports.refresh();
      bundle.decisions.value = fresh.decisions;
      // TD-WF-008：审批后抽屉里那条仍是「等待信用审批」、批准 / 拒绝按钮还在——换成刷新后的行。
      syncSelected({
        selected: bundle.selected,
        rows: fresh.decisions,
        idOf: (row) => ports.recordText(row, 'id', 'id'),
      });
      bundle.limits.value = fresh.limits;
      bundle.loadError.value = '';
    } catch (error: unknown) {
      fail(error, '信用数据加载失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const runSetLimit = async (values: Readonly<Record<string, string>>): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit('/api/v1/credit-limits', {
        customerId: values.customerId ?? '',
        currency: values.currency ?? 'CNY',
        amount: values.amount ?? '',
        effectiveAt: new Date(`${values.effectiveAt ?? ''}T00:00:00.000Z`).toISOString(),
        expiresAt: new Date(`${values.expiresAt ?? ''}T23:59:59.000Z`).toISOString(),
      });
      const fresh = await ports.refresh();
      bundle.decisions.value = fresh.decisions;
      // TD-WF-008：审批后抽屉里那条仍是「等待信用审批」、批准 / 拒绝按钮还在——换成刷新后的行。
      syncSelected({
        selected: bundle.selected,
        rows: fresh.decisions,
        idOf: (row) => ports.recordText(row, 'id', 'id'),
      });
      bundle.limits.value = fresh.limits;
      closeForm();
      bundle.notice.value = '已保存信用额度';
    } catch (error: unknown) {
      fail(error, '额度保存失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const runEvaluate = async (values: Readonly<Record<string, string>>): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      const quote = ports.issuedQuotes.find((item) => item.id === values.quoteRevisionId);
      const customerId = quote?.customerId;
      if (typeof customerId !== 'string') throw new Error('报价未关联有效客户');
      await ports.submit('/api/v1/credit-decisions', {
        customerId,
        quoteRevisionId: values.quoteRevisionId ?? '',
        quoteSnapshotId: ports.textValue(quote?.issuedSnapshotId, ''),
        creditLimitId: values.creditLimitId ?? '',
        validUntil: new Date(`${values.validUntil ?? ''}T23:59:59.000Z`).toISOString(),
      });
      const fresh = await ports.refresh();
      bundle.decisions.value = fresh.decisions;
      // TD-WF-008：审批后抽屉里那条仍是「等待信用审批」、批准 / 拒绝按钮还在——换成刷新后的行。
      syncSelected({
        selected: bundle.selected,
        rows: fresh.decisions,
        idOf: (row) => ports.recordText(row, 'id', 'id'),
      });
      closeForm();
      bundle.notice.value = '已发起信用评估';
    } catch (error: unknown) {
      fail(error, '信用评估失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const runDecision = async (
    row: CreditRow,
    decision: 'APPROVED' | 'REJECTED',
    reason: string,
  ): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit(
        `/api/v1/credit-decisions/${ports.recordText(row, 'id', 'id')}/state`,
        { decision, reason },
        'PUT',
      );
      const fresh = await ports.refresh();
      bundle.decisions.value = fresh.decisions;
      // TD-WF-008：审批后抽屉里那条仍是「等待信用审批」、批准 / 拒绝按钮还在——换成刷新后的行。
      syncSelected({
        selected: bundle.selected,
        rows: fresh.decisions,
        idOf: (row) => ports.recordText(row, 'id', 'id'),
      });
      closeForm();
      bundle.notice.value = decision === 'APPROVED' ? '已批准信用' : '已拒绝信用';
    } catch (error: unknown) {
      fail(error, '信用决定失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const state = (): CreditPageState => ({
    decisions: bundle.decisions.value,
    limits: bundle.limits.value,
    statusFilter: bundle.statusFilter.value,
    search: bundle.search.value,
    loadError: bundle.loadError.value,
    submitError: bundle.submitError.value,
    notice: bundle.notice.value,
    loading: bundle.loading.value,
    selected: bundle.selected.value,
    activeForm: bundle.activeForm.value,
    decision: bundle.decision.value,
    permissions: ports.permissions,
    ports,
    // 开始下一个动作时清掉上一次的成功提示（与 submitError 同一处）。
    open: (row) => {
      bundle.selected.value = row;
      bundle.activeForm.value = null;
      bundle.decision.value = null;
      bundle.submitError.value = '';
      bundle.notice.value = '';
    },
    openForm: (kind) => {
      bundle.activeForm.value = kind;
      bundle.submitError.value = '';
      bundle.notice.value = '';
    },
    openDecision: (decision) => {
      bundle.decision.value = decision;
      bundle.notice.value = '';
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
    runSetLimit,
    runEvaluate,
    runDecision,
  });

  const Page = () => CreditView(state());
  return Page;
}
