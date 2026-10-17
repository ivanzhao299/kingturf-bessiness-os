import { describe, it, expect } from 'vitest';
import { createHmac, randomBytes } from 'node:crypto';
import { SessionProof, isSessionCookieToken, sameProof } from '../src/session-proof.ts';

// Independent framing oracle, never calls the implementation to construct expected MACs.
const framed = (fields: readonly string[]) =>
  Buffer.concat(
    fields.map((value) => {
      const text = Buffer.from(value);
      const n = Buffer.alloc(4);
      n.writeUInt32BE(text.length);
      return Buffer.concat([n, text]);
    }),
  );
const hmac = (key: string | Buffer, fields: readonly string[]) =>
  createHmac('sha256', key).update(framed(fields)).digest();
const synthetic = () => randomBytes(32).toString('base64url');
describe('S4 session-derived framed proofs', () => {
  it('rejects edited issuedAt with original MAC independently of the formula assertion', () => {
    const one = new SessionProof(synthetic());
    const now = 2_000_000_000_000;
    const proof = one.issueLogin(null, now);
    expect(one.verifyLogin(null, proof, now)).toBe(true);
    const parts = proof.split('.');
    parts[2] = String(Number(parts[2]) + 1);
    expect(one.verifyLogin(null, parts.join('.'), now)).toBe(false);
  });
  it('uses purpose-separated generation matching an independent oracle across instances', () => {
    const secret = synthetic();
    const a = synthetic();
    const b = synthetic();
    const one = new SessionProof(secret);
    const two = new SessionProof(secret);
    expect(
      one.generation(a) ===
        hmac(secret, ['kingturf/session-generation/v1', a]).toString('base64url'),
    ).toBe(true);
    expect(two.matchesGeneration(a, one.generation(a))).toBe(true);
    expect(two.matchesGeneration(b, one.generation(a))).toBe(false);
    expect(one.generation(a) === a).toBe(false);
    expect(new SessionProof(synthetic()).matchesGeneration(a, one.generation(a))).toBe(false);
  });
  it('signs session nonce using independent framing and permits same-session reuse only', () => {
    const secret = synthetic();
    const a = synthetic();
    const b = synthetic();
    const one = new SessionProof(secret);
    const proof = one.issueSession(a);
    const parts = proof.split('.');
    const expected = hmac(hmac(secret, ['kingturf/csrf/session-key/v1', a]), [
      'write',
      parts[2] ?? '',
    ]);
    expect(parts[3] === expected.toString('base64url')).toBe(true);
    expect(one.verifySession(a, proof)).toBe(true);
    expect(new SessionProof(secret).verifySession(a, proof)).toBe(true);
    expect(one.verifySession(a, proof)).toBe(true);
    expect(one.verifySession(b, proof)).toBe(false);
    expect(one.issueSession(a) === proof).toBe(false);
  });
  it.each([null, 'cookie'])(
    'signs login time, nonce and distinct empty/session bindings (case %#)',
    (binding) => {
      const secret = synthetic();
      const token = binding === null ? null : synthetic();
      const one = new SessionProof(secret);
      const now = 2_000_000_000_000;
      const proof = one.issueLogin(token, now);
      const parts = proof.split('.');
      const key = hmac(secret, [
        'kingturf/csrf/login-key/v1',
        token === null ? 'empty' : 'session-cookie',
        token ?? '',
      ]);
      expect(
        parts[4] ===
          hmac(key, ['kingturf/csrf/login-proof/v1', parts[2] ?? '', parts[3] ?? '']).toString(
            'base64url',
          ),
      ).toBe(true);
      expect(new SessionProof(secret).verifyLogin(token, proof, now)).toBe(true);
      expect(one.verifyLogin(token === null ? synthetic() : null, proof, now)).toBe(false);
      const alteredTime = [...parts];
      alteredTime[2] = String(Number(parts[2]) + 1);
      expect(one.verifyLogin(token, alteredTime.join('.'), now)).toBe(false);
      const alteredNonce = [...parts];
      alteredNonce[3] = synthetic();
      expect(one.verifyLogin(token, alteredNonce.join('.'), now)).toBe(false);
      expect(one.verifySession(token ?? synthetic(), proof)).toBe(false);
      expect(one.verifyLogin(token, one.issueSession(token ?? synthetic()), now)).toBe(false);
    },
  );
  it.each([-6000, -5000, 0, 300000, 301000])(
    'has exact login time bounds without nonce single-use (offset %s)',
    (offset) => {
      const one = new SessionProof(synthetic());
      const now = 2_000_000_000_000;
      const proof = one.issueLogin(null, now);
      expect(one.verifyLogin(null, proof, now + offset)).toBe(offset >= -5000 && offset <= 300000);
    },
  );
  it('rejects noncanonical, unbounded, malformed and wrong-domain proofs before crypto comparison', () => {
    const one = new SessionProof(synthetic());
    const token = synthetic();
    const valid = one.issueSession(token);
    for (const value of [
      '',
      'x'.repeat(257),
      valid + '.',
      valid.replace('v1.s.', 'v2.s.'),
      valid.replace('v1.s.', 'v1.l.'),
      valid + '=',
      valid.replaceAll('.', '..'),
    ]) {
      expect(one.verifySession(token, value)).toBe(false);
      expect(one.verifyLogin(null, value)).toBe(false);
    }
    expect(isSessionCookieToken(token)).toBe(true);
    for (const value of ['', token + '=', 'a'.repeat(43), ' '.repeat(43), token.slice(1)])
      expect(isSessionCookieToken(value)).toBe(false);
    expect(sameProof(valid, valid)).toBe(true);
    expect(sameProof(valid, valid + 'x')).toBe(false);
    expect(sameProof('é', 'aa')).toBe(false);
    expect(one.matchesGeneration(token, 'a'.repeat(43))).toBe(false);
  });
});
