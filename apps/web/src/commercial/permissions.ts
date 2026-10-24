export type CommercialPermission =
  | 'opportunity:read'
  | 'opportunity:create'
  | 'opportunity:update'
  | 'opportunity:lifecycle'
  | 'ctr:read'
  | 'ctr:create'
  | 'ctr:update'
  | 'ctr:submit'
  | 'ctr:approve'
  | 'attachment:read'
  | 'attachment:manage'
  | 'technical-solution:read'
  | 'technical-solution:create'
  | 'technical-solution:update'
  | 'cost-model:read'
  | 'cost-model:manage'
  | 'cost-matrix:read'
  | 'cost-matrix:manage'
  | 'cost-matrix:calculate'
  | 'cost:read'
  | 'cost:evaluate'
  | 'sales-policy:manage'
  | 'sales-policy:read'
  | 'sales-policy:evaluate'
  | 'quote:read'
  | 'quote:create'
  | 'quote:update'
  | 'quote:approve'
  | 'quote:issue'
  | 'credit:read'
  | 'credit:evaluate'
  | 'credit:approve'
  | 'contract:read'
  | 'contract:revise'
  | 'contract:sign'
  | 'contract-document:read'
  | 'contract-document:manage'
  | 'contract-ocr:operate'
  | 'contract-ocr:review'
  | 'contract-signature:send'
  | 'contract-signature:confirm'
  | 'sales-order:read'
  | 'sales-order:create'
  | 'order-360:read'
  | 'ar:read'
  | 'ar:post'
  | 'bank-payment:read'
  | 'bank-payment:intake'
  | 'reconciliation:read'
  | 'reconciliation:run'
  | 'allocation:create'
  | 'commission-policy:read'
  | 'commission-policy:manage'
  | 'commission:read'
  | 'commission:accrue'
  | 'commission:manage'
  | 'commission:pay'
  | 'risk-policy:read'
  | 'risk-policy:manage'
  | 'risk:read'
  | 'risk:evaluate'
  | 'risk:manage'
  | 'executive-dashboard:read'
  | 'manufacturing-item:read'
  | 'manufacturing-item:manage'
  | 'bom:read'
  | 'bom:manage'
  | 'routing:read'
  | 'routing:manage'
  | 'supplier:read'
  | 'supplier:manage'
  | 'procurement:read'
  | 'procurement:manage'
  | 'inventory:read'
  | 'inventory:move'
  | 'mrp-policy:read'
  | 'mrp-policy:manage'
  | 'mrp:read'
  | 'mrp:run'
  | 'mrp:approve'
  | 'mrp:release'
  | 'production:read'
  | 'production:plan'
  | 'production:material'
  | 'production:report'
  | 'production:close'
  | 'manufacturing-cost:read'
  | 'manufacturing-cost:policy'
  | 'manufacturing-cost:calculate'
  | 'manufacturing-cost:approve'
  | 'shipment:read'
  | 'shipment:request'
  | 'shipment:approve-exception'
  | 'shipment:release'
  | 'shipment:dispatch'
  | 'shipment:track'
  | 'collection:read'
  | 'collection:manage'
  | 'collection:escalate'
  | 'collection:close'
  | 'legal-case:read'
  | 'legal-case:decide'
  | 'debt-evidence:generate'
  | 'quality-plan:read'
  | 'quality-plan:manage'
  | 'quality:read'
  | 'quality:inspect'
  | 'quality:disposition'
  | 'traceability:read'
  | 'complaint:read'
  | 'complaint:create'
  | 'complaint:triage'
  | 'complaint:assign'
  | 'complaint:close'
  | 'complaint-sla:read'
  | 'complaint-sla:manage'
  | 'ncr:read'
  | 'ncr:manage'
  | 'ncr:disposition'
  | 'ncr:close'
  | 'capa:read'
  | 'capa:manage'
  | 'capa:verify';

export function isCommercialPermission(item: string): item is CommercialPermission {
  return [
    'opportunity:',
    'ctr:',
    'attachment:',
    'technical-solution:',
    'cost-model:',
    'cost-matrix:',
    'cost:',
    'sales-policy:',
    'quote:',
    'credit:',
    'contract:',
    'sales-order:',
    'order-360:',
    'ar:',
    'bank-payment:',
    'reconciliation:',
    'allocation:',
    'commission-policy:',
    'commission:',
    'risk-policy:',
    'risk:',
    'executive-dashboard:',
    'manufacturing-item:',
    'manufacturing-cost:',
    'bom:',
    'routing:',
    'supplier:',
    'procurement:',
    'inventory:',
    'mrp-policy:',
    'mrp:',
    'production:',
    'quality-plan:',
    'quality:',
    'traceability:',
    'complaint:',
    'complaint-sla:',
    'ncr:',
    'capa:',
    'shipment:',
    'collection:',
    'legal-case:',
    'debt-evidence:',
  ].some((prefix) => item.startsWith(prefix));
}
