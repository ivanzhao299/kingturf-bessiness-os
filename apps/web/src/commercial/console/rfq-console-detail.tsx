// PROC-UX：询价控制台详情子组件（自 rfq-console 拆分——G1/G5 ≤800/≤200 行纪律）：
// 询价行项（U3-PROC-2 等价迁移）+ 报价对比矩阵（行项×供应商）+ 截止倒计时徽章。
// 只依赖状态最小面，结构与 rfq-console 的 RfqPageState 兼容（结构化子集，无循环依赖）。
import { DataTable, StatusBadge, type DataTableColumn, type StatusTone } from '@kingturf/ui';
import type { RfqConsolePorts, RfqRow } from './rfq-ports';

export type RfqDetailState = Readonly<{
  selected: RfqRow | null;
  ports: RfqConsolePorts;
  now: () => Date;
}>;

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const linesOf = (row: RfqRow | null): readonly Record<string, unknown>[] =>
  row && Array.isArray(row.lines) ? (row.lines as Record<string, unknown>[]) : [];

const quotesOf = (row: RfqRow | null): readonly Record<string, unknown>[] =>
  row && Array.isArray(row.quotes) ? (row.quotes as Record<string, unknown>[]) : [];

export const RfqLines = ({ state }: Readonly<{ state: RfqDetailState }>) => {
  const row = state.selected;
  if (!row) return null;
  const lines = linesOf(row);
  if (lines.length === 0)
    return (
      <p class="console-label" data-testid="kt-rfq-lines-empty">
        尚无询价行项
      </p>
    );
  return (
    <ul class="console-summary" data-testid="kt-rfq-lines">
      {lines.map((line, index) => (
        <li key={state.ports.textValue(line.id, String(index))}>
          {`${state.ports.textValue(line.sku, '—')} · ${state.ports.textValue(line.itemName, '—')} · 数量 ${state.ports.textValue(line.quantity, '—')} · 要求到货 ${state.ports.textValue(line.requiredAt ?? line.required_at, '—')}`}
        </li>
      ))}
    </ul>
  );
};

// ---- 截止倒计时 ----

// 语义红徽章：与 @kingturf/ui StatusBadge 同形（class/data-tone='danger'）；danger 追加 token
// 内联回退——components.css 仅有 data-tone='error' 规则、无 'danger'（落回 neutral 灰），
// 登记 TD-PROC-004；packages/ui 补规则后本回退可删。
const DANGER_BADGE_STYLE = {
  background: 'var(--kt-color-danger-soft)',
  color: 'var(--kt-color-danger)',
} as const;

export type Countdown = Readonly<{
  kind: 'remaining' | 'today' | 'overdue';
  days: number;
  label: string;
  tone: StatusTone | 'danger';
}>;

