import { describe, expect, it, vi } from 'vitest';
import { expireSession } from './session';

describe('expired session navigation', () => {
  function fixture(token: string) {
    const values = new Map([['kingturf.session', token]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
    return { values, storage, reload: vi.fn() };
  }
  it('clears the current token and returns to login with expiry feedback once', () => {
    const { storage, values, reload } = fixture('old');
    expect(expireSession('old', storage, reload)).toBe(true);
    expect(values.has('kingturf.session')).toBe(false);
    expect(values.get('kingturf.sessionExpired')).toBe('1');
    expect(reload).toHaveBeenCalledOnce();
    expect(expireSession('old', storage, reload)).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });
  it('ignores delayed failures from an earlier token and unauthenticated requests', () => {
    const { storage, values, reload } = fixture('new');
    expect(expireSession('old', storage, reload)).toBe(false);
    expect(expireSession('', storage, reload)).toBe(false);
    expect(values.get('kingturf.session')).toBe('new');
    expect(reload).not.toHaveBeenCalled();
  });
});
