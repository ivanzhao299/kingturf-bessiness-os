import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename } from 'node:path';
import { SAMPLING_CAP_MS, parseWindows } from './passive-sampling.mjs';

const temporaryRoot = '/mnt/c/Users/JinhuIT/AppData/Local/Temp';
const compiler = '/mnt/c/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe';
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

export function privateIdentity(value) {
  keys(value, ['frame', 'processId', 'createdUtcTicks', 'jobName']);
  assert.equal(value.frame, 'identity');
  assert(
    Number.isSafeInteger(value.processId) && value.processId > 1 && value.processId < 2_147_483_647,
  );
  assert.match(value.createdUtcTicks, /^\d{18,20}$/u);
  assert.match(
    value.jobName,
    /^Local\\KingTurfSampling-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u,
  );
  return {
    processId: value.processId,
    createdUtcTicks: value.createdUtcTicks,
    jobName: value.jobName,
  };
}

export function safeNativeInspection(raw) {
  assert.equal(typeof raw, 'string');
  assert(Buffer.byteLength(raw) <= 8192);
  const value = JSON.parse(raw);
  keys(value, [
    'matched',
    'gone',
    'nativeChildren',
    'polls',
    'terminated',
    'workerRegistered',
    'workerGone',
    'workerMatched',
  ]);
  const safe = {};
  for (const key of [
    'matched',
    'gone',
    'terminated',
    'workerRegistered',
    'workerGone',
    'workerMatched',
  ]) {
    assert.equal(typeof value[key], 'boolean');
    safe[key] = value[key];
  }
  for (const key of ['nativeChildren', 'polls']) {
    assert(Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] <= 100_000);
    safe[key] = value[key];
  }
  return safe;
}

