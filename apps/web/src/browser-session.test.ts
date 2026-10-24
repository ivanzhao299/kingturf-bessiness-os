import { afterEach, expect, it, vi } from 'vitest';
import { restoreBrowserSession } from './browser-session';
import { logoutBrowserSession } from './browser-logout';
import { authenticateBrowser } from './browser-login';
import { json, onSessionExpired, RequestError } from './http';
import { RequestError as CoreRequestError } from './http-core';
import { SessionState } from './session';
import {
  revalidateSession,
  sessionInvalidationMessage,
  SessionSignals,
  restoreCurrentSession,
} from './session-revalidation';
import { createDocumentReadService } from './shared/document-read-service';
import { sessionFixture, sessionResponse } from './test-fixtures/session';
import { readFileSync } from 'node:fs';
import { createSessionWatch, sessionMountIsCurrent } from './session-watch';

afterEach(() => {
  vi.unstubAllGlobals();
  onSessionExpired(undefined);
});
const response = (value: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(value), { status });

it('uses login context then browser login without exposing credentials in carrier/storage', async () => {
  const value = sessionResponse();
  const proof = { csrfToken: `v1.l.1.${'a'.repeat(43)}.${'b'.repeat(43)}` };
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response(proof))
    .mockResolvedValueOnce(response({ ...value, expiresAt: '2030-01-01T00:00:00.000Z' }))
    .mockResolvedValueOnce(response(value));
  const storage = { getItem: vi.fn(), setItem: vi.fn() };
  vi.stubGlobal('sessionStorage', storage);
  vi.stubGlobal('fetch', fetcher);
  await expect(authenticateBrowser('employee', 'not-a-real-password')).resolves.toBeUndefined();
  const restored = await restoreBrowserSession();
  expect(restored).toEqual(value);
  expect(fetcher.mock.calls.map((call: unknown[]) => call[0])).toEqual([
    '/api/v1/auth/login-context',
    '/api/v1/auth/login',
    '/api/v1/auth/session',
  ]);
  const options = fetcher.mock.calls.map((call: unknown[]) => call[1] as RequestInit);
  expect(new Headers(options[0]?.headers).get('x-kingturf-session-intent')).toBe('login');
  expect(new Headers(options[1]?.headers).get('x-kingturf-csrf')).toBe(proof.csrfToken);
  expect(new Headers(options[2]?.headers).get('x-kingturf-session-intent')).toBe('restore');
  for (const init of options) {
    expect(init.credentials).toBe('same-origin');
    expect(new Headers(init.headers).has('authorization')).toBe(false);
  }
  expect(storage.getItem).not.toHaveBeenCalled();
  expect(storage.setItem).not.toHaveBeenCalled();
});

it('rejects legacy token JSON rather than accepting a browser login fallback', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(response({ csrfToken: `v1.l.1.${'a'.repeat(43)}.${'b'.repeat(43)}` }))
      .mockResolvedValueOnce(response({ token: 'obsolete' })),
  );
  await expect(authenticateBrowser('employee', 'not-a-real-password')).rejects.toThrow('格式无效');
});

it('captures generation and write proof, strips caller bearer and never reads a new cookie', async () => {
  const context = sessionFixture();
  const fetcher = vi.fn().mockResolvedValue(response({}));
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('document', {
    get cookie() {
      throw new Error('Cookie read forbidden');
    },
  });
  await json('/api/v1/customers', context, {
    method: 'POST',
    headers: {
      authorization: 'Bearer obsolete',
      'x-kingturf-csrf': 'stale',
      'x-kingturf-session-generation': 'stale',
    },
    body: '{}',
  });
  const init = fetcher.mock.calls[0]?.[1] as RequestInit;
  const headers = new Headers(init.headers);
  expect(headers.has('authorization')).toBe(false);
  expect(headers.get('x-kingturf-session-generation')).toBe(context.generation);
  expect(headers.get('x-kingturf-csrf')).toBe(context.csrfToken);
});

it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
  'blocks old and paused owners before a %s write without replay',
  async (method) => {
    const context = sessionFixture();
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    context.owner.pause();
    await expect(json('/api/v1/customers', context, { method })).rejects.toMatchObject({
      status: 403,
    });
    context.owner.dispose();
    await expect(json('/api/v1/customers', context, { method })).rejects.toMatchObject({
      status: 401,
    });
    expect(fetcher).not.toHaveBeenCalled();
  },
);

it.each([200, 204])(
  'discards old success %s without notifying or completing as success',
  async (status) => {
    const old = sessionFixture();
    const expired = vi.fn();
    onSessionExpired(expired);
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
    const pending = json('/api/v1/auth/credential', old, { method: 'PUT' });
    old.owner.dispose();
    finish?.(response({}, status));
    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(expired).not.toHaveBeenCalled();
  },
);

