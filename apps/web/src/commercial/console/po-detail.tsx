// U3-PROC-3：采购单控制台详情子组件（自 po-console 拆分——G1/G5 ≤800/≤200 行
// 纪律）：行项收货状态/收货记录/合同文档工作流区。只依赖状态最小面，结构与
// po-console 的 PoPageState 兼容（结构化子集，无循环依赖）。
// PROC-UX：收货进度条（receivedQuantity/orderedQuantity，列表列 + 抽屉逐行/整单）与
// 状态流转图（DRAFT→ISSUED→PARTIALLY_RECEIVED→RECEIVED，CANCELLED 终止）。几何样式取
// kt tokens 内联（无既有原语类；本批不新增 CSS 文件——文件边界）。
import { Fragment } from 'preact';
import type { FormSectionField } from '@kingturf/ui';
import type { ContractDocumentRow, PurchaseOrderConsolePorts, PurchaseOrderRow } from './po-ports';

export type DocumentFormKind = 'ocr' | 'review' | 'sign';

export type PoDetailState = Readonly<{
  selected: PurchaseOrderRow | null;
  documents: readonly ContractDocumentRow[];
  activeDocumentForm: Readonly<{ documentId: string; kind: DocumentFormKind }> | null;
  permissions: ReadonlySet<string>;
  ports: PurchaseOrderConsolePorts;
  openDocumentForm: (documentId: string, kind: DocumentFormKind) => void;
  runUpload: (orderId: string, file: File) => Promise<void>;
  runDocumentAction: (
    documentId: string,
    kind: DocumentFormKind,
    values: Readonly<Record<string, string>>,
  ) => Promise<void>;
}>;

// 行项/收货记录投影（list('orders')/findPurchaseOrder 的 lines/receipts 形态）。
const linesOf = (row: PurchaseOrderRow | null): readonly Record<string, unknown>[] =>
  row && Array.isArray(row.lines) ? (row.lines as Record<string, unknown>[]) : [];

const receiptsOf = (row: PurchaseOrderRow | null): readonly Record<string, unknown>[] =>
  row && Array.isArray(row.receipts) ? (row.receipts as Record<string, unknown>[]) : [];

export const PoLines = ({ state }: Readonly<{ state: PoDetailState }>) => {
  const row = state.selected;
  if (!row) return null;
  const lines = linesOf(row);
  if (lines.length === 0)
    return (
      <p class="console-label" data-testid="kt-po-lines-empty">
        尚无订单行项
      </p>
    );
  return (
    <ul class="console-summary" data-testid="kt-po-lines">
      {lines.map((line, index) => (
        <li key={state.ports.textValue(line.id, String(index))}>
          {`${state.ports.textValue(line.sku, '—')} · ${state.ports.textValue(line.itemName, '—')} · 数量 ${state.ports.textValue(line.quantity, '—')} · 单价 ${state.ports.textValue(line.unit_price ?? line.unitPrice, '—')} · 要求到货 ${state.ports.textValue(line.requiredAt ?? line.required_at, '—')} · 已收 ${state.ports.textValue(line.receivedQuantity ?? line.received_quantity, '0')}`}
        </li>
      ))}
    </ul>
  );
};

