import type { HealthStatus } from '@kingturf/types';

export type ApiResponse = Readonly<{
  body: HealthStatus | Readonly<{ error: 'not_found' }>;
  statusCode: 200 | 404;
}>;

export type ApiApplication = Readonly<{
  dispatch: (method: string, pathname: string) => ApiResponse;
}>;

export function buildApp(): ApiApplication {
  return {
    dispatch(method, pathname) {
      if (method === 'GET' && pathname === '/health') {
        return { body: { status: 'ok' }, statusCode: 200 };
      }

      return { body: { error: 'not_found' }, statusCode: 404 };
    },
  };
}
