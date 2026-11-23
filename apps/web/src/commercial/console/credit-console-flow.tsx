import type { CreditConsolePorts, CreditRow } from './credit-ports';
import type { CreditPageState } from './credit-console';
import './commercial-ux.css';

// COM-UX 信用审查审批流程图。流程口径取自域模型：发起评估（POST credit-decisions）即由
// 服务器锁定台账并核算敞口 → 等待信用审批 → 由异于评估人的审批人给出批准/拒绝；
// 有效期届满而未获批的决定按 effective_status 呈现为过期。
export const STATUS_LABELS: Readonly<Record<string, string>> = {
  PENDING_APPROVAL: '等待信用审批',
  APPROVED: '信用已批准',
  REJECTED: '信用已拒绝',
  EXPIRED: '信用已过期',
};

type PortsFace = Pick<CreditConsolePorts, 'recordText'>;

const numberOf = (text: string): number | null => {
  if (text.trim() === '') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};
const day = (text: string): string => text.slice(0, 10);
const statusOf = (decision: CreditRow, ports: PortsFace): string =>
  ports.recordText(decision, 'effectiveStatus', 'effective_status', 'PENDING_APPROVAL');

export type FlowCounts = Readonly<{
  total: number;
  approvalRequired: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
}>;

export const countFlow = (decisions: readonly CreditRow[], ports: PortsFace): FlowCounts => {
  const counts = {
    total: decisions.length,
    approvalRequired: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
  };
  for (const decision of decisions) {
    // approval_required 自 pg 回来是布尔值；recordText 只透传字符串/数字，故直接按行字段读取。
    const required = decision.approvalRequired ?? decision.approval_required;
    if (required === true || required === 'true') counts.approvalRequired += 1;
    const status = statusOf(decision, ports);
    if (status === 'PENDING_APPROVAL') counts.pending += 1;
    else if (status === 'APPROVED') counts.approved += 1;
    else if (status === 'REJECTED') counts.rejected += 1;
    else if (status === 'EXPIRED') counts.expired += 1;
  }
  return counts;
};

export type Utilization = Readonly<{
  exposure: number | null;
  limit: number | null;
  /** 额度占用率（百分比，一位小数）；额度缺失或为 0 时为 null。 */
  ratio: number | null;
  /** 敞口大于额度（事实标注，不是政策阈值）。 */
  overLimit: boolean;
}>;

export const creditUtilization = (decision: CreditRow, ports: PortsFace): Utilization => {
  const exposure = numberOf(ports.recordText(decision, 'exposureAmount', 'exposure_amount', ''));
  const limit = numberOf(ports.recordText(decision, 'creditLimit', 'credit_limit', ''));
  const ratio =
    exposure !== null && limit !== null && limit > 0
      ? Math.round((exposure / limit) * 1000) / 10
      : null;
  return {
    exposure,
    limit,
    ratio,
    overLimit: exposure !== null && limit !== null && exposure > limit,
  };
};

export type DecisionStep = Readonly<{
  key: 'submit' | 'evaluate' | 'review';
  label: string;
  state: 'done' | 'current';
  detail: string;
}>;

// 单个决定的三环节：提交（创建时间）→ 评估（敞口核算）→ 审批（结论 + 时间 / 等待中）。
export const decisionSteps = (decision: CreditRow, ports: PortsFace): readonly DecisionStep[] => {
  const status = statusOf(decision, ports);
  const created = day(ports.recordText(decision, 'createdAt', 'created_at', ''));
  const decided = day(ports.recordText(decision, 'decidedAt', 'decided_at', ''));
  const validUntil = day(ports.recordText(decision, 'validUntil', 'valid_until', ''));
  const snapshot = ports.recordText(decision, 'exposureSnapshotId', 'exposure_snapshot_id', '');
  const review =
    status === 'APPROVED'
      ? { state: 'done' as const, detail: decided ? `已批准 · ${decided}` : '已批准' }
      : status === 'REJECTED'
        ? { state: 'done' as const, detail: decided ? `已拒绝 · ${decided}` : '已拒绝' }
        : status === 'EXPIRED'
          ? { state: 'done' as const, detail: `已过期 · 有效期至 ${validUntil}` }
          : {
              state: 'current' as const,
              detail: `等待审批 · 有效期至 ${validUntil}`,
            };
  return [
    {
      key: 'submit',
      label: '发起评估',
      state: 'done',
      detail: created ? `提交于 ${created}` : '提交时间未知',
    },
    {
      key: 'evaluate',
      label: '信用评估',
      state: 'done',
      detail: snapshot ? `敞口核算完成 · 快照 ${snapshot.slice(0, 8)}` : '敞口核算完成',
    },
    { key: 'review', label: '信用审批', ...review },
  ];
};

