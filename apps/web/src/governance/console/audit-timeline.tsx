import { EmptyState, StatusBadge } from '@kingturf/ui';
import { textOf, type ConsoleRow } from './ports';

// GOV-UX ③ 审计时间线视图：按本地日历日分组的事件流（默认视图；表格视图可切回，CSV
// 导出沿用当前筛选结果不变）。分组/标签为纯函数，便于行为测试。
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;
const UNKNOWN = '时间未知';

export type TimelineGroup = Readonly<{
  /** 降序排序键（本地日历日 YYYY-MM-DD；无法解析的时间为空串，排在最后）。 */
  key: string;
  label: string;
  count: number;
  items: readonly ConsoleRow[];
}>;

const pad = (value: number): string => String(value).padStart(2, '0');

const parse = (value: unknown): Date | null => {
  const date = new Date(textOf(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const dayKey = (date: Date): string =>
  `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const dayLabel = (date: Date, now: Date): string => {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const relative =
    dayKey(date) === dayKey(now) ? '今天 · ' : dayKey(date) === dayKey(yesterday) ? '昨天 · ' : '';
  return `${relative}${String(date.getFullYear())}年${String(date.getMonth() + 1)}月${String(date.getDate())}日 ${WEEKDAYS[date.getDay()] ?? ''}`;
};

const timeLabel = (value: unknown): string => {
  const date = parse(value);
  return date ? `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` : '—';
};

export const groupAuditByDay = (
  rows: readonly ConsoleRow[],
  now: Date = new Date(),
): readonly TimelineGroup[] => {
  const groups = new Map<string, { label: string; items: ConsoleRow[] }>();
  for (const row of rows) {
    const date = parse(row.occurredAt);
    const key = date ? dayKey(date) : '';
    const group = groups.get(key);
    if (group) group.items.push(row);
    else groups.set(key, { label: date ? dayLabel(date, now) : UNKNOWN, items: [row] });
  }
  const byKeyDesc = ([left]: [string, unknown], [right]: [string, unknown]): number =>
    left < right ? 1 : left > right ? -1 : 0;
  return [...groups.entries()].sort(byKeyDesc).map(([key, group]) => ({
    key,
    label: group.label,
    count: group.items.length,
    items: group.items,
  }));
};

const outcomeOf = (row: ConsoleRow): 'SUCCESS' | 'FAILURE' =>
  row.outcome === 'SUCCESS' ? 'SUCCESS' : 'FAILURE';

const TimelineItem = ({ row }: Readonly<{ row: ConsoleRow }>) => {
  const outcome = outcomeOf(row);
  return (
    <li class="audit-timeline-item" data-outcome={outcome} data-testid="kt-audit-event">
      <time class="audit-timeline-time" dateTime={textOf(row.occurredAt)}>
        {timeLabel(row.occurredAt)}
      </time>
      <StatusBadge tone={outcome === 'SUCCESS' ? 'success' : 'danger'}>
        {outcome === 'SUCCESS' ? '成功' : '失败'}
      </StatusBadge>
      <span class="audit-timeline-action">{textOf(row.action, '—')}</span>
      <span class="audit-timeline-target">
        {textOf(row.targetType, '—')} · {textOf(row.targetId, '—')}
      </span>
      <span class="audit-timeline-meta">
        人员 {textOf(row.actorId, '—')} · 关联 {textOf(row.correlationId, '—')}
      </span>
    </li>
  );
};

export type TimelineProps = Readonly<{
  groups: readonly TimelineGroup[];
  loadedCount: number;
  hasMore: boolean;
  loading: boolean;
  error: string;
  onLoadMore: () => void;
}>;

// 时间线三态与分页页脚沿用 DataTable 的 class 语义（data-table-error/loading/footer），
// 使两种视图在错/载/空与「继续加载」上保持一致交互。
export const AuditTimeline = (props: TimelineProps) => (
  <div class="audit-timeline" data-testid="kt-audit-timeline">
    {props.error !== '' ? (
      <p class="data-table-error" role="alert">
        {props.error}
      </p>
    ) : null}
    {props.error === '' && props.loading ? (
      <p class="data-table-loading" role="status">
        正在加载…
      </p>
    ) : null}
    {props.error === '' && !props.loading && props.groups.length === 0 ? (
      <EmptyState title="无匹配审计事件" description="调整筛选条件后重新查询" />
    ) : null}
    {props.groups.map((group) => (
      <section
        class="audit-timeline-day"
        data-testid="kt-audit-day"
        data-day={group.key}
        key={group.key}
      >
        <h3 class="audit-timeline-day-label">
          {group.label}
          <span class="audit-timeline-count">{String(group.count)} 条</span>
        </h3>
        <ol class="audit-timeline-list">
          {group.items.map((row, index) => (
            <TimelineItem key={`${group.key}-${String(index)}`} row={row} />
          ))}
        </ol>
      </section>
    ))}
    <div class="data-table-footer">
      <span class="table-footnote">已加载 {String(props.loadedCount)} 条记录</span>
      {props.hasMore ? (
        <button
          type="button"
          class="secondary compact"
          disabled={props.loading}
          onClick={() => {
            props.onLoadMore();
          }}
        >
          {props.loading ? '加载中…' : '继续加载'}
        </button>
      ) : null}
    </div>
  </div>
);
