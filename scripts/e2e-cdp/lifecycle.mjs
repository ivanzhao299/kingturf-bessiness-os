// Manual, serialized real-Chrome negative probes. Not part of Vitest or Playwright.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('./preflight.mjs', import.meta.url));
const batchId = Date.now();
const cases = [
  { name: 'profile-init-error', args: ['--fault-after-profile'], chrome: false },
  { name: 'lost-launch-pid', args: ['--fault-lost-pid'], chrome: true },
  { name: 'preview-error', args: ['--fault-after-preview'], chrome: true, preview: true },
  {
    name: 'sigterm',
    args: ['--pause-after-preview'],
    chrome: true,
    preview: true,
    signal: 'SIGTERM',
  },
  {
    name: 'sigint',
    args: ['--pause-after-preview'],
    chrome: true,
    preview: true,
    signal: 'SIGINT',
  },
];
for (const scenario of cases) {
  const child = spawn(process.execPath, [entry, ...scenario.args], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let stderr = '';
  let signaled = false;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
  }, 45000);
  child.stdout.on('data', (data) => {
    output += data;
    if (scenario.signal && !signaled && output.includes('"kind":"preview-owned-listener"')) {
      signaled = true;
      child.kill(scenario.signal);
    }
  });
  child.stderr.on('data', (data) => {
    stderr += data;
  });
  const result = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(timer);
  const log = `/tmp/kingturf-cdp-lifecycle-${batchId}-${scenario.name}.log`;
  writeFileSync(log, output + stderr);
  const rows = output
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(timedOut, false, `${scenario.name}: timeout, inspect owned resources`);
  assert.equal(result.code, 1, `${scenario.name}: expected handled failure`);
  assert.equal(result.signal, null, `${scenario.name}: must not bypass finally`);
  assert.equal(stderr, '', `${scenario.name}: unexpected stderr, inspect local log`);
  assert.equal(
    rows.some((row) => row.kind === 'preflight-pass'),
    false,
  );
  assert.equal(
    rows.some((row) => row.kind === 'cleanup-failure'),
    false,
  );
  assert.equal(rows.find((row) => row.kind === 'profile-cleanup')?.profileGone, true);
  if (scenario.chrome) {
    const cleanup = rows.find((row) => row.kind === 'process-cleanup');
    assert.equal(cleanup?.rootGone, scenario.name === 'lost-launch-pid' ? null : true);
    assert.equal(cleanup?.profileProcessCount, 0);
  }
  if (scenario.preview)
    assert.equal(rows.find((row) => row.kind === 'preview-cleanup')?.exited, true);
  if (scenario.signal) assert.equal(signaled, true);
  console.log(
    JSON.stringify({
      name: scenario.name,
      runId: rows[0].runId,
      exitCode: result.code,
      cleaned: true,
      signalHandled: scenario.signal ?? null,
      log,
    }),
  );
}
console.log('CDP lifecycle negative probes: 5/5; not Vitest or Playwright');
