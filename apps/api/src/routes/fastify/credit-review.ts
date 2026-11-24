// U3-COM-7（ADR-0015）：credit-review 域 Fastify 端点组（credit 审查全链）。
// GET 双列表 = qtc 视图轨迁移（list('limits')/list('credit') + strict { items }）；
// GET 决定详情 = additive 只读（findOperationalRow 复用 qtc.credit 单行查询）；
// POST 设定额度 / POST 评估 = legacy qtc-credit-writes 同解析链（导出校验链复用，
// frozen 契约消息逐字节一致）；PUT 审批决定 = legacy POST /approve 的现代化动词别名
//（同 approveCredit 仓储调用与消息）。全部响应仓储直通 + mutationDto（credit:read）。
// TD-WF-013（WF-A）：PUT 审批遇到「评估人审批自己发起的信用决定」（职责分离触发器拒绝）
// 时映射成 403 + 中文说明（此前是 500）；映射只做在这个端点上。
import { DomainError } from '@kingturf/domain';
import { authorizeQuery } from '../../policy.ts';
import {
  allow,
  currency,
  decimal,
  idempotency,
  objectBody,
  string,
  timestamp,
  uuid,
} from '../../app-values.ts';
import { guardRejection } from '../../pg-rejections.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';
import type { ApiDependencies, ApiRequest } from '../../app.ts';
import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';

type Qtc = NonNullable<ApiDependencies['quoteToCash']>;

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type CreditReviewRepository = Pick<
  Qtc,
  'list' | 'setCreditLimit' | 'evaluateCredit' | 'approveCredit'
>;

type CreditQtc = NonNullable<ApiDependencies['quoteToCash']>;

// 端点内 qtc 缺失时抛错（guard 已先回 503，此为类型收窄的兜底路径）。
function requireQtc(qtc: CreditQtc | null): CreditQtc {
  if (!qtc) throw new Error('QuoteToCash dependency unavailable');
  return qtc;
}

// TD-WF-013：职责分离由数据库触发器 enforce_credit_approval_separation（迁移 0026）强制
// ——评估人审批自己发起的信用决定时它 RAISE EXCEPTION。只认这一条消息；其余异常原样
// 抛出（不做全局映射，也不回显数据库原始消息）。
const asSelfApproval = (error: unknown): unknown => {
  const hint = guardRejection(error, {
    'credit evaluator cannot approve own decision':
      '职责分离：发起信用评估的人不能审批这条信用决定，请由另一位审批人处理',
  });
  return hint === null ? error : new DomainError('forbidden', hint);
};

