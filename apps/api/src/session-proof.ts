import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

function frame(...values: readonly string[]): Buffer {
  return Buffer.concat(
    values.flatMap((value) => {
      const bytes = Buffer.from(value, 'utf8');
      const length = Buffer.alloc(4);
      length.writeUInt32BE(bytes.length);
      return [length, bytes];
    }),
  );
}
const mac = (key: string | Buffer, ...values: readonly string[]): Buffer =>
  createHmac('sha256', key)
    .update(frame(...values))
    .digest();
const canonical32 = (value: string): Buffer | null => {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(value)) return null;
  const bytes = Buffer.from(value, 'base64url');
  return bytes.length === 32 && bytes.toString('base64url') === value ? bytes : null;
};
export const isSessionCookieToken = (value: string): boolean => canonical32(value) !== null;
export function sameProof(a: string, b: string): boolean {
  if (!a || a.length > 256 || a.length !== b.length) return false;
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

export class SessionProof {
  public constructor(private readonly secret: string) {}
  public generation(token: string): string {
    return mac(this.secret, 'kingturf/session-generation/v1', token).toString('base64url');
  }
  public matchesGeneration(token: string, value: string): boolean {
    const actual = canonical32(value);
    return (
      actual !== null && timingSafeEqual(actual, Buffer.from(this.generation(token), 'base64url'))
    );
  }
  public issueSession(token: string): string {
    const nonce = randomBytes(32).toString('base64url');
    const key = mac(this.secret, 'kingturf/csrf/session-key/v1', token);
    return `v1.s.${nonce}.${mac(key, 'write', nonce).toString('base64url')}`;
  }
  public verifySession(token: string, value: string): boolean {
    if (value.length > 256) return false;
    const parts = value.split('.');
    const nonce = parts[2] ?? '';
    const signature = canonical32(parts[3] ?? '');
    if (
      parts.length !== 4 ||
      parts[0] !== 'v1' ||
      parts[1] !== 's' ||
      !canonical32(nonce) ||
      !signature
    )
      return false;
    return timingSafeEqual(
      signature,
      mac(mac(this.secret, 'kingturf/csrf/session-key/v1', token), 'write', nonce),
    );
  }
  private loginKey(token: string | null): Buffer {
    return mac(
      this.secret,
      'kingturf/csrf/login-key/v1',
      token === null ? 'empty' : 'session-cookie',
      token ?? '',
    );
  }
  public issueLogin(token: string | null, now = Date.now()): string {
    const issuedAt = String(Math.floor(now / 1000));
    const nonce = randomBytes(32).toString('base64url');
    const signature = mac(this.loginKey(token), 'kingturf/csrf/login-proof/v1', issuedAt, nonce);
    return `v1.l.${issuedAt}.${nonce}.${signature.toString('base64url')}`;
  }
  public verifyLogin(token: string | null, value: string, now = Date.now()): boolean {
    if (value.length > 256) return false;
    const parts = value.split('.');
    const issuedAt = parts[2] ?? '';
    const nonce = parts[3] ?? '';
    const signature = canonical32(parts[4] ?? '');
    if (
      parts.length !== 5 ||
      parts[0] !== 'v1' ||
      parts[1] !== 'l' ||
      !/^(0|[1-9][0-9]{0,12})$/u.test(issuedAt) ||
      !canonical32(nonce) ||
      !signature
    )
      return false;
    const age = Math.floor(now / 1000) - Number(issuedAt);
    if (age > 300 || age < -5) return false;
    return timingSafeEqual(
      signature,
      mac(this.loginKey(token), 'kingturf/csrf/login-proof/v1', issuedAt, nonce),
    );
  }
}
