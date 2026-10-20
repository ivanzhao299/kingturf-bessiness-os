import assert from 'node:assert/strict';
import test from 'node:test';
import { safeTcpResult } from './tcp-baseline.mjs';

const positive = {
  side: 'container-gateway',
  attempted: 50,
  connected: 50,
  timeouts: 0,
  refused: 0,
  other: 0,
};
test('TCP baseline exports fixed count categories, never raw network or authentication fields', () => {
  assert.deepEqual(
    safeTcpResult({ ...positive, raw: 'FIXED_NON_SECRET_CANARY', address: 'not-exported' }),
    positive,
  );
  assert.deepEqual(safeTcpResult({ ...positive, side: 'host-loopback' }), {
    ...positive,
    side: 'host-loopback',
  });
});
test('TCP baseline rejects unknown sides, excessive counts and inconsistent outcomes', () => {
  for (const change of [
    { side: 'arbitrary' },
    { attempted: 51 },
    { connected: 49 },
    { timeouts: -1 },
    { other: '0' },
  ])
    assert.throws(() => safeTcpResult({ ...positive, ...change }));
});
