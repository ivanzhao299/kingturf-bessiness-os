import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { validateSourceControl, verifySourceControl } from './source-ownership.mjs';

const modes = ['denied', 'authorized', 'masked'];
const fixturePath = '/work/.test-results/authz-ui-fixtures.json';
const resultPath = '/tmp/kingturf-private/source-pg.json';
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
export function validateSourceFixture(
  value,
  reached = () => {
    /* Optional fixed-stage observer; no fixture values are forwarded. */
  },
) {
  reached('fixture-roots');
  assert(isObject(value), 'source fixture object required');
  assert.deepEqual(
    Object.keys(value).sort(),
    modes.flatMap((mode) => [mode, `${mode}Session`, `${mode}Collections`]).sort(),
  );
  for (const mode of modes) {
    reached('fixture-aggregate');
    assert(
      isObject(value[mode]) && isObject(value[mode].order),
      'synthetic source aggregate required',
    );
    const session = value[`${mode}Session`];
    reached('fixture-session');
    assert(isObject(session));
    assert.deepEqual(
      Object.keys(session).sort(),
      ['companyId', 'displayName', 'employeeId', 'employeeNumber', 'permissions'].sort(),
      'machine-session fixture must not carry browser authentication material',
    );
    assert.equal(typeof session.companyId, 'string');
    assert.equal(typeof session.employeeId, 'string');
    for (const key of ['displayName', 'employeeNumber'])
      assert(session[key] === null || typeof session[key] === 'string');
    assert(
      Array.isArray(session.permissions) &&
        session.permissions.every((item) => typeof item === 'string'),
    );
    reached('fixture-collections');
    assert(
      isObject(value[`${mode}Collections`]) && Array.isArray(value[`${mode}Collections`].items),
    );
  }
  let visited = 0;
  const visit = (node, depth) => {
    reached('fixture-bounds');
    assert(++visited <= 30000 && depth <= 40, 'bounded synthetic fixture required');
    if (typeof node === 'string') assert(node.length <= 64000);
    if (node && typeof node === 'object')
      for (const [key, child] of Object.entries(node)) {
        if (
          /^(?:token|csrfToken|csrfProof|password|secret|cookie|authorization|generation)$/iu.test(
            key,
          )
        )
          reached('fixture-auth-fields');
        assert(
          !/^(?:token|csrfToken|csrfProof|password|secret|cookie|authorization|generation)$/iu.test(
            key,
          ),
          'authentication fields forbidden in synthetic source fixture',
        );
        visit(child, depth + 1);
      }
  };
  visit(value, 0);
  return true;
}

export function sourceProducerPassed(value) {
  const suite = value?.testResults?.[0];
  return (
    value?.success === true &&
    value.numTotalTests === 19 &&
    value.numPassedTests === 19 &&
    value.numFailedTests === 0 &&
    value.numPendingTests === 0 &&
    value.numTodoTests === 0 &&
    Array.isArray(value.testResults) &&
    value.testResults.length === 1 &&
    suite?.name === '/work/apps/api/test/authorization-http-postgres.integration.test.ts' &&
    Array.isArray(suite.assertionResults) &&
    suite.assertionResults.length === 19 &&
    suite.assertionResults.every((item) => item.status === 'passed')
  );
}

export function safeSourcePreparation(value) {
  assert(
    value.exit === null || (Number.isInteger(value.exit) && value.exit >= 0 && value.exit <= 255),
  );
  assert(value.signal === null || /^SIG[A-Z0-9]+$/u.test(value.signal));
  assert(Number.isSafeInteger(value.elapsedMs) && value.elapsedMs >= 0);
  for (const key of ['producerPassed', 'fixtureValidated', 'ownershipVerified'])
    assert.equal(typeof value[key], 'boolean');
  assert(
    [
      'catalog',
      'producer',
      'producer-json',
      'fixture-json',
      'fixture-roots',
      'fixture-aggregate',
      'fixture-session',
      'fixture-collections',
      'fixture-bounds',
      'fixture-auth-fields',
      'complete',
    ].includes(value.stage),
  );
  return {
    exit: value.exit,
    signal: value.signal,
    elapsedMs: value.elapsedMs,
    producerPassed: value.producerPassed,
    fixtureValidated: value.fixtureValidated,
    ownershipVerified: value.ownershipVerified,
    stage: value.stage,
  };
}

