import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { prepareNativeSamplingRuntime } from './native-sampling.mjs';

const faults = ['source-cancel', 'source-kill', 'source-failure'];
const fault = process.argv[2];
assert(faults.includes(fault));
const label = `final-controlled-${fault}-1`;
const target = new URL('postgresql://127.0.0.1:5432/kingturf_test');
target.username = 'kingturf';
target.password = ['local', 'development', 'only'].join('-');
const runtime = await prepareNativeSamplingRuntime();
const nativeOwner = runtime.start('hold');
await nativeOwner.registered;
await nativeOwner.active;
const logPath = `/tmp/kingturf-${label}-2026-10-20.log`;
const fd = openSync(logPath, 'wx', 0o600);
const child = spawn(
  process.execPath,
  [
    '--experimental-transform-types',
    'scripts/e2e-docker/preflight.mjs',
    'local',
    'source',
    label,
    fault,
  ],
  {
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: target.href },
    stdio: ['ignore', 'pipe', fd],
  },
);
let sourceReady = false;
let sourceCleanup;
let childResult;
const nativeActive = true;
const safeEvents = [];
const publicEvent = (event) => {
  assert(event && typeof event === 'object');
  const allowed = {
    'source-producer-ready': ['kind', 'label', 'ownerVerified'],
    'source-fixture-result': [
      'kind',
      'label',
      'exit',
      'signal',
      'elapsedMs',
      'producerPassed',
      'fixtureValidated',
      'ownershipVerified',
      'stage',
    ],
    'source-owned-cleanup': ['schemaGone', 'markerMatched', 'containerGone'],
    'owned-cleanup': ['schemaGone', 'containerGone', 'previewGone'],
    'preflight-result': ['exit', 'elapsedMs'],
    'container-complete': [],
    'container-failed': ['phase'],
  };
  if (!Object.hasOwn(allowed, event.event)) return;
  const safe = { event: event.event };
  for (const key of allowed[event.event]) {
    assert(Object.hasOwn(event, key));
    safe[key] = event[key];
  }
  safeEvents.push(safe);
  return safe;
};
let pending = '';
child.stdout.setEncoding('utf8');
child.stdout.on('data', (chunk) => {
  pending += chunk;
  const complete = pending.split('\n');
  pending = complete.pop() ?? '';
  for (const line of complete) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      const safe = publicEvent(event);
      if (safe) console.log(JSON.stringify(safe));
      if (event.event === 'source-producer-ready') {
        assert.equal(sourceReady, false);
        sourceReady = true;
      }
      if (event.event === 'source-owned-cleanup') sourceCleanup = event;
    } catch {
      // Ignore malformed/private lines without echoing them; the preflight
      // contract is fail-closed and the final assertions still stop the run.
      process.exitCode = 1;
    }
  }
});
childResult = await new Promise((resolve) =>
  child.once('close', (exit, signal) => resolve({ exit, signal })),
);
if (nativeOwner) {
  const nativeResult = await nativeOwner.close();
  console.log(
    JSON.stringify({
      event: 'controlled-native-proof',
      scenario: fault,
      registered: nativeActive,
      nativeGone: nativeResult.nativeGone,
      nativeChildrenGone: nativeResult.nativeChildrenGone,
      queryStarted: nativeResult.queryStarted,
      elapsedMs: nativeResult.elapsedMs,
    }),
  );
  assert(nativeActive && nativeResult.nativeGone && nativeResult.nativeChildrenGone);
}
const runtimeCleanup = await runtime.close();
closeSync(fd);
console.log(
  JSON.stringify({
    event: 'controlled-channel-close',
    scenario: fault,
    childExit: childResult.exit,
    childSignal: childResult.signal,
    sourceReady,
    sourceSchemaGone: sourceCleanup?.schemaGone === true,
    sourceMarkerMatched: sourceCleanup?.markerMatched === true,
    containerGone: sourceCleanup?.containerGone === true,
    nativeRuntimeGone: runtimeCleanup.nativeGone,
    nativeArtifactsGone: runtimeCleanup.artifactGone,
    logPath,
  }),
);
assert(
  sourceReady &&
    sourceCleanup?.schemaGone &&
    sourceCleanup?.markerMatched &&
    sourceCleanup?.containerGone,
);
assert(runtimeCleanup.nativeGone && runtimeCleanup.artifactGone);
process.exitCode = childResult.exit === 0 && !childResult.signal ? 1 : 0;
