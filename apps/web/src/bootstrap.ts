export const BOOTSTRAP_TITLE = 'KingTurf Business OS';

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
  | 'lead:reassign';
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
  | 'technical-solution:read'
  | 'technical-solution:create'
  | 'technical-solution:update'
  | 'cost:read'
  | 'cost:evaluate'
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
  | 'sales-order:read'
  | 'sales-order:create'
  | 'ar:read'
  | 'ar:post'
  | 'bank-payment:read'
  | 'bank-payment:intake'
  | 'reconciliation:read'
  | 'reconciliation:run'
  | 'allocation:create';
export type Viewport = 'desktop' | 'tablet' | 'mobile';
export function commercialRevisionPath(section: string, rootId: string): string | null {
  const definition = (
    {
      'ctr-revisions': ['/api/v1/ctrs', 'versions'],
      'technical-solution-history': ['/api/v1/technical-solutions', 'revisions'],
      'cost-explanation': ['/api/v1/cost-models', 'versions'],
      'policy-explanation': ['/api/v1/sales-policies', 'versions'],
      'quote-builder': ['/api/v1/quotes', 'revisions'],
    } as Record<string, readonly [string, string]>
  )[section];
  return definition ? `${definition[0]}/${encodeURIComponent(rootId)}/${definition[1]}` : null;
}
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

export const viewportFor = (width: number): Viewport =>
  width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';

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

/** Server grants drive workspace affordances; every action remains server-authorized. */
export function visibleCommercialSections(permissions: ReadonlySet<CommercialPermission>) {
  return {
    opportunities: permissions.has('opportunity:read'),
    opportunityCreate: permissions.has('opportunity:create'),
    ctr: permissions.has('ctr:read'),
    technicalSolutions: permissions.has('technical-solution:read'),
    costExplanation: permissions.has('cost:read'),
    policyExplanation: permissions.has('sales-policy:read'),
    quotes: permissions.has('quote:read'),
    quoteIssue: permissions.has('quote:read') && permissions.has('quote:issue'),
    credit: permissions.has('credit:read'),
    contracts: permissions.has('contract:read'),
    orders: permissions.has('sales-order:read'),
    ar: permissions.has('ar:read'),
    payments: permissions.has('bank-payment:read'),
    reconciliation: permissions.has('reconciliation:read'),
  } as const;
}

