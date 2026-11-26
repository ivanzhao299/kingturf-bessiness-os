import { useEffect, useRef, useState } from 'preact/hooks';
import type { StatusTone } from '@kingturf/ui';
import { isOpportunityOverdue } from '../opportunity-overdue';
import type { Opportunity } from '../types';
import type { OpportunityPageState, PendingMove } from './opportunity-list';
import './commercial-ux.css';

// COM-UX 商机管道视图：按阶段分列的看板（列头数量 + 分币种金额汇总）、卡片按钮/把手
// 拖拽切换阶段。阶段流转目标镜像 packages/domain assertOpportunityTransition（web 不依赖
// domain 包，域规则变更需同步）；移动确认卡渲染在目标列顶部，提交仍走原 transition 端口。
export type PipelineColumnKey = 'OPEN' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'CLOSED';

export type PipelineColumn = Readonly<{
  key: PipelineColumnKey;
  label: string;
  stages: readonly string[];
}>;

export type ColumnSummary = Readonly<{ count: number; amounts: string; masked: number }>;

// dataTransfer 最小结构面：浏览器 DataTransfer 与测试 double 都满足（不依赖 DOM 全量类型）。
type DragTransfer = {
  effectAllowed: string;
  setData: (type: string, data: string) => void;
};

const STAGE_LABELS: readonly (readonly [string, string])[] = [
  ['OPEN', '初步接洽'],
  ['QUALIFIED', '需求确认'],
  ['PROPOSAL', '方案报价'],
  ['WON', '赢单'],
  ['LOST', '输单'],
  ['CANCELLED', '已取消'],
];

// 镜像 domain OPPORTUNITY_TRANSITIONS：首项为顺序推进，其余为关闭出口；终态无目标。
const STAGE_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  OPEN: ['QUALIFIED', 'LOST', 'CANCELLED'],
  QUALIFIED: ['PROPOSAL', 'LOST', 'CANCELLED'],
  PROPOSAL: ['WON', 'LOST', 'CANCELLED'],
};

export const PIPELINE_COLUMNS: readonly PipelineColumn[] = [
  { key: 'OPEN', label: '初步接洽', stages: ['OPEN'] },
  { key: 'QUALIFIED', label: '需求确认', stages: ['QUALIFIED'] },
  { key: 'PROPOSAL', label: '方案报价', stages: ['PROPOSAL'] },
  { key: 'WON', label: '赢单', stages: ['WON'] },
  // 输单/已取消同为终态，并入「已关闭」出口列（卡片内保留各自阶段标记）。
  { key: 'CLOSED', label: '已关闭', stages: ['LOST', 'CANCELLED'] },
];

const statusKey = (status: unknown): string => (typeof status === 'string' ? status : '');

export const stageLabel = (status: unknown): string => {
  const key = statusKey(status);
  return STAGE_LABELS.find(([stage]) => stage === key)?.[1] ?? (key === '' ? '—' : key);
};

export const stageTone = (status: unknown): StatusTone => {
  if (status === 'WON') return 'success';
  if (status === 'LOST') return 'danger';
  if (status === 'PROPOSAL' || status === 'QUALIFIED') return 'info';
  return 'neutral';
};

// 逾期口径收敛到 ../opportunity-overdue（TD-COMX-003：已取消不算逾期）；再导出保持原导入面。
export { isOpportunityOverdue };

export const stageTargets = (status: unknown): readonly string[] =>
  STAGE_TRANSITIONS[statusKey(status)] ?? [];

export const columnKeyOf = (status: unknown): PipelineColumnKey =>
  PIPELINE_COLUMNS.find((column) => column.stages.includes(statusKey(status)))?.key ?? 'OPEN';

// 列的放置目标：在途列 = 该阶段本身，已关闭列 = 输单（主出口）；非法流转返回 null。
export const dropTarget = (status: unknown, columnKey: string): string | null => {
  const stage = columnKey === 'CLOSED' ? 'LOST' : columnKey;
  return stageTargets(status).includes(stage) ? stage : null;
};

