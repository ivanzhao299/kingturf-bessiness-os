import { CONTENT_SECURITY_POLICY } from '@kingturf/config';
import type { ApiResponse } from '../app.ts';

export function securityResponseHeaders(
  headers?: ApiResponse['headers'],
  enforceCsp = false,
): NonNullable<ApiResponse['headers']> {
  const original = Object.fromEntries(
    Object.entries(headers ?? {}).filter(
      ([key]) =>
        !['content-security-policy', 'content-security-policy-report-only'].includes(
          key.toLowerCase(),
        ),
    ),
  );
  return {
    ...original,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'content-security-policy-report-only': CONTENT_SECURITY_POLICY,
    ...(enforceCsp ? { 'content-security-policy': CONTENT_SECURITY_POLICY } : {}),
  };
}
