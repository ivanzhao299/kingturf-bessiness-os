import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  baselineAppFixture,
  baselineAppSource,
  readBaselineApp,
  verifyBaselineAppBytes,
} from './qtc-root-capture-source.mjs';

test('loads byte-exact historical source without a runtime Git lookup', () => {
  const bytes = readFileSync(baselineAppFixture);
  assert.equal(bytes.length, 202118);
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    '8abaf6fdd1fe1b02bda6ee39129c6f2901673da8d74c47d1f628f7248bbe9e3f',
  );
  assert.equal(readBaselineApp(), bytes.toString('utf8'));
  assert.equal(baselineAppSource.commit, 'c7833e74dbbb7e9fcdfd9384249a0d496b6d94ee');
  assert.equal(baselineAppSource.blob, '6e795061a62b48985364e575a17d6d973d9f0e8e');
});

test('rejects missing historical source with a fixed diagnostic', () => {
  assert.throws(
    () => readBaselineApp(new URL('./qtc-baseline-source-does-not-exist.fixture', import.meta.url)),
    { message: 'Immutable QTC baseline source unavailable' },
  );
});

test('rejects truncation and same-length byte tampering before transformation', () => {
  const bytes = readFileSync(baselineAppFixture);
  assert.throws(() => verifyBaselineAppBytes(bytes.subarray(1)), /source digest mismatch/u);
  const altered = Buffer.from(bytes);
  altered[0] ^= 1;
  assert.throws(() => verifyBaselineAppBytes(altered), /source digest mismatch/u);
});

test('pins the original immutable 166-report oracle without replacing expectations', () => {
  const bytes = readFileSync(
    new URL('../../apps/api/test/fixtures/qtc-root-capture-baseline.json', import.meta.url),
  );
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    '44047f08bb426eb9220fc1411a49260509197e24d3107c1fc5844b7ffedb1162',
  );
});
