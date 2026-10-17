// Manual serialized real-Chrome negatives; never included in CI/Vitest/Playwright.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('./preflight.mjs', import.meta.url));
const batch = Date.now();
const scenarios = [
  { name: 'listener-fault', flag: '--fault-after-cookie-listener' },
  { name: 'unknown-write', flag: '--fault-cookie-extra-write' },
  { name: 'sigterm', flag: '--pause-after-cookie-listener', signal: 'SIGTERM' },
  { name: 'sigint', flag: '--pause-after-cookie-listener', signal: 'SIGINT' },
];
for (const scenario of scenarios) {
  const child = spawn(process.execPath, [entry, '--cookie-http-preflight', scenario.flag], {
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
  child.stdout.on('data', (chunk) => {
    output += chunk;
    if (scenario.signal && !signaled && output.includes('"kind":"cookie-http-owned-listener"')) {
      signaled = true;
      child.kill(scenario.signal);
    }
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const result = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(timer);
  const log = `/tmp/kingturf-s4-cookie-http-${batch}-${scenario.name}.log`;
  writeFileSync(log, output + stderr);
  assert.equal(timedOut, false);
  assert.equal(result.code, 1);
  assert.equal(result.signal, null);
  assert.equal(stderr === '', true);
  const rows = output
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(
    rows.some(
      (row) =>
        row.kind === 'cookie-http-pass' ||
        row.kind === 'preflight-pass' ||
        row.kind === 'cleanup-failure',
    ),
    false,
  );
  assert.equal(rows.find((row) => row.kind === 'cookie-http-cleanup')?.listenerGone, true);
  assert.equal(rows.find((row) => row.kind === 'process-cleanup')?.rootGone, true);
  assert.equal(rows.find((row) => row.kind === 'process-cleanup')?.profileProcessCount, 0);
  assert.equal(rows.find((row) => row.kind === 'profile-cleanup')?.profileGone, true);
  if (scenario.signal) assert.equal(signaled, true);
  if (scenario.name === 'unknown-write')
    assert.equal(
      rows.find((row) => row.kind === 'cookie-http-request-blocked')?.blockedRequests,
      1,
    );
  console.log(
    JSON.stringify({
      name: scenario.name,
      exitCode: 1,
      cleaned: true,
      signalHandled: scenario.signal ?? null,
      log,
    }),
  );
}
console.log('Cookie HTTP lifecycle negatives: 4/4; not Vitest or Playwright');
