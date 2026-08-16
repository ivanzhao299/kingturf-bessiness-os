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
  | 'attachment:read'
  | 'attachment:manage'
  | 'technical-solution:read'
  | 'technical-solution:create'
  | 'technical-solution:update'
  | 'cost-model:read'
  | 'cost-model:manage'
  | 'cost:read'
  | 'cost:evaluate'
  | 'sales-policy:manage'
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

const recordValue = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const ctrRequirementFields = [
  ['application', '应用场景'],
  ['pileHeightMm', '草高（mm）'],
  ['quantitySquareMeters', '预计面积（㎡）'],
  ['color', '颜色要求'],
  ['delivery', '交付要求'],
] as const;

const displayRequirement = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '—';
const formValue = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const textValue = (value: unknown, fallback: string): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
const recordText = (
  record: Record<string, unknown>,
  camel: string,
  snake: string,
  fallback = '',
): string => textValue(record[camel] ?? record[snake], fallback);
const decimalValue = (value: number): string =>
  String(Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000);

function printIssuedQuote(quote: Record<string, unknown>): void {
  const popup = globalThis.open('', '_blank', 'noopener,noreferrer');
  if (!popup) throw new Error('浏览器阻止了报价打印窗口，请允许本站弹出窗口');
  popup.document.title = `${textValue(quote.quoteNumber, 'KingTurf-Quote')}-R${textValue(quote.revision, '1')}`;
  const style = popup.document.createElement('style');
  style.textContent = `
    @page { size: A4; margin: 16mm 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #263a31; font: 13px/1.55 -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; }
    header { display: flex; justify-content: space-between; align-items: flex-start; color: #176846; }
    h1 { margin: 0; font-size: 28px; letter-spacing: .04em; }
    h2 { margin: 0; font-size: 24px; font-weight: 500; }
    .meta, table { width: 100%; border-collapse: collapse; margin-top: 22px; }
    th, td { padding: 9px 10px; border: 1px solid #dce5e0; text-align: left; }
    th { background: #176846; color: white; font-weight: 600; }
    .meta td:nth-child(odd) { width: 15%; background: #f2f6f4; }
    .money { text-align: right; }
    .totals { width: 48%; margin: 18px 0 0 auto; }
    .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
    .grand { border-top: 2px solid #176846; color: #176846; font-size: 18px; }
    .pins { margin-top: 28px; padding: 14px; background: #f4f7f5; font-size: 10px; word-break: break-all; }
    footer { position: fixed; bottom: 0; width: 100%; border-top: 1px solid #dce5e0; padding-top: 7px; color: #71847a; font-size: 9px; }
  `;
  popup.document.head.append(style);
  const body = popup.document.body;
  const header = popup.document.createElement('header');
  const brand = popup.document.createElement('div');
  brand.innerHTML = '<h1>KINGTURF</h1><small>BUSINESS OS</small>';
  const title = popup.document.createElement('h2');
  title.textContent = '正式报价单 / QUOTATION';
  header.append(brand, title);
  const metadata = popup.document.createElement('table');
  metadata.className = 'meta';
  const metadataRow = popup.document.createElement('tr');
  for (const value of [
    '报价编号',
    textValue(quote.quoteNumber, '—'),
    '版本 / 状态',
    `R${textValue(quote.revision, '1')} / ${textValue(quote.status, 'ISSUED')}`,
  ]) {
    const cell = popup.document.createElement('td');
    cell.textContent = value;
    metadataRow.append(cell);
  }
  metadata.append(metadataRow);
  const heading = popup.document.createElement('h3');
  heading.textContent = '报价明细';
  const table = popup.document.createElement('table');
  const tableHead = popup.document.createElement('tr');
  for (const label of ['序号', '产品 / 服务', '数量', '单位', '单价', '金额']) {
    const cell = popup.document.createElement('th');
    cell.textContent = label;
    tableHead.append(cell);
  }
  table.append(tableHead);
  const lines = Array.isArray(quote.lines) ? quote.lines : [];
  lines.forEach((line, index) => {
    const item = recordValue(line);
    const row = popup.document.createElement('tr');
    for (const value of [
      String(index + 1),
      textValue(item.description, '报价行'),
      textValue(item.quantity, '—'),
      textValue(item.unit_code, ''),
      textValue(item.unit_price, '—'),
      textValue(item.total, '—'),
    ]) {
      const cell = popup.document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    table.append(row);
  });
  const totals = popup.document.createElement('section');
  totals.className = 'totals';
  for (const [label, value, className] of [
    ['报价小计', textValue(quote.subtotal, '—'), ''],
    ['整单折扣', `- ${textValue(quote.discount, '0')}`, ''],
    ['报价总额', textValue(quote.total, '—'), 'grand'],
    [
      '预计毛利',
      `${textValue(quote.margin, '—')} (${String(Number(quote.marginBasisPoints ?? 0) / 100)}%)`,
      '',
    ],
  ] as const) {
    const row = popup.document.createElement('div');
    row.className = className;
    const labelNode = popup.document.createElement('span');
    labelNode.textContent = label;
    const valueNode = popup.document.createElement('strong');
    valueNode.textContent = `${textValue(quote.currency, '')} ${value}`;
    row.append(labelNode, valueNode);
    totals.append(row);
  }
  const pins = popup.document.createElement('section');
  pins.className = 'pins';
  pins.textContent = `版本证据：CTR ${textValue(quote.ctrVersionId, '')} · 技术方案 ${textValue(quote.technicalSolutionRevisionId, '')} · 成本 ${textValue(quote.costDecisionId, '')} · 政策 ${textValue(quote.policyVersionId, '')} · 签发快照 ${textValue(quote.issuedSnapshotHash, '')}`;
  const footer = popup.document.createElement('footer');
  footer.textContent = '金特夫 KingTurf · 系统签发报价 · 签发版本只读';
  body.append(header, metadata, heading, table, totals, pins, footer);
  popup.focus();
  popup.print();
}

export type Opportunity = Readonly<{
  id: string;
  customerId?: string | null;
  leadId?: string | null;
  name?: string;
  status?: string;
  value?: Readonly<{ amount: string; currency: string }>;
  probabilityBasisPoints?: number;
  expectedCloseDate?: string;
  version?: number;
}>;

export type CommercialApi = Readonly<{
  listOpportunities(): Promise<readonly Opportunity[]>;
  list(path: string): Promise<readonly Record<string, unknown>[]>;
  submit(
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH',
  ): Promise<Record<string, unknown>>;
  uploadCtrAttachment(versionId: string, file: File): Promise<Record<string, unknown>>;
  command(
    revisionId: string,
    action: 'approve' | 'issue',
    payload?: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}>;

export class CommercialController {
  public opportunities: readonly Opportunity[] = [];
  public customers: readonly Customer[] = [];
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
        ['cost-model:read', '/api/v1/cost-models'],
        ['cost:read', '/api/v1/cost-evaluations'],
        ['sales-policy:read', '/api/v1/sales-policies'],
        ['sales-policy:read', '/api/v1/sales-policy-evaluations'],
        ['quote:read', '/api/v1/quotes'],
        ['credit:read', '/api/v1/credit-limits'],
        ['credit:read', '/api/v1/credit-decisions'],
        ['contract:read', '/api/v1/contracts'],
        ['sales-order:read', '/api/v1/sales-orders'],
        ['ar:read', '/api/v1/ar-open-items'],
        ['bank-payment:read', '/api/v1/bank-payments'],
        ['reconciliation:read', '/api/v1/reconciliation-runs'],
      ] as const;
      for (const [permission, path] of readable)
        if (this.permissions.has(permission)) this.views.set(path, await this.api.list(path));
      this.message = `已加载 ${String(this.opportunities.length)} 个商机`;
    } finally {
      this.loading = false;
    }
  }
  public async submit(
    path: string,
    payload: Record<string, unknown>,
    method: 'POST' | 'PATCH' = 'POST',
  ): Promise<void> {
    this.loading = true;
    try {
      this.revisionState = await this.api.submit(path, payload, method);
      this.message = '已保存；版本与决策引用已由服务器返回';
      if (path === '/api/v1/opportunities') await this.load();
    } finally {
      this.loading = false;
    }
  }
  public async transitionOpportunity(
    opportunity: Opportunity,
    status: string,
    reason: string,
  ): Promise<void> {
    if (!Number.isInteger(opportunity.version)) throw new Error('商机版本信息不可用');
    await this.submit(
      `/api/v1/opportunities/${opportunity.id}`,
      { status, reason, expectedVersion: opportunity.version },
      'PATCH',
    );
    await this.load();
  }
  public async uploadCtrAttachment(versionId: string, file: File): Promise<void> {
    this.loading = true;
    try {
      this.revisionState = await this.api.uploadCtrAttachment(versionId, file);
      this.message = `附件 ${file.name} 已上传并关联到 CTR 草稿`;
      await this.load();
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
  if (controller && permissions.has('opportunity:read')) {
    const pipeline = document.createElement('section');
    pipeline.className = 'pipeline-board';
    const heading = document.createElement('div');
    heading.className = 'pipeline-heading';
    const headingCopy = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = '商机阶段看板';
    const subtitle = document.createElement('p');
    subtitle.textContent = '按阶段推进预计金额、赢率与成交日期';
    headingCopy.append(title, subtitle);
    if (permissions.has('opportunity:create')) {
      const create = document.createElement('button');
      create.className = 'primary';
      create.textContent = '＋ 新建商机';
      create.addEventListener('click', () => {
        openForm(
          workspace,
          '新建商机',
          '建立销售机会并设置初始金额、赢率与预计成交日期。',
          [
            {
              name: 'customerId',
              label: '关联客户',
              type: 'select',
              options: [
                { value: 'none', label: '暂不关联客户' },
                ...controller.customers.map((customer) => ({
                  value: customer.id,
                  label: customer.name ?? customer.id,
                })),
              ],
            },
            {
              name: 'name',
              label: '商机名称',
              required: true,
              placeholder: '例如：国际学校足球场项目',
            },
            {
              name: 'value',
              label: '预计金额',
              type: 'number',
              required: true,
              placeholder: '500000',
            },
            {
              name: 'currency',
              label: '币种',
              type: 'select',
              required: true,
              options: [
                { value: 'CNY', label: '人民币 CNY' },
                { value: 'USD', label: '美元 USD' },
                { value: 'EUR', label: '欧元 EUR' },
              ],
            },
            {
              name: 'probability',
              label: '成交概率（%）',
              type: 'number',
              required: true,
              placeholder: '30',
            },
            { name: 'expectedCloseDate', label: '预计成交日期', type: 'date', required: true },
          ],
          '创建商机',
          async (values) => {
            await controller.submit('/api/v1/opportunities', {
              customerId: values.customerId === 'none' ? null : (values.customerId ?? null),
              leadId: null,
              name: values.name ?? '',
              value: values.value ?? '',
              currency: values.currency ?? 'CNY',
              probabilityBasisPoints: Math.round(Number(values.probability ?? 0) * 100),
              expectedCloseDate: values.expectedCloseDate ?? '',
            });
            pipeline.replaceWith(
              commercialWorkspaceStructure(viewport, immutable, controller).querySelector(
                '.pipeline-board',
              ) ?? pipeline,
            );
          },
        );
      });
      heading.append(headingCopy, create);
    } else heading.append(headingCopy);
    pipeline.append(heading);
    const columns = document.createElement('div');
    columns.className = 'pipeline-columns';
    const stages = [
      ['OPEN', '初步接洽'],
      ['QUALIFIED', '需求确认'],
      ['PROPOSAL', '方案报价'],
      ['WON', '赢单'],
      ['LOST', '输单'],
    ] as const;
    for (const [stage, label] of stages) {
      const column = document.createElement('section');
      column.className = `pipeline-column stage-${stage.toLocaleLowerCase()}`;
      const opportunities = controller.opportunities.filter((item) => item.status === stage);
      const columnHeading = document.createElement('header');
      columnHeading.textContent = `${label} · ${String(opportunities.length)}`;
      column.append(columnHeading);
      for (const opportunity of opportunities) {
        const card = document.createElement('article');
        card.className = 'opportunity-card';
        const name = document.createElement('strong');
        name.textContent = opportunity.name ?? opportunity.id;
        const amount = document.createElement('span');
        amount.textContent = opportunity.value
          ? `${opportunity.value.currency} ${opportunity.value.amount}`
          : '金额受限';
        const meta = document.createElement('small');
        meta.textContent = `${String((opportunity.probabilityBasisPoints ?? 0) / 100)}% · ${opportunity.expectedCloseDate ?? '日期未定'}`;
        card.append(name, amount, meta);
        const nextStage =
          stage === 'OPEN'
            ? 'QUALIFIED'
            : stage === 'QUALIFIED'
              ? 'PROPOSAL'
              : stage === 'PROPOSAL'
                ? 'WON'
                : null;
        if (nextStage && permissions.has('opportunity:lifecycle')) {
          const advance = document.createElement('button');
          advance.className = 'text-button';
          advance.textContent = '推进 →';
          advance.addEventListener('click', () => {
            openForm(
              workspace,
              '推进商机阶段',
              `从“${label}”推进至下一阶段。`,
              [{ name: 'reason', label: '推进依据', type: 'textarea', required: true }],
              '确认推进',
              async (values) => {
                await controller.transitionOpportunity(opportunity, nextStage, values.reason ?? '');
                status.textContent = controller.message;
              },
            );
          });
          card.append(advance);
        }
        column.append(card);
      }
      if (opportunities.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'pipeline-empty';
        empty.textContent = '暂无商机';
        column.append(empty);
      }
      columns.append(column);
    }
    pipeline.append(columns);
    workspace.append(pipeline);
  }
  if (controller && permissions.has('ctr:read')) {
    const ctrPanel = document.createElement('section');
    ctrPanel.className = 'ctr-workbench';
    const heading = document.createElement('div');
    heading.className = 'pipeline-heading';
    const copy = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = '技术需求 CTR';
    const subtitle = document.createElement('p');
    subtitle.textContent = '结构化记录场景、规格、数量和交付要求，提交后形成不可变快照';
    copy.append(title, subtitle);
    if (permissions.has('ctr:create')) {
      const create = document.createElement('button');
      create.className = 'primary';
      create.textContent = '＋ 新建 CTR';
      create.addEventListener('click', () => {
        openForm(
          workspace,
          '新建技术需求',
          'CTR 必须关联一个商机，提交前可以继续创建修订版本。',
          [
            {
              name: 'opportunityId',
              label: '关联商机',
              type: 'select',
              required: true,
              options: controller.opportunities.map((item) => ({
                value: item.id,
                label: item.name ?? item.id,
              })),
            },
            { name: 'code', label: 'CTR 编号', required: true, placeholder: 'CTR-2026-001' },
            {
              name: 'title',
              label: '需求标题',
              required: true,
              placeholder: '学校足球场人造草坪技术需求',
            },
            {
              name: 'application',
              label: '应用场景',
              type: 'select',
              required: true,
              options: [
                { value: '足球场', label: '足球场' },
                { value: '休闲景观', label: '休闲景观' },
                { value: '多功能运动场', label: '多功能运动场' },
              ],
            },
            {
              name: 'pileHeight',
              label: '草高（mm）',
              type: 'number',
              required: true,
              placeholder: '50',
            },
            {
              name: 'quantity',
              label: '预计面积（㎡）',
              type: 'number',
              required: true,
              placeholder: '8000',
            },
            { name: 'color', label: '颜色要求', required: true, placeholder: '双色翠绿' },
            { name: 'delivery', label: '交付要求', type: 'textarea', required: true },
          ],
          '创建 CTR',
          async (values) => {
            await controller.submit('/api/v1/ctrs', {
              opportunityId: values.opportunityId ?? '',
              code: values.code ?? '',
              title: values.title ?? '',
              requirements: {
                application: values.application ?? '',
                pileHeightMm: Number(values.pileHeight ?? 0),
                quantitySquareMeters: Number(values.quantity ?? 0),
                color: values.color ?? '',
                delivery: values.delivery ?? '',
              },
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      heading.append(copy, create);
    } else heading.append(copy);
    ctrPanel.append(heading);
    const table = document.createElement('div');
    table.className = 'ctr-table';
    const ctrs = controller.views.get('/api/v1/ctrs') ?? [];
    const latestVersionByCtr = new Map<string, number>();
    for (const item of ctrs) {
      const rootId = typeof item.ctrId === 'string' ? item.ctrId : '';
      const revision = typeof item.version === 'number' ? item.version : 0;
      latestVersionByCtr.set(rootId, Math.max(latestVersionByCtr.get(rootId) ?? 0, revision));
    }
    for (const ctr of ctrs) {
      const ctrCode = typeof ctr.code === 'string' ? ctr.code : 'CTR';
      const ctrTitle = typeof ctr.title === 'string' ? ctr.title : '未命名需求';
      const ctrVersion = typeof ctr.version === 'number' ? ctr.version : 1;
      const ctrStatus = typeof ctr.status === 'string' ? ctr.status : 'DRAFT';
      const ctrId = typeof ctr.ctrId === 'string' ? ctr.ctrId : '';
      const requirements = recordValue(ctr.requirements);
      const attachments = Array.isArray(ctr.attachments) ? ctr.attachments : [];
      const row = document.createElement('article');
      row.className = 'ctr-row';
      const identity = document.createElement('div');
      const code = document.createElement('strong');
      code.textContent = ctrCode;
      const name = document.createElement('span');
      name.textContent = ctrTitle;
      identity.append(code, name);
      const version = document.createElement('span');
      version.textContent = `V${String(ctrVersion)}`;
      const state = document.createElement('span');
      state.className = `ctr-state state-${ctrStatus.toLocaleLowerCase()}`;
      state.textContent = ctrStatus;
      const actions = document.createElement('div');
      actions.className = 'ctr-actions';
      if (
        ctrStatus === 'DRAFT' &&
        permissions.has('ctr:update') &&
        permissions.has('attachment:manage')
      ) {
        const upload = document.createElement('button');
        upload.className = 'secondary';
        upload.textContent = '上传附件';
        upload.addEventListener('click', () => {
          openFileForm(workspace, `为 ${ctrCode} V${String(ctrVersion)} 上传附件`, async (file) => {
            await controller.uploadCtrAttachment(String(ctr.id), file);
            status.textContent = controller.message;
          });
        });
        actions.append(upload);
      }
      if (
        ctrId !== '' &&
        ctrVersion === latestVersionByCtr.get(ctrId) &&
        ctrStatus !== 'DRAFT' &&
        permissions.has('ctr:update')
      ) {
        const revise = document.createElement('button');
        revise.className = 'secondary';
        revise.textContent = '新建修订';
        revise.addEventListener('click', () => {
          openForm(
            workspace,
            `新建 ${ctrCode} 修订`,
            `基于 V${String(ctrVersion)} 创建新的可编辑草稿，历史版本保持不变。`,
            [
              { name: 'title', label: '需求标题', required: true, value: ctrTitle },
              {
                name: 'application',
                label: '应用场景',
                required: true,
                value: displayRequirement(requirements.application),
              },
              {
                name: 'pileHeight',
                label: '草高（mm）',
                type: 'number',
                required: true,
                value: displayRequirement(requirements.pileHeightMm),
              },
              {
                name: 'quantity',
                label: '预计面积（㎡）',
                type: 'number',
                required: true,
                value: displayRequirement(requirements.quantitySquareMeters),
              },
              {
                name: 'color',
                label: '颜色要求',
                required: true,
                value: displayRequirement(requirements.color),
              },
              {
                name: 'delivery',
                label: '交付要求',
                type: 'textarea',
                required: true,
                value: displayRequirement(requirements.delivery),
              },
            ],
            '创建修订草稿',
            async (values) => {
              await controller.submit(`/api/v1/ctrs/${ctrId}/versions`, {
                title: values.title ?? '',
                requirements: {
                  application: values.application ?? '',
                  pileHeightMm: Number(values.pileHeight ?? 0),
                  quantitySquareMeters: Number(values.quantity ?? 0),
                  color: values.color ?? '',
                  delivery: values.delivery ?? '',
                },
              });
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        actions.append(revise);
      }
      if (ctrStatus === 'DRAFT' && permissions.has('ctr:submit')) {
        const submit = document.createElement('button');
        submit.className = 'secondary';
        submit.textContent = '提交评审';
        submit.addEventListener('click', () => {
          void controller
            .submit(`/api/v1/ctr-versions/${String(ctr.id)}/submit`, {
              expectedVersion: ctrVersion,
            })
            .then(() => {
              status.textContent = 'CTR 已提交并生成不可变快照';
            });
        });
        actions.append(submit);
      }
      if (ctrStatus === 'SUBMITTED' && permissions.has('ctr:approve')) {
        for (const [decision, label] of [
          ['APPROVED', '批准'],
          ['REJECTED', '驳回'],
        ] as const) {
          const decide = document.createElement('button');
          decide.className = decision === 'APPROVED' ? 'primary' : 'secondary';
          decide.textContent = label;
          decide.addEventListener('click', () => {
            openForm(
              workspace,
              `${label} CTR`,
              '审批决定和理由将永久保留。',
              [{ name: 'reason', label: '审批意见', type: 'textarea', required: true }],
              `确认${label}`,
              async (values) => {
                await controller.submit(`/api/v1/ctr-versions/${String(ctr.id)}/decision`, {
                  decision,
                  reason: values.reason ?? '',
                });
                status.textContent = `CTR 已${label}`;
              },
            );
          });
          actions.append(decide);
        }
      }
      const evidence = document.createElement('details');
      evidence.className = 'ctr-evidence';
      const summary = document.createElement('summary');
      summary.textContent = `规格与证据 · ${String(attachments.length)} 个附件`;
      const specification = document.createElement('dl');
      specification.className = 'ctr-specification';
      const previous = ctrs.find((item) => item.ctrId === ctrId && item.version === ctrVersion - 1);
      const previousRequirements = recordValue(previous?.requirements);
      for (const [key, label] of ctrRequirementFields) {
        const term = document.createElement('dt');
        term.textContent = label;
        const definition = document.createElement('dd');
        const currentValue = displayRequirement(requirements[key]);
        const previousValue = displayRequirement(previousRequirements[key]);
        definition.textContent =
          previous && currentValue !== previousValue
            ? `${currentValue}（上一版：${previousValue}）`
            : currentValue;
        if (previous && currentValue !== previousValue) definition.className = 'changed';
        specification.append(term, definition);
      }
      evidence.append(summary, specification);
      row.append(identity, version, state, actions, evidence);
      table.append(row);
    }
    if (ctrs.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'pipeline-empty';
      empty.textContent = '暂无 CTR，先从一个已确认需求的商机创建技术需求。';
      table.append(empty);
    }
    ctrPanel.append(table);
    workspace.append(ctrPanel);
  }
  if (controller && permissions.has('technical-solution:read')) {
    const solutionPanel = el('section', 'solution-workbench');
    const solutionHeading = el('div', 'pipeline-heading');
    const solutionCopy = el('div');
    solutionCopy.append(
      el('h2', '', '技术方案'),
      el('p', '', '将产品规格和工程假设固定到明确的 CTR 版本，保留修订差异。'),
    );
    const solutions = controller.views.get('/api/v1/technical-solutions') ?? [];
    const ctrs = controller.views.get('/api/v1/ctrs') ?? [];
    const eligibleCtrs = ctrs.filter((item) => item.status === 'APPROVED');
    const solutionFields = (
      specification: Record<string, unknown> = {},
      assumptions: readonly unknown[] = [],
      ctrVersionId = '',
      state = 'DRAFT',
    ): readonly FormField[] => [
      {
        name: 'ctrVersionId',
        label: '已批准 CTR 版本',
        type: 'select',
        required: true,
        value: ctrVersionId,
        options: eligibleCtrs.map((item) => ({
          value: String(item.id),
          label: `${textValue(item.code, 'CTR')} · V${textValue(item.version, '1')} · ${textValue(item.title, '')}`,
        })),
      },
      {
        name: 'productFamily',
        label: '产品系列',
        required: true,
        value: formValue(specification.productFamily),
      },
      {
        name: 'pileHeight',
        label: '草高（mm）',
        type: 'number',
        required: true,
        value: formValue(specification.pileHeightMm),
      },
      {
        name: 'dtex',
        label: '纤度（Dtex）',
        type: 'number',
        required: true,
        value: formValue(specification.dtex),
      },
      {
        name: 'stitchRate',
        label: '簇密度（针/㎡）',
        type: 'number',
        required: true,
        value: formValue(specification.stitchRate),
      },
      {
        name: 'backing',
        label: '底布系统',
        required: true,
        value: formValue(specification.backing),
      },
      {
        name: 'infill',
        label: '填充建议',
        required: true,
        value: formValue(specification.infill),
      },
      {
        name: 'warrantyYears',
        label: '质保年限',
        type: 'number',
        required: true,
        value: formValue(specification.warrantyYears),
      },
      {
        name: 'assumptions',
        label: '工程假设（每行一项）',
        type: 'textarea',
        required: true,
        value: assumptions.map(String).join('\n'),
      },
      {
        name: 'state',
        label: '方案状态',
        type: 'select',
        required: true,
        value: state,
        options: [
          { value: 'DRAFT', label: '草稿' },
          { value: 'FINAL', label: '定稿（可进入成本核算）' },
        ],
      },
    ];
    const solutionPayload = (values: Record<string, string>) => ({
      ctrVersionId: values.ctrVersionId ?? '',
      specification: {
        productFamily: values.productFamily ?? '',
        pileHeightMm: Number(values.pileHeight ?? 0),
        dtex: Number(values.dtex ?? 0),
        stitchRate: Number(values.stitchRate ?? 0),
        backing: values.backing ?? '',
        infill: values.infill ?? '',
        warrantyYears: Number(values.warrantyYears ?? 0),
      },
      assumptions: (values.assumptions ?? '')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      final: values.state === 'FINAL',
    });
    if (permissions.has('technical-solution:create') && eligibleCtrs.length > 0) {
      const createSolution = el('button', 'primary', '＋ 新建技术方案');
      createSolution.addEventListener('click', () => {
        openForm(
          workspace,
          '新建技术方案',
          '方案的每项规格都将关联到选定的已批准 CTR 版本。',
          [
            {
              name: 'opportunityId',
              label: '关联商机',
              type: 'select',
              required: true,
              options: controller.opportunities.map((item) => ({
                value: item.id,
                label: item.name ?? item.id,
              })),
            },
            { name: 'code', label: '方案编号', required: true, placeholder: 'TS-2026-001' },
            ...solutionFields(),
          ],
          '保存技术方案',
          async (values) => {
            await controller.submit('/api/v1/technical-solutions', {
              opportunityId: values.opportunityId ?? '',
              code: values.code ?? '',
              ...solutionPayload(values),
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      solutionHeading.append(solutionCopy, createSolution);
    } else solutionHeading.append(solutionCopy);
    solutionPanel.append(solutionHeading);
    const solutionList = el('div', 'solution-list');
    for (const solution of solutions) {
      const card = el('article', 'solution-card');
      const specification = recordValue(solution.specification);
      card.append(
        el(
          'strong',
          '',
          `${textValue(solution.code, '方案')} · R${textValue(solution.revision, '1')}`,
        ),
        el(
          'span',
          `ctr-state state-${textValue(solution.status, 'DRAFT').toLocaleLowerCase()}`,
          textValue(solution.status, 'DRAFT'),
        ),
        el('p', 'muted', `CTR 版本：${textValue(solution.ctrVersionId, '—')}`),
      );
      const specs = el('dl', 'ctr-specification');
      const previousSolution = solutions.find(
        (item) =>
          item.technicalSolutionId === solution.technicalSolutionId &&
          Number(item.revision) === Number(solution.revision) - 1,
      );
      const previousSpecification = recordValue(previousSolution?.specification);
      for (const [key, label] of [
        ['productFamily', '产品系列'],
        ['pileHeightMm', '草高（mm）'],
        ['dtex', '纤度（Dtex）'],
        ['stitchRate', '簇密度'],
        ['backing', '底布系统'],
        ['infill', '填充建议'],
        ['warrantyYears', '质保年限'],
      ] as const) {
        const currentValue = displayRequirement(specification[key]);
        const previousValue = displayRequirement(previousSpecification[key]);
        specs.append(
          el('dt', '', label),
          el(
            'dd',
            previousSolution && currentValue !== previousValue ? 'changed' : '',
            previousSolution && currentValue !== previousValue
              ? `${currentValue}（上一版：${previousValue}）`
              : currentValue,
          ),
        );
      }
      card.append(specs);
      if (permissions.has('technical-solution:update')) {
        const revise = el('button', 'secondary', '创建方案修订');
        revise.addEventListener('click', () => {
          openForm(
            workspace,
            `修订 ${textValue(solution.code, '技术方案')}`,
            '新修订将保留旧版本及其 CTR 引用。',
            solutionFields(
              specification,
              Array.isArray(solution.assumptions) ? solution.assumptions : [],
              textValue(solution.ctrVersionId, ''),
              textValue(solution.status, 'DRAFT'),
            ),
            '保存新修订',
            async (values) => {
              await controller.submit(
                `/api/v1/technical-solutions/${textValue(solution.technicalSolutionId, '')}/revisions`,
                solutionPayload(values),
              );
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        card.append(revise);
      }
      solutionList.append(card);
    }
    if (solutions.length === 0)
      solutionList.append(
        el('p', 'pipeline-empty', '暂无技术方案；先批准 CTR，再建立结构化方案。'),
      );
    solutionPanel.append(solutionList);
    workspace.append(solutionPanel);
  }
  if (controller && permissions.has('cost:read')) {
    const costPanel = el('section', 'decision-workbench cost-workbench');
    const costHeading = el('div', 'pipeline-heading');
    const costCopy = el('div');
    costCopy.append(
      el('h2', '', '成本核算'),
      el('p', '', '固定模型、技术方案和成本行输入，输出可复核的规则轨迹与输入哈希。'),
    );
    const models = controller.views.get('/api/v1/cost-models') ?? [];
    const publishedModels = models.filter((item) => item.status === 'PUBLISHED');
    const solutions = (controller.views.get('/api/v1/technical-solutions') ?? []).filter(
      (item) => item.status === 'FINAL',
    );
    if (permissions.has('cost-model:manage')) {
      const createModel = el('button', 'secondary', '新建成本模型');
      createModel.addEventListener('click', () => {
        openForm(
          workspace,
          '新建成本模型',
          '发布后该版本可用于成本核算；管理费按成本小计的比例追加。',
          [
            { name: 'code', label: '模型编号', required: true, placeholder: 'CM-2026-01' },
            { name: 'name', label: '模型名称', required: true, placeholder: '标准项目成本模型' },
            {
              name: 'currency',
              label: '币种',
              type: 'select',
              required: true,
              options: [
                { value: 'CNY', label: '人民币 CNY' },
                { value: 'USD', label: '美元 USD' },
              ],
            },
            {
              name: 'overheadPercent',
              label: '管理费率（%）',
              type: 'number',
              required: true,
              value: '3',
            },
          ],
          '发布模型',
          async (values) => {
            const multiplier = 1 + Number(values.overheadPercent ?? 0) / 100;
            await controller.submit('/api/v1/cost-models', {
              code: values.code ?? '',
              name: values.name ?? '',
              currency: values.currency ?? 'CNY',
              rules: [
                {
                  when: { op: 'literal', value: true },
                  adjustment: { kind: 'MULTIPLY', value: multiplier.toFixed(6) },
                  reason: `管理费率 ${values.overheadPercent ?? '0'}%`,
                },
              ],
              publish: true,
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      costHeading.append(costCopy, createModel);
    } else costHeading.append(costCopy);
    costPanel.append(costHeading);
    const modelCatalog = el('div', 'definition-catalog');
    const latestModelVersions = new Map<string, number>();
    for (const model of models) {
      const definitionId = textValue(model.definitionId, '');
      latestModelVersions.set(
        definitionId,
        Math.max(latestModelVersions.get(definitionId) ?? 0, Number(model.version ?? 0)),
      );
    }
    for (const model of models) {
      const modelCard = el('article', 'definition-card');
      const rules = Array.isArray(model.rules) ? model.rules : [];
      modelCard.append(
        el('strong', '', `${textValue(model.code, '模型')} · V${textValue(model.version, '1')}`),
        el(
          'span',
          `ctr-state state-${textValue(model.status, 'DRAFT').toLocaleLowerCase()}`,
          textValue(model.status, 'DRAFT'),
        ),
        el(
          'p',
          'muted',
          `${textValue(model.name, '')} · ${textValue(model.currency, 'CNY')} · ${String(rules.length)} 条规则`,
        ),
      );
      if (
        permissions.has('cost-model:manage') &&
        Number(model.version) === latestModelVersions.get(textValue(model.definitionId, ''))
      ) {
        const reviseModel = el('button', 'secondary', '新建模型版本');
        reviseModel.addEventListener('click', () => {
          openForm(
            workspace,
            `修订 ${textValue(model.code, '成本模型')}`,
            '创建新的发布版本；历史成本决策继续引用原模型版本。',
            [
              {
                name: 'overheadPercent',
                label: '管理费率（%）',
                type: 'number',
                required: true,
                value: '3',
              },
            ],
            '发布新版本',
            async (values) => {
              const multiplier = 1 + Number(values.overheadPercent ?? 0) / 100;
              await controller.submit(
                `/api/v1/cost-models/${textValue(model.definitionId, '')}/versions`,
                {
                  currency: textValue(model.currency, 'CNY'),
                  rules: [
                    {
                      when: { op: 'literal', value: true },
                      adjustment: { kind: 'MULTIPLY', value: multiplier.toFixed(6) },
                      reason: `管理费率 ${values.overheadPercent ?? '0'}%`,
                    },
                  ],
                  publish: true,
                },
              );
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        modelCard.append(reviseModel);
      }
      modelCatalog.append(modelCard);
    }
    costPanel.append(modelCatalog);
    if (permissions.has('cost:evaluate') && publishedModels.length > 0 && solutions.length > 0) {
      const evaluate = el('button', 'primary', '＋ 新建成本核算');
      evaluate.addEventListener('click', () => {
        openForm(
          workspace,
          '新建成本核算',
          '每一行都保存数量、单位、单价和币种；服务器重新计算小计及模型调整。',
          [
            {
              name: 'modelVersionId',
              label: '已发布成本模型',
              type: 'select',
              required: true,
              options: publishedModels.map((item) => ({
                value: textValue(item.id, ''),
                label: `${textValue(item.code, '模型')} · V${textValue(item.version, '1')} · ${textValue(item.currency, 'CNY')}`,
              })),
            },
            {
              name: 'technicalSolutionRevisionId',
              label: '定稿技术方案',
              type: 'select',
              required: true,
              options: solutions.map((item) => ({
                value: textValue(item.id, ''),
                label: `${textValue(item.code, '方案')} · R${textValue(item.revision, '1')}`,
              })),
            },
            { name: 'materialQuantity', label: '草坪面积（㎡）', type: 'number', required: true },
            {
              name: 'materialUnitCost',
              label: '草坪单位成本（元/㎡）',
              type: 'number',
              required: true,
            },
            {
              name: 'installationQuantity',
              label: '铺装面积（㎡）',
              type: 'number',
              required: true,
            },
            {
              name: 'installationUnitCost',
              label: '铺装单位成本（元/㎡）',
              type: 'number',
              required: true,
            },
            {
              name: 'logisticsQuantity',
              label: '物流批次',
              type: 'number',
              required: true,
              value: '1',
            },
            {
              name: 'logisticsUnitCost',
              label: '单批物流成本（元）',
              type: 'number',
              required: true,
            },
            { name: 'region', label: '项目区域', required: true, value: 'CN' },
          ],
          '执行核算',
          async (values) => {
            const model = publishedModels.find((item) => item.id === values.modelVersionId);
            const currency = textValue(model?.currency, 'CNY');
            await controller.submit('/api/v1/cost-evaluations', {
              modelVersionId: values.modelVersionId ?? '',
              technicalSolutionRevisionId: values.technicalSolutionRevisionId ?? '',
              currency,
              lines: [
                ['turf', '人造草坪材料', values.materialQuantity, 'M2', values.materialUnitCost],
                [
                  'installation',
                  '铺装施工',
                  values.installationQuantity,
                  'M2',
                  values.installationUnitCost,
                ],
                [
                  'logistics',
                  '运输与装卸',
                  values.logisticsQuantity,
                  'EA',
                  values.logisticsUnitCost,
                ],
              ].map(([key, description, quantity, unit, unitCost]) => ({
                key,
                description,
                quantity,
                unit,
                unitCost,
                currency,
              })),
              context: { region: values.region ?? 'CN' },
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      costPanel.append(evaluate);
    }
    const decisions = controller.views.get('/api/v1/cost-evaluations') ?? [];
    const decisionList = el('div', 'decision-list');
    for (const decision of decisions) {
      const card = el('article', 'decision-card');
      card.append(
        el('p', 'eyebrow', `COST · ${textValue(decision.currency, '—')}`),
        el(
          'strong',
          'decision-total',
          `${textValue(decision.currency, '')} ${textValue(decision.total, '—')}`,
        ),
        el(
          'p',
          'muted',
          `小计 ${textValue(decision.subtotal, '—')} · ${displayTime(textValue(decision.evaluatedAt, ''))}`,
        ),
        el(
          'p',
          'version-pin',
          `模型 ${textValue(decision.modelVersionId, '').slice(0, 8)} · 方案 ${textValue(decision.technicalSolutionRevisionId, '').slice(0, 8)}`,
        ),
      );
      const lines = Array.isArray(decision.lines) ? decision.lines : [];
      const lineList = el('ul', 'decision-lines');
      for (const line of lines) {
        const item = recordValue(line);
        lineList.append(
          el(
            'li',
            '',
            `${textValue(item.description, '成本项')} · ${textValue(item.quantity, '—')} ${textValue(item.unit_code, '')} × ${textValue(item.unit_cost, '—')} = ${textValue(item.total, '—')}`,
          ),
        );
      }
      const trace = Array.isArray(decision.trace) ? decision.trace : [];
      for (const entry of trace) {
        const rule = recordValue(entry);
        card.append(
          el(
            'p',
            rule.matched === true ? 'rule-hit' : 'rule-miss',
            `${rule.matched === true ? '已命中' : '未命中'} · ${textValue(rule.reason, '规则')}`,
          ),
        );
      }
      card.append(lineList, el('code', 'input-hash', textValue(decision.inputHash, '')));
      decisionList.append(card);
    }
    if (decisions.length === 0)
      decisionList.append(el('p', 'pipeline-empty', '暂无成本核算结果。'));
    costPanel.append(decisionList);
    workspace.append(costPanel);
  }
  if (controller && permissions.has('sales-policy:read')) {
    const policyPanel = el('section', 'decision-workbench policy-workbench');
    const policyHeading = el('div', 'pipeline-heading');
    const policyCopy = el('div');
    policyCopy.append(
      el('h2', '', '销售政策评估'),
      el('p', '', '用版本化利润率和折扣红线生成通过、审批要求与命中理由。'),
    );
    const policies = controller.views.get('/api/v1/sales-policies') ?? [];
    const publishedPolicies = policies.filter((item) => item.status === 'PUBLISHED');
    if (permissions.has('sales-policy:manage')) {
      const createPolicy = el('button', 'secondary', '新建销售政策');
      createPolicy.addEventListener('click', () => {
        openForm(
          workspace,
          '新建销售政策',
          '低于最低毛利率将阻止通过；超过折扣上限将要求人工审批。',
          [
            { name: 'code', label: '政策编号', required: true, placeholder: 'SP-2026-01' },
            { name: 'name', label: '政策名称', required: true, placeholder: '标准销售政策' },
            {
              name: 'minimumMargin',
              label: '最低毛利率（%）',
              type: 'number',
              required: true,
              value: '20',
            },
            {
              name: 'maximumDiscount',
              label: '最大折扣（%）',
              type: 'number',
              required: true,
              value: '10',
            },
          ],
          '发布政策',
          async (values) => {
            const minimumMargin = Math.round(Number(values.minimumMargin ?? 0) * 100);
            const maximumDiscount = Math.round(Number(values.maximumDiscount ?? 0) * 100);
            await controller.submit('/api/v1/sales-policies', {
              code: values.code ?? '',
              name: values.name ?? '',
              rules: [
                {
                  when: {
                    op: 'lt',
                    left: { op: 'input', path: 'marginBasisPoints' },
                    right: { op: 'literal', value: minimumMargin },
                  },
                  effect: {
                    passed: false,
                    approvalRequired: true,
                    minimumMarginBasisPoints: minimumMargin,
                  },
                  reason: `毛利率低于 ${values.minimumMargin ?? '0'}% 红线`,
                },
                {
                  when: {
                    op: 'gt',
                    left: { op: 'input', path: 'discountBasisPoints' },
                    right: { op: 'literal', value: maximumDiscount },
                  },
                  effect: { approvalRequired: true, maximumDiscountBasisPoints: maximumDiscount },
                  reason: `折扣超过 ${values.maximumDiscount ?? '0'}% 上限`,
                },
              ],
              publish: true,
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      policyHeading.append(policyCopy, createPolicy);
    } else policyHeading.append(policyCopy);
    policyPanel.append(policyHeading);
    const policyCatalog = el('div', 'definition-catalog');
    const latestPolicyVersions = new Map<string, number>();
    for (const policy of policies) {
      const definitionId = textValue(policy.definitionId, '');
      latestPolicyVersions.set(
        definitionId,
        Math.max(latestPolicyVersions.get(definitionId) ?? 0, Number(policy.version ?? 0)),
      );
    }
    for (const policy of policies) {
      const policyCard = el('article', 'definition-card');
      const rules = Array.isArray(policy.rules) ? policy.rules : [];
      policyCard.append(
        el('strong', '', `${textValue(policy.code, '政策')} · V${textValue(policy.version, '1')}`),
        el(
          'span',
          `ctr-state state-${textValue(policy.status, 'DRAFT').toLocaleLowerCase()}`,
          textValue(policy.status, 'DRAFT'),
        ),
        el('p', 'muted', `${textValue(policy.name, '')} · ${String(rules.length)} 条规则`),
      );
      if (
        permissions.has('sales-policy:manage') &&
        Number(policy.version) === latestPolicyVersions.get(textValue(policy.definitionId, ''))
      ) {
        const revisePolicy = el('button', 'secondary', '新建政策版本');
        revisePolicy.addEventListener('click', () => {
          openForm(
            workspace,
            `修订 ${textValue(policy.code, '销售政策')}`,
            '新版本只影响后续评估，历史政策决策保持原版本引用。',
            [
              {
                name: 'minimumMargin',
                label: '最低毛利率（%）',
                type: 'number',
                required: true,
                value: '20',
              },
              {
                name: 'maximumDiscount',
                label: '最大折扣（%）',
                type: 'number',
                required: true,
                value: '10',
              },
            ],
            '发布新版本',
            async (values) => {
              const minimumMargin = Math.round(Number(values.minimumMargin ?? 0) * 100);
              const maximumDiscount = Math.round(Number(values.maximumDiscount ?? 0) * 100);
              await controller.submit(
                `/api/v1/sales-policies/${textValue(policy.definitionId, '')}/versions`,
                {
                  rules: [
                    {
                      when: {
                        op: 'lt',
                        left: { op: 'input', path: 'marginBasisPoints' },
                        right: { op: 'literal', value: minimumMargin },
                      },
                      effect: {
                        passed: false,
                        approvalRequired: true,
                        minimumMarginBasisPoints: minimumMargin,
                      },
                      reason: `毛利率低于 ${values.minimumMargin ?? '0'}% 红线`,
                    },
                    {
                      when: {
                        op: 'gt',
                        left: { op: 'input', path: 'discountBasisPoints' },
                        right: { op: 'literal', value: maximumDiscount },
                      },
                      effect: {
                        approvalRequired: true,
                        maximumDiscountBasisPoints: maximumDiscount,
                      },
                      reason: `折扣超过 ${values.maximumDiscount ?? '0'}% 上限`,
                    },
                  ],
                  publish: true,
                },
              );
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        policyCard.append(revisePolicy);
      }
      policyCatalog.append(policyCard);
    }
    policyPanel.append(policyCatalog);
    const costs = controller.views.get('/api/v1/cost-evaluations') ?? [];
    if (
      permissions.has('sales-policy:evaluate') &&
      publishedPolicies.length > 0 &&
      costs.length > 0
    ) {
      const evaluatePolicy = el('button', 'primary', '＋ 评估报价政策');
      evaluatePolicy.addEventListener('click', () => {
        openForm(
          workspace,
          '评估销售政策',
          '利润率和折扣以百分比输入；其他项目上下文由成本决策固定。',
          [
            {
              name: 'policyVersionId',
              label: '已发布政策',
              type: 'select',
              required: true,
              options: publishedPolicies.map((item) => ({
                value: textValue(item.id, ''),
                label: `${textValue(item.code, '政策')} · V${textValue(item.version, '1')}`,
              })),
            },
            {
              name: 'costDecisionId',
              label: '成本决策',
              type: 'select',
              required: true,
              options: costs.map((item) => ({
                value: textValue(item.id, ''),
                label: `${textValue(item.currency, '')} ${textValue(item.total, '—')} · ${textValue(item.id, '').slice(0, 8)}`,
              })),
            },
            {
              name: 'margin',
              label: '拟定毛利率（%）',
              type: 'number',
              required: true,
              value: '30',
            },
            {
              name: 'discount',
              label: '拟定折扣（%）',
              type: 'number',
              required: true,
              value: '0',
            },
          ],
          '执行政策评估',
          async (values) => {
            await controller.submit('/api/v1/sales-policy-evaluations', {
              policyVersionId: values.policyVersionId ?? '',
              costDecisionId: values.costDecisionId ?? '',
              context: {
                marginBasisPoints: Math.round(Number(values.margin ?? 0) * 100),
                discountBasisPoints: Math.round(Number(values.discount ?? 0) * 100),
              },
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      policyPanel.append(evaluatePolicy);
    }
    const evaluations = controller.views.get('/api/v1/sales-policy-evaluations') ?? [];
    const evaluationList = el('div', 'decision-list');
    for (const evaluation of evaluations) {
      const card = el('article', 'decision-card');
      const passed = evaluation.passed === true;
      const approval = evaluation.approvalRequired === true;
      card.append(
        el('p', 'eyebrow', 'POLICY DECISION'),
        el(
          'strong',
          passed ? 'decision-pass' : 'decision-fail',
          passed ? '政策通过' : '政策未通过',
        ),
        el('p', 'muted', approval ? '需要人工审批' : '无需额外审批'),
        el(
          'p',
          'version-pin',
          `政策 ${textValue(evaluation.policyVersionId, '').slice(0, 8)} · 成本 ${textValue(evaluation.costDecisionId, '').slice(0, 8)}`,
        ),
      );
      const reasons = Array.isArray(evaluation.reasons) ? evaluation.reasons : [];
      for (const reason of reasons) card.append(el('p', 'rule-hit', textValue(reason, '规则命中')));
      card.append(
        el(
          'p',
          'policy-boundary',
          `最低毛利率 ${String(Number(evaluation.minimumMarginBasisPoints ?? 0) / 100)}% · 最大折扣 ${String(Number(evaluation.maximumDiscountBasisPoints ?? 0) / 100)}%`,
        ),
        el('code', 'input-hash', textValue(evaluation.inputHash, '')),
      );
      evaluationList.append(card);
    }
    if (evaluations.length === 0)
      evaluationList.append(el('p', 'pipeline-empty', '暂无销售政策评估结果。'));
    policyPanel.append(evaluationList);
    workspace.append(policyPanel);
  }
  if (controller && permissions.has('quote:read')) {
    const quotePanel = el('section', 'quote-workbench');
    const quoteHeading = el('div', 'pipeline-heading');
    const quoteCopy = el('div');
    quoteCopy.append(
      el('h2', '', 'CPQ 报价设计器'),
      el('p', '', '从成本决策生成行项目，实时计算折扣、毛利并执行销售政策。'),
    );
    const costs = controller.views.get('/api/v1/cost-evaluations') ?? [];
    const policies = (controller.views.get('/api/v1/sales-policies') ?? []).filter(
      (item) => item.status === 'PUBLISHED',
    );
    const solutions = controller.views.get('/api/v1/technical-solutions') ?? [];
    const ctrs = controller.views.get('/api/v1/ctrs') ?? [];
    if (permissions.has('quote:create') && costs.length > 0 && policies.length > 0) {
      const createQuote = el('button', 'primary', '＋ 新建报价');
      createQuote.addEventListener('click', () => {
        openForm(
          workspace,
          '新建 CPQ 报价',
          '系统先校验销售政策，再由服务器重算每一行、折扣与毛利。',
          [
            { name: 'quoteNumber', label: '报价编号', required: true, placeholder: 'Q-2026-001' },
            {
              name: 'costDecisionId',
              label: '成本决策',
              type: 'select',
              required: true,
              options: costs.map((item) => ({
                value: textValue(item.id, ''),
                label: `${textValue(item.currency, '')} ${textValue(item.total, '—')} · ${textValue(item.id, '').slice(0, 8)}`,
              })),
            },
            {
              name: 'policyVersionId',
              label: '销售政策版本',
              type: 'select',
              required: true,
              options: policies.map((item) => ({
                value: textValue(item.id, ''),
                label: `${textValue(item.code, '政策')} · V${textValue(item.version, '1')}`,
              })),
            },
            {
              name: 'turfQuantity',
              label: '草坪数量（㎡）',
              type: 'number',
              required: true,
              value: '8050',
            },
            {
              name: 'turfPrice',
              label: '草坪销售单价（元/㎡）',
              type: 'number',
              required: true,
              value: '108',
            },
            {
              name: 'installationQuantity',
              label: '铺装数量（㎡）',
              type: 'number',
              required: true,
              value: '8050',
            },
            {
              name: 'installationPrice',
              label: '铺装销售单价（元/㎡）',
              type: 'number',
              required: true,
              value: '28',
            },
            {
              name: 'serviceQuantity',
              label: '项目服务项数量',
              type: 'number',
              required: true,
              value: '1',
            },
            {
              name: 'servicePrice',
              label: '项目服务费（元）',
              type: 'number',
              required: true,
              value: '60000',
            },
            {
              name: 'discountPercent',
              label: '整单折扣（%）',
              type: 'number',
              required: true,
              value: '0',
            },
            { name: 'validUntil', label: '报价有效期至', type: 'date', required: true },
          ],
          '校验并创建报价',
          async (values) => {
            const cost = costs.find((item) => item.id === values.costDecisionId);
            if (!cost) throw new Error('请选择有效成本决策');
            const solutionId = textValue(cost.technicalSolutionRevisionId, '');
            const solution = solutions.find((item) => item.id === solutionId);
            if (!solution) throw new Error('成本决策对应的技术方案不可见');
            const ctrVersionId = textValue(solution.ctrVersionId, '');
            const ctr = ctrs.find((item) => item.id === ctrVersionId);
            if (!ctr) throw new Error('技术方案对应的 CTR 版本不可见');
            const currency = textValue(cost.currency, 'CNY');
            const lineInputs = [
              ['人造草坪系统', values.turfQuantity, 'M2', values.turfPrice],
              ['铺装施工服务', values.installationQuantity, 'M2', values.installationPrice],
              ['项目技术服务', values.serviceQuantity, 'EA', values.servicePrice],
            ] as const;
            const lines = lineInputs.map(([description, quantity, unitCode, unitPrice]) => ({
              description,
              quantity: decimalValue(Number(quantity ?? 0)),
              unitCode,
              unitPrice: decimalValue(Number(unitPrice ?? 0)),
              total: decimalValue(Number(quantity ?? 0) * Number(unitPrice ?? 0)),
            }));
            const subtotal = lines.reduce((sum, line) => sum + Number(line.total), 0);
            const discount = subtotal * (Number(values.discountPercent ?? 0) / 100);
            const total = subtotal - discount;
            const costTotal = Number(cost.total ?? 0);
            const margin = total - costTotal;
            if (total <= 0) throw new Error('折扣后报价金额必须大于零');
            const marginBasisPoints = Math.trunc((margin * 10_000) / total);
            const discountBasisPoints = Math.trunc((discount * 10_000) / subtotal);
            await controller.submit('/api/v1/sales-policy-evaluations', {
              policyVersionId: values.policyVersionId ?? '',
              costDecisionId: values.costDecisionId ?? '',
              context: { marginBasisPoints, discountBasisPoints },
            });
            const policyEvaluation = controller.revisionState;
            if (policyEvaluation?.passed !== true || typeof policyEvaluation.id !== 'string') {
              const reasons = Array.isArray(policyEvaluation?.reasons)
                ? policyEvaluation.reasons.map((item) => textValue(item, '')).filter(Boolean)
                : [];
              throw new Error(
                `销售政策未通过${reasons.length > 0 ? `：${reasons.join('；')}` : ''}`,
              );
            }
            await controller.submit('/api/v1/quotes', {
              quoteNumber: values.quoteNumber ?? '',
              opportunityId: textValue(cost.opportunityId, ''),
              ctrVersionId,
              technicalSolutionRevisionId: solutionId,
              costDecisionId: values.costDecisionId ?? '',
              policyVersionId: values.policyVersionId ?? '',
              policyEvaluationId: policyEvaluation.id,
              currency,
              subtotal: decimalValue(subtotal),
              discount: decimalValue(discount),
              total: decimalValue(total),
              costTotal: decimalValue(costTotal),
              margin: decimalValue(margin),
              marginBasisPoints,
              validUntil: new Date(`${values.validUntil ?? ''}T23:59:59.000Z`).toISOString(),
              lines,
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      quoteHeading.append(quoteCopy, createQuote);
    } else quoteHeading.append(quoteCopy);
    quotePanel.append(quoteHeading);
    const quotes = controller.views.get('/api/v1/quotes') ?? [];
    const latestQuoteVersions = new Map<string, number>();
    for (const quote of quotes) {
      const quoteId = textValue(quote.quoteId, '');
      latestQuoteVersions.set(
        quoteId,
        Math.max(latestQuoteVersions.get(quoteId) ?? 0, Number(quote.revision ?? 0)),
      );
    }
    const quoteList = el('div', 'quote-list');
    for (const quote of quotes) {
      const card = el('article', 'quote-card');
      const quoteStatus = textValue(quote.status, 'DRAFT');
      card.append(
        el(
          'p',
          'eyebrow',
          `${textValue(quote.quoteNumber, '报价')} · R${textValue(quote.revision, '1')}`,
        ),
        el(
          'strong',
          'quote-total',
          `${textValue(quote.currency, '')} ${textValue(quote.total, '—')}`,
        ),
        el('span', `ctr-state state-${quoteStatus.toLocaleLowerCase()}`, quoteStatus),
        el(
          'p',
          'quote-economics',
          `折扣 ${textValue(quote.discount, '0')} · 成本 ${textValue(quote.costTotal, '—')} · 毛利 ${textValue(quote.margin, '—')}（${String(Number(quote.marginBasisPoints ?? 0) / 100)}%）`,
        ),
        el(
          'p',
          'version-pin',
          `CTR ${textValue(quote.ctrVersionId, '').slice(0, 8)} · 方案 ${textValue(quote.technicalSolutionRevisionId, '').slice(0, 8)} · 成本 ${textValue(quote.costDecisionId, '').slice(0, 8)} · 政策 ${textValue(quote.policyVersionId, '').slice(0, 8)}`,
        ),
      );
      const lines = Array.isArray(quote.lines) ? quote.lines : [];
      const lineTable = el('div', 'quote-lines');
      for (const line of lines) {
        const item = recordValue(line);
        lineTable.append(
          el('span', '', textValue(item.description, '报价行')),
          el('span', '', `${textValue(item.quantity, '—')} ${textValue(item.unit_code, '')}`),
          el('span', '', `${textValue(item.unit_price, '—')} / ${textValue(item.total, '—')}`),
        );
      }
      card.append(lineTable);
      const actions = el('div', 'quote-actions');
      if (
        permissions.has('quote:update') &&
        ['ISSUED', 'REJECTED'].includes(quoteStatus) &&
        Number(quote.revision) === latestQuoteVersions.get(textValue(quote.quoteId, ''))
      ) {
        const revise = el('button', 'secondary', '创建报价修订');
        revise.addEventListener('click', () => {
          openForm(
            workspace,
            `修订 ${textValue(quote.quoteNumber, '报价')}`,
            '基于当前签发版本调整整单折扣与有效期；原签发快照保持只读。',
            [
              {
                name: 'discountPercent',
                label: '新整单折扣（%）',
                type: 'number',
                required: true,
                value: String((Number(quote.discount ?? 0) * 100) / Number(quote.subtotal ?? 1)),
              },
              { name: 'validUntil', label: '新有效期至', type: 'date', required: true },
            ],
            '校验并创建修订',
            async (values) => {
              const quoteLines = (Array.isArray(quote.lines) ? quote.lines : []).map((line) => {
                const item = recordValue(line);
                return {
                  description: textValue(item.description, '报价行'),
                  quantity: textValue(item.quantity, '0'),
                  unitCode: textValue(item.unit_code, ''),
                  unitPrice: textValue(item.unit_price, '0'),
                  total: textValue(item.total, '0'),
                };
              });
              const subtotal = quoteLines.reduce((sum, line) => sum + Number(line.total), 0);
              const discount = subtotal * (Number(values.discountPercent ?? 0) / 100);
              const total = subtotal - discount;
              const costTotal = Number(quote.costTotal ?? 0);
              const margin = total - costTotal;
              if (total <= 0) throw new Error('折扣后报价金额必须大于零');
              const marginBasisPoints = Math.trunc((margin * 10_000) / total);
              const discountBasisPoints = Math.trunc((discount * 10_000) / subtotal);
              await controller.submit('/api/v1/sales-policy-evaluations', {
                policyVersionId: textValue(quote.policyVersionId, ''),
                costDecisionId: textValue(quote.costDecisionId, ''),
                context: { marginBasisPoints, discountBasisPoints },
              });
              const policyEvaluation = controller.revisionState;
              if (policyEvaluation?.passed !== true || typeof policyEvaluation.id !== 'string')
                throw new Error('修订后的报价未通过销售政策');
              await controller.submit(`/api/v1/quotes/${textValue(quote.quoteId, '')}/revisions`, {
                quoteNumber: textValue(quote.quoteNumber, ''),
                opportunityId: textValue(quote.opportunityId, ''),
                ctrVersionId: textValue(quote.ctrVersionId, ''),
                technicalSolutionRevisionId: textValue(quote.technicalSolutionRevisionId, ''),
                costDecisionId: textValue(quote.costDecisionId, ''),
                policyVersionId: textValue(quote.policyVersionId, ''),
                policyEvaluationId: policyEvaluation.id,
                currency: textValue(quote.currency, 'CNY'),
                subtotal: decimalValue(subtotal),
                discount: decimalValue(discount),
                total: decimalValue(total),
                costTotal: decimalValue(costTotal),
                margin: decimalValue(margin),
                marginBasisPoints,
                validUntil: new Date(`${values.validUntil ?? ''}T23:59:59.000Z`).toISOString(),
                lines: quoteLines,
              });
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        actions.append(revise);
      }
      if (quoteStatus === 'DRAFT' && permissions.has('quote:approve')) {
        const approve = el('button', 'primary', '批准报价');
        approve.addEventListener('click', () => {
          openForm(
            workspace,
            '批准报价',
            '审批决定和理由将进入不可变证据链。',
            [{ name: 'reason', label: '审批意见', type: 'textarea', required: true }],
            '确认批准',
            async (values) => {
              await controller.quoteCommand(textValue(quote.id, ''), 'approve', {
                decision: 'APPROVED',
                reason: values.reason ?? '',
              });
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        actions.append(approve);
      }
      if (quoteStatus === 'APPROVED' && permissions.has('quote:issue')) {
        const issue = el('button', 'primary', '签发报价');
        issue.addEventListener('click', () => {
          void controller.quoteCommand(textValue(quote.id, ''), 'issue').then(async () => {
            await controller.load();
            status.textContent = controller.message;
          });
        });
        actions.append(issue);
      }
      if (quoteStatus === 'ISSUED') {
        const print = el('button', 'secondary', '打印 / 保存 PDF');
        print.addEventListener('click', () => {
          printIssuedQuote(quote);
        });
        actions.append(print);
      }
      card.append(actions);
      quoteList.append(card);
    }
    if (quotes.length === 0) quoteList.append(el('p', 'pipeline-empty', '暂无报价。'));
    quotePanel.append(quoteList);
    workspace.append(quotePanel);
  }
  if (controller && permissions.has('credit:read')) {
    const creditPanel = el('section', 'qtc-workbench credit-workbench');
    const heading = el('div', 'pipeline-heading');
    const copy = el('div');
    copy.append(
      el('h2', '', '信用审查'),
      el('p', '', '按客户额度、应收、未开票订单和未分配收款计算真实信用敞口。'),
    );
    if (permissions.has('credit:approve')) {
      const setLimit = el('button', 'secondary', '设置客户额度');
      setLimit.addEventListener('click', () => {
        openForm(
          workspace,
          '设置客户信用额度',
          '额度按客户、币种和有效期形成不可变版本记录。',
          [
            {
              name: 'customerId',
              label: '客户',
              type: 'select',
              required: true,
              options: controller.customers.map((item) => ({
                value: item.id,
                label: item.name ?? item.id,
              })),
            },
            { name: 'amount', label: '信用额度', type: 'number', required: true },
            {
              name: 'currency',
              label: '币种',
              type: 'select',
              required: true,
              options: [
                { value: 'CNY', label: '人民币 CNY' },
                { value: 'USD', label: '美元 USD' },
              ],
            },
            { name: 'effectiveAt', label: '生效日期', type: 'date', required: true },
            { name: 'expiresAt', label: '失效日期', type: 'date', required: true },
          ],
          '保存额度',
          async (values) => {
            await controller.submit('/api/v1/credit-limits', {
              customerId: values.customerId ?? '',
              currency: values.currency ?? 'CNY',
              amount: values.amount ?? '',
              effectiveAt: new Date(`${values.effectiveAt ?? ''}T00:00:00.000Z`).toISOString(),
              expiresAt: new Date(`${values.expiresAt ?? ''}T23:59:59.000Z`).toISOString(),
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      heading.append(copy, setLimit);
    } else heading.append(copy);
    creditPanel.append(heading);
    const limits = controller.views.get('/api/v1/credit-limits') ?? [];
    const issuedQuotes = (controller.views.get('/api/v1/quotes') ?? []).filter(
      (item) => item.status === 'ISSUED' && typeof item.issuedSnapshotId === 'string',
    );
    if (permissions.has('credit:evaluate') && limits.length > 0 && issuedQuotes.length > 0) {
      const evaluateCredit = el('button', 'primary', '＋ 发起信用评估');
      evaluateCredit.addEventListener('click', () => {
        openForm(
          workspace,
          '发起信用评估',
          '服务器会锁定客户信用台账并重新计算敞口，不能由前端覆盖。',
          [
            {
              name: 'quoteRevisionId',
              label: '已签发报价',
              type: 'select',
              required: true,
              options: issuedQuotes.map((item) => ({
                value: textValue(item.id, ''),
                label: `${textValue(item.quoteNumber, '报价')} · R${textValue(item.revision, '1')} · ${textValue(item.currency, '')} ${textValue(item.total, '—')}`,
              })),
            },
            {
              name: 'creditLimitId',
              label: '信用额度版本',
              type: 'select',
              required: true,
              options: limits.map((item) => ({
                value: textValue(item.id, ''),
                label: `${recordText(item, 'currency', 'currency', 'CNY')} ${recordText(item, 'amount', 'amount', '—')} · ${recordText(item, 'expiresAt', 'expires_at', '').slice(0, 10)}`,
              })),
            },
            { name: 'validUntil', label: '信用决定有效期至', type: 'date', required: true },
          ],
          '执行信用评估',
          async (values) => {
            const quote = issuedQuotes.find((item) => item.id === values.quoteRevisionId);
            const opportunity = controller.opportunities.find(
              (item) => item.id === quote?.opportunityId,
            );
            if (!quote || typeof opportunity?.customerId !== 'string')
              throw new Error('报价未关联有效客户');
            await controller.submit('/api/v1/credit-decisions', {
              customerId: opportunity.customerId,
              quoteRevisionId: textValue(quote.id, ''),
              quoteSnapshotId: textValue(quote.issuedSnapshotId, ''),
              creditLimitId: values.creditLimitId ?? '',
              validUntil: new Date(`${values.validUntil ?? ''}T23:59:59.000Z`).toISOString(),
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      creditPanel.append(evaluateCredit);
    }
    const decisions = controller.views.get('/api/v1/credit-decisions') ?? [];
    const list = el('div', 'qtc-list');
    for (const decision of decisions) {
      const state = recordText(decision, 'effectiveStatus', 'effective_status', 'PENDING_APPROVAL');
      const card = el('article', 'qtc-card');
      card.append(
        el('p', 'eyebrow', 'CREDIT DECISION'),
        el(
          'strong',
          '',
          state === 'APPROVED'
            ? '信用已批准'
            : state === 'REJECTED'
              ? '信用已拒绝'
              : state === 'EXPIRED'
                ? '信用已过期'
                : '等待信用审批',
        ),
        el('span', `ctr-state state-${state.toLocaleLowerCase()}`, state),
        el(
          'p',
          'qtc-metrics',
          `申请 ${recordText(decision, 'requestedAmount', 'requested_amount', '—')} ${recordText(decision, 'currency', 'currency')} · 敞口 ${recordText(decision, 'exposureAmount', 'exposure_amount', '—')} · 额度 ${recordText(decision, 'creditLimit', 'limit_amount', '—')}`,
        ),
        el(
          'p',
          'version-pin',
          `报价 ${recordText(decision, 'quoteRevisionId', 'quote_revision_id').slice(0, 8)} · 敞口快照 ${recordText(decision, 'exposureSnapshotId', 'exposure_snapshot_id').slice(0, 8)}`,
        ),
      );
      if (state === 'PENDING_APPROVAL' && permissions.has('credit:approve')) {
        const actions = el('div', 'qtc-actions');
        for (const [result, label] of [
          ['APPROVED', '批准信用'],
          ['REJECTED', '拒绝信用'],
        ] as const) {
          const button = el('button', result === 'APPROVED' ? 'primary' : 'secondary', label);
          button.addEventListener('click', () => {
            openForm(
              workspace,
              label,
              '审批决定将永久保留并影响订单释放资格。',
              [{ name: 'reason', label: '审批理由', type: 'textarea', required: true }],
              '确认决定',
              async (values) => {
                await controller.submit(
                  `/api/v1/credit-decisions/${textValue(decision.id, '')}/approve`,
                  { decision: result, reason: values.reason ?? '' },
                );
                await controller.load();
                status.textContent = controller.message;
              },
            );
          });
          actions.append(button);
        }
        card.append(actions);
      }
      list.append(card);
    }
    if (decisions.length === 0) list.append(el('p', 'pipeline-empty', '暂无信用决定。'));
    creditPanel.append(list);
    workspace.append(creditPanel);
  }
  if (controller && permissions.has('contract:read')) {
    const contractPanel = el('section', 'qtc-workbench contract-workbench');
    const heading = el('div', 'pipeline-heading');
    const copy = el('div');
    copy.append(
      el('h2', '', '合同与签署'),
      el('p', '', '合同修订固定引用已签发报价快照，签署回执与载荷哈希只读保存。'),
    );
    const issuedQuotes = (controller.views.get('/api/v1/quotes') ?? []).filter(
      (item) => item.status === 'ISSUED' && typeof item.issuedSnapshotId === 'string',
    );
    if (permissions.has('contract:revise') && issuedQuotes.length > 0) {
      const createContract = el('button', 'primary', '＋ 新建合同');
      createContract.addEventListener('click', () => {
        openForm(
          workspace,
          '新建合同修订',
          '合同正文使用结构化商务条款生成，并固定到所选报价快照。',
          [
            {
              name: 'quoteRevisionId',
              label: '已签发报价',
              type: 'select',
              required: true,
              options: issuedQuotes.map((item) => ({
                value: textValue(item.id, ''),
                label: `${textValue(item.quoteNumber, '报价')} · R${textValue(item.revision, '1')}`,
              })),
            },
            { name: 'contractNumber', label: '合同编号', required: true },
            { name: 'paymentTerms', label: '付款条款', type: 'textarea', required: true },
            { name: 'deliveryTerms', label: '交付条款', type: 'textarea', required: true },
            { name: 'warranty', label: '质保条款', type: 'textarea', required: true },
            { name: 'acceptance', label: '验收标准', type: 'textarea', required: true },
          ],
          '创建合同修订',
          async (values) => {
            const quote = issuedQuotes.find((item) => item.id === values.quoteRevisionId);
            const opportunity = controller.opportunities.find(
              (item) => item.id === quote?.opportunityId,
            );
            if (!quote || typeof opportunity?.customerId !== 'string')
              throw new Error('报价未关联有效客户');
            await controller.submit('/api/v1/contracts', {
              customerId: opportunity.customerId,
              opportunityId: textValue(quote.opportunityId, ''),
              contractNumber: values.contractNumber ?? '',
              quoteRevisionId: textValue(quote.id, ''),
              quoteSnapshotId: textValue(quote.issuedSnapshotId, ''),
              content: {
                paymentTerms: values.paymentTerms ?? '',
                deliveryTerms: values.deliveryTerms ?? '',
                warranty: values.warranty ?? '',
                acceptance: values.acceptance ?? '',
              },
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      heading.append(copy, createContract);
    } else heading.append(copy);
    contractPanel.append(heading);
    const contracts = controller.views.get('/api/v1/contracts') ?? [];
    const list = el('div', 'qtc-list');
    for (const contract of contracts) {
      const state = recordText(contract, 'effectiveStatus', 'effectiveStatus', 'DRAFT');
      const content = recordValue(contract.content);
      const card = el('article', 'qtc-card');
      card.append(
        el(
          'p',
          'eyebrow',
          `${recordText(contract, 'contractNumber', 'contractNumber', '合同')} · R${recordText(contract, 'revision', 'revision', '1')}`,
        ),
        el('strong', '', state === 'SIGNED' ? '合同已签署' : '合同待签署'),
        el('span', `ctr-state state-${state.toLocaleLowerCase()}`, state),
        el('p', 'muted', `付款：${textValue(content.paymentTerms, '—')}`),
        el('p', 'muted', `交付：${textValue(content.deliveryTerms, '—')}`),
        el('code', 'input-hash', recordText(contract, 'contentHash', 'content_hash')),
      );
      if (state === 'DRAFT' && permissions.has('contract:sign')) {
        const sign = el('button', 'primary', '记录签署回执');
        sign.addEventListener('click', () => {
          openForm(
            workspace,
            '记录合同签署',
            '签署平台回执、签署时间和载荷哈希将作为不可变证据保存。',
            [
              { name: 'provider', label: '签署平台', required: true, value: '线下盖章' },
              { name: 'providerReceiptId', label: '回执编号', required: true },
              { name: 'signedAt', label: '签署日期', type: 'date', required: true },
              { name: 'signer', label: '签署人 / 经办人', required: true },
            ],
            '确认签署',
            async (values) => {
              await controller.submit(`/api/v1/contracts/${textValue(contract.id, '')}/sign`, {
                provider: values.provider ?? '',
                providerReceiptId: values.providerReceiptId ?? '',
                payload: { signer: values.signer ?? '', acknowledged: true },
                signedAt: new Date(`${values.signedAt ?? ''}T12:00:00.000Z`).toISOString(),
              });
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        card.append(sign);
      }
      list.append(card);
    }
    if (contracts.length === 0) list.append(el('p', 'pipeline-empty', '暂无合同修订。'));
    contractPanel.append(list);
    workspace.append(contractPanel);
  }
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
    if (
      controller &&
      [
        '/api/v1/opportunities',
        '/api/v1/ctrs',
        '/api/v1/technical-solutions',
        '/api/v1/cost-evaluations',
        '/api/v1/sales-policy-evaluations',
        '/api/v1/quotes',
        '/api/v1/credit-decisions',
        '/api/v1/contracts',
      ].includes(path)
    )
      continue;
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
      items: readonly Opportunity[];
    }>('/api/v1/opportunities', token);
    return response.items;
  },
  async list(path) {
    return (await json<{ items: readonly Record<string, unknown>[] }>(path, token)).items;
  },
  submit: (path, payload, method = 'POST') =>
    json<Record<string, unknown>>(path, token, {
      method,
      ...(method === 'POST' ? { headers: { 'idempotency-key': requestId() } } : {}),
      body: JSON.stringify(payload),
    }),
  async uploadCtrAttachment(versionId, file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const hex = [...digest].map((value) => value.toString(16).padStart(2, '0')).join('');
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const metadata = await json<Record<string, unknown>>('/api/v1/attachments', token, {
      method: 'POST',
      body: JSON.stringify({
        name: file.name,
        mimeType: file.type === '' ? 'application/octet-stream' : file.type,
        size: file.size,
        checksum: hex,
      }),
    });
    if (typeof metadata.id !== 'string') throw new Error('附件元数据响应无效');
    const uploaded = await json<Record<string, unknown>>(
      `/api/v1/attachments/${metadata.id}/content`,
      token,
      { method: 'PUT', body: JSON.stringify({ contentBase64: btoa(binary) }) },
    );
    await json(`/api/v1/ctr-versions/${versionId}/attachments`, token, {
      method: 'POST',
      body: JSON.stringify({ attachmentId: metadata.id }),
    });
    return uploaded;
  },
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
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: { message?: string };
    };
    throw new Error(
      body.error?.message ?? body.message ?? `Request failed (${String(response.status)})`,
    );
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
  type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'select' | 'textarea';
  required?: boolean;
  placeholder?: string;
  value?: string;
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
      control.type = ['email', 'tel', 'number', 'date'].includes(field.type ?? '')
        ? (field.type as 'email' | 'tel' | 'number' | 'date')
        : 'text';
    if (control instanceof HTMLSelectElement)
      for (const option of field.options ?? []) {
        const item = el('option', '', option.label);
        item.value = option.value;
        control.append(item);
      }
    if (field.value !== undefined && 'value' in control) control.value = field.value;
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
function openFileForm(
  host: HTMLElement,
  title: string,
  onSubmit: (file: File) => Promise<void>,
): void {
  const dialog = el('dialog', 'form-dialog');
  const form = el('form', 'entity-form');
  const heading = el('div', 'dialog-heading');
  heading.append(
    el('p', 'eyebrow', 'CTR EVIDENCE'),
    el('h2', '', title),
    el('p', 'muted', '附件最大 25 MiB；提交 CTR 后附件集合将被冻结。'),
  );
  const label = el('label', 'form-field file-field');
  label.append(el('span', '', '选择技术资料或客户需求文件'));
  const input = el('input');
  input.type = 'file';
  input.required = true;
  input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt';
  label.append(input);
  const error = el('p', 'form-error');
  error.setAttribute('role', 'alert');
  const actions = el('div', 'dialog-actions');
  const cancel = el('button', 'secondary', '取消');
  cancel.type = 'button';
  cancel.addEventListener('click', () => {
    dialog.close();
  });
  const submit = el('button', 'primary', '上传并关联');
  submit.type = 'submit';
  actions.append(cancel, submit);
  form.append(heading, label, error, actions);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 26_214_400) {
      error.textContent = '文件超过 25 MiB 限制';
      return;
    }
    submit.disabled = true;
    submit.textContent = '上传中…';
    void onSubmit(file)
      .then(() => {
        dialog.close();
      })
      .catch((failure: unknown) => {
        error.textContent = failure instanceof Error ? failure.message : '附件上传失败';
      })
      .finally(() => {
        submit.disabled = false;
        submit.textContent = '上传并关联';
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
        item.startsWith('attachment:') ||
        item.startsWith('technical-solution:') ||
        item.startsWith('cost-model:') ||
        item.startsWith('cost:') ||
        item.startsWith('sales-policy:') ||
        item.startsWith('quote:') ||
        item.startsWith('credit:') ||
        item.startsWith('contract:') ||
        item.startsWith('sales-order:') ||
        item.startsWith('ar:') ||
        item.startsWith('bank-payment:') ||
        item.startsWith('reconciliation:') ||
        item.startsWith('allocation:'),
    ) as CommercialPermission[],
  );
  if (Object.values(visibleCommercialSections(commercialPermissions)).some(Boolean)) {
    const commercialController = new CommercialController(
      createFetchCommercialApi(token),
      commercialPermissions,
    );
    commercialController.customers = controller.customers;
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
