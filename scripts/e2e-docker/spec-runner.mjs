import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, open } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

// Exact A-only inventory: never discover the whole directory or production specs.
export const previewSpecs = Object.freeze([
  'cost-matrix-product-quality.spec.ts',
  'document-send-product-quality.spec.ts',
  'login-product-quality.spec.ts',
  'order-evidence-product-quality.spec.ts',
  'workspace-route-isolation.spec.ts',
  'session-revocation.spec.ts',
  'startup-delivery.spec.ts',
  'source-nested-authorization.spec.ts',
]);

export function validateSpecCommand(spec, label) {
  assert(previewSpecs.includes(spec), 'only an explicitly inventoried preview spec is allowed');
  assert.match(label, /^[a-z0-9][a-z0-9-]{0,63}$/u);
}

export async function runPreviewSpec(command, signal) {
  validateSpecCommand(command.spec, command.label);
  signal.throwIfAborted();
  await mkdir('.test-results/docker-pw', { recursive: true });
  const directory = `.test-results/docker-pw/${command.label}`;
  // Refuse evidence replacement, including accidentally reusing a green/red label.
  await mkdir(directory);
  const log = await open(`${directory}/playwright.log`, 'wx', 0o600);
  const started = performance.now();
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
          /* The owned group may already have drained. */
        }
      }, 3000);
    } catch {
      /* The owned group may already have drained. */
    }
  };
  try {
    child = spawn(
      process.execPath,
      [
        'node_modules/@playwright/test/cli.js',
        'test',
        `tests/e2e/${command.spec}`,
        '--config=playwright.config.ts',
        `--output=${directory}/artifacts`,
      ],
      {
        env: {
          ...process.env,
          KINGTURF_BASE_URL: 'http://127.0.0.1:4173',
          PLAYWRIGHT_HTML_OUTPUT_DIR: `${directory}/html`,
          PLAYWRIGHT_HTML_OPEN: 'never',
        },
        stdio: ['ignore', log.fd, log.fd],
        detached: true,
      },
    );
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    const exit = await new Promise((resolve, reject) => {
      child.once('error', () => reject(Error('owned Playwright spawn failed')));
      child.once('close', resolve);
    });
    signal.throwIfAborted();
    assert(Number.isInteger(exit), 'Playwright must finish with an exit code');
    return {
      spec: command.spec,
      label: command.label,
      exit,
      elapsedMs: Math.round(performance.now() - started),
    };
  } finally {
    signal.removeEventListener('abort', abort);
    clearTimeout(force);
    await log.close();
  }
}
