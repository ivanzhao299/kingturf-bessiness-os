// PROC-UX：收货控制台详情子组件（自 gr-console 拆分——G1/G5 ≤800/≤200 行纪律）：
// 批次行项/数量核对（U3-PROC-4 等价迁移）+ 批次追踪时间线（收货→质检→入库）。时间线
// 由批次追踪事实面（TraceSources，经既有质检查询/追溯/库存视图端点读取）在客户端组合
// ——可见性分层由端点权限门控决定（无权限→null→「无查看权限」）；跨仓服务端编排属
// service-boundary S3 禁区（TD-PROC-006），故不做 API 侧 additive trace。
// 只依赖状态最小面，结构与 gr-console 的 GrPageState 兼容（结构化子集，无循环依赖）。
import { StatusBadge, type StatusTone } from '@kingturf/ui';
import type { GoodsReceiptConsolePorts, GoodsReceiptRow, TraceSources } from './gr-ports';

export type GrDetailState = Readonly<{
  selected: GoodsReceiptRow | null;
  trace: Trace | null;
  ports: GoodsReceiptConsolePorts;
}>;

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const str = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export const linesOf = (row: GoodsReceiptRow | null): readonly Record<string, unknown>[] =>
  row && Array.isArray(row.lines) ? (row.lines as Record<string, unknown>[]) : [];

const poOf = (row: GoodsReceiptRow | null): Record<string, unknown> | null => {
  const po = row?.purchaseOrder;
  return typeof po === 'object' && po !== null ? (po as Record<string, unknown>) : null;
};

export const ReceiptLines = ({ state }: Readonly<{ state: GrDetailState }>) => {
  const row = state.selected;
  if (!row) return null;
  const lines = linesOf(row);
  if (lines.length === 0)
    return (
      <p class="console-label" data-testid="kt-gr-lines-empty">
        尚无收货行项
      </p>
    );
  return (
    <ul class="console-summary" data-testid="kt-gr-lines">
      {lines.map((line, index) => (
        <li key={state.ports.textValue(line.id, String(index))}>
          {`${state.ports.textValue(line.sku, '—')} · 批次 ${state.ports.textValue(line.lotNumber ?? line.lot_number, '—')} · 库位 ${state.ports.textValue(line.locationCode ?? line.location_code, '—')} · 实收 ${state.ports.textValue(line.quantity, '—')}`}
        </li>
      ))}
    </ul>
  );
};

// 数量核对：关联采购单行项 订购数量 vs 已收数量（additive 详情 purchaseOrder 区）。
export const QuantityCheck = ({ state }: Readonly<{ state: GrDetailState }>) => {
  const row = state.selected;
  if (!row) return null;
  const po = poOf(row);
  if (!po) return null;
  const lines = Array.isArray(po.lines) ? (po.lines as Record<string, unknown>[]) : [];
  return (
    <div class="console-summary" data-testid="kt-gr-quantity-check">
      <p class="console-label">
        {`数量核对 · ${state.ports.textValue(po.poNumber ?? po.po_number, '—')} · ${state.ports.textValue(po.status, '—')}`}
      </p>
      <ul>
        {lines.map((line, index) => (
          <li key={state.ports.textValue(line.id, String(index))}>
            {`${state.ports.textValue(line.sku, '—')} · 订购 ${state.ports.textValue(line.quantity, '—')} · 已收 ${state.ports.textValue(line.receivedQuantity ?? line.received_quantity, '0')}`}
          </li>
        ))}
      </ul>
    </div>
  );
};

// ---- 批次追踪时间线 ----

// 语义红徽章：与 @kingturf/ui StatusBadge 同形（class/data-tone='danger'）；danger 追加 token
// 内联回退——components.css 仅有 data-tone='error' 规则、无 'danger'（落回 neutral 灰），
// 登记 TD-PROC-004；packages/ui 补规则后本回退可删。
const DANGER_BADGE_STYLE = {
  background: 'var(--kt-color-danger-soft)',
  color: 'var(--kt-color-danger)',
} as const;
const RedBadge = ({ children }: Readonly<{ children: string }>) => (
  <span class="status-badge" data-tone="danger" style={DANGER_BADGE_STYLE}>
    {children}
  </span>
);

