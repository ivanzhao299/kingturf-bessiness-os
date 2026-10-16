import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { OperationsViewContext } from './operations-view-ports';

export function createPurchaseDocumentRow(
  context: OperationsViewContext,
  item: Record<string, unknown>,
  refresh: () => Promise<void>,
): HTMLElement {
  const { workspace, controller, permissions } = context;
  const { recordValue, recordText, textValue, businessStateLabel } = context.ports;
  const itemState = recordText(item, 'state', 'state');
  const documentRow = el(
    'div',
    'contract-document-row',
    `${recordText(item, 'attachmentName', 'attachment_name', '采购合同')} · ${businessStateLabel(itemState)}`,
  );
  if (itemState === 'UPLOADED' && permissions.has('contract-ocr:operate')) {
    const recognize = el('button', 'secondary compact', '提交识别结果');
    recognize.addEventListener('click', () => {
      openForm(
        workspace,
        '采购合同 OCR 识别结果',
        '识别内容完成复核后才能发起签署。',
        [
          { name: 'provider', label: 'OCR 服务', required: true, value: '企业OCR适配器' },
          { name: 'text', label: '识别全文', type: 'textarea', required: true },
          { name: 'contractNumber', label: '合同编号' },
          { name: 'supplier', label: '供应商' },
          { name: 'amount', label: '含税金额' },
          { name: 'confidence', label: '置信度（0-1）', required: true, value: '0.90' },
        ],
        '保存识别结果',
        async (values) => {
          await controller.submit(
            `/api/v1/contract-documents/${recordText(item, 'id', 'id')}/ocr`,
            {
              provider: values.provider ?? '',
              text: values.text ?? '',
              fields: {
                contractNumber: values.contractNumber ?? '',
                supplier: values.supplier ?? '',
                amount: values.amount ?? '',
              },
              confidence: Number(values.confidence ?? 0),
            },
          );
          await refresh();
        },
      );
    });
    documentRow.append(recognize);
  }
  if (itemState === 'OCR_REVIEW' && permissions.has('contract-ocr:review')) {
    const review = el('button', 'primary compact', '复核并确认');
    review.addEventListener('click', () => {
      openForm(
        workspace,
        '复核采购合同',
        '请对照原件校正全文与关键字段。',
        [
          {
            name: 'text',
            label: '合同全文',
            type: 'textarea',
            required: true,
            value: recordText(item, 'ocrText', 'ocr_text'),
          },
          {
            name: 'contractNumber',
            label: '合同编号',
            value: textValue(recordValue(item.extractedFields).contractNumber, ''),
          },
          {
            name: 'supplier',
            label: '供应商',
            value: textValue(recordValue(item.extractedFields).supplier, ''),
          },
          {
            name: 'amount',
            label: '含税金额',
            value: textValue(recordValue(item.extractedFields).amount, ''),
          },
        ],
        '确认可送签',
        async (values) => {
          await controller.submit(
            `/api/v1/contract-documents/${recordText(item, 'id', 'id')}/ocr-review`,
            {
              provider: recordText(item, 'ocrProvider', 'ocr_provider', '人工复核'),
              text: values.text ?? '',
              fields: {
                contractNumber: values.contractNumber ?? '',
                supplier: values.supplier ?? '',
                amount: values.amount ?? '',
              },
              confidence: Number(item.ocrConfidence ?? item.ocr_confidence ?? 1),
            },
          );
          await refresh();
        },
      );
    });
    documentRow.append(review);
  }
  if (itemState === 'READY_TO_SIGN' && permissions.has('contract-signature:send')) {
    const sign = el('button', 'primary compact', '发起电子签署');
    sign.addEventListener('click', () => {
      openForm(
        workspace,
        '发起采购合同电子签署',
        '录入签署平台任务信息并按顺序通知签署人。',
        [
          { name: 'provider', label: '电子签服务', required: true },
          { name: 'providerEnvelopeId', label: '签署任务编号', required: true },
          { name: 'signerName', label: '供应商签署人', required: true },
          { name: 'signerContact', label: '手机号或邮箱', required: true },
        ],
        '确认发起',
        async (values) => {
          await controller.submit(
            `/api/v1/contract-documents/${recordText(item, 'id', 'id')}/signature-envelopes`,
            {
              provider: values.provider ?? '',
              providerEnvelopeId: values.providerEnvelopeId ?? '',
              signingOrder: 'SEQUENTIAL',
              expiresAt: null,
              signers: [
                {
                  sequence: 1,
                  role: '供应商签署人',
                  name: values.signerName ?? '',
                  contact: values.signerContact ?? '',
                },
              ],
            },
          );
          await refresh();
        },
      );
    });
    documentRow.append(sign);
  }
  return documentRow;
}
