import { describe, expect, it } from 'vitest';
import type { ApiApplication, ApiRequest, ApiResponse } from '../src/api-types.ts';
import { applyWriteFence, writeFenceEnabled } from '../src/middleware/write-fence.ts';

const passthrough: ApiApplication = {
  dispatch(request: ApiRequest): Promise<ApiResponse> {
    return Promise.resolve({ statusCode: 200, body: { echo: request.pathname } });
  },
  rejectOversized(): ApiResponse {
    return { statusCode: 413, body: { error: 'payload_too_large' } };
  },
};

const request = (method: string, pathname: string): ApiRequest => ({ method, pathname });

describe('maintenance write fence', () => {
  it('is disabled unless the environment explicitly enables it', () => {
    expect(writeFenceEnabled({})).toBe(false);
    expect(writeFenceEnabled({ KINGTURF_WRITE_FENCE: 'disabled' })).toBe(false);
    expect(writeFenceEnabled({ KINGTURF_WRITE_FENCE: 'enabled' })).toBe(true);
    expect(writeFenceEnabled({ KINGTURF_WRITE_FENCE: 'true' })).toBe(false);
  });

  it('passes every request through unchanged when disabled', async () => {
    const fenced = applyWriteFence(passthrough, false);
    await expect(fenced.dispatch(request('POST', '/api/customers'))).resolves.toEqual({
      statusCode: 200,
      body: { echo: '/api/customers' },
    });
  });

  it('rejects mutating requests with 503 while enabled', async () => {
    const fenced = applyWriteFence(passthrough, true);
    const response = await fenced.dispatch(request('POST', '/api/customers'));
    expect(response.statusCode).toBe(503);
    const body = response.body as { error: string; message: string };
    expect(body.error).toBe('write_fence_active');
    expect(body.message.length).toBeGreaterThan(0);
    expect(response.headers).toMatchObject({ 'x-kingturf-write-fence': 'active' });
  });

  it('still rejects reads by lowercase method names the same way', async () => {
    const fenced = applyWriteFence(passthrough, true);
    await expect(fenced.dispatch(request('post', '/api/customers'))).resolves.toMatchObject({
      statusCode: 503,
    });
    await expect(fenced.dispatch(request('get', '/api/customers'))).resolves.toMatchObject({
      statusCode: 200,
    });
  });

  it('keeps read-only methods and liveness endpoints available while enabled', async () => {
    const fenced = applyWriteFence(passthrough, true);
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      await expect(fenced.dispatch(request(method, '/api/customers'))).resolves.toMatchObject({
        statusCode: 200,
      });
    }
    for (const pathname of ['/health', '/ready', '/version']) {
      await expect(fenced.dispatch(request('GET', pathname))).resolves.toMatchObject({
        statusCode: 200,
      });
    }
  });

  it('keeps non-dispatch surface of the wrapped application intact', () => {
    const fenced = applyWriteFence(passthrough, true);
    expect(fenced.rejectOversized('corr')).toEqual({
      statusCode: 413,
      body: { error: 'payload_too_large' },
    });
  });
});
