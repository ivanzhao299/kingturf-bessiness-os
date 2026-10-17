import { canonicalIp } from './ip-address.ts';
import type { EnvironmentRecord } from './index.ts';

export type LoginRateLimitConfig = Readonly<{
  enabled: boolean;
  failureLimit: number;
  windowMs: number;
  baseDelayMs: number;
  maxDelayMs: number;
  maxBuckets: number;
  maxPending: number;
  trustedProxies: readonly string[];
}>;

export const DEFAULT_LOGIN_RATE_LIMIT: LoginRateLimitConfig = Object.freeze({
  enabled: true,
  failureLimit: 10,
  windowMs: 900_000,
  baseDelayMs: 100,
  maxDelayMs: 1000,
  maxBuckets: 10_000,
  maxPending: 64,
  trustedProxies: Object.freeze([]),
});

type IntegerSetting = (key: string, fallback: number, minimum: number, maximum: number) => number;

function parseTrustedProxies(value: string, fail: (message: string) => never): readonly string[] {
  if (value === '') return Object.freeze([]);
  const addresses: string[] = [];
  for (const part of value.split(',')) {
    const address = canonicalIp(part.trim());
    if (address === null) fail('LOGIN_RATE_LIMIT_TRUSTED_PROXIES must contain exact IP addresses');
    addresses.push(address);
  }
  return Object.freeze([...new Set(addresses)]);
}

export function parseLoginRateLimitEnvironment(
  env: EnvironmentRecord,
  integer: IntegerSetting,
  fail: (message: string) => never,
): LoginRateLimitConfig {
  const defaults = DEFAULT_LOGIN_RATE_LIMIT;
  const flag = env.LOGIN_RATE_LIMIT_ENABLED ?? String(defaults.enabled);
  if (flag !== 'true' && flag !== 'false') fail('LOGIN_RATE_LIMIT_ENABLED must be true or false');
  const trusted = env.LOGIN_RATE_LIMIT_TRUSTED_PROXIES?.trim() ?? '';
  const config: LoginRateLimitConfig = {
    enabled: flag === 'true',
    failureLimit: integer('LOGIN_RATE_LIMIT_FAILURES', defaults.failureLimit, 1, 1000),
    windowMs:
      integer('LOGIN_RATE_LIMIT_WINDOW_SECONDS', defaults.windowMs / 1000, 1, 86_400) * 1000,
    baseDelayMs: integer('LOGIN_RATE_LIMIT_BASE_DELAY_MS', defaults.baseDelayMs, 1, 5000),
    maxDelayMs: integer('LOGIN_RATE_LIMIT_MAX_DELAY_MS', defaults.maxDelayMs, 1, 5000),
    maxBuckets: integer('LOGIN_RATE_LIMIT_MAX_BUCKETS', defaults.maxBuckets, 2, 100_000),
    maxPending: integer('LOGIN_RATE_LIMIT_MAX_PENDING', defaults.maxPending, 1, 1024),
    trustedProxies: parseTrustedProxies(trusted, fail),
  };
  if (config.maxDelayMs < config.baseDelayMs)
    fail('LOGIN_RATE_LIMIT_MAX_DELAY_MS must not be less than BASE_DELAY_MS');
  if (config.maxBuckets * config.failureLimit > 1_000_000)
    fail('LOGIN_RATE_LIMIT_MAX_BUCKETS times FAILURES must not exceed 1000000');
  return Object.freeze(config);
}
