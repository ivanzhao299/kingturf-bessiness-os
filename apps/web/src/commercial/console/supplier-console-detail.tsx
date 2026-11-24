// PROC-UX：供应商控制台详情子组件（自 supplier-console 拆分——G1/G5 ≤800/≤200 行纪律）：
// 资质记录/报价历史（U3-PROC-1 等价迁移）+ 资质状态四色徽章（PENDING/APPROVED/
// CONDITIONAL/REJECTED）+ 报价历史对比（同一物料多供应商单价并排，最优高亮）。
// 只依赖状态最小面，结构与 supplier-console 的 SupplierPageState 兼容（结构化子集）。
import { DataTable, StatusBadge, type DataTableColumn, type StatusTone } from '@kingturf/ui';
import { TokenText, useStackedCompare } from './compare-stack';
import type { SupplierConsolePorts, SupplierRow } from './supplier-ports';

export type SupplierDetailState = Readonly<{
  selected: SupplierRow | null;
  quotes: readonly SupplierRow[];
  ports: SupplierConsolePorts;
  now: () => Date;
}>;

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const list = (value: unknown): readonly Record<string, unknown>[] =>
  Array.isArray(value) ? value.map(record) : [];

// businessStateLabel 同口径之外的资质三态（schema 约束 APPROVED/CONDITIONAL/REJECTED）。
export const QUALIFICATION_LABELS: Readonly<Record<string, string>> = {
  APPROVED: '已批准',
  CONDITIONAL: '有条件批准',
  REJECTED: '已驳回',
};

export const qualificationRecords = (row: SupplierRow | null): readonly Record<string, unknown>[] =>
  list(row?.qualifications);

export const qualificationTone = (status: unknown): StatusTone => {
  if (status === 'APPROVED') return 'success';
  if (status === 'CONDITIONAL') return 'info';
  if (status === 'REJECTED') return 'danger';
  return 'neutral';
};

export const QualificationList = ({ state }: Readonly<{ state: SupplierDetailState }>) => {
  const row = state.selected;
  if (!row) return null;
  const qualifications = qualificationRecords(row);
  if (qualifications.length === 0)
    return (
      <p class="console-label" data-testid="kt-supplier-qualifications-empty">
        尚无物料准入记录
      </p>
    );
  return (
    <ul class="console-summary" data-testid="kt-supplier-qualifications">
      {qualifications.map((item, index) => {
        const status = state.ports.textValue(item.status, '');
        return (
          <li key={state.ports.textValue(item.id, String(index))}>
            <StatusBadge tone={qualificationTone(status)}>
              {QUALIFICATION_LABELS[status] ?? status}
            </StatusBadge>
            <TokenText
              text={` ${state.ports.textValue(item.sku, '—')} · ${state.ports.textValue(item.itemName, '—')} · v${state.ports.textValue(item.itemVersion, '—')} · 有效期 ${state.ports.textValue(item.validFrom ?? item.valid_from, '—')} ~ ${state.ports.textValue(item.validTo ?? item.valid_to, '长期')}`}
            />
          </li>
        );
      })}
    </ul>
  );
};

// ---- 资质状态徽章（四色）----
// PENDING 为派生态：supplier_item_qualifications.status 仅 APPROVED/CONDITIONAL/REJECTED，
// 无存储态「审核中」；此处以「已发布物料版本中尚无该供应商准入记录」计为待准入。
export type QualificationCounts = Readonly<{
  PENDING: number;
  APPROVED: number;
  CONDITIONAL: number;
  REJECTED: number;
}>;

const qualifiedVersionIds = (
  ports: SupplierConsolePorts,
  row: SupplierRow | null,
): ReadonlySet<string> =>
  new Set(
    qualificationRecords(row)
      .map((item) => ports.textValue(item.item_version_id ?? item.itemVersionId, ''))
      .filter((id) => id !== ''),
  );