type Decimal = Readonly<{ units: bigint; scale: number }>;

const parseDecimal = (value: string): Decimal | null => {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/u.exec(value);
  if (!match) return null;
  const fraction = match[3] ?? '';
  const sign = match[1] === '-' ? -1n : 1n;
  return { units: sign * BigInt(`${match[2] ?? '0'}${fraction}`), scale: fraction.length };
};

// 金额为 numeric(24,6) 的十进制串：按 BigInt 定点求和，避免浮点误差；非法值不计入。
export const sumDecimals = (values: readonly string[]): string => {
  const parsed = values.map(parseDecimal);
  if (parsed.every((item) => item === null)) return '';
  const scale = parsed.reduce((max, item) => Math.max(max, item?.scale ?? 0), 0);
  const total = parsed.reduce(
    (sum, item) => (item === null ? sum : sum + item.units * 10n ** BigInt(scale - item.scale)),
    0n,
  );
  const digits = (total < 0n ? -total : total).toString().padStart(scale + 1, '0');
  const text = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return total < 0n ? `-${text}` : text;
};

export const summarizeColumn = (
  items: readonly Opportunity[],
  displayMoney: (currency: unknown, value: unknown) => string,
): ColumnSummary => {
  const priced = items.flatMap((item) =>
    item.value != null &&
    typeof item.value.amount === 'string' &&
    typeof item.value.currency === 'string'
      ? [{ amount: item.value.amount, currency: item.value.currency }]
      : [],
  );
  const currencies = [...new Set(priced.map((item) => item.currency))];
  const amounts = currencies
    .map((currency) =>
      displayMoney(
        currency,
        sumDecimals(priced.filter((item) => item.currency === currency).map((item) => item.amount)),
      ),
    )
    .join(' · ');
  return { count: items.length, amounts, masked: items.length - priced.length };
};

const GripIcon = () => (
  <svg class="com-card-grip-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <g fill="currentColor">
      <circle cx="5.5" cy="3.5" r="1.5" />
      <circle cx="10.5" cy="3.5" r="1.5" />
      <circle cx="5.5" cy="8" r="1.5" />
      <circle cx="10.5" cy="8" r="1.5" />
      <circle cx="5.5" cy="12.5" r="1.5" />
      <circle cx="10.5" cy="12.5" r="1.5" />
    </g>
  </svg>
);

// 移动确认卡：落在目标列顶部，依据必填；卸载时把焦点还给来源卡片（成功/取消皆然）。
const MoveCard = ({
  state,
  move,
}: Readonly<{ state: OpportunityPageState; move: PendingMove }>) => {
  const [reason, setReason] = useState('');
  const [invalid, setInvalid] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const name = move.opportunity.name ?? move.opportunity.id;
  useEffect(() => {
    textareaRef.current?.focus();
    return () => {
      state.restoreFocus(move.opportunity.id);
    };
  }, []);
  const onSubmit = (event: Event): void => {
    event.preventDefault();
    if (reason.trim() === '') {
      setInvalid(true);
      return;
    }
    void state.confirmMove(reason);
  };
  return (
    <form
      class="com-move"
      data-testid="kt-opportunity-move"
      aria-label="确认移动商机阶段"
      onSubmit={onSubmit}
    >
      <p class="com-move-title">{name}</p>
      <p class="com-move-path">
        <span>{stageLabel(move.opportunity.status)}</span>
        <span aria-hidden="true">→</span>
        <span>{stageLabel(move.target)}</span>
      </p>
      <label class="com-move-label">
        <span>移动依据（必填）</span>
        <textarea
          ref={textareaRef}
          name="reason"
          rows={3}
          required
          aria-required="true"
          aria-invalid={invalid ? 'true' : 'false'}
          value={reason}
          onInput={(event) => {
            setReason((event.target as unknown as { value: string }).value);
            setInvalid(false);
          }}
        />
      </label>
      {invalid ? (
        <p class="com-move-error" role="alert">
          请填写移动依据
        </p>
      ) : null}
      {state.moveError !== '' ? (
        <p class="com-move-error" role="alert">
          {state.moveError}
        </p>
      ) : null}
      <div class="com-move-actions">
        <button type="submit" class="primary compact" disabled={state.loading}>
          确认移动
        </button>
        <button
          type="button"
          class="secondary compact"
          data-testid="kt-opportunity-move-cancel"
          onClick={state.cancelMove}
        >
          取消
        </button>
      </div>
    </form>
  );
};

