import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { readResponse } from './csp-nginx-client.mjs';

function fixture() {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  const signals = [];
  child.kill = (signal) => {
    signals.push(signal);
    return false; // Deliberately never emits close, even after kill.
  };
  return { child, signals, launch: () => child };
}

test('HTTP timeout settles without close and ignores late data/error/close', async () => {
  const fake = fixture();
  const result = await readResponse('synthetic-owned', '/', { ...fake, timeoutMs: 5 });
  assert.equal(result.status, null);
  assert.match(result.error.message, /timeout/u);
  assert.deepEqual(fake.signals, ['SIGKILL']);
  assert.equal(fake.child.stdin.destroyed, true);
  assert.equal(fake.child.stdout.destroyed, true);
  assert.equal(fake.child.stderr.destroyed, true);
  fake.child.stdout.emit('data', 'late-response');
  fake.child.emit('error', new Error('late-error'));
  fake.child.emit('close', 0);
  assert.equal(result.stdout, '');
});

test('HTTP response overflow settles without close and bounds captured output', async () => {
  const fake = fixture();
  const pending = readResponse('synthetic-owned', '/', fake);
  fake.child.stdout.write('x'.repeat(20000));
  const result = await pending;
  assert.equal(result.stdout.length, 16384);
  assert.match(result.error.message, /exceeded/u);
  assert.deepEqual(fake.signals, ['SIGKILL']);
});

test('HTTP normal close preserves status and bounded response', async () => {
  const fake = fixture();
  const pending = readResponse('synthetic-owned', '/', fake);
  fake.child.stdout.write('HTTP/1.0 200 OK\r\n\r\n');
  fake.child.stderr.write('x'.repeat(3000));
  fake.child.emit('close', 0);
  const result = await pending;
  assert.equal(result.status, 0);
  assert.equal(result.stderr.length, 2048);
  assert.equal(result.error, undefined);
  assert.deepEqual(fake.signals, []);
  assert.equal(fake.child.stdin.destroyed, true);
});