async function absent(path) {
  try {
    await stat(path);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  throw Error('private producer requires a fresh fixed path');
}
async function boundedJson(path) {
  const info = await stat(path);
  assert(
    info.isFile() && info.size > 0 && info.size <= 2 * 1024 * 1024,
    'bounded private producer JSON required',
  );
  return JSON.parse(await readFile(path, 'utf8'));
}

// Only host ownership performs DROP; this process verifies the private handoff.
export async function prepareSourceFixture(command, signal, environment, rawFd, report) {
  const { Database, assertTestDatabaseTarget } =
    await import('../../packages/database/dist/index.js');
  assert.equal(command.kind, 'source');
  assertTestDatabaseTarget(command.connection, 'test');
  validateSourceControl(command.sourceOwner);
  const readyPath = '/tmp/kingturf-private/source-owner-ready.json';
  for (const path of [fixturePath, resultPath, readyPath]) await absent(path);
  for (const name of ['.env', '.env.local', '.env.test', '.env.test.local'])
    await absent(`/work/apps/api/${name}`);
  const database = new Database(command.connection);
  let child, force, childClosed;
  const abort = () => {
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
    try {
      process.kill(-child.pid, 'SIGTERM');
      force ??= setTimeout(() => {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          /* Exact owned process group already drained. */
        }
      }, 3000);
    } catch {
      /* Exact owned process group already drained. */
    }
  };
  const verify = () =>
    database.transaction(async (client) => {
      await client.query('SET TRANSACTION READ ONLY');
      await verifySourceControl(client, command.sourceOwner);
    });
  const started = performance.now();
  let closed = { exit: null, signal: null };
  let producerPassed = false,
    fixtureValidated = false,
    ownershipVerified = false,
    failed = false;
  let stage = 'catalog';
  try {
    await verify();
    signal.throwIfAborted();
    stage = 'producer';
    child = spawn(
      process.execPath,
      [
        '/work/node_modules/vitest/vitest.mjs',
        'run',
        'test/authorization-http-postgres.integration.test.ts',
        '--configLoader=native',
        '--no-cache',
        '--reporter=json',
        `--outputFile=${resultPath}`,
      ],
      {
        cwd: '/work/apps/api',
        env: {
          ...environment,
          NODE_ENV: 'test',
          DATABASE_URL: command.connection,
          KINGTURF_SOURCE_SCHEMA: command.sourceOwner.schema,
          KINGTURF_SOURCE_MARKER: command.sourceOwner.marker,
          KINGTURF_SOURCE_IDENTITY: JSON.stringify(command.sourceOwner.identity),
        },
        stdio: ['ignore', rawFd, rawFd],
        detached: true,
      },
    );
    childClosed = new Promise((resolve, reject) => {
      child.once('error', () => reject(Error('fixed private source producer spawn failed')));
      child.once('close', (exit, terminationSignal) =>
        resolve({ exit, signal: terminationSignal }),
      );
    });
    // Install rejection handling before the bounded ready poll, preserving the original promise.
    void childClosed.catch(() => {
      /* Awaited again below. */
    });
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    let ready = false;
    while (child.exitCode === null && child.signalCode === null) {
      signal.throwIfAborted();
      try {
        assert.deepEqual(await boundedJson(readyPath), { ready: true });
        ready = true;
        break;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      await delay(20);
    }
    if (ready) {
      await verify();
      report('source-producer-ready', {
        kind: 'source',
        label: command.label,
        ownerVerified: true,
      });
      if (command.fault === 'source-failure') process.kill(-child.pid, 'SIGKILL');
    }
    closed = await childClosed;
    signal.throwIfAborted();
    stage = 'catalog';
    await verify();
    ownershipVerified = true;
    if (ready && closed.exit === 0 && closed.signal === null) {
      stage = 'producer-json';
      producerPassed = sourceProducerPassed(await boundedJson(resultPath));
      if (producerPassed) {
        stage = 'fixture-json';
        fixtureValidated = validateSourceFixture(await boundedJson(fixturePath), (next) => {
          stage = next;
        });
      }
    }
    assert(
      ready &&
        closed.exit === 0 &&
        closed.signal === null &&
        producerPassed &&
        fixtureValidated &&
        ownershipVerified,
      'source requires real 19/19, validated RAM fixture and exact ownership',
    );
    stage = 'complete';
    signal.throwIfAborted();
  } catch {
    failed = true;
  } finally {
    signal.removeEventListener('abort', abort);
    if (failed || signal.aborted) abort();
    if (childClosed) {
      try {
        closed = await childClosed;
      } catch {
        failed = true;
      }
    }
    clearTimeout(force);
    await database.close();
  }
  const observation = safeSourcePreparation({
    ...closed,
    elapsedMs: Math.round(performance.now() - started),
    producerPassed,
    fixtureValidated,
    ownershipVerified,
    stage,
  });
  report('source-fixture-result', { kind: command.kind, label: command.label, ...observation });
  assert(!failed, 'fixed private source preparation failed at a fixed reported stage');
}
