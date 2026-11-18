import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mustChangeRequired, renderMustChangeScreen } from './must-change-screen';
import type { SessionContext } from './session';
import {
  BehaviorElement,
  BehaviorInput,
  createBehaviorElement,
  findElement,
  flushBehaviorPromises,
  htmlElement,
} from '../test/fixtures/behavior-dom';

const context = () =>
  ({
    session: {
      employeeId: 'employee',
      companyId: 'company',
      displayName: null,
      employeeNumber: null,
      permissions: [],
      credentialState: 'MUST_CHANGE',
    },
    generation: 'g'.repeat(43),
    csrfToken: 'v1.s.'.padEnd(10, 'x'),
    owner: { isCurrent: () => true, canWrite: () => true, onDispose: () => undefined },
    epoch: 1,
  }) as unknown as SessionContext;

const setup = () => {
  const host = createBehaviorElement('main');
  const done = vi.fn();
  renderMustChangeScreen(htmlElement(host), context(), done);
  const form = findElement(host, (node) => node.tagName === 'FORM');
  const field = (name: string) => findElement(form, (node) => node.getAttribute('name') === name);
  return {
    host,
    done,
    send: () => form.dispatchEvent(new Event('submit', { cancelable: true })),
    current: field('currentPassword'),
    next: field('password'),
    confirm: field('passwordConfirm'),
    submit: findElement(form, (node) => node.tagName === 'BUTTON' && node.type === 'submit'),
    status: findElement(form, (node) => node.classList.contains('login-status')),
  };
};

describe('must-change screen behavior (A1)', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { createElement: createBehaviorElement });
    vi.stubGlobal('HTMLElement', BehaviorElement);
    vi.stubGlobal('HTMLInputElement', BehaviorInput);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('requires matching 12+ character passwords before any request', () => {
    const f = setup();
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    f.current.value = 'temp';
    f.next.value = 'short';
    f.confirm.value = 'short';
    f.send();
    expect(f.status.textContent).toContain('至少需要 12 位');
    f.next.value = 'Fresh-Owned-Pass-2026';
    f.confirm.value = 'Fresh-Other-Pass-2026';
    f.send();
    expect(f.status.textContent).toContain('不一致');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('submits PUT /auth/credential with an idempotency key and relogin guidance on success', async () => {
    const f = setup();
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    f.current.value = 'Fresh-Temp-Pass-2026';
    f.next.value = 'Fresh-Owned-Pass-2026';
    f.confirm.value = 'Fresh-Owned-Pass-2026';
    f.send();
    await flushBehaviorPromises();
    expect(fetcher).toHaveBeenCalledOnce();
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/api/v1/auth/credential');
    expect(init.method).toBe('PUT');
    expect(new Headers(init.headers).has('idempotency-key')).toBe(true);
    expect(f.done).toHaveBeenCalledOnce();
    expect(f.status.textContent).toContain('密码已更新，请重新登录');
  });

  it('shows the server rejection and re-enables retry without done()', async () => {
    const f = setup();
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'forbidden', message: 'Current password is incorrect' },
        }),
        { status: 403 },
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    f.current.value = 'wrong';
    f.next.value = 'Fresh-Owned-Pass-2026';
    f.confirm.value = 'Fresh-Owned-Pass-2026';
    f.send();
    await flushBehaviorPromises();
    await flushBehaviorPromises();
    expect(f.status.textContent).toContain('Current password is incorrect');
    expect(f.submit.disabled).toBe(false);
    expect(f.done).not.toHaveBeenCalled();
  });

  it('detects MUST_CHANGE sessions only', () => {
    expect(mustChangeRequired({ credentialState: 'MUST_CHANGE' })).toBe(true);
    expect(mustChangeRequired({ credentialState: 'OK' })).toBe(false);
    expect(mustChangeRequired({})).toBe(false);
  });
});
