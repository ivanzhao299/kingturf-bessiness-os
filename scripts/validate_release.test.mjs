import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { validateRelease } from './validate_release.mjs';

const canonical = 'https://github.com/ivanzhao299/kingturf-bessiness-os.git';
// A-F1（A3-P2-9）：deploy-production.yml 已删除；早门真执行测试改用 apply-migrations 的同名 gate。
const workflow = readFileSync(
  new URL('../.github/workflows/apply-migrations.yml', import.meta.url),
  'utf8',
);
const context = { repository: 'ivanzhao299/kingturf-bessiness-os', workflowRef: 'refs/heads/main' };
const run = (cwd, args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'kingturf-release-guard-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, 'source');
  const control = join(root, 'control');
  mkdirSync(source);
  run(source, ['init', '--initial-branch=main']);
  const commit = (text) => {
    writeFileSync(join(source, 'version'), text);
    run(source, ['add', 'version']);
    run(source, [
      '-c',
      'user.name=Release fixture',
      '-c',
      'user.email=release@example.test',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-m',
      text,
    ]);
    return run(source, ['rev-parse', 'HEAD']);
  };
  const stable = commit('stable');
  run(source, [
    '-c',
    'user.name=Release fixture',
    '-c',
    'user.email=release@example.test',
    'tag',
    '-a',
    'v-stable',
    '-m',
    'stable',
  ]);
  const head = commit('current');
  run(source, ['switch', '-c', 'unmerged']);
  const unmerged = commit('unmerged');
  run(source, ['switch', 'main']);
  run(root, ['clone', source, control]);
  run(control, ['remote', 'set-url', 'origin', canonical]);
  const git = (args) =>
    args[0] === 'fetch'
      ? run(
          control,
          args.map((arg) => (arg === 'origin' ? source : arg)),
        )
      : run(control, args);
  return {
    root,
    source,
    control,
    stable,
    head,
    unmerged,
    commit,
    git,
    input: { ...context, sha: head, controlSha: head },
  };
}

test('accepts a current main commit from a fresh real Git fetch', (t) => {
  const f = fixture(t);
  assert.deepEqual(validateRelease(f.input, f.git), {
    commit_sha: f.head,
    control_sha: f.head,
    main_sha: f.head,
  });
});

test('accepts a tagged stable main commit by its exact SHA for rollback', (t) => {
  const f = fixture(t);
  assert.equal(validateRelease({ ...f.input, sha: f.stable }, f.git).commit_sha, f.stable);
  assert.equal(run(f.control, ['rev-parse', 'v-stable^{commit}']), f.stable);
});

test('main advancing does not change the already selected historical candidate', (t) => {
  const f = fixture(t);
  const before = validateRelease({ ...f.input, sha: f.stable }, f.git);
  const newer = f.commit('newer');
  const after = validateRelease({ ...f.input, sha: f.stable }, f.git);
  assert.equal(after.commit_sha, before.commit_sha);
  assert.equal(after.control_sha, before.control_sha);
  assert.equal(after.main_sha, newer);
});

test('rejects an existing commit on an unmerged branch', (t) => {
  const f = fixture(t);
  assert.throws(
    () => validateRelease({ ...f.input, sha: f.unmerged }, f.git),
    /trusted main history/,
  );
});

test('rejects a nonexistent full SHA', (t) => {
  const f = fixture(t);
  assert.throws(
    () => validateRelease({ ...f.input, sha: 'a'.repeat(40) }, f.git),
    /trusted main history/,
  );
});

test('rejects an annotated tag object SHA instead of silently dereferencing it', (t) => {
  const f = fixture(t);
  const tag = run(f.control, ['rev-parse', 'v-stable']);
  assert.throws(() => validateRelease({ ...f.input, sha: tag }, f.git), /trusted main history/);
});

test('rejects an unrelated source repository before any fetch', (t) => {
  const f = fixture(t);
  run(f.control, ['remote', 'set-url', 'origin', 'https://github.com/untrusted/other.git']);
  const calls = [];
  assert.throws(
    () =>
      validateRelease(f.input, (args) => {
        calls.push(args);
        return f.git(args);
      }),
    /canonical GitHub/,
  );
  assert.equal(
    calls.some((args) => args[0] === 'fetch'),
    false,
  );
});

