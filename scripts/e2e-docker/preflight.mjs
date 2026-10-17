import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import net from 'node:net';
import { createFixture, stopChild, assertOwnedListener } from './fixture.mjs';
import { verifySeedAuthentication } from './seed-auth.mjs';

const image = 'kingturf-e2e:pw1.62.1-chrome';
const imageId = 'sha256:1a0e14c3fd2351aab685106ad17d86b0bd38e6ed89cc0d0d2be809579f8dab3e';
const report = (event, details = {}) => console.log(JSON.stringify({ event, ...details }));
const reportContainer = (value) => {
  const schemas = {
    'pg-verified': ['readOnly', 'sameDatabase', 'sameSchema', 'sameInstance', 'sameHostMarker'],
    'natural-cookie-origin': [
      'secureContext',
      'authHttpOnlySecureLax',
      'csrfSecureLax',
      'loginOriginExact',
      'naturalWrite201',
    ],
    'container-complete': [],
    'container-failed': [],
  };
  assert(Object.hasOwn(schemas, value.event), 'unknown container event');
  const safe = {};
  for (const key of schemas[value.event]) {
    assert.equal(typeof value[key], 'boolean');
    safe[key] = value[key];
  }
  if (value.event === 'natural-cookie-origin') {
    assert.match(value.chrome, /^\d+\.\d+\.\d+\.\d+$/u);
    assert.equal(value.missingNullForeignOrigin403, 3);
    Object.assign(safe, { chrome: value.chrome, missingNullForeignOrigin403: 3 });
  }
  if (value.event === 'container-failed') {
    assert(
      [
        'setup',
        'pg-read-only-identity',
        'natural-browser-cookie-origin',
        'natural-cookie-attributes',
        'natural-login-origin',
        'missing-null-foreign-origin',
        'natural-signed-write',
      ].includes(value.phase),
    );
    safe.phase = value.phase;
  }
  report(value.event, safe);
};
const started = performance.now();
const cancellation = new AbortController();
for (const signal of ['SIGTERM', 'SIGINT'])
  process.once(signal, () => cancellation.abort(Error('owned preflight interrupted')));
const mode = process.argv[2];
const mismatch = ['database', 'schema', 'started', 'instance', 'marker'].includes(mode)
  ? mode
  : undefined;
