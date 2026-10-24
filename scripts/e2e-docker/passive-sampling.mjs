import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

// Completion-driven collection cap; this is never the relay's unchanged 5s deadline.
export const SAMPLING_CAP_MS = 15_000;

const counterNames = [
  'ListenOverflows',
  'ListenDrops',
  'TCPReqQFullDrop',
  'TCPTimeouts',
  'TCPSynRetrans',
];
const states = [
  'LISTEN',
  'SYN-SENT',
  'SYN-RECV',
  'ESTAB',
  'TIME-WAIT',
  'CLOSE-WAIT',
  'FIN-WAIT-1',
  'FIN-WAIT-2',
  'LAST-ACK',
  'CLOSING',
  'CLOSE',
];
const count = (value) => {
  assert(Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000);
  return value;
};

// Commands are fixed and read-only. Raw stdout is bounded in RAM, never logged or returned.
export const samplingCommands = Object.freeze({
  queue: Object.freeze(['/usr/bin/ss', ['-H', '-ltn', 'sport = :4173']]),
  sockets: Object.freeze(['/usr/bin/ss', ['-H', '-tan', '( sport = :4173 or dport = :4173 )']]),
  counters: Object.freeze([
    '/usr/bin/nstat',
    ['-asz', ...counterNames.map((key) => `TcpExt${key}`)],
  ]),
  windows: Object.freeze([
    '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "$ErrorActionPreference='Stop'; $c=@(Get-NetTCPConnection -ErrorAction Stop); [ordered]@{listen=@($c|Where-Object {$_.LocalPort -eq 4173 -and $_.State -eq 'Listen'}).Count; synSent=@($c|Where-Object {($_.LocalPort -eq 4173 -or $_.RemotePort -eq 4173) -and $_.State -eq 'SynSent'}).Count; synReceived=@($c|Where-Object {($_.LocalPort -eq 4173 -or $_.RemotePort -eq 4173) -and $_.State -eq 'SynReceived'}).Count; established=@($c|Where-Object {($_.LocalPort -eq 4173 -or $_.RemotePort -eq 4173) -and $_.State -eq 'Established'}).Count; globalSynSent=@($c|Where-Object {$_.State -eq 'SynSent'}).Count}|ConvertTo-Json -Compress",
    ],
  ]),
});
for (const command of Object.values(samplingCommands)) Object.freeze(command[1]);

function lines(raw) {
  assert.equal(typeof raw, 'string');
  assert(Buffer.byteLength(raw) <= 16_384);
  return raw.trim() ? raw.trim().split(/\r?\n/u) : [];
}

export function parseQueue(raw) {
  const rows = lines(raw).map((line) => line.trim().split(/\s+/u));
  assert(rows.length <= 16);
  let recv = 0;
  let send = 0;
  for (const row of rows) {
    assert.equal(row[0], 'LISTEN');
    assert(row.length >= 5 && row[3].endsWith(':4173'));
    assert(/^\d+$/u.test(row[1]) && /^\d+$/u.test(row[2]));
    recv = count(recv + count(Number(row[1])));
    send = count(send + count(Number(row[2])));
  }
  return { listeners: rows.length, recv, send };
}

export function parseSockets(raw) {
  const safe = { synSent: 0, synReceived: 0, established: 0 };
  for (const line of lines(raw)) {
    const row = line.trim().split(/\s+/u);
    assert(states.includes(row[0]) && row.length >= 5);
    assert(row[3].endsWith(':4173') || row[4].endsWith(':4173'));
    const key = { 'SYN-SENT': 'synSent', 'SYN-RECV': 'synReceived', ESTAB: 'established' }[row[0]];
    if (key) safe[key] = count(safe[key] + 1);
  }
  return safe;
}

export function parseCounters(raw) {
  const safe = {};
  for (const line of lines(raw)) {
    if (line.startsWith('#')) continue;
    const row = line.trim().split(/\s+/u);
    const key = counterNames.find((name) => `TcpExt${name}` === row[0]);
    assert(key && !Object.hasOwn(safe, key) && /^\d+$/u.test(row[1]));
    safe[key] = count(Number(row[1]));
  }
  assert.equal(Object.keys(safe).length, counterNames.length);
  return safe;
}

