import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { prepareNativeSamplingRuntime } from './native-sampling.mjs';
import { relayFailureCodes } from './forward.mjs';

const label = process.argv[2];
assert.match(label ?? '', /^final-controlled-p1-[a-z-]+-1$/u);
const target = new URL('postgresql://127.0.0.1:5432/kingturf_test');
target.username = 'kingturf';
target.password = ['local', 'development', 'only'].join('-');
const runtime = await prepareNativeSamplingRuntime();
const logPath = `/tmp/kingturf-${label}-2026-10-20.log`;
const fd = openSync(logPath, 'wx', 0o600);
const child = spawn(
  process.execPath,
  ['--experimental-transform-types', 'scripts/e2e-docker/preflight.mjs', 'local', 'p1', label],
  {
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: target.href },
    stdio: ['ignore', 'pipe', fd],
  },
);
let pending = '';
let relayFailures = 0;
let localResult;
let sampler;
const safeEvents = [];
const readSafe = (event) => {
  if (!event || typeof event !== 'object') return undefined;
  if (event.event === 'relay-failure') {
    assert([4173, 5432].includes(event.port));
    assert(['downstream', 'upstream', 'listener'].includes(event.side));
    assert(relayFailureCodes.includes(event.code));
    assert(typeof event.closing === 'boolean');
    relayFailures += 1;
    if (!sampler) sampler = runtime.start('sample');
    return {
      event: 'relay-failure',
      port: event.port,
      side: event.side,
      code: event.code,
      closing: event.closing,
    };
  }
  if (event.event === 'local-result') {
    assert(event.kind === 'p1' && event.label === label);
    assert(Number.isInteger(event.exit) && event.exit >= 0);
    assert(Number.isInteger(event.elapsedMs) && event.elapsedMs >= 0);
    assert(Number.isInteger(event.discovered) && event.discovered >= 0);
    assert(typeof event.complete === 'boolean' && Array.isArray(event.cases));
    localResult = {
      exit: event.exit,
      elapsedMs: event.elapsedMs,
      discovered: event.discovered,
      complete: event.complete,
      cases: event.cases.map((item) => {
        assert(Number.isInteger(item.index) && Number.isInteger(item.durationMs));
        assert(['passed', 'failed', 'timedOut', 'skipped', 'interrupted'].includes(item.status));
        return { index: item.index, status: item.status, durationMs: item.durationMs };
      }),
    };
    return {
      event: 'local-result',
      exit: event.exit,
      elapsedMs: event.elapsedMs,
      discovered: event.discovered,
      complete: event.complete,
    };
  }
  if (event.event === 'container-failed') return { event: 'container-failed', phase: event.phase };
  if (event.event === 'preflight-result')
    return { event: 'preflight-result', exit: event.exit, elapsedMs: event.elapsedMs };
  if (event.event === 'owned-cleanup')
    return {
      event: 'owned-cleanup',
      schemaGone: event.schemaGone,
      containerGone: event.containerGone,
      previewGone: event.previewGone,
    };
  return undefined;
};
child.stdout.setEncoding('utf8');
child.stdout.on('data', (chunk) => {
  pending += chunk;
  const lines = pending.split('\n');
  pending = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const safe = readSafe(JSON.parse(line));
      if (safe) {
        safeEvents.push(safe);
        console.log(JSON.stringify(safe));
      }
    } catch {
      process.exitCode = 1;
    }
  }
});
const childResult = await new Promise((resolve) =>
  child.once('close', (exit, signal) => resolve({ exit, signal })),
);
let nativeResult;
if (sampler) {
  nativeResult = await sampler.close();
  console.log(
    JSON.stringify({
      event: 'controlled-p1-native-proof',
      relayFailures,
      nativeGone: nativeResult.nativeGone,
      nativeChildrenGone: nativeResult.nativeChildrenGone,
      queryStarted: nativeResult.queryStarted,
      elapsedMs: nativeResult.elapsedMs,
    }),
  );
  assert(nativeResult.nativeGone && nativeResult.nativeChildrenGone);
}
const cleanup = await runtime.close();
closeSync(fd);
const passed = localResult?.cases.filter((item) => item.status === 'passed').length ?? 0;
const failed = localResult?.cases.filter((item) => item.status === 'failed').length ?? 0;
const timedOut = localResult?.cases.filter((item) => item.status === 'timedOut').length ?? 0;
console.log(
  JSON.stringify({
    event: 'controlled-p1-result',
    label,
    childExit: childResult.exit,
    childSignal: childResult.signal,
    discovered: localResult?.discovered ?? 0,
    complete: localResult?.complete === true,
    passed,
    failed,
    timedOut,
    relayFailures,
    samplerTriggered: Boolean(sampler),
    nativeRuntimeGone: cleanup.nativeGone,
    nativeArtifactsGone: cleanup.artifactGone,
    logPath,
  }),
);
assert(cleanup.nativeGone && cleanup.artifactGone);
assert(childResult.exit === 0 && childResult.signal === null);
assert(
  localResult?.exit === 0 &&
    localResult.complete &&
    localResult.discovered === 11 &&
    passed === 11 &&
    failed === 0 &&
    timedOut === 0,
);