export const pendingItemChoices = (
  ports: SupplierConsolePorts,
  row: SupplierRow | null,
): readonly Readonly<{ value: string; label: string }>[] => {
  const qualified = qualifiedVersionIds(ports, row);
  return ports.itemVersionChoices.filter((choice) => !qualified.has(choice.value));
};

export const qualificationCounts = (
  ports: SupplierConsolePorts,
  row: SupplierRow | null,
): QualificationCounts => {
  const records = qualificationRecords(row);
  const count = (status: string): number =>
    records.filter((item) => ports.textValue(item.status, '') === status).length;
  return {
    PENDING: pendingItemChoices(ports, row).length,
    APPROVED: count('APPROVED'),
    CONDITIONAL: count('CONDITIONAL'),
    REJECTED: count('REJECTED'),
  };
};

type QualificationKey = keyof QualificationCounts;
const QUALIFICATION_BADGES: readonly (readonly [QualificationKey, string, StatusTone, string])[] = [
  ['APPROVED', '已批准', 'success', '已批准的物料准入'],
  ['CONDITIONAL', '有条件批准', 'info', '有条件批准的物料准入'],
  ['REJECTED', '已驳回', 'danger', '已驳回的物料准入'],
  ['PENDING', '待准入', 'neutral', '已发布物料中尚无该供应商准入记录（派生态）'],
];
const BADGE_ROW_STYLE = {
  display: 'inline-flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '4px',
} as const;

// 四色徽章条：仅呈非零计数；全部为零（无已发布物料且无记录）时呈 —。
export const QualificationBadges = ({
  state,
  row,
  testId,
}: Readonly<{ state: SupplierDetailState; row: SupplierRow; testId: string }>) => {
  const counts = qualificationCounts(state.ports, row);
  const visible = QUALIFICATION_BADGES.filter(([key]) => counts[key] > 0);
  return (
    <span data-testid={testId} data-pending={counts.PENDING} style={BADGE_ROW_STYLE}>
      {visible.length === 0 ? (
        <span class="console-label">—</span>
      ) : (
        visible.map(([key, label, tone, hint]) => (
          <span key={key} title={hint} data-qualification={key} data-count={counts[key]}>
            <StatusBadge tone={tone}>{`${label} ${String(counts[key])}`}</StatusBadge>
          </span>
        ))
      )}
    </span>
  );
};

// 待准入物料清单（前 8 项；其余计数提示）——采购下单前需先完成物料准入审核。
export const PendingQualifications = ({ state }: Readonly<{ state: SupplierDetailState }>) => {
  const row = state.selected;
  if (!row) return null;
  const pending = pendingItemChoices(state.ports, row);
  if (pending.length === 0) return null;
  const shown = pending.slice(0, 8);
  return (
    <div class="console-summary" data-testid="kt-supplier-pending">
      <p class="console-label">{`待准入物料 ${String(pending.length)} 项（已发布物料中尚无该供应商准入记录）`}</p>
      <ul>
        {shown.map((choice) => (
          <li key={choice.value}>{choice.label}</li>
        ))}
      </ul>
      {pending.length > shown.length ? (
        <p class="console-label">{`另有 ${String(pending.length - shown.length)} 项未列出`}</p>
      ) : null}
    </div>
  );
};

// ---- 报价历史与对比 ----

