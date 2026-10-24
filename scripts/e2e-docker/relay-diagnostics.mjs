import assert from 'node:assert/strict';

// Fixed TCP state flags/counts only; never addresses, payloads, errors or request metadata.
export function safeRelayTimeoutState(value) {
  const safe = {};
  for (const key of ['connected', 'connecting', 'upstreamDestroyed', 'downstreamDestroyed']) {
    assert.equal(typeof value[key], 'boolean');
    safe[key] = value[key];
  }
  assert(
    Number.isSafeInteger(value.activeSockets) &&
      value.activeSockets >= 0 &&
      value.activeSockets <= 1_000_000,
  );
  safe.activeSockets = value.activeSockets;
  return safe;
}
