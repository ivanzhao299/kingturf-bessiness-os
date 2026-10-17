import { CONTENT_SECURITY_POLICY } from '@kingturf/config';

export function securityResponseHeaders(
  headers?: Readonly<Record<string, string>>,
  enforceCsp = false,
): Readonly<Record<string, string>> {
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
