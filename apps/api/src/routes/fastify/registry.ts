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
import type { JsonObject } from '@kingturf/types';
import type { ApiDependencies } from '../../app.ts';
import type { AuthorizationContext } from '@kingturf/domain';
import { recordRequestFailure } from '../../request-failure.ts';
import { registerCommercialOpportunitiesRoutes } from './commercial-opportunities.ts';
import { registerTechnicalSolutionRoutes } from './technical-solutions.ts';
import { registerQuoteRoutes } from './quotes.ts';
import { registerCostMatrixRoutes } from './cost-matrices.ts';
import { registerCtrRoutes } from './ctr.ts';
import { registerSalesPolicyRoutes } from './sales-policies.ts';
import { registerCreditReviewRoutes } from './credit-review.ts';
import { registerLeadRoutes } from './leads.ts';
import { registerCustomerRoutes } from './customers.ts';
import { registerContactRoutes } from './contacts.ts';
import { registerActivityRoutes } from './activities.ts';
import { registerSupplierRoutes } from './suppliers.ts';
import { registerRfqRoutes } from './rfqs.ts';
import { registerPurchaseOrderRoutes } from './purchase-orders.ts';
import { registerGoodsReceiptRoutes } from './goods-receipts.ts';
import { registerSupplierQuoteRoutes } from './supplier-quotes.ts';
import { registerInventoryLedgerRoutes } from './inventory-ledger.ts';
import { registerManufacturingItemRoutes } from './manufacturing-items.ts';
import { registerManufacturingBomRoutes } from './manufacturing-boms.ts';
import { registerManufacturingRoutingRoutes } from './manufacturing-routings.ts';
import { registerManufacturingVersionRoutes } from './manufacturing-versions.ts';
import { registerProductionOrderRoutes } from './production-orders.ts';
import { registerProductionOrderExecutionRoutes } from './production-order-execution.ts';
import { registerMrpReadRoutes, registerMrpWriteRoutes } from './mrp.ts';
import { registerArOpenItemRoutes } from './ar-open-items.ts';
import { registerBankPaymentRoutes } from './bank-payments.ts';
import { registerCollectionCaseRoutes } from './collection-cases.ts';
import { registerQualityRoutes } from './quality.ts';
import { registerComplaintRoutes } from './complaints.ts';
import { registerShipmentRoutes } from './shipments.ts';

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
  ['GET', /^\/api\/v1\/cost-matrix-summaries$/u],
  ['GET', /^\/api\/v1\/cost-matrices$/u],
  ['GET', /^\/api\/v1\/cost-matrices\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/cost-matrices$/u],
  ['PUT', /^\/api\/v1\/cost-matrices\/[0-9a-f-]+\/factors\/[0-9a-f-]+$/u],
  ['GET', /^\/api\/v1\/ctrs$/u],
  ['GET', /^\/api\/v1\/ctrs\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/ctrs$/u],
  ['PUT', /^\/api\/v1\/ctr-versions\/[0-9a-f-]+\/state$/u],
  ['GET', /^\/api\/v1\/sales-policies$/u],
  ['GET', /^\/api\/v1\/sales-policies\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/sales-policies$/u],
  ['PUT', /^\/api\/v1\/sales-policies\/[0-9a-f-]+\/versions$/u],
  ['GET', /^\/api\/v1\/credit-limits$/u],
  ['GET', /^\/api\/v1\/credit-decisions$/u],
  ['GET', /^\/api\/v1\/credit-decisions\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/credit-limits$/u],
  ['POST', /^\/api\/v1\/credit-decisions$/u],
  ['PUT', /^\/api\/v1\/credit-decisions\/[0-9a-f-]+\/state$/u],
  ['GET', /^\/api\/v1\/leads$/u],
  ['GET', /^\/api\/v1\/leads\/pool$/u],
  ['GET', /^\/api\/v1\/leads\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/leads$/u],
  ['PUT', /^\/api\/v1\/leads\/[0-9a-f-]+\/state$/u],
  ['GET', /^\/api\/v1\/customers$/u],
  ['GET', /^\/api\/v1\/customers\/[0-9a-f-]+$/u],
  ['GET', /^\/api\/v1\/customers\/[0-9a-f-]+\/360$/u],
  ['POST', /^\/api\/v1\/customers$/u],
  ['GET', /^\/api\/v1\/customers\/[0-9a-f-]+\/contacts$/u],
  ['GET', /^\/api\/v1\/customers\/[0-9a-f-]+\/contacts\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/customers\/[0-9a-f-]+\/contacts$/u],
  ['GET', /^\/api\/v1\/customers\/[0-9a-f-]+\/activities$/u],
  ['GET', /^\/api\/v1\/customers\/[0-9a-f-]+\/activities\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/customers\/[0-9a-f-]+\/activities$/u],
  ['GET', /^\/api\/v1\/suppliers$/u],
  ['GET', /^\/api\/v1\/suppliers\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/suppliers$/u],
  ['PUT', /^\/api\/v1\/suppliers\/[0-9a-f-]+\/qualification$/u],
  ['PUT', /^\/api\/v1\/suppliers\/[0-9a-f-]+\/state$/u],
  ['GET', /^\/api\/v1\/procurement-rfqs$/u],
  ['GET', /^\/api\/v1\/procurement-rfqs\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/procurement-rfqs$/u],
  ['PUT', /^\/api\/v1\/procurement-rfqs\/[0-9a-f-]+\/state$/u],
  ['GET', /^\/api\/v1\/purchase-orders$/u],
  ['GET', /^\/api\/v1\/purchase-orders\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/purchase-orders$/u],
  ['PUT', /^\/api\/v1\/purchase-orders\/[0-9a-f-]+\/state$/u],
  ['GET', /^\/api\/v1\/goods-receipts$/u],
  ['GET', /^\/api\/v1\/goods-receipts\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/goods-receipts$/u],
  ['GET', /^\/api\/v1\/supplier-quotes$/u],
  ['GET', /^\/api\/v1\/supplier-quotes\/[0-9a-f-]+$/u],
  ['GET', /^\/api\/v1\/inventory-balances$/u],
  ['GET', /^\/api\/v1\/inventory-balances\/[0-9a-f-]+\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/inventory-movements$/u],
  ['GET', /^\/api\/v1\/inventory-movement-sources$/u],
  ['GET', /^\/api\/v1\/manufacturing-items$/u],
  ['GET', /^\/api\/v1\/manufacturing-items\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/manufacturing-items$/u],
  ['GET', /^\/api\/v1\/manufacturing-boms$/u],
  ['GET', /^\/api\/v1\/manufacturing-boms\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/manufacturing-boms$/u],
  ['PUT', /^\/api\/v1\/manufacturing-boms\/[0-9a-f-]+\/publish$/u],
  ['GET', /^\/api\/v1\/manufacturing-routings$/u],
  ['GET', /^\/api\/v1\/manufacturing-routings\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/manufacturing-routings$/u],
  ['PUT', /^\/api\/v1\/manufacturing-routings\/[0-9a-f-]+\/publish$/u],
  ['POST', /^\/api\/v1\/manufacturing-items\/[0-9a-f-]+\/versions$/u],
  ['POST', /^\/api\/v1\/manufacturing-boms\/[0-9a-f-]+\/versions$/u],
  ['POST', /^\/api\/v1\/manufacturing-routings\/[0-9a-f-]+\/versions$/u],
  ['GET', /^\/api\/v1\/production-orders$/u],
  ['GET', /^\/api\/v1\/production-orders\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/production-orders$/u],
  ['PUT', /^\/api\/v1\/production-orders\/[0-9a-f-]+\/state$/u],
  ['POST', /^\/api\/v1\/production-orders\/[0-9a-f-]+\/operation-reports$/u],
  ['POST', /^\/api\/v1\/production-orders\/[0-9a-f-]+\/finished-rolls$/u],
  ['POST', /^\/api\/v1\/production-orders\/[0-9a-f-]+\/materials$/u],
  ['GET', /^\/api\/v1\/mrp-policies$/u],
  ['GET', /^\/api\/v1\/mrp-demands$/u],
  ['GET', /^\/api\/v1\/mrp-runs$/u],
  ['GET', /^\/api\/v1\/mrp-runs\/[0-9a-f-]+$/u],
  ['GET', /^\/api\/v1\/mrp-proposals$/u],
  ['POST', /^\/api\/v1\/mrp-policies$/u],
  ['POST', /^\/api\/v1\/mrp-demands$/u],
  ['POST', /^\/api\/v1\/mrp-runs$/u],
  ['POST', /^\/api\/v1\/mrp-proposals\/[0-9a-f-]+\/(approve|reject|release|cancel)$/u],
  ['GET', /^\/api\/v1\/ar-open-items$/u],
  ['GET', /^\/api\/v1\/ar-open-items\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/ar-open-items$/u],
  ['GET', /^\/api\/v1\/bank-payments$/u],
  ['GET', /^\/api\/v1\/bank-payments\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/bank-payments$/u],
  ['GET', /^\/api\/v1\/reconciliation-runs$/u],
  ['GET', /^\/api\/v1\/reconciliation-runs\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/reconciliation-runs$/u],
  ['GET', /^\/api\/v1\/collection-cases$/u],
  ['GET', /^\/api\/v1\/collection-cases\/[0-9a-f-]+$/u],
  ['POST', /^\/api\/v1\/collection-cases$/u],
  ['POST', /^\/api\/v1\/collection-cases\/[0-9a-f-]+\/(?:followups|promises|legal-handoffs)$/u],
  ['POST', /^\/api\/v1\/collection-promises\/[0-9a-f-]+\/break$/u],
  ['POST', /^\/api\/v1\/legal-handoffs\/[0-9a-f-]+\/(?:accept|evidence-packages)$/u],
  ['GET', /^\/api\/v1\/(?:quality-plans|quality-inspections|lot-traceability)(?:\/[0-9a-f-]+)?$/u],
  ['POST', /^\/api\/v1\/quality-plans(?:\/[0-9a-f-]+\/publish)?$/u],
  [
    'POST',
    /^\/api\/v1\/quality-inspections(?:\/[0-9a-f-]+\/(?:sample|complete|cancel|results|release|reject))?$/u,
  ],
  ['GET', /^\/api\/v1\/(?:complaints(?:\/[0-9a-f-]+)?|complaint-sla-policies)$/u],
  [
    'POST',
    /^\/api\/v1\/(?:complaints(?:\/batch-triage|\/[0-9a-f-]+\/(?:triage|investigate|reject|close|ncrs))?|complaint-sla-policies)$/u,
  ],
  ['POST', /^\/api\/v1\/ncrs\/[0-9a-f-]+\/(?:contain|root-cause|disposition|close|capas)$/u],
  ['POST', /^\/api\/v1\/capas\/[0-9a-f-]+\/(?:actions|verify|close)$/u],
  ['POST', /^\/api\/v1\/capa-actions\/[0-9a-f-]+\/complete$/u],
  ['GET', /^\/api\/v1\/shipment-releases(?:\/[0-9a-f-]+)?$/u],
  [
    'POST',
    /^\/api\/v1\/shipment-releases(?:\/[0-9a-f-]+\/(?:approve-exception|reject-exception|release|dispatch))?$/u,
  ],
  ['POST', /^\/api\/v1\/shipments\/[0-9a-f-]+\/(?:in-transit|deliver)$/u],
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

  app.setSerializerCompiler(serializerCompiler);
  app.setValidatorCompiler(validatorCompiler);
  app.setErrorHandler((cause, request, reply) => {
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
    // 5xx：响应信封不含内部细节，异常本身记入服务端日志（TD-API-004）。
    const failed = (status: number): void => {
      recordRequestFailure(
        scope.dependencies.logger,
        { method: request.method, pathname: request.url.split('?')[0] ?? request.url },
        scope.correlationId,
        status,
        cause,
      );
    };
    if (typeof statusCode === 'number' && statusCode >= 500) {
      failed(statusCode);
      void reply.code(statusCode).send(errorBody('internal_error', message));
      return;
    }
    failed(500);
    void reply.code(500).send(errorBody('internal_error', 'Internal server error'));
  });
  registerCommercialOpportunitiesRoutes(app, scope);
  registerTechnicalSolutionRoutes(app, scope);
  registerQuoteRoutes(app, scope);
  registerCostMatrixRoutes(app, scope);
  registerCtrRoutes(app, scope);
  registerSalesPolicyRoutes(app, scope);
  registerCreditReviewRoutes(app, scope);
  registerLeadRoutes(app, scope);
  registerCustomerRoutes(app, scope);
  registerContactRoutes(app, scope);
  registerActivityRoutes(app, scope);
  registerSupplierRoutes(app, scope);
  registerRfqRoutes(app, scope);
  registerPurchaseOrderRoutes(app, scope);
  registerGoodsReceiptRoutes(app, scope);
  registerSupplierQuoteRoutes(app, scope);
  registerInventoryLedgerRoutes(app, scope);
  registerManufacturingItemRoutes(app, scope);
  registerManufacturingBomRoutes(app, scope);
  registerManufacturingRoutingRoutes(app, scope);
  registerManufacturingVersionRoutes(app, scope);
  registerProductionOrderRoutes(app, scope);
  registerProductionOrderExecutionRoutes(app, scope);
  registerMrpReadRoutes(app, scope);
  registerMrpWriteRoutes(app, scope);
  registerArOpenItemRoutes(app, scope);
  registerBankPaymentRoutes(app, scope);
  registerCollectionCaseRoutes(app, scope);
  registerQualityRoutes(app, scope);
  registerComplaintRoutes(app, scope);
  registerShipmentRoutes(app, scope);
  return app;
};

export type FastifyRouteGroupApp = ReturnType<typeof buildRouteGroupApp>;

// U3-COM-6：undefined 值的键序列化为 null（JSON.stringify 默认丢弃 undefined 键，
// 而 legacy allow/字段授权按 Object.keys 判定键存在性——与 app.dispatch 直传语义对齐）。
const jsonUndefinedToNull = (
  _key: string,
  value: unknown,
): string | number | boolean | null | object => (value === undefined ? null : value);

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
      headers: {
        // 原始请求头透传（幂等键/关联ID 等 legacy 解析链依赖项）。
        ...Object.fromEntries(
          Object.entries(request.headers ?? {}).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        ),
        ...(request.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(request.body === undefined
        ? {}
        : {
            // undefined 值的键序列化为 null（保留键存在性——legacy allow/字段授权按
            // Object.keys 判定；真实 HTTP 层 JSON.stringify 同样丢弃 undefined，
            // 此处与 app.dispatch 直传语义对齐）。
            payload: JSON.stringify(request.body, jsonUndefinedToNull),
          }),
    });
    const body: JsonObject = response.json();
    return { statusCode: response.statusCode, body };
  } finally {
    await app.close();
  }
}