export const ReceiptProgress = ({ state }: Readonly<{ state: PoDetailState }>) => {
  const row = state.selected;
  if (!row) return null;
  const receipts = receiptsOf(row);
  if (receipts.length === 0) return null;
  return (
    <div class="console-summary" data-testid="kt-po-receipts">
      <p class="console-label">收货记录</p>
      <ul>
        {receipts.map((receipt, index) => (
          <li key={state.ports.textValue(receipt.id, String(index))}>
            {`收货 ${state.ports.textValue(receipt.receiptNumber ?? receipt.receipt_number, '—')} · 收于 ${state.ports.textValue(receipt.receivedAt ?? receipt.received_at, '—').slice(0, 10)} · 送货单 ${state.ports.textValue(receipt.sourceReference ?? receipt.source_reference, '—')}`}
            <ul>
              {(Array.isArray(receipt.lines)
                ? (receipt.lines as Record<string, unknown>[])
                : []
              ).map((line, lineIndex) => (
                <li key={state.ports.textValue(line.id, String(lineIndex))}>
                  {`批次 ${state.ports.textValue(line.lotNumber ?? line.lot_number, '—')} · ${state.ports.textValue(line.locationCode ?? line.location_code, '—')} · ${state.ports.textValue(line.sku, '—')} · ${state.ports.textValue(line.quantity, '—')}`}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ---- 收货进度与状态流转（PROC-UX）----

// businessStateLabel 同口径（procurement_document_status 五值均有标签）。
export const STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: '草稿',
  ISSUED: '已签发',
  PARTIALLY_RECEIVED: '部分收货',
  RECEIVED: '已收货',
  CANCELLED: '已取消',
};

const numberOf = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export type ReceiptProgressValue = Readonly<{
  ordered: number;
  received: number;
  percent: number;
}>;

// 收货进度：Σ已收 / Σ订购（行项 receivedQuantity 为收货行数量聚合；超收时条封顶 100%，
// 文本保留真实百分比）。
export const receiptProgressOf = (
  lines: readonly Record<string, unknown>[],
): ReceiptProgressValue => {
  const ordered = lines.reduce((sum, line) => sum + numberOf(line.quantity), 0);
  const received = lines.reduce(
    (sum, line) => sum + numberOf(line.receivedQuantity ?? line.received_quantity),
    0,
  );
  return { ordered, received, percent: ordered <= 0 ? 0 : Math.round((received / ordered) * 100) };
};

const PROGRESS_TRACK_STYLE = {
  height: '6px',
  minWidth: '72px',
  borderRadius: 'var(--kt-radius-pill)',
  background: 'var(--kt-surface-soft)',
  overflow: 'hidden',
} as const;
const PROGRESS_FILL_STYLE = {
  height: '100%',
  background: 'var(--kt-primary)',
} as const;

export const ProgressBar = ({
  value,
  label,
  testId,
}: Readonly<{ value: number; label: string; testId?: string }>) => {
  const percent = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      data-testid={testId}
      data-percent={percent}
      style={PROGRESS_TRACK_STYLE}
    >
      <div style={{ ...PROGRESS_FILL_STYLE, width: `${String(percent)}%` }} />
    </div>
  );
};

const ProgressLine = ({
  state,
  label,
  progress,
  testId,
}: Readonly<{
  state: PoDetailState;
  label: string;
  progress: ReceiptProgressValue;
  testId?: string;
}>) => {
  const quantity = state.ports.decimalValue;
  return (
    <p data-testid={testId === undefined ? undefined : `${testId}-line`}>
      <span class="console-label">{label}</span>
      <ProgressBar
        value={progress.percent}
        label={`${label}收货进度`}
        {...(testId === undefined ? {} : { testId })}
      />
      <span>{`已收 ${quantity(progress.received)} / ${quantity(progress.ordered)}（${String(progress.percent)}%）`}</span>
    </p>
  );
};

// 抽屉收货进度：整单 + 逐行（草稿未签发不呈进度条）。
export const ReceiptProgressBars = ({ state }: Readonly<{ state: PoDetailState }>) => {
  const row = state.selected;
  if (!row) return null;
  const lines = linesOf(row);
  const { ports } = state;
  return (
    <div class="console-summary" data-testid="kt-po-progress">
      {ports.recordText(row, 'status', 'status') === 'DRAFT' ? (
        <p>
          <span class="console-label">收货进度</span>
          <span class="console-label">未签发，暂无收货</span>
        </p>
      ) : (
        <>
          <ProgressLine
            state={state}
            label="整单"
            progress={receiptProgressOf(lines)}
            testId="kt-po-progress-total"
          />
          {lines.map((line, index) => (
            <ProgressLine
              key={ports.textValue(line.id, String(index))}
              state={state}
              label={ports.textValue(line.sku, '—')}
              progress={receiptProgressOf([line])}
            />
          ))}
        </>
      )}
    </div>
  );
};

const FLOW_STEPS = ['DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED'] as const;
type FlowStepState = 'done' | 'current' | 'skipped' | 'upcoming';

// 流转位态：已过节点 done；当前节点 current；整单一次收齐直达 RECEIVED 时
// PARTIALLY_RECEIVED 标 skipped（未曾处于该态）；CANCELLED/未知态全部 upcoming。
const flowStepStates = (status: string): readonly FlowStepState[] => {
  const current = FLOW_STEPS.findIndex((step) => step === status);
  return FLOW_STEPS.map((step, position) => {
    if (current === -1 || position > current) return 'upcoming';
    if (position < current) return step === 'PARTIALLY_RECEIVED' ? 'skipped' : 'done';
    return 'current';
  });
};

const FLOW_NODE_STYLE = {
  display: 'inline-grid',
  placeItems: 'center',
  flexShrink: 0,
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  border: '1px solid var(--kt-border)',
  background: 'var(--kt-surface)',
  color: 'var(--kt-muted)',
  fontSize: '12px',
  lineHeight: 1,
} as const;
const FLOW_NODE_ACTIVE_STYLE = {
  borderColor: 'var(--kt-primary)',
  background: 'var(--kt-primary)',
  color: 'var(--kt-color-text-inverse)',
} as const;
const FLOW_NODE_SKIPPED_STYLE = { borderStyle: 'dashed' } as const;
const FLOW_LABEL_STYLE = { fontSize: 'var(--kt-font-size-caption)' } as const;
const FLOW_GLYPHS: Readonly<Record<FlowStepState, string>> = {
  done: '✓',
  current: '●',
  skipped: '–',
  upcoming: '○',
};

const flowNodeStyle = (stepState: FlowStepState) => {
  if (stepState === 'done' || stepState === 'current')
    return { ...FLOW_NODE_STYLE, ...FLOW_NODE_ACTIVE_STYLE };
  if (stepState === 'skipped') return { ...FLOW_NODE_STYLE, ...FLOW_NODE_SKIPPED_STYLE };
  return FLOW_NODE_STYLE;
};

// 状态流转图：四节点横向步进（已完成实心 ✓、当前实心 ●、跳过虚线 –、未到空心 ○）。
export const StatusFlow = ({ state }: Readonly<{ state: PoDetailState }>) => {
  const row = state.selected;
  if (!row) return null;
  const status = state.ports.recordText(row, 'status', 'status');
  const steps = flowStepStates(status);
  return (
    <div class="console-summary" data-testid="kt-po-flow" data-status={status}>
      <p>
        <span class="console-label">状态流转</span>
        <span class="console-label">{`当前：${STATUS_LABELS[status] ?? status}`}</span>
      </p>
      <div role="list" aria-label="采购订单状态流转">
        {/* 左右各留半个标签列宽，使节点圆心对齐下方等宽标签列。 */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12.5%' }}>
          {steps.map((stepState, index) => (
            <Fragment key={FLOW_STEPS[index]}>
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  data-connector={stepState === 'upcoming' ? 'pending' : 'reached'}
                  style={{
                    flex: '1 1 0',
                    height: '2px',
                    background: stepState === 'upcoming' ? 'var(--kt-border)' : 'var(--kt-primary)',
                  }}
                />
              ) : null}
              <span
                role="listitem"
                aria-current={stepState === 'current' ? 'step' : undefined}
                data-step={FLOW_STEPS[index]}
                data-state={stepState}
                style={flowNodeStyle(stepState)}
              >
                {FLOW_GLYPHS[stepState]}
              </span>
            </Fragment>
          ))}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${String(FLOW_STEPS.length)}, 1fr)`,
            textAlign: 'center',
          }}
        >
          {FLOW_STEPS.map((step) => (
            <span key={step} data-step-label={step} style={FLOW_LABEL_STYLE}>
              {STATUS_LABELS[step] ?? step}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// 合同文档工作流（自 vanilla purchase-documents 等价迁移）：上传（contract-document:
// manage）→ OCR 提交（UPLOADED+contract-ocr:operate）→ 复核（OCR_REVIEW+
// contract-ocr:review）→ 送签（READY_TO_SIGN+contract-signature:send）。
const documentActionGate = (
  state: PoDetailState,
  documentState: string,
): { may: boolean; kind: DocumentFormKind | null; label: string } => {
  if (documentState === 'UPLOADED' && state.permissions.has('contract-ocr:operate'))
    return { may: true, kind: 'ocr', label: '提交识别结果' };
  if (documentState === 'OCR_REVIEW' && state.permissions.has('contract-ocr:review'))
    return { may: true, kind: 'review', label: '复核并确认' };
  if (documentState === 'READY_TO_SIGN' && state.permissions.has('contract-signature:send'))
    return { may: true, kind: 'sign', label: '发起电子签署' };
  return { may: false, kind: null, label: '' };
};

export const PurchaseDocuments = ({ state }: Readonly<{ state: PoDetailState }>) => {
  const row = state.selected;
  if (!row) return null;
  const { ports } = state;
  const orderId = ports.textValue(row.id, '');
  const documents = state.documents.filter(
    (item) => ports.recordText(item, 'subjectId', 'subject_id') === orderId,
  );
  const mayUpload = state.permissions.has('contract-document:manage');
  return (
    <div class="console-summary" data-testid="kt-po-documents">
      <p class="console-label">采购合同文件</p>
      {documents.length === 0 ? (
        <p class="console-label">尚无合同文件</p>
      ) : (
        <ul>
          {documents.map((document, index) => {
            const documentId = ports.textValue(document.id, String(index));
            const documentState = ports.recordText(document, 'state', 'state', 'UPLOADED');
            const gate = documentActionGate(state, documentState);
            const kind = gate.kind;
            return (
              <li key={documentId}>
                {`${ports.recordText(document, 'attachmentName', 'attachment_name', '采购合同')} · ${ports.businessStateLabel(documentState)}`}
                {gate.may && kind ? (
                  <button
                    type="button"
                    class="secondary compact"
                    data-testid={`kt-po-doc-${kind}`}
                    onClick={() => {
                      state.openDocumentForm(documentId, kind);
                    }}
                  >
                    {gate.label}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {mayUpload ? (
        <button
          type="button"
          class="secondary compact"
          data-testid="kt-po-doc-upload"
          onClick={() => {
            const input = globalThis.document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf,.doc,.docx,.png,.jpg,.jpeg';
            input.addEventListener('change', () => {
              const file = input.files?.[0];
              if (file) void state.runUpload(orderId, file);
            });
            input.click();
          }}
        >
          上传采购合同
        </button>
      ) : null}
    </div>
  );
};

export const documentFormFields = (
  state: PoDetailState,
  document: ContractDocumentRow,
  kind: DocumentFormKind,
): readonly FormSectionField[] => {
  const { ports } = state;
  if (kind === 'ocr')
    return [
      { name: 'provider', label: 'OCR 服务', required: true, value: '企业OCR适配器' },
      { name: 'text', label: '识别全文', type: 'textarea', required: true },
      { name: 'contractNumber', label: '合同编号' },
      { name: 'supplier', label: '供应商' },
      { name: 'amount', label: '含税金额' },
      { name: 'confidence', label: '置信度（0-1）', required: true, value: '0.90' },
    ];
  if (kind === 'review')
    return [
      {
        name: 'text',
        label: '合同全文',
        type: 'textarea',
        required: true,
        value: ports.recordText(document, 'ocrText', 'ocr_text'),
      },
      {
        name: 'contractNumber',
        label: '合同编号',
        value: ports.textValue(
          (document.extractedFields as Record<string, unknown> | undefined)?.contractNumber,
          '',
        ),
      },
      {
        name: 'supplier',
        label: '供应商',
        value: ports.textValue(
          (document.extractedFields as Record<string, unknown> | undefined)?.supplier,
          '',
        ),
      },
      {
        name: 'amount',
        label: '含税金额',
        value: ports.textValue(
          (document.extractedFields as Record<string, unknown> | undefined)?.amount,
          '',
        ),
      },
    ];
  return [
    { name: 'provider', label: '电子签服务', required: true },
    { name: 'providerEnvelopeId', label: '签署任务编号', required: true },
    { name: 'signerName', label: '供应商签署人', required: true },
    { name: 'signerContact', label: '手机号或邮箱', required: true },
  ];
};
