import { describe, expect, it, vi } from 'vitest';
import { expireSession, clearLegacySession, SessionState } from './session';
import { sessionResponse } from './test-fixtures/session';

describe('expired session navigation', () => {
  it('invalidates only the current owner and returns to login once without storage writes', () => {
    const state = new SessionState();
    const current = state.install(sessionResponse(), state.begin());
    const expired = vi.fn();
    expect(expireSession(current, state, expired)).toBe(true);
    expect(current?.owner.isCurrent()).toBe(false);
    expect(state.current).toBeNull();
    expect(expired).toHaveBeenCalledOnce();
    expect(expireSession(current, state, expired)).toBe(false);
    expect(expired).toHaveBeenCalledOnce();
  });
  it('ignores delayed failures from an earlier identity and unauthenticated requests', () => {
    const state = new SessionState();
    const old = state.install(sessionResponse(), state.begin());
    const current = state.install(sessionResponse('b'), state.begin());
    const expired = vi.fn();
    expect(expireSession(old, state, expired)).toBe(false);
    expect(expireSession(null, state, expired)).toBe(false);
    expect(state.current).toBe(current);
    expect(current?.owner.isCurrent()).toBe(true);
    expect(expired).not.toHaveBeenCalled();
  });
  it('checks legacy key presence only, clears both keys and never exchanges a value', () => {
    const storage = { getItem: vi.fn<(_: string) => string | null>(() => ''), removeItem: vi.fn() };
    expect(clearLegacySession(storage)).toBe(true);
    expect(storage.getItem.mock.calls).toHaveLength(2);
    expect(storage.removeItem.mock.calls).toEqual([
      ['kingturf.session'],
      ['kingturf.sessionExpired'],
    ]);
    storage.getItem.mockReturnValue(null);
    expect(clearLegacySession(storage)).toBe(false);
  });
  it('rejects a late installation and disposes prior resources once even for the same account', () => {
    const state = new SessionState();
    const firstEpoch = state.begin();
    const first = state.install(sessionResponse(), firstEpoch);
    const cleanup = vi.fn();
    first?.owner.onDispose(cleanup);
    const nextEpoch = state.begin();
    expect(state.install(sessionResponse(), firstEpoch)).toBeNull();
    const next = state.install(sessionResponse('b'), nextEpoch);
    if (!next) throw new Error('Missing current session');
    expect(first?.owner.isCurrent()).toBe(false);
    expect(state.isCurrent(next)).toBe(true);
    first?.owner.dispose();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.session.permissions)).toBe(true);
  });
});