export const QuoteHistory = ({ state }: Readonly<{ state: SupplierDetailState }>) => {
  const row = state.selected;
  if (!row) return null;
  const supplierId = state.ports.textValue(row.id, '');
  const quotes = state.quotes.filter(
    (item) => state.ports.textValue(item.supplierId ?? item.supplier_id, '') === supplierId,
  );
  if (quotes.length === 0) return null;
  return (
    <div class="console-summary" data-testid="kt-supplier-quotes">
      <p class="console-label">报价历史</p>
      <ul>
        {quotes.map((quote, index) => (
          <li key={state.ports.textValue(quote.id, String(index))}>
            <TokenText
              text={`${state.ports.textValue(quote.quoteReference ?? quote.quote_reference, '—')} · 收于 ${state.ports.textValue(quote.receivedAt ?? quote.received_at, '—').slice(0, 10)} · 有效至 ${state.ports.textValue(quote.validUntil ?? quote.valid_until, '—')}`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
};

type QuoteLineRow = Readonly<{
  key: string;
  itemVersionId: string;
  supplierId: string;
  supplierName: string;
  reference: string;
  receivedAt: string;
  validUntil: string;
  expired: boolean;
  unitPrice: number;
  minimumOrderQuantity: unknown;
  promisedAt: string;
}>;

const pad = (value: number): string => String(value).padStart(2, '0');
// UTC 日历日串（与报价有效期 YYYY-MM-DD 文本同口径比较）。
const utcDay = (date: Date): string =>
  `${String(date.getUTCFullYear())}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

// 全量供应商报价行（/api/v1/supplier-quotes 视图）：跨供应商按物料版本（itemVersionId）对比。
const quoteLineRows = (state: SupplierDetailState, now: Date): readonly QuoteLineRow[] =>
  state.quotes.flatMap((quote, quoteIndex) => {
    const { ports } = state;
    const validUntil = ports.textValue(quote.validUntil ?? quote.valid_until, '');
    const head = {
      supplierId: ports.textValue(quote.supplierId ?? quote.supplier_id, ''),
      supplierName: ports.textValue(quote.supplierName ?? quote.supplier_name, '') || '—',
      reference: ports.textValue(quote.quoteReference ?? quote.quote_reference, '—'),
      receivedAt: ports.textValue(quote.receivedAt ?? quote.received_at, ''),
      validUntil,
      expired: validUntil !== '' && validUntil < utcDay(now),
    };
    return list(quote.lines).map((line, lineIndex) => ({
      ...head,
      key: `${String(quoteIndex)}:${String(lineIndex)}`,
      itemVersionId: ports.textValue(line.itemVersionId ?? line.item_version_id, ''),
      unitPrice: Number(line.unitPrice ?? line.unit_price),
      minimumOrderQuantity: line.minimumOrderQuantity ?? line.minimum_order_quantity,
      promisedAt: ports.textValue(line.promisedAt ?? line.promised_at, '—'),
    }));
  });

// 有效报价按单价升序在前，已失效报价按收价时间降序在后。
const byPrice = (left: QuoteLineRow, right: QuoteLineRow): number => {
  if (left.expired !== right.expired) return left.expired ? 1 : -1;
  if (left.expired) return right.receivedAt.localeCompare(left.receivedAt);
  return left.unitPrice - right.unitPrice || left.receivedAt.localeCompare(right.receivedAt);
};

type ComparisonItem = Readonly<{
  itemVersionId: string;
  rows: readonly QuoteLineRow[];
  best: ReadonlySet<string>;
}>;

// 以所选供应商报价过的物料为行：聚合全部供应商对该物料的报价（同一供应商的历史报价并列）。
const comparisonItems = (
  state: SupplierDetailState,
  rows: readonly QuoteLineRow[],
): readonly ComparisonItem[] => {
  const supplierId = state.ports.textValue(state.selected?.id, '');
  const itemIds = [
    ...new Set(
      rows
        .filter((row) => row.supplierId === supplierId && row.itemVersionId !== '')
        .map((row) => row.itemVersionId),
    ),
  ];
  return itemIds.map((itemVersionId) => {
    const sorted = rows.filter((row) => row.itemVersionId === itemVersionId).sort(byPrice);
    const lowest = sorted.find((row) => !row.expired)?.unitPrice;
    return {
      itemVersionId,
      rows: sorted,
      best: new Set(
        sorted.filter((row) => !row.expired && row.unitPrice === lowest).map((row) => row.key),
      ),
    };
  });
};

// 数值呈现：去掉 numeric(24,6) 的尾随零（12.500000 → 12.5；5000.000000 → 5000）。
const decimalText = (ports: SupplierConsolePorts, value: unknown, fallback = '—'): string => {
  const raw = ports.textValue(value, '');
  if (raw === '') return fallback;
  return raw.replace(/(\.\d*?)0+$/u, '$1').replace(/\.$/u, '');
};

// 文字与徽章同排放不下时徽章折到下一行：不折行的话徽章（white-space: nowrap）先占满列宽，
// 抽屉内列宽有限时供应商名被挤成一字一行（TD-PROC-008；真浏览器实测）。
const INLINE_STYLE = {
  display: 'inline-flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '6px',
} as const;

const currentSupplierId = (state: SupplierDetailState): string =>
  state.ports.textValue(state.selected?.id, '');

// 以下四个单元格为矩阵列与堆叠卡片共用（DOM 与文案同源）。
// PROC-3：日期 / 编码 / 金额这类短 token 各自包进 .proc-token（不折行）；分隔符仍是裸文本节点，
// 单元格 textContent 与此前逐字相同，token 之间照常在分隔符处折行。
const SupplierCell = ({
  state,
  row,
}: Readonly<{ state: SupplierDetailState; row: QuoteLineRow }>) => (
  <span style={INLINE_STYLE}>
    {row.supplierName}
    {row.supplierId === currentSupplierId(state) ? (
      <StatusBadge tone="neutral">本供应商</StatusBadge>
    ) : null}
  </span>
);

const PriceCell = ({
  state,
  best,
  row,
}: Readonly<{ state: SupplierDetailState; best: ReadonlySet<string>; row: QuoteLineRow }>) => (
  <span
    style={INLINE_STYLE}
    data-testid="kt-supplier-compare-price"
    data-best={best.has(row.key) ? 'true' : 'false'}
  >
    {best.has(row.key) ? (
      <strong class="proc-token">{decimalText(state.ports, row.unitPrice)}</strong>
    ) : (
      <span class="proc-token">{decimalText(state.ports, row.unitPrice)}</span>
    )}
    {best.has(row.key) ? <StatusBadge tone="success">最优</StatusBadge> : null}
  </span>
);

const termsText = (state: SupplierDetailState, row: QuoteLineRow): string =>
  `MOQ ${decimalText(state.ports, row.minimumOrderQuantity)} · ${row.promisedAt}`;

// 条款：「MOQ 1200」与交期日期是两个 token，在「 · 」处折行，token 自身不断开。
const TermsCell = ({ state, row }: Readonly<{ state: SupplierDetailState; row: QuoteLineRow }>) => (
  <span>
    <TokenText text={termsText(state, row)} />
  </span>
);

const quoteText = (row: QuoteLineRow): string =>
  `${row.reference} · ${row.receivedAt.slice(0, 10)} · ${row.validUntil || '—'}`;

// 报价单：编号、收于、有效至各是一个 token，在「 · 」处折行。外层是 inline-flex（徽章折到
// 下一行），所以文字包成一个行内容器，token 之间才有换行点。
const QuoteCell = ({ row }: Readonly<{ row: QuoteLineRow }>) => (
  <span style={INLINE_STYLE}>
    <span>
      <TokenText text={quoteText(row)} />
    </span>
    {row.expired ? <StatusBadge tone="warning">已失效</StatusBadge> : null}
  </span>
);

const comparisonColumns = (
  state: SupplierDetailState,
  item: ComparisonItem,
  currency: string,
): readonly DataTableColumn<QuoteLineRow>[] => [
  {
    key: 'supplier',
    header: '供应商',
    field: (row) => row.supplierName,
    render: (row) => <SupplierCell state={state} row={row} />,
  },
  {
    key: 'price',
    header: `单价${currency === '' ? '' : `（${currency}）`}`,
    sortable: true,
    field: (row) => row.unitPrice,
    render: (row) => <PriceCell state={state} best={item.best} row={row} />,
  },
  {
    key: 'terms',
    header: 'MOQ · 交期',
    render: (row) => <TermsCell state={state} row={row} />,
  },
  {
    key: 'quote',
    header: '报价单 · 收于 · 有效至',
    render: (row) => <QuoteCell row={row} />,
  },
];

const MAX_COMPARISON_ITEMS = 6;

// 按供应商归并：组内保持既有排序（有效报价单价升序在前、失效报价在后），组序取各组首行次序。
const supplierGroupKey = (row: QuoteLineRow): string =>
  row.supplierId === '' ? row.supplierName : row.supplierId;
const supplierGroups = (rows: readonly QuoteLineRow[]): readonly (readonly QuoteLineRow[])[] => {
  const groups = new Map<string, QuoteLineRow[]>();
  for (const row of rows) {
    const key = supplierGroupKey(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()];
};

// 窄容器下的对比替身：同一物料下每家供应商一张卡，卡内列出该供应商的报价行（价格、
// 条款、报价单与最优/失效标记同矩阵单元格）。
export const SupplierCompareCards = ({
  state,
  item,
}: Readonly<{ state: SupplierDetailState; item: ComparisonItem }>) => {
  const current = currentSupplierId(state);
  return (
    <div class="proc-compare-cards" data-testid="kt-supplier-compare-cards">
      {supplierGroups(item.rows).map((rows) => {
        const head = rows[0];
        if (head === undefined) return null;
        return (
          <article
            key={supplierGroupKey(head)}
            class="proc-quote-card"
            data-testid="kt-supplier-compare-card"
            data-supplier={head.supplierId}
          >
            <header class="proc-quote-card-head">
              <strong>{head.supplierName}</strong>
              {head.supplierId === current ? (
                <StatusBadge tone="neutral">本供应商</StatusBadge>
              ) : null}
            </header>
            <ul class="proc-quote-lines">
              {rows.map((row) => (
                <li key={row.key} class="proc-quote-line" data-testid="kt-supplier-compare-line">
                  <PriceCell state={state} best={item.best} row={row} />
                  <span class="proc-quote-card-meta">{termsText(state, row)}</span>
                  <QuoteCell row={row} />
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
};

// 报价历史对比：每个物料一张表（按单价升序），有效报价中单价最低者高亮「最优」。
// 容器窄（手机抽屉）时改按供应商堆叠的卡片（TD-PROC-008）。
export const QuoteComparison = ({ state }: Readonly<{ state: SupplierDetailState }>) => {
  // hooks 须先于任何早退：本组件经 JSX 渲染，调用顺序必须稳定。
  const [measure, stacked] = useStackedCompare();
  const row = state.selected;
  if (!row) return null;
  const { ports } = state;
  const items = comparisonItems(state, quoteLineRows(state, state.now()));
  if (items.length === 0) return null;
  const shown = items.slice(0, MAX_COMPARISON_ITEMS);
  const currency = ports.recordText(row, 'currency', 'currency', '');
  return (
    <div class="console-summary" data-testid="kt-supplier-compare" ref={measure}>
      <p class="console-label">报价历史对比（同一物料 · 多供应商单价，最优高亮）</p>
      {shown.map((item) => (
        <div
          key={item.itemVersionId}
          data-testid="kt-supplier-compare-item"
          style={{ overflowX: 'auto' }}
        >
          <p class="console-label">
            {ports.itemVersionChoices.find((choice) => choice.value === item.itemVersionId)
              ?.label ?? item.itemVersionId}
          </p>
          {stacked ? (
            <SupplierCompareCards state={state} item={item} />
          ) : (
            /* 作用域类 .proc-compare-matrix：列最小宽度与 token 不折行只作用于本表（PROC-3）。 */
            <div class="proc-compare-matrix">
              <DataTable
                columns={comparisonColumns(state, item, currency)}
                rows={item.rows}
                rowId={(quote) => quote.key}
                caption="同一物料多供应商报价对比"
              />
            </div>
          )}
        </div>
      ))}
      {items.length > shown.length ? (
        <p class="console-label">{`另有 ${String(items.length - shown.length)} 项物料未列出`}</p>
      ) : null}
    </div>
  );
};
