import { addDecimal, normalizeDecimal } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import {
  allow,
  array,
  currency,
  decimal,
  idempotency,
  jsonObject,
  mutationDto,
  objectBody,
  string,
  timestamp,
  uuid,
} from '../../app-values.ts';
import type { ApiDependencies } from '../../app.ts';
import { authorizeQuery } from '../../policy.ts';
import { qtcArPostRoutes } from '../qtc-ar-post.ts';
import { qtcBankPaymentIntakeRoutes } from '../qtc-bank-payment-intake.ts';
import { qtcContractCreateRoutes } from '../qtc-contract-create.ts';
import { qtcContractSignRoutes } from '../qtc-contract-sign.ts';
import { qtcCreditApprovalRoutes } from '../qtc-credit-approval.ts';
import { qtcCreditEvaluationRoutes, qtcCreditLimitRoutes } from '../qtc-credit-writes.ts';
import { qtcReconciliationRunRoutes } from '../qtc-reconciliation-run.ts';
import { qtcSalesOrderCreateRoutes } from '../qtc-sales-order-create.ts';
import { dispatchRoutes } from '../types.ts';
import { routeReply, type RouteAttempts, type RouteDispatchContext } from './context.ts';
function* qtcPostPart1(
  scope: RouteDispatchContext,
  body: Record<string, unknown>,
  ctx: Parameters<typeof qtcCreditLimitRoutes>[0]['authorizeScope'],
): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  if (request.pathname === '/api/v1/credit-limits') {
    yield routeReply(
      dispatchRoutes(
        qtcCreditLimitRoutes({
          repository: () =>
            dependencies.quoteToCash as Pick<
              NonNullable<ApiDependencies['quoteToCash']>,
              'setCreditLimit'
            >,
          body,
          authorization: context,
          authorizeScope: ctx,
          mutationDto,
          correlationId,
          parsers: { allow, uuid, currency, decimal, timestamp, idempotency },
        }),
        request,
      ),
    );
  }
  if (request.pathname === '/api/v1/credit-decisions') {
    yield routeReply(
      dispatchRoutes(
        qtcCreditEvaluationRoutes({
          repository: () =>
            dependencies.quoteToCash as Pick<
              NonNullable<ApiDependencies['quoteToCash']>,
              'evaluateCredit'
            >,
          body,
          authorization: context,
          authorizeScope: ctx,
          mutationDto,
          correlationId,
          parsers: { allow, uuid, currency, decimal, timestamp, idempotency },
        }),
        request,
      ),
    );
  }
  const creditApproval = /^\/api\/v1\/credit-decisions\/([0-9a-f-]+)\/approve$/u.exec(
    request.pathname,
  );
  if (creditApproval) {
    yield routeReply(
      dispatchRoutes(
        qtcCreditApprovalRoutes({
          repository: () =>
            dependencies.quoteToCash as Pick<
              NonNullable<ApiDependencies['quoteToCash']>,
              'approveCredit'
            >,
          rawId: creditApproval[1],
          body,
          authorization: context,
          authorizeScope: ctx,
          mutationDto,
          correlationId,
          parsers: { allow, string, uuid, idempotency },
        }),
        request,
      ),
    );
  }
  if (request.pathname === '/api/v1/contracts') {
    yield routeReply(
      dispatchRoutes(
        qtcContractCreateRoutes({
          repository: () =>
            dependencies.quoteToCash as Pick<
              NonNullable<ApiDependencies['quoteToCash']>,
              'createContract'
            >,
          body,
          authorization: context,
          authorizeScope: ctx,
          mutationDto,
          correlationId,
          parsers: { allow, uuid, string, jsonObject, idempotency },
        }),
        request,
      ),
    );
  }
  const signing = /^\/api\/v1\/contracts\/([0-9a-f-]+)\/sign$/u.exec(request.pathname);
  if (signing) {
    yield routeReply(
      dispatchRoutes(
        qtcContractSignRoutes({
          repository: () =>
            dependencies.quoteToCash as Pick<
              NonNullable<ApiDependencies['quoteToCash']>,
              'signContract'
            >,
          rawId: signing[1],
          body,
          authorization: context,
          authorizeScope: ctx,
          mutationDto,
          correlationId,
          parsers: { allow, uuid, string, jsonObject, timestamp, idempotency },
        }),
        request,
      ),
    );
  }
  if (request.pathname === '/api/v1/sales-orders') {
    yield routeReply(
      dispatchRoutes(
        qtcSalesOrderCreateRoutes({
          repository: () =>
            dependencies.quoteToCash as Pick<
              NonNullable<ApiDependencies['quoteToCash']>,
              'createOrder'
            >,
          body,
          authorization: context,
          authorizeScope: ctx,
          mutationDto,
          correlationId,
          parsers: {
            allow,
            array,
            objectBody,
            string,
            decimal,
            addDecimal,
            normalizeDecimal,
            uuid,
            currency,
            idempotency,
          },
        }),
        request,
      ),
    );
  }
}
function* qtcPostPart2(
  scope: RouteDispatchContext,
  body: Record<string, unknown>,
  ctx: Parameters<typeof qtcCreditLimitRoutes>[0]['authorizeScope'],
): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  if (request.pathname === '/api/v1/ar-open-items') {
    yield routeReply(
      dispatchRoutes(
        qtcArPostRoutes({
          repository: () =>
            dependencies.quoteToCash as Pick<NonNullable<ApiDependencies['quoteToCash']>, 'postAr'>,
          body,
          authorization: context,
          authorizeScope: ctx,
          mutationDto,
          correlationId,
          parsers: { allow, string, uuid, currency, decimal, timestamp, idempotency },
        }),
        request,
      ),
    );
  }
  if (request.pathname === '/api/v1/bank-payments') {
    yield routeReply(
      dispatchRoutes(
        qtcBankPaymentIntakeRoutes({
          repository: () =>
            dependencies.quoteToCash as Pick<
              NonNullable<ApiDependencies['quoteToCash']>,
              'intakePayment'
            >,
          body,
          authorization: context,
          authorizeScope: ctx,
          mutationDto,
          correlationId,
          parsers: {
            allow,
            uuid,
            currency,
            decimal,
            timestamp,
            string,
            jsonObject,
            idempotency,
          },
        }),
        request,
      ),
    );
  }
  if (request.pathname === '/api/v1/reconciliation-runs') {
    yield routeReply(
      dispatchRoutes(
        qtcReconciliationRunRoutes({
          repository: () =>
            dependencies.quoteToCash as Pick<
              NonNullable<ApiDependencies['quoteToCash']>,
              'reconcile'
            >,
          body,
          authorization: context,
          authorizeScope: ctx,
          mutationDto,
          correlationId,
          parsers: { allow, uuid, idempotency },
        }),
        request,
      ),
    );
  }
}
export function* qtcpostAttempts(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context } = scope;
  if (request.method === 'POST' && dependencies.quoteToCash) {
    const body = objectBody(request.body),
      ctx = (capability: PermissionKey) => {
        const grant = authorizeQuery(context, capability, Object.keys(body));
        return { actor: context.actor, scopes: grant.scopes, anchors: grant.anchors };
      };
    yield* qtcPostPart1(scope, body, ctx);
    yield* qtcPostPart2(scope, body, ctx);
  }
}
