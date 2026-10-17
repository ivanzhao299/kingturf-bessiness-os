export type BrowserSessionConfig = Readonly<{
  sessionCookieName: string;
  csrfCookieName: string;
  cookiePath: string;
  maxAgeSeconds: number;
  trustedOrigins: readonly string[];
  tokenLoginEnabled: boolean;
}>;

export function canonicalSessionOrigin(value: string, rootSlash = false): string | null {
  const parts = /^(https?):\/\/(\[[a-f0-9:.]+\]|[a-z0-9.-]+)(?::([0-9]+))?\/?$/iu.exec(value);
  if (!parts || (!rootSlash && value.endsWith('/'))) return null;
  try {
    const url = new URL(value);
    if (
      parts[2]?.toLowerCase() !== url.hostname ||
      (parts[3] !== undefined && String(Number(parts[3])) !== parts[3])
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function parseBrowserSessionEnvironment(
  env: Readonly<Record<string, string | undefined>>,
  nodeEnv: 'development' | 'test' | 'production',
  ttlSeconds: number,
  fail: (message: string) => never,
): BrowserSessionConfig {
  const sessionCookieName = env.SESSION_COOKIE_NAME ?? '__Host-kingturf-session';
  const csrfCookieName = env.CSRF_COOKIE_NAME ?? '__Host-kingturf-csrf';
  for (const name of [sessionCookieName, csrfCookieName]) {
    if (!/^[A-Za-z0-9_-]{1,64}$/u.test(name)) fail('Session cookie name is invalid');
  }
  if (sessionCookieName === csrfCookieName) fail('Session cookie names must differ');
  if (csrfCookieName.startsWith('__Http-') || csrfCookieName.startsWith('__Host-Http-'))
    fail('CSRF cookie name cannot require HttpOnly');
  const cookiePath = env.SESSION_COOKIE_PATH ?? '/';
  if (!['/', '/api', '/api/', '/api/v1', '/api/v1/'].includes(cookiePath))
    fail('SESSION_COOKIE_PATH must cover /api/v1/');
  if (
    [sessionCookieName, csrfCookieName].some((name) => name.startsWith('__Host-')) &&
    cookiePath !== '/'
  )
    fail('__Host- cookies require Path=/');
  const age = env.SESSION_COOKIE_MAX_AGE_SECONDS ?? String(ttlSeconds);
  const maxAgeSeconds = Number(age);
  if (
    !/^[1-9][0-9]*$/u.test(age) ||
    !Number.isSafeInteger(maxAgeSeconds) ||
    maxAgeSeconds < 60 ||
    maxAgeSeconds > ttlSeconds
  )
    fail('SESSION_COOKIE_MAX_AGE_SECONDS must be between 60 and session TTL');
  const source =
    env.SESSION_TRUSTED_ORIGINS ??
    (nodeEnv === 'production'
      ? 'https://erp.kingturf.cn'
      : 'http://localhost:5173,http://127.0.0.1:4173');
  const origins = source.split(',').map((value) => value.trim());
  if (!source || origins.length < 1 || origins.length > 8)
    fail('SESSION_TRUSTED_ORIGINS is invalid');
  const trustedOrigins = origins.map((value) => {
    const normalized = canonicalSessionOrigin(value, true);
    if (normalized === null) return fail('SESSION_TRUSTED_ORIGINS is invalid');
    const url = new URL(normalized);
    if (
      url.protocol === 'http:' &&
      (nodeEnv === 'production' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    )
      fail('SESSION_TRUSTED_ORIGINS requires HTTPS outside local development');
    return normalized;
  });
  const enabled = env.TOKEN_LOGIN_ENABLED ?? 'true';
  if (enabled !== 'true' && enabled !== 'false') fail('TOKEN_LOGIN_ENABLED must be true or false');
  return Object.freeze({
    sessionCookieName,
    csrfCookieName,
    cookiePath,
    maxAgeSeconds,
    trustedOrigins: Object.freeze([...new Set(trustedOrigins)]),
    tokenLoginEnabled: enabled === 'true',
  });
}

// Public, non-secret defaults for direct dispatch; login lifetime is also capped by expiresAt.
export const DEFAULT_BROWSER_SESSION = parseBrowserSessionEnvironment(
  {},
  'development',
  28_800,
  (message) => {
    throw new Error(message);
  },
);