it('discards a success whose body resolves after owner disposal', async () => {
  const context = sessionFixture();
  let finish: ((value: unknown) => void) | undefined;
  const body = new Promise<unknown>((resolve) => {
    finish = resolve;
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => body }));
  const pending = json('/api/v1/customers', context);
  await Promise.resolve();
  context.owner.dispose();
  finish?.({ items: [] });
  await expect(pending).rejects.toMatchObject({ status: 401 });
});

it('revokes logout with its captured context and never touches cookie or storage', async () => {
  const context = sessionFixture();
  const fetcher = vi.fn().mockResolvedValue(response(null, 204));
  vi.stubGlobal('fetch', fetcher);
  await logoutBrowserSession(context);
  expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/auth/logout');
  const options = fetcher.mock.calls[0]?.[1] as RequestInit;
  expect(options.method).toBe('POST');
  expect(new Headers(options.headers).get('x-kingturf-session-generation')).toBe(
    context.generation,
  );
  expect(new Headers(options.headers).get('x-kingturf-csrf')).toBe(context.csrfToken);
});

it('keeps the same context/owner/forms on unchanged focus validation, but reports identity or permission changes', async () => {
  const state = new SessionState();
  const value = sessionResponse();
  const captured = state.install(value, state.begin());
  if (!captured) throw new Error('Missing session');
  const cleanup = vi.fn();
  captured.owner.onDispose(cleanup);
  await expect(
    revalidateSession(state, captured, () => Promise.resolve({ ...value })),
  ).resolves.toBe('unchanged');
  expect(state.current).toBe(captured);
  expect(captured.owner.canWrite()).toBe(true);
  expect(cleanup).not.toHaveBeenCalled();
  await expect(
    revalidateSession(state, captured, () =>
      Promise.resolve({ ...value, permissions: ['customer:read'] }),
    ),
  ).resolves.toBe('changed');
  expect(captured.owner.canWrite()).toBe(false);
  await expect(
    revalidateSession(state, captured, () => Promise.resolve(sessionResponse('b'))),
  ).resolves.toBe('changed');
});

it('does not upgrade old closures to a replacement proof for the same identity, and has no retry loop', async () => {
  const state = new SessionState();
  const value = sessionResponse();
  const captured = state.install(value, state.begin());
  if (!captured) throw new Error('Missing session');
  const restore = vi.fn(() =>
    Promise.resolve({ ...value, csrfToken: sessionResponse('b').csrfToken }),
  );
  await expect(revalidateSession(state, captured, restore)).resolves.toBe('manual');
  expect(state.current).toBe(captured);
  expect(captured.csrfToken).toBe(value.csrfToken);
  expect(captured.owner.isCurrent()).toBe(true);
  expect(captured.owner.canWrite()).toBe(false);
  expect(restore).toHaveBeenCalledOnce();
});

it('ignores a delayed focus response after a new identity is installed', async () => {
  const state = new SessionState();
  const captured = state.install(sessionResponse(), state.begin());
  if (!captured) throw new Error('Missing session');
  let finish: ((value: ReturnType<typeof sessionResponse>) => void) | undefined;
  const pending = revalidateSession(
    state,
    captured,
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const current = state.install(sessionResponse('b'), state.begin());
  finish?.(sessionResponse());
  await expect(pending).resolves.toBe('stale');
  expect(state.current).toBe(current);
});

it('clears document caches with owner and does not let an old catch delete its replacement promise', async () => {
  const context = sessionFixture();
  let rejectOld: ((reason: Error) => void) | undefined;
  const fetcher = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((_, reject) => {
          rejectOld = reject;
        }),
    )
    .mockImplementation(() => Promise.resolve(response({ items: [] })));
  vi.stubGlobal('fetch', fetcher);
  const service = createDocumentReadService(context);
  const old = service.onlineDocumentRead('/api/v1/business-documents');
  const rejection = expect(old).rejects.toThrow('old failure');
  service.clearSessionReadCache();
  const replacement = service.onlineDocumentRead('/api/v1/business-documents');
  rejectOld?.(new Error('old failure'));
  await rejection;
  await replacement;
  expect(service.onlineDocumentRead('/api/v1/business-documents')).toBe(replacement);
  context.owner.dispose();
  expect(() => service.onlineDocumentRead('/api/v1/business-documents')).toThrow('登录状态已失效');
  const next = createDocumentReadService(sessionFixture('b'));
  const nextRequest = next.onlineDocumentRead('/api/v1/business-documents');
  expect(nextRequest).not.toBe(replacement);
  await nextRequest;
});

