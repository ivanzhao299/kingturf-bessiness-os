// Manual only. Inherits the guarded test target, never prints environment values.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('./session-network.mjs', import.meta.url));
const cases = [
  { name: 'listener-fault', flag: '--fault-listener', gateway: true },
  { name: 'profile-fault', flag: '--fault-profile', gateway: true, profile: true },
  { name: 'deadline-during-setup', flag: '--deadline-during-setup' },
  { name: 'spawn-error', flag: '--fault-api-spawn', apiCount: 1 },
  { name: 'server-error', flag: '--fault-server-error', gateway: true },
  {
    name: 'fixture-sigterm',
    flag: '--pause-after-fixture',
    marker: 'real-api-ready',
    signal: 'SIGTERM',
  },
  {
    name: 'browser-sigint',
    flag: '--pause-after-browser',
    marker: 'browser-ready',
    signal: 'SIGINT',
    gateway: true,
    profile: true,
  },
  {
    name: 'unknown-write',
    flag: '--fault-unexpected-write',
    gateway: true,
    profile: true,
    blocked: 1,
  },
  {
    name: 'cleanup-sigterm',
    flag: '--pause-during-cleanup',
    marker: 'cleanup-started',
    signal: 'SIGTERM',
    gateway: true,
    profile: true,
  },
];
for (const scenario of cases) {
  const child = spawn(
    process.execPath,
    ['--experimental-transform-types', entry, '--protocol-only', scenario.flag],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let output = '';
  let stderr = '';
  let signaled = false;
  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
  }, 120000);
  child.stdout.on('data', (chunk) => {
    output += chunk;
    if (scenario.signal && !signaled && output.includes(`"kind":"${scenario.marker}"`)) {
      signaled = true;
      child.kill(scenario.signal);
    }
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  clearTimeout(deadline);
  const log = `/tmp/kingturf-s4-network-lifecycle-${scenario.name}-2026-10-17.log`;
  writeFileSync(log, output + stderr);
  assert.equal(timedOut, false);
  assert.equal(code, 1);
  const rows = output
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(
    rows.some(
      (row) =>
        row.kind === 'network-pass' ||
        row.kind === 'cleanup-failed' ||
        row.kind === 'real-api-cleanup-failed' ||
        row.kind === 'cleanup-deadline',
    ),
    false,
  );
  const pg = rows.find((row) => row.kind === 'real-api-cleanup');
  assert.equal(pg?.schemaGone, true);
  assert.equal(pg?.childrenGone, true);
  assert.equal(pg.apiCount, scenario.apiCount ?? 2);
  if (scenario.gateway)
    assert.equal(rows.find((row) => row.kind === 'gateway-cleanup')?.listenerGone, true);
  if (scenario.profile) {
    assert.equal(rows.find((row) => row.kind === 'browser-profile-cleanup')?.profileGone, true);
    assert.equal(
      rows.find((row) => row.kind === 'browser-process-cleanup')?.profileProcessCount,
      0,
    );
  }
  if (scenario.blocked)
    assert.equal(
      rows.find((row) => row.kind === 'browser-network-summary')?.blocked,
      scenario.blocked,
    );
  if (scenario.signal) assert.equal(signaled, true);
  console.log(JSON.stringify({ name: scenario.name, expectedExit: code, clean: true, log }));
}
console.log('Session network lifecycle: 9/9, separate from API/Web/DOM/Playwright counts');
