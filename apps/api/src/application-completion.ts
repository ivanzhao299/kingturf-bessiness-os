import { type BrowserSessionConfig } from '@kingturf/config';
import type { ApiApplication, ApiRequest, ApiResponse } from './api-types.ts';
import { correlation, error } from './app-values.ts';
import { type ApiDependencies } from './app.ts';
import { securityResponseHeaders } from './middleware/security-headers.ts';
import { browserAuthResponse } from './middleware/session-carrier.ts';
export function completeApplication(
  application: Pick<ApiApplication, 'dispatch'>,
  dependencies: ApiDependencies | undefined,
  security: Readonly<{ enforceCsp?: boolean; browserSession?: BrowserSessionConfig }>,
  telemetry: NonNullable<ApiDependencies['telemetry']>,
  browserSession: BrowserSessionConfig,
): ApiApplication {
  const complete = (
    request: ApiRequest,
    correlationId: string,
    response: ApiResponse,
    started: number,
  ) => {
    const durationMs = Math.max(0, performance.now() - started);
    const route = request.pathname.startsWith('/api/')
      ? 'api'
      : request.pathname === '/health'
        ? 'health'
        : request.pathname === '/ready'
          ? 'ready'
          : 'other';
    const method = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
      ? request.method
      : 'OTHER';
    telemetry.count('http_requests_total', 1, {
      method,
      route,
      status: String(response.statusCode),
    });
    telemetry.timing('http_request_duration_ms', durationMs, { method, route });
    dependencies?.logger?.write({
      level: response.statusCode >= 500 ? 'error' : 'info',
      event: 'http.request.completed',
      correlationId,
      statusCode: response.statusCode,
      durationMs,
    });
    return {
      ...response,
      headers: {
        ...securityResponseHeaders(response.headers, security.enforceCsp ?? false),
        ...(browserAuthResponse(request, browserSession) ? { 'cache-control': 'no-store' } : {}),
        'x-correlation-id': correlationId,
      },
    };
  };
  return {
    rejectOversized(incomingCorrelationId) {
      const correlationId = correlation(incomingCorrelationId);
      return complete(
        { method: 'OTHER', pathname: '/transport/request-body' },
        correlationId,
        error(413, 'invalid_request', 'Request body too large', correlationId),
        performance.now(),
      );
    },
    async dispatch(request) {
      const correlationId = correlation(request.headers?.['x-correlation-id']);
      const started = performance.now();
      const response = await application.dispatch({
        ...request,
        headers: { ...request.headers, 'x-correlation-id': correlationId },
      });
      return complete(request, correlationId, response, started);
    },
  };
}