type NodeKey = 'receipt' | 'inspection' | 'stockIn';
type TraceAccess = Readonly<{ inspection: boolean; disposition: boolean; inventory: boolean }>;
type TraceNode = Readonly<{
  key: NodeKey;
  state: string;
  at: string | null;
  by: string | null;
  detail: Readonly<Record<string, unknown>>;
}>;
type TraceLot = Readonly<{ lot: Record<string, unknown>; nodes: readonly TraceNode[] }>;
type Trace = Readonly<{ access: TraceAccess; lots: readonly TraceLot[] }>;
type NodeView = Readonly<{
  key: NodeKey;
  title: string;
  state: string;
  stateLabel: string;
  tone: StatusTone | 'danger';
  at: string | null;
  by: string | null;
  result: string;
  timeHint: string;
}>;

const NODE_KEYS: readonly NodeKey[] = ['receipt', 'inspection', 'stockIn'];
const NODE_TITLES: Readonly<Record<NodeKey, string>> = {
  receipt: '收货',
  inspection: '质检',
  stockIn: '入库',
};
const NODE_TESTIDS: Readonly<Record<NodeKey, string>> = {
  receipt: 'kt-gr-trace-receipt',
  inspection: 'kt-gr-trace-inspection',
  stockIn: 'kt-gr-trace-stock-in',
};
const INSPECTION_STATE_LABELS: Readonly<Record<string, string>> = {
  OPEN: '已开检',
  SAMPLED: '已抽样',
  COMPLETED: '检验完成',
  DISPOSITIONED: '已处置',
  CANCELLED: '已取消',
  QUARANTINE: '批次隔离中',
};
// 仅状态可见（inventory:read）时的统一提示：时间与操作人属质检/追溯事实面。
const LIMITED_HINT = '时间与操作人需质检查看权限';

const eventAt = (event: Record<string, unknown> | undefined): string | null => {
  const raw = str(event?.created_at ?? event?.occurred_at);
  return raw === '' ? null : raw;
};
const findInspection = (
  inspections: readonly Record<string, unknown>[],
  lotId: string,
): Record<string, unknown> | undefined =>
  inspections.find((inspection) => str(inspection.lot_id ?? inspection.lotId) === lotId);

const inspectionNode = (sources: TraceSources, lotId: string): TraceNode => {
  // 分层递进（与 stockIn 一致）：质检面检验单 → 追溯面质量事件 → 库存面有效状态；
  // 三面全不可见才呈 UNAVAILABLE，可见但无记录才呈 NONE。
  if (sources.inspections === null) {
    if (sources.lots !== null) {
      const lot = sources.lots.find((entry) => str(entry.lotId ?? entry.lot_id) === lotId);
      const events = Array.isArray(lot?.qualityEvents)
        ? (lot.qualityEvents as Record<string, unknown>[])
        : [];
      const opened = events[0];
      if (opened !== undefined)
        return {
          key: 'inspection',
          state: str(events[events.length - 1]?.state) === 'QUARANTINE' ? 'PENDING' : 'DONE',
          at: eventAt(opened),
          by: null,
          detail: { inspectionState: 'QUARANTINE', actorId: str(opened.actor_id) },
        };
      return statusNode('inspection', str(lot?.qualityStatus));
    }
    if (sources.balances !== null) {
      const balance = sources.balances.find((entry) => str(entry.lotId ?? entry.lot_id) === lotId);
      return statusNode('inspection', str(balance?.qualityStatus));
    }
    return nodeOf('inspection', 'UNAVAILABLE');
  }
  const inspection = findInspection(sources.inspections, lotId);
  if (inspection === undefined) return nodeOf('inspection', 'NONE');
  const events = Array.isArray(inspection.events)
    ? (inspection.events as Record<string, unknown>[])
    : [];
  const latest = events[events.length - 1];
  const results = Array.isArray(inspection.results)
    ? (inspection.results as Record<string, unknown>[])
    : [];
  const inspectionState = str(inspection.state);
  return {
    key: 'inspection',
    state: inspectionState === 'DISPOSITIONED' ? 'DONE' : 'PENDING',
    at: eventAt(latest),
    by: null,
    detail: {
      inspectionNumber: str(inspection.inspection_number ?? inspection.inspectionNumber),
      inspectionState,
      passed: results.filter((result) => result.passed === true).length,
      total: results.length,
      actorId: str(latest === undefined ? '' : latest.actor_id),
    },
  };
};

const statusNode = (key: NodeKey, status: string): TraceNode => {
  if (status === 'RELEASED') return nodeOf(key, 'DONE');
  if (status === 'REJECTED') return nodeOf(key, 'REJECTED');
  return nodeOf(key, 'PENDING');
};

