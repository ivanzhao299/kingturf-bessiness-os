import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_LOGIN_RATE_LIMIT, type LoginRateLimitConfig } from '@kingturf/config';
import { LoginRateLimiter } from '../src/middleware/login-rate-limit.js';

function setup(options: Partial<LoginRateLimitConfig> = {}) {
  let time = 0;
  const delays: number[] = [];
  const limiter = new LoginRateLimiter(
    { ...DEFAULT_LOGIN_RATE_LIMIT, ...options },
    () => time,
    (delay) => {
      delays.push(delay);
      return Promise.resolve();
    },
  );
  const attempt = <T>(login: string, ip: string, auth: () => Promise<T | null>) =>
    limiter.attempt(login, ip, undefined, auth);
  return {
    limiter,
    delays,
    attempt,
    setTime: (value: number) => {
      time = value;
    },
  };
}
const failure = () => Promise.resolve(null);
const success = () => Promise.resolve('synthetic-success');
const tick = async () => {
  for (let index = 0; index < 20; index++) await Promise.resolve();
};
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('D1 S2 independent login windows', () => {
  it('admits exactly ten actual failures, caps progressive waits, and does not renew on 429', async () => {
    const f = setup();
    const auth = vi.fn(failure);
    for (let index = 0; index < 10; index++)
      expect((await f.attempt('account', '198.51.100.1', auth)).kind).toBe('authenticated');
    expect(f.delays).toEqual([100, 200, 400, 800, 1000, 1000, 1000, 1000, 1000, 1000]);
    expect(await f.attempt('account', '198.51.100.1', auth)).toEqual({
      kind: 'limited',
      retryAfter: 900,
    });
    f.setTime(899_999);
    expect(await f.attempt('account', '198.51.100.1', auth)).toEqual({
      kind: 'limited',
      retryAfter: 1,
    });
    f.setTime(900_000);
    expect(await f.attempt('account', '198.51.100.1', auth)).toEqual({
      kind: 'authenticated',
      value: null,
    });
    expect(auth).toHaveBeenCalledTimes(11);
    expect(f.delays.at(-1)).toBe(100);
  });
  it('uses failure completion time and the later of two independent recovery times', async () => {
    const f = setup();
    for (let index = 0; index < 10; index++)
      await f.attempt('a', '198.51.100.1', () => {
        f.setTime(2000);
        return failure();
      });
    f.setTime(900_000);
    expect(await f.attempt('a', '198.51.100.1', success)).toEqual({
      kind: 'limited',
      retryAfter: 2,
    });
    f.setTime(902_000);
    expect((await f.attempt('a', '198.51.100.1', success)).kind).toBe('authenticated');
    const second = setup();
    for (let index = 0; index < 10; index++) await second.attempt('a', '198.51.100.1', failure);
    second.setTime(1000);
    for (let index = 0; index < 10; index++) await second.attempt('b', '198.51.100.2', failure);
    expect(await second.attempt('a', '198.51.100.2', success)).toEqual({
      kind: 'limited',
      retryAfter: 900,
    });
  });
  it('does not count successes or exceptions, and success never clears nine failures', async () => {
    const f = setup();
    for (let index = 0; index < 9; index++) await f.attempt('a', '198.51.100.1', failure);
    for (let index = 0; index < 11; index++) await f.attempt('a', '198.51.100.1', success);
    await expect(
      f.attempt('a', '198.51.100.1', () => {
        throw new Error('synthetic sync');
      }),
    ).rejects.toThrow('synthetic sync');
    await expect(
      f.attempt('a', '198.51.100.1', () => Promise.reject(new Error('synthetic async'))),
    ).rejects.toThrow('synthetic async');
    expect((await f.attempt('a', '198.51.100.1', failure)).kind).toBe('authenticated');
    expect((await f.attempt('a', '198.51.100.1', success)).kind).toBe('limited');
    expect(f.delays).toHaveLength(10);
    expect(f.limiter.statistics.pending).toBe(0);
  });
  it('enforces each dimension independently and shares normalized account keys', async () => {
    const f = setup();
    for (let index = 0; index < 10; index++) await f.attempt(' User ', '198.51.100.1', failure);
    expect((await f.attempt('USER', '198.51.100.2', success)).kind).toBe('limited');
    expect((await f.attempt('other', '198.51.100.1', success)).kind).toBe('limited');
    expect((await f.attempt('other', '198.51.100.2', success)).kind).toBe('authenticated');
  });
  it('only counts returned null, not arbitrary falsy generic values', async () => {
    const f = setup();
    for (let index = 0; index < 11; index++)
      await f.attempt('a', '198.51.100.1', () => Promise.resolve(false));
    expect(f.delays).toEqual([]);
    expect(f.limiter.statistics).toEqual({ buckets: 0, pending: 0 });
  });
  it('does not retain clean successful buckets', async () => {
    const f = setup({ maxBuckets: 2 });
    for (let index = 0; index < 30; index++)
      await f.attempt(String(index), '198.51.100.1', success);
    expect(f.limiter.statistics).toEqual({ buckets: 0, pending: 0 });
  });
  it('does not evict active failure buckets to admit a new identity; expires and recovers', async () => {
    const f = setup({ maxBuckets: 2 });
    await f.attempt('a', '198.51.100.1', failure);
    const auth = vi.fn(success);
    expect(await f.attempt('b', '198.51.100.2', auth)).toEqual({ kind: 'unavailable' });
    expect(auth).not.toHaveBeenCalled();
    expect(f.limiter.statistics.buckets).toBe(2);
    f.setTime(900_000);
    expect((await f.attempt('b', '198.51.100.2', auth)).kind).toBe('authenticated');
  });
  it('supports explicit rollback without counting, resolving proxy headers or delaying', async () => {
    const f = setup({ enabled: false });
    for (let index = 0; index < 12; index++) await f.attempt('a', 'invalid peer', failure);
    expect(f.delays).toEqual([]);
    expect(f.limiter.statistics).toEqual({ buckets: 0, pending: 0 });
  });
});

