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
  listEmployees(): Promise<readonly Employee[]>;
  listCustomers(): Promise<readonly Customer[]>;
  customer360(id: string): Promise<Customer360>;
  createCustomer(input: CustomerInput): Promise<Customer>;
  transitionCustomer(customer: Customer, status: string, reason: string): Promise<Customer>;
  addContact(customerId: string, name: string, email: string): Promise<void>;
  addActivity(customerId: string, summary: string): Promise<void>;
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
