// U3-MFG-4（ADR-0014 分域重写）：工单详情抽屉——概要、状态轨迹、工序进度（竖向步骤：
// 每道工序的良品/废品/工时与完成徽章）、物料需求与分配状态、物料台账、报工记录时间线、
// 成品序列与事件台账。详情数据来自 additive findProductionOrder，未到达前回退列表行
// 就地推算。车间执行入口（工序报工 / 领退料 / 成品卷入库）的表单仍为 vanilla（MFG-5
// 报工入库范围），由宿主把既有按钮挂进本抽屉。分区各自成组件（G5 ≤200 行）。
import { useMemo, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { DetailDrawer, StatusBadge, type StatusTone } from '@kingturf/ui';
import { dateTimeLabelOf } from '../../crm/crm-ux';
import type { ProductionOrderRow } from './production-order-ports';
import {
  formatQuantity,
  idOf,
  nextActionOf,
  progressOf,
  quantityOf,
  records,
  STATUS_LABELS,
  statusTone,
  textOf,
  type OrderProgress,
  type ProductionOrderViewState,
} from './production-order-state';
import './commercial-ux.css';
import './production-order-console.css';

type DetailProps = Readonly<{ state: ProductionOrderViewState }>;
type Labeler = (value: unknown) => string;
type ListItem = Readonly<{ key: string; body: ComponentChildren }>;

type StepView = Readonly<{
  key: string;
  sequence: number;
  name: string;
  code: string;
  workCenter: string;
  planned: number;
  good: number;
  scrap: number;
  reportCount: number;
  completed: boolean;
  labor: number | null;
  machine: number | null;
}>;
type ReportView = Readonly<{
  id: string;
  sequence: number;
  name: string;
  good: number;
  scrap: number;
  labor: number;
  machine: number;
  startedAt: string;
  completedAt: string;
  notes: string;
}>;

// 工序步骤：详情聚合（含工时）优先；详情未到达或失败时按列表行就地推算（与 legacy
// 卡片同一算法：每道工序的报工良品之和）。
const stepsOf = (
  detail: ProductionOrderRow | null,
  row: ProductionOrderRow,
): readonly StepView[] => {
  const server = records(detail?.operationProgress);
  if (server.length > 0)
    return server
      .map(
        (item): StepView => ({
          key: textOf(item.id) || String(quantityOf(item.sequence)),
          sequence: quantityOf(item.sequence),
          name: textOf(item.operationName),
          code: textOf(item.operationCode),
          workCenter: textOf(item.workCenter),
          planned: quantityOf(item.plannedQuantity),
          good: quantityOf(item.reportedGoodQuantity),
          scrap: quantityOf(item.reportedScrapQuantity),
          reportCount: quantityOf(item.reportCount),
          completed: item.completed === true,
          labor: quantityOf(item.laborMinutes),
          machine: quantityOf(item.machineMinutes),
        }),
      )
      .sort((left, right) => left.sequence - right.sequence);
  return progressOf(row).operations.map(
    (item): StepView => ({
      key: item.id || String(item.sequence),
      sequence: item.sequence,
      name: item.name,
      code: item.code,
      workCenter: item.workCenter,
      planned: quantityOf(row.planned_quantity),
      good: item.good,
      scrap: item.scrap,
      reportCount: item.reportCount,
      completed: item.completed,
      labor: null,
      machine: null,
    }),
  );
};
// 报工时间线：详情聚合（按工序号）优先；回退列表行报工并按工序 id 补工序号/名称。
const reportsOf = (
  detail: ProductionOrderRow | null,
  row: ProductionOrderRow,
): readonly ReportView[] => {
  const server = records(detail?.reportTimeline);
  if (server.length > 0)
    return server.map((item) => ({
      id: textOf(item.id),
      sequence: quantityOf(item.sequence),
      name: textOf(item.operationName),
      good: quantityOf(item.goodQuantity),
      scrap: quantityOf(item.scrapQuantity),
      labor: quantityOf(item.laborMinutes),
      machine: quantityOf(item.machineMinutes),
      startedAt: textOf(item.startedAt),
      completedAt: textOf(item.completedAt),
      notes: textOf(item.notes),
    }));
  const operations = new Map(
    records(row.operations).map((item) => [
      idOf(item.id),
      { sequence: quantityOf(item.sequence), name: textOf(item.name) },
    ]),
  );
  return records(row.reports).map((item) => ({
    id: textOf(item.id),
    ...(operations.get(idOf(item.production_order_operation_id)) ?? { sequence: 0, name: '' }),
    good: quantityOf(item.good_quantity),
    scrap: quantityOf(item.scrap_quantity),
    labor: quantityOf(item.labor_minutes),
    machine: quantityOf(item.machine_minutes),
    startedAt: textOf(item.started_at),
    completedAt: textOf(item.completed_at),
    notes: textOf(item.notes),
  }));
};
const stepStateOf = (step: StepView): 'done' | 'current' | 'pending' =>
  step.completed ? 'done' : step.reportCount > 0 ? 'current' : 'pending';
const stepBadgeOf = (step: StepView): Readonly<{ tone: StatusTone; label: string }> =>
  step.completed
    ? { tone: 'success', label: '已完成' }
    : step.reportCount > 0
      ? { tone: 'warning', label: '进行中' }
      : { tone: 'neutral', label: '未开始' };

export const ALLOCATION_LABELS: Readonly<Record<string, string>> = {
  NOT_ISSUED: '未领料',
  PARTIAL: '部分领料',
  ISSUED: '已领足',
  OVER_ISSUED: '超领',
};
const ALLOCATION_TONES: Readonly<Record<string, StatusTone>> = {
  NOT_ISSUED: 'neutral',
  PARTIAL: 'warning',
  ISSUED: 'success',
  OVER_ISSUED: 'danger',
};
// 状态轨迹的节点顺序（DB 触发器的唯一合法路径；CANCELLED 为旁支）。
const STATE_TRACK = ['DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'] as const;
const nodeStateOf = (index: number, at: number): string => {
  if (index === -1) return 'pending';
  if (at < index) return 'done';
  return at === index ? 'current' : 'pending';
};

const Section = ({
  title,
  testId,
  children,
}: Readonly<{ title: string; testId: string; children: ComponentChildren }>) => (
  <section class="po-section" data-testid={testId}>
    <h3>{title}</h3>
    {children}
  </section>
);

// 无障碍进度条（aria progressbar）；填充长度 = 比例，颜色经 data-tone 取语义 token。
export const ProgressBar = ({
  ratio,
  label,
  tone = 'brand',
}: Readonly<{ ratio: number; label: string; tone?: string }>) => {
  const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <div
      class="com-meter-track po-meter-track"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <span
        class="com-meter-fill"
        data-tone={percent === 100 ? 'success' : tone}
        style={{ width: `${String(percent)}%` }}
      />
    </div>
  );
};

