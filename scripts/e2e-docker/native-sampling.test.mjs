import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { privateIdentity, safeNativeInspection } from './native-sampling.mjs';

test('native private identity uses exact keys, UTC ticks string and random job ownership', () => {
  const identity = {
    frame: 'identity',
    processId: 12345,
    createdUtcTicks: '639280000000000000',
    jobName: 'Local\\KingTurfSampling-11111111-1111-4111-8111-111111111111',
  };
  assert.equal(privateIdentity(identity).createdUtcTicks, identity.createdUtcTicks);
  for (const patch of [
    { processId: 0 },
    { createdUtcTicks: 639280000000000000 },
    { jobName: 'not-owned' },
    { secret: 'canary' },
  ])
    assert.throws(() => privateIdentity({ ...identity, ...patch }));
});

test('native public inspection drops all raw identity/error additions by rejection', () => {
  const safe = {
    matched: true,
    gone: true,
    nativeChildren: 0,
    polls: 2,
    terminated: true,
    workerRegistered: true,
    workerGone: true,
    workerMatched: true,
  };
  assert.deepEqual(safeNativeInspection(JSON.stringify(safe)), safe);
  for (const patch of [
    { processId: 123 },
    { raw: 'CANARY-198.51.100.77' },
    { gone: 1 },
    { nativeChildren: -1 },
    { polls: 100001 },
  ])
    assert.throws(() => safeNativeInspection(JSON.stringify({ ...safe, ...patch })));
});

test('native job and watchdog contracts reject regressions to post-create assignment or ParentPID guessing', () => {
  const source = readFileSync(new URL('./native-sampling.cs', import.meta.url), 'utf8');
  assert(
    source.includes('0x0002000D') &&
      source.includes('0x00020002') &&
      source.includes('CreateSuspended|NoWindow|0x00080000'),
  );
  assert(!source.includes('AssignProcessToJobObject(') && !source.includes('ParentProcessId'));
  assert(source.includes('KillOnClose = 0x2000') && source.includes('Finished.WaitOne(30000)'));
  assert(
    source.includes('Task.Factory.StartNew(()=>Console.ReadLine())') &&
      !source.includes('Console.In.ReadLineAsync'),
  );
  assert(
    source.indexOf('IntPtr handle=root.Handle') < source.indexOf('matched=Created(handle)==ticks'),
  );
  assert(
    source.indexOf('TerminateProcess(root.Handle,125)') <
      source.indexOf('TerminateJobObject(job,125)'),
  );
});
