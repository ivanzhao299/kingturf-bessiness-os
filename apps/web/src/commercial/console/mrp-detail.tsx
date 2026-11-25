// MFG-6：建议详情抽屉——概要、净需求怎么算（算式原文 + 政策口径 + 扣了哪些库存 + 在途采购）、需求从
// 哪来（解释树：需求信号及其来源单据 → 经哪些 BOM 层级）、冻结覆盖、流转记录、执行工单。解释树的
// 数据由前端基于批次详情的行项计算（mrp-explanation.ts），不为呈现新增读端点；详情未到达时回退
// 列表行（算式与流转记录列表行里也有）。读不到的行项按读权限说明原因。
import { DetailDrawer, StatusBadge } from '@kingturf/ui';
import type { ComponentChildren } from 'preact';
import { dateTimeLabelOf } from '../../crm/crm-ux';
import type { MrpRow } from './mrp-ports';
import {
  evidenceOf,
  explanationOf,
  forItem,
  formulaOf,
  type ExplainNode,
  type ExplainSource,
} from './mrp-explanation';
import {
  STATE_LABELS,
  TYPE_LABELS,
  dayOf,
  idOf,
  records,
  rowText,
  stateTone,
  textOf,
} from './mrp-state';
import { decisionActions, type MrpViewState } from './mrp-console-actions';
import { ConsoleNotice } from './console-notice';
import { FocusAnchor } from './focus-anchor';

type Props = Readonly<{ state: MrpViewState }>;
type Labeler = (value: unknown) => string;
type Text = (camel: string, snake: string, fallback?: string) => string;

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
const isRow = (value: unknown): value is MrpRow =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// 净需求怎么算：legacy 卡片的算式原文 + 政策口径 + 扣减的库存批次 + 在途采购（后三项来自批次详情）。
const NetSection = ({ current, detail }: Readonly<{ current: MrpRow; detail: MrpRow | null }>) => {
  const explanation = current.explanation;
  const policy = (key: string): string => (isRow(explanation) ? textOf(explanation[key]) : '');
  const of = (key: string): readonly MrpRow[] | undefined =>
    detail && Array.isArray(detail[key]) ? forItem(records(detail[key]), current) : undefined;
  const stock = of('inventoryOffsets');
  const receipts = of('scheduledReceipts');
  const lines: readonly (readonly [string, string])[] = [
    [
      '政策口径',
      `安全库存 ${policy('safetyStock')} · 最小批量 ${policy('minimumOrderQuantity')} · 批量倍数 ${policy('orderMultiple')} · 提前期 ${policy('leadTimeDays')} 天 · 冻结窗口 ${policy('freezeWindowDays')} 天`,
    ],
    [
      '当前可用库存（质量已放行）',
      stock === undefined
        ? detail
          ? '当前权限范围未提供 inventory:read 明细'
          : '批次详情未就绪'
        : stock.length === 0
          ? '没有可扣的库存（只计质量已放行的批次）'
          : stock
              .map(
                (offset) =>
                  `批次 ${textOf(offset.lotNumber)} · ${textOf(offset.locationCode) || '未指定库位'} · 可用 ${textOf(offset.quantity)}`,
              )
              .join('；'),
    ],
    [
      '当前在途采购',
      receipts === undefined
        ? detail
          ? '当前权限范围未提供 procurement:read 明细'
          : '批次详情未就绪'
        : receipts.length === 0
          ? '没有在途的采购订单'
          : receipts
              .map(
                (receipt) =>
                  `${textOf(receipt.poNumber)} · 未收 ${textOf(receipt.openQuantity)} · 要求到货 ${textOf(receipt.requiredAt)}`,
              )
              .join('；'),
    ],
  ];
  return (
    <Section title="净需求怎么算" testId="kt-mrp-net">
      <p class="mrp-formula" data-testid="kt-mrp-formula">
        {formulaOf(explanation)}
      </p>
      <p class="mrp-muted">
        净需求按截至需求日的累计需求和到货量计算，扣除可用库存及此前已计划的数量，再按政策批量取整。库存批次和采购行显示当前数据。
      </p>
      <ul class="mrp-facts">
        {lines.map(([label, value]) => (
          <li key={label}>
            <span class="console-label">{label}</span>
            {value}
          </li>
        ))}
      </ul>
    </Section>
  );
};

const sourceText = (source: ExplainSource | undefined, label: Labeler): string => {
  if (!source) return '需求信号';
  if (source.kind === 'SALES_ORDER' || source.kind === 'SALES-ORDER')
    return source.orderNumber
      ? `销售订单 ${source.orderNumber}${source.orderStatus ? `（${label(source.orderStatus)}）` : ''}`
      : '销售订单（订单信息不可见）';
  return `${source.kind} · 来源 ${source.id}`;
};

