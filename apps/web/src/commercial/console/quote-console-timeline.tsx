import { StatusBadge, type StatusTone } from '@kingturf/ui';
import type { QuotePageState } from './quote-console';
import type { QuoteRow } from './quote-ports';
import './commercial-ux.css';

// COM-UX 报价版本时间线 + 毛利可视化。数据全部来自既有报价快照（同一 quoteId 的修订行、
// 其绑定的政策版本）；阈值口径：红线 = 报价所绑定政策版本的 minimumMarginBasisPoints，
// 预警线 = 红线 + 观察带；政策版本不可解析时回退默认红线并在界面上如实标注「默认」。
export const DEFAULT_MINIMUM_MARGIN_BASIS_POINTS = 2000;
// 观察带：红线之上该幅度内视为「贴近红线」（展示口径，非政策规则）。
export const MARGIN_WATCH_BAND_BASIS_POINTS = 500;
// 仪表条刻度上限：固定刻度让列表内各行毛利率条可直接横向比较。
export const MARGIN_SCALE_MAX_BASIS_POINTS = 5000;

export const STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: '草稿',
  PENDING_APPROVAL: '待审批',
  APPROVED: '已批准',
  ISSUED: '已签发',
  EXPIRED: '已过期',
  REJECTED: '已拒绝',
};

