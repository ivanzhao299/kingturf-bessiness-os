import { describe, expect, it } from 'vitest';
import { securityResponseHeaders } from '../src/middleware/security-headers.js';

describe('securityResponseHeaders (TD-SEC-004)', () => {
  it('preserves unrelated response headers and does not mutate its input', () => {
    const original = Object.freeze({
      'content-type': 'application/json; charset=utf-8',
      etag: 'synthetic-etag',
      'x-correlation-id': 'synthetic-correlation',
    });
    const result = securityResponseHeaders(original);
    expect(result).toMatchObject(original);
    expect(result).not.toBe(original);
    expect(Object.keys(original)).toEqual(['content-type', 'etag', 'x-correlation-id']);
  });

  it('overrides route-provided values with the reviewed fixed security policy', () => {
    const result = securityResponseHeaders({
      'x-content-type-options': 'unsafe-synthetic-value',
      'x-frame-options': 'DENY',
      'referrer-policy': 'unsafe-url',
    });
    expect(result).toEqual({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'referrer-policy': 'strict-origin-when-cross-origin',
    });
  });

  it('returns an independent header object for every response', () => {
    const first = securityResponseHeaders();
    const second = securityResponseHeaders();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});