export type CommercialApi = Readonly<{
  listOpportunities(): Promise<readonly Readonly<{ id: string; name?: string; status?: string }>[]>;
  list(path: string): Promise<readonly Record<string, unknown>[]>;
  submit(path: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  command(
    revisionId: string,
    action: 'approve' | 'issue',
    payload?: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}>;

export class CommercialController {
  public opportunities: readonly Readonly<{ id: string; name?: string; status?: string }>[] = [];
  public loading = false;
  public message = '';
  public revisionState: Record<string, unknown> | null = null;
  public readonly views = new Map<string, readonly Record<string, unknown>[]>();
  public constructor(
    public readonly api: CommercialApi,
    public readonly permissions: ReadonlySet<CommercialPermission> = new Set(),
  ) {}
  public async load(): Promise<void> {
    this.loading = true;
    try {
      this.opportunities = this.permissions.has('opportunity:read')
        ? await this.api.listOpportunities()
        : [];
      const readable = [
        ['ctr:read', '/api/v1/ctrs'],
        ['technical-solution:read', '/api/v1/technical-solutions'],
        ['cost:read', '/api/v1/cost-evaluations'],
        ['sales-policy:read', '/api/v1/sales-policy-evaluations'],
        ['quote:read', '/api/v1/quotes'],
      ] as const;
      for (const [permission, path] of readable)
        if (this.permissions.has(permission)) this.views.set(path, await this.api.list(path));
      this.message = `已加载 ${String(this.opportunities.length)} 个商机`;
    } finally {
      this.loading = false;
    }
  }
  public async submit(path: string, payload: Record<string, unknown>): Promise<void> {
    this.loading = true;
    try {
      this.revisionState = await this.api.submit(path, payload);
      this.message = '已保存；版本与决策引用已由服务器返回';
      if (path === '/api/v1/opportunities') await this.load();
    } finally {
      this.loading = false;
    }
  }
  public async quoteCommand(
    revisionId: string,
    action: 'approve' | 'issue',
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    this.loading = true;
    try {
      this.revisionState = await this.api.command(revisionId, action, payload);
      this.message = action === 'issue' ? '报价已签发并进入只读状态' : '审批决定已保存';
    } finally {
      this.loading = false;
    }
  }
}

export function commercialWorkspaceStructure(
  viewport: Viewport,
  immutable = false,
  controller?: CommercialController,
): HTMLElement {
  const workspace = document.createElement('section');
  workspace.className = `commercial-workspace ${viewport}${immutable ? ' immutable' : ''}`;
  workspace.setAttribute('aria-label', 'Commercial workspace');
  const status = document.createElement('p');
  status.className = 'commercial-status';
  status.setAttribute('role', 'status');
  status.textContent = controller?.loading ? '加载中…' : (controller?.message ?? '等待服务器数据');
  workspace.append(status);
  const permissions = controller?.permissions ?? new Set<CommercialPermission>(),
    permittedPaths = new Map<string, readonly [CommercialPermission, CommercialPermission]>([
      ['/api/v1/opportunities', ['opportunity:read', 'opportunity:create']],
      ['/api/v1/ctrs', ['ctr:read', 'ctr:create']],
      ['/api/v1/technical-solutions', ['technical-solution:read', 'technical-solution:create']],
      ['/api/v1/cost-evaluations', ['cost:read', 'cost:evaluate']],
      ['/api/v1/sales-policy-evaluations', ['sales-policy:read', 'sales-policy:evaluate']],
      ['/api/v1/quotes', ['quote:read', 'quote:create']],
      ['/api/v1/credit-decisions', ['credit:read', 'credit:evaluate']],
      ['/api/v1/contracts', ['contract:read', 'contract:revise']],
      ['/api/v1/sales-orders', ['sales-order:read', 'sales-order:create']],
      ['/api/v1/ar-open-items', ['ar:read', 'ar:post']],
      ['/api/v1/bank-payments', ['bank-payment:read', 'bank-payment:intake']],
      ['/api/v1/reconciliation-runs', ['reconciliation:read', 'reconciliation:run']],
    ]);
  for (const [className, title, description, fields, action, path] of [
    [
      'opportunity-pipeline',
      '商机',
      '按负责人和阶段管理预计金额、赢率与成交日期',
      ['商机名称', '客户 ID', '金额', '币种', '预计成交日'],
      '新建商机',
      '/api/v1/opportunities',
    ],
    [
      'ctr-revisions',
      'CTR 版本',
      '编辑需求草稿，提交后保留哈希、附件和审批证据',
      ['商机 ID', 'CTR 编码', '标题', '结构化需求'],
      '保存 CTR 草稿',
      '/api/v1/ctrs',
    ],
    [
      'technical-solution-history',
      '技术方案',
      '方案修订精确引用已提交的 CTR 版本',
      ['商机 ID', 'CTR 版本 ID', '方案编码', '规格与假设'],
      '创建方案修订',
      '/api/v1/technical-solutions',
    ],
    [
      'cost-explanation',
      '成本说明',
      '使用固定币种、单位和已发布模型生成可解释成本决策',
      ['模型版本 ID', '方案修订 ID', '成本明细'],
      '计算成本',
      '/api/v1/cost-evaluations',
    ],
    [
      'policy-explanation',
      '销售政策',
      '显示命中规则、利润率边界、审批要求与原因',
      ['政策版本 ID', '成本决策 ID', '报价上下文'],
      '评估政策',
      '/api/v1/sales-policy-evaluations',
    ],
    [
      'quote-builder',
      '报价',
      '汇总行项目、折扣、成本、利润、有效期与全部版本引用',
      ['商机 ID', 'CTR/方案/成本/政策引用', '报价明细', '有效期'],
      immutable ? '已签发（只读）' : '创建报价修订',
      '/api/v1/quotes',
    ],
    [
      'credit-review',
      '信用审查',
      '服务器从 AR 与未分配收款计算敞口，显示审批及到期状态',
      ['报价修订/快照', '敞口快照', '额度与有效期'],
      '评估信用',
      '/api/v1/credit-decisions',
    ],
    [
      'contract-evidence',
      '合同与签署证据',
      '显示精确报价引用、合同修订、签名回执和不可变哈希',
      ['报价快照', '合同内容', '签名回执'],
      '创建合同修订',
      '/api/v1/contracts',
    ],
    [
      'order-release',
      '订单释放',
      '仅使用已签发报价、有效信用决定与已签合同的精确引用',
      ['报价/信用/合同/签名 ID', '订单行'],
      '释放订单',
      '/api/v1/sales-orders',
    ],
    [
      'ar-aging',
      '应收与账龄',
      '余额由过账与分配推导，不提供人工覆盖',
      ['客户', '原始金额', '到期日', '剩余余额'],
      '过账应收',
      '/api/v1/ar-open-items',
    ],
    [
      'payment-intake',
      '收款登记',
      '原始银行载荷、引用与哈希只读且不可删除',
      ['客户', '银行引用', '金额', '原始载荷'],
      '登记收款',
      '/api/v1/bank-payments',
    ],
    [
      'reconciliation',
      '核销',
      '按稳定顺序展示匹配解释、分配次序与剩余余额',
      ['收款余额', '开放项余额', '规范结果哈希'],
      '运行核销',
      '/api/v1/reconciliation-runs',
    ],
  ] as const) {
    const requiredPermission = permittedPaths.get(path),
      canRead = Boolean(requiredPermission && permissions.has(requiredPermission[0])),
      canAct =
        (requiredPermission?.[1] !== undefined && permissions.has(requiredPermission[1])) ||
        (path === '/api/v1/ctrs' &&
          (permissions.has('ctr:submit') || permissions.has('ctr:approve'))) ||
        (path === '/api/v1/quotes' &&
          (permissions.has('quote:approve') || permissions.has('quote:issue')));
    if (controller && !canRead && !canAct) continue;
    const panel = document.createElement('section');
    panel.className = `commercial-panel ${className}`;
    const heading = document.createElement('h2');
    heading.textContent = title;
    const help = document.createElement('p');
    help.className = 'commercial-help';
    help.textContent = description;
    const form = document.createElement('form');
    form.className = 'commercial-form';
    const hint = document.createElement('p');
    hint.className = 'field-hint';
    hint.textContent = fields.join(' · ');
    const request = document.createElement('textarea');
    request.setAttribute('aria-label', `${title} JSON 请求`);
    request.placeholder = '{ }';
    request.disabled = immutable || Boolean(controller && !canAct);
    form.append(hint, request);
    const button = document.createElement('button');
    button.type = 'submit';
    button.disabled = request.disabled;
    button.textContent = action;
    form.append(button);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!controller) return;
      try {
        const parsed = JSON.parse(request.value || '{}') as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
          throw new Error('请求必须是 JSON 对象');
        const payload = { ...(parsed as Record<string, unknown>) };
        const rootId = typeof payload.rootId === 'string' ? payload.rootId : null;
        delete payload.rootId;
        const target = (rootId ? commercialRevisionPath(className, rootId) : null) ?? path;
        void controller.submit(target, payload).then(() => {
          status.textContent = controller.message;
          evidence.textContent = JSON.stringify(controller.revisionState, null, 2);
        });
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : '请求格式无效';
      }
    });
    const evidence = document.createElement('details');
    evidence.className = 'decision-evidence';
    const summary = document.createElement('summary');
    summary.textContent = '版本引用与决策证据';
    evidence.append(summary);
    const loaded = canRead ? controller?.views.get(path) : undefined;
    if (loaded) evidence.append(document.createTextNode(JSON.stringify(loaded, null, 2)));
    else if (controller && !canRead) evidence.hidden = true;
    if (className === 'ctr-revisions' && controller && !immutable) {
      const versionId = document.createElement('input');
      versionId.setAttribute('aria-label', 'CTR 版本 ID');
      const expectedCtrVersion = document.createElement('input');
      expectedCtrVersion.type = 'number';
      expectedCtrVersion.min = '1';
      expectedCtrVersion.value = '1';
      expectedCtrVersion.setAttribute('aria-label', 'CTR 预期版本号');
      const submitCtr = document.createElement('button');
      submitCtr.type = 'button';
      submitCtr.textContent = '提交 CTR';
      submitCtr.hidden = !permissions.has('ctr:submit');
      submitCtr.addEventListener('click', () => {
        void controller.submit(`/api/v1/ctr-versions/${versionId.value}/submit`, {
          expectedVersion: Number(expectedCtrVersion.value),
        });
      });
      const approveCtr = document.createElement('button');
      approveCtr.type = 'button';
      approveCtr.textContent = '批准 CTR';
      approveCtr.hidden = !permissions.has('ctr:approve');
      approveCtr.addEventListener('click', () => {
        void controller.submit(`/api/v1/ctr-versions/${versionId.value}/decision`, {
          decision: 'APPROVED',
          reason: 'UI approval',
        });
      });
      panel.append(versionId, expectedCtrVersion, submitCtr, approveCtr);
    }
    if (className === 'quote-builder' && controller && !immutable) {
      const revisionId = document.createElement('input');
      revisionId.setAttribute('aria-label', '报价修订 ID');
      const approve = document.createElement('button');
      approve.type = 'button';
      approve.textContent = '批准报价';
      approve.hidden = !permissions.has('quote:approve');
      approve.addEventListener('click', () => {
        void controller
          .quoteCommand(revisionId.value, 'approve', {
            decision: 'APPROVED',
            reason: 'UI approval',
          })
          .then(() => {
            status.textContent = controller.message;
          });
      });
      const issue = document.createElement('button');
      issue.type = 'button';
      issue.textContent = '签发报价';
      issue.hidden = !permissions.has('quote:issue');
      issue.addEventListener('click', () => {
        void controller.quoteCommand(revisionId.value, 'issue').then(() => {
          workspace.classList.add('immutable');
          request.disabled = true;
          button.disabled = true;
          status.textContent = controller.message;
        });
      });
      panel.append(revisionId, approve, issue);
    }
    panel.append(heading, help, form, evidence);
    workspace.append(panel);
  }
  return workspace;
}

