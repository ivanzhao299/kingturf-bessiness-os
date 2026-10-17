import { describe, expect, it, vi } from 'vitest';
import { buildApp, type ApiDependencies } from '../src/app.js';
import { securityResponseHeaders } from '../src/middleware/security-headers.js';

const policy =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'";
const reportOnly = 'content-security-policy-report-only';
const enforced = 'content-security-policy';

describe('D1 S3 report-only application policy', () => {
  it.each([
    ['GET', '/health', 200],
    ['GET', '/missing', 503],
    ['GET', '/ready', 503],
    ['POST', '/api/v1/auth/login', 503],
  ] as const)('adds policy without enforcing for %s %s', async (method, pathname, status) => {
    const result = await buildApp().dispatch({ method, pathname });
    expect(result.statusCode).toBe(status);
    expect(result.headers?.[reportOnly]).toBe(policy);
    expect(result.headers).not.toHaveProperty(enforced);
    expect(result.headers).toMatchObject({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'referrer-policy': 'strict-origin-when-cross-origin',
    });
  });
  it('keeps policy and correlation on oversized bodies', () => {
    const result = buildApp().rejectOversized('33333333-3333-4333-8333-333333333333');
    expect(result.statusCode).toBe(413);
    expect(result.headers).toMatchObject({
      [reportOnly]: policy,
      'x-correlation-id': '33333333-3333-4333-8333-333333333333',
    });
    expect(result.headers).not.toHaveProperty(enforced);
  });
  it('keeps policy on unexpected errors without leaking internal messages', async () => {
    const app = buildApp({
      readiness: vi.fn().mockRejectedValue(new Error('synthetic-private-error')),
    } as unknown as ApiDependencies);
    const result = await app.dispatch({ method: 'GET', pathname: '/ready' });
    expect(result.statusCode).toBe(500);
    expect(result.headers?.[reportOnly]).toBe(policy);
    expect(JSON.stringify(result.body)).not.toContain('synthetic-private-error');
  });
  it('only the explicit application option enables the additional enforced header', async () => {
    const enabled = await buildApp(undefined, { enforceCsp: true }).dispatch({
      method: 'GET',
      pathname: '/health',
    });
    expect(enabled.headers).toMatchObject({ [reportOnly]: policy, [enforced]: policy });
    const disabled = await buildApp(undefined, { enforceCsp: false }).dispatch({
      method: 'GET',
      pathname: '/health',
    });
    expect(disabled.headers?.[reportOnly]).toBe(policy);
    expect(disabled.headers).not.toHaveProperty(enforced);
    expect(disabled.body).toEqual(enabled.body);
  });
  it('normalizes only CSP headers authoritatively without mutating other inputs', () => {
    const original = Object.freeze({
      'Content-Security-Policy': "default-src 'none'",
      'CONTENT-SECURITY-POLICY-REPORT-ONLY': 'unsafe-synthetic',
      etag: 'synthetic-etag',
    });
    const result = securityResponseHeaders(original);
    expect(
      Object.keys(result).filter((key) => key.toLowerCase().startsWith('content-security-policy')),
    ).toEqual([reportOnly]);
    expect(result[reportOnly]).toBe(policy);
    expect(result.etag).toBe(original.etag);
    expect(original['Content-Security-Policy']).toBe("default-src 'none'");
  });
  it('keeps enforced policy absent by default and present only on explicit true', () => {
    expect(securityResponseHeaders()[enforced]).toBeUndefined();
    expect(securityResponseHeaders(undefined, true)[enforced]).toBe(policy);
    expect(securityResponseHeaders(undefined, true)[reportOnly]).toBe(policy);
  });
});
