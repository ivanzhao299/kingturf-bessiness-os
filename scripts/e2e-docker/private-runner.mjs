import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { safeLocalCases, safeLocalResult, validateLocalCommand } from './private-contract.mjs';

async function verifyPrivateFilesystem(label) {
  const mounts = await readFile('/proc/mounts', 'utf8');
  for (const path of ['/tmp', '/work/.test-results'])
    assert(
      mounts
        .split('\n')
        .some((line) => line.split(' ')[1] === path && line.split(' ')[2] === 'tmpfs'),
      'owned tmpfs required',
    );
  const probe = `/work/.kingturf-private-write-${label}`;
  let readOnly = false;
  try {
    await writeFile(probe, 'fixed non-secret write probe', { flag: 'wx', mode: 0o600 });
    await unlink(probe); // Only our successful exclusive create may be removed.
  } catch (error) {
    readOnly = error.code === 'EROFS';
  }
  assert(readOnly, 'repository must reject writes');
}

export async function runPrivateSpec(command, signal, report) {
  validateLocalCommand(command.kind, command.label, command.fault);
  process.umask(0o077);
  signal.throwIfAborted();
  await verifyPrivateFilesystem(command.label);
  await mkdir('/tmp/kingturf-private');
  for (const name of ['cache', 'config', 'data', 'state', 'runtime'])
    await mkdir(`/tmp/${name}`, { mode: 0o700 });
  const started = performance.now();
  if (command.fault === 'privacy') {
    const canary = 'FIXED_NON_SECRET_PRIVATE_RAW_CANARY';
    await writeFile('/tmp/kingturf-private/raw.log', canary, { mode: 0o600 });
    await mkdir('/work/.test-results/private');
    await writeFile('/work/.test-results/private/canary.html', canary, { mode: 0o600 });
    assert((await readFile('/tmp/kingturf-private/raw.log', 'utf8')) === canary);
    return {
      exit: 0,
      elapsedMs: Math.round(performance.now() - started),
      cases: [],
      discovered: 0,
      complete: false,
      probe: true,
    };
  }
  const kind = command.kind;
  const directory = `/work/.test-results/private/${command.label}`;
  const args = [
    'node_modules/@playwright/test/cli.js',
    'test',
    kind === 'p1' ? 'tests/e2e/p1-demo.spec.ts' : 'tests/e2e/runtime-local.spec.mjs',
    `--config=${kind === 'p1' ? 'playwright.config.ts' : 'playwright.runtime.config.ts'}`,
    `--output=${directory}/artifacts`,
    `--reporter=${kind === 'p1' ? 'list,html' : 'list'},./scripts/e2e-docker/private-reporter.mjs`,
    ...(kind === 'p1' ? ['--trace=off'] : []),
  ];
  const environment = {
    ...process.env,
    NODE_ENV: 'test',
    TMPDIR: '/tmp',
    XDG_CACHE_HOME: '/tmp/cache',
    XDG_CONFIG_HOME: '/tmp/config',
    XDG_DATA_HOME: '/tmp/data',
    XDG_STATE_HOME: '/tmp/state',
    XDG_RUNTIME_DIR: '/tmp/runtime',
    CHROME_LOG_FILE: '/tmp/kingturf-private/chrome.log',
    KINGTURF_PRIVATE_KIND: kind,
    KINGTURF_BASE_URL: 'http://127.0.0.1:4173',
    PLAYWRIGHT_HTML_OUTPUT_DIR: `${directory}/html`,
    PLAYWRIGHT_HTML_OPEN: 'never',
    ...(kind === 'p1'
      ? {
          KINGTURF_ADMIN_LOGIN: command.user.login,
          KINGTURF_ADMIN_PASSWORD: command.user.password,
        }
      : {
          KINGTURF_RUNTIME_ACCEPTANCE: '1',
          KINGTURF_RUNTIME_WEB_ORIGIN: 'http://127.0.0.1:4173',
          KINGTURF_RUNTIME_DATABASE_URL: command.connection,
          KINGTURF_TEST_LOGIN: command.user.login,
          KINGTURF_TEST_PASSWORD: command.user.password,
          KINGTURF_TEST_COMPANY: command.user.companyId,
        }),
  };
  const raw = await open('/tmp/kingturf-private/raw.log', 'wx', 0o600);
  let child;
  let force;
  const abort = () => {
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
    try {
      process.kill(-child.pid, 'SIGTERM');
      force ??= setTimeout(() => {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          /* Owned group may already have stopped. */
        }
      }, 3000);
    } catch {
      /* Owned group may already have stopped. */
    }
  };
  try {
    signal.throwIfAborted();
    child = spawn(process.execPath, args, {
      env: environment,
      stdio: ['ignore', raw.fd, raw.fd],
      detached: true,
    });
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    child.once('spawn', () => report('local-started', { kind, label: command.label }));
    const closed = await new Promise((resolve, reject) => {
      child.once('error', () => reject(Error('private browser spawn failed')));
      child.once('close', (exit, terminationSignal) => resolve({ exit, terminationSignal }));
    });
    report('local-closed', { kind, label: command.label, ...closed });
    let cases = [];
    let discovered = 0;
    let complete = false;
    try {
      const summary = JSON.parse(await readFile('/tmp/kingturf-private/cases.json', 'utf8'));
      assert(Number.isInteger(summary.discovered) && summary.discovered >= 0);
      assert.equal(typeof summary.complete, 'boolean');
      cases = safeLocalCases(kind, summary.cases);
      discovered = summary.discovered;
      complete = summary.complete;
    } catch {
      assert(closed.exit !== 0, 'successful browser must report complete cases');
    }
    if (closed.exit === null || signal.aborted)
      report('local-progress', { kind, label: command.label, discovered, complete: false, cases });
    signal.throwIfAborted();
    assert(Number.isInteger(closed.exit), 'private browser requires actual exit');
    return safeLocalResult(kind, {
      exit: closed.exit,
      elapsedMs: Math.round(performance.now() - started),
      cases,
      discovered,
      complete,
      probe: false,
    });
  } finally {
    signal.removeEventListener('abort', abort);
    clearTimeout(force);
    await raw.close();
  }
}
