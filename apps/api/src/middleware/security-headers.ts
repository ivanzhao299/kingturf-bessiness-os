export function securityResponseHeaders(
  headers?: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  return {
    ...headers,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'strict-origin-when-cross-origin',
  };
}
