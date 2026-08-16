import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOOTSTRAP_TITLE,
  CommercialController,
  CrmController,
  commercialWorkspaceStructure,
  commercialRevisionPath,
  createCrmShell,
  type CrmApi,
  type Customer,
  type Lead,
  viewportFor,
  visibleCrmSections,
  visibleCommercialSections,
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
      ar: false,
      payments: false,
      reconciliation: false,
    });
    const workspace = commercialWorkspaceStructure('mobile', true) as unknown as RenderedElement;
    expect(workspace.className).toContain('mobile');
    expect(workspace.className).toContain('immutable');
    expect(workspace.findByClass('commercial-form')).toHaveLength(12);
    expect(workspace.findByClass('decision-evidence')).toHaveLength(12);
    expect(workspace.textContent).toContain('已签发（只读）');
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
      expect(shell.findByClass('activity-timeline')).toHaveLength(1);
      expect(shell.textContent).toContain('Buyer Zhang');
      expect(shell.textContent).toContain('C-1 · PROSPECT · 未分配或负责人受限');
      expect(shell.textContent).toContain('buyer@example.test');
      expect(shell.textContent).toContain('华东区域');
      expect(shell.textContent).toContain('School pitch');
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
});
