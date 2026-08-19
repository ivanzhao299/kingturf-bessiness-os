import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOOTSTRAP_TITLE,
  CommercialController,
  CrmController,
  commercialWorkspaceStructure,
  commercialRevisionPath,
  createCrmShell,
  appRouteFromHash,
  type CrmApi,
  type Customer,
  type Lead,
  viewportFor,
  visibleCrmSections,
  visibleCommercialSections,
  inventoryLocationOption,
  technicalSolutionOpportunityId,
} from './bootstrap';

class RenderedElement {
  public className = '';
  public children: RenderedElement[] = [];
  public privateText = '';
  public disabled = false;
  public placeholder = '';
  public type = '';
  public constructor(public readonly tagName: string) {}
  public set textContent(text: string) {
    this.privateText = text;
  }
  public get textContent(): string {
    return `${this.privateText}${this.children.map((child) => child.textContent).join('')}`;
  }
  public append(...children: RenderedElement[]): void {
    this.children.push(...children);
  }
  public addEventListener(): void {
    return undefined;
  }
  public setAttribute(): void {
    return undefined;
  }
  public replaceWith(): void {
    return undefined;
  }
  public findByClass(className: string): RenderedElement[] {
    const own = this.className.split(' ').includes(className) ? [this] : [];
    return [...own, ...this.children.flatMap((child) => child.findByClass(className))];
  }
}

beforeEach(() => {
  vi.stubGlobal('document', {
    createElement: (tagName: string) => new RenderedElement(tagName),
  });
});

const customer: Customer = {
  id: 'customer-1',
  customerNumber: 'C-1',
  name: 'Acme Turf',
  status: 'PROSPECT',
  ownerId: null,
  version: 1,
};
const lead: Lead = {
  id: 'lead-1',
  title: 'School pitch',
  source: 'web',
  status: 'POOL',
  ownerId: null,
  version: 1,
  createdAt: '2026-08-10T08:00:00.000Z',
};
const api = () => {
  const spies = {
    listEmployees: vi.fn(() =>
      Promise.resolve([
        { id: 'employee-1', employeeNumber: 'E-001', displayName: '销售一号', active: true },
      ]),
    ),
    listCustomers: vi.fn(() => Promise.resolve([customer])),
    customer360: vi.fn(() =>
      Promise.resolve({
        customer,
        contacts: [
          {
            id: 'contact-1',
            name: 'Buyer Zhang',
            title: '采购经理',
            email: 'buyer@example.test',
            primary: true,
          },
        ],
        ownership: [
          {
            id: 'ownership-1',
            ownerId: 'employee-1',
            reason: '华东区域',
            startedAt: '2026-08-11T08:00:00.000Z',
            endedAt: null,
          },
        ],
        leads: [lead],
        opportunities: [
          {
            id: 'opportunity-1',
            name: '学校球场改造',
            status: 'QUALIFIED',
            value: { amount: '680000', currency: 'CNY' },
            probabilityBasisPoints: 6500,
            expectedCloseDate: '2026-09-30',
          },
        ],
        activities: [
          {
            id: 'activity-later',
            type: 'CALL',
            summary: '确认预算',
            occurredAt: '2026-08-12T09:00:00.000Z',
          },
          {
            id: 'activity-earlier',
            type: 'NOTE',
            summary: '首次接洽',
            occurredAt: '2026-08-11T09:00:00.000Z',
          },
        ],
        unavailableSections: ['orders', 'finance'],
      }),
    ),
    createCustomer: vi.fn(() => Promise.resolve(customer)),
    transitionCustomer: vi.fn(() => Promise.resolve({ ...customer, status: 'ACTIVE', version: 2 })),
    addContact: vi.fn(() => Promise.resolve()),
    addActivity: vi.fn(() => Promise.resolve()),
    assignCustomer: vi.fn(() => Promise.resolve(customer)),
    listPool: vi.fn(() => Promise.resolve([lead])),
    listLeads: vi.fn(() => Promise.resolve([])),
    createLead: vi.fn(() => Promise.resolve(lead)),
    claimLead: vi.fn(() => Promise.resolve({ ...lead, status: 'CLAIMED' })),
    transitionLead: vi.fn(() => Promise.resolve({ ...lead, status: 'QUALIFIED' })),
    assignLead: vi.fn(() => Promise.resolve({ ...lead, ownerId: 'employee-1' })),
    releaseLead: vi.fn(() => Promise.resolve({ ...lead, status: 'POOL', ownerId: null })),
  };
  return {
    transport: spies as CrmApi,
    spies,
  };
};