it('binds actual entry/bootstrap to captured contexts and only non-secret invalidation broadcasts', () => {
  const entry = readFileSync(new URL('./entry.ts', import.meta.url), 'utf8');
  const bootstrap = readFileSync(new URL('./bootstrap.ts', import.meta.url), 'utf8');
  expect(entry).not.toContain('sessionStorage.setItem');
  expect(entry).not.toContain('document.cookie');
  expect(entry).toContain('if (!sessions.isCurrent(captured)) return;');
  expect(entry).toContain('captured.session');
  expect(entry).toContain(
    'runtime.sessionMountIsCurrent(state, captured, signals, restorationRevision)',
  );
  expect(entry).toContain("postMessage('invalidate')");
  expect(bootstrap).toContain('createFetchCrmApi(context)');
  expect(bootstrap).toContain('createFetchCommercialApi(context)');
  expect(bootstrap).toContain('new GovernanceController(allPermissions, context)');
  expect(bootstrap).toContain('createDocumentReadService(context)');
  expect(bootstrap.match(/if \(!isCurrent\(\)\) return;/gu)).toHaveLength(3);
  expect(sessionInvalidationMessage('invalidate')).toBe(true);
  for (const input of [null, {}, { type: 'invalidate' }, { type: 'login' }])
    expect(sessionInvalidationMessage(input)).toBe(false);
});

it('records a notification during a pending initial restore and reads current identity once more', async () => {
  const signals = new SessionSignals();
  let finish: ((value: ReturnType<typeof sessionResponse>) => void) | undefined;
  const restore = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockImplementationOnce(() => Promise.resolve(sessionResponse('b')));
  const pending = restoreCurrentSession(signals, restore);
  signals.notify();
  finish?.(sessionResponse());
  const result = await pending;
  expect(result.value.generation).toBe(sessionResponse('b').generation);
  expect(signals.revision === result.revision).toBe(true);
  expect(restore).toHaveBeenCalledTimes(2);
});

it('does not resume a captured owner after a newer notification during revalidation', async () => {
  const state = new SessionState();
  const signals = new SessionSignals();
  const captured = state.install(sessionResponse(), state.begin());
  if (!captured) throw new Error('Missing session');
  const revision = signals.revision;
  let finish: ((value: ReturnType<typeof sessionResponse>) => void) | undefined;
  const pending = revalidateSession(
    state,
    captured,
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    () => signals.revision === revision,
  );
  signals.notify();
  finish?.(sessionResponse());
  await expect(pending).resolves.toBe('stale');
  expect(captured.owner.canWrite()).toBe(false);
});

it('bounds repeated dirty restore and never replays a write', async () => {
  const signals = new SessionSignals();
  const restore = vi.fn(() => {
    signals.notify();
    return Promise.resolve(sessionResponse());
  });
  await expect(restoreCurrentSession(signals, restore)).rejects.toThrow('Session changed');
  expect(restore).toHaveBeenCalledTimes(2);
});

it('marks a new context as unmountable when another notification arrives during nested bootstrap loading', () => {
  const state = new SessionState();
  const signals = new SessionSignals();
  const captured = state.install(sessionResponse('b'), state.begin());
  if (!captured) throw new Error('Missing session');
  const revision = signals.revision;
  expect(sessionMountIsCurrent(state, captured, signals, revision)).toBe(true);
  signals.notify();
  expect(state.isCurrent(captured)).toBe(true);
  expect(sessionMountIsCurrent(state, captured, signals, revision)).toBe(false);
});

it('keeps login-required/interactive form intact on focus and visibility notifications', () => {
  const entry = readFileSync(new URL('./entry.ts', import.meta.url), 'utf8');
  const listener = entry.slice(
    entry.indexOf('const check = () =>'),
    entry.indexOf("globalThis.addEventListener('focus'"),
  );
  expect(listener).toContain('signals.notify()');
  expect(listener).toContain('if (sessions?.current)');
  expect(listener).not.toContain('bootstrap(');
  const migration = entry.slice(
    entry.indexOf('if (!migrationChecked)'),
    entry.indexOf("startupView(root, '正在验证登录状态…')"),
  );
  expect(migration).toContain('clearLegacySession(sessionStorage)');
  expect(migration).toContain("loginView(root, '登录方式已更新，请重新登录')");
  expect(migration).toContain('return;');
});

function watchFixture() {
  const state = new SessionState();
  const context = state.install(sessionResponse(), state.begin());
  if (!context) throw new Error('Missing session');
  const reload = vi.fn();
  const expired = vi.fn();
  const root = { querySelector: () => null, prepend: vi.fn() };
  vi.stubGlobal('document', {
    createElement: () => ({
      dataset: {},
      setAttribute: vi.fn(),
      addEventListener: vi.fn(),
      append: vi.fn(),
    }),
  });
  const signals = new SessionSignals();
  const watch = createSessionWatch(root as unknown as HTMLElement, state, signals, reload, expired);
  return { state, context, signals, watch, root, reload, expired };
}

