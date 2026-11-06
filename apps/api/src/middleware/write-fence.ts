import type { ApiApplication, ApiRequest, ApiResponse } from '../api-types.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ALWAYS_AVAILABLE_PATHNAMES = new Set(['/health', '/ready', '/version']);

/** Maintenance write fence: while enabled, every mutating request fails closed. */
export function applyWriteFence(app: ApiApplication, enabled: boolean): ApiApplication {
  if (!enabled) return app;
  return {
    ...app,
    async dispatch(request: ApiRequest): Promise<ApiResponse> {
      if (
        SAFE_METHODS.has(request.method.toUpperCase()) ||
        ALWAYS_AVAILABLE_PATHNAMES.has(request.pathname)
      ) {
        return app.dispatch(request);
      }
      return {
        statusCode: 503,
        body: {
          error: 'write_fence_active',
          message: 'Maintenance write fence is active; mutating requests are rejected.',
        },
        headers: { 'x-kingturf-write-fence': 'active', 'retry-after': '30' },
      };
    },
  };
}

export function writeFenceEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.KINGTURF_WRITE_FENCE === 'enabled';
}
