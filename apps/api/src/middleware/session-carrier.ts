import { canonicalSessionOrigin, type BrowserSessionConfig } from '@kingturf/config';
import type { ApiRequest } from '../app.ts';
import type { AuthenticationService } from '../security.ts';
import { isSessionCookieToken, sameProof } from '../session-proof.ts';

export class SessionRequestError extends Error {
  public constructor(
    public readonly statusCode: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}
export type SessionCarrier =
  | Readonly<{ kind: 'none'; token: null; csrf: string | undefined }>
  | Readonly<{ kind: 'cookie' | 'bearer'; token: string; csrf: string | undefined }>;
export function sessionHeader(
  request: ApiRequest,
  name: string,
  statusCode: 401 | 403 = 403,
  maximum = 256,
): string | undefined {
  const distinct = request.headersDistinct?.[name];
  if (distinct && distinct.length !== 1)
    throw new SessionRequestError(statusCode, 'Ambiguous session header');
  const value = distinct ? distinct[0] : request.headers?.[name];
  if (
    value !== undefined &&
    (Buffer.byteLength(value, 'utf8') > maximum || /[\r\n\0]/u.test(value))
  )
    throw new SessionRequestError(statusCode, 'Invalid session header');
  return value;
}
export function hasCookieHeader(request: ApiRequest): boolean {
  return request.headers?.cookie !== undefined || request.headersDistinct?.cookie !== undefined;
}
export function parseSessionCarrier(
  request: ApiRequest,
  config: BrowserSessionConfig,
): SessionCarrier {
  const raw = (
    request.headersDistinct?.cookie ??
    (request.headers?.cookie === undefined ? [] : [request.headers.cookie])
  ).join('; ');
  if (Buffer.byteLength(raw, 'utf8') > 8192 || /[\r\n\0]/u.test(raw))
    throw new SessionRequestError(401, 'Invalid Cookie header');
  const relevant = new Map<string, string>();
  for (const part of raw.split(';')) {
    const at = part.indexOf('=');
    const name = (at < 0 ? part : part.slice(0, at)).trim();
    if (name !== config.sessionCookieName && name !== config.csrfCookieName) continue;
    if (relevant.has(name)) throw new SessionRequestError(401, 'Ambiguous session cookie');
    relevant.set(name, at < 0 ? '' : part.slice(at + 1));
  }
  const token = relevant.get(config.sessionCookieName);
  const csrf = relevant.get(config.csrfCookieName);
  const authorization = sessionHeader(request, 'authorization', 401, 8192);
  if (token !== undefined && !isSessionCookieToken(token))
    throw new SessionRequestError(401, 'Invalid session cookie');
  if (authorization !== undefined && relevant.size !== 0)
    throw new SessionRequestError(401, 'Ambiguous session carrier');
  if (token !== undefined) return { kind: 'cookie', token, csrf };
  if (authorization !== undefined) {
    if (!/^Bearer [^\s,]+$/u.test(authorization))
      throw new SessionRequestError(401, 'A valid session is required');
    return { kind: 'bearer', token: authorization.slice(7), csrf };
  }
  return { kind: 'none', token: null, csrf };
}

export function requireMachineContext(request: ApiRequest): void {
  if (
    sessionHeader(request, 'origin', 403, 2048) !== undefined ||
    sessionHeader(request, 'sec-fetch-site') !== undefined
  )
    throw new SessionRequestError(403, 'Browser context is not allowed for machine authentication');
}
export function requireTrustedOrigin(request: ApiRequest, config: BrowserSessionConfig): void {
  const value = sessionHeader(request, 'origin', 403, 2048);
  const normalized = canonicalSessionOrigin(value ?? '');
  if (!normalized || !config.trustedOrigins.includes(normalized))
    throw new SessionRequestError(403, 'A trusted Origin is required');
}
export function requireProofPair(request: ApiRequest, csrf: string | undefined): string {
  const header = sessionHeader(request, 'x-kingturf-csrf');
  if (!csrf || !header || !sameProof(csrf, header))
    throw new SessionRequestError(403, 'A valid CSRF proof is required');
  return header;
}
export function authorizeCookieRequest(
  request: ApiRequest,
  carrier: Extract<SessionCarrier, { token: string }>,
  auth: AuthenticationService,
  config: BrowserSessionConfig,
): void {
  const safe = request.method === 'GET' || request.method === 'HEAD';
  if (!safe) requireTrustedOrigin(request, config);
  const generation = sessionHeader(request, 'x-kingturf-session-generation', 401, 43);
  if (
    (!safe && generation === undefined) ||
    (generation !== undefined && !auth.matchesSessionGeneration(carrier.token, generation))
  )
    throw new SessionRequestError(401, 'Session generation changed');
  if (!safe && !auth.verifyCsrfProof(carrier.token, requireProofPair(request, carrier.csrf)))
    throw new SessionRequestError(403, 'A valid CSRF proof is required');
}
export function formatSessionCookie(
  config: BrowserSessionConfig,
  csrf: boolean,
  value: string,
  maxAge = config.maxAgeSeconds,
): string {
  return `${csrf ? config.csrfCookieName : config.sessionCookieName}=${value}; Path=${config.cookiePath}; Max-Age=${String(maxAge)};${csrf ? '' : ' HttpOnly;'} Secure; SameSite=Lax`;
}
export function browserAuthResponse(request: ApiRequest, config: BrowserSessionConfig): boolean {
  if (request.pathname === '/api/v1/auth/login' && request.method === 'POST') return true;
  if (request.pathname === '/api/v1/auth/token-login' && request.method === 'POST') return true;
  if (request.pathname === '/api/v1/auth/login-context' && request.method === 'GET') return true;
  if (request.pathname !== '/api/v1/auth/session') return false;
  if (
    request.headers?.['x-kingturf-session-intent'] !== undefined ||
    request.headersDistinct?.['x-kingturf-session-intent'] !== undefined
  )
    return true;
  const raw = request.headersDistinct?.cookie ?? [request.headers?.cookie ?? ''];
  return raw.some((value) =>
    value.split(';').some((part) => {
      const name = part.split('=')[0]?.trim();
      return name === config.sessionCookieName || name === config.csrfCookieName;
    }),
  );
}
