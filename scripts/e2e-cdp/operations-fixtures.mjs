// Synthetic read-only operations records; never forward to a real API.
export const operationsPermissions = [
  'manufacturing-item:read',
  'bom:read',
  'routing:read',
  'supplier:read',
  'procurement:read',
  'inventory:read',
  'mrp-policy:read',
  'mrp:read',
  'quality-plan:read',
  'quality:read',
  'traceability:read',
  'complaint:read',
];

const records = [
  [
    'manufacturing-items',
    { id: 'cdp-item-a', sku: 'CDP-FG-A', name: 'CDP合成物料', status: 'PUBLISHED', version: 1 },
  ],
  [
    'manufacturing-boms',
    { id: 'cdp-bom-a', code: 'CDP-BOM-A', name: 'CDP合成BOM', status: 'PUBLISHED', version: 1 },
  ],
  [
    'manufacturing-routings',
    { id: 'cdp-routing-a', code: 'CDP-RT-A', name: 'CDP合成工艺', status: 'PUBLISHED', version: 1 },
  ],
  [
    'suppliers',
    {
      id: 'cdp-supplier-a',
      supplierNumber: 'CDP-SUP-A',
      name: 'CDP合成供应商',
      status: 'APPROVED',
      paymentTermsDays: 30,
      qualifications: [],
    },
  ],
  ['procurement-rfqs', { id: 'cdp-rfq-a', rfqNumber: 'CDP-RFQ-A', status: 'ISSUED', lines: [] }],
  [
    'supplier-quotes',
    {
      id: 'cdp-supplier-quote-a',
      quoteReference: 'CDP-SQ-A',
      supplierName: 'CDP合成供应商',
      validUntil: '2099-12-31',
    },
  ],
  [
    'purchase-orders',
    {
      id: 'cdp-purchase-a',
      poNumber: 'CDP-PO-A',
      status: 'ISSUED',
      supplierName: 'CDP合成供应商',
      lines: [{ id: 'cdp-purchase-line-a', quantity: '100', unitPrice: '2' }],
    },
  ],
  [
    'goods-receipts',
    { id: 'cdp-receipt-a', receiptNumber: 'CDP-GR-A', status: 'RECEIVED', lines: [] },
  ],
  ['inventory-locations', { id: 'cdp-location-a', code: 'CDP-LOC-A', name: 'CDP合成库位' }],
  [
    'inventory-balances',
    {
      sku: 'CDP-FG-A',
      lotNumber: 'CDP-LOT-A',
      locationCode: 'CDP-LOC-A',
      quantity: '100',
      qualityStatus: 'RELEASED',
      movements: [],
    },
  ],
  [
    'mrp-policies',
    {
      id: 'cdp-mrp-policy-a',
      sku: 'CDP-FG-A',
      makeOrBuy: 'BUY',
      safetyStock: '10',
      minimumOrderQuantity: '10',
      orderMultiple: '5',
      leadTimeDays: 7,
    },
  ],
  ['mrp-demands', { id: 'cdp-demand-a', sku: 'CDP-FG-A', quantity: '50' }],
  [
    'mrp-runs',
    {
      id: 'cdp-mrp-run-a',
      runNumber: 'CDP-MRP-A',
      status: 'COMPLETED',
      asOf: '2026-10-01',
      freezeUntil: '2026-10-07',
      inputHash: 'cdp-mrp-input-hash',
      proposals: [
        {
          id: 'cdp-proposal-a',
          sku: 'CDP-FG-A',
          proposalType: 'BUY',
          effectiveState: 'PROPOSED',
          quantity: '50',
          startAt: '2026-10-01',
          dueAt: '2026-10-15',
          frozen: false,
          explanation: {
            grossDemand: '140',
            safetyStock: '10',
            onHand: '100',
            scheduledReceipts: '0',
            netRequirement: '50',
            plannedQuantity: '50',
          },
        },
      ],
    },
  ],
  [
    'quality-plans',
    {
      id: 'cdp-quality-plan-a',
      code: 'CDP-QP-A',
      name: 'CDP合成检验计划',
      status: 'PUBLISHED',
      version: 1,
      inspectionStage: 'FINAL',
      characteristics: [{ code: 'HEIGHT', name: '草高' }],
    },
  ],
  [
    'quality-inspections',
    {
      id: 'cdp-inspection-a',
      inspectionNumber: 'CDP-QI-A',
      lotNumber: 'CDP-LOT-A',
      planCode: 'CDP-QP-A',
      state: 'DISPOSITIONED',
      results: [],
      events: [],
    },
  ],
  [
    'lot-traceability',
    {
      id: 'cdp-lot-a',
      lotId: 'cdp-lot-a',
      lotNumber: 'CDP-LOT-A',
      sku: 'CDP-FG-A',
      qualityStatus: 'RELEASED',
      usedByOrders: [],
      producedRolls: [],
      movements: [],
    },
  ],
  [
    'complaints',
    {
      id: 'cdp-complaint-a',
      complaintNumber: 'CDP-COMPLAINT-A',
      state: 'REPORTED',
      severity: 'LOW',
      version: 1,
      customerName: 'CDP客户甲',
      closureDueAt: '2099-12-31',
      assignedTo: null,
    },
  ],
];

export const operationsRoutes = records.map(([route]) => [
  `/api/v1/${route}`,
  `operations:${route}`,
]);
export const operationsValues = Object.fromEntries(
  records.map(([route, record]) => [`operations:${route}`, { items: [record], nextCursor: null }]),
);