const stockInNode = (sources: TraceSources, lotId: string): TraceNode => {
  // 分层递进：批次质量事件（追溯面，带时间与处置人）→ 检验处置事件（质检面）→
  // 有效质量状态（库存面，仅状态）。
  if (sources.lots !== null) {
    const lot = sources.lots.find((entry) => str(entry.lotId ?? entry.lot_id) === lotId);
    const events = Array.isArray(lot?.qualityEvents)
      ? (lot.qualityEvents as Record<string, unknown>[])
      : [];
    const latest = events[events.length - 1];
    if (latest !== undefined) {
      const state = str(latest.state);
      return {
        key: 'stockIn',
        state: state === 'RELEASED' ? 'DONE' : state === 'REJECTED' ? 'REJECTED' : 'PENDING',
        at: eventAt(latest),
        by: null,
        detail: { reason: str(latest.reason), actorId: str(latest.actor_id) },
      };
    }
    return statusNode('stockIn', str(lot?.qualityStatus));
  }
  if (sources.inspections !== null) {
    const inspection = findInspection(sources.inspections, lotId);
    const rawEvents = inspection === undefined ? undefined : inspection.events;
    const events = Array.isArray(rawEvents) ? (rawEvents as Record<string, unknown>[]) : [];
    const latest = events[events.length - 1];
    const outcome = str(latest === undefined ? {} : record(latest.evidence).state);
    if (inspection !== undefined && str(inspection.state) === 'DISPOSITIONED') {
      return {
        key: 'stockIn',
        state: outcome === 'RELEASED' ? 'DONE' : outcome === 'REJECTED' ? 'REJECTED' : 'PENDING',
        at: eventAt(latest),
        by: null,
        detail: {
          ...(outcome === 'REJECTED'
            ? { reason: str(latest === undefined ? '' : latest.reason) }
            : {}),
          actorId: str(latest === undefined ? '' : latest.actor_id),
        },
      };
    }
    if (inspection !== undefined) return nodeOf('stockIn', 'PENDING', eventAt(latest));
    return nodeOf('stockIn', 'NONE');
  }
  if (sources.balances !== null) {
    const balance = sources.balances.find((entry) => str(entry.lotId ?? entry.lot_id) === lotId);
    return statusNode('stockIn', str(balance?.qualityStatus));
  }
  return nodeOf('stockIn', 'UNAVAILABLE');
};

const nodeOf = (
  key: NodeKey,
  state: string,
  at: string | null = null,
  detail: Readonly<Record<string, unknown>> = {},
): TraceNode => ({ key, state, at, by: null, detail });

const traceOf = (row: GoodsReceiptRow | null, sources: TraceSources | null): Trace | null => {
  if (row === null || sources === null) return null;
  const receivedAt = str(row.receivedAt ?? row.received_at);
  const lots = linesOf(row)
    .map((line) => ({
      line,
      lotId: str(line.lot_id ?? line.lotId),
    }))
    .filter((entry) => entry.lotId !== '');
  if (lots.length === 0) return null;
  const access: TraceAccess = {
    inspection: sources.inspections !== null,
    disposition: sources.lots !== null,
    inventory: sources.balances !== null,
  };
  return {
    access,
    lots: lots.map(({ line, lotId }) => ({
      lot: {
        lotId,
        lotNumber: str(line.lotNumber ?? line.lot_number),
        sku: str(line.sku),
        quantity: str(line.quantity),
        locationCode: str(line.locationCode ?? line.location_code),
      },
      nodes: NODE_KEYS.map((key) => {
        if (key === 'receipt')
          return {
            key,
            state: 'DONE',
            at: receivedAt === '' ? null : receivedAt,
            by: null,
            detail: {
              quantity: str(line.quantity),
              locationCode: str(line.locationCode ?? line.location_code),
              sourceReference: str(row.sourceReference ?? row.source_reference),
              actorId: str(row.createdBy ?? row.created_by),
            },
          };
        if (key === 'inspection') return inspectionNode(sources, lotId);
        return stockInNode(sources, lotId);
      }),
    })),
  };
};

// 客户端组合批次追踪事实面：仅当批次行项与事实面读取结果齐备时返回（否则不渲染）。
export const buildLotTrace = (
  row: GoodsReceiptRow | null,
  sources: TraceSources | null,
): Trace | null => traceOf(row, sources);

