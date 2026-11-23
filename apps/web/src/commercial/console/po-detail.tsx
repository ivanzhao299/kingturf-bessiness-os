// U3-PROC-3：采购单控制台详情子组件（自 po-console 拆分——G1/G5 ≤800/≤200 行
// 纪律）：行项收货状态/收货记录/合同文档工作流区。只依赖状态最小面，结构与
// po-console 的 PoPageState 兼容（结构化子集，无循环依赖）。
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
