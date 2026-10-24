import { createHash } from 'node:crypto';
import { DEFAULT_LOGIN_RATE_LIMIT, type LoginRateLimitConfig } from '@kingturf/config';
import { loginClientAddress } from './client-address.ts';
import { lockLoginBucket, pruneLoginFailures, type LoginBucket } from './login-rate-limit-state.ts';

type LoginDecision<T> =
  | Readonly<{ kind: 'authenticated'; value: T | null }>
  | Readonly<{ kind: 'limited'; retryAfter: number }>
  | Readonly<{ kind: 'unavailable' }>;

export class LoginRateLimiter {
  private readonly buckets = new Map<string, LoginBucket>();
  private readonly trusted: ReadonlySet<string>;
  private pending = 0;

  public constructor(
    private readonly config: LoginRateLimitConfig = DEFAULT_LOGIN_RATE_LIMIT,
    private readonly now: () => number = () => performance.now(),
    private readonly wait: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
      }),
  ) {
    this.trusted = new Set(config.trustedProxies);
  }

  public get statistics(): Readonly<{ buckets: number; pending: number }> {
    return { buckets: this.buckets.size, pending: this.pending };
  }

  private sweep(now: number): void {
    for (const [key, bucket] of this.buckets) {
      pruneLoginFailures(bucket, now, this.config.windowMs);
      if (bucket.references === 0 && bucket.failures.length === 0) this.buckets.delete(key);
    }
  }

  private reserve(keys: readonly string[]): readonly LoginBucket[] | null {
    this.sweep(this.now());
    if (this.pending >= this.config.maxPending) return null;
    const missing = keys.filter((key) => !this.buckets.has(key));
    if (this.buckets.size + missing.length > this.config.maxBuckets) return null;
    const buckets = keys.map((key) => {
      let bucket = this.buckets.get(key);
      if (!bucket) {
        bucket = { failures: [], references: 0, tail: Promise.resolve() };
        this.buckets.set(key, bucket);
      }
      bucket.references++;
      return bucket;
    });
    this.pending++;
    return buckets;
  }

  private retryAfter(buckets: readonly LoginBucket[]): number {
    const now = this.now();
    let delay = 0;
    for (const bucket of buckets) {
      pruneLoginFailures(bucket, now, this.config.windowMs);
      if (bucket.failures.length >= this.config.failureLimit)
        delay = Math.max(delay, (bucket.failures[0] ?? now) + this.config.windowMs - now);
    }
    return delay > 0 ? Math.max(1, Math.ceil(delay / 1000)) : 0;
  }

  private release(keys: readonly string[], buckets: readonly LoginBucket[]): void {
    buckets.forEach((bucket, index) => {
      bucket.references--;
      pruneLoginFailures(bucket, this.now(), this.config.windowMs);
      const key = keys[index];
      if (key && bucket.references === 0 && bucket.failures.length === 0) this.buckets.delete(key);
    });
    this.pending--;
  }

  public async attempt<T>(
    login: string,
    peer: string | undefined,
    forwarded: readonly string[] | undefined,
    authenticate: () => Promise<T | null>,
  ): Promise<LoginDecision<T>> {
    if (!this.config.enabled) return { kind: 'authenticated', value: await authenticate() };
    const address = loginClientAddress(peer, forwarded, this.trusted);
    if (address === null) return { kind: 'unavailable' };
    const account = createHash('sha256')
      .update(login.trim().toLocaleLowerCase('en-US'))
      .digest('hex');
    const keys = ['account:' + account, 'ip:' + address];
    const buckets = this.reserve(keys);
    const [accountBucket, ipBucket] = buckets ?? [];
    if (!buckets || !accountBucket || !ipBucket) return { kind: 'unavailable' };
    let unlockAccount = (): void => undefined;
    let unlockIp = (): void => undefined;
    try {
      unlockAccount = await lockLoginBucket(accountBucket);
      unlockIp = await lockLoginBucket(ipBucket);
      const retryAfter = this.retryAfter(buckets);
      if (retryAfter > 0) return { kind: 'limited', retryAfter };
      const value = await authenticate();
      if (value === null) {
        const completed = this.now();
        for (const bucket of buckets) {
          pruneLoginFailures(bucket, completed, this.config.windowMs);
          bucket.failures.push(completed);
        }
        const count = Math.max(...buckets.map((bucket) => bucket.failures.length));
        await this.wait(
          Math.min(this.config.baseDelayMs * 2 ** (count - 1), this.config.maxDelayMs),
        );
      }
      return { kind: 'authenticated', value };
    } finally {
      unlockIp();
      unlockAccount();
      this.release(keys, buckets);
    }
  }
}
