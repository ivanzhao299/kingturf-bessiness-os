import { signal, type Signal } from '@preact/signals';
import {
  DataTable,
  DetailDrawer,
  PageHeader,
  StatusBadge,
  type DataTableColumn,
} from '@kingturf/ui';
import type { QuoteConsolePorts, QuoteRow, QuoteSnapshot } from './quote-ports';
import { CreateForm, IssueForm, ApproveForm, ReviseForm } from './quote-forms';
import {
  MarginMeter,
  QuoteTimeline,
  STATUS_LABELS,
  percent,
  quoteMarginRate,
  quoteThresholds,
  statusTone,
} from './quote-console-timeline';
import { failureMessage } from '../../shared/api-error-message';
import { FocusAnchor } from './focus-anchor';

// U3-COM-3（ADR-0014 分域重写）：报价控制台——原 vanilla quote workbench 能力面
// 等价迁移（新建含政策预校验、修订、批准、签发、打印；列表/筛选/客户端分页）。
// COM-UX：毛利列附毛利率仪表条，详情抽屉以水平版本时间线承载版本历史（节点可切换版本）。
type QuoteStatusFilter = 'ALL' | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'ISSUED';

type QuoteFormKind = 'create' | 'revise' | 'approve' | 'issue';

export type QuotePageState = Readonly<{
  snapshot: QuoteSnapshot;
  shownCount: number;
  statusFilter: QuoteStatusFilter;
  search: string;
  loadError: string;
  submitError: string;
  loading: boolean;
  selected: QuoteRow | null;
  activeForm: QuoteFormKind | null;
  permissions: ReadonlySet<string>;
  ports: QuoteConsolePorts;
  open: (quote: QuoteRow | null) => void;
  openForm: (kind: QuoteFormKind) => void;
  closeCreate: () => void;
  setStatusFilter: (next: QuoteStatusFilter) => void;
  setSearch: (next: string) => void;
  showMore: () => void;
  runRefresh: () => Promise<void>;
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
  runRevise: (quote: QuoteRow, values: Readonly<Record<string, string>>) => Promise<void>;
  runCommand: (
    quote: QuoteRow,
    kind: 'approve' | 'issue',
    values: Readonly<Record<string, string>>,
  ) => Promise<void>;
}>;

const recordOf = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

// 毛利金额 + 毛利率文案（列表与详情同一口径）；毛利率不可见时显示「—」。
const marginText = (ports: QuoteConsolePorts, row: QuoteRow): string => {
  const rate = quoteMarginRate(row);
  return `${ports.textValue(row.margin, '—')}（${rate === null ? '—' : percent(rate)}）`;
};

// vanilla quote-create/quote-cards 同源的行输入与经济量推导。
const LINE_INPUTS: readonly (readonly [string, string, string, string])[] = [
  ['人造草坪系统', 'turfQuantity', 'M2', 'turfPrice'],
  ['铺装施工服务', 'installationQuantity', 'M2', 'installationPrice'],
  ['项目技术服务', 'serviceQuantity', 'EA', 'servicePrice'],
];

const quoteLinesFrom = (
  values: Readonly<Record<string, string>>,
  decimalValue: (value: number) => string,
) => {
  const lines = LINE_INPUTS.map(([description, quantityKey, unitCode, priceKey]) => ({
    description,
    quantity: decimalValue(Number(values[quantityKey] ?? 0)),
    unitCode,
    unitPrice: decimalValue(Number(values[priceKey] ?? 0)),
    total: decimalValue(Number(values[quantityKey] ?? 0) * Number(values[priceKey] ?? 0)),
  }));
  return lines;
};

