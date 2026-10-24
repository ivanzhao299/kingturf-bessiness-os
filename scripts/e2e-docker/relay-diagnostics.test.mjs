import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { safeRelayTimeoutState } from './relay-diagnostics.mjs';

const state = {
  connected: false,
  connecting: true,
  upstreamDestroyed: false,
  downstreamDestroyed: false,
  activeSockets: 2,
};
test('TCP timeout diagnostics re-encode only four state flags and a bounded count', () => {
  assert.deepEqual(
    safeRelayTimeoutState({ ...state, raw: 'FIXED_NON_SECRET_CANARY', address: 'must-not-export' }),
    state,
  );
  for (const changes of [
    { connected: 'true' },
    { activeSockets: -1 },
    { activeSockets: 1_000_001 },
    { activeSockets: NaN },
  ])
    assert.throws(() => safeRelayTimeoutState({ ...state, ...changes }));
});
test('passive TCP diagnostics preserve the original timeout and unconditional failure branch', () => {
  const source = readFileSync(new URL('./forward.mjs', import.meta.url), 'utf8');
  assert.equal((source.match(/upstream\.setTimeout\(5_000/gu) ?? []).length, 1);
  assert(source.includes('upstream.setTimeout(0)'));
  const branch = source.slice(
    source.indexOf('upstream.setTimeout(5_000'),
    source.indexOf('servers.push(server)'),
  );
  assert(branch.includes('upstream.destroy();'));
  assert(branch.includes('downstream.destroy();'));
  assert(branch.includes('fail();'));
  assert(!branch.includes('return;'));
});