export function registerCreditReviewRoutes(
  app: FastifyRouteGroupApp,
  scope: FastifyRouteScope,
): void {
  // 依赖缺失时不在构建期抛错（与 commercial 轨口径一致）——仅 credit 端点访问时回 503。
  const qtc = scope.dependencies.quoteToCash ?? null;
  const readFields = scope.authorization.permissions.get('credit:read')?.fields;
  const scopeContext = (capability: PermissionKey) => {
    const grant = authorizeQuery(scope.authorization, capability);
    return {
      actor: scope.authorization.actor,
      scopes: grant.scopes,
      anchors: grant.anchors,
    };
  };
  // GET 双列表：qtc 视图轨迁移 + permittedDto（credit:read 字段授权同 legacy）。
  const listRoute = (path: string, view: 'limits' | 'credit') => {
    app.get(path, async () => {
      if (!qtc)
        return {
          statusCode: 503,
          body: {
            error: {
              code: 'internal_error',
              message: 'QuoteToCash dependency unavailable',
              correlationId: scope.correlationId,
            },
          },
        };
      const grant = authorizeQuery(scope.authorization, 'credit:read');
      const items: readonly Record<string, unknown>[] = await requireQtc(qtc).list(view, {
        actor: scope.authorization.actor,
        scopes: grant.scopes,
        anchors: grant.anchors,
      });
      return {
        // legacy 读轨按行裁剪（credit:read 字段授权同口径）。
        items: items.map((item) => permitted(item, readFields ?? null)),
      };
    });
  };
  listRoute('/api/v1/credit-limits', 'limits');
  listRoute('/api/v1/credit-decisions', 'credit');

  // GET 决定详情：additive 只读（credit 视图单行，id 匹配行内 id 字段）。
  app.get('/api/v1/credit-decisions/:decisionId', async (request, reply) => {
    const grant = authorizeQuery(scope.authorization, 'credit:read');
    const decisionId = uuid(
      (request.params as { decisionId: string }).decisionId,
      'creditDecisionId',
    );
    const rows: readonly Record<string, unknown>[] = await requireQtc(qtc).list('credit', {
      actor: scope.authorization.actor,
      scopes: grant.scopes,
      anchors: grant.anchors,
    });
    const row = rows.find((candidate) => candidate.id === decisionId);
    if (!row) {
      void reply.code(404).send({
        error: {
          code: 'not_found',
          message: 'Credit decision not found',
          correlationId: scope.correlationId,
        },
      });
      return;
    }
    return permitted(row, readFields ?? null);
  });

  // POST 设定额度：legacy qtc-credit-writes 同解析链（allow/解析/幂等键/credit:approve）。
  app.post('/api/v1/credit-limits', async (request, reply) => {
    const body = objectBody(request.body);
    allow(body, ['customerId', 'currency', 'amount', 'effectiveAt', 'expiresAt']);
    const input = {
      customerId: uuid(body.customerId, 'customerId'),
      currency: currency(body.currency),
      amount: decimal(body.amount, 'amount'),
      effectiveAt: timestamp(body.effectiveAt, 'effectiveAt'),
      expiresAt: timestamp(body.expiresAt, 'expiresAt'),
    };
    const key = idempotency(request as unknown as ApiRequest);
    const result = await requireQtc(qtc).setCreditLimit(
      input,
      key,
      scopeContext('credit:approve'),
      scope.correlationId,
    );
    void reply.code(201);
    return mutation(result, scope.authorization, 'credit:read');
  });

  // POST 评估：legacy 同解析链（credit:evaluate）。
  app.post('/api/v1/credit-decisions', async (request, reply) => {
    const body = objectBody(request.body);
    allow(body, [
      'customerId',
      'quoteRevisionId',
      'quoteSnapshotId',
      'creditLimitId',
      'validUntil',
    ]);
    const input = {
      customerId: uuid(body.customerId, 'customerId'),
      quoteRevisionId: uuid(body.quoteRevisionId, 'quoteRevisionId'),
      quoteSnapshotId: uuid(body.quoteSnapshotId, 'quoteSnapshotId'),
      creditLimitId: uuid(body.creditLimitId, 'creditLimitId'),
      validUntil: timestamp(body.validUntil, 'validUntil'),
    };
    const key = idempotency(request as unknown as ApiRequest);
    const result = await requireQtc(qtc).evaluateCredit(
      input,
      key,
      scopeContext('credit:evaluate'),
      scope.correlationId,
    );
    void reply.code(201);
    return mutation(result, scope.authorization, 'credit:read');
  });

  // PUT 审批决定：legacy POST /approve 的现代化动词别名（同 approveCredit 与消息）。
  // TD-WF-013：评估人自批（触发器 P0001）→ 403 + 中文说明（见 asSelfApproval）。
  app.put('/api/v1/credit-decisions/:decisionId/state', async (request, reply) => {
    const body = objectBody(request.body);
    allow(body, ['decision', 'reason']);
    const decision = string(body.decision, 'decision');
    if (decision !== 'APPROVED' && decision !== 'REJECTED')
      throw Object.assign(new Error('decision is unsupported'), { statusCode: 400 });
    const creditDecisionId = uuid(
      (request.params as { decisionId: string }).decisionId,
      'creditDecisionId',
    );
    const reason = string(body.reason, 'reason');
    const key = idempotency(request as unknown as ApiRequest);
    const qtcRepository = requireQtc(qtc);
    let result: Record<string, unknown>;
    try {
      result = await qtcRepository.approveCredit(
        creditDecisionId,
        decision,
        reason,
        key,
        scopeContext('credit:approve'),
        scope.correlationId,
      );
    } catch (error) {
      throw asSelfApproval(error);
    }
    void reply.code(200);
    return mutation(result, scope.authorization, 'credit:read');
  });
}

// 与 legacy mutationDto(credit:read) 同口径。
function mutation(
  value: Record<string, unknown>,
  authorization: AuthorizationContext,
  readCapability: PermissionKey,
): Record<string, unknown> {
  const read = authorization.permissions.get(readCapability);
  if (!read) return permitted(value, ['version']);
  return permitted(value, read.fields);
}

function permitted(row: Record<string, unknown>, fields: readonly string[] | null) {
  if (fields === null) return row;
  const visible = new Set(['id', ...fields]);
  return Object.fromEntries(Object.entries(row).filter(([key]) => visible.has(key)));
}