const economicsOf = (
  lines: readonly { total: string }[],
  discountPercent: string,
  costTotal: number,
  decimalValue: (value: number) => string,
) => {
  const subtotal = lines.reduce((sum, line) => sum + Number(line.total), 0);
  const discount = subtotal * (Number(discountPercent || 0) / 100);
  const total = subtotal - discount;
  if (total <= 0) throw new Error('折扣后报价金额必须大于零');
  const margin = total - costTotal;
  const marginBasisPoints = Math.trunc((margin * 10_000) / total);
  const discountBasisPoints = Math.trunc((discount * 10_000) / subtotal);
  return {
    subtotal: decimalValue(subtotal),
    discount: decimalValue(discount),
    total: decimalValue(total),
    margin: decimalValue(margin),
    marginBasisPoints,
    discountBasisPoints,
  };
};

const filteredQuotes = (state: QuotePageState): readonly QuoteRow[] =>
  state.snapshot.quotes.filter((row) => {
    if (state.statusFilter !== 'ALL' && row.status !== state.statusFilter) return false;
    if (state.search === '') return true;
    const code = state.ports.textValue(row.quoteNumber, '');
    return code.toLowerCase().includes(state.search.toLowerCase());
  });

const columns = (state: QuotePageState): readonly DataTableColumn<QuoteRow>[] => [
  {
    key: 'quoteNumber',
    header: '报价',
    sortable: true,
    field: (row) => state.ports.textValue(row.quoteNumber, '报价'),
    render: (row) => (
      <span>
        {state.ports.textValue(row.quoteNumber, '报价')} · 第{' '}
        {state.ports.textValue(row.revision, '1')} 版
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
        {STATUS_LABELS[state.ports.textValue(row.status, 'DRAFT')] ?? '—'}
      </StatusBadge>
    ),
  },
  {
    key: 'total',
    header: '报价总额',
    sortable: true,
    field: (row) => Number(row.total ?? 0),
    render: (row) =>
      `${state.ports.textValue(row.currency, '')} ${state.ports.textValue(row.total, '—')}`,
  },
  {
    key: 'margin',
    header: '毛利',
    sortable: true,
    field: (row) => quoteMarginRate(row) ?? 0,
    render: (row) => (
      // 金额文案保持；下方迷你仪表条按政策红线分带，字段受限时显示「—」而非误判 0%。
      <span class="com-quote-margin-cell">
        <span>{marginText(state.ports, row)}</span>
        <MarginMeter
          compact
          rate={quoteMarginRate(row)}
          thresholds={quoteThresholds(row, state.snapshot.policies)}
        />
      </span>
    ),
  },
  {
    key: 'validUntil',
    header: '有效期至',
    sortable: true,
    field: (row) => state.ports.textValue(row.validUntil, ''),
    render: (row) => state.ports.textValue(row.validUntil, '—').slice(0, 10),
  },
  {
    key: 'actions',
    header: '操作',
    field: () => '查看',
    render: (row) => (
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-quote-open"
        onClick={() => {
          state.open(row);
        }}
      >
        查看
      </button>
    ),
  },
];

