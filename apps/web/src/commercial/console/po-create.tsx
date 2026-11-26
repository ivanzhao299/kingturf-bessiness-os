// TD-MFG-013：采购单普通新建和从采购建议建立共用表单；建议入口固定引用，普通入口可手填 UUID。
import { DetailDrawer, FormSection, type FormSectionField } from '@kingturf/ui';
import type { PurchaseOrderConsolePorts } from './po-ports';

export type PurchaseProposalOrigin = Readonly<{
  id: string;
  itemVersionId: string;
  quantity: string;
  requiredAt: string;
}>;
type Choices = Pick<PurchaseOrderConsolePorts, 'supplierChoices' | 'itemVersionChoices'>;
type Props = Readonly<{
  ports: Choices;
  origin?: PurchaseProposalOrigin;
  error: string;
  close: () => void;
  submit: (values: Readonly<Record<string, string>>) => Promise<void>;
}>;

export const purchaseOrderPayload = (values: Readonly<Record<string, string>>) => ({
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
  ...(values.mrpProposalId?.trim() ? { mrpProposalId: values.mrpProposalId.trim() } : {}),
});

export const PurchaseOrderCreateDrawer = ({ ports, origin, error, close, submit }: Props) => (
  <DetailDrawer title="创建采购订单" onClose={close}>
    {origin ? (
      <label class="form-field" data-testid="kt-po-source-fixed">
        来源建议编号
        <input name="mrpProposalId" value={origin.id} readOnly aria-readonly="true" />
      </label>
    ) : null}
    <FormSection
      title="创建采购订单"
      description="订单只允许选择已准入供应商和已发布物料版本。"
      fields={[
        { name: 'poNumber', label: '采购订单号', required: true },
        ports.supplierChoices.length > 0
          ? ({
              name: 'supplierId',
              label: '供应商',
              type: 'select',
              required: true,
              options: ports.supplierChoices,
            } satisfies FormSectionField)
          : { name: 'supplierId', label: '供应商编号', required: true },
        ports.itemVersionChoices.length > 0
          ? ({
              name: 'itemVersionId',
              label: '物料',
              type: 'select',
              required: true,
              options: ports.itemVersionChoices,
              ...(origin ? { value: origin.itemVersionId } : {}),
            } satisfies FormSectionField)
          : {
              name: 'itemVersionId',
              label: '物料版本编号',
              required: true,
              ...(origin ? { value: origin.itemVersionId } : {}),
            },
        {
          name: 'quantity',
          label: '数量',
          type: 'number',
          required: true,
          ...(origin ? { value: origin.quantity } : {}),
        },
        { name: 'unitPrice', label: '含税单价', type: 'number', required: true },
        {
          name: 'requiredAt',
          label: '要求到货日',
          type: 'date',
          required: true,
          ...(origin ? { value: origin.requiredAt } : {}),
        },
        ...(origin
          ? []
          : [
              {
                name: 'mrpProposalId',
                label: '物料需求建议编号（可选）',
                hint: '填写本公司的采购类建议 UUID',
              },
            ]),
      ]}
      submitLabel="签发采购订单"
      error={error}
      onSubmit={(values) => submit(origin ? { ...values, mrpProposalId: origin.id } : values)}
    />
  </DetailDrawer>
);