// 解释树的一层：根是需求信号，下面每一层是经 BOM 展开出来的组件；这条建议对应的那一层带高亮。
const TreeNode = ({
  node,
  label,
}: Readonly<{ node: ExplainNode; label: Labeler }>): preact.JSX.Element => {
  const bom = node.bom;
  return (
    <li
      data-testid="kt-mrp-tree-node"
      data-target={node.target ? 'true' : 'false'}
      data-level={String(node.level)}
    >
      <div class="mrp-tree-node">
        {node.target ? <StatusBadge tone="info">这条建议</StatusBadge> : null}
        <strong>{`${node.sku} ${node.name}`}</strong>
        <span>
          {node.level === 0
            ? `需求信号：${sourceText(node.source, label)} · 需求 ${String(node.quantity)} · ${node.requiredAt}`
            : `第 ${String(node.level)} 层组件 · BOM ${bom?.code ?? ''}：用量 ${String(bom?.quantity ?? '')} / 产出 ${String(bom?.outputQuantity ?? '')}（损耗 ${String((bom?.scrapBasisPoints ?? 0) / 100)}%）· 毛需求贡献 ${String(node.quantity)} · ${node.requiredAt}`}
        </span>
      </div>
      {node.children.length > 0 ? (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.key} node={child} label={label} />
          ))}
        </ul>
      ) : null}
    </li>
  );
};

const TreeSection = ({
  current,
  detail,
  label,
}: Readonly<{ current: MrpRow; detail: MrpRow | null; label: Labeler }>) => {
  const tree = detail ? explanationOf(detail, current) : [];
  const edgesReadable = detail?.bomEdges !== undefined;
  return (
    <Section title="需求从哪来（解释树）" testId="kt-mrp-tree-section">
      {tree.length === 0 ? (
        <p class="mrp-muted">
          {detail
            ? edgesReadable
              ? '在当前可还原的 BOM 中未找到对应日期的需求路径。'
              : '当前权限范围未提供 bom:read 明细，未找到这条建议对应的直接需求信号。'
            : '需求来源与 BOM 层级随计算批次详情加载。'}
        </p>
      ) : (
        <>
          <p class="mrp-muted">
            根是需求信号（来自销售订单或其它业务单据），下面每一层是经 BOM
            展开出来的组件；标出的是这条建议对应的物料与需求日期。
            {edgesReadable
              ? ' 路径按基准日生效、当前可查的已发布 BOM 还原。'
              : ' 当前权限范围未提供 bom:read 明细，只列出直接需求信号。'}
          </p>
          <ul class="mrp-tree" data-testid="kt-mrp-tree">
            {tree.map((node) => (
              <TreeNode key={node.key} node={node} label={label} />
            ))}
          </ul>
        </>
      )}
    </Section>
  );
};

// 冻结窗口：legacy 卡片的提示原文 + 这条建议的冻结截止日 + 批准时记录的覆盖审批编号。
const FreezeSection = ({ current }: Readonly<{ current: MrpRow }>) => {
  if (current.frozen !== true) return null;
  const explanation = current.explanation;
  const approved = records(current.events).find((event) => textOf(event.state) === 'APPROVED');
  return (
    <Section title="冻结窗口" testId="kt-mrp-freeze">
      <p class="mrp-warning" data-testid="kt-mrp-freeze-warning">
        冻结窗口内：批准必须提供覆盖审批证据
      </p>
      <p class="mrp-line">
        <span class="console-label">冻结至</span>
        {isRow(explanation) ? textOf(explanation.freezeUntil) : '—'}
      </p>
      <p>
        {`开始日 ${dayOf(current.start_at)} 不晚于冻结截止日，属于冻结窗口内的计划：批准时要另外填写覆盖审批编号，由计划经理确认。`}
      </p>
      <p class="mrp-line">
        <span class="console-label">覆盖审批编号</span>
        {approved ? evidenceOf(approved) || '未记录' : '尚未批准'}
      </p>
    </Section>
  );
};

