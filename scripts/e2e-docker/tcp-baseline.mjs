// Finite connect-only comparison, never a replacement route for browser acceptance.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const image = 'sha256:1a0e14c3fd2351aab685106ad17d86b0bd38e6ed89cc0d0d2be809579f8dab3e';
const report = (event, values = {}) => console.log(JSON.stringify({ event, ...values }));
const cancellation = new AbortController();

async function probe(host, side) {
  const result = { side, attempted: 0, connected: 0, timeouts: 0, refused: 0, other: 0 };
  for (let index = 0; index < 50; index++) {
    cancellation.signal.throwIfAborted();
    result.attempted++;
    const status = await new Promise((resolve) => {
      const socket = net.connect({ host, port: 4173, signal: cancellation.signal });
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        socket.setTimeout(0);
        socket.destroy();
        resolve(value);
      };
      socket.once('connect', () => finish('connected'));
      socket.once('error', (error) => finish(error.code === 'ECONNREFUSED' ? 'refused' : 'other'));
      socket.setTimeout(5000, () => finish('timeouts'));
    });
    result[status]++;
    if (status !== 'connected') break; // First failure ends this comparison, no retry.
    await delay(50, undefined, { signal: cancellation.signal });
  }
  return result;
}

export function safeTcpResult(value) {
  assert(['host-loopback', 'container-gateway'].includes(value.side));
  const safe = { side: value.side };
  for (const key of ['attempted', 'connected', 'timeouts', 'refused', 'other']) {
    assert(Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= 50);
    safe[key] = value[key];
  }
  assert.equal(safe.attempted, safe.connected + safe.timeouts + safe.refused + safe.other);
  return safe;
}

async function main() {
  if (process.argv[2] === 'probe') {
    const { address } = await lookup('kt-e2e-host', { family: 4 });
    assert.equal(net.isIP(address), 4);
    report('tcp-connect-baseline', safeTcpResult(await probe(address, 'container-gateway')));
    return;
  }
  assert.equal(process.argv[2], undefined, 'only fixed owned TCP baseline or container probe');
  const name = `kt-owned-tcp-${randomUUID()}`;
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    socket.on('error', () => {
      /* No raw network errors are exported. */
    });
    socket.end(); // No payload, authentication, API or database access.
  });
  let creationAttempted = false,
    child;
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(4173, '0.0.0.0', resolve); // Same bind scope as approved owned preview.
    });
    const listeners = execFileSync('ss', ['-ltnp', 'sport = :4173'], { encoding: 'utf8' });
    const pids = [...listeners.matchAll(/pid=(\d+)/gu)].map((item) => Number(item[1]));
    assert(pids.length > 0 && pids.every((pid) => pid === process.pid));
    const host = safeTcpResult(await probe('127.0.0.1', 'host-loopback'));
    report('tcp-connect-baseline', host);
    assert.equal(host.connected, 50, 'owned host listener baseline failed');
    cancellation.signal.throwIfAborted();
    creationAttempted = true;
    execFileSync(
      'docker',
      [
        'create',
        '--name',
        name,
        '--label',
        'kingturf.task=tcp-baseline',
        '--read-only',
        '--log-driver=none',
        '--add-host=kt-e2e-host:host-gateway',
        '--mount',
        `type=bind,src=${root},dst=/work,readonly`,
        '--tmpfs',
        '/tmp:rw,nosuid,nodev,size=67108864,mode=1777',
        '--workdir',
        '/work',
        image,
        'node',
        'scripts/e2e-docker/tcp-baseline.mjs',
        'probe',
      ],
      { stdio: 'ignore', timeout: 20_000 },
    );
    child = spawn('docker', ['start', '--attach', name], { stdio: ['ignore', 'pipe', 'ignore'] });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.length > 2048) cancellation.abort(Error('bounded TCP result required'));
    });
    const done = new Promise((resolve, reject) => {
      child.once('error', () => reject(Error('owned diagnostic client failed')));
      child.once('close', (exit) => resolve(exit));
    });
    const interrupted = new Promise((_, reject) => {
      if (cancellation.signal.aborted) reject(cancellation.signal.reason);
      else
        cancellation.signal.addEventListener('abort', () => reject(cancellation.signal.reason), {
          once: true,
        });
    });
    let deadline;
    try {
      await Promise.race([
        done,
        interrupted,
        new Promise((_, reject) => {
          deadline = setTimeout(() => reject(Error('owned TCP diagnostic deadline')), 20_000);
        }),
      ]);
    } finally {
      clearTimeout(deadline);
    }
    assert.equal(await done, 0);
    const value = JSON.parse(output.trim());
    assert.equal(value.event, 'tcp-connect-baseline');
    const container = safeTcpResult(value);
    assert.equal(container.side, 'container-gateway');
    report('tcp-connect-baseline', container);
    if (container.connected !== 50) process.exitCode = 1;
  } finally {
    let containerGone = !creationAttempted;
    let childGone = !child;
    if (creationAttempted) {
      try {
        const owner = execFileSync(
          'docker',
          ['inspect', name, '--format', '{{ index .Config.Labels "kingturf.task" }}'],
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000 },
        ).trim();
        assert.equal(owner, 'tcp-baseline');
        execFileSync('docker', ['rm', '--force', name], { stdio: 'ignore', timeout: 10_000 });
      } catch {
        /* Missing/unknown outcome never authorizes deleting an unmatched resource. */
      }
      try {
        containerGone =
          execFileSync(
            'docker',
            ['ps', '--all', '--filter', `name=^/${name}$`, '--format', '{{.Names}}'],
            { encoding: 'utf8', timeout: 10_000 },
          ).trim() === '';
      } catch {
        containerGone = false;
      }
    }
    if (child && child.exitCode === null && child.signalCode === null) {
      let force, deadline;
      try {
        await new Promise((resolve, reject) => {
          child.once('close', resolve);
          force = setTimeout(() => child.kill('SIGKILL'), 3000);
          deadline = setTimeout(() => reject(Error('owned TCP client cleanup deadline')), 6000);
          child.kill('SIGTERM');
        });
      } catch {
        /* Report incomplete cleanup below, still close our listener. */
      } finally {
        clearTimeout(force);
        clearTimeout(deadline);
      }
    }
    childGone = !child || child.exitCode !== null || child.signalCode !== null;
    for (const socket of sockets) socket.destroy();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    report('tcp-baseline-cleanup', { containerGone, childGone, listenerGone: !server.listening });
    assert(containerGone && childGone && !server.listening);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => cancellation.abort(Error('owned TCP diagnostic cancelled')));
  await main().catch(() => {
    report('tcp-baseline-failed');
    process.exitCode = 1;
  });
}