const QuoteDetail = ({ state }: Readonly<{ state: QuotePageState }>) => {
  const quote = state.selected;
  if (!quote) return null;
  const { textValue, recordValue } = state.ports;
  const lines = Array.isArray(quote.lines) ? quote.lines : [];
  return (
    <div class="console-summary" data-testid="kt-quote-detail">
      <p>
        <span class="console-label">状态</span>
        <StatusBadge tone={statusTone(quote.status)}>
          {STATUS_LABELS[textValue(quote.status, 'DRAFT')] ?? '—'}
        </StatusBadge>
        <span class="console-label">报价总额</span>
        {`${textValue(quote.currency, '')} ${textValue(quote.total, '—')}`}
      </p>
      <p>
        <span class="console-label">折扣</span>
        {textValue(quote.discount, '0')}
        <span class="console-label">成本</span>
        {textValue(quote.costTotal, '—')}
        <span class="console-label">毛利</span>
        {marginText(state.ports, quote)}
        <span class="console-label">有效期至</span>
        {textValue(quote.validUntil, '—').slice(0, 10)}
      </p>
      <div class="com-quote-margin" data-testid="kt-quote-margin-detail">
        <span class="console-label">毛利率</span>
        <MarginMeter
          rate={quoteMarginRate(quote)}
          thresholds={quoteThresholds(quote, state.snapshot.policies)}
        />
      </div>
      <div class="console-chips" data-testid="kt-quote-pins">
        <span class="console-chip">{`技术需求 ${textValue(quote.ctrVersionId, '').slice(0, 8)}`}</span>
        <span class="console-chip">{`方案 ${textValue(quote.technicalSolutionRevisionId, '').slice(0, 8)}`}</span>
        <span class="console-chip">{`成本 ${textValue(quote.costDecisionId, '').slice(0, 8)}`}</span>
        <span class="console-chip">{`政策 ${textValue(quote.policyVersionId, '').slice(0, 8)}`}</span>
      </div>
      <dl data-testid="kt-quote-lines">
        {lines.map((line) => {
          const item = recordValue(line);
          return (
            <p key={textValue(item.description, '行')}>
              {textValue(item.description, '报价行')} · {textValue(item.quantity, '—')}{' '}
              {textValue(item.unit_code, '')} · {textValue(item.unit_price, '—')} /{' '}
              {textValue(item.total, '—')}
            </p>
          );
        })}
      </dl>
      <QuoteTimeline state={state} />
    </div>
  );
};

const QuoteDrawer = ({ state }: Readonly<{ state: QuotePageState }>) => {
  const quote = state.selected;
  if (!quote) return null;
  const { ports, permissions } = state;
  const status = ports.textValue(quote.status, 'DRAFT');
  const mayRevise = permissions.has('quote:update') && ['ISSUED', 'REJECTED'].includes(status);
  const mayApprove = status === 'DRAFT' && permissions.has('quote:approve');
  const mayIssue = status === 'APPROVED' && permissions.has('quote:issue');
  return (
    <DetailDrawer
      title={`报价详情 · ${ports.textValue(quote.quoteNumber, '报价')} · 第 ${ports.textValue(quote.revision, '1')} 版`}
      onClose={() => {
        state.open(null);
      }}
    >
      <QuoteDetail state={state} />
      {/* TD-WF-005 / TD-WF-012：行内表单开着时，提交失败显示在该表单自己的提示区（FormSection 的
          error，紧挨提交按钮）；这里的错误位只留给不经表单的动作。 */}
      {state.activeForm === null && state.submitError !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-quote-submit-error">
          {state.submitError}
        </p>
      ) : null}
      {state.activeForm === null ? (
        <div class="console-actions" data-testid="kt-quote-actions">
          {mayRevise ? (
            <button
              type="button"
              class="secondary"
              data-testid="kt-quote-revise"
              onClick={() => {
                state.openForm('revise');
              }}
            >
              创建报价修订
            </button>
          ) : null}
          {mayApprove ? (
            <button
              type="button"
              class="primary"
              data-testid="kt-quote-approve"
              onClick={() => {
                state.openForm('approve');
              }}
            >
              批准报价
            </button>
          ) : null}
          {mayIssue ? (
            <button
              type="button"
              class="primary"
              data-testid="kt-quote-issue"
              onClick={() => {
                state.openForm('issue');
              }}
            >
              签发报价
            </button>
          ) : null}
          {status === 'ISSUED' ? (
            <button
              type="button"
              class="secondary"
              data-testid="kt-quote-print"
              onClick={() => {
                state.ports.printIssuedQuote(quote);
              }}
            >
              打印 / 保存 PDF
            </button>
          ) : null}
          {!mayRevise && !mayApprove && !mayIssue && status !== 'ISSUED' ? (
            <span class="console-hint">当前状态无可用行级操作</span>
          ) : null}
        </div>
      ) : null}
      {state.activeForm === 'revise' ? <ReviseForm state={state} /> : null}
      {state.activeForm === 'approve' ? <ApproveForm state={state} /> : null}
      {state.activeForm === 'issue' ? <IssueForm state={state} /> : null}
      {/* TD-WF-014④：行内表单开合、状态变化让原来的按钮消失后，把键盘焦点带回抽屉。 */}
      <FocusAnchor token={`${String(state.activeForm)}|${status}`} />
    </DetailDrawer>
  );
};