const StageActions = ({
  state,
  opportunity,
}: Readonly<{ state: OpportunityPageState; opportunity: Opportunity }>) => {
  const [advance, ...closures] = stageTargets(opportunity.status);
  const disabled = state.loading || state.pendingMove !== null;
  return (
    <div class="com-card-actions">
      {advance !== undefined ? (
        <button
          type="button"
          class="secondary compact com-card-advance"
          data-testid="kt-opportunity-advance"
          disabled={disabled}
          onClick={() => {
            state.requestMove(opportunity, advance);
          }}
        >
          {`→ ${stageLabel(advance)}`}
        </button>
      ) : null}
      {closures.map((target) => (
        <button
          key={target}
          type="button"
          class="secondary compact"
          data-testid={target === 'LOST' ? 'kt-opportunity-lose' : 'kt-opportunity-cancel'}
          disabled={disabled}
          onClick={() => {
            state.requestMove(opportunity, target);
          }}
        >
          {target === 'LOST' ? '标记输单' : '标记取消'}
        </button>
      ))}
    </div>
  );
};

const OpportunityCard = ({
  state,
  opportunity,
}: Readonly<{ state: OpportunityPageState; opportunity: Opportunity }>) => {
  const nameRef = useRef<HTMLButtonElement | null>(null);
  const focusRequested = state.focusTarget === opportunity.id;
  useEffect(() => {
    if (!focusRequested) return;
    nameRef.current?.focus();
    state.clearFocusTarget();
  }, [focusRequested]);

  const stage = statusKey(opportunity.status);
  const targets = stageTargets(stage);
  const movable = targets.length > 0 && state.permissions.has('opportunity:lifecycle');
  const waiting = state.pendingMove?.opportunity.id === opportunity.id;
  const dragging = state.dragging === opportunity.id;
  const overdue = isOpportunityOverdue(opportunity, state.today);
  const customer = state.customers.find((item) => item.id === opportunity.customerId);
  const name = opportunity.name ?? opportunity.id;
  const onDragStart = (event: Event): void => {
    if (!state.beginDrag(opportunity)) {
      event.preventDefault();
      return;
    }
    const transfer = (event as unknown as { dataTransfer: DragTransfer | null }).dataTransfer;
    if (transfer) {
      transfer.effectAllowed = 'move';
      transfer.setData('text/plain', opportunity.id);
    }
  };
  return (
    <article
      class={`com-card${dragging ? ' is-dragging' : ''}${waiting ? ' is-waiting' : ''}`}
      data-testid="kt-opportunity-card"
      data-opportunity-id={opportunity.id}
      data-stage={stage}
      draggable={movable && !waiting}
      onDragStart={onDragStart}
      onDragEnd={state.endDrag}
    >
      <div class="com-card-head">
        {movable ? (
          <span
            class="com-card-grip"
            data-testid="kt-opportunity-grip"
            aria-hidden="true"
            title="拖动卡片切换阶段"
            onMouseDown={(event) => {
              event.stopPropagation();
              state.armDrag(opportunity.id);
            }}
          >
            <GripIcon />
          </span>
        ) : null}
        <button
          ref={nameRef}
          type="button"
          class="com-card-name"
          data-testid="kt-opportunity-open"
          onClick={() => {
            state.open(opportunity);
          }}
        >
          {name}
        </button>
      </div>
      {columnKeyOf(stage) === 'CLOSED' ? (
        <p class="com-card-tags">
          <span class="com-tag" data-tone={stage === 'LOST' ? 'danger' : 'neutral'}>
            {stageLabel(stage)}
          </span>
        </p>
      ) : null}
      <p class="com-card-meta">
        {customer?.name ?? (opportunity.customerId ? '关联客户' : '未关联客户')} · 赢率{' '}
        {String((opportunity.probabilityBasisPoints ?? 0) / 100)}%
      </p>
      <p class="com-card-money">
        {opportunity.value
          ? state.displayMoney(opportunity.value.currency, opportunity.value.amount)
          : '金额受限'}
      </p>
      <p class="com-card-date" data-overdue={overdue ? 'true' : 'false'}>
        {'预计成交 '}
        {opportunity.expectedCloseDate?.slice(0, 10) ?? '日期未定'}
        {overdue ? (
          <em class="com-tag" data-tone="danger">
            成交日期已逾期
          </em>
        ) : null}
      </p>
      {movable ? <StageActions state={state} opportunity={opportunity} /> : null}
    </article>
  );
};