export const createFetchCommercialApi = (token: string): CommercialApi => ({
  async listOpportunities() {
    const response = await json<{
      items: readonly { id: string; name?: string; status?: string }[];
    }>('/api/v1/opportunities', token);
    return response.items;
  },
  async list(path) {
    return (await json<{ items: readonly Record<string, unknown>[] }>(path, token)).items;
  },
  submit: (path, payload) =>
    json<Record<string, unknown>>(path, token, {
      method: 'POST',
      headers: { 'idempotency-key': requestId() },
      body: JSON.stringify(payload),
    }),
  command: (revisionId, action, payload = {}) =>
    json<Record<string, unknown>>(`/api/v1/quote-revisions/${revisionId}/${action}`, token, {
      method: 'POST',
      headers: { 'idempotency-key': requestId() },
      body: JSON.stringify(payload),
    }),
});

const requestId = () => globalThis.crypto.randomUUID();
async function json<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  headers.set('x-correlation-id', requestId());
  if (token) headers.set('authorization', `Bearer ${token}`);
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Request failed (${String(response.status)})`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}
export function createFetchCrmApi(token: string): CrmApi {
  const post = <T>(path: string, body: unknown, headers?: HeadersInit) =>
    json<T>(path, token, {
      method: 'POST',
      body: JSON.stringify(body),
      ...(headers === undefined ? {} : { headers }),
    });
  return {
    listEmployees: () => json<readonly Employee[]>('/api/v1/employees', token),
    async listCustomers() {
      return (await json<{ items: Customer[] }>('/api/v1/customers', token)).items;
    },
    customer360: (id) => json(`/api/v1/customers/${id}/360`, token),
    createCustomer: (input) => post('/api/v1/customers', input),
    transitionCustomer: (customer, status, reason) =>
      json(`/api/v1/customers/${customer.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason, expectedVersion: customer.version }),
      }),
    addContact: (id, name, email) =>
      post(`/api/v1/customers/${id}/contacts`, {
        name,
        email,
        title: null,
        phone: null,
        primary: false,
      }),
    addActivity: (id, summary) =>
      post(
        `/api/v1/customers/${id}/activities`,
        { leadId: null, type: 'NOTE', occurredAt: new Date().toISOString(), summary, details: {} },
        { 'idempotency-key': requestId() },
      ),
    assignCustomer: (customer, assigneeId, reason) =>
      post(`/api/v1/customers/${customer.id}/ownership`, {
        assigneeId,
        reason,
        expectedVersion: customer.version,
        reassignment: customer.ownerId !== null,
      }),
    async listPool() {
      return (await json<{ items: Lead[] }>('/api/v1/leads/pool', token)).items;
    },
    async listLeads() {
      return (await json<{ items: Lead[] }>('/api/v1/leads', token)).items;
    },
    createLead: (input) => post('/api/v1/leads', input),
    claimLead: (lead) =>
      post(
        `/api/v1/leads/${lead.id}/claim`,
        { expectedVersion: lead.version },
        { 'idempotency-key': requestId() },
      ),
    transitionLead: (lead, status, reason) =>
      post(`/api/v1/leads/${lead.id}/transition`, {
        status,
        reason,
        expectedVersion: lead.version,
      }),
    assignLead: (lead, assigneeId, reason) =>
      post(`/api/v1/leads/${lead.id}/${lead.ownerId === null ? 'assign' : 'reassign'}`, {
        assigneeId,
        reason,
        expectedVersion: lead.version,
      }),
    releaseLead: (lead, reason) =>
      post(`/api/v1/leads/${lead.id}/release`, { reason, expectedVersion: lead.version }),
  };
}