assert(
  [
    undefined,
    'database',
    'schema',
    'started',
    'instance',
    'marker',
    'setup-sigterm',
    'setup-sigint',
    'fail-stdin',
    'fail-preview-spawn',
    'browser-launch-sigterm',
    'seed-auth',
    'seed-auth-abort',
    'seed-full',
    'seed-diagnose',
  ].includes(mode),
  'unknown preflight argument',
);
assert.equal(
  execFileSync('docker', ['image', 'inspect', image, '--format', '{{.Id}}'], {
    encoding: 'utf8',
  }).trim(),
  imageId,
);
const fixture = await createFixture(process.env.DATABASE_URL);
const name = `kt-pw-channel-${fixture.expected.schema.slice(-12)}`;
let child, preview, processing, seedChild;
let containerCreated = false;
let phase = 'gateway';
try {
  cancellation.signal.throwIfAborted();
  for (const port of [3000, 4173]) {
    const check = net.createServer();
    await new Promise((resolve, reject) => {
      check.once('error', reject);
      check.listen(port, '0.0.0.0', resolve);
    });
    await new Promise((resolve) => check.close(resolve));
  }
  const gateway = execFileSync(
    'docker',
    [
      'run',
      '--rm',
      '--add-host=kt-e2e-host:host-gateway',
      image,
      'getent',
      'ahostsv4',
      'kt-e2e-host',
    ],
    { encoding: 'utf8' },
  )
    .trim()
    .split(/\s+/u)[0];
  assert.equal(net.isIP(gateway), 4);
  report('host-guard-marker-ready', {
    guardPassed: true,
    isolatedSchema: true,
    markerCreatedOnHost: true,
  });
  execFileSync(
    'docker',
    [
      'create',
      '--interactive',
      '--name',
      name,
      '--label',
      'kingturf.task=docker-pw-channel',
      '--add-host=kt-e2e-host:host-gateway',
      '--mount',
      `type=bind,source=${process.cwd()},target=/work`,
      '--workdir',
      '/work',
      '-e',
      'PLAYWRIGHT_BROWSERS_PATH=/ms-playwright',
      '-e',
      'no_proxy=*',
      '-e',
      'NO_PROXY=*',
      image,
      'node',
      'scripts/e2e-docker/container.mjs',
    ],
    { stdio: 'ignore' },
  );
  containerCreated = true;
  child = spawn('docker', ['start', '--attach', '--interactive', name], {
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  child.stdin.on('error', () => cancellation.abort(Error('owned private stdin failed')));
  const send = async (value) => {
    cancellation.signal.throwIfAborted();
    await new Promise((resolve, reject) =>
      child.stdin.write(`${JSON.stringify(value)}\n`, (error) =>
        error ? reject(Error('owned private stdin write failed')) : resolve(),
      ),
    );
  };
  const done = new Promise((resolve, reject) => {
    child.once('error', () => reject(Error('owned docker client failed')));
    child.once('exit', (code) => resolve(code));
  });
  const expected = { ...fixture.expected };
  if (mismatch) expected[mismatch] = 'deliberate-mismatch';
  if (mode === 'fail-stdin') child.stdin.destroy(Error('synthetic private stdin fault'));
  await send({ gateway, connection: fixture.containerConnection, expected });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  let verified = false;
  const consume = (async () => {
    for await (const line of lines) {
      const event = JSON.parse(line);
      reportContainer(event);
      if (event.event === 'pg-verified') {
        cancellation.signal.throwIfAborted();
        assert(!mismatch, 'identity negative unexpectedly verified');
        verified = true;
        phase = 'initialize-api-preview';
        const users = await fixture.initialize(
          cancellation.signal,
          () => {
            if (mode?.startsWith('setup-'))
              setTimeout(
                () => process.kill(process.pid, mode === 'setup-sigterm' ? 'SIGTERM' : 'SIGINT'),
                20,
              );
          },
          mode === 'seed-diagnose'
            ? (detail) =>
                report('owned-pg-failure', {
                  code: detail.code,
                  constraint: detail.constraint,
                  locations: detail.locations,
                  category: detail.category,
                  trigger: detail.trigger,
                  triggerLine: detail.triggerLine,
                })
            : undefined,
        );
        cancellation.signal.throwIfAborted();
        if (
          mode === 'seed-auth' ||
          mode === 'seed-auth-abort' ||
          mode === 'seed-full' ||
          mode === 'seed-diagnose'
        ) {
          phase = mode;
          fixture.assertApiOwned();
          if (mode === 'seed-auth' || mode === 'seed-auth-abort') {
            await verifySeedAuthentication(
              users,
              cancellation.signal,
              mode === 'seed-auth-abort'
                ? () => {
                    report('seed-auth-inflight-cancel-injected');
                    setImmediate(() => process.kill(process.pid, 'SIGTERM'));
                  }
                : undefined,
            );
            report('seed-auth-binding', {
              actualCliFunction: true,
              twoSyntheticIdentities: true,
              tokenLoginSwitchEnabled: true,
              noCookieMachineBearer: true,
            });
          } else {
            const seedStart = performance.now();
            seedChild = spawn(
              process.execPath,
              ['--import', './scripts/e2e-docker/seed-audit.mjs', 'scripts/seed_p1_demo.mjs'],
              {
                env: {
                  ...process.env,
                  KINGTURF_BASE_URL: 'http://127.0.0.1:3000',
                  KINGTURF_ADMIN_LOGIN: users.admin.login,
                  KINGTURF_ADMIN_PASSWORD: users.admin.password,
                  KINGTURF_CREDIT_APPROVER_LOGIN: users.approver.login,
                  KINGTURF_CREDIT_APPROVER_PASSWORD: users.approver.password,
                },
                stdio: ['ignore', 'ignore', 'pipe'],
              },
            );
            const errors = createInterface({ input: seedChild.stderr, crlfDelay: Infinity });
            errors.on('line', (line) => {
              try {
                const detail = JSON.parse(line);
                if (
                  detail.kind === 'seed-http-failure' &&
                  /^[A-Z]+$/u.test(detail.method) &&
                  /^\/api\/v1\/[a-zA-Z0-9_/-]+$/u.test(detail.path) &&
                  Number.isInteger(detail.status)
                )
                  report('seed-http-failure', {
                    method: detail.method,
                    path: detail.path,
                    status: detail.status,
                  });
              } catch {
                /* Do not relay raw stderr or identity-bearing assertion text. */
              }
            });
            const exit = await new Promise((resolve, reject) => {
              seedChild.once('error', () => reject(Error('owned seed spawn failed')));
              seedChild.once('exit', resolve);
            });
            report('seed-full-result', {
              exit,
              elapsedMs: Math.round(performance.now() - seedStart),
            });
            assert.equal(exit, 0, 'full frozen seed failed; do not repair business steps');
          }
          cancellation.signal.throwIfAborted();
          await send({ action: 'verified-only' });
          continue;
        }
        preview = spawn(
          mode === 'fail-preview-spawn' ? '/__kingturf_missing_preview__' : 'pnpm',
          [
            '--filter',
            '@kingturf/web',
            'exec',
            'vite',
            'preview',
            '--port',
            '4173',
            '--strictPort',
            '--host',
            '0.0.0.0',
          ],
          {
            env: { ...process.env, KINGTURF_API_PROXY_TARGET: 'http://127.0.0.1:3000' },
            stdio: 'ignore',
            detached: true,
          },
        );
        preview.once('error', () => cancellation.abort(Error('owned preview spawn failed')));
        let ready = false;
        for (let attempt = 0; attempt < 150; attempt++) {
          cancellation.signal.throwIfAborted();
          if (preview.exitCode !== null) throw Error('owned preview startup failed');
          try {
            ready = (await fetch('http://127.0.0.1:4173/', { signal: AbortSignal.timeout(500) }))
              .ok;
          } catch {
            /* readiness */
          }
          if (ready) break;
          await delay(30);
        }
        assert(ready, 'preview readiness deadline');
        fixture.assertApiOwned();
        assertOwnedListener(4173, preview, true);
        phase = 'browser-probe';
        cancellation.signal.throwIfAborted();
        await send({ action: 'preflight', user: users.runtime, fault: mode });
      }
      if (event.event === 'natural-cookie-origin') {
        await fixture.verifyProbeWrites();
        report('probe-pg-write-count', { rejectedOriginWrites: 0, naturalSignedWrites: 1 });
      }
    }
  })();
  processing = consume;
  const interrupted = new Promise((_, reject) => {
    if (cancellation.signal.aborted) reject(cancellation.signal.reason);
    else
      cancellation.signal.addEventListener('abort', () => reject(cancellation.signal.reason), {
        once: true,
      });
  });
  let timer;
  try {
    await Promise.race([
      Promise.all([consume, done]),
      interrupted,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          cancellation.abort(Error('preflight deadline'));
          reject(cancellation.signal.reason);
        }, 120_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  const code = await done;
  if (mismatch) {
    assert.equal(verified, false);
    assert.equal(code, 1);
    report('identity-negative-rejected', { field: mismatch, exit: code, apiSeedNotStarted: true });
  } else {
    assert(verified);
    assert.equal(code, 0);
  }
} catch (error) {
  report('preflight-failed', {
    phase,
    errorType: error.name,
    databaseCode: error.code,
    constraint: error.constraint,
  });
  process.exitCode = 1;
} finally {
  let stopped = true;
  if (seedChild)
    await stopChild(seedChild).catch(() => {
      stopped = false;
      process.exitCode = 1;
    });
  if (containerCreated) {
    try {
      const status = execFileSync('docker', ['inspect', name, '--format', '{{.State.Status}}'], {
        encoding: 'utf8',
      }).trim();
      if (status === 'running')
        execFileSync('docker', ['stop', '--time', '5', name], { stdio: 'ignore' });
      // Atomic force-removal also handles a start/closed-stdin race; target is our exact created name.
      execFileSync('docker', ['rm', '--force', name], { stdio: 'ignore' });
    } catch {
      stopped = false;
      process.exitCode = 1;
    }
  }
  if (child)
    await stopChild(child).catch(() => {
      stopped = false;
      process.exitCode = 1;
    });
  if (processing)
    await processing.catch(() => {
      /* Drain initialization before killing its owned children. */
    });
  if (preview?.pid !== undefined && preview.exitCode === null && preview.signalCode === null) {
    try {
      process.kill(-preview.pid, 'SIGTERM');
      await stopChild(preview);
    } catch {
      stopped = false;
      process.exitCode = 1;
    }
  }
  if (stopped)
    await fixture
      .close()
      .then(() =>
        report('owned-cleanup', { schemaGone: true, containerGone: true, previewGone: true }),
      )
      .catch(() => {
        process.exitCode = 1;
        report('cleanup-failed');
      });
  else report('cleanup-failed', { schemaRetainedForInspection: true });
  report('preflight-result', {
    exit: process.exitCode ?? 0,
    elapsedMs: Math.round(performance.now() - started),
  });
}
