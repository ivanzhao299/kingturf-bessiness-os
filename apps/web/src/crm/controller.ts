import type {
  CrmPermission,
  CrmApi,
  Customer,
  Lead,
  Employee,
  Customer360,
  CustomerInput,
  LeadInput,
} from './types';

export function visibleCrmSections(permissions: ReadonlySet<CrmPermission>) {
  const customerRead = permissions.has('customer:read');
  return {
    customers: customerRead,
    customer360: customerRead && permissions.has('customer-360:read'),
    customerCreate: permissions.has('customer:create'),
    leads:
      permissions.has('lead:read') ||
      permissions.has('lead-pool:read') ||
      permissions.has('lead:create'),
    leadClaim: permissions.has('lead-pool:read') && permissions.has('lead-pool:claim'),
  } as const;
}

// CRM-UX：线索控制台经宿主端口（initialLeads/refresh）只能取得 controller.leads；
// 公海/私海分栏需要公海行，故 leads 收敛为「公海 ∪ 已分配」按 id 去重的可见视图
//（与 visibleLeads 同序：公海在前）。pool 仍单独保留给 vanilla 视图。
const mergeLeads = (pool: readonly Lead[], leads: readonly Lead[]): readonly Lead[] =>
  [...pool, ...leads].filter(
    (lead, index, all) => all.findIndex((candidate) => candidate.id === lead.id) === index,
  );

