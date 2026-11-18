// D5（ADR-0013）：租户设置端点——GET 目录/当前值/历史；PUT 写 DRAFT（幂等键必须）；
// POST 发布（单向 DRAFT→PUBLISHED，幂等键必须）。授权 default-deny 经新 capability。
import type { ApiDependencies } from '../app.ts';
import { idempotency, objectBody, allow, string } from '../app-values.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = NonNullable<ApiDependencies['tenantSettings']>;
type Actor = Parameters<Repository['put']>[0]['actor'];
export type TenantSettingsRouteContext = Readonly<{
  repository: Repository;
  tenantId: string;
  correlationId: string;
  actor: Actor;
}>;

export function tenantSettingListRoutes(
  context: Pick<TenantSettingsRouteContext, 'repository' | 'tenantId'>,
): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/tenant-settings' ? { params: [] } : null),
      validate: null,
      handler: async () => ({
        statusCode: 200,
        body: { items: await context.repository.list(context.tenantId) },
      }),
    }),
  ];
}

export function tenantSettingWriteRoutes(
  context: Readonly<TenantSettingsRouteContext>,
): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'PUT',
      match: (pathname) => (pathname === '/api/v1/tenant-settings' ? { params: [] } : null),
      validate: (request) => {
        const body = objectBody(request.body);
        allow(body, ['key', 'value']);
        return {
          repository: context.repository,
          tenantId: context.tenantId,
          key: string(body.key, 'key'),
          value: body.value,
          idempotencyKey: idempotency(request),
          correlationId: context.correlationId,
          actor: context.actor,
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: await input.repository.put(input),
      }),
    }),
  ];
}

export function tenantSettingPublishRoutes(
  context: Readonly<TenantSettingsRouteContext>,
): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/tenant-settings/publish' ? { params: [] } : null),
      validate: (request) => {
        const body = objectBody(request.body);
        allow(body, ['key']);
        return {
          repository: context.repository,
          tenantId: context.tenantId,
          key: string(body.key, 'key'),
          idempotencyKey: idempotency(request),
          correlationId: context.correlationId,
          actor: context.actor,
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: await input.repository.publish(input),
      }),
    }),
  ];
}