const OperationSteps = ({ steps }: Readonly<{ steps: readonly StepView[] }>) => (
  <ol class="com-flow-steps po-steps" data-testid="kt-po-operation-steps" aria-label="工序进度">
    {steps.map((step, index) => {
      const badge = stepBadgeOf(step);
      return (
        <li
          key={step.key}
          class="com-flow-step"
          data-step={String(step.sequence)}
          data-state={stepStateOf(step)}
          data-testid="kt-po-operation-step"
        >
          <span class="com-flow-marker" aria-hidden="true">
            {step.completed ? '✓' : String(index + 1)}
          </span>
          <div class="com-flow-body">
            <span class="com-flow-label po-step-label">
              <strong>{step.name || '未命名工序'}</strong>
              <span class="po-muted">{`工序 ${String(step.sequence)}${step.code ? ` · ${step.code}` : ''}${step.workCenter ? ` · ${step.workCenter}` : ''}`}</span>
            </span>
            <span class="com-flow-detail">{`良品 ${formatQuantity(step.good)} / 计划 ${formatQuantity(step.planned)} · 废品 ${formatQuantity(step.scrap)} · 报工 ${String(step.reportCount)} 次`}</span>
            {step.labor === null ? null : (
              <span class="com-flow-detail">{`人工 ${formatQuantity(step.labor)} 分钟 · 设备 ${formatQuantity(step.machine)} 分钟`}</span>
            )}
            <ProgressBar
              ratio={step.planned > 0 ? Math.min(1, step.good / step.planned) : 0}
              label={`工序 ${step.name} 良品进度`}
            />
            <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
          </div>
        </li>
      );
    })}
  </ol>
);

