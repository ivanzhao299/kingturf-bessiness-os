import assert from 'node:assert/strict';
import test from 'node:test';
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
  const stubborn = 'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)';
  const leader =
    'const {spawn}=require("node:child_process");' +
    'process.on("SIGTERM",()=>{});' +
    'const child=spawn(process.execPath,["-e",' +
    JSON.stringify(stubborn) +
    '],{stdio:"ignore"});' +
    'child.once("spawn",()=>console.log("FIXED_READY"));setInterval(()=>{},1000)';
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
