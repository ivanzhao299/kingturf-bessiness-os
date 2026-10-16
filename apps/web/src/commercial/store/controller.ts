import type { Customer, Employee } from '../../crm/types';
import type { CommercialPermission } from '../permissions';
import type { CommercialApi, Opportunity, CostMatrixQuery, CostMatrixPage } from '../types';
import { initialCostMatrixQuery } from './cost-query';
import { readableCommercialSources } from './readable-sources';
import { startCommercialOpportunityLoad } from './load-opportunities';
import { startCommercialViewLoad } from './load-views';
import {
  beginCommercialRead,
  endCommercialRead,
  beginCommercialCostRead,
  noteCommercialSourceRead,
} from './read-owner';
import { commercialDashboardQuery } from './dashboard-query';
export class CommercialController {
  public opportunities: readonly Opportunity[] = [];
  public customers: readonly Customer[] = [];
  public employees: readonly Employee[] = [];
  public loading = false;
  public message = '';
  public revisionState: Record<string, unknown> | null = null;
  public preferredQuoteCostDecisionId = '';
  public selectedCostMatrixId = '';
  public costMatrixQuery = initialCostMatrixQuery();
  public costMatrixTotal = 0;
  public readonly costMatrixDetails = new Map<string, Record<string, unknown>>();
  public readonly views = new Map<string, readonly Record<string, unknown>[]>();
  public readonly order360 = new Map<string, Record<string, unknown>>();
  public dashboard: Record<string, unknown> | null = null;
  public constructor(
    public readonly api: CommercialApi,
    public readonly permissions: ReadonlySet<CommercialPermission> = new Set(),
  ) {}
  public async load(): Promise<void> {
    const finish = beginCommercialRead(this);
    try {
      const failures: string[] = [];
      const readable = readableCommercialSources(this);
      const readableViews = readable.filter(([permission]) => this.permissions.has(permission));
      const opportunityTask = startCommercialOpportunityLoad(this, failures);
      const viewTask = startCommercialViewLoad(this, readableViews, failures);
      await Promise.all([opportunityTask, viewTask]);
      if (this.api.get && this.permissions.has('executive-dashboard:read')) {
        const query = commercialDashboardQuery();
        try {
          this.dashboard = await this.api.get(`/api/v1/executive-dashboard?${query.toString()}`);
          noteCommercialSourceRead(this, '/api/v1/executive-dashboard');
        } catch {
          failures.push('经营看板');
        }
      }
      this.message =
        failures.length === 0
          ? `已加载 ${String(this.opportunities.length)} 个商机`
          : `核心工作台已加载；${String(failures.length)} 个数据源暂不可用`;
    } finally {
      endCommercialRead(this, finish);
    }
  }
  public async refreshViews(paths: readonly string[]): Promise<void> {
    const finish = beginCommercialRead(this, false);
    try {
      const results = await Promise.allSettled(
        paths.map(async (path) => {
          if (path !== '/api/v1/cost-matrices') return [path, await this.api.list(path)] as const;
          await this.loadCostMatrixPage();
          return [path, this.views.get(path) ?? []] as const;
        }),
      );
      const failed: string[] = [];
      results.forEach((result, index) => {
        const path = paths[index];
        if (!path) return;
        if (result.status === 'fulfilled') {
          if (result.value[0] !== '/api/v1/cost-matrices') {
            this.views.set(result.value[0], result.value[1]);
            noteCommercialSourceRead(this, result.value[0]);
          }
        } else failed.push(path);
      });
      if (failed.length > 0)
        throw new Error(`数据已保存，但刷新失败：${failed.join('、')}，请重新进入本页面`);
    } finally {
      endCommercialRead(this, finish);
    }
  }
  private async fetchCostMatrixPage(query: CostMatrixQuery): Promise<CostMatrixPage> {
    if (this.api.listCostMatrixSummaries) {
      return this.api.listCostMatrixSummaries(query);
    }
    const items = await this.api.list('/api/v1/cost-matrices');
    return { items, total: items.length, page: 1, pageSize: Math.max(items.length, 1) };
  }
  private costMatrixRequest = 0;
  private pendingCostMatrixQuery: CostMatrixQuery | undefined;
  public async loadCostMatrixPage(
    update: Partial<CostMatrixQuery> = {},
    acceptsWave?: () => boolean,
  ): Promise<boolean> {
    const finish = beginCommercialCostRead(this, acceptsWave === undefined);
    try {
      const request = ++this.costMatrixRequest;
      const query = { ...(this.pendingCostMatrixQuery ?? this.costMatrixQuery), ...update };
      this.pendingCostMatrixQuery = query;
      this.loading = true;
      try {
        const page = await this.fetchCostMatrixPage(query);
        if (request !== this.costMatrixRequest || acceptsWave?.() === false) return false;
        this.costMatrixQuery = query;
        this.costMatrixTotal = page.total;
        this.views.set('/api/v1/cost-matrices', page.items);
        noteCommercialSourceRead(this, '/api/v1/cost-matrices');
        return true;
      } catch (failure) {
        if (request !== this.costMatrixRequest || acceptsWave?.() === false) return false;
        throw failure;
      } finally {
        if (request === this.costMatrixRequest) {
          this.pendingCostMatrixQuery = undefined;
          this.loading = false;
        }
      }
    } finally {
      finish();
    }
  }
  private readonly order360Requests = new Map<string, Promise<Record<string, unknown>>>();
  public async loadOrder360(orderId: string): Promise<Record<string, unknown>> {
    if (
      !this.api.get ||
      !this.permissions.has('order-360:read') ||
      !this.permissions.has('sales-order:read')
    )
      throw new Error('当前用户无权查看订单全景');
    const pending = this.order360Requests.get(orderId);
    if (pending) return pending;
    const request = this.api.get(`/api/v1/sales-orders/${encodeURIComponent(orderId)}/360`);
    this.order360Requests.set(orderId, request);
    try {
      const aggregate = await request;
      this.order360.set(orderId, aggregate);
      return aggregate;
    } finally {
      this.order360Requests.delete(orderId);
    }
  }
  public async openCostMatrix(modelId: string): Promise<void> {
    this.selectedCostMatrixId = modelId;
    const summary = (this.views.get('/api/v1/cost-matrices') ?? []).find(
      (candidate) => candidate.id === modelId,
    );
    if (summary && Array.isArray(summary.factors)) {
      this.costMatrixDetails.set(modelId, summary);
      return;
    }
    if (!this.api.get) throw new Error('当前连接不支持成本模型详情查询');
    this.loading = true;
    try {
      this.costMatrixDetails.set(
        modelId,
        await this.api.get(`/api/v1/cost-matrices/${encodeURIComponent(modelId)}`),
      );
    } finally {
      this.loading = false;
    }
  }
  public closeCostMatrix(): void {
    this.selectedCostMatrixId = '';
  }
  public async refreshSelectedCostMatrix(): Promise<void> {
    const modelId = this.selectedCostMatrixId;
    if (!modelId || !this.api.get) return;
    this.costMatrixDetails.set(
      modelId,
      await this.api.get(`/api/v1/cost-matrices/${encodeURIComponent(modelId)}`),
    );
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
      this.message = `附件 ${file.name} 已上传并关联到技术需求草稿`;
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
