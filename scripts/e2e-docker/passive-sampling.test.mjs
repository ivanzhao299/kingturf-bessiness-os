import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import {
  boundedRead,
  counterDelta,
  createPassiveSampler,
  parseCounters,
  parseQueue,
  parseSockets,
  parseWindows,
  samplingCommands,
} from './passive-sampling.mjs';

const counters = (n = 0) =>
  ['ListenOverflows', 'ListenDrops', 'TCPReqQFullDrop', 'TCPTimeouts', 'TCPSynRetrans']
    .map((key) => `TcpExt${key} ${n} 0.0`)
    .join('\n');
const windows = JSON.stringify({
  listen: 1,
  synSent: 0,
  synReceived: 0,
  established: 2,
  globalSynSent: 0,
});
const canary = 'SECRET-CANARY-198.51.100.77';
const outputs = new Map([
  [samplingCommands.queue, 'LISTEN 0 4096 198.51.100.77:4173 0.0.0.0:*'],
  [samplingCommands.sockets, 'SYN-SENT 0 1 198.51.100.77:12345 198.51.100.78:4173'],
  [samplingCommands.counters, counters(2)],
  [samplingCommands.windows, windows],
]);
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('fixed parsers project only counts, not endpoints or canary fields', () => {
  assert.deepEqual(parseQueue(outputs.get(samplingCommands.queue)), {
    listeners: 1,
    recv: 0,
    send: 4096,
  });
  assert.deepEqual(parseSockets(outputs.get(samplingCommands.sockets)), {
    synSent: 1,
    synReceived: 0,
    established: 0,
  });
  assert.equal(parseCounters(counters(5)).TCPTimeouts, 5);
  assert.equal(parseWindows(windows).listen, 1);
  assert.throws(() => parseWindows(JSON.stringify({ ...JSON.parse(windows), secret: canary })));
  assert.throws(() => parseQueue('LISTEN invalid 4 address:4173 peer:*'));
  assert.throws(() => parseSockets('UNKNOWN 0 0 address:4173 peer:*'));
  assert.throws(() => parseSockets('ESTAB 0 0 address:5432 peer:*'));
});

test('missing, duplicate, reset, overflowing or unbounded counters fail closed', () => {
  for (const raw of [
    '',
    counters() + '\nTcpExtTCPTimeouts 0 0',
    counters() + `\n${canary}`,
    'x'.repeat(16_385),
  ])
    assert.throws(() => parseCounters(raw));
  assert.throws(() => counterDelta(parseCounters(counters(2)), parseCounters(counters(1))));
  assert.throws(() => parseCounters(counters(1_000_000_001)));
  assert.deepEqual(
    counterDelta(parseCounters(counters(2)), parseCounters(counters(5))),
    parseCounters(counters(3)),
  );
});

test('passive trigger is void, one-shot, and emits only bounded projections and delta', async () => {
  const events = [];
  let clock = 100;
  let reads = 0;
  const sampler = createPassiveSampler(
    (event) => events.push(event),
    async (command) => {
      reads++;
      return { available: true, childrenGone: true, raw: outputs.get(command) };
    },
    () => clock++,
  );
  sampler.baseline();
  await tick();
  assert.equal(sampler.trigger({ active: 8, connecting: 1 }), undefined);
  sampler.trigger({ active: 8, connecting: 1 });
  await tick();
  await sampler.close();
  sampler.trigger({ active: 8, connecting: 1 });
  assert.equal(reads, 5);
  assert.equal(events.length, 1);
  assert.equal(events[0].delta.available, true);
  assert.equal(events[0].delta.values.TCPTimeouts, 0);
  assert.equal(events[0].relay.values.active, 8);
  assert.equal(events[0].childrenGone, true);
  assert(!JSON.stringify(events).includes('198.51.100'));
  assert(!JSON.stringify(events).includes(canary));
});

test('malformed stdout, missing baseline and bad relay are unavailable without raw error', async () => {
  const events = [];
  const sampler = createPassiveSampler(
    (event) => events.push(event),
    async () => ({ available: true, childrenGone: true, raw: canary }),
  );
  sampler.trigger({ active: 1, connecting: 0, secret: canary });
  await tick();
  await sampler.close();
  assert.equal(events.length, 1);
  for (const key of ['queue', 'sockets', 'windows', 'delta', 'relay'])
    assert.equal(events[0][key].available, false);
  assert(!JSON.stringify(events).includes(canary));
});

test('read rejection and observer failure never replace original failure or hang close', async () => {
  const sampler = createPassiveSampler(
    () => {
      throw Error(canary);
    },
    async () => {
      throw Error(canary);
    },
  );
  sampler.baseline();
  sampler.trigger({ active: 1, connecting: 1 });
  await tick();
  await sampler.close();
  const original = Promise.reject(Error('original relay failure'));
  await assert.rejects(original, /original relay failure/u);
});

