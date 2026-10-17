import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

export function liveGroupMembers(group) {
  assert(Number.isSafeInteger(group) && group > 0, 'only an owned positive process group');
  return execFileSync('ps', ['-eo', 'pid=,pgid=,stat='], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .map((line) => line.trim().split(/\s+/u))
    .filter(([, pgid, state]) => Number(pgid) === group && !state.startsWith('Z'))
    .map(([pid]) => Number(pid));
}

function signalGroup(group, signal) {
  try {
    process.kill(-group, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

export async function runOwned(command, args, options) {
  assert.equal(
    process.platform,
    'linux',
    'coverage process ownership requires the Linux test host',
  );
  const { signal, onSpawn, forceAfterMs = 3000, drainDeadlineMs = 6000 } = options;
  signal.throwIfAborted();
  const startedAtMs = Date.now();
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: options.stdio ?? 'inherit',
    detached: true,
  });
  let force;
  let aborted = false;
  const abort = () => {
    if (!child.pid) return;
    aborted = true;
    signalGroup(child.pid, 'SIGTERM');
    force ??= setTimeout(() => signalGroup(child.pid, 'SIGKILL'), forceAfterMs);
  };
  signal.addEventListener('abort', abort, { once: true });
  child.once('spawn', () => {
    onSpawn?.(child);
    if (signal.aborted) abort();
  });
  if (signal.aborted) abort();
  try {
    const result = await new Promise((accept, reject) => {
      child.once('error', () => reject(Error('owned coverage child could not start')));
      child.once('close', (exit, terminationSignal) => accept({ exit, signal: terminationSignal }));
    });
    // Leader close alone does not prove that pnpm/Vitest/API descendants stopped.
    let members = liveGroupMembers(child.pid);
    const forcedCleanup = members.length > 0;
    if (forcedCleanup) {
      signalGroup(child.pid, 'SIGTERM');
      force ??= setTimeout(() => signalGroup(child.pid, 'SIGKILL'), forceAfterMs);
    }
    const deadline = Date.now() + drainDeadlineMs;
    while (members.length > 0 && Date.now() < deadline) {
      await delay(25);
      members = liveGroupMembers(child.pid);
    }
    assert(
      members.length === 0,
      'owned coverage process group ' +
        String(child.pid) +
        ' still live; inspect it before starting any more PG work',
    );
    return {
      ...result,
      startedAtMs,
      finishedAtMs: Date.now(),
      groupDrained: true,
      forcedCleanup,
      aborted,
      processGroup: child.pid,
    };
  } finally {
    signal.removeEventListener('abort', abort);
    clearTimeout(force);
  }
}
