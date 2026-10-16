import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { OperationsViewContext } from './operations-view-ports';

export function createSupplierPanel(
  context: OperationsViewContext,
  suppliers: readonly Record<string, unknown>[],
  manufacturingItems: readonly Record<string, unknown>[],
  refresh: () => Promise<void>,
): HTMLElement {
  const { workspace, controller, permissions } = context;
  const { recordValue, recordText, businessStateLabel } = context.ports;
  const supplierPanel = el('article', 'procurement-column supplier-register');
  supplierPanel.append(el('h3', '', '供应商与准入'));
  for (const supplier of suppliers) {
    const qualifications = Array.isArray(supplier.qualifications)
      ? supplier.qualifications.map(recordValue)
      : [];
    supplierPanel.append(
      el(
        'div',
        'procurement-card',
        `${recordText(supplier, 'supplierNumber', 'supplier_number')} · ${recordText(supplier, 'name', 'name')}\n${businessStateLabel(recordText(supplier, 'status', 'status'))} · 账期 ${recordText(supplier, 'paymentTermsDays', 'payment_terms_days')} 天 · 已准入 ${String(qualifications.filter((item) => item.status === 'APPROVED').length)} 项`,
      ),
    );
  }
  if (permissions.has('supplier:manage')) {
    const createSupplier = el('button', 'primary', '＋ 新建供应商');
    createSupplier.addEventListener('click', () => {
      openForm(
        workspace,
        '新建供应商',
        '建立供应商编号、结算条件和质量评级。',
        [
          { name: 'supplierNumber', label: '供应商编号', required: true },
          { name: 'name', label: '供应商名称', required: true },
          {
            name: 'paymentTermsDays',
            label: '账期（天）',
            type: 'number',
            required: true,
            value: '30',
          },
          {
            name: 'qualityRating',
            label: '质量评分（0-100）',
            type: 'number',
            required: true,
            value: '90',
          },
          { name: 'contactName', label: '联系人', required: true },
          { name: 'contactPhone', label: '联系电话', type: 'tel', required: true },
        ],
        '保存供应商',
        async (values) => {
          await controller.submit('/api/v1/suppliers', {
            supplierNumber: values.supplierNumber,
            name: values.name,
            currency: 'CNY',
            paymentTermsDays: Number(values.paymentTermsDays),
            qualityRatingBasisPoints: Number(values.qualityRating) * 100,
            contact: { name: values.contactName, phone: values.contactPhone },
          });
          await refresh();
        },
      );
    });
    supplierPanel.append(createSupplier);
    const qualify = el('button', 'secondary', '＋ 物料准入');
    qualify.addEventListener('click', () => {
      openForm(
        workspace,
        '供应商物料准入',
        '准入引用精确的已发布物料版本，并保留审核证据和有效期。',
        [
          {
            name: 'supplierId',
            label: '供应商',
            type: 'select',
            required: true,
            options: suppliers.map((item) => ({
              value: String(item.id),
              label: recordText(item, 'name', 'name'),
            })),
          },
          {
            name: 'itemVersionId',
            label: '物料版本',
            type: 'select',
            required: true,
            options: manufacturingItems
              .filter((item) => recordText(item, 'status', 'status') === 'PUBLISHED')
              .map((item) => ({
                value: String(item.id),
                label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
              })),
          },
          { name: 'validFrom', label: '有效起始日', type: 'date', required: true },
          { name: 'validTo', label: '有效截止日', type: 'date', required: true },
          {
            name: 'minimumOrderQuantity',
            label: '最小订购量',
            type: 'number',
            required: true,
            value: '0',
          },
          { name: 'leadTimeDays', label: '交期（天）', type: 'number', required: true },
          { name: 'evidenceReference', label: '审核证据编号', required: true },
        ],
        '批准准入',
        async (values) => {
          await controller.submit(`/api/v1/suppliers/${values.supplierId ?? ''}/qualifications`, {
            itemVersionId: values.itemVersionId,
            status: 'APPROVED',
            validFrom: values.validFrom,
            validTo: values.validTo,
            minimumOrderQuantity: values.minimumOrderQuantity,
            leadTimeDays: Number(values.leadTimeDays),
            evidence: { reference: values.evidenceReference },
          });
          await refresh();
        },
      );
    });
    supplierPanel.append(qualify);
  }
  return supplierPanel;
}
