import type { AppRoute } from '../../shared/navigation';
import type { CommercialController } from './controller';
import { readableCommercialSources } from './readable-sources';

const routeSources: Readonly<Partial<Record<AppRoute, readonly string[]>>> = {
  opportunities: ['opportunities'],
  'technical-requirements': ['ctrs', 'opportunities'],
  'technical-solutions': ['technical-solutions', 'ctrs'],
  costing: [
    'cost-models',
    'cost-matrices',
    'cost-evaluations',
    'technical-solutions',
    'manufacturing-items',
  ],
  'sales-policies': ['sales-policies', 'sales-policy-evaluations', 'cost-evaluations'],
  quotes: ['quotes', 'ctrs', 'technical-solutions', 'cost-evaluations', 'sales-policies'],
  'credit-review': ['credit-limits', 'credit-decisions', 'quotes', 'opportunities'],
  contracts: ['contracts', 'contract-documents', 'quotes', 'opportunities'],
  'sales-orders': ['sales-orders', 'quotes', 'credit-decisions', 'contracts', 'opportunities'],
  'order-360': ['sales-orders', 'risk-policies'],
  receivables: ['ar-open-items', 'sales-orders', 'bank-payments', 'collection-cases'],
  collections: ['collection-cases', 'ar-open-items'],
  payments: ['bank-payments', 'reconciliation-runs'],
  commissions: ['commissions', 'commission-policies', 'sales-orders'],
  'business-risks': ['risk-evaluations', 'risk-policies', 'sales-orders'],
  'manufacturing-master': ['manufacturing-items', 'manufacturing-boms', 'manufacturing-routings'],
  procurement: [
    'suppliers',
    'procurement-rfqs',
    'supplier-quotes',
    'purchase-orders',
    'goods-receipts',
    'inventory-locations',
    'inventory-balances',
    'manufacturing-items',
    'contract-documents',
  ],
  'material-planning': ['mrp-policies', 'mrp-demands', 'mrp-runs', 'manufacturing-items'],
  'production-orders': [
    'production-orders',
    'manufacturing-items',
    'manufacturing-routings',
    'inventory-balances',
    'inventory-locations',
    'production-cost-policies',
    'production-cost-runs',
  ],
  'quality-inspection': [
    'quality-plans',
    'quality-inspections',
    'lot-traceability',
    'complaints',
    'complaint-sla-policies',
  ],
  shipments: ['shipment-releases', 'sales-orders', 'production-orders', 'lot-traceability'],
};

export function commercialRoutePlan(
  controller: Pick<CommercialController, 'permissions'>,
  route: AppRoute,
) {
  const wanted = new Set((routeSources[route] ?? []).map((source) => `/api/v1/${source}`));
  const all = route === 'overview';
  const readable = readableCommercialSources(controller).filter(
    ([permission, path]) => controller.permissions.has(permission) && (all || wanted.has(path)),
  );
  const opportunity =
    controller.permissions.has('opportunity:read') && (all || wanted.has('/api/v1/opportunities'));
  const dashboard = all && controller.permissions.has('executive-dashboard:read');
  const paths: string[] = readable.map(([, path]) => path);
  if (opportunity) paths.unshift('/api/v1/opportunities');
  if (dashboard) paths.push('/api/v1/executive-dashboard');
  return { readable, opportunity, dashboard, paths };
}

export const commercialDataRoutes = Object.keys(routeSources) as readonly AppRoute[];