export class CrmController {
  public employees: readonly Employee[] = [];
  public customers: readonly Customer[] = [];
  public pool: readonly Lead[] = [];
  public leads: readonly Lead[] = [];
  public selected: Customer360 | null = null;
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
    const [customers, pool, leads, employees] = await Promise.all([
      sections.customers ? this.api.listCustomers() : Promise.resolve([]),
      this.permissions.has('lead-pool:read') ? this.api.listPool() : Promise.resolve([]),
      this.permissions.has('lead:read') ? this.api.listLeads() : Promise.resolve([]),
      this.permissions.has('employee:read') ? this.api.listEmployees() : Promise.resolve([]),
    ]);
    this.customers = customers;
    this.pool = pool;
    this.leads = leads;
    this.employees = employees.filter((employee) => employee.active !== false);
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
    this.selected = await this.api.customer360(id);
  }
  public async createCustomer(input: CustomerInput): Promise<void> {
    if (!this.permissions.has('customer:create')) return;
    await this.api.createCustomer(input);
    this.customers = await this.api.listCustomers();
  }
  public async createLead(input: LeadInput): Promise<void> {
    if (!this.permissions.has('lead:create')) return;
    await this.api.createLead(input);
    if (this.permissions.has('lead-pool:read')) this.pool = await this.api.listPool();
  }
  public async claim(lead: Lead): Promise<void> {
    if (!visibleCrmSections(this.permissions).leadClaim) return;
    await this.api.claimLead(lead);
    this.pool = await this.api.listPool();
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
    if (this.permissions.has('lead-pool:read')) this.pool = await this.api.listPool();
    if (this.permissions.has('lead:read')) this.leads = await this.api.listLeads();
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

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};
type FormField = Readonly<{
  name: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'select' | 'textarea';
  required?: boolean;
  placeholder?: string;
  options?: readonly Readonly<{ value: string; label: string }>[];
}>;
function openForm(
  host: HTMLElement,
  title: string,
  description: string,
  fields: readonly FormField[],
  submitLabel: string,
  onSubmit: (values: Readonly<Record<string, string>>) => Promise<void>,
): void {
  const dialog = el('dialog', 'form-dialog');
  const form = el('form', 'entity-form');
  form.setAttribute('method', 'dialog');
  const heading = el('div', 'dialog-heading');
  heading.append(
    el('p', 'eyebrow', 'KINGTURF WORKFLOW'),
    el('h2', '', title),
    el('p', 'muted', description),
  );
  form.append(heading);
  for (const field of fields) {
    const label = el('label', 'form-field');
    label.append(el('span', '', field.label));
    const control =
      field.type === 'textarea'
        ? el('textarea')
        : field.type === 'select'
          ? el('select')
          : el('input');
    control.setAttribute('name', field.name);
    if (field.required) control.setAttribute('required', '');
    if (field.placeholder) control.setAttribute('placeholder', field.placeholder);
    if (control instanceof HTMLInputElement)
      control.type = field.type === 'email' || field.type === 'tel' ? field.type : 'text';
    if (control instanceof HTMLSelectElement)
      for (const option of field.options ?? []) {
        const item = el('option', '', option.label);
        item.value = option.value;
        control.append(item);
      }
    label.append(control);
    form.append(label);
  }
  const error = el('p', 'form-error');
  error.setAttribute('role', 'alert');
  const actions = el('div', 'dialog-actions');
  const cancel = el('button', 'secondary', '取消');
  cancel.type = 'button';
  cancel.addEventListener('click', () => {
    dialog.close();
  });
  const submit = el('button', 'primary', submitLabel);
  submit.type = 'submit';
  actions.append(cancel, submit);
  form.append(error, actions);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    error.textContent = '';
    submit.disabled = true;
    submit.textContent = '处理中…';
    const values = Object.fromEntries(
      [...new FormData(form).entries()].map(([key, entry]) => [
        key,
        typeof entry === 'string' ? entry.trim() : '',
      ]),
    );
    void onSubmit(values)
      .then(() => {
        dialog.close();
      })
      .catch((failure: unknown) => {
        error.textContent = failure instanceof Error ? failure.message : '操作失败，请稍后重试';
      })
      .finally(() => {
        submit.disabled = false;
        submit.textContent = submitLabel;
      });
  });
  dialog.append(form);
  host.append(dialog);
  dialog.addEventListener('close', () => {
    dialog.remove();
  });
  dialog.showModal();
}
const displayTime = (timestamp: string | undefined) =>
  timestamp ? new Date(timestamp).toLocaleString('zh-CN') : '时间未知';