function fixedNumbers(value, keys) {
  assert(value && typeof value === 'object' && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
  return Object.fromEntries(keys.map((key) => [key, count(value[key])]));
}

export function parseWindows(raw) {
  lines(raw);
  return fixedNumbers(JSON.parse(raw.replace(/^\uFEFF/u, '')), [
    'listen',
    'synSent',
    'synReceived',
    'established',
    'globalSynSent',
  ]);
}

export function counterDelta(before, after) {
  const a = fixedNumbers(before, counterNames);
  const b = fixedNumbers(after, counterNames);
  return Object.fromEntries(counterNames.map((key) => [key, count(b[key] - a[key])]));
}

// A private child group only; never kill a PID received from external stdout.
export function boundedRead(
  command,
  signal,
  spawnChild = spawn,
  killGroup = process.kill.bind(process),
) {
  assert(Object.values(samplingCommands).includes(command));
  return new Promise((resolve) => {
    if (signal.aborted) return resolve({ available: false, childrenGone: true });
    let child;
    let settled = false;
    let invalid = false;
    let cancelling = false;
    let bytes = 0;
    let raw = '';
    let timer;
    let finalTimer;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(finalTimer);
      signal.removeEventListener('abort', cancel);
      resolve(result);
    };
    const cancel = () => {
      if (cancelling || settled) return;
      cancelling = true;
      invalid = true;
      raw = '';
      if (Number.isInteger(child?.pid) && child.pid > 1) {
        try {
          killGroup(-child.pid, 'SIGKILL');
        } catch {
          /* Close event, not kill return, confirms exit. */
        }
      }
      finalTimer = setTimeout(() => {
        child?.stdout?.destroy();
        child?.stderr?.destroy();
        child?.unref();
        finish({ available: false, childrenGone: false });
      }, 300);
    };
    try {
      child = spawnChild(command[0], command[1], {
        detached: true,
        stdio: ['ignore', 'pipe', 'ignore'],
        env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' },
      });
      child.stdout.on('data', (chunk) => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > 16_384) cancel();
        else if (!invalid) raw += chunk.toString('utf8');
      });
      child.once('error', () => {
        invalid = true;
        raw = '';
      });
      child.once('close', (code, terminationSignal) => {
        // Reap any same-group descendant even when the group leader exited normally.
        let childrenGone = true;
        if (Number.isInteger(child.pid) && child.pid > 1) {
          try {
            killGroup(-child.pid, 0);
            childrenGone = false;
            killGroup(-child.pid, 'SIGKILL');
          } catch (error) {
            childrenGone = error.code === 'ESRCH';
          }
        }
        // Linux interop group disappearance alone cannot confirm a cancelled native process.
        if (
          command === samplingCommands.windows &&
          (invalid || code !== 0 || terminationSignal !== null)
        )
          childrenGone = false;
        const available = !invalid && code === 0 && terminationSignal === null && childrenGone;
        finish(
          available ? { available: true, childrenGone, raw } : { available: false, childrenGone },
        );
        raw = '';
      });
      signal.addEventListener('abort', cancel, { once: true });
      timer = setTimeout(cancel, SAMPLING_CAP_MS);
      if (signal.aborted) cancel();
    } catch {
      finish({ available: false, childrenGone: true });
    }
  });
}

// Not connected to preflight: future activation/replay requires a separate explicit decision.
// trigger is fire-and-forget; no result can alter or postpone the original relay rejection.
export function createPassiveSampler(emit, read = boundedRead, now = Date.now) {
  const controller = new AbortController();
  const pending = new Set();
  let before;
  let triggered = false;
  let closed = false;
  const launch = (work) => {
    const task = Promise.resolve()
      .then(work)
      .catch(() => {
        /* Never replace the original failure. */
      });
    pending.add(task);
    void task.finally(() => pending.delete(task));
    return task;
  };
  const sample = async (key, parser) => {
    let result;
    try {
      result = await read(samplingCommands[key], controller.signal);
      if (!result.available)
        return { available: false, childrenGone: result.childrenGone === true };
      return {
        available: true,
        childrenGone: result.childrenGone === true,
        values: parser(result.raw),
      };
    } catch {
      return { available: false, childrenGone: result?.childrenGone === true };
    }
  };
  const send = (value) => {
    try {
      emit(value);
    } catch {
      /* An observer cannot change pass/fail. */
    }
  };
  return {
    baseline() {
      if (closed || before) return;
      before = launch(() => sample('counters', parseCounters));
    },
    trigger(relay) {
      if (closed || triggered) return;
      triggered = true;
      const started = now();
      let projected;
      try {
        projected = fixedNumbers(relay, ['connecting', 'active']);
      } catch {
        projected = undefined;
      }
      launch(async () => {
        const [queue, sockets, counters, windows, baseline] = await Promise.all([
          sample('queue', parseQueue),
          sample('sockets', parseSockets),
          sample('counters', parseCounters),
          sample('windows', parseWindows),
          before,
        ]);
        let delta = { available: false };
        try {
          if (baseline?.available && counters.available)
            delta = { available: true, values: counterDelta(baseline.values, counters.values) };
        } catch {
          /* Reset/wrap/missing baseline is unavailable, never a negative counter. */
        }
        send({
          event: 'passive-tcp-sample',
          elapsedMs: count(Math.max(0, now() - started)),
          relay: projected ? { available: true, values: projected } : { available: false },
          queue,
          sockets,
          windows,
          delta,
          childrenGone: [queue, sockets, counters, windows, baseline]
            .filter(Boolean)
            .every((x) => x.childrenGone === true),
        });
      });
    },
    async close() {
      closed = true;
      controller.abort();
      await Promise.all([...pending]);
    },
    async drain() {
      await Promise.all([...pending]);
    },
  };
}
