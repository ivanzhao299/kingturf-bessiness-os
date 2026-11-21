// U3-COM-2（ADR-0015 接线批）：Fastify 路由组生产桥——node:http 监听不变，
// app.ts dispatch 在认证/cookie-CSRF/MUST_CHANGE 门之后、legacy 组之前调用
// dispatchFastifyRouteGroup；被认领 (method,pathname) 的请求构建 Fastify 实例
//（闭包注入逐请求 scope：授权上下文/仓储/关联ID）并 inject 执行 Fastify+Zod
// 生命周期，未认领请求返回 null 落回 legacy 轨（双轨并行）。
// 每请求实例是刻意的正确性取舍（ALS 不穿透 light-my-request 生命周期；实例构建
// ≈毫秒级，且生产仅认领少量低频读端点），后续子批如需可换共享实例+上下文绑定。
// 错误形状对齐 legacy ApiResponse 信封（code/message/correlationId）。
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import { DomainError } from '@kingturf/domain';
import type { ApiRequest, ApiResponse } from '../../api-types.ts';
import type { ApiDependencies } from '../../app.ts';
import type { AuthorizationContext } from '@kingturf/domain';
import { registerCommercialOpportunitiesRoutes } from './commercial-opportunities.ts';
import { registerTechnicalSolutionRoutes } from './technical-solutions.ts';
import { registerQuoteRoutes } from './quotes.ts';

export type FastifyRouteScope = Readonly<{
  authorization: AuthorizationContext;
  dependencies: ApiDependencies;
  correlationId: string;
}>;

// 认领清单：与 buildRouteGroupApp 内插件注册一一对应（单一来源）；
// 不在清单内的请求直接返回 null 落回 legacy 轨。
const CLAIMED_FASTIFY_ROUTES: readonly (readonly [method: string, pattern: RegExp])[] = [
  ['GET', /^\/api\/v1\/opportunities$/u],
  ['GET', /^\/api\/v1\/technical-solutions$/u],
  ['GET', /^\/api\/v1\/technical-solutions\/[0-9a-f-]+$/u],
  ['PUT', /^\/api\/v1\/technical-solutions\/[0-9a-f-]+$/u],
  ['GET', /^\/api\/v1\/quotes$/u],
  ['GET', /^\/api\/v1\/quotes\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/quotes$/u],
  ['PUT', /^\/api\/v1\/quotes\/[0-9a-f-]+$/u],
];

// legacy catch 层的同款 DomainError 状态映射（行为守恒）。
const domainErrorStatus = (code: DomainError['code']): number => {
  if (code === 'forbidden') return 403;
  if (code === 'not_found') return 404;
  if (code === 'conflict') return 409;
  return 400;
};

const buildRouteGroupApp = (scope: FastifyRouteScope) => {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- serializerCompiler/validatorCompiler 的泛型签名在 strict 模式下退化为 any；与 server-fastify.ts 同一豁免口径
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  app.setSerializerCompiler(serializerCompiler);
  app.setValidatorCompiler(validatorCompiler);
  app.setErrorHandler((cause, _request, reply) => {
    const errorBody = (
      code: DomainError['code'] | 'invalid_request' | 'internal_error',
      message: string,
    ) => ({ error: { code, message, correlationId: scope.correlationId } });
    if (cause instanceof DomainError) {
      void reply.code(domainErrorStatus(cause.code)).send(errorBody(cause.code, cause.message));
      return;
    }
    const message =
      typeof (cause as { message?: unknown }).message === 'string'
        ? (cause as { message: string }).message
        : 'Request validation failed';
    const statusCode = (cause as { statusCode?: unknown }).statusCode;
    if (statusCode === 400) {
      void reply.code(400).send(errorBody('invalid_request', message));
      return;
    }
    if (typeof statusCode === 'number' && statusCode >= 500) {
      void reply.code(statusCode).send(errorBody('internal_error', message));
      return;
    }
    void reply.code(500).send(errorBody('internal_error', 'Internal server error'));
  });
  registerCommercialOpportunitiesRoutes(app, scope);
  registerTechnicalSolutionRoutes(app, scope);
  registerQuoteRoutes(app, scope);
  return app;
};

export type FastifyRouteGroupApp = ReturnType<typeof buildRouteGroupApp>;

export async function dispatchFastifyRouteGroup(
  request: ApiRequest,
  scope: FastifyRouteScope,
): Promise<ApiResponse | null> {
  const claimed = CLAIMED_FASTIFY_ROUTES.some(
    ([method, pattern]) => method === request.method && pattern.test(request.pathname),
  );
  if (!claimed) return null;
  const app = buildRouteGroupApp(scope);
  try {
    const queryEntries = Object.entries(request.query ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    );
    const search =
      queryEntries.length > 0 ? `?${new URLSearchParams(queryEntries).toString()}` : '';
    const response = await app.inject({
      method: request.method as 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE' | 'HEAD',
      url: `${request.pathname}${search}`,
      ...(request.body === undefined
        ? {}
        : {
            payload: JSON.stringify(request.body),
            headers: { 'content-type': 'application/json' },
          }),
    });
    return { statusCode: response.statusCode, body: response.json() };
  } finally {
    await app.close();
  }
}