// 审批结论图标（单线 SVG，取 currentColor；语义另由文字承载）。
const OutcomeIcon = ({ tone }: Readonly<{ tone: string }>) => {
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.7',
    'stroke-linecap': 'round' as const,
    'stroke-linejoin': 'round' as const,
  };
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      {tone === 'success' ? (
        <path d="M3 8.5l3 3 7-7" {...stroke} />
      ) : tone === 'danger' ? (
        <path d="M4 4l8 8M12 4l-8 8" {...stroke} />
      ) : (
        <>
          <circle cx="8" cy="8" r="5.5" {...stroke} />
          <path d="M8 5v3.2l2.2 1.3" {...stroke} />
        </>
      )}
    </svg>
  );
};

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <path
      d="M3 8.5l3 3 7-7"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);

const REVIEW_OUTCOMES = [
  { key: 'approved', status: 'APPROVED', label: '批准', tone: 'success' },
  { key: 'rejected', status: 'REJECTED', label: '拒绝', tone: 'danger' },
  { key: 'expired', status: 'EXPIRED', label: '过期', tone: 'neutral' },
] as const;

// 页面级流程图：发起评估 → 信用评估 → 信用审批 → 批准 / 拒绝（过期为有效期旁路）。
// 发起/评估为说明环节；「信用审批」与三个结论节点可点选筛选（与状态筛选条同一状态源）。
export const CreditFlow = ({ state }: Readonly<{ state: CreditPageState }>) => {
  const counts = countFlow(state.decisions, state.ports);
  const active = (filter: CreditPageState['statusFilter']): boolean =>
    state.statusFilter === filter;
  return (
    <section class="com-flow" data-testid="kt-credit-flow" aria-label="信用审批流程">
      <ol class="com-flow-track">
        {/* 发起与评估是流程说明（不可点选）：全部决定都经过这两步，没有独立的筛选含义。 */}
        <li>
          <div
            class="com-flow-node is-static"
            data-testid="kt-credit-flow-submit"
            data-count={String(counts.total)}
          >
            <span class="com-flow-index" aria-hidden="true">
              1
            </span>
            <span class="com-flow-label">发起评估</span>
            <span class="com-flow-note">{`${String(counts.total)} 笔`}</span>
          </div>
        </li>
        <li>
          <div
            class="com-flow-node is-static"
            data-testid="kt-credit-flow-evaluate"
            data-count={String(counts.total)}
          >
            <span class="com-flow-index" aria-hidden="true">
              2
            </span>
            <span class="com-flow-label">信用评估</span>
            <span class="com-flow-note">{`需人工审批 ${String(counts.approvalRequired)} 笔`}</span>
          </div>
        </li>
        <li>
          <button
            type="button"
            class="com-flow-node"
            data-testid="kt-credit-flow-review"
            aria-pressed={active('PENDING_APPROVAL')}
            data-count={String(counts.pending)}
            onClick={() => {
              state.setStatusFilter('PENDING_APPROVAL');
            }}
          >
            <span class="com-flow-index" aria-hidden="true">
              3
            </span>
            <span class="com-flow-label">信用审批</span>
            <span class="com-flow-note">{`待审批 ${String(counts.pending)} 笔`}</span>
          </button>
        </li>
        <li class="com-flow-branch">
          <ul class="com-flow-outcomes">
            {REVIEW_OUTCOMES.map((outcome) => (
              <li key={outcome.key}>
                <button
                  type="button"
                  class="com-flow-outcome"
                  data-testid={`kt-credit-flow-${outcome.key}`}
                  data-tone={outcome.tone}
                  aria-pressed={active(outcome.status)}
                  data-count={String(counts[outcome.key])}
                  onClick={() => {
                    state.setStatusFilter(outcome.status);
                  }}
                >
                  <OutcomeIcon tone={outcome.tone} />
                  <span class="com-flow-label">{outcome.label}</span>
                  <span class="com-flow-note">{`${String(counts[outcome.key])} 笔`}</span>
                </button>
              </li>
            ))}
          </ul>
        </li>
      </ol>
    </section>
  );
};