const StateTrack = ({ state, row }: DetailProps & Readonly<{ row: ProductionOrderRow }>) => {
  const current = state.ports.recordText(row, 'state', 'state');
  const index = STATE_TRACK.indexOf(current as (typeof STATE_TRACK)[number]);
  const labelOf: Labeler = (value) =>
    STATUS_LABELS[String(value)] ?? state.ports.businessStateLabel(value);
  return (
    <ol class="po-state-track" data-testid="kt-po-state-track" aria-label="工单状态轨迹">
      {STATE_TRACK.map((status, at) => (
        <li key={status} class="po-state-node" data-state={nodeStateOf(index, at)}>
          {labelOf(status)}
        </li>
      ))}
      {current === 'CANCELLED' ? (
        <li class="po-state-node" data-state="cancelled">
          {labelOf(current)}
        </li>
      ) : null}
    </ol>
  );
};

// 车间执行入口：vanilla 按钮由宿主挂进容器。挂载走 ref 回调（挂载/卸载由 Preact 提交
// 时机驱动，测试 DOM 与浏览器一致）；容器以「行 id + 证据计数」为 key——行刷新后证据
// 计数变化即重挂，按钮拿到最新的报工/物料数据（与 legacy 整卡重渲染等价）。
const ExecutionMount = ({ state }: DetailProps) => {
  const row = state.selected;
  const mounted = useRef<{ row: ProductionOrderRow; dispose: () => void } | null>(null);
  const latest = useRef(state);
  latest.current = state;
  const attach = useMemo(
    () =>
      (node: HTMLElement | null): void => {
        if (node === null) {
          mounted.current?.dispose();
          mounted.current = null;
          return;
        }
        const current = latest.current;
        const active = current.selected;
        if (!active || mounted.current?.row === active) return;
        mounted.current?.dispose();
        mounted.current = {
          row: active,
          dispose: current.mountExecution(node, active, () => current.runRefresh()),
        };
      },
    [],
  );
  if (!row) return null;
  const version = [
    String(records(row.reports).length),
    String(records(row.materials).length),
    String(records(row.rolls).length),
  ].join(':');
  return <div key={version} class="po-execution" ref={attach} data-testid="kt-po-execution" />;
};

const ProgressSection = ({
  progress,
  steps,
}: Readonly<{ progress: OrderProgress; steps: readonly StepView[] }>) => (
  <Section title="工序进度" testId="kt-po-progress-section">
    <p class="po-progress-caption" data-testid="kt-po-progress-caption">
      {`完工进度 ${formatQuantity(progress.completed)} / ${formatQuantity(progress.planned)}（各工序累计良品的最小值）`}
    </p>
    <ProgressBar ratio={progress.ratio} label="工单完工进度" />
    {steps.length > 0 ? (
      <OperationSteps steps={steps} />
    ) : (
      <p class="po-muted">该工单暂无工序快照</p>
    )}
  </Section>
);

// 物料需求与分配：仅在详情响应带 materialRequirements 键时渲染（bom:read 未授权时服务端
// 不查询，不以「暂无」冒充「无权限」）。
const RequirementSection = ({
  requirements,
}: Readonly<{ requirements: readonly ProductionOrderRow[] }>) => (
  <Section title="物料需求与分配" testId="kt-po-requirements-section">
    {requirements.length > 0 ? (
      <ul class="po-list">
        {requirements.map((item) => {
          const status = textOf(item.allocationStatus);
          return (
            <li
              key={`${idOf(item.componentItemVersionId)}-${String(item.lineNumber)}`}
              class="po-line"
              data-testid="kt-po-requirement"
            >
              <strong>{textOf(item.sku)}</strong>
              <span>{textOf(item.itemName)}</span>
              <span class="po-qty">{`需求 ${formatQuantity(item.plannedQuantity)} ${textOf(item.baseUnitCode)}`}</span>
              <span class="po-qty">{`已领 ${formatQuantity(item.actualQuantity)}`}</span>
              <StatusBadge tone={ALLOCATION_TONES[status] ?? 'neutral'}>
                {ALLOCATION_LABELS[status] ?? status}
              </StatusBadge>
            </li>
          );
        })}
      </ul>
    ) : (
      <p class="po-muted">该成品暂无已发布 BOM，无法给出物料需求</p>
    )}
  </Section>
);