const revisableLines = (ports: QuoteConsolePorts, quote: QuoteRow) =>
  (Array.isArray(quote.lines) ? quote.lines : []).map((line) => {
    const item = recordOf(line);
    return {
      description: ports.textValue(item.description, '报价行'),
      quantity: ports.textValue(item.quantity, '0'),
      unitCode: ports.textValue(item.unit_code, ''),
      unitPrice: ports.textValue(item.unit_price, '0'),
      total: ports.textValue(item.total, '0'),
    };
  });

const CreateDrawer = ({ state }: Readonly<{ state: QuotePageState }>) => (
  <DetailDrawer title="新建销售报价" onClose={state.closeCreate}>
    {/* 提交失败的原因显示在表单自己的提示区（CreateForm 的 error）：此前它渲染在抽屉顶部，
        长表单下滚到提交按钮时已经在视口上方（TD-WF-012）。 */}
    <CreateForm state={state} />
  </DetailDrawer>
);

// G5 拆分：动作工厂独立于状态工厂（每函数 ≤200 行）。
type QuoteSignalBundle = Readonly<{
  snapshot: Signal<QuoteSnapshot>;
  loadError: Signal<string>;
  submitError: Signal<string>;
  loading: Signal<boolean>;
  selected: Signal<QuoteRow | null>;
  activeForm: Signal<QuoteFormKind | null>;
}>;

type QuoteActions = Readonly<{
  runRefresh: () => Promise<void>;
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
  runRevise: (quote: QuoteRow, values: Readonly<Record<string, string>>) => Promise<void>;
  runCommand: (
    quote: QuoteRow,
    kind: 'approve' | 'issue',
    values: Readonly<Record<string, string>>,
  ) => Promise<void>;
}>;

const applySnapshot = (bundle: QuoteSignalBundle, next: QuoteSnapshot): void => {
  bundle.snapshot.value = next;
  bundle.loadError.value = '';
};
const closeForm = (bundle: QuoteSignalBundle): void => {
  bundle.activeForm.value = null;
  bundle.submitError.value = '';
};
const fail = (error: unknown, bundle: QuoteSignalBundle, fallback: string): void => {
  const message = failureMessage(error, fallback);
  if (bundle.activeForm.value === null) bundle.loadError.value = message;
  else bundle.submitError.value = message;
};

