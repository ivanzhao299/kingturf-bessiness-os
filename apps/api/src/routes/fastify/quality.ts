import { DomainError } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { integer, permittedDto, uuid } from '../../app-values.ts';
import { guardRejection } from '../../pg-rejections.ts';
import { authorizeQuery } from '../../policy.ts';
import type { QualityView } from '../../quality-read-repositories.ts';
import { qualityAttempts } from '../dispatch/quality.ts';
import { legacyRequest, runLegacyAttempts } from './legacy-attempts.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';

const views = {
  plans: {
    path: '/api/v1/quality-plans',
    capability: 'quality-plan:read',
    stateField: 'status',
    searchFields: ['code', 'name', 'sku', 'itemName'],
    states: ['DRAFT', 'PUBLISHED'],
  },
  inspections: {
    path: '/api/v1/quality-inspections',
    capability: 'quality:read',
    stateField: 'state',
    searchFields: ['inspection_number', 'planCode', 'lotNumber', 'sku'],
    states: ['OPEN', 'SAMPLED', 'COMPLETED', 'DISPOSITIONED', 'CANCELLED'],
  },
  lots: {
    path: '/api/v1/lot-traceability',
    capability: 'traceability:read',
    stateField: 'qualityStatus',
    searchFields: ['lotNumber', 'sku', 'itemName'],
    states: ['QUARANTINE', 'RELEASED', 'REJECTED'],
  },
} as const satisfies Record<
  QualityView,
  {
    capability: PermissionKey;
    path: string;
    stateField: string;
    searchFields: readonly string[];
    states: readonly string[];
  }
>;

const qualityGuardHints = {
  'quality plan publication requires characteristics': '发布前请先设置检验项目。',
  'inspection event sequence must be contiguous': '检验单已更新，请刷新后重试。',
  'open inspection can only sample or cancel': '待抽样检验单仅可开始抽样或取消。',
  'sampled inspection can only complete or cancel': '检验中的检验单仅可完成检验或取消。',
  'completed inspection requires disposition': '检验已完成，请办理质量处置。',
  'closed inspection is immutable': '检验单已结束，请刷新查看最新状态。',
  'inspection completion requires all mandatory results': '请登记全部必检项目的结果后再完成检验。',
  'inspection result requires sampled inspection and pinned characteristic':
    '请在检验中登记本计划版本的检验项目。',
  'inspection result value does not match characteristic type':
    '测量值须符合检验项目规定的数据类型。',
  'numeric inspection pass result must match specification limits':
    '合格判定须与测量值和规格上下限一致。',
  'lot quality event sequence must be contiguous': '批次质量状态已更新，请刷新后重试。',
  'dispositioned lot quality is immutable': '该批次已完成质量处置。',
  'lot disposition requires its completed inspection': '请先完成该批次的检验。',
  'failed inspection cannot release lot': '检验不合格的批次无法放行。',
};

function qualityRepository(scope: FastifyRouteScope) {
  const repo = scope.dependencies.quality;
  if (!repo) throw Object.assign(new Error('Quality dependency unavailable'), { statusCode: 503 });
  return repo;
}

function readContext(scope: FastifyRouteScope, capability: PermissionKey) {
  const { authorization } = scope;
  const grant = authorizeQuery(authorization, capability);
  return { actor: authorization.actor, scopes: grant.scopes, anchors: grant.anchors };
}

function registerQualityReads(
  app: FastifyRouteGroupApp,
  scope: FastifyRouteScope,
  view: QualityView,
) {
  const { capability, path, states, stateField, searchFields } = views[view];
  const fields = scope.authorization.permissions.get(capability)?.fields ?? null;
  const canRead = (field: string) => fields === null || fields.includes(field);
  app.get(path, async (request) => {
    const { state, query, cursor, limit, summary } = request.query as Readonly<
      Record<string, string | undefined>
    >;
    const repo = qualityRepository(scope);
    if (!(state || query || cursor || limit || summary))
      return (await runLegacyAttempts(scope, legacyRequest(request), qualityAttempts)).body;
    const context = readContext(scope, capability);
    if (state && !(states as readonly string[]).includes(state))
      throw new DomainError('invalid_request', 'state is unsupported');
    if ((state && !canRead(stateField)) || (query && !searchFields.every(canRead)))
      throw new DomainError('forbidden', 'Field permission denied');
    if (query && query.length > 100)
      throw new DomainError('invalid_request', 'query exceeds 100 characters');
    if (summary && (summary !== 'true' || view === 'plans'))
      throw new DomainError('invalid_request', 'summary is unsupported');
    const filter = {
      limit: limit ? integer(Number(limit), 'limit', 1, 100) : 50,
      ...(state ? { state } : {}),
      ...(query?.trim() ? { query: query.trim() } : {}),
      ...(cursor ? { cursor: uuid(cursor, 'cursor') } : {}),
    };
    const [page, counts] = await Promise.all([
      repo.listQualityPage(view, filter, context),
      summary && view !== 'plans' && canRead(stateField) ? repo.qualityCounts(view, context) : null,
    ]);
    return {
      items: page.items.map((item) => permittedDto(item, fields)),
      nextCursor: page.nextCursor,
      ...(counts ? { summary: counts } : {}),
    };
  });
  app.get(`${path}/:id`, async (request) => {
    const context = readContext(scope, capability);
    const id = uuid((request.params as { id: string }).id, 'id');
    const item = await qualityRepository(scope).findQualityRow(view, id, context);
    if (!item) throw new DomainError('not_found', 'Quality record not found');
    return permittedDto(item, fields);
  });
}

export function registerQualityRoutes(app: FastifyRouteGroupApp, scope: FastifyRouteScope) {
  for (const view of ['plans', 'inspections', 'lots'] as const)
    registerQualityReads(app, scope, view);
  for (const path of [
    views.plans.path,
    `${views.plans.path}/:id/publish`,
    views.inspections.path,
    ...['sample', 'complete', 'cancel', 'results', 'release', 'reject'].map(
      (action) => `${views.inspections.path}/:id/${action}`,
    ),
  ]) {
    app.post(path, async (request, reply) => {
      qualityRepository(scope);
      try {
        const result = await runLegacyAttempts(scope, legacyRequest(request), qualityAttempts);
        void reply.code(result.statusCode);
        return result.body;
      } catch (error: unknown) {
        const hint = guardRejection(error, qualityGuardHints);
        if (hint) throw new DomainError('conflict', hint);
        throw error;
      }
    });
  }
}