function customer360Content(view: Customer360): HTMLElement {
  const content = el('section', 'customer-360-content');

  const contacts = el('section', 'detail-section contacts-section');
  contacts.append(el('h3', '', '联系人'));
  if (view.contacts.length === 0) contacts.append(el('p', 'empty', '暂无可见联系人'));
  for (const contact of view.contacts) {
    const card = el('article', 'info-card contact-card');
    card.append(
      el('strong', '', `${contact.name}${contact.primary === true ? ' · 主要联系人' : ''}`),
    );
    if (contact.title) card.append(el('span', 'contact-title', contact.title));
    const details = el('p', 'contact-details');
    const visibleDetails = [
      Object.hasOwn(contact, 'email') ? contact.email : undefined,
      Object.hasOwn(contact, 'phone') ? contact.phone : undefined,
    ].filter((item): item is string => typeof item === 'string' && item.length > 0);
    details.textContent =
      visibleDetails.length > 0 ? visibleDetails.join(' · ') : '联系方式受限或未提供';
    card.append(details);
    contacts.append(card);
  }

  const ownership = el('section', 'detail-section ownership-section');
  ownership.append(el('h3', '', '归属历史'));
  if (view.ownership.length === 0) ownership.append(el('p', 'empty', '暂无可见归属记录'));
  for (const item of view.ownership) {
    const row = el('article', 'history-row');
    row.append(
      el('strong', '', item.ownerId),
      el('span', '', item.reason),
      el(
        'time',
        '',
        `${displayTime(item.startedAt)}${item.endedAt ? ` — ${displayTime(item.endedAt)}` : ' — 当前'}`,
      ),
    );
    ownership.append(row);
  }

  const leads = el('section', 'detail-section related-leads-section');
  leads.append(el('h3', '', '关联线索'));
  if (view.leads.length === 0) leads.append(el('p', 'empty', '暂无可见关联线索'));
  for (const lead of view.leads) {
    const row = el('article', 'history-row related-lead');
    row.append(
      el('strong', '', lead.title ?? lead.id),
      el('span', '', `${lead.source ?? '来源未知'} · ${lead.status ?? '状态未知'}`),
      el('time', '', displayTime(lead.createdAt)),
    );
    leads.append(row);
  }

  const timeline = el('section', 'detail-section activity-timeline');
  timeline.append(el('h3', '', '活动时间线'));
  const activities = [...view.activities].sort(
    (left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
  );
  if (activities.length === 0) timeline.append(el('p', 'empty', '暂无可见活动'));
  for (const activity of activities) {
    const row = el('article', 'timeline-item');
    row.append(
      el('time', '', displayTime(activity.occurredAt)),
      el('strong', '', activity.type),
      el('p', '', activity.summary),
    );
    timeline.append(row);
  }

  content.append(contacts, ownership, leads, timeline);
  return content;
}

export function createCrmShell(controller: CrmController, width = window.innerWidth): HTMLElement {
  const sections = visibleCrmSections(controller.permissions);
  const employeeChoices = controller.employees.map((employee) => ({
    value: employee.id,
    label: `${employee.displayName ?? employee.id}${employee.employeeNumber ? ` · ${employee.employeeNumber}` : ''}`,
  }));
  const pagination = (total: number, page: number, change: (page: number) => void) => {
    const pages = Math.max(1, Math.ceil(total / controller.pageSize));
    const footer = el('footer', 'pagination');
    const previous = el('button', 'page-button', '← 上一页');
    previous.disabled = page <= 1;
    previous.addEventListener('click', () => {
      change(page - 1);
    });
    const state = el('span', '', `${String(page)} / ${String(pages)} 页 · ${String(total)} 条`);
    const next = el('button', 'page-button', '下一页 →');
    next.disabled = page >= pages;
    next.addEventListener('click', () => {
      change(page + 1);
    });
    footer.append(previous, state, next);
    return footer;
  };
  const shell = el('main', `app-shell ${viewportFor(width)}`);
  const aside = el('aside', 'sidebar');
  const brand = el('div', 'brand-lockup');
  brand.append(el('span', 'brand-mark', 'K'), el('div', 'brand', '金特夫'));
  brand.append(el('p', 'brand-caption', 'Business OS'));
  aside.append(brand);
  const nav = el('nav');
  const navGroup = (title: string, items: readonly [string, string, boolean][]) => {
    const group = el('section', 'nav-group');
    group.append(el('p', 'nav-label', title));
    for (const [glyph, label, active] of items) {
      const item = el('button', `nav-item${active ? ' active' : ''}`);
      item.append(el('span', 'nav-glyph', glyph), el('span', 'nav-text', label));
      group.append(item);
    }
    nav.append(group);
  };
  navGroup('工作空间', [
    ['⌂', '经营总览', true],
    ['◎', '销售工作台', false],
    ['□', '运营工作台', false],
  ]);
  navGroup('销售到回款', [
    ['◇', '线索与客户', false],
    ['△', '商机与 CTR', false],
    ['￥', '成本与报价', false],
    ['✓', '合同与订单', false],
    ['↔', '应收与回款', false],
  ]);
  navGroup('履约协同', [
    ['▦', '计划与生产', false],
    ['◈', '质量与仓储', false],
    ['⌁', '交付与证据', false],
  ]);
  aside.append(nav);
  const sidebarFooter = el('div', 'sidebar-footer');
  sidebarFooter.append(el('span', 'online-dot'), el('span', '', '204 预览环境'));
  aside.append(sidebarFooter);
  const content = el('section', 'workspace');
  const utility = el('header', 'utility-bar');
  const search = el('div', 'global-search');
  search.append(
    el('span', '', '⌕'),
    el('span', '', '搜索客户、订单或业务编号…'),
    el('kbd', '', '⌘ K'),
  );
  const profile = el('div', 'profile-chip');
  profile.append(
    el('span', 'profile-avatar', '超'),
    el('span', '', '超级管理员'),
    el('span', 'chevron', '⌄'),
  );
  utility.append(search, profile);
  content.append(utility);
  const header = el('header', 'topbar');
  const title = el('div');
  title.append(
    el('p', 'eyebrow', '经营总览 · 2026 年 8 月 16 日'),
    el('h1', '', '早上好，超级管理员'),
  );
  title.append(el('p', 'page-subtitle', '从客户机会到订单回款，关注今天最需要推进的事项。'));
  header.append(title);
  if (sections.customerCreate) {
    const create = el('button', 'primary', '＋ 新建客户');
    create.addEventListener('click', () => {
      openForm(
        shell,
        '新建客户',
        '建立客户主档后，可继续补充联系人、商机和跟进活动。',
        [
          {
            name: 'name',
            label: '客户名称',
            required: true,
            placeholder: '例如：华东体育设施有限公司',
          },
          {
            name: 'customerNumber',
            label: '客户编号',
            required: true,
            placeholder: '例如：CUS-2026-001',
          },
          { name: 'tags', label: '客户标签', placeholder: '多个标签用逗号分隔' },
        ],
        '创建客户',
        async (values) => {
          await controller.createCustomer({
            name: values.name ?? '',
            customerNumber: values.customerNumber ?? '',
            tags: (values.tags ?? '')
              .split(/[,，]/u)
              .map((tag) => tag.trim())
              .filter(Boolean),
          });
          bootstrapView(shell, controller);
        },
      );
    });
    header.append(create);
  }
  content.append(header);
  if (controller.error) content.append(el('p', 'error', controller.error));
  const metrics = el('section', 'metrics');
  for (const [label, metric, note, tone] of [
    ['本月销售预测', '¥ 0', '等待商机数据', 'emerald'],
    ['活跃商机', String(controller.leads.length), '需持续推进', 'blue'],
    ['待审批事项', '0', '当前无阻塞', 'amber'],
    ['应收余额', '¥ 0', '回款风险正常', 'violet'],
  ] as const) {
    const card = el('article', `metric ${tone}`);
    card.append(el('span', 'metric-label', label), el('strong', '', metric), el('small', '', note));
    metrics.append(card);
  }
  content.append(metrics);
  const flow = el('section', 'panel business-flow');
  const flowHead = el('div', 'panel-head');
  flowHead.append(el('div', '', '销售到回款主链'), el('span', 'flow-caption', '端到端业务进度'));
  flow.append(flowHead);
  const flowRail = el('div', 'flow-rail');
  for (const [index, label] of [
    '线索',
    '客户',
    '商机',
    'CTR',
    '报价',
    '合同',
    '订单',
    '回款',
  ].entries()) {
    const step = el('div', `flow-step${index === 0 ? ' current' : ''}`);
    step.append(el('span', 'flow-node', String(index + 1)), el('span', '', label));
    flowRail.append(step);
  }
  flow.append(flowRail);
  content.append(flow);
  const sectionHeader = el('div', 'section-heading');
  sectionHeader.append(el('div', '', '今日业务'), el('span', '', '数据实时来自业务台账'));
  content.append(sectionHeader);
  const split = el('section', 'split');
  if (sections.customers) {
    const list = el('article', 'panel customer-list');
    const listHead = el('div', 'panel-head');
    const listTitle = el('div');
    listTitle.append(
      el('h2', '', '重点客户'),
      el('p', 'muted', `${String(controller.customers.length)} 个可见客户`),
    );
    listHead.append(listTitle, el('button', 'text-button', '查看全部 →'));
    const filters = el('div', 'list-filters');
    const customerSearch = el('input', 'filter-search');
    customerSearch.type = 'search';
    customerSearch.placeholder = '搜索客户名称或编号';
    customerSearch.value = controller.customerQuery;
    customerSearch.addEventListener('input', () => {
      controller.customerQuery = customerSearch.value;
      controller.customerPage = 1;
      bootstrapView(shell, controller);
    });
    const statusFilter = el('select', 'filter-select');
    for (const [status, label] of [
      ['ALL', '全部状态'],
      ['PROSPECT', '潜在客户'],
      ['ACTIVE', '合作客户'],
      ['INACTIVE', '暂停合作'],
      ['ARCHIVED', '已归档'],
    ] as const) {
      const option = el('option', '', label);
      option.value = status;
      option.selected = controller.customerStatus === status;
      statusFilter.append(option);
    }
    statusFilter.addEventListener('change', () => {
      controller.customerStatus = statusFilter.value;
      controller.customerPage = 1;
      bootstrapView(shell, controller);
    });
    filters.append(customerSearch, statusFilter);
    list.append(listHead, filters);
    const visibleCustomers = controller.visibleCustomers();
    if (controller.customers.length === 0) {
      const empty = el('div', 'empty-state');
      empty.append(
        el('span', 'empty-icon', '◇'),
        el('strong', '', '还没有客户数据'),
        el('p', '', '新建第一个客户，开始沉淀线索、商机与跟进记录。'),
      );
      list.append(empty);
    } else if (visibleCustomers.length === 0) {
      list.append(el('p', 'empty filter-empty', '没有符合当前筛选条件的客户'));
    }
    for (const customer of controller.customerPageItems()) {
      const row = el('button', 'customer-row');
      row.append(
        el('span', 'avatar', customer.name?.slice(0, 1) ?? '?'),
        el('span', 'identity', customer.name ?? customer.id),
        el('span', 'status', customer.status ?? '—'),
        el('span', 'owner', customer.ownerId ?? '未分配'),
      );
      row.addEventListener('click', () => {
        void controller.selectCustomer(customer.id).then(() => {
          bootstrapView(shell, controller);
        });
      });
      list.append(row);
    }
    if (visibleCustomers.length > 0)
      list.append(
        pagination(visibleCustomers.length, controller.customerPage, (page) => {
          controller.customerPage = page;
          bootstrapView(shell, controller);
        }),
      );
    split.append(list);
  }
  if (sections.customer360 && controller.selected) {
    const detail = el('article', 'panel detail');
    detail.append(
      el('p', 'eyebrow', 'CUSTOMER 360'),
      el('h2', '', controller.selected.customer.name),
      el(
        'p',
        'customer-identity',
        `${controller.selected.customer.customerNumber ?? '编号受限'} · ${controller.selected.customer.status ?? '状态受限'} · ${controller.selected.customer.ownerId ?? '未分配或负责人受限'}`,
      ),
      el(
        'p',
        'muted',
        `${String(controller.selected.contacts.length)} 联系人 · ${String(controller.selected.leads.length)} 线索 · ${String(controller.selected.activities.length)} 活动`,
      ),
      customer360Content(controller.selected),
    );
    const ownershipPermission: CrmPermission =
      controller.selected.customer.ownerId === null
        ? 'customer-ownership:assign'
        : 'customer-ownership:reassign';
    const actions: readonly [CrmPermission, string][] = [
      ['customer:update', '添加联系人'],
      ['customer-activity:create', '记录活动'],
      ['customer:lifecycle', '变更状态'],
      [
        ownershipPermission,
        ownershipPermission === 'customer-ownership:assign' ? '分配客户' : '重新分配客户',
      ],
    ];
    for (const [permission, label] of actions)
      if (
        controller.permissions.has(permission) &&
        (permission !== 'customer:lifecycle' ||
          Number.isInteger(controller.selected.customer.version)) &&
        (!['customer-ownership:assign', 'customer-ownership:reassign'].includes(permission) ||
          (Number.isInteger(controller.selected.customer.version) &&
            controller.selected.customer.ownerId !== undefined))
      ) {
        const button = el('button', 'secondary', label);
        button.addEventListener('click', () => {
          const definitions: Record<string, { description: string; fields: readonly FormField[] }> =
            {
              添加联系人: {
                description: '联系人至少需要填写邮箱；联系方式会受字段权限保护。',
                fields: [
                  { name: 'first', label: '联系人姓名', required: true },
                  { name: 'second', label: '联系人邮箱', type: 'email', required: true },
                ],
              },
              记录活动: {
                description: '跟进记录会进入 Customer 360 活动时间线。',
                fields: [{ name: 'first', label: '活动摘要', type: 'textarea', required: true }],
              },
              变更状态: {
                description: '状态变更会保留原因、操作人和完整审计记录。',
                fields: [
                  {
                    name: 'first',
                    label: '目标状态',
                    type: 'select',
                    required: true,
                    options: [
                      { value: 'PROSPECT', label: '潜在客户' },
                      { value: 'ACTIVE', label: '合作客户' },
                      { value: 'INACTIVE', label: '暂停合作' },
                      { value: 'ARCHIVED', label: '归档' },
                    ],
                  },
                  { name: 'second', label: '变更原因', type: 'textarea', required: true },
                ],
              },
              分配客户: {
                description: '指定客户负责人并记录分配原因。',
                fields: [
                  employeeChoices.length > 0
                    ? {
                        name: 'first',
                        label: '负责人',
                        type: 'select',
                        required: true,
                        options: employeeChoices,
                      }
                    : { name: 'first', label: '负责人 ID', required: true },
                  { name: 'second', label: '分配原因', required: true },
                ],
              },
              重新分配客户: {
                description: '改派操作会保留原负责人和新负责人记录。',
                fields: [
                  employeeChoices.length > 0
                    ? {
                        name: 'first',
                        label: '新负责人',
                        type: 'select',
                        required: true,
                        options: employeeChoices,
                      }
                    : { name: 'first', label: '新负责人 ID', required: true },
                  { name: 'second', label: '改派原因', required: true },
                ],
              },
            };
          const definition = definitions[label];
          if (!definition) return;
          openForm(
            shell,
            label,
            definition.description,
            definition.fields,
            '确认提交',
            async (values) => {
              const action =
                label === '添加联系人'
                  ? 'contact'
                  : label === '记录活动'
                    ? 'activity'
                    : label === '变更状态'
                      ? 'lifecycle'
                      : 'ownership';
              await controller.mutateSelected(action, values.first ?? '', values.second ?? '');
              bootstrapView(shell, controller);
            },
          );
        });
        detail.append(button);
      }
    split.append(detail);
  }
  if (sections.leads) {
    const leads = el('article', 'panel lead-pool');
    const leadHeader = el('div', 'panel-head');
    leadHeader.append(el('h2', '', '线索公海'));
    if (controller.permissions.has('lead:create')) {
      const createLead = el('button', 'secondary', '新建线索');
      createLead.addEventListener('click', () => {
        openForm(
          shell,
          '新建线索',
          '线索默认进入公海，具备权限的销售人员可以认领。',
          [
            {
              name: 'title',
              label: '线索标题',
              required: true,
              placeholder: '例如：学校运动场改造项目',
            },
            {
              name: 'source',
              label: '线索来源',
              type: 'select',
              required: true,
              options: [
                { value: '展会', label: '展会' },
                { value: '网站', label: '网站' },
                { value: '转介绍', label: '转介绍' },
                { value: '主动开发', label: '主动开发' },
              ],
            },
          ],
          '创建线索',
          async (values) => {
            await controller.createLead({
              title: values.title ?? '',
              source: values.source ?? '',
              customerId: null,
              pool: true,
            });
            bootstrapView(shell, controller);
          },
        );
      });
      leadHeader.append(createLead);
    }
    leads.append(leadHeader);
    const leadSearch = el('input', 'filter-search lead-search');
    leadSearch.type = 'search';
    leadSearch.placeholder = '搜索线索标题、来源或状态';
    leadSearch.value = controller.leadQuery;
    leadSearch.addEventListener('input', () => {
      controller.leadQuery = leadSearch.value;
      controller.leadPage = 1;
      bootstrapView(shell, controller);
    });
    leads.append(leadSearch);
    const visibleLeads = controller.visibleLeads();
    for (const lead of controller.leadPageItems()) {
      const row = el('div', 'lead-row', `${lead.title ?? lead.id} · ${lead.source ?? '—'}`);
      if (sections.leadClaim && lead.status === 'POOL' && Number.isInteger(lead.version)) {
        const claim = el('button', 'primary', '认领');
        claim.addEventListener('click', () => {
          void controller.claim(lead).then(() => {
            bootstrapView(shell, controller);
          });
        });
        row.append(claim);
      }
      if (controller.permissions.has('lead:lifecycle') && Number.isInteger(lead.version)) {
        const transition = el('button', 'secondary', '变更状态');
        transition.addEventListener('click', () => {
          openForm(
            shell,
            '变更线索状态',
            '线索状态变更将写入审计记录。',
            [
              {
                name: 'status',
                label: '目标状态',
                type: 'select',
                required: true,
                options: [
                  { value: 'QUALIFIED', label: '已确认' },
                  { value: 'DISQUALIFIED', label: '无效线索' },
                  { value: 'CONVERTED', label: '已转化' },
                ],
              },
              { name: 'reason', label: '变更原因', type: 'textarea', required: true },
            ],
            '确认变更',
            async (values) => {
              await controller.mutateLead(
                lead,
                'lifecycle',
                values.status ?? '',
                values.reason ?? '',
              );
              bootstrapView(shell, controller);
            },
          );
        });
        row.append(transition);
      }
      const assignmentPermission =
        lead.ownerId === undefined ? null : lead.ownerId === null ? 'lead:assign' : 'lead:reassign';
      if (
        assignmentPermission !== null &&
        controller.permissions.has(assignmentPermission) &&
        Number.isInteger(lead.version)
      ) {
        const assign = el('button', 'secondary', lead.ownerId === null ? '分配' : '改派');
        assign.addEventListener('click', () => {
          openForm(
            shell,
            lead.ownerId === null ? '分配线索' : '改派线索',
            '指定负责人并保留分配原因。',
            [
              employeeChoices.length > 0
                ? {
                    name: 'assigneeId',
                    label: '负责人',
                    type: 'select',
                    required: true,
                    options: employeeChoices,
                  }
                : { name: 'assigneeId', label: '负责人 ID', required: true },
              { name: 'reason', label: '分配原因', type: 'textarea', required: true },
            ],
            '确认分配',
            async (values) => {
              await controller.mutateLead(
                lead,
                'assignment',
                values.assigneeId ?? '',
                values.reason ?? '',
              );
              bootstrapView(shell, controller);
            },
          );
        });
        row.append(assign);
      }
      if (
        typeof lead.ownerId === 'string' &&
        lead.status === 'CLAIMED' &&
        controller.permissions.has('lead-pool:release') &&
        Number.isInteger(lead.version)
      ) {
        const release = el('button', 'secondary', '释放公海');
        release.addEventListener('click', () => {
          openForm(
            shell,
            '释放至线索公海',
            '释放后其他具备权限的销售人员可以认领。',
            [{ name: 'reason', label: '释放原因', type: 'textarea', required: true }],
            '确认释放',
            async (values) => {
              await controller.mutateLead(lead, 'release', '', values.reason ?? '');
              bootstrapView(shell, controller);
            },
          );
        });
        row.append(release);
      }
      leads.append(row);
    }
    if (visibleLeads.length > 0)
      leads.append(
        pagination(visibleLeads.length, controller.leadPage, (page) => {
          controller.leadPage = page;
          bootstrapView(shell, controller);
        }),
      );
    if (visibleLeads.length === 0) {
      const queue = el('div', 'queue-list');
      for (const [title, detail, badge] of [
        ['待跟进线索', '暂无逾期线索', '0'],
        ['待提交 CTR', '技术需求等待确认', '0'],
        ['待审批报价', '价格与利润率检查', '0'],
      ]) {
        const item = el('div', 'queue-item');
        item.append(el('span', 'queue-status'), el('div', 'queue-copy', title));
        item.append(el('small', '', detail), el('b', '', badge));
        queue.append(item);
      }
      leads.append(queue);
    }
    split.append(leads);
  }
  content.append(split);
  shell.append(aside, content);
  return shell;
}

function bootstrapView(current: HTMLElement, controller: CrmController): void {
  current.replaceWith(createCrmShell(controller));
}
type SessionDto = Readonly<{ permissions: readonly string[] }>;
async function login(login: string, password: string): Promise<string> {
  const result = await json<{ token: string }>('/api/v1/auth/login', '', {
    method: 'POST',
    body: JSON.stringify({ login, password }),
  });
  return result.token;
}
function loginView(root: HTMLElement): void {
  const form = el('form', 'login panel');
  form.append(el('h1', '', BOOTSTRAP_TITLE));
  const identity = el('input');
  identity.name = 'login';
  identity.placeholder = '账号';
  identity.required = true;
  const password = el('input');
  password.name = 'password';
  password.type = 'password';
  password.placeholder = '密码';
  password.required = true;
  const submit = el('button', 'primary', '登录');
  submit.type = 'submit';
  form.append(identity, password, submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void login(identity.value, password.value)
      .then((token) => {
        sessionStorage.setItem('kingturf.session', token);
        void bootstrap(root);
      })
      .catch(() => {
        form.append(el('p', 'error', '登录失败'));
      });
  });
  root.replaceChildren(form);
}
export async function bootstrap(root: HTMLElement): Promise<void> {
  const allowed = new Set<CrmPermission>([
    'employee:read',
    'customer:read',
    'customer:create',
    'customer:update',
    'customer:lifecycle',
    'customer-ownership:assign',
    'customer-ownership:reassign',
    'customer-activity:create',
    'customer-360:read',
    'lead:read',
    'lead:create',
    'lead-pool:read',
    'lead-pool:claim',
    'lead-pool:release',
    'lead:lifecycle',
    'lead:assign',
    'lead:reassign',
  ]);
  const token = sessionStorage.getItem('kingturf.session');
  if (!token) {
    loginView(root);
    return;
  }
  let session: SessionDto;
  try {
    session = await json<SessionDto>('/api/v1/auth/session', token);
  } catch {
    sessionStorage.removeItem('kingturf.session');
    loginView(root);
    return;
  }
  const permissions = new Set(
    session.permissions.filter((item): item is CrmPermission => allowed.has(item as CrmPermission)),
  );
  const controller = new CrmController(permissions, createFetchCrmApi(token));
  try {
    await controller.load();
  } catch (error) {
    controller.error = error instanceof Error ? error.message : 'CRM 加载失败';
  }
  const shell = createCrmShell(controller);
  const commercialPermissions = new Set(
    session.permissions.filter(
      (item) =>
        item.startsWith('opportunity:') ||
        item.startsWith('ctr:') ||
        item.startsWith('technical-solution:') ||
        item.startsWith('cost:') ||
        item.startsWith('sales-policy:') ||
        item.startsWith('quote:'),
    ) as CommercialPermission[],
  );
  if (Object.values(visibleCommercialSections(commercialPermissions)).some(Boolean)) {
    const commercialController = new CommercialController(
      createFetchCommercialApi(token),
      commercialPermissions,
    );
    try {
      await commercialController.load();
    } catch (error) {
      commercialController.message = error instanceof Error ? error.message : '商业工作台加载失败';
    }
    shell.append(
      commercialWorkspaceStructure(
        viewportFor(globalThis.innerWidth || 1280),
        false,
        commercialController,
      ),
    );
  }
  root.replaceChildren(shell);
}
