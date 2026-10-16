export function assignCommercialRouteViews(workspace: HTMLElement): void {
  const commercialRouteTokens: Readonly<Record<string, string>> = {
    'executive-dashboard': 'overview',
    'pipeline-board': 'opportunities',
    'ctr-workbench': 'technical-requirements',
    'solution-workbench': 'technical-solutions',
    'cost-workbench': 'costing',
    'policy-workbench': 'sales-policies',
    'quote-workbench': 'quotes',
    'credit-workbench': 'credit-review',
    'contract-workbench': 'contracts',
    'order-workbench': 'sales-orders',
    'order-360-workbench': 'order-360',
    'ar-workbench': 'receivables',
    'collection-workbench': 'collections',
    'payment-workbench': 'payments',
    'commission-workbench': 'commissions',
    'risk-workbench': 'business-risks',
    'manufacturing-workbench': 'manufacturing-master',
    'procurement-workbench': 'procurement',
    'mrp-workbench': 'material-planning',
    'production-workbench': 'production-orders',
    'quality-workbench': 'quality-inspection',
    'shipment-workbench': 'shipments',
  };
  for (const child of Array.from(workspace.children)) {
    const routeTokens = Object.entries(commercialRouteTokens).find(([className]) =>
      child.className.split(' ').includes(className),
    )?.[1];
    if (routeTokens) child.setAttribute('data-route-view', routeTokens);
  }
}

export function assignLegacyRouteViews(workspace: HTMLElement): void {
  const genericRouteTokens: Readonly<Record<string, string>> = {
    'opportunity-pipeline': 'opportunities',
    'ctr-revisions': 'technical-requirements',
    'technical-solution-history': 'technical-solutions',
    'cost-explanation': 'costing',
    'policy-explanation': 'sales-policies',
    'quote-builder': 'quotes',
    'credit-review': 'credit-review',
    'contract-evidence': 'contracts',
    'order-release': 'sales-orders',
    'ar-aging': 'receivables',
    'payment-intake': 'payments',
    reconciliation: 'payments',
  };
  for (const child of Array.from(workspace.children)) {
    const routeTokens = Object.entries(genericRouteTokens).find(([className]) =>
      child.className.split(' ').includes(className),
    )?.[1];
    if (routeTokens) child.setAttribute('data-route-view', routeTokens);
  }
}