const pad = (value: number): string => String(value).padStart(2, '0');
// UTC 日历日串（与列示的截止日期——ISO 前 10 位——同口径）。
const utcDay = (date: Date): string =>
  `${String(date.getUTCFullYear())}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

// 截止倒计时：按日历日差计（与列示截止日期同用 UTC 日期，避免文本与天数错位一日）；
// 不可解析的截止时间返回 null（不呈徽章）。
export const countdownOf = (dueAt: string, now: Date): Countdown | null => {
  const due = new Date(dueAt);
  if (dueAt === '' || Number.isNaN(due.getTime())) return null;
  const days = Math.round(
    (Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()) -
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) /
      86_400_000,
  );
  if (days > 0)
    return {
      kind: 'remaining',
      days,
      label: `剩 ${String(days)} 天`,
      tone: days <= 3 ? 'warning' : 'info',
    };
  if (days === 0) return { kind: 'today', days, label: '今日截止', tone: 'warning' };
  return { kind: 'overdue', days, label: `已逾期 ${String(-days)} 天`, tone: 'danger' };
};

// 倒计时仅对「已签发（询价中）」呈示：草稿未发出、已关闭/已转采购单不再计时。
export const activeCountdown = (state: RfqDetailState, row: RfqRow): Countdown | null => {
  const status = state.ports.recordText(row, 'status', 'status');
  if (status !== 'ISSUED') return null;
  return countdownOf(
    state.ports.recordText(row, 'responseDueAt', 'response_due_at', ''),
    state.now(),
  );
};

export const CountdownBadge = ({ countdown }: Readonly<{ countdown: Countdown }>) => (
  <span
    class="status-badge"
    data-testid="kt-rfq-countdown"
    data-kind={countdown.kind}
    data-tone={countdown.tone}
    style={countdown.tone === 'danger' ? DANGER_BADGE_STYLE : undefined}
    title="距报价截止的日历天数（已签发询价单）"
  >
    {countdown.label}
  </span>
);

// ---- 报价对比矩阵 ----

type MatrixQuote = Readonly<{
  id: string;
  supplierName: string;
  reference: string;
  receivedAt: string;
  validUntil: string;
  expired: boolean;
  lines: readonly Record<string, unknown>[];
}>;

const text = (ports: RfqConsolePorts, row: Record<string, unknown>, camel: string, snake: string) =>
  ports.textValue(row[camel] ?? row[snake], '');

const matrixQuotes = (
  ports: RfqConsolePorts,
  quotes: readonly Record<string, unknown>[],
  now: Date,
): readonly MatrixQuote[] =>
  quotes.map((quote, index) => {
    const validUntil = text(ports, quote, 'validUntil', 'valid_until');
    return {
      id: ports.textValue(quote.id, String(index)),
      supplierName: text(ports, quote, 'supplierName', 'supplier_name') || '—',
      reference: text(ports, quote, 'quoteReference', 'quote_reference') || '—',
      receivedAt: text(ports, quote, 'receivedAt', 'received_at'),
      validUntil,
      // 有效期早于当日（UTC 日历日）即失效；无有效期视为有效（不臆断）。
      expired: validUntil !== '' && validUntil < utcDay(now),
      lines: Array.isArray(quote.lines) ? quote.lines.map(record) : [],
    };
  });

const lineNumberOf = (line: Record<string, unknown>): number =>
  Number(line.lineNumber ?? line.line_number);

const linePrice = (quote: MatrixQuote, lineNumber: number): number | null => {
  const line = quote.lines.find((entry) => lineNumberOf(entry) === lineNumber);
  const price = Number(line?.unitPrice ?? line?.unit_price);
  return line === undefined || !Number.isFinite(price) ? null : price;
};

// 推荐项：该行有效报价中单价最低者（并列同标；全部失效则无推荐）。
const recommendedOf = (quotes: readonly MatrixQuote[], lineNumber: number): readonly number[] => {
  const prices = quotes
    .map((quote, index) => ({ index, price: quote.expired ? null : linePrice(quote, lineNumber) }))
    .filter((entry): entry is Readonly<{ index: number; price: number }> => entry.price !== null);
  const lowest = Math.min(...prices.map((entry) => entry.price));
  return prices.filter((entry) => entry.price === lowest).map((entry) => entry.index);
};

// 数值呈现：去掉 numeric(24,6) 的尾随零（12.500000 → 12.5；5000.000000 → 5000）。
const decimalText = (ports: RfqConsolePorts, value: unknown, fallback = '—'): string => {
  const raw = ports.textValue(value, '');
  if (raw === '') return fallback;
  return raw.replace(/(\.\d*?)0+$/u, '$1').replace(/\.$/u, '');
};
const priceText = (ports: RfqConsolePorts, price: number | null): string =>
  price === null ? '—' : decimalText(ports, price);

const CELL_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '2px',
} as const;

const QuoteCell = ({
  state,
  quote,
  line,
  recommended,
}: Readonly<{
  state: RfqDetailState;
  quote: MatrixQuote;
  line: Record<string, unknown>;
  recommended: boolean;
}>) => {
  const { ports } = state;
  // 该行无对应报价行时 MOQ/交期呈 —。
  const quoted = quote.lines.find((entry) => lineNumberOf(entry) === lineNumberOf(line)) ?? {};
  const terms = `MOQ ${decimalText(ports, quoted.minimumOrderQuantity ?? quoted.minimum_order_quantity)} · 交期 ${ports.textValue(quoted.promisedAt ?? quoted.promised_at, '—')}`;
  return (
    <span
      data-testid="kt-rfq-matrix-cell"
      data-quote={quote.id}
      data-recommended={recommended ? 'true' : 'false'}
      style={CELL_STYLE}
    >
      <span>{`单价 ${priceText(ports, linePrice(quote, lineNumberOf(line)))}`}</span>
      <span class="console-label">{terms}</span>
      {quote.expired ? <StatusBadge tone="warning">已失效</StatusBadge> : null}
      {recommended ? <StatusBadge tone="success">推荐</StatusBadge> : null}
    </span>
  );
};

const matrixColumns = (
  state: RfqDetailState,
  quotes: readonly MatrixQuote[],
): readonly DataTableColumn<Record<string, unknown>>[] => [
  {
    key: 'line',
    header: '行项',
    field: (line) => state.ports.textValue(line.sku, ''),
    render: (line) => (
      <span>{`行 ${state.ports.textValue(line.lineNumber ?? line.line_number, '—')} · ${state.ports.textValue(line.sku, '—')} · ${state.ports.textValue(line.itemName, '—')} · 数量 ${state.ports.textValue(line.quantity, '—')}`}</span>
    ),
  },
  ...quotes.map(
    (quote, index): DataTableColumn<Record<string, unknown>> => ({
      key: `quote-${quote.id}`,
      header: quote.supplierName,
      sortable: true,
      field: (line) => linePrice(quote, lineNumberOf(line)) ?? Number.MAX_SAFE_INTEGER,
      render: (line) => (
        <QuoteCell
          state={state}
          quote={quote}
          line={line}
          recommended={recommendedOf(quotes, lineNumberOf(line)).includes(index)}
        />
      ),
    }),
  ),
];

// 报价对比矩阵：行 = 询价行项，列 = 供应商报价；单元格呈单价/MOQ/交期，推荐项标记。
export const QuoteComparison = ({ state }: Readonly<{ state: RfqDetailState }>) => {
  const row = state.selected;
  if (!row) return null;
  const { ports } = state;
  const quotes = matrixQuotes(ports, quotesOf(row), state.now());
  if (quotes.length === 0) return null;
  return (
    <div class="console-summary" data-testid="kt-rfq-quotes">
      <p class="console-label">报价对比（行项 × 供应商）</p>
      <ul data-testid="kt-rfq-quote-legend">
        {quotes.map((quote) => (
          <li key={quote.id}>
            {`${quote.supplierName} · ${quote.reference} · 收于 ${quote.receivedAt.slice(0, 10)} · 有效至 ${quote.validUntil || '—'}`}
          </li>
        ))}
      </ul>
      <p>
        <span class="console-label">推荐 = 有效报价中单价最低（并列同标）</span>
      </p>
      {/* 供应商列较多时在抽屉内横向滚动。 */}
      <div style={{ overflowX: 'auto' }}>
        <DataTable
          columns={matrixColumns(state, quotes)}
          rows={linesOf(row)}
          rowId={(line) => ports.textValue(line.id, String(lineNumberOf(line)))}
          caption="报价对比矩阵（单价 / MOQ / 交期）"
        />
      </div>
    </div>
  );
};