test('rejects multiple origin URLs and Git insteadOf redirection', (t) => {
  const f = fixture(t);
  run(f.control, [
    'config',
    '--add',
    'remote.origin.url',
    'https://github.com/untrusted/other.git',
  ]);
  assert.throws(() => validateRelease(f.input, f.git), /canonical GitHub/);
  run(f.control, ['config', '--unset-all', 'remote.origin.url']);
  run(f.control, ['remote', 'set-url', 'origin', canonical]);
  run(f.control, ['config', 'url.https://untrusted.example/.insteadOf', 'https://github.com/']);
  assert.throws(() => validateRelease(f.input, f.git), /canonical GitHub/);
});

test('rejects a mismatched control checkout', (t) => {
  const f = fixture(t);
  assert.throws(
    () => validateRelease({ ...f.input, controlSha: f.stable }, f.git),
    /control checkout/,
  );
});

test('rejects a control commit outside main history', (t) => {
  const f = fixture(t);
  run(f.control, ['checkout', f.unmerged]);
  assert.throws(
    () => validateRelease({ ...f.input, controlSha: f.unmerged }, f.git),
    /trusted main history/,
  );
});

test('fails closed when refreshing trusted main fails', (t) => {
  const f = fixture(t);
  assert.throws(
    () =>
      validateRelease(f.input, (args) => {
        if (args[0] === 'fetch') throw new Error('network failure');
        return f.git(args);
      }),
    /network failure/,
  );
});

const malformed = [
  '',
  'main',
  'v-stable',
  'abc1234',
  'g'.repeat(40),
  'A'.repeat(40),
  'a'.repeat(39),
  'a'.repeat(41),
  `${'a'.repeat(40)}\n`,
  "'; exit 0; #",
  '$(touch INJECTION)',
  '`touch INJECTION`',
  `a\ncommit_sha=${'b'.repeat(40)}`,
];
for (const sha of malformed) {
  test(`rejects malformed input ${JSON.stringify(sha)} without invoking Git`, () => {
    assert.throws(
      () =>
        validateRelease({ ...context, sha, controlSha: 'b'.repeat(40) }, () => {
          assert.fail('Invalid input reached Git');
        }),
      /exact lowercase/,
    );
  });
}

test('rejects a fork or non-main workflow regardless of a valid candidate SHA', () => {
  for (const extra of [
    { repository: 'untrusted/fork' },
    { workflowRef: 'refs/heads/unmerged' },
    { workflowRef: 'refs/tags/v-stable' },
  ]) {
    assert.throws(
      () =>
        validateRelease(
          { ...context, sha: 'a'.repeat(40), controlSha: 'b'.repeat(40), ...extra },
          () => assert.fail('Untrusted context reached Git'),
        ),
      /canonical repository main/,
    );
  }
});

// A-F1（A3-P2-9）：deploy-production.yml 编排用例已随 workflow 删除退役（历史见 git）；
// stepRun 现仅服务 apply-migrations 早门真执行测试。
function stepRun(name) {
  const text = workflow.split(`      - name: ${name}\n`)[1];
  assert.ok(text, name);
  const block = text.split(/\n {6}- /)[0];
  const runText = block.match(/ {8}run: \|\n((?: {10}.*\n?)*)/)[1];
  return runText.replace(/^ {10}/gm, '');
}

test('the actual early Bash gate rejects malicious env input and non-main dispatch', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'kingturf-release-input-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const gate = stepRun('Reject untrusted dispatch context and malformed input');
  const env = {
    ...process.env,
    GITHUB_REPOSITORY: context.repository,
    GITHUB_REF: context.workflowRef,
    RELEASE_SHA: 'a'.repeat(40),
  };
  assert.equal(spawnSync('bash', ['-c', gate], { env, cwd: root }).status, 0);
  for (const sha of malformed)
    assert.notEqual(
      spawnSync('bash', ['-c', gate], { env: { ...env, RELEASE_SHA: sha }, cwd: root }).status,
      0,
    );
  assert.notEqual(
    spawnSync('bash', ['-c', gate], {
      env: { ...env, GITHUB_REF: 'refs/heads/unmerged' },
      cwd: root,
    }).status,
    0,
  );
  assert.equal(existsSync(join(root, 'INJECTION')), false);
});

