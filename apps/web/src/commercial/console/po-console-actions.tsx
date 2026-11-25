// U3-PROC-3：采购单控制台动作工厂（自 PurchaseOrderConsolePage 拆分——G5 ≤200
// 行纪律）：刷新/创建/状态流转/合同文档动作闭包。bundle 为页面 signal 束的最小面。
import type { Signal } from '@preact/signals';
import type { ContractDocumentRow, PurchaseOrderConsolePorts, PurchaseOrderRow } from './po-ports';
import type { DocumentFormKind } from './po-detail';
import { failureMessage } from '../../shared/api-error-message';
import { reloadSelectedDetail, syncSelected } from './selected-sync';

export type PoFormActionKind = 'create' | null;

export type PoBundle = Readonly<{
  orders: Signal<readonly PurchaseOrderRow[]>;
  documents: Signal<readonly ContractDocumentRow[]>;
  loadError: Signal<string>;
  submitError: Signal<string>;
  loading: Signal<boolean>;
  selected: Signal<PurchaseOrderRow | null>;
  activeForm: Signal<PoFormActionKind>;
  activeDocumentForm: Signal<Readonly<{ documentId: string; kind: DocumentFormKind }> | null>;
}>;

export function createPurchaseOrderActions(ports: PurchaseOrderConsolePorts, bundle: PoBundle) {
  // 抽屉里开着的那条：换成刷新后的行（已不在列表里则关闭抽屉），并重读详情（TD-WF-008）。
  const selection = () => ({
    selected: bundle.selected,
    rows: bundle.orders.value,
    idOf: (row: PurchaseOrderRow) => ports.textValue(row.id, ''),
    loadDetail: ports.loadDetail,
  });

  const applySnapshot = (snapshot: {
    orders: readonly PurchaseOrderRow[];
    documents: readonly ContractDocumentRow[];
  }): void => {
    bundle.orders.value = snapshot.orders;
    bundle.documents.value = snapshot.documents;
    if (syncSelected(selection())) void reloadSelectedDetail(selection());
  };

  const fail = (error: unknown, fallback: string): void => {
    const message = failureMessage(error, fallback);
    if (bundle.selected.value !== null || bundle.activeForm.value !== null)
      bundle.submitError.value = message;
    else bundle.loadError.value = message;
  };
  const closeForm = (): void => {
    bundle.activeForm.value = null;
    bundle.submitError.value = '';
  };

  const runRefresh = async (): Promise<void> => {
    bundle.loading.value = true;
    try {
      applySnapshot(await ports.refresh());
      bundle.loadError.value = '';
    } catch (error: unknown) {
      fail(error, '采购订单加载失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  // 创建载荷与原 vanilla「创建并签发采购订单」表单逐字节一致（supplierQuoteId null、
  // currency 固定 CNY、issue:true、单行项含含税单价）。
  const runCreate = async (values: Readonly<Record<string, string>>): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit('/api/v1/purchase-orders', {
        poNumber: values.poNumber ?? '',
        supplierId: values.supplierId ?? '',
        supplierQuoteId: null,
        currency: 'CNY',
        issue: true,
        lines: [
          {
            itemVersionId: values.itemVersionId ?? '',
            quantity: values.quantity ?? '',
            unitPrice: values.unitPrice ?? '',
            requiredAt: values.requiredAt ?? '',
          },
        ],
      });
      applySnapshot(await ports.refresh());
      closeForm();
    } catch (error: unknown) {
      fail(error, '采购订单创建失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  // 状态流转走统一动作端点（PUT state：issue 分派 legacy issuePurchaseOrder；
  // cancel additive——独立审批层缺失登记 TD-PROC-003）。
  const runState = async (row: PurchaseOrderRow, action: 'issue' | 'cancel'): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit(
        `/api/v1/purchase-orders/${ports.textValue(row.id, '')}/state`,
        { action },
        'PUT',
      );
      applySnapshot(await ports.refresh());
      closeForm();
    } catch (error: unknown) {
      fail(error, '采购订单状态流转失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const runUpload = async (orderId: string, file: File): Promise<void> => {
    bundle.submitError.value = '';
    try {
      await ports.uploadContractDocument('PURCHASE', 'purchase-order', orderId, file);
      applySnapshot(await ports.refresh());
    } catch (error: unknown) {
      fail(error, '采购合同上传失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  // 合同文档三态动作（自 vanilla purchase-documents 等价迁移，载荷逐字段一致）。
  const runDocumentAction = async (
    documentId: string,
    kind: DocumentFormKind,
    values: Readonly<Record<string, string>>,
  ): Promise<void> => {
    bundle.submitError.value = '';
    try {
      if (kind === 'ocr')
        await ports.submit(`/api/v1/contract-documents/${documentId}/ocr`, {
          provider: values.provider ?? '',
          text: values.text ?? '',
          fields: {
            contractNumber: values.contractNumber ?? '',
            supplier: values.supplier ?? '',
            amount: values.amount ?? '',
          },
          confidence: Number(values.confidence ?? 0),
        });
      else if (kind === 'review') {
        const document = bundle.documents.value.find(
          (item) => ports.textValue(item.id, '') === documentId,
        );
        await ports.submit(`/api/v1/contract-documents/${documentId}/ocr-review`, {
          provider: ports.recordText(document ?? {}, 'ocrProvider', 'ocr_provider', '人工复核'),
          text: values.text ?? '',
          fields: {
            contractNumber: values.contractNumber ?? '',
            supplier: values.supplier ?? '',
            amount: values.amount ?? '',
          },
          confidence: Number(document?.ocrConfidence ?? document?.ocr_confidence ?? 1),
        });
      } else
        await ports.submit(`/api/v1/contract-documents/${documentId}/signature-envelopes`, {
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
        });
      applySnapshot(await ports.refresh());
      bundle.activeDocumentForm.value = null;
    } catch (error: unknown) {
      bundle.submitError.value = failureMessage(error, '合同文档操作失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  return { fail, closeForm, runRefresh, runCreate, runState, runUpload, runDocumentAction };
}