function mockChild() {
  const child = new EventEmitter();
  child.pid = 424242;
  child.stdout = new PassThrough();
  child.unref = () => {
    /* Mock owns no OS handle. */
  };
  return child;
}
const noGroup = () => {
  throw Object.assign(Error(canary), { code: 'ESRCH' });
};

test('bounded reader uses only exact fixed command, restricted env and no shell', async () => {
  const child = mockChild();
  const controller = new AbortController();
  const result = boundedRead(
    samplingCommands.queue,
    controller.signal,
    (file, args, options) => {
      assert.equal(file, '/usr/bin/ss');
      assert.deepEqual(args, ['-H', '-ltn', 'sport = :4173']);
      assert.deepEqual(options.env, { PATH: '/usr/bin:/bin', LC_ALL: 'C' });
      assert.equal(options.detached, true);
      assert.deepEqual(options.stdio, ['ignore', 'pipe', 'ignore']);
      assert.equal(options.shell, undefined);
      return child;
    },
    noGroup,
  );
  child.stdout.write('LISTEN 0 4096 address:4173 peer:*');
  child.emit('close', 0, null);
  assert.equal((await result).available, true);
  assert.throws(() => boundedRead(['sh', ['-c', canary]], controller.signal));
});

test('abort kills only spawned group and requires actual close confirmation', async () => {
  const child = mockChild();
  const controller = new AbortController();
  const kills = [];
  const result = boundedRead(
    samplingCommands.queue,
    controller.signal,
    () => child,
    (pid, signal) => {
      kills.push([pid, signal]);
      if (signal === 0) noGroup();
    },
  );
  child.stdout.write(canary);
  controller.abort();
  child.emit('close', null, 'SIGKILL');
  assert.deepEqual(await result, { available: false, childrenGone: true });
  assert.deepEqual(kills, [
    [-424242, 'SIGKILL'],
    [-424242, 0],
  ]);
});

test('output overflow and nonzero exit cannot export captured data', async () => {
  for (const overflow of [false, true]) {
    const child = mockChild();
    const result = boundedRead(
      samplingCommands.queue,
      new AbortController().signal,
      () => child,
      noGroup,
    );
    child.stdout.write(overflow ? 'x'.repeat(16_385) : canary);
    child.emit('close', 1, null);
    assert.deepEqual(await result, { available: false, childrenGone: true });
  }
});

test('unconfirmed group cleanup is explicit, never falsely marked gone', async () => {
  const child = mockChild();
  const result = boundedRead(
    samplingCommands.queue,
    new AbortController().signal,
    () => child,
    () => {
      /* Simulate a still-existing group. */
    },
  );
  child.emit('close', 0, null);
  assert.deepEqual(await result, { available: false, childrenGone: false });
});

test('mock child that errors without close is still deadline-killed and bounded', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const child = mockChild();
  const kills = [];
  const result = boundedRead(
    samplingCommands.queue,
    new AbortController().signal,
    () => child,
    (pid, signal) => kills.push([pid, signal]),
  );
  child.emit('error', Error(canary));
  t.mock.timers.tick(1_499);
  assert.equal(kills.length, 0);
  t.mock.timers.tick(1);
  assert.equal(kills.length, 1);
  t.mock.timers.tick(300);
  assert.deepEqual(await result, { available: false, childrenGone: false });
  assert.deepEqual(kills, [[-424242, 'SIGKILL']]);
});

test('cancelled Windows interop never claims native process cleanup from Linux close', async () => {
  const child = mockChild();
  const controller = new AbortController();
  const result = boundedRead(samplingCommands.windows, controller.signal, () => child, noGroup);
  controller.abort();
  child.emit('close', null, 'SIGKILL');
  assert.deepEqual(await result, { available: false, childrenGone: false });
});

test('spawn failure, pre-abort and close during sampling remain bounded and safe', async () => {
  assert.deepEqual(
    await boundedRead(samplingCommands.queue, new AbortController().signal, () => {
      throw Error(canary);
    }),
    { available: false, childrenGone: true },
  );
  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(
    await boundedRead(samplingCommands.queue, controller.signal, () => {
      throw Error('must not spawn');
    }),
    { available: false, childrenGone: true },
  );
  const events = [];
  const sampler = createPassiveSampler(
    (event) => events.push(event),
    async (_command, signal) =>
      new Promise((resolve) => {
        const done = () => resolve({ available: false, childrenGone: true });
        if (signal.aborted) done();
        else signal.addEventListener('abort', done, { once: true });
      }),
  );
  sampler.baseline();
  sampler.trigger({ active: 1, connecting: 1 });
  await tick();
  await sampler.close();
  assert.equal(events.length, 1);
  assert.equal(events[0].childrenGone, true);
});
