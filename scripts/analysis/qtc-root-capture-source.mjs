import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Provenance only: runtime calibration must not require these historical Git objects.
export const baselineAppSource = Object.freeze({
  commit: 'c7833e74dbbb7e9fcdfd9384249a0d496b6d94ee',
  blob: '6e795061a62b48985364e575a17d6d973d9f0e8e',
  bytes: 202118,
  sha256: '8abaf6fdd1fe1b02bda6ee39129c6f2901673da8d74c47d1f628f7248bbe9e3f',
});
export const baselineAppFixture = new URL(
  '../../apps/api/test/fixtures/qtc-root-capture-app-c7833e74.ts.fixture',
  import.meta.url,
);

export function verifyBaselineAppBytes(bytes) {
  if (
    bytes.length !== baselineAppSource.bytes ||
    createHash('sha256').update(bytes).digest('hex') !== baselineAppSource.sha256
  )
    throw new Error('Immutable QTC baseline source digest mismatch');
  return bytes.toString('utf8');
}

export function readBaselineApp(path = baselineAppFixture) {
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch {
    throw new Error('Immutable QTC baseline source unavailable');
  }
  return verifyBaselineAppBytes(bytes);
}