// Opt-in local build, never a default CI system probe. Only source/executable, no auth data.
export async function prepareNativeSamplingRuntime() {
  const directory = mkdtempSync(join(temporaryRoot, 'kingturf-native-sampling-'));
  const source = join(directory, 'NativeSampling.cs'),
    executable = join(directory, 'NativeSampling.exe');
  copyFileSync(new URL('./native-sampling.cs', import.meta.url), source);
  const win = (path) => execFileSync('wslpath', ['-w', path], { encoding: 'utf8' }).trim();
  const began = Date.now();
  let buildOutput = '',
    buildBytes = 0;
  const build = spawn(
    compiler,
    [
      '/nologo',
      '/noconfig',
      '/optimize+',
      '/target:exe',
      '/platform:x64',
      '/reference:System.dll',
      '/reference:System.Core.dll',
      '/reference:System.Web.Extensions.dll',
      `/out:${win(executable)}`,
      win(source),
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  for (const stream of [build.stdout, build.stderr])
    stream.on('data', (chunk) => {
      buildBytes += chunk.length;
      if (buildBytes <= 16_384) buildOutput += chunk.toString('utf8');
    });
  const compiled = await new Promise((resolve) => {
    build.once('error', () => resolve(false));
    build.once('close', (exit, signal) => resolve(exit === 0 && signal === null));
  });
  if (!compiled) {
    const codes = [...buildOutput.matchAll(/\((\d+),(\d+)\): error CS(\d+)/gu)]
      .slice(0, 16)
      .map((match) => ({
        line: Number(match[1]),
        column: Number(match[2]),
        code: Number(match[3]),
      }));
    // Failed builds contain only this helper source and compiler diagnostics. Remove
    // the exact owned directory before reporting the safe diagnostic summary.
    assert(basename(directory).startsWith('kingturf-native-sampling-'));
    assert(directory.startsWith(`${temporaryRoot}/`));
    rmSync(directory, { recursive: true, force: true });
    throw Object.assign(Error('native build unavailable; owned source artifacts cleaned'), {
      safeBuild: { diagnosticCount: codes.length, codes, overflow: buildBytes > 16_384 },
    });
  }
  const expectedHash = hash(executable),
    owned = new WeakSet(),
    records = new Set();
  let disposed = false;
  const start = (mode = 'sample', options = {}) => {
    assert(!disposed && hash(executable) === expectedHash);
    assert(['sample', 'canary', 'hold', 'suspended', 'inspect'].includes(mode));
    const {
      signal,
      target,
      terminate = false,
      onRegistered = () => {
        /* Boolean-only hook. */
      },
      deferAck = false,
      nativeLeaseTest = false,
      rootOnly = false,
      observeOnly = false,
    } = options;
    if (mode === 'inspect') assert(owned.has(target), 'only this runtime registered identities');
    const started = Date.now();
    const child = spawn(executable, [], {
      stdio: ['pipe', 'pipe', 'ignore'],
      detached: true,
      env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' },
    });
    const record = { identity: undefined, completed: false, confirmed: false, mode };
    records.add(record);
    let failureStage = 0;
    let raw,
      buffer = '',
      bytes = 0,
      invalid = false,
      cancelled = false,
      activeSeen = false,
      closed = false,
      acked = false,
      workerSeen = false;
    let resolveRegistered, resolveActive, resolveResult, resolveWorker;
    const workerRegistered = new Promise((resolve) => {
      resolveWorker = resolve;
    });
    const registered = new Promise((resolve) => {
      resolveRegistered = resolve;
    });
    const active = new Promise((resolve) => {
      resolveActive = resolve;
    });
    const result = new Promise((resolve) => {
      resolveResult = resolve;
    });
    const ack = () => {
      if (acked || !record.identity || closed || cancelled) return;
      acked = true;
      child.stdin.write(
        `${JSON.stringify({ mode, ...(target ? { target, terminate, rootOnly, observeOnly } : {}) })}\n`,
      );
    };
    const cancel = () => {
      cancelled = true;
      child.stdin.end();
    };
    child.stdin.on('error', () => {
      invalid = true;
    });
    child.stdout.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > 16_384) {
        invalid = true;
        cancel();
        return;
      }
      buffer += chunk.toString('utf8');
      while (buffer.includes('\n')) {
        const end = buffer.indexOf('\n'),
          line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        try {
          const frame = JSON.parse(line);
          if (frame.frame === 'identity') {
            assert(!record.identity);
            record.identity = privateIdentity(frame);
            owned.add(record.identity);
            resolveRegistered(true);
            try {
              onRegistered();
            } catch {
              invalid = true;
              cancel();
            }
            if (cancelled) child.stdin.end();
            else if (!deferAck) ack();
          } else if (frame.frame === 'worker') {
            keys(frame, ['frame', 'processId', 'createdUtcTicks']);
            assert(record.identity && acked && !workerSeen);
            assert(Number.isSafeInteger(frame.processId) && frame.processId > 1);
            assert.match(frame.createdUtcTicks, /^\d{18,20}$/u);
            workerSeen = true;
            record.identity.worker = {
              processId: frame.processId,
              createdUtcTicks: frame.createdUtcTicks,
            };
            resolveWorker(true);
          } else if (frame.frame === 'started') {
            keys(frame, ['frame']);
            assert(record.identity && acked && !activeSeen && (mode === 'inspect' || workerSeen));
            activeSeen = true;
            resolveActive(true);
          } else if (frame.frame === 'result') {
            keys(frame, ['frame', 'raw']);
            assert(activeSeen && raw === undefined);
            assert.equal(typeof frame.raw, 'string');
            assert(Buffer.byteLength(frame.raw) <= 8192);
            raw = frame.raw;
          } else if (frame.frame === 'failed') {
            keys(frame, ['frame', 'stage']);
            assert(Number.isSafeInteger(frame.stage) && frame.stage >= 0 && frame.stage <= 16);
            failureStage = frame.stage;
            invalid = true;
            cancel();
          } else {
            invalid = true;
            cancel();
          }
        } catch {
          invalid = true;
          cancel();
        }
      }
    });
    child.once('error', () => {
      invalid = true;
    });
    const timer = nativeLeaseTest ? undefined : setTimeout(cancel, SAMPLING_CAP_MS);
    const transportCap = setTimeout(() => {
      invalid = true;
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* Never native proof. */
      }
    }, 35_000);
    child.once('close', (exit, terminationSignal) => {
      closed = true;
      clearTimeout(timer);
      clearTimeout(transportCap);
      signal?.removeEventListener('abort', cancel);
      resolveRegistered(false);
      resolveActive(false);
      resolveWorker(false);
      record.completed = !invalid && exit === 0 && terminationSignal === null && raw !== undefined;
      resolveResult({
        available: record.completed && !cancelled,
        raw,
        completed: record.completed,
        cancelled,
        registered: !!record.identity,
        queryStarted: activeSeen,
        failureStage,
        nativeLeaseExpired: exit === 124 && terminationSignal === null && !cancelled,
        elapsedMs: Date.now() - started,
      });
      buffer = '';
    });
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    const verify = async (stop = false, extra = {}) => {
      await registered;
      if (!record.identity)
        return {
          confirmed: false,
          gone: false,
          nativeChildren: 0,
          matched: false,
          terminated: false,
          polls: 0,
        };
      const watcher = start('inspect', { target: record.identity, terminate: stop, ...extra });
      const seen = await watcher.result;
      try {
        assert(seen.available);
        const safe = safeNativeInspection(seen.raw);
        record.confirmed = safe.gone && safe.workerGone && safe.nativeChildren === 0;
        return { ...safe, confirmed: record.confirmed };
      } catch {
        return {
          confirmed: false,
          gone: false,
          nativeChildren: 0,
          matched: false,
          terminated: false,
          polls: 0,
        };
      }
    };
    const owner = {
      registered,
      workerRegistered,
      active,
      ack,
      cancel,
      result,
      verify,
      snapshot() {
        return verify(false, { observeOnly: true });
      },
      terminateNativeRoot() {
        return verify(true, { rootOnly: true });
      },
      async close() {
        cancel();
        const inspected = await verify(true);
        await result;
        return {
          nativeGone: inspected.confirmed,
          nativeChildrenGone: inspected.confirmed && inspected.nativeChildren === 0,
          identityRegistered: !!record.identity,
          queryStarted: activeSeen,
          elapsedMs: Date.now() - started,
        };
      },
      interruptInterop() {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          /* Native verify still required. */
        }
      },
      pausePrivateOutput() {
        child.stdout.pause();
      },
      resumePrivateOutput() {
        child.stdout.resume();
      },
      breakPrivateOutput() {
        child.stdout.destroy();
      },
    };
    record.owner = owner;
    return owner;
  };
  return {
    start,
    compiled: true,
    compileElapsedMs: Date.now() - began,
    async read(signal) {
      if (signal.aborted) return { available: false, childrenGone: true };
      const owner = start('sample', { signal });
      let seen;
      try {
        seen = await owner.result;
        if (seen.available) parseWindows(seen.raw);
      } catch {
        seen = undefined;
      }
      const cleanup = await owner.close();
      if (!cleanup.nativeGone) return { available: false, childrenGone: false };
      return seen?.available
        ? { available: true, childrenGone: true, raw: seen.raw }
        : { available: false, childrenGone: true };
    },
    async close() {
      // Abnormal inspectors are also owned records; finite recovery or explicit unconfirmed.
      for (let pass = 0; pass < 2; pass++) {
        const uncertain = [...records].filter(
          (record) => !record.confirmed && !(record.mode === 'inspect' && record.completed),
        );
        if (!uncertain.length) break;
        for (const record of uncertain) await record.owner.close();
      }
      if (
        ![...records].every(
          (record) => record.confirmed || (record.mode === 'inspect' && record.completed),
        )
      )
        return { nativeGone: false, artifactGone: false };
      disposed = true;
      assert(
        basename(directory).startsWith('kingturf-native-sampling-') &&
          directory.startsWith(`${temporaryRoot}/`),
      );
      assert(
        readdirSync(directory).every((file) =>
          ['NativeSampling.cs', 'NativeSampling.exe'].includes(file),
        ),
      );
      rmSync(directory, { recursive: true });
      return { nativeGone: true, artifactGone: true };
    },
  };
}