it('reloads only on confirmed identity/permission change, not an unchanged focus check', async () => {
  const f = watchFixture();
  const fetcher = vi
    .fn()
    .mockImplementationOnce(() => Promise.resolve(response(sessionResponse())))
    .mockImplementationOnce(() =>
      Promise.resolve(response({ ...sessionResponse(), permissions: ['customer:read'] })),
    );
  vi.stubGlobal('fetch', fetcher);
  await f.watch.check();
  expect(f.state.current).toBe(f.context);
  expect(f.context.owner.canWrite()).toBe(true);
  expect(f.reload).not.toHaveBeenCalled();
  await f.watch.check();
  expect(f.reload).toHaveBeenCalledOnce();
  expect(f.context.owner.isCurrent()).toBe(false);
  expect(f.state.current).toBeNull();
});

it('invalidates current 401, but neither network failure nor an old delayed 401 reloads a new UI', async () => {
  const f = watchFixture();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')));
  await f.watch.check();
  expect(f.reload).not.toHaveBeenCalled();
  expect(f.expired).not.toHaveBeenCalled();
  expect(f.root.prepend).toHaveBeenCalledOnce();
  expect(f.context.owner.canWrite()).toBe(false);
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
  const pending = f.watch.check();
  const current = f.state.install(sessionResponse('b'), f.state.begin());
  finish?.(response({}, 401));
  await pending;
  expect(f.state.current).toBe(current);
  expect(f.expired).not.toHaveBeenCalled();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => Promise.resolve(response({}, 401))),
  );
  await f.watch.check();
  expect(f.expired).toHaveBeenCalledOnce();
  expect(f.state.current).toBeNull();
});

it('retains a notification/local late-login signal while watch is busy and performs only one fresh read', async () => {
  const f = watchFixture();
  let finish: ((value: Response) => void) | undefined;
  const fetcher = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    )
    .mockImplementationOnce(() => Promise.resolve(response(sessionResponse('b'))));
  vi.stubGlobal('fetch', fetcher);
  const pending = f.watch.check();
  f.signals.notify();
  await f.watch.check();
  expect(fetcher).toHaveBeenCalledOnce();
  finish?.(response(sessionResponse()));
  await pending;
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(f.reload).toHaveBeenCalledOnce();
  expect(f.state.current).toBeNull();
});

it('does not turn initial restore 401 into reload or an expiry callback loop', async () => {
  expect(RequestError).toBe(CoreRequestError);
  const expired = vi.fn();
  onSessionExpired(expired);
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response({}, 401)));
  vi.stubGlobal('fetch', fetcher);
  await expect(restoreBrowserSession()).rejects.toMatchObject({ status: 401 });
  expect(fetcher).toHaveBeenCalledOnce();
  expect(expired).not.toHaveBeenCalled();
  const entry = readFileSync(new URL('./entry.ts', import.meta.url), 'utf8');
  const branch = entry.slice(
    entry.indexOf('if (error instanceof RequestError && error.status === 401)'),
    entry.indexOf('const captured = context;'),
  );
  expect(branch).toContain('loginView(root');
  expect(branch).not.toContain('reload(');
  const failure = readFileSync(new URL('./startup-failure.ts', import.meta.url), 'utf8');
  expect(failure).toContain('expireSession(captured, state, invalidated)');
});

it.each([
  { generation: undefined },
  { generation: 1 },
  { generation: '' },
  { csrfToken: undefined },
  { csrfToken: 1 },
  { csrfToken: '' },
  { csrfToken: `v1.l.1.${'a'.repeat(43)}.${'b'.repeat(43)}` },
  { token: 'obsolete' },
  { tokenHash: 'not-a-real-hash' },
])(
  'rejects malformed restore metadata instead of installing an unverified context %#',
  async (fields) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() => Promise.resolve(response({ ...sessionResponse(), ...fields }))),
    );
    await expect(restoreBrowserSession()).rejects.toThrow('格式无效');
  },
);

it('ties both lazy failure callbacks to navigation ownership, including return-to-login', () => {
  const entry = readFileSync(new URL('./entry.ts', import.meta.url), 'utf8');
  const view = entry.slice(
    entry.indexOf('function startupFailureView'),
    entry.indexOf('function loginView'),
  );
  expect(view.match(/startupEpoch \+= 1;/gu)).toHaveLength(2);
  expect(view).toContain('if (startupEpoch !== epoch) return;');
  expect(view.indexOf('startupEpoch += 1;')).toBeLessThan(view.indexOf('loginView(root)'));
  expect(view).not.toContain('.catch(fallback)');
  expect(view).toContain('notifyAndReload');
});