const pad = (value: number): string => String(value).padStart(2, '0');
// 本地时区「YYYY-MM-DD HH:mm」；不可解析时原样呈现。
const formatAt = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const viewOf = (
  node: TraceNode,
  state: string,
  stateLabel: string,
  tone: StatusTone | 'danger',
  result: string,
  timeHint = LIMITED_HINT,
): NodeView => ({
  key: node.key,
  title: NODE_TITLES[node.key],
  state,
  stateLabel,
  tone,
  at: node.at,
  by: node.by,
  result,
  timeHint,
});

const inspectionView = (node: TraceNode): NodeView => {
  const number = str(node.detail.inspectionNumber);
  const inspectionState = str(node.detail.inspectionState);
  if (node.state === 'UNAVAILABLE')
    return viewOf(node, node.state, '无查看权限', 'neutral', '', '需质检查看权限');
  if (node.state === 'NONE') return viewOf(node, node.state, '未开检', 'neutral', '', '尚无检验单');
  if (node.state === 'PENDING')
    return viewOf(
      node,
      node.state,
      '进行中',
      'info',
      [number, INSPECTION_STATE_LABELS[inspectionState] ?? inspectionState]
        .filter((part) => part !== '')
        .join(' · '),
    );
  return viewOf(
    node,
    'DONE',
    '已完成',
    'success',
    number === ''
      ? '批次隔离已解除'
      : `${number} · 合格 ${str(node.detail.passed)}/${str(node.detail.total)} 项`,
  );
};

const stockInView = (node: TraceNode): NodeView => {
  if (node.state === 'REJECTED')
    return viewOf(
      node,
      node.state,
      '已拒收',
      'danger',
      ['拒收不入库', str(node.detail.reason)].filter((part) => part !== '').join(' · '),
    );
  if (node.state === 'DONE') return viewOf(node, node.state, '已完成', 'success', '已放行入库');
  if (node.state === 'PENDING')
    return viewOf(node, node.state, '待放行', 'info', '待质检放行后入库');
  return viewOf(node, 'UNAVAILABLE', '无查看权限', 'neutral', '', '需质检查看权限');
};

const nodeView = (node: TraceNode): NodeView => {
  if (node.key === 'inspection') return inspectionView(node);
  if (node.key === 'stockIn') return stockInView(node);
  const source = str(node.detail.sourceReference);
  return viewOf(
    node,
    'DONE',
    '已完成',
    'success',
    `实收 ${str(node.detail.quantity) || '—'} @ ${str(node.detail.locationCode) || '—'}${source === '' ? '' : ` · 送货单 ${source}`}`,
    '',
  );
};

const TraceNodeItem = ({ view }: Readonly<{ view: NodeView }>) => (
  <article class="timeline-item" data-testid={NODE_TESTIDS[view.key]} data-state={view.state}>
    <p>
      <strong>{view.title}</strong>
      {view.tone === 'danger' ? (
        <RedBadge>{view.stateLabel}</RedBadge>
      ) : (
        <StatusBadge tone={view.tone}>{view.stateLabel}</StatusBadge>
      )}
      {view.result === '' ? null : <span>{view.result}</span>}
    </p>
    <p>
      {view.at === null ? (
        <span class="console-label">{view.timeHint}</span>
      ) : (
        <>
          <time datetime={view.at}>{formatAt(view.at)}</time>
          <span>{`操作人 ${view.by ?? '—'}`}</span>
        </>
      )}
    </p>
  </article>
);

// 批次追踪时间线：每个批次一行（收货 → 质检 → 入库），节点显示状态/时间/操作人/结果。
// 事实面未读取（sources 缺省）或无批次行项时不渲染。
export const BatchTimeline = ({ state }: Readonly<{ state: GrDetailState }>) => {
  const trace = state.trace;
  if (trace === null || trace.lots.length === 0) return null;
  return (
    <div class="console-summary" data-testid="kt-gr-trace">
      <p class="console-label">批次追踪 · 收货 → 质检 → 入库</p>
      {trace.lots.map((item, index) => (
        <div
          key={str(item.lot.lotId) || String(index)}
          data-testid="kt-gr-trace-lot"
          data-access={
            trace.access.inspection || trace.access.disposition
              ? 'full'
              : trace.access.inventory
                ? 'status'
                : 'receipt'
          }
        >
          <p>
            <span class="console-label">{`批次 ${str(item.lot.lotNumber) || '—'}`}</span>
            {`${str(item.lot.sku)} · 实收 ${str(item.lot.quantity) || '—'} @ ${str(item.lot.locationCode) || '—'}`}
          </p>
          {item.nodes.map((node) => (
            <TraceNodeItem key={node.key} view={nodeView(node)} />
          ))}
        </div>
      ))}
    </div>
  );
};