const UsageBar = ({
  decision,
  state,
}: Readonly<{ decision: CreditRow; state: CreditPageState }>) => {
  const { ports } = state;
  const usage = creditUtilization(decision, ports);
  const currency = ports.recordText(decision, 'currency', 'currency', 'CNY');
  return (
    <div class="com-usage" data-testid="kt-credit-usage">
      <div class="com-meter-track" aria-hidden="true">
        <span
          class="com-meter-fill"
          data-tone={usage.overLimit ? 'danger' : 'brand'}
          style={{
            width: `${String(usage.ratio === null ? 0 : Math.min(100, usage.ratio))}%`,
          }}
        />
      </div>
      <p class="com-meter-caption">
        {usage.ratio === null ? (
          <span>额度占用率不可见</span>
        ) : (
          <>
            <strong>{`${String(usage.ratio)}%`}</strong>
            <span>{`额度占用率 · 敞口 ${ports.displayMoney(
              currency,
              usage.exposure,
            )} / 额度 ${ports.displayMoney(currency, usage.limit)}`}</span>
          </>
        )}
        {usage.overLimit ? (
          <span class="com-tag" data-tone="danger">
            超出额度
          </span>
        ) : null}
      </p>
    </div>
  );
};

// 抽屉内逐步骤进度：已完成环节带时间戳；待审批时审批环节为「进行中」并就地提供审批操作。
export const DecisionFlow = ({ state }: Readonly<{ state: CreditPageState }>) => {
  const decision = state.selected;
  if (!decision) return null;
  const { ports, permissions } = state;
  const steps = decisionSteps(decision, ports);
  const mayDecide =
    statusOf(decision, ports) === 'PENDING_APPROVAL' && permissions.has('credit:approve');
  return (
    <ol class="com-flow-steps" data-testid="kt-credit-flow-detail" aria-label="信用决定办理进度">
      {steps.map((step, index) => (
        <li class="com-flow-step" data-step={step.key} data-state={step.state} key={step.key}>
          <span class="com-flow-marker" aria-hidden="true">
            {step.state === 'done' ? <CheckIcon /> : String(index + 1)}
          </span>
          <div class="com-flow-body">
            <span class="com-flow-label">
              <span class="com-visually-hidden">
                {step.state === 'done' ? '已完成：' : '进行中：'}
              </span>
              {step.label}
            </span>
            <span class="com-flow-detail">{step.detail}</span>
            {step.key === 'evaluate' ? <UsageBar decision={decision} state={state} /> : null}
            {step.key === 'review' && mayDecide ? (
              <div class="console-actions" data-testid="kt-credit-actions">
                {state.decision === null ? (
                  <>
                    <button
                      type="button"
                      class="primary"
                      data-testid="kt-credit-approve"
                      onClick={() => {
                        state.openDecision('APPROVED');
                      }}
                    >
                      批准信用
                    </button>
                    <button
                      type="button"
                      class="secondary"
                      data-testid="kt-credit-reject"
                      onClick={() => {
                        state.openDecision('REJECTED');
                      }}
                    >
                      拒绝信用
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
};
