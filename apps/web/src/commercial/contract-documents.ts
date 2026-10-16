import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { CreditContractViewContext } from './credit-contract-view-ports';

function createContractDocumentRow(
  context: CreditContractViewContext,
  document: Record<string, unknown>,
): HTMLElement {
  const { workspace, status, controller, permissions } = context;
  const { textValue, recordText, recordValue, businessStateLabel } = context.ports;
  const documentState = recordText(document, 'state', 'state', 'UPLOADED');
  const row = el('div', 'contract-document-row');
  row.append(
    el('span', '', recordText(document, 'attachmentName', 'attachment_name', '合同文件')),
    el(
      'span',
      `ctr-state state-${documentState.toLocaleLowerCase()}`,
      businessStateLabel(documentState),
    ),
  );
  if (documentState === 'UPLOADED' && permissions.has('contract-ocr:operate')) {
    const ocr = el('button', 'secondary compact', '提交识别结果');
    ocr.addEventListener('click', () => {
      openForm(
        workspace,
        '合同 OCR 识别结果',
        '识别结果须经人工复核后方可送签。',
        [
          { name: 'provider', label: 'OCR 服务', required: true, value: '企业OCR适配器' },
          { name: 'text', label: '识别全文', type: 'textarea', required: true },
          { name: 'contractNumber', label: '识别合同编号' },
          { name: 'counterparty', label: '识别相对方' },
          { name: 'amount', label: '识别含税金额' },
          { name: 'confidence', label: '置信度（0-1）', required: true, value: '0.90' },
        ],
        '保存识别结果',
        async (values) => {
          await controller.submit(
            `/api/v1/contract-documents/${recordText(document, 'id', 'id')}/ocr`,
            {
              provider: values.provider ?? '',
              text: values.text ?? '',
              fields: {
                contractNumber: values.contractNumber ?? '',
                counterparty: values.counterparty ?? '',
                amount: values.amount ?? '',
              },
              confidence: Number(values.confidence ?? 0),
            },
          );
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    row.append(ocr);
  }
  if (documentState === 'OCR_REVIEW' && permissions.has('contract-ocr:review')) {
    const review = el('button', 'primary compact', '复核并确认');
    review.addEventListener('click', () => {
      openForm(
        workspace,
        '复核合同识别结果',
        '请对照合同原件校正关键字段。',
        [
          {
            name: 'text',
            label: '合同全文',
            type: 'textarea',
            required: true,
            value: recordText(document, 'ocrText', 'ocr_text'),
          },
          {
            name: 'contractNumber',
            label: '合同编号',
            value: textValue(recordValue(document.extractedFields).contractNumber, ''),
          },
          {
            name: 'counterparty',
            label: '相对方',
            value: textValue(recordValue(document.extractedFields).counterparty, ''),
          },
          {
            name: 'amount',
            label: '含税金额',
            value: textValue(recordValue(document.extractedFields).amount, ''),
          },
        ],
        '确认可送签',
        async (values) => {
          await controller.submit(
            `/api/v1/contract-documents/${recordText(document, 'id', 'id')}/ocr-review`,
            {
              provider: recordText(document, 'ocrProvider', 'ocr_provider', '人工复核'),
              text: values.text ?? '',
              fields: {
                contractNumber: values.contractNumber ?? '',
                counterparty: values.counterparty ?? '',
                amount: values.amount ?? '',
              },
              confidence: Number(document.ocrConfidence ?? document.ocr_confidence ?? 1),
            },
          );
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    row.append(review);
  }
  if (documentState === 'READY_TO_SIGN' && permissions.has('contract-signature:send')) {
    const send = el('button', 'primary compact', '发起电子签署');
    send.addEventListener('click', () => {
      openForm(
        workspace,
        '发起电子签署',
        '签署服务商回执用于后续状态回调和证据归档。',
        [
          { name: 'provider', label: '电子签服务', required: true },
          { name: 'providerEnvelopeId', label: '签署任务编号', required: true },
          { name: 'signerName', label: '签署人', required: true },
          { name: 'signerContact', label: '手机号或邮箱', required: true },
        ],
        '确认发起',
        async (values) => {
          await controller.submit(
            `/api/v1/contract-documents/${recordText(document, 'id', 'id')}/signature-envelopes`,
            {
              provider: values.provider ?? '',
              providerEnvelopeId: values.providerEnvelopeId ?? '',
              signingOrder: 'SEQUENTIAL',
              expiresAt: null,
              signers: [
                {
                  sequence: 1,
                  role: '相对方签署人',
                  name: values.signerName ?? '',
                  contact: values.signerContact ?? '',
                },
              ],
            },
          );
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    row.append(send);
  }
  return row;
}

export function createContractDocumentPanel(
  context: CreditContractViewContext,
  contract: Record<string, unknown>,
): HTMLElement {
  const { status, controller, permissions } = context;
  const { recordText } = context.ports;
  const contractDocuments = (controller.views.get('/api/v1/contract-documents') ?? []).filter(
    (document) =>
      recordText(document, 'subjectId', 'subject_id') === recordText(contract, 'id', 'id'),
  );
  const documentPanel = el('div', 'contract-document-panel');
  documentPanel.append(el('strong', '', '合同文件'));
  for (const document of contractDocuments) {
    const row = createContractDocumentRow(context, document);
    documentPanel.append(row);
  }
  if (permissions.has('contract-document:manage') && controller.api.uploadContractDocument) {
    const upload = el('button', 'secondary compact', '上传合同原件');
    upload.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,.doc,.docx,.png,.jpg,.jpeg';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;
        void controller.api
          .uploadContractDocument?.(
            'SALES',
            'contract-revision',
            recordText(contract, 'id', 'id'),
            file,
          )
          .then(async () => {
            await controller.load();
            status.textContent = `${file.name} 已上传，等待 OCR 识别`;
          });
      });
      input.click();
    });
    documentPanel.append(upload);
  }
  return documentPanel;
}
