import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, onSessionExpired, RequestError } from './http';

afterEach(() => {
  onSessionExpired(undefined);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('bounded JSON exchange', () => {
  it('preserves auth, correlation and idempotency headers without adding a GET content type', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"ok":true}'));
    vi.stubGlobal('fetch', fetcher);
    await expect(
      json('/test', 'session', { headers: { 'idempotency-key': 'command-1' } }),
    ).resolves.toEqual({ ok: true });
    const options = fetcher.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(options.headers);
    expect(headers.get('authorization')).toBe('Bearer session');
    expect(headers.get('idempotency-key')).toBe('command-1');
    expect(headers.get('x-correlation-id')).toBeTruthy();
    expect(headers.has('content-type')).toBe(false);
    expect(options.credentials).toBe('same-origin');
  });

  it('handles empty responses and preserves structured errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(
          new Response('{"error":{"message":"denied","correlationId":"ref-1"}}', { status: 403 }),
        ),
    );
    await expect(json('/test', '')).resolves.toBeUndefined();
    await expect(json('/test', '')).rejects.toMatchObject({
      name: 'RequestError',
      status: 403,
      message: 'denied',
      correlationId: 'ref-1',
    });
  });

  it('keeps HTTP status when a gateway returns HTML rather than JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })),
    );
    await expect(json('/test', '')).rejects.toBeInstanceOf(RequestError);
    await expect(json('/test', '')).rejects.toMatchObject({ status: 502 });
  });

  for (const status of [200, 503]) {
    it(`times out a stalled ${String(status)} response body after headers arrive`, async () => {
      vi.useFakeTimers();
      vi.stubGlobal('fetch', (_path: string, init: RequestInit) =>
        Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                init.signal?.addEventListener(
                  'abort',
                  () => {
                    controller.error(init.signal?.reason);
                  },
                  { once: true },
                );
              },
            }),
            { status },
          ),
        ),
      );
      const assertion = expect(json('/test', '')).rejects.toThrow('请求超时，请检查网络后重试');
      await vi.advanceTimersByTimeAsync(15_000);
      await assertion;
      expect(vi.getTimerCount()).toBe(0);
    });
  }

  it('forwards cancellation and removes external listeners after success or failure', async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    await json('/test', '', { signal: controller.signal });
    expect(remove).toHaveBeenCalledOnce();
    controller.abort(new Error('user cancelled'));
    vi.stubGlobal('fetch', (_path: string, init: RequestInit) =>
      Promise.reject(init.signal?.reason as Error),
    );
    await expect(json('/test', '', { signal: controller.signal })).rejects.toThrow(
      'user cancelled',
    );
    expect(remove).toHaveBeenCalledTimes(2);
  });
});

describe('session expiry notifications', () => {
  it('notifies on protected 401, but not login rejection or permission denial', async () => {
    const expired = vi.fn();
    onSessionExpired(expired);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('<html>unauthorized</html>', { status: 401 }))
        .mockResolvedValueOnce(new Response('{}', { status: 401 }))
        .mockResolvedValueOnce(new Response('{}', { status: 403 })),
    );
    await expect(json('/api/v1/auth/session', 'old-session')).rejects.toMatchObject({
      status: 401,
    });
    await expect(json('/api/v1/auth/login', '')).rejects.toMatchObject({ status: 401 });
    await expect(json('/api/v1/employees', 'current-session')).rejects.toMatchObject({
      status: 403,
    });
    expect(expired.mock.calls).toEqual([['old-session']]);
  });
  it('notifies immediately after successful self password change, not an admin reset', async () => {
    const expired = vi.fn();
    onSessionExpired(expired);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await json('/api/v1/auth/credential', 'self', { method: 'PUT', body: '{}' });
    await json('/api/v1/employees/target/identity', 'admin', { method: 'PUT', body: '{}' });
    expect(expired.mock.calls).toEqual([['self']]);
  });
});
