import { isIP } from 'node:net';
import { describe, expect, it } from 'vitest';
import { canonicalIp } from '@kingturf/config';
import { loginClientAddress } from '../src/middleware/client-address.js';

describe('login transport identity', () => {
  it.each(['198.51.100.3', '::ffff:198.51.100.3'])(
    'ignores forged forwarding from untrusted peer %s',
    (peer) => {
      expect(loginClientAddress(peer, ['invalid, 203.0.113.2'], new Set())).toBe('198.51.100.3');
    },
  );
  it('takes the rightmost untrusted identity rather than a forged left prefix', () => {
    const trusted = new Set(['192.0.2.1', '192.0.2.2']);
    expect(
      loginClientAddress('::ffff:192.0.2.2', ['203.0.113.9, 198.51.100.4, 192.0.2.1'], trusted),
    ).toBe('198.51.100.4');
    expect(
      loginClientAddress('192.0.2.2', ['198.51.100.4, 192.0.2.1'], new Set(['192.0.2.2'])),
    ).toBe('192.0.2.1');
  });
  it.each(
    [
      undefined,
      [],
      [''],
      ['198.51.100.2', '198.51.100.3'],
      ['198.51.100.2,'],
      ['invalid'],
      ['192.0.2.1'],
      [Array(17).fill('198.51.100.2').join(',')],
      ['1'.repeat(4097)],
    ].map((chain) => [chain] as const),
  )('fails closed for malformed or missing trusted chains %#', (chain) => {
    expect(loginClientAddress('192.0.2.1', chain, new Set(['192.0.2.1']))).toBeNull();
  });
  it('reserves unknown only for internal dispatch without peer, not malformed transport peer', () => {
    expect(loginClientAddress(undefined, ['203.0.113.9'], new Set())).toBe('unknown');
    expect(loginClientAddress('not-an-ip', undefined, new Set())).toBeNull();
  });
  it.each([
    ['2001:0DB8:0:0:0:0:0:1', '2001:db8::1'],
    ['::', '::'],
    ['::1', '::1'],
    ['0:0:0:0:0:FFFF:c000:201', '192.0.2.1'],
    ['::ffff:192.0.2.1', '192.0.2.1'],
    ['2001:db8:0:1:0:0:0:1', '2001:db8:0:1::1'],
  ])('canonicalizes %s', (input, expected) => {
    expect(canonicalIp(input)).toBe(expected);
  });
  it('differentially checks unscoped generated addresses against the native parser', () => {
    for (let index = 0; index < 512; index++) {
      const words = Array.from({ length: 8 }, (_, part) =>
        ((index * 4099 + part * 67) % 65536).toString(16),
      );
      const inputs = [
        words.join(':'),
        words.slice(0, 3).join(':') + '::' + words.slice(6).join(':'),
        `::ffff:192.0.${String(Math.floor(index / 256))}.${String(index % 256)}`,
      ];
      for (const input of inputs) {
        expect(isIP(input)).toBe(6);
        const canonical = canonicalIp(input);
        expect(canonical).not.toBeNull();
        const native = new URL('http://[' + input + ']').hostname.slice(1, -1);
        expect(canonicalIp(native)).toBe(canonical);
        expect(isIP(canonical ?? '')).not.toBe(0);
        if (isIP(canonical ?? '') === 6) expect(canonical).toBe(native);
      }
    }
  });
  it.each([
    '',
    ':',
    ':::1',
    '1::2::3',
    '1:2:3',
    '1:2:3:4:5:6:7:8:9',
    '12345::1',
    '192.0.2.01',
    '256.1.1.1',
    '1.2.3',
    '2001:db8::g',
    '::ffff:192.0.2.999',
    '[::1]',
    ' ::1',
    'fe80::1%eth0',
  ])('rejects invalid or unsupported address %s', (value) => {
    expect(canonicalIp(value)).toBeNull();
  });
});