describe('web bootstrap', () => {
  it('provides the neutral application shell title and responsive breakpoints', () => {
    expect(BOOTSTRAP_TITLE).toBe('KingTurf Business OS');
    expect(viewportFor(1280)).toBe('desktop');
    expect(viewportFor(800)).toBe('tablet');
    expect(viewportFor(390)).toBe('mobile');
  });

  it('normalizes hash navigation and defaults unknown modules to the overview', () => {
    expect(appRouteFromHash('#/quality-warehouse')).toBe('quality-warehouse');
    expect(appRouteFromHash('#/contract-order')).toBe('contract-order');
    expect(appRouteFromHash('#/not-implemented')).toBe('overview');
    expect(appRouteFromHash('')).toBe('overview');
  });

  it('default-denies customer and 360 rendering unless customer:read is present', () => {
    expect(visibleCrmSections(new Set())).toEqual({
      customers: false,
      customer360: false,
      customerCreate: false,
      leads: false,
      leadClaim: false,
    });
    expect(visibleCrmSections(new Set(['customer-360:read']))).toMatchObject({
      customers: false,
      customer360: false,
    });
    expect(visibleCrmSections(new Set(['customer:read', 'customer-360:read']))).toMatchObject({
      customers: true,
      customer360: true,
    });
    expect(visibleCrmSections(new Set(['lead:read']))).toMatchObject({ leads: true });
  });

  it('renders permission-gated responsive commercial workflow forms and immutable issue state', () => {
    expect(visibleCommercialSections(new Set())).toEqual({
      opportunities: false,
      opportunityCreate: false,
      ctr: false,
      technicalSolutions: false,
      costExplanation: false,
      policyExplanation: false,
      quotes: false,
      quoteIssue: false,
      credit: false,
      contracts: false,
      orders: false,
      order360: false,
      ar: false,
      payments: false,
      reconciliation: false,
      commissions: false,
      risks: false,
      dashboard: false,
      manufacturing: false,
      procurement: false,
      mrp: false,
      production: false,
    });
    const workspace = commercialWorkspaceStructure('mobile', true) as unknown as RenderedElement;
    expect(workspace.className).toContain('mobile');
    expect(workspace.className).toContain('immutable');
    expect(workspace.findByClass('commercial-form')).toHaveLength(12);
    expect(workspace.findByClass('decision-evidence')).toHaveLength(12);
    expect(workspace.textContent).toContain('已签发（只读）');
  });

  it('renders versioned manufacturing items, BOMs, routings, and publish controls', async () => {
    const api = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockImplementation((path: string) =>
        Promise.resolve(
          path === '/api/v1/manufacturing-items'
            ? [
                {
                  id: 'item-v1',
                  sku: 'FG-KT-PRO-50',
                  name: '50mm 景观草',
                  version: 1,
                  status: 'PUBLISHED',
                },
              ]
            : path === '/api/v1/manufacturing-boms'
              ? [
                  {
                    id: 'bom-v1',
                    code: 'BOM-KT-PRO-50',
                    name: '标准 BOM',
                    version: 1,
                    status: 'DRAFT',
                  },
                ]
              : [
                  {
                    id: 'routing-v1',
                    code: 'RT-KT-PRO-50',
                    name: '标准工艺',
                    version: 1,
                    status: 'PUBLISHED',
                  },
                ],
        ),
      ),
      submit: vi.fn().mockResolvedValue({ id: 'bom-v1', status: 'PUBLISHED' }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      api,
      new Set([
        'manufacturing-item:read',
        'manufacturing-item:manage',
        'bom:read',
        'bom:manage',
        'routing:read',
        'routing:manage',
      ]),
    );
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('manufacturing-workbench')).toHaveLength(1);
    expect(workspace.findByClass('manufacturing-card')).toHaveLength(3);
    expect(workspace.textContent).toContain('FG-KT-PRO-50');
    expect(workspace.textContent).toContain('发布版本');
  });

  it('renders supplier, sourcing, purchase, receipt, and immutable lot-balance evidence', async () => {
    const api = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockImplementation((path: string) => {
        const values: Record<string, readonly Record<string, unknown>[]> = {
          '/api/v1/suppliers': [
            {
              id: 'supplier-1',
              supplier_number: 'SUP-1',
              name: '草纱供应商',
              status: 'ACTIVE',
              payment_terms_days: 30,
              qualifications: [{ status: 'APPROVED' }],
            },
          ],
          '/api/v1/procurement-rfqs': [
            { id: 'rfq-1', rfq_number: 'RFQ-1', status: 'ISSUED', lines: [{}] },
          ],
          '/api/v1/supplier-quotes': [
            {
              id: 'quote-1',
              quote_reference: 'SQ-1',
              supplierName: '草纱供应商',
              valid_until: '2026-12-31',
            },
          ],
          '/api/v1/purchase-orders': [
            {
              id: 'po-1',
              po_number: 'PO-1',
              status: 'RECEIVED',
              supplierName: '草纱供应商',
              lines: [{ quantity: '5000', unit_price: '12.5' }],
            },
          ],
          '/api/v1/goods-receipts': [
            { id: 'gr-1', receipt_number: 'GR-1', poNumber: 'PO-1', lines: [{}] },
          ],
          '/api/v1/inventory-locations': [{ id: 'loc-1', code: 'RAW-A01', name: '原料一区' }],
          '/api/v1/inventory-balances': [
            {
              sku: 'RM-YARN',
              lotNumber: 'LOT-1',
              locationCode: 'RAW-A01',
              quantity: '5000',
              qualityStatus: 'QUARANTINE',
              movements: [{}],
            },
          ],
        };
        return Promise.resolve(values[path] ?? []);
      }),
      submit: vi.fn().mockResolvedValue({}),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      api,
      new Set([
        'supplier:read',
        'supplier:manage',
        'procurement:read',
        'procurement:manage',
        'inventory:read',
        'inventory:move',
      ]),
    );
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('procurement-workbench')).toHaveLength(1);
    expect(workspace.findByClass('procurement-column')).toHaveLength(4);
    expect(workspace.textContent).toContain('SUP-1');
    expect(workspace.textContent).toContain('PO-1 · RECEIVED');
    expect(workspace.textContent).toContain('LOT-1');
    expect(workspace.textContent).toContain('结存 5000');
    expect(inventoryLocationOption({ id: 'loc-1', code: 'RAW-A01', name: '原料一区' })).toEqual({
      value: 'loc-1',
      label: 'RAW-A01 · 原料一区',
    });
  });

  it('renders explainable MRP calculations, frozen warnings, and approval history', async () => {
    const api = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockImplementation((path: string) => {
        const values: Record<string, readonly Record<string, unknown>[]> = {
          '/api/v1/mrp-policies': [
            {
              sku: 'RM-YARN',
              make_or_buy: 'BUY',
              safety_stock: '500',
              minimum_order_quantity: '1000',
              order_multiple: '500',
              lead_time_days: 14,
            },
          ],
          '/api/v1/mrp-demands': [{ id: 'demand-1', quantity: '8000' }],
          '/api/v1/mrp-runs': [
            {
              id: 'run-1',
              run_number: 'MRP-KT-2026-001',
              status: 'COMPUTED',
              as_of: '2026-08-16',
              freeze_until: '2026-08-23',
              input_hash: 'a'.repeat(64),
              proposals: [
                {
                  id: 'proposal-1',
                  sku: 'RM-YARN',
                  proposal_type: 'PURCHASE',
                  quantity: '1000',
                  start_at: '2026-08-06',
                  due_at: '2026-08-20',
                  frozen: true,
                  effectiveState: 'PROPOSED',
                  explanation: {
                    grossDemand: 128.75,
                    safetyStock: 500,
                    onHand: 0,
                    scheduledReceipts: 0,
                    netRequirement: 628.75,
                    plannedQuantity: 1000,
                  },
                },
              ],
            },
          ],
          '/api/v1/manufacturing-items': [
            { id: 'item-v1', sku: 'RM-YARN', name: '草纱', status: 'PUBLISHED' },
          ],
        };
        return Promise.resolve(values[path] ?? []);
      }),
      submit: vi.fn().mockResolvedValue({}),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      api,
      new Set([
        'manufacturing-item:read',
        'mrp-policy:read',
        'mrp-policy:manage',
        'mrp:read',
        'mrp:run',
        'mrp:approve',
        'mrp:release',
      ]),
    );
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('mrp-workbench')).toHaveLength(1);
    expect(workspace.findByClass('mrp-proposal-card')).toHaveLength(1);
    expect(workspace.textContent).toContain('MRP-KT-2026-001 · COMPUTED');
    expect(workspace.textContent).toContain('冻结窗口内');
    expect(workspace.textContent).toContain('净需求 628.75');
    expect(workspace.textContent).toContain('按批量取整为 1000');
  });

  it('renders production routing progress, material evidence, reports, rolls, and state ledger', async () => {
    const api = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockImplementation((path: string) =>
        Promise.resolve(
          path === '/api/v1/production-orders'
            ? [
                {
                  id: 'order-1',
                  order_number: 'WO-KT-2026-001',
                  sku: 'FG-KT-PRO-50',
                  state: 'CLOSED',
                  planned_quantity: '1000',
                  planned_start_at: '2026-08-13',
                  planned_due_at: '2026-08-20',
                  operations: [
                    {
                      id: 'op-1',
                      sequence: 10,
                      operation_code: 'TUFT',
                      name: '簇绒',
                      work_center: 'WC-TUFT-01',
                    },
                    {
                      id: 'op-2',
                      sequence: 20,
                      operation_code: 'COAT',
                      name: '背胶',
                      work_center: 'WC-COAT-01',
                    },
                    {
                      id: 'op-3',
                      sequence: 30,
                      operation_code: 'PACK',
                      name: '裁切包装',
                      work_center: 'WC-PACK-01',
                    },
                  ],
                  materials: [{ transaction_type: 'ISSUE', quantity: '1287.5' }],
                  reports: [
                    { production_order_operation_id: 'op-1', good_quantity: '1000' },
                    { production_order_operation_id: 'op-2', good_quantity: '1000' },
                    { production_order_operation_id: 'op-3', good_quantity: '1000' },
                  ],
                  rolls: [
                    {
                      roll_number: 'ROLL-KT-2026-001',
                      quantity: '1000',
                      status: 'QUARANTINE',
                    },
                  ],
                  events: ['DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'].map(
                    (state) => ({ state }),
                  ),
                },
              ]
            : [],
        ),
      ),
      submit: vi.fn().mockResolvedValue({}),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(api, new Set(['production:read']));
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('production-workbench')).toHaveLength(1);
    expect(workspace.findByClass('production-operation')).toHaveLength(3);
    expect(workspace.findByClass('production-operation done')).toHaveLength(0);
    expect(workspace.findByClass('done')).toHaveLength(3);
    expect(workspace.textContent).toContain('WO-KT-2026-001 · FG-KT-PRO-50');
    expect(workspace.textContent).toContain('ISSUE 1287.5');
    expect(workspace.textContent).toContain('ROLL-KT-2026-001 · 1000 · QUARANTINE');
    expect(workspace.textContent).toContain('DRAFT → RELEASED → IN_PROGRESS → COMPLETED → CLOSED');
  });

  it('drives commercial loading, submission, revision approval, and issue state through APIs', async () => {
    expect(commercialRevisionPath('ctr-revisions', 'ctr-1')).toBe('/api/v1/ctrs/ctr-1/versions');
    expect(commercialRevisionPath('technical-solution-history', 'solution-1')).toBe(
      '/api/v1/technical-solutions/solution-1/revisions',
    );
    expect(commercialRevisionPath('cost-explanation', 'cost-1')).toBe(
      '/api/v1/cost-models/cost-1/versions',
    );
    expect(commercialRevisionPath('policy-explanation', 'policy-1')).toBe(
      '/api/v1/sales-policies/policy-1/versions',
    );
    expect(commercialRevisionPath('quote-builder', 'quote-1')).toBe(
      '/api/v1/quotes/quote-1/revisions',
    );
    const commercialApi = {
      listOpportunities: vi.fn().mockResolvedValue([{ id: 'op-1', name: 'Arena' }]),
      list: vi.fn().mockResolvedValue([]),
      submit: vi.fn().mockResolvedValue({ id: 'revision-1', revision: 1, status: 'DRAFT' }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({ id: 'revision-1', status: 'ISSUED' }),
    };
    const controller = new CommercialController(
      commercialApi,
      new Set(['opportunity:read', 'quote:create', 'quote:approve', 'quote:issue']),
    );
    await controller.load();
    expect(controller.opportunities).toHaveLength(1);
    await controller.submit('/api/v1/quotes', { quoteNumber: 'Q-1' });
    expect(controller.revisionState).toMatchObject({ revision: 1 });
    await controller.quoteCommand('revision-1', 'approve', {
      decision: 'APPROVED',
      reason: 'reviewed',
    });
    await controller.quoteCommand('revision-1', 'issue');
    expect(commercialApi.command).toHaveBeenNthCalledWith(2, 'revision-1', 'issue', {});
    expect(controller.message).toContain('只读');
    expect(controller.loading).toBe(false);
  });

  it('renders the field-driven opportunity pipeline and CTR workbench', async () => {
    const commercialApi = {
      listOpportunities: vi.fn().mockResolvedValue([
        {
          id: 'op-1',
          name: '国际学校足球场',
          status: 'OPEN',
          value: { amount: '500000.000000', currency: 'CNY' },
          probabilityBasisPoints: 3000,
          expectedCloseDate: '2026-10-01',
          version: 1,
        },
      ]),
      list: vi.fn().mockImplementation((path: string) =>
        Promise.resolve(
          path === '/api/v1/ctrs'
            ? [
                {
                  id: 'ctr-version-1',
                  ctrId: 'ctr-1',
                  code: 'CTR-2026-001',
                  title: '50mm 足球草需求',
                  version: 1,
                  status: 'DRAFT',
                },
              ]
            : [],
        ),
      ),
      submit: vi.fn().mockResolvedValue({ id: 'created' }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      commercialApi,
      new Set([
        'opportunity:read',
        'opportunity:create',
        'opportunity:lifecycle',
        'ctr:read',
        'ctr:create',
        'ctr:update',
        'ctr:submit',
        'attachment:manage',
      ]),
    );
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('pipeline-board')).toHaveLength(1);
    expect(workspace.findByClass('pipeline-column')).toHaveLength(5);
    expect(workspace.findByClass('opportunity-card')).toHaveLength(1);
    expect(workspace.findByClass('ctr-workbench')).toHaveLength(1);
    expect(workspace.findByClass('ctr-evidence')).toHaveLength(1);
    expect(workspace.textContent).toContain('上传附件');
    expect(workspace.findByClass('ctr-row')).toHaveLength(1);
    expect(workspace.textContent).toContain('国际学校足球场');
    expect(workspace.textContent).toContain('CTR-2026-001');
    expect(workspace.textContent).not.toContain('JSON 请求');
  });

  it('renders structured technical solution specifications and revision actions', async () => {
    const commercialApi = {
      listOpportunities: vi.fn().mockResolvedValue([{ id: 'op-1', name: '学校球场' }]),
      list: vi.fn().mockImplementation((path: string) =>
        Promise.resolve(
          path === '/api/v1/ctrs'
            ? [
                {
                  id: 'ctr-v1',
                  opportunityId: 'op-1',
                  code: 'CTR-1',
                  version: 1,
                  status: 'APPROVED',
                },
              ]
            : path === '/api/v1/technical-solutions'
              ? [
                  {
                    id: 'solution-v1',
                    technicalSolutionId: 'solution-1',
                    code: 'TS-1',
                    revision: 1,
                    status: 'FINAL',
                    ctrVersionId: 'ctr-v1',
                    specification: { productFamily: 'KingTurf Pro', pileHeightMm: 50 },
                    assumptions: ['满足足球场日常训练'],
                  },
                ]
              : [],
        ),
      ),
      submit: vi.fn().mockResolvedValue({ id: 'created' }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      commercialApi,
      new Set([
        'opportunity:read',
        'ctr:read',
        'technical-solution:read',
        'technical-solution:create',
        'technical-solution:update',
      ]),
    );
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('solution-workbench')).toHaveLength(1);
    expect(workspace.findByClass('solution-card')).toHaveLength(1);
    expect(workspace.textContent).toContain('KingTurf Pro');
    expect(workspace.textContent).toContain('新建技术方案');
    expect(workspace.textContent).toContain('创建方案修订');
    const mobile = commercialWorkspaceStructure(
      'mobile',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(mobile.className.split(' ')).toContain('mobile');
    expect(mobile.findByClass('solution-workbench')).toHaveLength(1);
    expect(mobile.textContent).toContain('KingTurf Pro');
  });

  it('derives the technical solution opportunity from its approved CTR handoff', () => {
    const ctrs = [
      { id: 'ctr-approved', opportunityId: 'op-visible', status: 'APPROVED' },
      { id: 'ctr-draft', opportunityId: 'op-other', status: 'DRAFT' },
    ];
    expect(technicalSolutionOpportunityId(ctrs, 'ctr-approved')).toBe('op-visible');
    expect(() => technicalSolutionOpportunityId(ctrs, 'ctr-draft')).toThrow(
      '所选 CTR 不可用或缺少关联商机',
    );
  });

  it('renders explainable cost and sales policy decisions without JSON forms', async () => {
    const commercialApi = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockImplementation((path: string) => {
        const views: Record<string, readonly Record<string, unknown>[]> = {
          '/api/v1/cost-models': [
            { id: 'model-v1', code: 'CM-1', version: 1, status: 'PUBLISHED', currency: 'CNY' },
          ],
          '/api/v1/technical-solutions': [
            { id: 'solution-v1', code: 'TS-1', revision: 1, status: 'FINAL' },
          ],
          '/api/v1/cost-evaluations': [
            {
              id: 'cost-1',
              currency: 'CNY',
              subtotal: '1000',
              total: '1030',
              inputHash: 'cost-hash',
              lines: [
                {
                  description: '草坪',
                  quantity: '10',
                  unit_code: 'M2',
                  unit_cost: '100',
                  total: '1000',
                },
              ],
              trace: [{ matched: true, reason: '管理费率 3%' }],
            },
          ],
          '/api/v1/sales-policies': [
            { id: 'policy-v1', code: 'SP-1', version: 1, status: 'PUBLISHED' },
          ],
          '/api/v1/sales-policy-evaluations': [
            {
              id: 'policy-eval-1',
              passed: false,
              approvalRequired: true,
              minimumMarginBasisPoints: 2000,
              maximumDiscountBasisPoints: 1000,
              reasons: ['毛利率低于 20% 红线'],
              inputHash: 'policy-hash',
            },
          ],
        };
        return Promise.resolve(views[path] ?? []);
      }),
      submit: vi.fn().mockResolvedValue({ id: 'created' }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      commercialApi,
      new Set([
        'technical-solution:read',
        'cost-model:read',
        'cost-model:manage',
        'cost:read',
        'cost:evaluate',
        'sales-policy:read',
        'sales-policy:manage',
        'sales-policy:evaluate',
      ]),
    );
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('cost-workbench')).toHaveLength(1);
    expect(workspace.findByClass('policy-workbench')).toHaveLength(1);
    expect(workspace.findByClass('decision-card')).toHaveLength(2);
    expect(workspace.textContent).toContain('CNY 1030');
    expect(workspace.textContent).toContain('管理费率 3%');
    expect(workspace.textContent).toContain('新建模型版本');
    expect(workspace.textContent).toContain('政策未通过');
    expect(workspace.textContent).toContain('毛利率低于 20% 红线');
    expect(workspace.textContent).toContain('新建政策版本');
    expect(workspace.textContent).not.toContain('JSON 请求');
  });

  it('renders the CPQ quote builder with economics, pins, approvals, and line items', async () => {
    const views: Record<string, readonly Record<string, unknown>[]> = {
      '/api/v1/ctrs': [{ id: 'ctr-v1', status: 'APPROVED' }],
      '/api/v1/technical-solutions': [
        { id: 'solution-v1', status: 'FINAL', ctrVersionId: 'ctr-v1' },
      ],
      '/api/v1/cost-evaluations': [
        {
          id: 'cost-1',
          opportunityId: 'op-1',
          technicalSolutionRevisionId: 'solution-v1',
          currency: 'CNY',
          total: '752209',
        },
      ],
      '/api/v1/sales-policies': [
        { id: 'policy-v1', code: 'SP-1', version: 1, status: 'PUBLISHED' },
      ],
      '/api/v1/sales-policy-evaluations': [],
      '/api/v1/quotes': [
        {
          id: 'quote-r1',
          quoteNumber: 'Q-2026-001',
          revision: 1,
          status: 'DRAFT',
          currency: 'CNY',
          total: '1000000',
          discount: '0',
          costTotal: '752209',
          margin: '247791',
          marginBasisPoints: 2477,
          ctrVersionId: 'ctr-v1',
          technicalSolutionRevisionId: 'solution-v1',
          costDecisionId: 'cost-1',
          policyVersionId: 'policy-v1',
          lines: [
            {
              description: '人造草坪系统',
              quantity: '8050',
              unit_code: 'M2',
              unit_price: '108',
              total: '869400',
            },
          ],
        },
        {
          id: 'quote-r2',
          quoteNumber: 'Q-2026-002',
          revision: 1,
          status: 'ISSUED',
          currency: 'CNY',
          total: '1200000',
          margin: '447791',
          marginBasisPoints: 3731,
          lines: [],
        },
      ],
    };
    const commercialApi = {
      listOpportunities: vi.fn().mockResolvedValue([{ id: 'op-1', name: '学校球场' }]),
      list: vi.fn().mockImplementation((path: string) => Promise.resolve(views[path] ?? [])),
      submit: vi.fn().mockResolvedValue({ id: 'created' }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      commercialApi,
      new Set([
        'opportunity:read',
        'ctr:read',
        'technical-solution:read',
        'cost-model:read',
        'cost:read',
        'sales-policy:read',
        'quote:read',
        'quote:create',
        'quote:update',
        'quote:approve',
      ]),
    );
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('quote-workbench')).toHaveLength(1);
    expect(workspace.findByClass('quote-card')).toHaveLength(2);
    expect(workspace.textContent).toContain('新建报价');
    expect(workspace.textContent).toContain('CNY 1000000');
    expect(workspace.textContent).toContain('毛利 247791（24.77%）');
    expect(workspace.textContent).toContain('人造草坪系统');
    expect(workspace.textContent).toContain('批准报价');
    expect(workspace.textContent).toContain('打印 / 保存 PDF');
    expect(workspace.textContent).toContain('创建报价修订');
  });

  it('renders field-driven credit and contract workbenches with approval evidence', async () => {
    const views: Record<string, readonly Record<string, unknown>[]> = {
      '/api/v1/quotes': [
        {
          id: 'quote-r1',
          quoteNumber: 'Q-1',
          revision: 1,
          status: 'ISSUED',
          issuedSnapshotId: 'snapshot-1',
          opportunityId: 'op-1',
          currency: 'CNY',
          total: '1000000',
        },
      ],
      '/api/v1/credit-limits': [
        { id: 'limit-1', customer_id: 'customer-1', currency: 'CNY', amount: '1500000' },
      ],
      '/api/v1/credit-decisions': [
        {
          id: 'credit-1',
          effective_status: 'PENDING_APPROVAL',
          requested_amount: '1000000',
          exposure_amount: '0',
          currency: 'CNY',
        },
      ],
      '/api/v1/contracts': [
        {
          id: 'contract-r1',
          contractNumber: 'C-1',
          revision: 1,
          effectiveStatus: 'DRAFT',
          content: { paymentTerms: '30% 预付款', deliveryTerms: '合同生效后 30 天' },
          content_hash: 'contract-hash',
        },
      ],
    };
    const commercialApi = {
      listOpportunities: vi
        .fn()
        .mockResolvedValue([{ id: 'op-1', customerId: 'customer-1', name: '学校球场' }]),
      list: vi.fn().mockImplementation((path: string) => Promise.resolve(views[path] ?? [])),
      submit: vi.fn().mockResolvedValue({ id: 'created' }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      commercialApi,
      new Set([
        'opportunity:read',
        'quote:read',
        'credit:read',
        'credit:evaluate',
        'credit:approve',
        'contract:read',
        'contract:revise',
        'contract:sign',
      ]),
    );
    controller.customers = [{ id: 'customer-1', name: '国际学校' }];
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('credit-workbench')).toHaveLength(1);
    expect(workspace.findByClass('contract-workbench')).toHaveLength(1);
    expect(workspace.textContent).toContain('设置客户额度');
    expect(workspace.textContent).toContain('发起信用评估');
    expect(workspace.textContent).toContain('等待信用审批');
    expect(workspace.textContent).toContain('批准信用');
    expect(workspace.textContent).toContain('新建合同');
    expect(workspace.textContent).toContain('合同待签署');
    expect(workspace.textContent).toContain('记录签署回执');
  });

  it('loads only authorized APIs and exposes testable E01-E04 event handlers', async () => {
    const { transport, spies } = api();
    const denied = new CrmController(new Set(), transport);
    await denied.load();
    expect(spies.listCustomers).not.toHaveBeenCalled();
    expect(spies.listEmployees).not.toHaveBeenCalled();
    expect(spies.listPool).not.toHaveBeenCalled();

    const controller = new CrmController(
      new Set([
        'employee:read',
        'customer:read',
        'customer:create',
        'customer:update',
        'customer-360:read',
        'lead-pool:read',
        'lead-pool:claim',
        'lead-pool:release',
        'lead:read',
        'lead:lifecycle',
        'lead:assign',
      ]),
      transport,
    );
    await controller.load();
    await controller.selectCustomer(customer.id);
    await controller.createCustomer({ name: 'New', customerNumber: 'C-2', tags: [] });
    await controller.mutateSelected('contact', 'Buyer', 'buyer@example.test');
    await controller.claim(lead);
    await controller.mutateLead(lead, 'lifecycle', 'QUALIFIED', 'qualified');
    await controller.mutateLead(lead, 'assignment', 'employee-1', 'territory');
    await controller.mutateLead({ ...lead, ownerId: 'employee-1' }, 'release', '', 'return');
    expect(spies.customer360).toHaveBeenCalledWith(customer.id);
    expect(spies.listEmployees).toHaveBeenCalled();
    expect(spies.createCustomer).toHaveBeenCalled();
    expect(spies.addContact).toHaveBeenCalledWith(customer.id, 'Buyer', 'buyer@example.test');
    expect(spies.claimLead).toHaveBeenCalledWith(lead);
    expect(spies.transitionLead).toHaveBeenCalledWith(lead, 'QUALIFIED', 'qualified');
    expect(spies.assignLead).toHaveBeenCalledWith(lead, 'employee-1', 'territory');
    expect(spies.releaseLead).toHaveBeenCalledWith({ ...lead, ownerId: 'employee-1' }, 'return');
  });

  it('filters customer and lead work queues without losing the server-backed collection', async () => {
    const { transport } = api();
    const controller = new CrmController(
      new Set(['customer:read', 'lead:read', 'lead-pool:read']),
      transport,
    );
    await controller.load();

    controller.customerQuery = 'acme';
    expect(controller.visibleCustomers()).toEqual([customer]);
    controller.customerStatus = 'ACTIVE';
    expect(controller.visibleCustomers()).toEqual([]);
    controller.customerStatus = 'PROSPECT';
    controller.customerQuery = 'C-1';
    expect(controller.visibleCustomers()).toEqual([customer]);

    controller.leadQuery = 'school';
    expect(controller.visibleLeads()).toEqual([lead]);
    controller.leadQuery = 'website';
    expect(controller.visibleLeads()).toEqual([]);
    expect(controller.customers).toEqual([customer]);
    expect(controller.pool).toEqual([lead]);
  });

  it('paginates CRM queues deterministically after filtering', async () => {
    const { transport } = api();
    transport.listCustomers = vi.fn(() =>
      Promise.resolve(
        Array.from({ length: 12 }, (_, index) => ({
          ...customer,
          id: `customer-${String(index + 1)}`,
          customerNumber: `C-${String(index + 1).padStart(2, '0')}`,
          name: `客户 ${String(index + 1)}`,
        })),
      ),
    );
    const controller = new CrmController(new Set(['customer:read']), transport);
    await controller.load();
    expect(controller.customerPageItems()).toHaveLength(10);
    controller.customerPage = 2;
    expect(controller.customerPageItems().map((item) => item.customerNumber)).toEqual([
      'C-11',
      'C-12',
    ]);
    controller.customerQuery = '客户 1';
    controller.customerPage = 1;
    expect(controller.customerPageItems()).toHaveLength(4);
  });

  it.each([
    [1280, 'desktop'],
    [800, 'tablet'],
    [390, 'mobile'],
  ] as const)(
    'renders the Customer 360 vertical slice at %i px in the %s layout',
    async (width, layout) => {
      const { transport } = api();
      const controller = new CrmController(
        new Set(['customer:read', 'customer-360:read']),
        transport,
      );
      await controller.load();
      await controller.selectCustomer(customer.id);

      const shell = createCrmShell(controller, width) as unknown as RenderedElement;
      expect(shell.className.split(' ')).toContain(layout);
      expect(shell.findByClass('contacts-section')).toHaveLength(1);
      expect(shell.findByClass('ownership-section')).toHaveLength(1);
      expect(shell.findByClass('related-leads-section')).toHaveLength(1);
      expect(shell.findByClass('related-opportunities-section')).toHaveLength(1);
      expect(shell.findByClass('activity-timeline')).toHaveLength(1);
      expect(shell.textContent).toContain('Buyer Zhang');
      expect(shell.textContent).toContain('C-1 · PROSPECT · 未分配或负责人受限');
      expect(shell.textContent).toContain('buyer@example.test');
      expect(shell.textContent).toContain('华东区域');
      expect(shell.textContent).toContain('School pitch');
      expect(shell.textContent).toContain('学校球场改造');
      expect(shell.textContent).toContain('CNY 680000');
      expect(shell.textContent.indexOf('确认预算')).toBeLessThan(
        shell.textContent.indexOf('首次接洽'),
      );
    },
  );

  it('safely renders a field-filtered Customer 360 DTO without leaking absent contact fields', async () => {
    const { transport } = api();
    transport.customer360 = vi.fn(() =>
      Promise.resolve({
        customer,
        contacts: [{ id: 'restricted', name: 'Restricted Buyer', title: null }],
        ownership: [],
        leads: [],
        opportunities: [],
        activities: [],
        unavailableSections: ['orders', 'finance'],
      }),
    );
    const controller = new CrmController(
      new Set(['customer:read', 'customer-360:read']),
      transport,
    );
    await controller.load();
    await controller.selectCustomer(customer.id);
    const shell = createCrmShell(controller, 390) as unknown as RenderedElement;
    expect(shell.textContent).toContain('Restricted Buyer');
    expect(shell.textContent).toContain('联系方式受限或未提供');
    expect(shell.textContent).not.toContain('buyer@example.test');
    expect(shell.textContent).not.toContain('undefined');
  });

  it('renders the governed order-to-cash workbenches as fields instead of JSON inputs', async () => {
    const commercialApi = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockImplementation((path: string) =>
        Promise.resolve(
          (
            {
              '/api/v1/sales-orders': [
                { id: 'order-1', order_number: 'SO-001', currency: 'CNY', total: 1000 },
              ],
              '/api/v1/ar-open-items': [
                {
                  id: 'ar-1',
                  documentNumber: 'INV-001',
                  currency: 'CNY',
                  original_amount: 1000,
                  remaining_amount: 400,
                  due_at: '2026-09-30T00:00:00Z',
                },
              ],
              '/api/v1/bank-payments': [
                {
                  id: 'payment-1',
                  bank_reference: 'BANK-001',
                  currency: 'CNY',
                  amount: 600,
                  remaining_amount: 0,
                },
              ],
              '/api/v1/reconciliation-runs': [{ id: 'run-1', result_hash: '1234567890abcdef' }],
            } as Record<string, readonly Record<string, unknown>[]>
          )[path] ?? [],
        ),
      ),
      submit: vi.fn().mockResolvedValue({ id: 'created' }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      commercialApi,
      new Set(['sales-order:read', 'ar:read', 'bank-payment:read', 'reconciliation:read']),
    );
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('order-workbench')).toHaveLength(1);
    expect(workspace.findByClass('ar-workbench')).toHaveLength(1);
    expect(workspace.findByClass('payment-workbench')).toHaveLength(1);
    expect(workspace.textContent).toContain('SO-001');
    expect(workspace.textContent).toContain('未核销 CNY 400');
    expect(workspace.textContent).toContain('已核销 600');
    expect(workspace.textContent).toContain('最近核销 1234567890ab');
    expect(workspace.textContent).not.toContain('JSON 请求');
  });

  it('renders commission policy economics and immutable ledger states', async () => {
    const commercialApi = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockImplementation((path: string) =>
        Promise.resolve(
          (
            {
              '/api/v1/commission-policies': [
                {
                  id: 'policy-v1',
                  code: 'COM-1',
                  version: 1,
                  status: 'PUBLISHED',
                  base_rate_basis_points: 300,
                  minimum_margin_basis_points: 2000,
                  release_collection_basis_points: 10000,
                },
              ],
              '/api/v1/commissions': [
                {
                  id: 'commission-1',
                  orderNumber: 'SO-001',
                  accounting_period: '2026-08',
                  currency: 'CNY',
                  commission_amount: 28500,
                  eligible_revenue: 950000,
                  margin_basis_points: 2410,
                  collection_basis_points: 5263,
                  beneficiaryName: '销售甲',
                  policyCode: 'COM-1',
                  policyVersion: 1,
                  effective_state: 'FROZEN',
                  ledger: [
                    { sequence: 1, state: 'ACCRUED', reason: '服务器计提' },
                    { sequence: 2, state: 'FROZEN', reason: '回款未达门槛' },
                  ],
                },
              ],
            } as Record<string, readonly Record<string, unknown>[]>
          )[path] ?? [],
        ),
      ),
      submit: vi.fn().mockResolvedValue({ id: 'created' }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      commercialApi,
      new Set([
        'commission-policy:read',
        'commission-policy:manage',
        'commission:read',
        'commission:accrue',
        'commission:manage',
        'commission:pay',
      ]),
    );
    controller.employees = [{ id: 'employee-1', displayName: '销售甲', active: true }];
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('commission-workbench')).toHaveLength(1);
    expect(workspace.textContent).toContain('佣金引擎与不可变台账');
    expect(workspace.textContent).toContain('CNY 28500');
    expect(workspace.textContent).toContain('已冻结');
    expect(workspace.textContent).toContain('1 · 已计提 · 服务器计提');
    expect(workspace.textContent).toContain('复核并释放');
    expect(workspace.textContent).not.toContain('JSON 请求');
  });
});
