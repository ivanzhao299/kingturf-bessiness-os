// U3-COM-5（ADR-0015）：CTR 域 Fastify 端点组。
// GET 列表 = 视图轨迁移（listCommercialView('ctrs') + strict { items }——与 solutions
// 同款零漂移迁移）；GET 详情 = additive 只读（findCtr：根信息+全部版本行）；
// POST 创建 = legacy ctrCreateInput 同解析链（frozen 契约消息逐字节一致）；
// PUT 状态流转 = /ctr-versions/:id/state 现代化端点（action submit|decide 经
// ctrStateInput 同解析链分派 submitCtr/approveCtr；legacy POST submit/decision 轨不动）。
import { authorizeQuery } from '../../policy.ts';
import {
  allow,
  idempotency,
  jsonObject,
  mutationDto,
  objectBody,
  permittedDto,
  string,
  uuid,
  version,
} from '../../app-values.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';
import type { ApiDependencies } from '../../app.ts';
import type { ApiRequest } from '../../api-types.ts';
import { ctrCreateInput, ctrStateInput } from '../ctr.ts';

// 仓储端口自真实依赖派生（S4：禁止结构重注解抹掉 provenance）。
export type CtrRepository = Pick<
  NonNullable<ApiDependencies['commercial']>,
  | 'listCommercialView'
  | 'findCtr'
  | 'createCtr'
  | 'createCtrVersion'
  | 'submitCtr'
  | 'approveCtr'
  | 'linkCtrAttachment'
>;

const legacyParsers = {
  objectBody,
  allow,
  uuid,
  string,
  jsonObject,
  version,
  idempotency,
} as const;

const notFoundSchema = {
  error: { code: 'not_found', message: 'CTR not found', correlationId: 'corr' },
};

export function registerCtrRoutes(app: FastifyRouteGroupApp, scope: FastifyRouteScope): void {
  const repository: CtrRepository | null = scope.dependencies.commercial ?? null;
  if (!repository)
    throw Object.assign(new Error('Commercial dependency unavailable'), { statusCode: 503 });
  const readFields = scope.authorization.permissions.get('ctr:read')?.fields;
  const legacyContext = () => ({
    repository,
    authorization: scope.authorization,
    correlationId: scope.correlationId,
    parsers: legacyParsers,
    authorize: (
      capabilityOfGrant: Parameters<typeof authorizeQuery>[1],
      fields?: readonly string[],
    ) => authorizeQuery(scope.authorization, capabilityOfGrant, fields),
    mutationDto: (value: Record<string, unknown>) =>
      mutationDto(value, scope.authorization, 'ctr:read'),
  });

  app.get('/api/v1/ctrs', async () => {
    const grant = authorizeQuery(scope.authorization, 'ctr:read');
    const items = await repository.listCommercialView(
      'ctrs',
      scope.authorization.actor,
      grant.scopes,
      grant.anchors,
    );
    return {
      items: items.map((item) =>
        permittedDto(item as unknown as Record<string, unknown>, readFields ?? null),
      ),
    };
  });

  app.get('/api/v1/ctrs/:ctrId', async (request, reply) => {
    const grant = authorizeQuery(scope.authorization, 'ctr:read');
    const ctr = await repository.findCtr(
      (request.params as { ctrId: string }).ctrId.toLowerCase(),
      scope.authorization.actor,
      grant.scopes,
      grant.anchors,
    );
    if (!ctr) {
      void reply.code(404).send({
        ...notFoundSchema,
        error: { ...notFoundSchema.error, correlationId: scope.correlationId },
      });
      return;
    }
    return permittedDto(ctr as unknown as Record<string, unknown>, readFields ?? null);
  });

  // POST 创建：legacy ctrCreateInput 同解析链 → 201 + mutationDto（契约消息一致）。
  app.post('/api/v1/ctrs', async (request, reply) => {
    const { grant, input } = ctrCreateInput(legacyContext(), request as unknown as ApiRequest);
    const created = await repository.createCtr(
      input,
      scope.authorization.actor,
      grant.scopes,
      grant.anchors,
      scope.correlationId,
    );
    void reply.code(201);
    return mutationDto(
      created as unknown as Record<string, unknown>,
      scope.authorization,
      'ctr:read',
    );
  });

  // PUT 状态流转：action=submit → submitCtr（expectedVersion/幂等键同 legacy）；
  // action=decide → approveCtr（decision 枚举/理由同 legacy）。legacy POST 轨逐字不动。
  app.put('/api/v1/ctr-versions/:versionId/state', async (request, reply) => {
    const input = ctrStateInput(
      legacyContext(),
      request as unknown as ApiRequest,
      (request.params as { versionId: string }).versionId,
    );
    const result =
      input.kind === 'submit'
        ? await repository.submitCtr(
            input.versionId,
            input.expectedVersion,
            input.idempotencyKey,
            scope.authorization.actor,
            input.grant.scopes,
            input.grant.anchors,
            scope.correlationId,
          )
        : await repository.approveCtr(
            input.versionId,
            input.decision,
            input.reason,
            input.idempotencyKey,
            scope.authorization.actor,
            input.grant.scopes,
            input.grant.anchors,
            scope.correlationId,
          );
    void reply.code(200);
    return mutationDto(
      result as unknown as Record<string, unknown>,
      scope.authorization,
      'ctr:read',
    );
  });
}
