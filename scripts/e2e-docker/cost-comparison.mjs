import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { verifyPrivateFilesystem } from './private-runner.mjs';
import {
  costComparisonSource,
  oldWebCommit,
  safeCostObservation,
  validateCostComparison,
} from './cost-comparison-source.mjs';

// Generated historical frontend only, in an owned RAM filesystem. Current installed dependencies
// are explicit: this is not a reconstruction of the complete historical runtime/dependency graph.
export function prepareOldCostWeb() {
  const root = mkdtempSync('/dev/shm/kingturf-cost-old-');
  const cleanup = () => {
    assert.match(root, /^\/dev\/shm\/kingturf-cost-old-[A-Za-z0-9]{6}$/u);
    rmSync(root, { recursive: true }); // Exact directory returned by our mkdtemp only.
  };
  try {
    const archive = execFileSync(
      'git',
      ['archive', oldWebCommit, 'apps/web', 'packages', 'package.json', 'pnpm-workspace.yaml'],
      { maxBuffer: 32 * 1024 * 1024, timeout: 30_000 },
    );
    execFileSync('tar', ['-x', '-C', root], {
      input: archive,
      stdio: ['pipe', 'ignore', 'ignore'],
      timeout: 30_000,
    });
    symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'dir');
    symlinkSync(resolve('apps/web/node_modules'), join(root, 'apps/web/node_modules'), 'dir');
    execFileSync(
      resolve('apps/web/node_modules/.bin/vite'),
      ['build', '--configLoader', 'native'],
      { cwd: join(root, 'apps/web'), stdio: 'ignore', timeout: 45_000 },
    );
    const dist = join(root, 'apps/web/dist');
    const hash = createHash('sha256');
    const walk = (directory) => {
      for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
        a.name.localeCompare(b.name),
      )) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) walk(path);
        else {
          assert(entry.isFile());
          hash.update(path.slice(dist.length));
          hash.update(readFileSync(path));
        }
      }
    };
    walk(dist);
    return { dist, commit: oldWebCommit, artifactHash: hash.digest('hex'), cleanup };
  } catch {
    cleanup();
    throw Error('owned historical frontend build failed');
  }
}

export async function runCostComparison(command, signal, report) {
  validateCostComparison(command.condition, command.label);
  assert(!process.env.DEBUG && !process.env.PWDEBUG, 'private diagnostics requires debug off');
  process.umask(0o077);
  await verifyPrivateFilesystem(command.label);
  await mkdir('/tmp/kingturf-private');
  for (const name of ['cache', 'config', 'data', 'state', 'runtime'])
    await mkdir(`/tmp/${name}`, { mode: 0o700 });
  const directory = `/work/.test-results/private/${command.label}`;
  await mkdir(directory, { recursive: true });
  const source = await readFile('/work/tests/e2e/cost-matrix-product-quality.spec.ts', 'utf8');
  const patch = await readFile(
    '/work/docs/evidence/playwright-cost-auth-candidate-2026-10-17.patch',
    'utf8',
  );
  await writeFile(
    `${directory}/cost-observation.spec.ts`,
    costComparisonSource(source, patch, command.condition),
  );
  await writeFile(
    `${directory}/config.ts`,
    `import original from '/work/playwright.config';\nexport default { ...original, testDir: ${JSON.stringify(directory)}, testMatch: 'cost-observation.spec.ts', outputDir: ${JSON.stringify(`${directory}/artifacts`)}, reporter: [['line']], use: { ...original.use, serviceWorkers: 'block' }, };\n`,
  );
  const raw = await open('/tmp/kingturf-private/cost-raw.log', 'wx', 0o600);
  let child, force;
  const abort = () => {
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
    try {
      process.kill(-child.pid, 'SIGTERM');
      force ??= setTimeout(() => {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          /* Already closed. */
        }
      }, 3000);
    } catch {
      /* Final close decides success. */
    }
  };
  const start = performance.now();
  try {
    signal.throwIfAborted();
    child = spawn(
      process.execPath,
      ['node_modules/@playwright/test/cli.js', 'test', `--config=${directory}/config.ts`],
      {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          KINGTURF_BASE_URL: 'http://127.0.0.1:4173',
          TMPDIR: '/tmp',
          XDG_CACHE_HOME: '/tmp/cache',
          XDG_CONFIG_HOME: '/tmp/config',
          XDG_DATA_HOME: '/tmp/data',
          XDG_STATE_HOME: '/tmp/state',
          XDG_RUNTIME_DIR: '/tmp/runtime',
          CHROME_LOG_FILE: '/tmp/kingturf-private/chrome.log',
        },
        stdio: ['ignore', raw.fd, raw.fd],
        detached: true,
      },
    );
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    const closed = await new Promise((accept, reject) => {
      child.once('error', () => reject(Error('private comparison spawn failed')));
      child.once('close', (exit, terminationSignal) => accept({ exit, terminationSignal }));
    });
    assert(Number.isInteger(closed.exit) && [0, 1].includes(closed.exit));
    assert.equal(closed.terminationSignal, null);
    signal.throwIfAborted();
    const observation = safeCostObservation(
      JSON.parse(await readFile('/tmp/kingturf-private/cost-observation.json', 'utf8')),
    );
    assert.equal(closed.exit === 0, observation.status === 'passed');
    report('cost-comparison', {
      condition: command.condition,
      label: command.label,
      exit: closed.exit,
      elapsedMs: Math.round(performance.now() - start),
      ...observation,
    });
  } finally {
    signal.removeEventListener('abort', abort);
    clearTimeout(force);
    await raw.close();
  }
}
