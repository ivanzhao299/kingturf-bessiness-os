import type { AppRoute } from './navigation';
import type { BusinessDocumentTemplate } from './shell-types';
export const onlineTemplateKey = (template: BusinessDocumentTemplate, route: AppRoute): string =>
  `${template.file.slice(0, 2)}-${route}`;

export const BUSINESS_DOCUMENT_SUBJECTS: Partial<
  Record<AppRoute, Readonly<{ endpoint: string; type: string; numberKeys: readonly string[] }>>
> = {
  quotes: {
    endpoint: '/api/v1/quotes',
    type: 'quote',
    numberKeys: ['quoteNumber', 'number', 'id'],
  },
  contracts: {
    endpoint: '/api/v1/contracts',
    type: 'contract',
    numberKeys: ['contractNumber', 'number', 'id'],
  },
  'sales-orders': {
    endpoint: '/api/v1/sales-orders',
    type: 'sales-order',
    numberKeys: ['orderNumber', 'number', 'id'],
  },
  'production-orders': {
    endpoint: '/api/v1/production-orders',
    type: 'production-order',
    numberKeys: ['orderNumber', 'number', 'id'],
  },
  shipments: {
    endpoint: '/api/v1/shipment-releases',
    type: 'shipment-release',
    numberKeys: ['trackingNumber', 'shipmentNumber', 'id'],
  },
};

export const businessDocumentSubjectLabel = (
  item: Record<string, unknown>,
  keys: readonly string[],
): string => {
  for (const key of keys) if (typeof item[key] === 'string' && item[key]) return item[key];
  return typeof item.id === 'string' ? item.id : '业务记录';
};

export const businessDocumentPrefill = (item: Record<string, unknown> | undefined): string => {
  if (!item) return '';
  const labels: Readonly<Record<string, string>> = {
    quoteNumber: '报价编号',
    contractNumber: '合同编号',
    orderNumber: '订单编号',
    customerName: '客户名称',
    totalAmount: '含税金额',
    currency: '币种',
    deliveryDate: '交付日期',
    trackingNumber: '物流单号',
  };
  return Object.entries(labels)
    .filter(([key]) => item[key] !== undefined && item[key] !== null)
    .map(([key, label]) => `${label}：${String(item[key])}`)
    .join('\n');
};
