import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { liveGroupMembers, runOwned } from './coverage-process.mjs';

test('normal completion observes owned leader close and zero live group members', async () => {
  const controller = new AbortController();
  let owned;
  const result = await runOwned(process.execPath, ['-e', 'process.exit(0)'], {
    signal: controller.signal,
    stdio: 'ignore',
    onSpawn: (child) => {
      owned = child.pid;
    },
  });
  assert.equal(result.exit, 0);
  assert.equal(result.signal, null);
  assert.equal(result.forcedCleanup, false);
  assert.equal(result.groupDrained, true);
  assert.deepEqual(liveGroupMembers(owned), []);
});

test('cancellation drains a controlled child and grandchild that ignore TERM, without PG', async () => {
  const controller = new AbortController();
  let owned;
  let sawGrandchild = false;
  const stubborn =
    'process.on("SIGTERM",()=>{});console.log("CHILD_READY");setInterval(()=>{},1000)';
  const leader =
    'const {spawn}=require("node:child_process");' +
    'process.on("SIGTERM",()=>{});' +
    'const child=spawn(process.execPath,["-e",' +
    JSON.stringify(stubborn) +
    '],{stdio:["ignore","pipe","ignore"]});' +
    'child.stdout.once("data",()=>console.log("FIXED_READY"));setInterval(()=>{},1000)';
  const result = await runOwned(process.execPath, ['-e', leader], {
    signal: controller.signal,
    stdio: ['ignore', 'pipe', 'ignore'],
    forceAfterMs: 100,
    drainDeadlineMs: 3000,
    onSpawn: (child) => {
      owned = child.pid;
      child.stdout.on('data', (bytes) => {
        if (bytes.toString().includes('FIXED_READY')) {
          sawGrandchild = liveGroupMembers(owned).length >= 2;
          controller.abort();
        }
      });
    },
  });
  assert(sawGrandchild);
  assert.equal(result.aborted, true);
  assert.notEqual(result.exit, 0);
  assert.equal(result.groupDrained, true);
  assert.deepEqual(liveGroupMembers(owned), []);
});

test('process-table failure still kills its known owned group before rejecting, without PG', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'coverage-owned-ps-failure-'));
  const previousPath = process.env.PATH;
  let owned;
  const grandchild = 'process.on("SIGTERM",()=>{});console.log("READY");setInterval(()=>{},1000)';
  const leader =
    'const {spawn}=require("node:child_process");' +
    'const child=spawn(process.execPath,["-e",' +
    JSON.stringify(grandchild) +
    '],{stdio:["ignore","pipe","ignore"]});' +
    'child.stdout.once("data",()=>process.exit(0))';
  writeFileSync(join(directory, 'ps'), '#!/bin/sh\nexit 1\n', { mode: 0o700 });
  try {
    process.env.PATH = directory;
    await assert.rejects(
      runOwned(process.execPath, ['-e', leader], {
        signal: new AbortController().signal,
        stdio: 'ignore',
        forceAfterMs: 100,
        drainDeadlineMs: 3000,
        onSpawn: (child) => {
          owned = child.pid;
        },
      }),
    );
    process.env.PATH = previousPath;
    assert.deepEqual(liveGroupMembers(owned), []);
  } finally {
    process.env.PATH = previousPath;
    if (owned && liveGroupMembers(owned).length > 0) {
      process.kill(-owned, 'SIGKILL');
      for (let attempt = 0; attempt < 100 && liveGroupMembers(owned).length > 0; attempt++)
        await delay(25);
      assert.deepEqual(liveGroupMembers(owned), [], 'controlled test group cleanup failed');
    }
    rmSync(directory, { recursive: true });
  }
});
