// D1 S3: public policy shared by API and test-only HTML preview; nginx is checked against it.
export const CONTENT_SECURITY_POLICY =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'";

export function parseCspEnforce(
  env: Readonly<Record<string, string | undefined>>,
  fail: (message: string) => never,
): boolean {
  const flag = env.CSP_ENFORCE ?? 'false';
  if (flag !== 'true' && flag !== 'false') fail('CSP_ENFORCE must be true or false');
  return flag === 'true';
}