const PipelineColumn = ({
  state,
  column,
}: Readonly<{ state: OpportunityPageState; column: PipelineColumn }>) => {
  const bodyRef = useRef<HTMLElement | null>(null);
  const items = state.items.filter((item) => columnKeyOf(item.status) === column.key);
  const summary = summarizeColumn(items, state.displayMoney);
  const accepting = state.dragging !== '' && state.acceptsDrop(column.key);
  const move =
    state.pendingMove !== null && columnKeyOf(state.pendingMove.target) === column.key
      ? state.pendingMove
      : null;
  const headingId = `kt-opportunity-column-${column.key.toLowerCase()}`;
  return (
    <section
      ref={bodyRef}
      class="com-pipeline-column"
      data-testid="kt-opportunity-column"
      data-stage={column.key}
      data-count={String(summary.count)}
      data-over={state.over === column.key ? 'true' : 'false'}
      aria-labelledby={headingId}
      onDragOver={(event) => {
        if (!state.acceptsDrop(column.key)) return;
        event.preventDefault();
        state.hoverColumn(column.key);
      }}
      onDragLeave={(event) => {
        const next = (event as DragEvent).relatedTarget as Node | null;
        if (next !== null && bodyRef.current?.contains(next) === true) return;
        state.leaveColumn();
      }}
      onDrop={(event) => {
        if (!state.acceptsDrop(column.key)) return;
        event.preventDefault();
        state.dropOn(column.key);
      }}
    >
      <header class="com-pipeline-head">
        <h2 class="com-pipeline-title" id={headingId}>
          <span>{column.label}</span>
          <span class="com-pipeline-count">
            <span class="com-visually-hidden">商机数 </span>
            {String(summary.count)}
          </span>
        </h2>
        <p class="com-pipeline-amount">
          {summary.amounts === ''
            ? summary.count === 0
              ? '暂无金额'
              : '金额受限'
            : summary.amounts}
          {summary.masked > 0 && summary.amounts !== '' ? (
            <span class="com-pipeline-masked">{`${String(summary.masked)} 笔金额受限`}</span>
          ) : null}
        </p>
      </header>
      {move ? <MoveCard state={state} move={move} /> : null}
      <div class="com-pipeline-cards">
        {items.map((item) => (
          <OpportunityCard key={item.id} state={state} opportunity={item} />
        ))}
        {items.length === 0 && move === null ? (
          <p class="com-pipeline-empty">{accepting ? '拖到这里放置' : '暂无商机'}</p>
        ) : null}
      </div>
    </section>
  );
};

export const PipelineBoard = ({ state }: Readonly<{ state: OpportunityPageState }>) => (
  <div
    class="com-pipeline"
    data-testid="kt-opportunity-pipeline"
    aria-busy={state.loading ? 'true' : 'false'}
  >
    {PIPELINE_COLUMNS.map((column) => (
      <PipelineColumn key={column.key} state={state} column={column} />
    ))}
  </div>
);
