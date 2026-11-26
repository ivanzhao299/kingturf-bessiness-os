export type CrmPermission =
  | 'employee:read'
  | 'customer:read'
  | 'customer:create'
  | 'customer:update'
  | 'customer:lifecycle'
  | 'customer-ownership:assign'
  | 'customer-ownership:reassign'
  | 'customer-activity:create'
  | 'customer-360:read'
  | 'lead:read'
  | 'lead:create'
  | 'lead-pool:read'
  | 'lead-pool:claim'
  | 'lead-pool:release'
  | 'lead:lifecycle'
  | 'lead:assign'
  | 'lead:reassign'
  // TD-CRM-006：仅用于判定客户 360 信用概要是否请求既有信用端点（不是 CRM 域的业务权限）。
  | 'credit:read';
export type Customer = Readonly<{
  id: string;
  customerNumber?: string;
  name?: string;
  status?: string;
  ownerId?: string | null;
  version?: number;
}>;
export type Lead = Readonly<{
  id: string;
  title?: string;
  source?: string;
  status?: string;
  ownerId?: string | null;
  version?: number;
  createdAt?: string;
}>;
export type Employee = Readonly<{
  id: string;
  employeeNumber?: string;
  displayName?: string;
  active?: boolean;
}>;
export type Customer360 = Readonly<{
  customer: Customer;
  contacts: readonly Readonly<{
    id: string;
    name: string;
    title: string | null;
    email?: string | null;
    phone?: string | null;
    primary?: boolean;
  }>[];
  ownership: readonly Readonly<{
    id: string;
    ownerId: string;
    reason: string;
    startedAt: string;
    endedAt: string | null;
  }>[];
  leads: readonly Lead[];
  opportunities: readonly Readonly<{
    id: string;
    name?: string;
    status?: string;
    value?: Readonly<{ amount?: string; currency?: string }>;
    probabilityBasisPoints?: number;
    expectedCloseDate?: string;
  }>[];
  activities: readonly Readonly<{
    id: string;
    type: string;
    summary: string;
    occurredAt: string;
  }>[];
  unavailableSections: readonly string[];
}>;

type CustomerInput = Readonly<{ name: string; customerNumber: string; tags: readonly string[] }>;
type LeadInput = Readonly<{
  title: string;
  source: string;
  customerId: string | null;
  pool: boolean;
}>;
export type CrmApi = {
  // TD-CRM-006：客户 360 信用概要的数据通道——既有信用端点（credit:read，由宿主在注入端口前判定）。
  // 可选：旧测试替身不带这两个方法时宿主不注入端口，卡片不显示（与接线前一致）。
  listCreditLimits?(): Promise<readonly Record<string, unknown>[]>;
  listCreditDecisions?(): Promise<readonly Record<string, unknown>[]>;
  listEmployees(): Promise<readonly Employee[]>;
  listCustomers(): Promise<readonly Customer[]>;
  customer360(id: string): Promise<Customer360>;
  createCustomer(input: CustomerInput): Promise<Customer>;
  createContact(
    customerId: string,
    input: {
      name: string;
      title: string | null;
      email: string | null;
      phone: string | null;
      primary: boolean;
    },
  ): Promise<Record<string, unknown>>;
  transitionCustomer(customer: Customer, status: string, reason: string): Promise<Customer>;
  addContact(customerId: string, name: string, email: string): Promise<void>;
  addActivity(customerId: string, summary: string): Promise<void>;
  createActivity(
    customerId: string,
    input: {
      leadId: string | null;
      type: string;
      occurredAt: string;
      summary: string;
      details: Record<string, unknown>;
    },
  ): Promise<Record<string, unknown>>;
  assignCustomer(customer: Customer, assigneeId: string, reason: string): Promise<Customer>;
  listPool(): Promise<readonly Lead[]>;
  listLeads(): Promise<readonly Lead[]>;
  createLead(input: LeadInput): Promise<Lead>;
  claimLead(lead: Lead): Promise<Lead>;
  transitionLead(lead: Lead, status: string, reason: string): Promise<Lead>;
  assignLead(lead: Lead, assigneeId: string, reason: string): Promise<Lead>;
  releaseLead(lead: Lead, reason: string): Promise<Lead>;
};

export type { CustomerInput, LeadInput };
