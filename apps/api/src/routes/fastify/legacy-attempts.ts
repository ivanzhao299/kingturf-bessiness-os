import { DomainError } from '@kingturf/domain';
import type { FastifyRequest } from 'fastify';
import type { ApiRequest, ApiResponse } from '../../api-types.ts';
import type { RouteAttempts, RouteDispatchContext } from '../dispatch/context.ts';
import type { FastifyRouteScope } from './registry.ts';

export function legacyRequest(request: FastifyRequest): ApiRequest {
  return {
    method: request.method,
    pathname: request.url.split('?')[0] ?? request.url,
    query: request.query as NonNullable<ApiRequest['query']>,
    body: request.body,
  };
}

export async function runLegacyAttempts(
  scope: FastifyRouteScope,
  request: ApiRequest,
  attempts: (context: RouteDispatchContext) => RouteAttempts,
): Promise<ApiResponse> {
  for (const attempt of attempts({ ...scope, request, context: scope.authorization })) {
    if (attempt.kind === 'immediate') return attempt.value;
    const result = attempt.project(await attempt.pending);
    if (result) return result;
  }
  throw new DomainError('not_found', 'Route not found');
}
