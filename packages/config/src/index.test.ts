import { describe, expect, it } from 'vitest';
import { ConfigurationError, parseEnvironment } from './index.js';

const valid = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://app:test@localhost/test',
  API_HOST: '127.0.0.1',
  API_PORT: '3000',
  SESSION_SECRET: 'test-only-non-placeholder',
  SESSION_TTL_SECONDS: '3600',
  PASSWORD_SALT_BYTES: '16',
  PASSWORD_KEY_LENGTH: '64',
  PASSWORD_SCRYPT_COST: '16384',
  PASSWORD_SCRYPT_BLOCK_SIZE: '8',
  PASSWORD_SCRYPT_PARALLELIZATION: '1',
  ATTACHMENT_STORAGE_ADAPTER: 'local',
  ATTACHMENT_LOCAL_DIRECTORY: '/tmp/kingturf-test-attachments',
  WEBSITE_LEAD_INGEST_SECRET: 'test-website-lead-ingest-secret-at-least-32-characters',
};
describe('parseEnvironment', () => {
  it('defaults CSP enforcement off and only enables it explicitly', () => {
    expect(parseEnvironment(valid).cspEnforce).toBe(false);
    expect(parseEnvironment({ ...valid, CSP_ENFORCE: 'false' }).cspEnforce).toBe(false);
    expect(parseEnvironment({ ...valid, CSP_ENFORCE: 'true' }).cspEnforce).toBe(true);
  });
  it.each(['', '1', 'TRUE', ' false '])('rejects invalid CSP enforcement %s', (flag) => {
    expect(() => parseEnvironment({ ...valid, CSP_ENFORCE: flag })).toThrow(ConfigurationError);
    expect(() => parseEnvironment({ ...valid, CSP_ENFORCE: flag })).toThrow('CSP_ENFORCE');
  });
  it('retains pre-existing configuration error order before the new CSP option', () => {
    expect(() =>
      parseEnvironment({ ...valid, LOGIN_RATE_LIMIT_ENABLED: 'invalid', CSP_ENFORCE: 'invalid' }),
    ).toThrow('LOGIN_RATE_LIMIT_ENABLED');
    expect(() => parseEnvironment({ ...valid, DATABASE_URL: '', CSP_ENFORCE: 'invalid' })).toThrow(
      'DATABASE_URL',
    );
  });
  it('defaults and freezes the independently configurable login limiter', () => {
    const settings = parseEnvironment(valid).loginRateLimit;
    expect(settings).toEqual({
      enabled: true,
      failureLimit: 10,
      windowMs: 900_000,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      maxBuckets: 10_000,
      maxPending: 64,
      trustedProxies: [],
    });
    expect(Object.isFrozen(settings)).toBe(true);
    expect(Object.isFrozen(settings.trustedProxies)).toBe(true);
  });
  it('parses explicit rollback, numeric and canonical exact-proxy settings', () => {
    expect(
      parseEnvironment({
        ...valid,
        LOGIN_RATE_LIMIT_ENABLED: 'false',
        LOGIN_RATE_LIMIT_FAILURES: '20',
        LOGIN_RATE_LIMIT_WINDOW_SECONDS: '1200',
        LOGIN_RATE_LIMIT_BASE_DELAY_MS: '5',
        LOGIN_RATE_LIMIT_MAX_DELAY_MS: '10',
        LOGIN_RATE_LIMIT_MAX_BUCKETS: '100',
        LOGIN_RATE_LIMIT_MAX_PENDING: '12',
        LOGIN_RATE_LIMIT_TRUSTED_PROXIES: ' ::ffff:192.0.2.1,2001:0DB8:0:0:0:0:0:1,192.0.2.1 ',
      }).loginRateLimit,
    ).toEqual({
      enabled: false,
      failureLimit: 20,
      windowMs: 1_200_000,
      baseDelayMs: 5,
      maxDelayMs: 10,
      maxBuckets: 100,
      maxPending: 12,
      trustedProxies: ['192.0.2.1', '2001:db8::1'],
    });
  });
  it.each([
    ['ENABLED', 'yes'],
    ['FAILURES', '0'],
    ['FAILURES', '1.5'],
    ['FAILURES', '1001'],
    ['WINDOW_SECONDS', '0'],
    ['WINDOW_SECONDS', '86401'],
    ['BASE_DELAY_MS', '0'],
    ['MAX_DELAY_MS', '0'],
    ['MAX_BUCKETS', '1'],
    ['MAX_PENDING', '0'],
    ['MAX_PENDING', '1025'],
    ['TRUSTED_PROXIES', '127.0.0.0/8'],
    ['TRUSTED_PROXIES', 'localhost'],
    ['TRUSTED_PROXIES', '192.0.2.1,'],
    ['TRUSTED_PROXIES', '999.1.1.1'],
    ['TRUSTED_PROXIES', 'fe80::1%eth0'],
  ])('rejects invalid login limiter %s', (key, value) => {
    expect(() => parseEnvironment({ ...valid, ['LOGIN_RATE_LIMIT_' + key]: value })).toThrow(
      ConfigurationError,
    );
  });
  it('rejects inverted backoff and excessive retained-state products', () => {
    expect(() => parseEnvironment({ ...valid, LOGIN_RATE_LIMIT_BASE_DELAY_MS: '1001' })).toThrow(
      ConfigurationError,
    );
    expect(() => parseEnvironment({ ...valid, LOGIN_RATE_LIMIT_FAILURES: '1000' })).toThrow(
      ConfigurationError,
    );
  });
  it('returns an immutable typed configuration', () => {
    expect(Object.isFrozen(parseEnvironment(valid).session)).toBe(true);
  });
  it('rejects missing and placeholder secrets', () => {
    expect(() => parseEnvironment({ ...valid, SESSION_SECRET: 'change-me' })).toThrow(
      ConfigurationError,
    );
    expect(() => parseEnvironment({ ...valid, DATABASE_URL: '' })).toThrow(
      'DATABASE_URL is required',
    );
  });
  it('requires production transport and secret strength', () => {
    expect(() =>
      parseEnvironment({
        ...valid,
        NODE_ENV: 'production',
        DATABASE_URL: `${valid.DATABASE_URL}?sslmode=disable`,
      }),
    ).toThrow(ConfigurationError);
    expect(() =>
      parseEnvironment({
        ...valid,
        NODE_ENV: 'production',
        SESSION_SECRET: 'a-production-secret-that-is-long-enough',
        ATTACHMENT_LOCAL_DIRECTORY: '/var/lib/kingturf/attachments',
        WEBSITE_LEAD_INGEST_SECRET: '',
      }),
    ).toThrow(/WEBSITE_LEAD_INGEST_SECRET/u);
  });
  it('selects local storage explicitly and requires a durable production path', () => {
    expect(parseEnvironment(valid).attachmentStorage.adapter).toBe('local');
    expect(() => parseEnvironment({ ...valid, ATTACHMENT_STORAGE_ADAPTER: 's3' })).toThrow(
      /unsupported/u,
    );
    expect(() =>
      parseEnvironment({
        ...valid,
        NODE_ENV: 'production',
        SESSION_SECRET: 'a-production-secret-that-is-long-enough',
      }),
    ).toThrow(/attachment storage/u);
    expect(
      parseEnvironment({
        ...valid,
        NODE_ENV: 'production',
        SESSION_SECRET: 'a-production-secret-that-is-long-enough',
        ATTACHMENT_LOCAL_DIRECTORY: '/var/lib/kingturf/attachments',
      }).attachmentStorage.directory,
    ).toBe('/var/lib/kingturf/attachments');
  });
});
