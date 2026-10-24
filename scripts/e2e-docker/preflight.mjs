import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import net from 'node:net';
import { createFixture, stopChild, assertOwnedListener } from './fixture.mjs';
import { verifySeedAuthentication } from './seed-auth.mjs';
import { validateSpecCommand } from './spec-runner.mjs';
import { safeLocalCases, safeLocalResult, validateLocalCommand } from './private-contract.mjs';
import { relayFailureCodes } from './forward.mjs';
import { safeRelayTimeoutState } from './relay-diagnostics.mjs';
import { safeDiagnostic, safeDiagnosticResult } from './p1-diagnostics-contract.mjs';
import { prepareOldCostWeb } from './cost-comparison.mjs';
import { safeCostObservation, validateCostComparison } from './cost-comparison-source.mjs';
import { safeSourcePreparation } from './source-preparation.mjs';

const image = 'kingturf-e2e:pw1.62.1-chrome';
const imageId = 'sha256:1a0e14c3fd2351aab685106ad17d86b0bd38e6ed89cc0d0d2be809579f8dab3e';
let localEventFile;
let localChildClose;
let localResultSeen = false;
let sourcePrepared = false;
let sourcePreparationSeen = false;
let sourceProducerReady = false;
let sourceControl;
const diagnosticObserved = new Set();
const report = (event, details = {}) => {
  const line = JSON.stringify({ event, ...details });
  if (localEventFile) appendFileSync(localEventFile, `${line}\n`, { mode: 0o600 });
  console.log(line);
};
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
    'spec-result': [],
    'spec-started': [],
    'local-started': [],
    'local-closed': [],
    'local-result': [],
    'local-progress': [],
    'relay-failure': [],
    'p1-diagnostic': [],
    'diagnostics-result': [],
    'cost-comparison': [],
    'source-fixture-result': [],
    'source-producer-ready': [],
  };
  assert(Object.hasOwn(schemas, value.event), 'unknown container event');
  const safe = {};
  if (value.event === 'source-producer-ready') {
    assert.equal(mode, 'local');
    assert.equal(process.argv[3], 'source');
    assert.equal(value.kind, 'source');
    assert.equal(value.label, process.argv[4]);
    assert.equal(value.ownerVerified, true);
    assert.equal(sourceProducerReady, false);
    sourceProducerReady = true;
    Object.assign(safe, { kind: 'source', label: value.label, ownerVerified: true });
  }
  if (value.event === 'source-fixture-result') {
    assert.equal(mode, 'local');
    assert.equal(process.argv[3], 'source');
    assert.equal(value.kind, 'source');
    assert.equal(value.label, process.argv[4]);
    assert.equal(sourcePreparationSeen, false);
    sourcePreparationSeen = true;
    const observation = safeSourcePreparation(value);
    Object.assign(safe, { kind: 'source', label: value.label, ...observation });
    sourcePrepared =
      observation.exit === 0 &&
      observation.signal === null &&
      observation.producerPassed &&
      observation.fixtureValidated &&
      observation.ownershipVerified &&
      sourceProducerReady;
  }
  if (value.event === 'cost-comparison') {
    assert.equal(mode, 'cost-compare');
    validateCostComparison(value.condition, value.label);
    assert.equal(value.condition, process.argv[3]);
    assert.equal(value.label, process.argv[4]);
    assert.equal(localResultSeen, false);
    assert([0, 1].includes(value.exit));
    assert(Number.isInteger(value.elapsedMs) && value.elapsedMs >= 0);
    const observation = safeCostObservation(value);
    Object.assign(safe, {
      condition: value.condition,
      label: value.label,
      exit: value.exit,
      elapsedMs: value.elapsedMs,
      ...observation,
      comparable:
        observation.quotesRoute &&
        observation.dialogVisible &&
        observation.preselected &&
        (value.condition !== 'current-warm' || observation.warmVisited),
    });
    localResultSeen = true;
  }
  if (['p1-diagnostic', 'diagnostics-result'].includes(value.event)) {
    assert.equal(mode, 'local');
    assert.equal(process.argv[3], 'p1');
    assert.equal(process.argv[5], 'diagnostics');
    validateLocalCommand(value.kind, value.label, 'diagnostics');
    assert.equal(value.kind, process.argv[3]);
    assert.equal(value.label, process.argv[4]);
    Object.assign(safe, { kind: value.kind, label: value.label });
    if (value.event === 'p1-diagnostic') {
      assert(!diagnosticObserved.has(value.id), 'duplicate fixed diagnostic');
      Object.assign(safe, { id: value.id, values: safeDiagnostic(value.id, value.values) });
      diagnosticObserved.add(value.id);
    } else {
      assert.equal(localResultSeen, false, 'duplicate private result');
      assert.equal(localChildClose, undefined, 'diagnostics does not run the original spec child');
      Object.assign(safe, safeDiagnosticResult(value, diagnosticObserved));
      localResultSeen = true;
    }
  }
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
        'playwright-spec',
        'private-local-browser',
      ].includes(value.phase),
    );
    safe.phase = value.phase;
  }
  if (value.event === 'relay-failure') {
    assert([4173, 5432].includes(value.port));
    assert(['downstream', 'upstream', 'listener'].includes(value.side));
    assert(relayFailureCodes.includes(value.code));
    assert.equal(typeof value.closing, 'boolean');
    Object.assign(safe, {
      port: value.port,
      side: value.side,
      code: value.code,
      closing: value.closing,
    });
    if (value.code === 'CONNECT_TIMEOUT')
      safe.socketState = safeRelayTimeoutState(value.socketState);
  }
  if (['local-started', 'local-closed', 'local-result', 'local-progress'].includes(value.event)) {
    assert.equal(mode, 'local');
    validateLocalCommand(value.kind, value.label);
    assert.equal(value.kind, process.argv[3]);
    assert.equal(value.label, process.argv[4]);
    Object.assign(safe, { kind: value.kind, label: value.label });
    if (value.event === 'local-closed') {
      assert.equal(localChildClose, undefined, 'duplicate private browser close');
      assert(value.exit === null || (Number.isInteger(value.exit) && value.exit >= 0));
      assert(value.terminationSignal === null || /^SIG[A-Z0-9]+$/u.test(value.terminationSignal));
      Object.assign(safe, { exit: value.exit, terminationSignal: value.terminationSignal });
      localChildClose = { exit: value.exit, terminationSignal: value.terminationSignal };
    }
    if (value.event === 'local-result') {
      assert.equal(localResultSeen, false, 'duplicate private result');
      assert.equal(value.probe, process.argv[5] === 'privacy', 'probe must match explicit command');
      if (!value.probe) {
        if (value.kind === 'source')
          assert(sourcePrepared, 'source browser requires observed successful private producer');
        assert.equal(localChildClose?.exit, value.exit, 'result requires observed browser close');
        assert.equal(localChildClose.terminationSignal, null);
      } else assert.equal(localChildClose, undefined);
      Object.assign(safe, safeLocalResult(value.kind, value));
      localResultSeen = true;
    }
    if (value.event === 'local-progress') {
      assert(Number.isInteger(value.discovered) && value.discovered >= 0);
      assert.equal(value.complete, false);
      Object.assign(safe, {
        discovered: value.discovered,
        complete: false,
        cases: safeLocalCases(value.kind, value.cases),
      });
    }
  }
  if (value.event === 'spec-result' || value.event === 'spec-started') {
    validateSpecCommand(value.spec, value.label);
    Object.assign(safe, {
      spec: value.spec,
      label: value.label,
    });
    if (value.event === 'spec-result') {
      assert(Number.isInteger(value.exit) && value.exit >= 0);
      assert(Number.isInteger(value.elapsedMs) && value.elapsedMs >= 0);
      Object.assign(safe, { exit: value.exit, elapsedMs: value.elapsedMs });
    }
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
    'seed-repeat',
    'seed-diagnose',
    'spec',
    'local',
    'cost-compare',
  ].includes(mode),
  'unknown preflight argument',
);
if (mode === 'spec') {
  validateSpecCommand(process.argv[3], process.argv[4]);
  assert([undefined, 'interrupt'].includes(process.argv[5]), 'unknown spec fault');
}
const costComparison = mode === 'cost-compare';
const local = mode === 'local' || costComparison;
if (local) {
  if (costComparison) {
    validateCostComparison(process.argv[3], process.argv[4]);
    assert.equal(process.argv[5], undefined);
  } else validateLocalCommand(process.argv[3], process.argv[4], process.argv[5]);
  mkdirSync('.test-results/docker-local', { recursive: true, mode: 0o700 });
  const evidence = `.test-results/docker-local/${process.argv[4]}`;
  mkdirSync(evidence, { mode: 0o700 }); // Refuse replacement of any prior label.
  localEventFile = `${evidence}/safe-events.jsonl`;
}
assert.equal(
  execFileSync('docker', ['image', 'inspect', image, '--format', '{{.Id}}'], {
    encoding: 'utf8',
  }).trim(),
  imageId,
);
const fixture = await createFixture(process.env.DATABASE_URL);
const name = `kt-pw-channel-${fixture.expected.schema.slice(-12)}`;
let child, preview, processing, seedChild, oldWeb;
let containerCreated = false;
let phase = 'gateway';
try {
  cancellation.signal.throwIfAborted();
  if (costComparison && process.argv[3] === 'old-cold') {
    phase = 'old-web-build';
    oldWeb = prepareOldCostWeb();
    report('historical-frontend-built', {
      commit: oldWeb.commit,
      artifactHash: oldWeb.artifactHash,
      currentInstalledDependencies: true,
    });
    phase = 'gateway';
  }
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
      ...(local
        ? [
            '--read-only',
            '--log-driver=none',
            '--tmpfs',
            '/tmp:rw,nosuid,nodev,size=1073741824,mode=1777',
            '--tmpfs',
            '/work/.test-results:rw,nosuid,nodev,size=1073741824,mode=1777',
          ]
        : []),
      '--mount',
      `type=bind,source=${process.cwd()},target=/work${local ? ',readonly' : ''}`,
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
  if (local) {
    const inspection = JSON.parse(
      execFileSync('docker', ['inspect', name], { encoding: 'utf8' }),
    )[0];
    assert.equal(inspection.HostConfig.ReadonlyRootfs, true);
    assert.equal(inspection.HostConfig.LogConfig.Type, 'none');
    assert.deepEqual(Object.keys(inspection.HostConfig.Tmpfs).sort(), [
      '/tmp',
      '/work/.test-results',
    ]);
    assert(
      inspection.Mounts.every(
        (mount) =>
          (mount.Destination === '/work' && mount.Type === 'bind' && !mount.RW) ||
          (['/tmp', '/work/.test-results'].includes(mount.Destination) && mount.Type === 'tmpfs'),
      ),
      'no extra writable host mounts allowed',
    );
    report('local-container-isolation', {
      rootAndRepositoryReadOnly: true,
      rawLogDriverDisabled: true,
      declaredTmpfsVerified: true,
    });
  }
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
      if (event.event === 'source-producer-ready' && process.argv[5] === 'source-cancel')
        process.kill(process.pid, 'SIGTERM');
      if (event.event === 'source-producer-ready' && process.argv[5] === 'source-kill') {
        report('source-container-kill-injected', { ready: true });
        execFileSync('docker', ['kill', '--signal', 'KILL', name], { stdio: 'ignore' });
      }
      if (event.event === 'spec-started' && process.argv[5] === 'interrupt')
        process.kill(process.pid, 'SIGTERM');
      if (
        event.event === 'local-started' &&
        ['interrupt', 'interrupt-stop'].includes(process.argv[5])
      )
        process.kill(process.pid, 'SIGTERM');
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
          mode === 'seed-repeat' ||
          mode === 'seed-diagnose' ||
          (local && process.argv[3] === 'p1' && process.argv[5] !== 'privacy')
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
            for (let pass = 1; pass <= (mode === 'seed-repeat' ? 2 : 1); pass++) {
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
                    report(
                      'seed-http-failure',
                      local
                        ? { stage: 'p1-seed', status: detail.status }
                        : { method: detail.method, path: detail.path, status: detail.status },
                    );
                } catch {
                  /* Do not relay raw stderr or identity-bearing assertion text. */
                }
              });
              const exit = await new Promise((resolve, reject) => {
                seedChild.once('error', () => reject(Error('owned seed spawn failed')));
                seedChild.once('exit', resolve);
              });
              report('seed-full-result', {
                pass,
                exit,
                elapsedMs: Math.round(performance.now() - seedStart),
              });
              assert.equal(exit, 0, 'full frozen seed failed; do not repair business steps');
              const counts = await fixture.verifySeedCost();
              report('cost-seed-same-schema-counts', { pass, ...counts });
              cancellation.signal.throwIfAborted();
            }
          }
          cancellation.signal.throwIfAborted();
          if (!local) {
            await send({ action: 'verified-only' });
            continue;
          }
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
            ...(oldWeb ? ['--outDir', oldWeb.dist] : []),
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
        phase = local
          ? 'private-local-browser'
          : mode === 'spec'
            ? 'playwright-spec'
            : 'browser-probe';
        cancellation.signal.throwIfAborted();
        if (local && process.argv[3] === 'source') sourceControl = await fixture.ownSource();
        await send(
          costComparison
            ? { action: 'cost-comparison', condition: process.argv[3], label: process.argv[4] }
            : local
              ? {
                  action: 'local',
                  kind: process.argv[3],
                  label: process.argv[4],
                  fault: process.argv[5],
                  user: process.argv[3] === 'p1' ? users.admin : users.runtime,
                  connection: fixture.containerConnection,
                  ...(sourceControl ? { sourceOwner: sourceControl } : {}),
                }
              : mode === 'spec'
                ? { action: 'spec', spec: process.argv[3], label: process.argv[4] }
                : { action: 'preflight', user: users.runtime, fault: mode },
        );
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
        timer = setTimeout(
          () => {
            cancellation.abort(Error('preflight deadline'));
            reject(cancellation.signal.reason);
          },
          mode === 'spec' || local ? 600_000 : 120_000,
        );
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
    if (local) assert(localResultSeen, 'local browser result is required');
  }
} catch (error) {
  report(
    'preflight-failed',
    local
      ? { phase }
      : {
          phase,
          errorType: error.name,
          databaseCode: error.code,
          constraint: error.constraint,
        },
  );
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
      if (local) {
        try {
          assert.notEqual(process.argv[5], 'interrupt-stop', 'fixed stop failure injection');
          execFileSync('docker', ['stop', '--time', '5', name], {
            stdio: 'ignore',
            timeout: 10_000,
          });
        } catch {
          report('local-stop-error', { injected: process.argv[5] === 'interrupt-stop' });
        }
        // Always attempt our exact owned removal, even after failed stop/inspection.
        execFileSync('docker', ['rm', '--force', name], { stdio: 'ignore', timeout: 10_000 });
        const remaining = execFileSync(
          'docker',
          ['ps', '--all', '--filter', `name=^/${name}$`, '--format', '{{.Names}}'],
          { encoding: 'utf8', timeout: 10_000 },
        ).trim();
        assert.equal(remaining, '', 'owned private container removal unconfirmed');
      } else {
        const status = execFileSync('docker', ['inspect', name, '--format', '{{.State.Status}}'], {
          encoding: 'utf8',
        }).trim();
        if (status === 'running')
          execFileSync('docker', ['stop', '--time', '5', name], { stdio: 'ignore' });
        // Atomic force-removal also handles a start/closed-stdin race; exact owned name only.
        execFileSync('docker', ['rm', '--force', name], { stdio: 'ignore' });
      }
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
      .close(() =>
        report('source-owned-cleanup', {
          schemaGone: true,
          markerMatched: true,
          containerGone: true,
        }),
      )
      .then(() => {
        report('owned-cleanup', { schemaGone: true, containerGone: true, previewGone: true });
      })
      .catch(() => {
        process.exitCode = 1;
        report('cleanup-failed');
      });
  else report('cleanup-failed', { schemaRetainedForInspection: true });
  if (oldWeb) {
    try {
      oldWeb.cleanup();
      report('historical-frontend-cleanup', { ownedRamDirectoryRemoved: true });
    } catch {
      process.exitCode = 1;
      report('historical-frontend-cleanup', { ownedRamDirectoryRemoved: false });
    }
  }
  report('preflight-result', {
    exit: process.exitCode ?? 0,
    elapsedMs: Math.round(performance.now() - started),
  });
}
