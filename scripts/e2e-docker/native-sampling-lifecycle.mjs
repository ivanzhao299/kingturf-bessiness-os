import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { prepareNativeSamplingRuntime } from './native-sampling.mjs';
import { parseWindows } from './passive-sampling.mjs';

// Explicit manual-only entry. No API, database, browser, credentials or environment reads.
const allowed = [
  'canary',
  'cancel',
  'lost-handoff',
  'suspended-kill',
  'interop-kill',
  'native-kill',
  'no-ack',
  'read-break',
];
const selected = process.argv[2] === 'all' ? allowed : [process.argv[2]];
assert(selected.every((value) => allowed.includes(value)));
const publicLines = [];
const report = (value) => {
  const line = JSON.stringify(value);
  assert(!/NATIVE-SECRET|processId|createdUtcTicks|jobName|(?:\d{1,3}\.){3}\d{1,3}/u.test(line));
  publicLines.push(line);
  console.log(line);
};
const began = Date.now();
let runtime;
let stage = 'build';
let pass = false;
try {
  runtime = await prepareNativeSamplingRuntime();
  report({
    event: 'native-runtime-build',
    passed: runtime.compiled,
    elapsedMs: runtime.compileElapsedMs,
  });
  for (const name of selected) {
    stage = name;
    const started = Date.now();
    if (name === 'canary') {
      const owner = runtime.start('sample');
      const seen = await owner.result;
      assert(seen.available);
      parseWindows(seen.raw);
      const checked = await owner.verify();
      assert(checked.confirmed && checked.workerRegistered && checked.workerGone);
      await owner.close();
      const poison = runtime.start('canary');
      const injected = await poison.result;
      assert(injected.available && injected.raw.includes('NATIVE-SECRET-CANARY-198.51.100.77'));
      assert.throws(() => parseWindows(injected.raw));
      const cleaned = await poison.close();
      assert(cleaned.nativeGone && cleaned.nativeChildrenGone);
      report({
        event: 'native-lifecycle-result',
        scenario: name,
        passed: true,
        actualQueryElapsedMs: seen.elapsedMs,
        canaryRejected: true,
        helperIdentityGone: checked.gone,
        workerIdentityGone: checked.workerGone,
        jobMembersZero: checked.nativeChildren === 0,
        elapsedMs: Date.now() - started,
      });
      continue;
    }
    const owner = runtime.start(
      name === 'read-break' ? 'sample' : name === 'suspended-kill' ? 'suspended' : 'hold',
      {
        deferAck: ['lost-handoff', 'no-ack'].includes(name),
        nativeLeaseTest: ['no-ack', 'read-break'].includes(name),
      },
    );
    assert(await owner.registered);
    if (name === 'lost-handoff') {
      owner.cancel(); // Identity privately registered, never handed to query/ACK caller.
    } else if (name === 'no-ack') {
      owner.pausePrivateOutput();
      // Keep input OPEN: native watchdog, not the host collection timer/EOF, must end this.
      await delay(31_000);
      owner.resumePrivateOutput();
    } else {
      assert(await owner.workerRegistered);
      if (name !== 'suspended-kill') assert(await owner.active);
      const before = await owner.snapshot();
      assert(
        before.matched &&
          before.workerMatched &&
          !before.gone &&
          !before.workerGone &&
          before.nativeChildren >= 1,
      );
      if (name === 'cancel') owner.cancel();
      else if (name === 'interop-kill') owner.interruptInterop();
      else if (['native-kill', 'suspended-kill'].includes(name)) {
        const stopped = await owner.terminateNativeRoot();
        assert(stopped.confirmed && stopped.workerGone);
      } else owner.breakPrivateOutput();
    }
    const seen = await owner.result;
    if (name === 'no-ack')
      assert(seen.nativeLeaseExpired && seen.elapsedMs >= 29_000 && seen.elapsedMs < 35_000);
    const cleanup = await owner.close();
    const proof = await owner.verify();
    assert(proof.confirmed && cleanup.nativeGone && cleanup.nativeChildrenGone);
    if (!['lost-handoff', 'no-ack'].includes(name))
      assert(proof.workerRegistered && proof.workerGone);
    report({
      event: 'native-lifecycle-result',
      scenario: name,
      passed: true,
      identityRegistered: seen.registered,
      queryStarted: seen.queryStarted,
      nativeLeaseExpired: seen.nativeLeaseExpired,
      helperIdentityGone: proof.gone,
      workerIdentityRegistered: proof.workerRegistered,
      workerIdentityGone: proof.workerGone,
      jobMembersZero: proof.nativeChildren === 0,
      elapsedMs: Date.now() - started,
    });
  }
  pass = true;
} catch {
  report({ event: 'native-lifecycle-failed', stage });
} finally {
  if (runtime) {
    const cleanup = await runtime.close();
    report({ event: 'native-runtime-cleanup', ...cleanup });
    pass &&= cleanup.nativeGone && cleanup.artifactGone;
  }
  report({
    event: 'native-lifecycle-close',
    passed: pass,
    cases: selected.length,
    outputBoundaryChecked: publicLines.length > 0,
    elapsedMs: Date.now() - began,
  });
  process.exitCode = pass ? 0 : 1;
}