const ItemList = ({
  empty,
  items,
  itemTestId,
}: Readonly<{ empty: string; items: readonly ListItem[]; itemTestId: string }>) =>
  items.length > 0 ? (
    <ul class="po-list">
      {items.map((item) => (
        <li key={item.key} class="po-line" data-testid={itemTestId}>
          {item.body}
        </li>
      ))}
    </ul>
  ) : (
    <p class="po-muted">{empty}</p>
  );

const Timeline = ({
  empty,
  items,
  itemTestId,
}: Readonly<{ empty: string; items: readonly ListItem[]; itemTestId: string }>) =>
  items.length > 0 ? (
    <ol class="po-timeline">
      {items.map((item) => (
        <li key={item.key} class="po-timeline-item" data-testid={itemTestId}>
          {item.body}
        </li>
      ))}
    </ol>
  ) : (
    <p class="po-muted">{empty}</p>
  );

const ledgerItems = (
  state: ProductionOrderViewState,
  row: ProductionOrderRow,
): readonly ListItem[] =>
  records(row.materials).map((entry, index) => ({
    key: idOf(entry.id) || String(index),
    body: (
      <>
        <span>{`${state.ports.businessStateLabel(entry.transaction_type)} ${state.ports.recordText(entry, 'quantity', 'quantity')}`}</span>
        <time class="po-muted">{dateTimeLabelOf(entry.occurred_at)}</time>
      </>
    ),
  }));
const rollItems = (state: ProductionOrderViewState, row: ProductionOrderRow): readonly ListItem[] =>
  records(row.rolls).map((item, index) => ({
    key: idOf(item.id) || String(index),
    body: (
      <span data-testid="kt-po-roll">
        {`${state.ports.recordText(item, 'rollNumber', 'roll_number')} · ${state.ports.recordText(item, 'quantity', 'quantity')} · ${state.ports.businessStateLabel(item.status)}`}
      </span>
    ),
  }));
const reportBody = (item: ReportView): ComponentChildren => (
  <>
    <p class="po-timeline-head">
      <strong>{item.name || '未关联工序'}</strong>
      <span class="po-muted">{`工序 ${String(item.sequence)}`}</span>
    </p>
    <p class="po-timeline-meta">
      <span>{`良品 ${formatQuantity(item.good)}`}</span>
      <span>{`废品 ${formatQuantity(item.scrap)}`}</span>
      <span>{`人工 ${formatQuantity(item.labor)} 分钟`}</span>
      <span>{`设备 ${formatQuantity(item.machine)} 分钟`}</span>
    </p>
    <p class="po-timeline-meta">
      <span>{`${dateTimeLabelOf(item.startedAt)} → ${dateTimeLabelOf(item.completedAt)}`}</span>
    </p>
    {item.notes ? <p class="po-timeline-note">{item.notes}</p> : null}
  </>
);
const eventItems = (
  state: ProductionOrderViewState,
  row: ProductionOrderRow,
): readonly ListItem[] => {
  const labelOf: Labeler = (value) =>
    STATUS_LABELS[String(value)] ?? state.ports.businessStateLabel(value);
  return records(row.events).map((item, index) => ({
    key: idOf(item.id) || String(index),
    body: (
      <>
        <p class="po-timeline-head">
          <StatusBadge tone={statusTone(item.state)}>{labelOf(item.state)}</StatusBadge>
          <span>{textOf(item.reason)}</span>
        </p>
        <p class="po-timeline-meta">
          <span>{`第 ${String(quantityOf(item.sequence) > 0 ? quantityOf(item.sequence) : index + 1)} 步`}</span>
          <time class="po-muted">{dateTimeLabelOf(item.created_at)}</time>
        </p>
      </>
    ),
  }));
};