describe('D1 S2 serialized admission and bounded queues', () => {
  it.each([true, false])(
    'does not reset nine failures when success and failure interleave (%s)',
    async (successFirst) => {
      const f = setup();
      for (let index = 0; index < 9; index++) await f.attempt('a', '198.51.100.1', failure);
      const good = vi.fn(success),
        bad = vi.fn(failure);
      const calls = successFirst ? [good, bad, good] : [bad, good, bad];
      const decisions = await Promise.all(
        calls.map((call) => f.attempt('a', '198.51.100.1', call)),
      );
      expect(decisions.map((decision) => decision.kind)).toEqual(
        successFirst
          ? ['authenticated', 'authenticated', 'limited']
          : ['authenticated', 'limited', 'limited'],
      );
      expect(bad).toHaveBeenCalledOnce();
      expect(good).toHaveBeenCalledTimes(successFirst ? 1 : 0);
    },
  );
  it('releases an exceptional operation to already queued callers and completes crossed key pairs', async () => {
    const f = setup();
    const gate = deferred<undefined>();
    const first = f.attempt('a', '198.51.100.1', async () => {
      await gate.promise;
      throw new Error('synthetic rejection');
    });
    const rejected = expect(first).rejects.toThrow('synthetic rejection');
    const sameIp = vi.fn(success),
      sameAccount = vi.fn(success),
      crossed = vi.fn(success);
    const rest = [
      f.attempt('b', '198.51.100.1', sameIp),
      f.attempt('a', '198.51.100.2', sameAccount),
      f.attempt('b', '198.51.100.2', crossed),
    ];
    await tick();
    expect(sameIp).not.toHaveBeenCalled();
    expect(sameAccount).not.toHaveBeenCalled();
    expect(crossed).not.toHaveBeenCalled();
    gate.resolve(undefined);
    await rejected;
    expect((await Promise.all(rest)).every((decision) => decision.kind === 'authenticated')).toBe(
      true,
    );
    expect(f.limiter.statistics).toEqual({ buckets: 0, pending: 0 });
  });
  it('eleven simultaneous failures reach authentication only ten times', async () => {
    const f = setup();
    const auth = vi.fn(failure);
    const decisions = await Promise.all(
      Array.from({ length: 11 }, () => f.attempt('a', '198.51.100.1', auth)),
    );
    expect(auth).toHaveBeenCalledTimes(10);
    expect(decisions.filter((value) => value.kind === 'limited')).toHaveLength(1);
    expect(f.limiter.statistics.pending).toBe(0);
  });
  it('eleven simultaneous successes are not mistaken for failed reservations', async () => {
    const f = setup();
    const auth = vi.fn(success);
    const decisions = await Promise.all(
      Array.from({ length: 11 }, () => f.attempt('a', '198.51.100.1', auth)),
    );
    expect(auth).toHaveBeenCalledTimes(11);
    expect(decisions.every((value) => value.kind === 'authenticated')).toBe(true);
    expect(f.delays).toEqual([]);
  });
  it('serializes shared IP across accounts and shared account across IPs without deadlock', async () => {
    const f = setup();
    let active = 0;
    let maximum = 0;
    const auth = async () => {
      active++;
      maximum = Math.max(maximum, active);
      await tick();
      active--;
      return null;
    };
    await Promise.all(
      Array.from({ length: 11 }, (_, index) =>
        f.attempt('a' + String(index), '198.51.100.1', auth),
      ),
    );
    expect(maximum).toBe(1);
    const account = setup();
    const calls = vi.fn(failure);
    const results = await Promise.all(
      Array.from({ length: 11 }, (_, index) =>
        account.attempt('a', '198.51.100.' + String(index + 1), calls),
      ),
    );
    expect(calls).toHaveBeenCalledTimes(10);
    expect(results.filter((value) => value.kind === 'limited')).toHaveLength(1);
  });
  it('allows different account and IP pairs to authenticate concurrently', async () => {
    const f = setup();
    const gate = deferred<string>();
    const first = vi.fn(() => gate.promise);
    const second = vi.fn(() => gate.promise);
    const a = f.attempt('a', '198.51.100.1', first);
    const b = f.attempt('b', '198.51.100.2', second);
    await tick();
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    gate.resolve('success');
    await Promise.all([a, b]);
  });
  it('bounds accepted requests including waiters, keeps live locks across sweeps, and recovers', async () => {
    const f = setup({ maxPending: 2 });
    const gate = deferred<string>();
    const first = f.attempt('a', '198.51.100.1', () => gate.promise);
    const queuedAuth = vi.fn(success);
    const second = f.attempt('a', '198.51.100.1', queuedAuth);
    await tick();
    f.setTime(900_000);
    const extra = vi.fn(success);
    expect(await f.attempt('b', '198.51.100.2', extra)).toEqual({ kind: 'unavailable' });
    expect(extra).not.toHaveBeenCalled();
    expect(queuedAuth).not.toHaveBeenCalled();
    expect(f.limiter.statistics).toEqual({ buckets: 2, pending: 2 });
    gate.resolve('success');
    await Promise.all([first, second]);
    expect((await f.attempt('b', '198.51.100.2', extra)).kind).toBe('authenticated');
  });
  it('keeps failure backoff inside both locks, even when another reservation sweeps', async () => {
    const gate = deferred<undefined>();
    const wait = vi.fn(() => gate.promise);
    let time = 0;
    const limiter = new LoginRateLimiter(DEFAULT_LOGIN_RATE_LIMIT, () => time, wait);
    const first = limiter.attempt('a', '198.51.100.1', undefined, failure);
    const auth = vi.fn(success);
    const second = limiter.attempt('b', '198.51.100.1', undefined, auth);
    await tick();
    expect(wait).toHaveBeenCalledWith(100);
    time = 900_000;
    await limiter.attempt('c', '198.51.100.2', undefined, success);
    expect(auth).not.toHaveBeenCalled();
    gate.resolve(undefined);
    await Promise.all([first, second]);
    expect(auth).toHaveBeenCalledOnce();
  });
  it('releases both locks when the injected wait rejects', async () => {
    const limiter = new LoginRateLimiter(
      DEFAULT_LOGIN_RATE_LIMIT,
      () => 0,
      () => Promise.reject(new Error('synthetic wait failure')),
    );
    await expect(limiter.attempt('a', '198.51.100.1', undefined, failure)).rejects.toThrow(
      'synthetic wait failure',
    );
    expect((await limiter.attempt('a', '198.51.100.1', undefined, success)).kind).toBe(
      'authenticated',
    );
    expect(limiter.statistics.pending).toBe(0);
  });
});
