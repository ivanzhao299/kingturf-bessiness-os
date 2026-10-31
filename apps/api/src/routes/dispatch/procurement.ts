import { assertStableCode } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import {
  allow,
  array,
  calendarDate,
  currency,
  decimal,
  integer,
  jsonObject,
  mutationDto,
  objectBody,
  optionalCalendarDate,
  permittedDto,
  string,
  timestamp,
  uuid,
} from '../../app-values.ts';
import type { ApiDependencies } from '../../app.ts';
import { authorizeQuery } from '../../policy.ts';
import { procurementIssueRoutes } from '../procurement-issue.ts';
import { procurementLocationCreateRoutes } from '../procurement-location-create.ts';
import { procurementMovementCreateRoutes } from '../procurement-movement-create.ts';
import { procurementPurchaseOrderCreateRoutes } from '../procurement-purchase-order-create.ts';
import { procurementReadRoutes } from '../procurement-reads.ts';
import { procurementReceiptCreateRoutes } from '../procurement-receipt-create.ts';
import { procurementRfqCreateRoutes } from '../procurement-rfq-create.ts';
import { procurementSupplierCreateRoutes } from '../procurement-supplier-create.ts';
import { procurementSupplierQualificationRoutes } from '../procurement-supplier-qualification.ts';
import { procurementSupplierQuoteCreateRoutes } from '../procurement-supplier-quote-create.ts';
import { dispatchRoutes } from '../types.ts';
import { routeReply, type RouteAttempts, type RouteDispatchContext } from './context.ts';
function* procurementPart1(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  const procurementLists: Readonly<
    Record<
      string,
      | readonly [
          'suppliers' | 'rfqs' | 'quotes' | 'orders' | 'receipts' | 'locations' | 'inventory',
          PermissionKey,
        ]
      | undefined
    >
  > = {
    '/api/v1/suppliers': ['suppliers', 'supplier:read'],
    '/api/v1/procurement-rfqs': ['rfqs', 'procurement:read'],
    '/api/v1/supplier-quotes': ['quotes', 'procurement:read'],
    '/api/v1/purchase-orders': ['orders', 'procurement:read'],
    '/api/v1/goods-receipts': ['receipts', 'procurement:read'],
    '/api/v1/inventory-locations': ['locations', 'inventory:read'],
    '/api/v1/inventory-balances': ['inventory', 'inventory:read'],
  };
  const listDefinition = procurementLists[request.pathname];
  if (request.method === 'GET' && listDefinition) {
    const [view, capability] = listDefinition;
    const effectiveCapability =
      request.pathname === '/api/v1/inventory-locations' &&
      !context.permissions.has('inventory:read') &&
      context.permissions.has('inventory:move')
        ? 'inventory:move'
        : capability;
    yield routeReply(
      dispatchRoutes(
        procurementReadRoutes({
          repository: () =>
            dependencies.procurement as Pick<NonNullable<ApiDependencies['procurement']>, 'list'>,
          view,
          capability: effectiveCapability,
          authorization: context,
          authorizeQuery,
          permittedDto,
        }),
        request,
      ),
    );
  }
  if (request.method === 'POST' && request.pathname === '/api/v1/suppliers') {
    yield routeReply(
      dispatchRoutes(
        procurementSupplierCreateRoutes({
          repository: () =>
            dependencies.procurement as Pick<
              NonNullable<ApiDependencies['procurement']>,
              'createSupplier'
            >,
          authorization: context,
          authorizeQuery,
          correlationId,
          parsers: {
            objectBody,
            allow,
            string,
            stableCode: assertStableCode,
            currency,
            integer,
            jsonObject,
          },
          mutationDto,
        }),
        request,
      ),
    );
  }
  const qualification = /^\/api\/v1\/suppliers\/([0-9a-f-]+)\/qualifications$/u.exec(
    request.pathname,
  );
  if (request.method === 'POST' && qualification) {
    yield routeReply(
      dispatchRoutes(
        procurementSupplierQualificationRoutes({
          repository: () =>
            dependencies.procurement as Pick<
              NonNullable<ApiDependencies['procurement']>,
              'qualifySupplier'
            >,
          authorization: context,
          authorizeQuery,
          correlationId,
          parsers: {
            objectBody,
            allow,
            string,
            uuid,
            calendarDate,
            decimal,
            integer,
            jsonObject,
          },
          mutationDto,
        }),
        request,
      ),
    );
  }
  if (request.method === 'POST' && request.pathname === '/api/v1/procurement-rfqs') {
    yield routeReply(
      dispatchRoutes(
        procurementRfqCreateRoutes({
          repository: () =>
            dependencies.procurement as Pick<
              NonNullable<ApiDependencies['procurement']>,
              'createRfq'
            >,
          authorization: context,
          authorizeQuery,
          correlationId,
          parsers: {
            objectBody,
            allow,
            array,
            jsonObject,
            uuid,
            decimal,
            calendarDate,
            string,
            stableCode: assertStableCode,
            timestamp,
            currency,
          },
          mutationDto,
        }),
        request,
      ),
    );
  }
  if (request.method === 'POST' && request.pathname === '/api/v1/supplier-quotes') {
    yield routeReply(
      dispatchRoutes(
        procurementSupplierQuoteCreateRoutes({
          repository: () =>
            dependencies.procurement as Pick<
              NonNullable<ApiDependencies['procurement']>,
              'createSupplierQuote'
            >,
          authorization: context,
          authorizeQuery,
          correlationId,
          parsers: {
            objectBody,
            allow,
            array,
            jsonObject,
            uuid,
            decimal,
            calendarDate,
            string,
            timestamp,
          },
          mutationDto,
        }),
        request,
      ),
    );
  }
}
function* procurementPart2(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  if (request.method === 'POST' && request.pathname === '/api/v1/purchase-orders') {
    yield routeReply(
      dispatchRoutes(
        procurementPurchaseOrderCreateRoutes({
          repository: () =>
            dependencies.procurement as Pick<
              NonNullable<ApiDependencies['procurement']>,
              'createPurchaseOrder'
            >,
          authorization: context,
          authorizeQuery,
          correlationId,
          parsers: {
            objectBody,
            allow,
            array,
            jsonObject,
            uuid,
            decimal,
            calendarDate,
            string,
            stableCode: assertStableCode,
            currency,
          },
          mutationDto,
        }),
        request,
      ),
    );
  }
  const procurementIssue =
    /^\/api\/v1\/(procurement-rfqs|purchase-orders)\/([0-9a-f-]+)\/issue$/u.exec(request.pathname);
  if (request.method === 'POST' && procurementIssue) {
    yield routeReply(
      dispatchRoutes(
        procurementIssueRoutes({
          repository: () =>
            dependencies.procurement as Pick<
              NonNullable<ApiDependencies['procurement']>,
              'issueRfq' | 'issuePurchaseOrder'
            >,
          authorization: context,
          authorizeQuery,
          correlationId,
          parsers: { objectBody, allow, uuid },
          mutationDto,
        }),
        request,
      ),
    );
  }
  if (request.method === 'POST' && request.pathname === '/api/v1/inventory-locations') {
    yield routeReply(
      dispatchRoutes(
        procurementLocationCreateRoutes({
          repository: () =>
            dependencies.procurement as Pick<
              NonNullable<ApiDependencies['procurement']>,
              'createLocation'
            >,
          authorization: context,
          authorizeQuery,
          correlationId,
          parsers: { objectBody, allow, string, stableCode: assertStableCode },
          mutationDto,
        }),
        request,
      ),
    );
  }
  if (request.method === 'POST' && request.pathname === '/api/v1/goods-receipts') {
    yield routeReply(
      dispatchRoutes(
        procurementReceiptCreateRoutes({
          repository: () =>
            dependencies.procurement as Pick<
              NonNullable<ApiDependencies['procurement']>,
              'receive'
            >,
          authorization: context,
          authorizeQuery,
          correlationId,
          parsers: {
            objectBody,
            allow,
            array,
            jsonObject,
            uuid,
            string,
            stableCode: assertStableCode,
            decimal,
            optionalCalendarDate,
            timestamp,
          },
          mutationDto,
        }),
        request,
      ),
    );
  }
  if (request.method === 'POST' && request.pathname === '/api/v1/inventory-movements') {
    yield routeReply(
      dispatchRoutes(
        procurementMovementCreateRoutes({
          repository: () =>
            dependencies.procurement as Pick<NonNullable<ApiDependencies['procurement']>, 'move'>,
          authorization: context,
          authorizeQuery,
          correlationId,
          parsers: {
            objectBody,
            allow,
            string,
            uuid,
            decimal,
            timestamp,
            stableCode: assertStableCode,
          },
          mutationDto,
        }),
        request,
      ),
    );
  }
}
export function* procurementAttempts(scope: RouteDispatchContext): RouteAttempts {
  const { dependencies } = scope;
  if (dependencies.procurement) {
    yield* procurementPart1(scope);
    yield* procurementPart2(scope);
  }
}