const quoteActions = (ports: QuoteConsolePorts, bundle: QuoteSignalBundle): QuoteActions => {
  const runRefresh = async (): Promise<void> => {
    bundle.loading.value = true;
    try {
      applySnapshot(bundle, await ports.refresh());
    } catch (error: unknown) {
      fail(error, bundle, '报价加载失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const runCreate = async (values: Readonly<Record<string, string>>): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      const cost = bundle.snapshot.value.costs.find((item) => item.id === values.costDecisionId);
      if (!cost) throw new Error('请选择有效成本决策');
      const solutionId = ports.textValue(cost.technicalSolutionRevisionId, '');
      const solution = bundle.snapshot.value.solutions.find((item) => item.id === solutionId);
      if (!solution) throw new Error('成本决策对应的技术方案不可见');
      const ctrVersionId = ports.textValue(solution.ctrVersionId, '');
      const ctr = bundle.snapshot.value.ctrs.find((item) => item.id === ctrVersionId);
      if (!ctr) throw new Error('技术方案对应的技术需求版本不可见');
      const lines = quoteLinesFrom(values, ports.decimalValue);
      const economics = economicsOf(
        lines,
        values.discountPercent ?? '',
        Number(cost.total ?? 0),
        ports.decimalValue,
      );
      const policyEvaluation = recordOf(
        await ports.submit('/api/v1/sales-policy-evaluations', {
          policyVersionId: values.policyVersionId ?? '',
          costDecisionId: values.costDecisionId ?? '',
          context: {
            marginBasisPoints: economics.marginBasisPoints,
            discountBasisPoints: economics.discountBasisPoints,
          },
        }),
      );
      if (policyEvaluation.passed !== true || typeof policyEvaluation.id !== 'string') {
        const rawReasons = Array.isArray(policyEvaluation.reasons) ? policyEvaluation.reasons : [];
        const reasons = (rawReasons as unknown[])
          .map((item) => ports.textValue(item, ''))
          .filter(Boolean);
        throw new Error(`销售政策未通过${reasons.length > 0 ? `：${reasons.join('；')}` : ''}`);
      }
      await ports.submit('/api/v1/quotes', {
        quoteNumber: values.quoteNumber ?? '',
        opportunityId: ports.textValue(cost.opportunityId, ''),
        ctrVersionId,
        technicalSolutionRevisionId: solutionId,
        costDecisionId: values.costDecisionId ?? '',
        policyVersionId: values.policyVersionId ?? '',
        policyEvaluationId: policyEvaluation.id,
        currency: ports.textValue(cost.currency, 'CNY'),
        subtotal: economics.subtotal,
        discount: economics.discount,
        total: economics.total,
        costTotal: ports.decimalValue(Number(cost.total ?? 0)),
        margin: economics.margin,
        marginBasisPoints: economics.marginBasisPoints,
        validUntil: new Date(`${values.validUntil ?? ''}T23:59:59.000Z`).toISOString(),
        lines,
      });
      ports.clearPreferredCostDecisionId();
      applySnapshot(bundle, await ports.refresh());
      closeForm(bundle);
    } catch (error: unknown) {
      fail(error, bundle, '报价创建失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const runRevise = async (
    quote: QuoteRow,
    values: Readonly<Record<string, string>>,
  ): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      const lines = revisableLines(ports, quote);
      const economics = economicsOf(
        lines,
        values.discountPercent ?? '',
        Number(quote.costTotal ?? 0),
        ports.decimalValue,
      );
      const policyEvaluation = recordOf(
        await ports.submit('/api/v1/sales-policy-evaluations', {
          policyVersionId: ports.textValue(quote.policyVersionId, ''),
          costDecisionId: ports.textValue(quote.costDecisionId, ''),
          context: {
            marginBasisPoints: economics.marginBasisPoints,
            discountBasisPoints: economics.discountBasisPoints,
          },
        }),
      );
      if (policyEvaluation.passed !== true || typeof policyEvaluation.id !== 'string')
        throw new Error('修订后的报价未通过销售政策');
      await ports.submit(
        `/api/v1/quotes/${ports.textValue(quote.quoteId, '')}`,
        {
          quoteNumber: ports.textValue(quote.quoteNumber, ''),
          opportunityId: ports.textValue(quote.opportunityId, ''),
          ctrVersionId: ports.textValue(quote.ctrVersionId, ''),
          technicalSolutionRevisionId: ports.textValue(quote.technicalSolutionRevisionId, ''),
          costDecisionId: ports.textValue(quote.costDecisionId, ''),
          policyVersionId: ports.textValue(quote.policyVersionId, ''),
          policyEvaluationId: policyEvaluation.id,
          currency: ports.textValue(quote.currency, 'CNY'),
          subtotal: economics.subtotal,
          discount: economics.discount,
          total: economics.total,
          costTotal: ports.textValue(quote.costTotal, '0'),
          margin: economics.margin,
          marginBasisPoints: economics.marginBasisPoints,
          validUntil: new Date(`${values.validUntil ?? ''}T23:59:59.000Z`).toISOString(),
          lines,
        },
        'PUT',
      );
      applySnapshot(bundle, await ports.refresh());
      closeForm(bundle);
    } catch (error: unknown) {
      fail(error, bundle, '报价修订保存失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const runCommand = async (
    quote: QuoteRow,
    kind: 'approve' | 'issue',
    values: Readonly<Record<string, string>>,
  ): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.command(
        ports.textValue(quote.id, ''),
        kind,
        kind === 'approve' ? { decision: 'APPROVED', reason: values.reason ?? '' } : undefined,
      );
      applySnapshot(bundle, await ports.refresh());
      closeForm(bundle);
    } catch (error: unknown) {
      fail(error, bundle, kind === 'approve' ? '报价批准失败' : '报价签发失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  return { runRefresh, runCreate, runRevise, runCommand };
};

const QuoteView = (state: QuotePageState) => {
  const visible = filteredQuotes(state);
  const shown = visible.slice(0, state.shownCount);
  const mayCreate =
    state.permissions.has('quote:create') &&
    state.snapshot.costs.length > 0 &&
    state.snapshot.policies.length > 0;
  return (
    <div class="commercial-console-page" data-testid="kt-quote-page">
      <PageHeader
        title="销售报价"
        description="报价明细、毛利与政策校验"
        actions={
          <>
            <button
              type="button"
              class="secondary"
              data-testid="kt-quote-refresh"
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
                data-testid="kt-quote-create"
                onClick={() => {
                  state.openForm('create');
                }}
              >
                ＋ 新建报价
              </button>
            ) : null}
          </>
        }
      />
      <div class="commercial-console-filters">
        {(['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED'] as const).map((option) => (
          <button
            key={option}
            type="button"
            class={state.statusFilter === option ? 'secondary compact active' : 'secondary compact'}
            data-testid={`kt-quote-filter-${option.toLowerCase()}`}
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
          data-testid="kt-quote-search"
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
        rowId={(row) => state.ports.textValue(row.id ?? row.quoteId, 'row')}
        caption="报价主列表（版本、状态、毛利与有效期）"
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
        emptyTitle="暂无报价"
        emptyDescription="新建报价后会出现在这里"
      />
      {state.selected ? <QuoteDrawer state={state} /> : null}
      {state.activeForm === 'create' ? <CreateDrawer state={state} /> : null}
    </div>
  );
};

export function QuoteConsolePage(ports: QuoteConsolePorts) {
  const bundle: QuoteSignalBundle = {
    snapshot: signal<QuoteSnapshot>(ports.initialSnapshot),
    loadError: signal(''),
    submitError: signal(''),
    loading: signal(false),
    selected: signal<QuoteRow | null>(null),
    activeForm: signal<QuoteFormKind | null>(null),
  };
  const shownCount = signal(20);
  const statusFilter = signal<QuoteStatusFilter>('ALL');
  const search = signal('');

  const state = (): QuotePageState => ({
    snapshot: bundle.snapshot.value,
    shownCount: shownCount.value,
    statusFilter: statusFilter.value,
    search: search.value,
    loadError: bundle.loadError.value,
    submitError: bundle.submitError.value,
    loading: bundle.loading.value,
    selected: bundle.selected.value,
    activeForm: bundle.activeForm.value,
    permissions: ports.permissions,
    ports,
    open: (quote) => {
      bundle.selected.value = quote;
      bundle.activeForm.value = null;
      bundle.submitError.value = '';
    },
    openForm: (kind) => {
      bundle.activeForm.value = kind;
      bundle.submitError.value = '';
    },
    closeCreate: () => {
      bundle.activeForm.value = null;
      bundle.submitError.value = '';
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
    ...quoteActions(ports, bundle),
  });

  const Page = () => QuoteView(state());
  return Page;
}
