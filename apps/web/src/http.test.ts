import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, onSessionExpired, RequestError } from './http';
import { sessionFixture, sessionResponse } from './test-fixtures/session';
import { SessionState, expireSession } from './session';
const context = sessionFixture();
const oldContext = sessionFixture('b');
const currentContext = sessionFixture('c');
const selfContext = sessionFixture('d');
const adminContext = sessionFixture('e');

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
      json('/test', context, { headers: { 'idempotency-key': 'command-1' } }),
    ).resolves.toEqual({ ok: true });
    const options = fetcher.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(options.headers);
    expect(headers.has('authorization')).toBe(false);
    expect(headers.get('x-kingturf-session-generation')).toBe(context.generation);
    expect(headers.has('x-kingturf-csrf')).toBe(false);
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
    await expect(json('/test', null)).resolves.toBeUndefined();
    await expect(json('/test', null)).rejects.toMatchObject({
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
    await expect(json('/test', null)).rejects.toBeInstanceOf(RequestError);
    await expect(json('/test', null)).rejects.toMatchObject({ status: 502 });
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
      const assertion = expect(json('/test', null)).rejects.toThrow('请求超时，请检查网络后重试');
      await vi.advanceTimersByTimeAsync(15_000);
      await assertion;
      expect(vi.getTimerCount()).toBe(0);
    });
  }

  it('forwards cancellation and removes external listeners after success or failure', async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    await json('/test', null, { signal: controller.signal });
    expect(remove).toHaveBeenCalledOnce();
    controller.abort(new Error('user cancelled'));
    vi.stubGlobal('fetch', (_path: string, init: RequestInit) =>
      Promise.reject(init.signal?.reason as Error),
    );
    await expect(json('/test', null, { signal: controller.signal })).rejects.toThrow(
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
    await expect(json('/api/v1/auth/session', oldContext)).rejects.toMatchObject({
      status: 401,
    });
    await expect(json('/api/v1/auth/login', null)).rejects.toMatchObject({ status: 401 });
    await expect(json('/api/v1/employees', currentContext)).rejects.toMatchObject({
      status: 403,
    });
    expect(expired.mock.calls).toEqual([[oldContext]]);
  });
  it('notifies immediately after successful self password change, not an admin reset', async () => {
    const expired = vi.fn();
    onSessionExpired(expired);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await json('/api/v1/auth/credential', selfContext, { method: 'PUT', body: '{}' });
    await json('/api/v1/employees/target/identity', adminContext, { method: 'PUT', body: '{}' });
    expect(expired.mock.calls).toEqual([[selfContext]]);
  });
});

describe('explicit logout while business writes are paused', () => {
  it('sends only the exact current POST logout with captured proof and keeps the owner paused', async () => {
    const paused = sessionFixture('p');
    paused.owner.pause();
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(json('/api/v1/auth/logout', paused, { method: 'POST' })).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledOnce();
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(init.credentials).toBe('same-origin');
    expect(new Headers(init.headers).get('x-kingturf-csrf')).toBe(paused.csrfToken);
    expect(new Headers(init.headers).get('x-kingturf-session-generation')).toBe(paused.generation);
    expect(paused.owner.canWrite()).toBe(false);
  });
  for (const [path, method] of [
    ['/api/v1/employees', 'POST'],
    ['/api/v1/auth/credential', 'PUT'],
    ['/api/v1/auth/logout?x=1', 'POST'],
    ['/api/v1/auth/logout/', 'POST'],
    ['/api/v1/auth/logout', 'PUT'],
    ['/api/v1/auth/logout', 'post'],
  ] as const)
    it(`does not send paused ${method} ${path}`, async () => {
      const paused = sessionFixture('p');
      paused.owner.pause();
      const fetcher = vi.fn();
      vi.stubGlobal('fetch', fetcher);
      await expect(json(path, paused, { method })).rejects.toMatchObject({ status: 403 });
      expect(fetcher).not.toHaveBeenCalled();
    });
  it('never sends a disposed logout', async () => {
    const disposed = sessionFixture('p');
    disposed.owner.dispose();
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(json('/api/v1/auth/logout', disposed, { method: 'POST' })).rejects.toMatchObject({
      status: 401,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not let late A logout success clear or reload B', async () => {
    const state = new SessionState();
    const a = state.install(sessionResponse('a'), state.begin());
    if (!a) throw new Error('Missing test context');
    a.owner.pause();
    let finish: ((value: Response) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const reload = vi.fn();
    const pending = json('/api/v1/auth/logout', a, { method: 'POST' }).then(() =>
      expireSession(a, state, reload),
    );
    const b = state.install(sessionResponse('b'), state.begin());
    finish?.(new Response(null, { status: 204 }));
    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(reload).not.toHaveBeenCalled();
    expect(state.current).toBe(b);
    expect(b?.owner.canWrite()).toBe(true);
  });
});
