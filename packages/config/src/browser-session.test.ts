import { describe, it, expect } from 'vitest';
import { parseEnvironment, ConfigurationError, canonicalSessionOrigin } from './index.ts';
import { parseBrowserSessionEnvironment } from './browser-session.ts';

const fail = (message: string): never => {
  throw new ConfigurationError(message);
};
const parse = (
  env: Record<string, string | undefined> = {},
  nodeEnv: 'development' | 'test' | 'production' = 'test',
  ttl = 3600,
) => parseBrowserSessionEnvironment(env, nodeEnv, ttl, fail);
describe('S4 public browser session configuration', () => {
  it('has fixed safe defaults and frozen independent configuration', () => {
    const c = parse();
    expect(c).toEqual({
      sessionCookieName: '__Host-kingturf-session',
      csrfCookieName: '__Host-kingturf-csrf',
      cookiePath: '/',
      maxAgeSeconds: 3600,
      trustedOrigins: ['http://localhost:5173', 'http://127.0.0.1:4173'],
      tokenLoginEnabled: true,
    });
    expect(Object.isFrozen(c) && Object.isFrozen(c.trustedOrigins)).toBe(true);
    expect(parse({}, 'production').trustedOrigins).toEqual(['https://erp.kingturf.cn']);
  });
  it('normalizes exact origins/default ports and explicit machine mint disable', () => {
    const c = parse(
      {
        SESSION_COOKIE_NAME: 'session',
        CSRF_COOKIE_NAME: 'csrf',
        SESSION_COOKIE_PATH: '/api/v1/',
        SESSION_COOKIE_MAX_AGE_SECONDS: '60',
        SESSION_TRUSTED_ORIGINS: 'https://ERP.KINGTURF.CN:443/,https://erp.kingturf.cn',
        TOKEN_LOGIN_ENABLED: 'false',
      },
      'production',
    );
    expect(c.trustedOrigins).toEqual(['https://erp.kingturf.cn']);
    expect(c.cookiePath).toBe('/api/v1/');
    expect(c.maxAgeSeconds).toBe(60);
    expect(c.tokenLoginEnabled).toBe(false);
  });
  it.each([
    '',
    'null',
    '*',
    'https:erp.kingturf.cn',
    'https://erp.kingturf.cn/.',
    'https://erp.kingturf.cn/%2e',
    'https://erp.kingturf.cn\\',
    'https:\\erp.kingturf.cn',
    'https://erp.kingturf.cn/path',
    'https://erp.kingturf.cn?x=1',
    'https://erp.kingturf.cn#x',
    'https://user@erp.kingturf.cn',
    'https://*.kingturf.cn',
    'https://%65rp.kingturf.cn',
    'http://example.com',
    'https://erp.kingturf.cn,',
    Array.from({ length: 9 }, () => 'https://erp.kingturf.cn').join(','),
  ])('rejects malformed or unsafe origins (case %#)', (value) => {
    expect(() => parse({ SESSION_TRUSTED_ORIGINS: value })).toThrow(ConfigurationError);
  });
  it.each(['http://localhost:5173', 'http://127.0.0.1:4173', 'http://[::1]:4173'])(
    'rejects production HTTP (case %#)',
    (value) => {
      expect(() => parse({ SESSION_TRUSTED_ORIGINS: value }, 'production')).toThrow(
        ConfigurationError,
      );
    },
  );
  it.each([
    { SESSION_COOKIE_NAME: '' },
    { SESSION_COOKIE_NAME: 'a;b' },
    { CSRF_COOKIE_NAME: 'x'.repeat(65) },
    { SESSION_COOKIE_NAME: 'same', CSRF_COOKIE_NAME: 'same' },
    { CSRF_COOKIE_NAME: '__Http-csrf' },
    { CSRF_COOKIE_NAME: '__Host-Http-csrf' },
    { SESSION_COOKIE_PATH: '/api/v1/' },
    { SESSION_COOKIE_PATH: '/ap' },
    { SESSION_COOKIE_PATH: '/api/v1/;bad' },
    { SESSION_COOKIE_MAX_AGE_SECONDS: '' },
    { SESSION_COOKIE_MAX_AGE_SECONDS: '59' },
    { SESSION_COOKIE_MAX_AGE_SECONDS: '3601' },
    { SESSION_COOKIE_MAX_AGE_SECONDS: '60.0' },
    { SESSION_COOKIE_MAX_AGE_SECONDS: ' 60' },
    { TOKEN_LOGIN_ENABLED: '' },
    { TOKEN_LOGIN_ENABLED: 'TRUE' },
    { TOKEN_LOGIN_ENABLED: '1' },
  ])('rejects invalid cookie/lifetime/boolean overrides (case %#)', (env) => {
    expect(() => parse(env)).toThrow(ConfigurationError);
  });
  it('validates all old required configuration first without leaking values', () => {
    expect(() => parseEnvironment({ TOKEN_LOGIN_ENABLED: 'invalid' })).toThrow(
      'NODE_ENV is required',
    );
  });
  it('wires public settings after existing S2/CSP errors in parseEnvironment', () => {
    const target = new URL('postgresql://127.0.0.1');
    target.pathname = '/config_unit';
    const env = {
      NODE_ENV: 'test',
      DATABASE_URL: target.href,
      SESSION_SECRET: 'unit-session-key'.repeat(4),
      SESSION_TTL_SECONDS: '3600',
      API_HOST: '127.0.0.1',
      API_PORT: '3000',
      ATTACHMENT_STORAGE_ADAPTER: 'local',
      ATTACHMENT_LOCAL_DIRECTORY: '/tmp/config-unit-storage',
      PASSWORD_SALT_BYTES: '16',
      PASSWORD_KEY_LENGTH: '32',
      PASSWORD_SCRYPT_COST: '16384',
      PASSWORD_SCRYPT_BLOCK_SIZE: '8',
      PASSWORD_SCRYPT_PARALLELIZATION: '1',
    };
    expect(
      parseEnvironment({ ...env, TOKEN_LOGIN_ENABLED: 'false' }).browserSession.tokenLoginEnabled,
    ).toBe(false);
    expect(() =>
      parseEnvironment({ ...env, LOGIN_RATE_LIMIT_FAILURES: '0', TOKEN_LOGIN_ENABLED: 'invalid' }),
    ).toThrow('LOGIN_RATE_LIMIT_FAILURES');
    expect(() =>
      parseEnvironment({ ...env, CSP_ENFORCE: 'invalid', TOKEN_LOGIN_ENABLED: 'invalid' }),
    ).toThrow('CSP_ENFORCE');
  });
  it('requires raw origin grammar before permitted canonicalization', () => {
    expect(canonicalSessionOrigin('HTTPS://ERP.KINGTURF.CN:443')).toBe('https://erp.kingturf.cn');
    expect(canonicalSessionOrigin('https://erp.kingturf.cn/')).toBeNull();
    expect(canonicalSessionOrigin('https://erp.kingturf.cn/.', true)).toBeNull();
  });
});
