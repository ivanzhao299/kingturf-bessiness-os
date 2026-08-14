export const BOOTSTRAP_TITLE = 'KingTurf Business OS';

export type CrmPermission =
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
  public customers: readonly Customer[] = [];
  public pool: readonly Lead[] = [];
  public leads: readonly Lead[] = [];
  public selected: Customer360 | null = null;
  public error: string | null = null;
  public constructor(
    public readonly permissions: ReadonlySet<CrmPermission>,
    private readonly api: CrmApi,
  ) {}
  public async load(): Promise<void> {
    const sections = visibleCrmSections(this.permissions);
    const [customers, pool, leads] = await Promise.all([
      sections.customers ? this.api.listCustomers() : Promise.resolve([]),
      this.permissions.has('lead-pool:read') ? this.api.listPool() : Promise.resolve([]),
      this.permissions.has('lead:read') ? this.api.listLeads() : Promise.resolve([]),
    ]);
    this.customers = customers;
    this.pool = pool;
    this.leads = leads;
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
const value = (message: string) => window.prompt(message)?.trim() ?? '';
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
  const shell = el('main', `app-shell ${viewportFor(width)}`);
  const aside = el('aside', 'sidebar');
  aside.append(el('div', 'brand', 'KingTurf'), el('p', 'eyebrow', 'BUSINESS OS'));
  const nav = el('nav');
  if (sections.customers) nav.append(el('button', 'nav-item active', '客户档案'));
  if (sections.leads) nav.append(el('button', 'nav-item', '线索公海'));
  aside.append(nav);
  const content = el('section', 'workspace');
  const header = el('header', 'topbar');
  header.append(el('h1', '', '客户与线索工作台'));
  if (sections.customerCreate) {
    const create = el('button', 'primary', '新建客户');
    create.addEventListener('click', () => {
      const name = value('客户名称');
      const customerNumber = value('客户编号');
      if (name && customerNumber)
        void controller.createCustomer({ name, customerNumber, tags: [] }).then(() => {
          bootstrapView(shell, controller);
        });
    });
    header.append(create);
  }
  content.append(header);
  if (controller.error) content.append(el('p', 'error', controller.error));
  const split = el('section', 'split');
  if (sections.customers) {
    const list = el('article', 'panel customer-list');
    list.append(el('h2', '', '客户列表'));
    for (const customer of controller.customers) {
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
    const actions: readonly [CrmPermission, string, () => Promise<void>][] = [
      [
        'customer:update',
        '添加联系人',
        () => controller.mutateSelected('contact', value('联系人姓名'), value('联系人邮箱')),
      ],
      [
        'customer-activity:create',
        '记录活动',
        () => controller.mutateSelected('activity', value('活动摘要')),
      ],
      [
        'customer:lifecycle',
        '变更状态',
        () => controller.mutateSelected('lifecycle', value('目标状态'), value('变更原因')),
      ],
      [
        ownershipPermission,
        ownershipPermission === 'customer-ownership:assign' ? '分配客户' : '重新分配客户',
        () => controller.mutateSelected('ownership', value('负责人 ID'), value('分配原因')),
      ],
    ];
    for (const [permission, label, handler] of actions)
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
          void handler().then(() => {
            bootstrapView(shell, controller);
          });
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
        const title = value('线索标题');
        const source = value('线索来源');
        if (title && source)
          void controller.createLead({ title, source, customerId: null, pool: true }).then(() => {
            bootstrapView(shell, controller);
          });
      });
      leadHeader.append(createLead);
    }
    leads.append(leadHeader);
    const visibleLeads = [...controller.pool, ...controller.leads].filter(
      (lead, index, all) => all.findIndex((candidate) => candidate.id === lead.id) === index,
    );
    for (const lead of visibleLeads) {
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
          void controller
            .mutateLead(lead, 'lifecycle', value('目标状态'), value('变更原因'))
            .then(() => {
              bootstrapView(shell, controller);
            });
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
          void controller
            .mutateLead(lead, 'assignment', value('负责人 ID'), value('分配原因'))
            .then(() => {
              bootstrapView(shell, controller);
            });
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
          void controller.mutateLead(lead, 'release', '', value('释放原因')).then(() => {
            bootstrapView(shell, controller);
          });
        });
        row.append(release);
      }
      leads.append(row);
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
