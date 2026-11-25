// FIN-1：过账应收的提交载荷。与旧版「过账应收发票」表单（receivables-view.ts，已随控制台
// 迁移退役）的 onSubmit 逐字节一致——键名、键序、取值与转换都原样保留：
//   · 客户与币种取所选订单的行（recordText：驼峰名 ?? 蛇形名 ?? 兜底）；
//   · documentType 固定 'INVOICE'；金额以字符串提交；
//   · 到期日转成当天 23:59:59.000Z 的 ISO 字符串；
//   · 旧表单（shared/forms.ts openForm）提交前对每个值 trim，这里原样保留。
// 独立成纯函数，便于与旧版公式逐字节对拍（ar-console.test.tsx）。
import type { ArConsolePorts } from './ar-ports';

type PayloadPorts = Pick<ArConsolePorts, 'recordText' | 'textValue' | 'orderOf'>;

export const arPostPayload = (
  ports: PayloadPorts,
  values: Readonly<Record<string, string>>,
): Record<string, unknown> => {
  const trimmed = (value: string | undefined): string => (value ?? '').trim();
  const order = ports.orderOf(trimmed(values.salesOrderId));
  if (!order) throw new Error('请选择有效订单');
  return {
    customerId: ports.recordText(order, 'customerId', 'customer_id'),
    salesOrderId: ports.textValue(order.id, ''),
    documentNumber: trimmed(values.documentNumber),
    documentType: 'INVOICE',
    currency: ports.recordText(order, 'currency', 'currency', 'CNY'),
    amount: trimmed(values.amount),
    dueAt: new Date(`${trimmed(values.dueAt)}T23:59:59.000Z`).toISOString(),
  };
};