export const statusTone = (status: unknown): StatusTone => {
  if (status === 'ISSUED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'PENDING_APPROVAL') return 'warning';
  if (status === 'APPROVED' || status === 'DRAFT') return 'info';
  return 'neutral';
};

export type MarginBand = 'below' | 'watch' | 'healthy';

export type MarginThresholds = Readonly<{
  minimum: number;
  watch: number;
  /** true = 取自报价绑定政策；false = 回退默认红线。 */
  fromPolicy: boolean;
}>;

export const MARGIN_BAND_LABELS: Readonly<Record<MarginBand, string>> = {
  below: '低于红线',
  watch: '贴近红线',
  healthy: '毛利健康',
};

const recordOf = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

export const numberOf = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const percent = (basisPoints: number): string => `${String(Math.round(basisPoints) / 100)}%`;

export const marginThresholds = (minimum: number | null): MarginThresholds => {
  const base = minimum ?? DEFAULT_MINIMUM_MARGIN_BASIS_POINTS;
  return {
    minimum: base,
    watch: base + MARGIN_WATCH_BAND_BASIS_POINTS,
    fromPolicy: minimum !== null,
  };
};

export const marginBand = (rate: number, thresholds: MarginThresholds): MarginBand =>
  rate < thresholds.minimum ? 'below' : rate < thresholds.watch ? 'watch' : 'healthy';

// 报价绑定的政策版本里的最低毛利（基点）；未绑定或版本不在快照内返回 null。
export const policyMinimumMargin = (
  quote: QuoteRow,
  policies: readonly QuoteRow[],
): number | null => {
  const policyId = typeof quote.policyVersionId === 'string' ? quote.policyVersionId : '';
  const policy = policies.find((item) => item.id === policyId);
  const rules = Array.isArray(policy?.rules) ? policy.rules : [];
  for (const rule of rules) {
    const minimum = numberOf(recordOf(recordOf(rule).effect).minimumMarginBasisPoints);
    if (minimum !== null) return minimum;
  }
  return null;
};

export const quoteMarginRate = (quote: QuoteRow): number | null =>
  numberOf(quote.marginBasisPoints);

// 单条报价的阈值：取自其绑定政策版本，不可解析时回退默认红线。
export const quoteThresholds = (quote: QuoteRow, policies: readonly QuoteRow[]): MarginThresholds =>
  marginThresholds(policyMinimumMargin(quote, policies));

const signed = (value: number, digits: number, suffix: string): string =>
  `${value > 0 ? '+' : ''}${value.toFixed(digits)}${suffix}`;

const meterLabel = (rate: number | null, thresholds: MarginThresholds): string => {
  if (rate === null) return '毛利率不可见';
  const band = MARGIN_BAND_LABELS[marginBand(rate, thresholds)];
  return `毛利率 ${percent(rate)}，${band}（红线 ${percent(thresholds.minimum)}）`;
};

// 毛利率仪表条：填充长度 = 毛利率 / 刻度上限，颜色随分带；刻度线标出红线与预警线。
// role=img + aria-label 给出数值与结论（图表的文字替代）。
export const MarginMeter = ({
  rate,
  thresholds,
  compact = false,
}: Readonly<{
  rate: number | null;
  thresholds: MarginThresholds;
  compact?: boolean;
}>) => {
  const band = rate === null ? 'unknown' : marginBand(rate, thresholds);
  const fill =
    rate === null ? 0 : Math.min(100, Math.max(0, (rate / MARGIN_SCALE_MAX_BASIS_POINTS) * 100));
  const at = (basisPoints: number): number =>
    Math.min(100, (basisPoints / MARGIN_SCALE_MAX_BASIS_POINTS) * 100);
  const label = meterLabel(rate, thresholds);
  return (
    <div
      class={`com-meter${compact ? ' is-compact' : ''}`}
      data-testid="kt-quote-margin"
      data-band={band}
      data-rate={rate === null ? '' : String(rate)}
      role="img"
      aria-label={label}
      title={label}
    >
      <div class="com-meter-track" aria-hidden="true">
        <span class="com-meter-fill" style={{ width: `${String(fill)}%` }} />
        <span
          class="com-meter-tick is-minimum"
          style={{ left: `${String(at(thresholds.minimum))}%` }}
        />
        <span
          class="com-meter-tick is-watch"
          style={{ left: `${String(at(thresholds.watch))}%` }}
        />
      </div>
      {compact ? null : (
        <p class="com-meter-caption">
          <strong>{rate === null ? '—' : percent(rate)}</strong>
          <span class="com-tag" data-tone={band}>
            {rate === null ? '不可见' : MARGIN_BAND_LABELS[marginBand(rate, thresholds)]}
          </span>
          <span class="com-meter-legend">{`红线 ${percent(thresholds.minimum)}${
            thresholds.fromPolicy ? '' : '（默认）'
          } · 预警 ${percent(thresholds.watch)}`}</span>
        </p>
      )}
    </div>
  );
};

type VersionBase = Readonly<{
  quote: QuoteRow;
  revision: string;
  status: string;
  date: string;
  margin: string;
  rate: number | null;
}>;

// 版本日期取修订行上可得的最晚业务时点：签发时间 > 最近一次审批时间 > 未签发。
const versionDate = (quote: QuoteRow): string => {
  const issued = typeof quote.issuedAt === 'string' ? quote.issuedAt : '';
  if (issued !== '') return `签发 ${issued.slice(0, 10)}`;
  const approvals = Array.isArray(quote.approvals) ? quote.approvals : [];
  const decided = approvals
    .map((item) => {
      const decided = recordOf(item).decided_at;
      return typeof decided === 'string' ? decided : '';
    })
    .filter(Boolean)
    .sort()
    .at(-1);
  return decided ? `审批 ${decided.slice(0, 10)}` : '未签发';
};

// 较上一版的差额：总额变化百分比 + 毛利率变化（百分点）；任一缺失则不给结论。
// 返回逐条差额（各自成行，避免在词中断行）；首版由调用方标注。
const versionDelta = (previous: QuoteRow | undefined, current: VersionBase): readonly string[] => {
  if (!previous) return [];
  const before = numberOf(previous.total);
  const after = numberOf(current.quote.total);
  const beforeRate = numberOf(previous.marginBasisPoints);
  const parts: string[] = [];
  if (before !== null && before > 0 && after !== null)
    parts.push(`总额 ${signed(((after - before) / before) * 100, 1, '%')}`);
  if (beforeRate !== null && current.rate !== null)
    parts.push(`毛利率 ${signed((current.rate - beforeRate) / 100, 2, 'pp')}`);
  return parts;
};

const versionView = (quote: QuoteRow, ports: QuotePageState['ports']): VersionBase => {
  const status = ports.textValue(quote.status, 'DRAFT');
  const rate = numberOf(quote.marginBasisPoints);
  return {
    quote,
    revision: ports.textValue(quote.revision, '1'),
    status,
    date: versionDate(quote),
    margin: `${ports.textValue(quote.margin, '—')}（${rate === null ? '—' : percent(rate)}）`,
    rate,
  };
};

export const QuoteTimeline = ({ state }: Readonly<{ state: QuotePageState }>) => {
  const current = state.selected;
  if (!current) return null;
  const { ports } = state;
  const versions = state.snapshot.quotes
    .filter((item) => item.quoteId === current.quoteId)
    .sort((left, right) => Number(left.revision ?? 0) - Number(right.revision ?? 0));
  const views = versions.map((item, index) => {
    const view = versionView(item, ports);
    return {
      ...view,
      key: ports.textValue(item.id, ''),
      delta: versionDelta(versions[index - 1], view),
    };
  });
  return (
    <section class="com-quote-timeline" aria-label="报价版本时间线">
      <h3 class="com-quote-timeline-title">
        版本时间线<span class="com-quote-timeline-count">{`${String(views.length)} 个版本`}</span>
      </h3>
      <ol class="com-timeline" data-testid="kt-quote-timeline">
        {views.map((view) => {
          const isCurrent = view.quote === current;
          return (
            <li
              class="com-timeline-item"
              key={view.key}
              data-current={isCurrent ? 'true' : 'false'}
            >
              <button
                type="button"
                class="com-timeline-node"
                data-testid="kt-quote-version"
                aria-current={isCurrent ? 'true' : 'false'}
                onClick={() => {
                  if (!isCurrent) state.open(view.quote);
                }}
              >
                <span class="com-timeline-axis" aria-hidden="true">
                  <span class="com-timeline-dot" data-tone={statusTone(view.status)} />
                </span>
                <span class="com-timeline-version">
                  {`第 ${view.revision} 版`}
                  {isCurrent ? (
                    <span class="com-tag" data-tone="brand">
                      当前查看
                    </span>
                  ) : null}
                </span>
                <StatusBadge tone={statusTone(view.status)}>
                  {STATUS_LABELS[view.status] ?? '—'}
                </StatusBadge>
                <span class="com-timeline-date">{view.date}</span>
                <span class="com-timeline-margin">{view.margin}</span>
                <MarginMeter
                  compact
                  rate={view.rate}
                  thresholds={marginThresholds(
                    policyMinimumMargin(view.quote, state.snapshot.policies),
                  )}
                />
                {view.delta.length === 0 ? (
                  <span class="com-timeline-delta">首版</span>
                ) : (
                  <span class="com-timeline-delta-lines">
                    {view.delta.map((line) => (
                      <span class="com-timeline-delta" key={line}>
                        {line}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