const LedgerSection = ({ current, label }: Readonly<{ current: MrpRow; label: Labeler }>) => {
  const events = records(current.events);
  return (
    <Section title="流转记录" testId="kt-mrp-events">
      {events.length === 0 ? (
        <p class="mrp-muted">还没有流转记录</p>
      ) : (
        <ol class="mrp-ledger">
          {events.map((event) => (
            <li key={textOf(event.id) || textOf(event.sequence)} data-testid="kt-mrp-event">
              <strong>{`第 ${textOf(event.sequence)} 步 · ${STATE_LABELS[textOf(event.state)] ?? label(event.state)}`}</strong>
              <span>{textOf(event.reason)}</span>
              <small class="mrp-muted">
                {[
                  textOf(event.sequence) === '1' ? '计算生成的结果快照' : evidenceOf(event),
                  dateTimeLabelOf(event.created_at),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </small>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
};

// 执行：引用了这条建议的生产工单及其状态（建议是否已落实到工单）。
const ExecutionSection = ({
  current,
  detail,
  label,
}: Readonly<{ current: MrpRow; detail: MrpRow | null; label: Labeler }>) => {
  if (!detail) return null;
  const released = textOf(current.effectiveState) === 'RELEASED';
  const orderRows = records(detail.executions).filter(
    (order) => textOf(order.proposalId) === idOf(current),
  );
  const body =
    detail.executions === undefined ? (
      <p class="mrp-muted">执行工单：当前权限范围未提供 production:read 明细</p>
    ) : (
      <>
        {orderRows.length === 0 ? (
          <p class="mrp-muted">
            {released ? '建议已下达，还没有工单引用它' : '建议下达后，引用它的生产工单会出现在这里'}
          </p>
        ) : null}
        <ul class="mrp-ledger">
          {orderRows.map((order) => (
            <li key={textOf(order.orderId)} data-testid="kt-mrp-execution">
              <strong>{`工单 ${textOf(order.orderNumber)}`}</strong>
              <span>{`${label(order.state)} · 计划 ${textOf(order.plannedQuantity)} · ${dayOf(order.plannedStartAt)} → ${dayOf(order.plannedDueAt)}`}</span>
            </li>
          ))}
        </ul>
      </>
    );
  return (
    <Section title="执行（引用这条建议的工单）" testId="kt-mrp-executions">
      {body}
    </Section>
  );
};

export const MrpProposalDrawer = ({ state }: Props) => {
  const row = state.selected;
  if (!row) return null;
  const { ports } = state;
  const label: Labeler = (value) => ports.businessStateLabel(value);
  const text: Text = (camel, snake, fallback = '') =>
    rowText(ports.recordText, row, camel, snake, fallback);
  const detail = state.detail;
  // 详情到了就用详情里刷新后的这一条（状态、流转记录随之更新）；没到之前用列表行。
  const current =
    records(detail?.proposals).find((proposal) => idOf(proposal) === idOf(row)) ?? row;
  const currentText: Text = (camel, snake, fallback = '') =>
    rowText(ports.recordText, current, camel, snake, fallback);
  const status = currentText('effectiveState', 'effectiveState');
  const run = (state.snapshot.runs ?? []).find(
    (candidate) => idOf(candidate) === textOf(current.mrp_run_id),
  );
  const actions = decisionActions(state, current);
  return (
    <DetailDrawer
      title={`物料需求建议 · ${text('sku', 'sku', '—')}`}
      onClose={() => {
        state.open(null);
      }}
      size="wide"
      footer={
        <>
          <p class="console-hint" data-testid="kt-mrp-next">
            {`下一步：${ports.operationsNextAction(status)}`}
          </p>
          <span class="po-row-actions">
            {actions.map((action) => (
              <button
                key={action.form}
                type="button"
                class={
                  action.form === 'approve' || action.form === 'release' ? 'primary' : 'secondary'
                }
                data-testid={`kt-mrp-detail-${action.form}`}
                disabled={state.loading}
                onClick={() => {
                  state.openForm(action.form, current);
                }}
              >
                {action.label}
              </button>
            ))}
          </span>
          {state.notice === '' ? undefined : <ConsoleNotice message={state.notice} />}
        </>
      }
    >
      <div class="console-summary" data-testid="kt-mrp-detail">
        <p>
          <span class="console-label">状态</span>
          <StatusBadge tone={stateTone(status)}>
            {STATE_LABELS[status] ?? label(status)}
          </StatusBadge>
          {current.frozen === true ? <StatusBadge tone="warning">冻结窗口内</StatusBadge> : null}
          <span class="console-label">物料</span>
          {`${text('sku', 'sku', '—')} · ${text('itemName', 'itemName')}`}
          <span class="console-label">建议</span>
          {`${TYPE_LABELS[currentText('proposalType', 'proposal_type')] ?? '建议'} ${currentText('quantity', 'quantity')}`}
        </p>
        <p>
          <span class="console-label">开始 → 需求日期</span>
          {`${dayOf(current.start_at)} → ${dayOf(current.due_at)}`}
          <span class="console-label">计算批次</span>
          {run
            ? `${rowText(ports.recordText, run, 'runNumber', 'run_number')} · ${label(run.status)}`
            : textOf(current.mrp_run_id)}
        </p>
      </div>
      {state.detailLoading ? <p class="console-label">批次详情加载中…</p> : null}
      {state.detailError !== '' ? (
        <p class="console-error" role="alert">
          {state.detailError}
        </p>
      ) : null}
      <NetSection current={current} detail={detail} />
      <TreeSection current={current} detail={detail} label={label} />
      <FreezeSection current={current} />
      <LedgerSection current={current} label={label} />
      <ExecutionSection current={current} detail={detail} label={label} />
      {/* 建议决定之后按钮变化时，把键盘焦点带回抽屉。 */}
      <FocusAnchor token={`${status}|${String(actions.length)}`} />
    </DetailDrawer>
  );
};