const DrawerFooter = ({ state, row }: DetailProps & Readonly<{ row: ProductionOrderRow }>) => {
  const status = state.ports.recordText(row, 'state', 'state');
  const next = nextActionOf(status);
  if (!next) return null;
  if (!state.permissions.has(next.capability)) return null;
  return (
    <>
      <span class="console-hint">{`下一步：${state.ports.operationsNextAction(status)}`}</span>
      <button
        type="button"
        class="primary"
        data-testid="kt-po-transition"
        onClick={() => {
          state.openTransition(row, next.action);
        }}
      >
        {next.label}
      </button>
    </>
  );
};

export const ProductionOrderDetailDrawer = ({ state }: DetailProps) => {
  const row = state.selected;
  if (!row) return null;
  const { ports } = state;
  const detail = state.detail;
  const text = (record: ProductionOrderRow, camel: string, snake = camel): string =>
    ports.recordText(record, camel, snake, '—');
  const labelOf: Labeler = (value) =>
    STATUS_LABELS[String(value)] ?? ports.businessStateLabel(value);
  const status = ports.recordText(row, 'state', 'state');
  const requirements = Array.isArray(detail?.materialRequirements)
    ? records(detail.materialRequirements)
    : null;
  return (
    <DetailDrawer
      title={`工单详情 · ${text(row, 'orderNumber', 'order_number')}`}
      onClose={() => {
        state.open(null);
      }}
      footer={<DrawerFooter state={state} row={row} />}
    >
      <div class="console-summary" data-testid="kt-po-detail-summary">
        <p>
          <StatusBadge tone={statusTone(status)}>{labelOf(status)}</StatusBadge>
          <span class="console-label">产品</span>
          {`${text(row, 'sku')} · ${ports.recordText(row, 'itemName', 'itemName', '')}`}
        </p>
        <p>
          <span class="console-label">计划数量</span>
          {formatQuantity(progressOf(detail ?? row).planned)}
          <span class="console-label">计划开始</span>
          {text(row, 'plannedStartAt', 'planned_start_at').slice(0, 10)}
          <span class="console-label">计划完成</span>
          {text(row, 'plannedDueAt', 'planned_due_at').slice(0, 10)}
        </p>
        <p>
          <span class="console-label">来源编号</span>
          {text(row, 'sourceReference', 'source_reference')}
        </p>
      </div>
      <StateTrack state={state} row={row} />
      {state.detailLoading ? (
        <p class="console-label" data-testid="kt-po-detail-loading">
          详情加载中…
        </p>
      ) : null}
      {state.submitError !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-po-submit-error">
          {state.submitError}
        </p>
      ) : null}
      <ProgressSection progress={progressOf(detail ?? row)} steps={stepsOf(detail, row)} />
      {requirements === null ? null : <RequirementSection requirements={requirements} />}
      <Section title="物料台账" testId="kt-po-ledger-section">
        <ItemList
          empty="尚未领料"
          items={ledgerItems(state, row)}
          itemTestId="kt-po-material-entry"
        />
      </Section>
      <Section title="报工记录" testId="kt-po-reports-section">
        <Timeline
          empty="暂无报工记录"
          items={reportsOf(detail, row).map((item) => ({
            key: item.id || String(item.sequence),
            body: reportBody(item),
          }))}
          itemTestId="kt-po-report"
        />
      </Section>
      <Section title="成品序列" testId="kt-po-rolls-section">
        <ItemList empty="尚未入库" items={rollItems(state, row)} itemTestId="kt-po-roll-line" />
      </Section>
      <Section title="事件台账" testId="kt-po-events-section">
        <Timeline empty="暂无事件记录" items={eventItems(state, row)} itemTestId="kt-po-event" />
      </Section>
      <Section title="车间执行" testId="kt-po-execution-section">
        <p class="console-hint">工序报工、领退料与成品卷入库沿用既有登记表单。</p>
        <ExecutionMount state={state} />
      </Section>
    </DetailDrawer>
  );
};