test('the CLI rejects invalid input without writing Actions outputs', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'kingturf-release-output-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const output = join(root, 'output');
  writeFileSync(output, 'unchanged\n');
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./validate_release.mjs', import.meta.url))],
    {
      cwd: root,
      env: {
        ...process.env,
        GITHUB_REPOSITORY: context.repository,
        GITHUB_REF: context.workflowRef,
        RELEASE_SHA: '$(touch INJECTION)',
        GITHUB_OUTPUT: output,
      },
    },
  );
  assert.equal(result.status, 1);
  assert.equal(readFileSync(output, 'utf8'), 'unchanged\n');
  assert.equal(existsSync(join(root, 'INJECTION')), false);
});

// Replay the workflow's real shell in an owned temporary directory. Every network,
// container and privileged command is replaced before execution; no host is contacted.

function hostKeyFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'kingturf-pinned-host-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const key = join(root, 'test-key');
  execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', key], { stdio: 'ignore' });
  const pub = readFileSync(`${key}.pub`, 'utf8').trim();
  const asset = join(root, '.release-control', 'infra', 'ssh');
  mkdirSync(asset, { recursive: true });
  const output = join(root, 'actions-env');
  writeFileSync(output, 'unchanged\n');
  return { root, pub, output, asset };
}

for (const mode of ['missing', 'wrong-host', 'invalid-key']) {
  test(`host key ${mode} cannot authorize production SSH`, (t) => {
    const f = hostKeyFixture(t);
    const pinned =
      mode === 'missing'
        ? ''
        : mode === 'wrong-host'
          ? `other.invalid ${f.pub}`
          : 'deployment.invalid ssh-ed25519 not-a-key';
    writeFileSync(join(f.asset, 'production_known_hosts'), pinned);
    const result = spawnSync(
      'bash',
      ['-e', '-o', 'pipefail', '-c', stepRun('Pin independently verified production SSH host key')],
      {
        cwd: f.root,
        env: {
          ...process.env,
          RUNNER_TEMP: f.root,
          GITHUB_ENV: f.output,
          PROD_SSH_HOST: 'deployment.invalid',
          PROD_SSH_PORT: '22',
        },
        encoding: 'utf8',
      },
    );
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(f.output, 'utf8'), 'unchanged\n');
  });
}

test('deployment retention preserves every recovery pair and never deletes rollback images', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'kingturf-preserve-recovery-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const backups = join(root, '.release-backups');
  mkdirSync(backups);
  for (const name of ['old', 'new']) {
    writeFileSync(join(backups, `${name}.metadata`), `verified ${name}`);
    writeFileSync(join(backups, `${name}.dump`), `recovery ${name}`);
  }
  const bin = join(root, 'bin');
  mkdirSync(bin);
  const log = join(root, 'docker-log');
  writeFileSync(
    join(bin, 'docker'),
    '#!/bin/sh\nprintf "%s\\n" "$*" >> "$RETENTION_LOG"\ncase "$*" in "container ls"*) printf "existing-container\\n";; "inspect"*) printf "existing-image\\n";; *) exit 1;; esac\n',
    { mode: 0o700 },
  );
  const script = fileURLToPath(new URL('./cleanup_kingturf_release_artifacts.sh', import.meta.url));
  const result = spawnSync('sh', [script, root, 'kingturf-erp-production'], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, RETENTION_LOG: log },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  for (const name of ['old', 'new']) {
    assert.equal(readFileSync(join(backups, `${name}.metadata`), 'utf8'), `verified ${name}`);
    assert.equal(readFileSync(join(backups, `${name}.dump`), 'utf8'), `recovery ${name}`);
  }
  assert.doesNotMatch(readFileSync(log, 'utf8'), /\brm\b/);
});

test('production persistence has no silent fallback to new named volumes', () => {
  const compose = readFileSync(
    new URL('../infra/docker/compose.production.yaml', import.meta.url),
    'utf8',
  );
  assert.match(compose, /KINGTURF_POSTGRES_DATA_PATH:\?/);
  assert.match(compose, /KINGTURF_ATTACHMENT_DATA_PATH:\?/);
  assert.doesNotMatch(compose, /KINGTURF_(POSTGRES|ATTACHMENT)_DATA_PATH:-/);
});
