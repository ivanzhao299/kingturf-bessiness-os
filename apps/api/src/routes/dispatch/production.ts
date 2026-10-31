import { assertStableCode } from '@kingturf/domain';
import {
  allow,
  calendarDate,
  decimal,
  jsonObject,
  mutationDto,
  objectBody,
  permittedDto,
  string,
  timestamp,
  uuid,
} from '../../app-values.ts';
import { authorizeQuery } from '../../policy.ts';
import { productionMaterialRoutes } from '../production-material.ts';
import { productionOrderCommandRoutes } from '../production-order-commands.ts';
import { productionOrderCreateRoutes } from '../production-order-create.ts';
import { productionOutputRoutes } from '../production-output.ts';
import { productionOrderReadRoutes } from '../production-reads.ts';
import { productionReportRoutes } from '../production-report.ts';
import { dispatchRoutes } from '../types.ts';
import { routeReply, type RouteAttempts, type RouteDispatchContext } from './context.ts';
export function* productionAttempts(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  if (dependencies.production) {
    if (request.method === 'GET' && request.pathname === '/api/v1/production-orders') {
      yield routeReply(
        dispatchRoutes(
          productionOrderReadRoutes({
            repository: dependencies.production,
            authorization: context,
            authorizeQuery,
            permittedDto,
          }),
          request,
        ),
      );
    }
    if (request.method === 'POST' && request.pathname === '/api/v1/production-orders') {
      yield routeReply(
        dispatchRoutes(
          productionOrderCreateRoutes({
            repository: dependencies.production,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: {
              objectBody,
              allow,
              string,
              stableCode: assertStableCode,
              uuid,
              decimal,
              calendarDate,
            },
            mutationDto,
          }),
          request,
        ),
      );
    }
    const productionCommand =
      /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/(release|start|complete|close|cancel)$/u.exec(
        request.pathname,
      );
    if (request.method === 'POST' && productionCommand) {
      yield routeReply(
        dispatchRoutes(
          productionOrderCommandRoutes({
            repository: dependencies.production,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: {
              objectBody,
              allow,
              uuid,
              string,
              jsonObject,
              stableCode: assertStableCode,
            },
            mutationDto,
          }),
          request,
        ),
      );
    }
    const materialCommand = /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/materials$/u.exec(
      request.pathname,
    );
    if (request.method === 'POST' && materialCommand) {
      yield routeReply(
        dispatchRoutes(
          productionMaterialRoutes({
            repository: dependencies.production,
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
    const reportCommand = /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/operation-reports$/u.exec(
      request.pathname,
    );
    if (request.method === 'POST' && reportCommand) {
      yield routeReply(
        dispatchRoutes(
          productionReportRoutes({
            repository: dependencies.production,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: {
              objectBody,
              allow,
              uuid,
              decimal,
              timestamp,
              string,
              stableCode: assertStableCode,
            },
            mutationDto,
          }),
          request,
        ),
      );
    }
    const outputCommand = /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/finished-rolls$/u.exec(
      request.pathname,
    );
    if (request.method === 'POST' && outputCommand) {
      yield routeReply(
        dispatchRoutes(
          productionOutputRoutes({
            repository: dependencies.production,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: {
              objectBody,
              allow,
              uuid,
              string,
              stableCode: assertStableCode,
              decimal,
              calendarDate,
            },
            mutationDto,
          }),
          request,
        ),
      );
    }
  }
}