export class CrmController {
  public employees: readonly Employee[] = [];
  public customers: readonly Customer[] = [];
  public pool: readonly Lead[] = [];
  public leads: readonly Lead[] = [];
  public selected: Customer360 | null = null;
  private customerSelectionSequence = 0;
  public error: string | null = null;
  public customerQuery = '';
  public customerStatus = 'ALL';
  public leadQuery = '';
  public customerPage = 1;
  public leadPage = 1;
  public readonly pageSize = 10;
  public constructor(
    public readonly permissions: ReadonlySet<CrmPermission>,
    private readonly api: CrmApi,
  ) {}
  public async load(): Promise<void> {
    const sections = visibleCrmSections(this.permissions);
    const [customers, leads, employees] = await Promise.all([
      sections.customers ? this.api.listCustomers() : Promise.resolve([]),
      this.loadLeads(),
      this.permissions.has('employee:read') ? this.api.listEmployees() : Promise.resolve([]),
    ]);
    this.customers = customers;
    this.leads = leads;
    this.employees = employees.filter((employee) => employee.active !== false);
  }
  // 线索读面单一入口：按权限各读一次，写入 pool 并返回去重后的可见线索全集。
  private async loadLeads(): Promise<readonly Lead[]> {
    const [pool, leads] = await Promise.all([
      this.permissions.has('lead-pool:read') ? this.api.listPool() : Promise.resolve([]),
      this.permissions.has('lead:read') ? this.api.listLeads() : Promise.resolve([]),
    ]);
    this.pool = pool;
    return mergeLeads(pool, leads);
  }
  public visibleCustomers(): readonly Customer[] {
    const query = this.customerQuery.trim().toLocaleLowerCase('zh-CN');
    return this.customers.filter(
      (customer) =>
        (this.customerStatus === 'ALL' || customer.status === this.customerStatus) &&
        (query.length === 0 ||
          [customer.name, customer.customerNumber, customer.ownerId].some((item) =>
            item?.toLocaleLowerCase('zh-CN').includes(query),
          )),
    );
  }
  public visibleLeads(): readonly Lead[] {
    const query = this.leadQuery.trim().toLocaleLowerCase('zh-CN');
    return [...this.pool, ...this.leads]
      .filter(
        (lead, index, all) => all.findIndex((candidate) => candidate.id === lead.id) === index,
      )
      .filter(
        (lead) =>
          query.length === 0 ||
          [lead.title, lead.source, lead.status].some((item) =>
            item?.toLocaleLowerCase('zh-CN').includes(query),
          ),
      );
  }
  public customerPageItems(): readonly Customer[] {
    const start = (this.customerPage - 1) * this.pageSize;
    return this.visibleCustomers().slice(start, start + this.pageSize);
  }
  public leadPageItems(): readonly Lead[] {
    const start = (this.leadPage - 1) * this.pageSize;
    return this.visibleLeads().slice(start, start + this.pageSize);
  }
  public async selectCustomer(id: string): Promise<void> {
    if (!visibleCrmSections(this.permissions).customer360) return;
    const sequence = ++this.customerSelectionSequence;
    try {
      const selected = await this.api.customer360(id);
      if (sequence === this.customerSelectionSequence) {
        this.selected = selected;
        this.error = null;
      }
    } catch (failure) {
      if (sequence === this.customerSelectionSequence) throw failure;
    }
  }
  public async createCustomer(input: CustomerInput): Promise<void> {
    if (!this.permissions.has('customer:create')) return;
    await this.api.createCustomer(input);
    this.customers = await this.api.listCustomers();
  }
  public async createContact(
    customerId: string,
    input: {
      name: string;
      title: string | null;
      email: string | null;
      phone: string | null;
      primary: boolean;
    },
  ): Promise<void> {
    if (!this.permissions.has('customer:update')) return;
    await this.api.createContact(customerId, input);
    if (this.permissions.has('customer-360:read')) await this.selectCustomer(customerId);
  }
  public async createActivity(
    customerId: string,
    input: {
      leadId: string | null;
      type: string;
      occurredAt: string;
      summary: string;
      details: Record<string, unknown>;
    },
  ): Promise<void> {
    if (!this.permissions.has('customer-activity:create')) return;
    await this.api.createActivity(customerId, input);
    if (this.permissions.has('customer-360:read')) await this.selectCustomer(customerId);
  }
  public async createLead(input: LeadInput): Promise<void> {
    if (!this.permissions.has('lead:create')) return;
    await this.api.createLead(input);
    this.leads = await this.loadLeads();
  }
  public async claim(lead: Lead): Promise<void> {
    if (!visibleCrmSections(this.permissions).leadClaim) return;
    await this.api.claimLead(lead);
    this.leads = await this.loadLeads();
  }
  public async mutateLead(
    lead: Lead,
    action: 'lifecycle' | 'assignment' | 'release',
    first: string,
    reason: string,
  ): Promise<void> {
    if (!Number.isInteger(lead.version)) return;
    if (action === 'lifecycle' && this.permissions.has('lead:lifecycle'))
      await this.api.transitionLead(lead, first, reason);
    else if (
      action === 'assignment' &&
      lead.ownerId !== undefined &&
      this.permissions.has(lead.ownerId === null ? 'lead:assign' : 'lead:reassign')
    )
      await this.api.assignLead(lead, first, reason);
    else if (action === 'release' && this.permissions.has('lead-pool:release'))
      await this.api.releaseLead(lead, reason);
    else return;
    this.leads = await this.loadLeads();
  }
  public async mutateSelected(
    action: 'contact' | 'activity' | 'lifecycle' | 'ownership',
    first: string,
    second = '',
  ): Promise<void> {
    if (!this.selected) return;
    const customer = this.selected.customer;
    if ((action === 'lifecycle' || action === 'ownership') && !Number.isInteger(customer.version))
      return;
    if (action === 'ownership' && customer.ownerId === undefined) return;
    if (action === 'contact' && this.permissions.has('customer:update'))
      await this.api.addContact(customer.id, first, second);
    else if (action === 'activity' && this.permissions.has('customer-activity:create'))
      await this.api.addActivity(customer.id, first);
    else if (action === 'lifecycle' && this.permissions.has('customer:lifecycle'))
      await this.api.transitionCustomer(customer, first, second);
    else if (
      action === 'ownership' &&
      this.permissions.has(
        customer.ownerId === null ? 'customer-ownership:assign' : 'customer-ownership:reassign',
      )
    )
      await this.api.assignCustomer(customer, first, second);
    else return;
    this.selected = await this.api.customer360(customer.id);
    this.customers = await this.api.listCustomers();
  }
}
