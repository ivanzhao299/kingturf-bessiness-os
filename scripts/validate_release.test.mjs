import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { validateRelease } from './validate_release.mjs';

const canonical = 'https://github.com/ivanzhao299/kingturf-bessiness-os.git';
const workflow = readFileSync(
  new URL('../.github/workflows/deploy-production.yml', import.meta.url),
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

test('workflow binds verification and deployment to the validated SHA and fixed production lock', () => {
  const validate = workflow.split('  validate:\n')[1].split('  verify:\n')[0];
  const verify = workflow.split('  verify:\n')[1].split('  deploy:\n')[0];
  const deploy = workflow.split('  deploy:\n')[1];
  assert.equal(workflow.match(/inputs\.commit_sha/g)?.length, 1);
  assert.match(validate, /ref: \$\{\{ github\.workflow_sha \}\}/);
  assert.doesNotMatch(validate, /secrets\.|environment: production/);
  assert.match(verify, /needs: validate/);
  assert.match(deploy, /needs: \[validate, verify\]/);
  for (const job of [verify, deploy]) {
    assert.match(job, /ref: \$\{\{ needs\.validate\.outputs\.commit_sha \}\}/);
    assert.match(job, /test "\$\(git rev-parse HEAD\)" = "\$RELEASE_SHA"/);
  }
  assert.match(
    deploy,
    /concurrency:\n {6}group: kingturf-erp-production\n {6}cancel-in-progress: false/,
  );
  assert.doesNotMatch(validate + verify, /concurrency:/);
  assert.doesNotMatch(
    readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
    /concurrency:/,
  );
  assert.ok(deploy.indexOf('Revalidate main history') < deploy.indexOf('ssh-private-key:'));
  assert.match(deploy, /ref: \$\{\{ needs\.validate\.outputs\.control_sha \}\}/);
  assert.match(deploy, /\.release-control\/scripts\/cleanup_kingturf_release_artifacts\.sh/);
  assert.match(deploy, /--exclude '\.git\/' --exclude '\.release-control\/'/);
  assert.ok(
    deploy.indexOf('Create production recovery point') <
      deploy.indexOf('Synchronize configured website ingest secret'),
  );
  assert.ok(
    deploy.indexOf('Required production hostname HTTPS probe') <
      deploy.indexOf('Record verified production release'),
  );
  assert.ok(
    deploy.indexOf('Record verified production release') <
      deploy.indexOf('Retain latest KingTurf recovery point'),
  );
  assert.doesNotMatch(stepRun('Deploy and verify'), /printf.*> \.release-sha/);
});

// Replay the workflow's real shell in an owned temporary directory. Every network,
// container and privileged command is replaced before execution; no host is contacted.
function deploymentFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'kingturf-deploy-simulation-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  const release = join(root, 'release');
  mkdirSync(release);
  const previous = 'b'.repeat(40),
    candidate = 'a'.repeat(40);
  writeFileSync(join(release, '.release-sha'), previous);
  writeFileSync(join(release, '.env.production'), 'WEBSITE_LEAD_INGEST_SECRET=synthetic-old\n');
  const tools = {
    ssh: 'for command do :; done\nexec bash -c "$command"',
    docker: `printf 'docker %s\\n' "$*" >> "$PROBE_LOG"
case "$*" in
  *'exec -T postgres'*) [ "$MODE" != dump-failure ] || exit 1; printf 'synthetic dump';;
  *'up -d --build'*) [ "$MODE" != build-failure ] || exit 1;;
esac`,
    curl: `case "$*" in
  *https://erp.kingturf.cn/*) case "$*" in *--resolve*) :;; *) [ "$MODE" != public-failure ] || exit 22;; esac;;
esac
case "$*" in
  */version*) if [ "$MODE" = version-failure ]; then printf '{"sha":"wrong"}'; else printf '{"sha":"%s"}' "$CANDIDATE"; fi;;
  */ready*) [ "$MODE" != ready-failure ] || exit 22; printf '{"status":"ready"}';;
  */health*) printf '{"status":"ok"}';;
esac`,
    sleep: ':',
    rsync: ':',
    sudo: ':',
    scp: ':',
    cat: `case "$*" in
  .release-control/*) [ "$MODE" != cleanup-read-failure ] || exit 1;;
esac
exec /usr/bin/cat "$@"`,
  };
  for (const [name, script] of Object.entries(tools))
    writeFileSync(join(bin, name), `#!/bin/sh\nset -eu\n${script}\n`, { mode: 0o700 });
  const cleanupDirectory = join(root, '.release-control', 'scripts');
  mkdirSync(cleanupDirectory, { recursive: true });
  writeFileSync(
    join(cleanupDirectory, 'cleanup_kingturf_release_artifacts.sh'),
    'printf "cleanup\\n" >> "$PROBE_LOG"\n[ "$MODE" != cleanup-failure ]\n',
  );
  const runId = `batch1-${root.split('/').at(-1)}`;
  const log = join(root, 'operations');
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    RELEASE_SHA: candidate,
    CANDIDATE: candidate,
    PROBE_LOG: log,
    GITHUB_RUN_ID: runId,
    GITHUB_RUN_ATTEMPT: '1',
    WEBSITE_LEAD_INGEST_SECRET: 'synthetic-new',
    SSH_KNOWN_HOSTS_FILE: join(root, 'synthetic-known-hosts'),
  };
  const names = [
    'Create production recovery point',
    'Synchronize configured website ingest secret',
    'Sync isolated KingTurf release',
    'Install and reload production Nginx ingress',
    'Deploy and verify',
    'Required production hostname HTTPS probe',
    'Record verified production release',
    'Retain latest KingTurf recovery point and active images',
  ];
  const execute = (mode) => {
    const completed = [];
    for (const name of names) {
      const script = stepRun(name).replace(/\$\{\{\s*([^}]+)\s*\}\}/g, (_, key) => {
        const values = {
          'secrets.PROD_SSH_PORT': '22',
          'secrets.PROD_SSH_USER': 'synthetic',
          'secrets.PROD_SSH_HOST': 'no-network.invalid',
          'secrets.PROD_DEPLOY_PATH': release,
          'github.run_id': runId,
          'github.run_attempt': '1',
        };
        assert.ok(Object.hasOwn(values, key.trim()), key);
        return values[key.trim()];
      });
      const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', script], {
        cwd: root,
        env: { ...env, MODE: mode },
        encoding: 'utf8',
      });
      if (result.status !== 0) return { failed: name, result, completed };
      completed.push(name);
    }
    return { completed };
  };
  return { root, release, previous, candidate, log, execute };
}

test('a non-conflicting release promotes the exact version only after all probes and then cleans up', (t) => {
  const f = deploymentFixture(t);
  const result = f.execute('success');
  assert.equal(result.failed, undefined, result.result?.stderr);
  assert.equal(result.completed.length, 8);
  assert.equal(readFileSync(join(f.release, '.release-sha'), 'utf8'), f.candidate);
  assert.match(readFileSync(f.log, 'utf8'), /cleanup/);
  assert.doesNotMatch(
    stepRun('Retain latest KingTurf recovery point and active images'),
    /\bscp\b|\/tmp\//,
  );
});

test('a failed recovery dump prevents any secret synchronization and promotion', (t) => {
  const f = deploymentFixture(t);
  assert.equal(f.execute('dump-failure').failed, 'Create production recovery point');
  assert.equal(
    readFileSync(join(f.release, '.env.production'), 'utf8'),
    'WEBSITE_LEAD_INGEST_SECRET=synthetic-old\n',
  );
  assert.equal(readFileSync(join(f.release, '.release-sha'), 'utf8'), f.previous);
  assert.doesNotMatch(readFileSync(f.log, 'utf8'), /cleanup/);
});

for (const mode of ['build-failure', 'ready-failure', 'version-failure', 'public-failure']) {
  test(`${mode} preserves the previous verified marker and recovery dump without cleanup`, (t) => {
    const f = deploymentFixture(t);
    const result = f.execute(mode);
    assert.equal(
      result.failed,
      mode === 'public-failure' ? 'Required production hostname HTTPS probe' : 'Deploy and verify',
    );
    assert.equal(readFileSync(join(f.release, '.release-sha'), 'utf8'), f.previous);
    assert.doesNotMatch(readFileSync(f.log, 'utf8'), /cleanup/);
    const metadata = execFileSync(
      'find',
      [join(f.release, '.release-backups'), '-name', '*.metadata'],
      { encoding: 'utf8' },
    ).trim();
    assert.match(readFileSync(metadata, 'utf8'), new RegExp(`previous_sha=${f.previous}`));
    const dump = metadata.replace(/\.metadata$/, '.dump');
    assert.equal(readFileSync(dump, 'utf8'), 'synthetic dump');
  });
}

test('an explicit rerun after a failed update can promote the same candidate', (t) => {
  const f = deploymentFixture(t);
  assert.equal(f.execute('build-failure').failed, 'Deploy and verify');
  assert.equal(f.execute('success').failed, undefined);
  assert.equal(readFileSync(join(f.release, '.release-sha'), 'utf8'), f.candidate);
});

test('cleanup failure does not stage a remote script or falsify the already verified marker', (t) => {
  const f = deploymentFixture(t);
  assert.equal(
    f.execute('cleanup-failure').failed,
    'Retain latest KingTurf recovery point and active images',
  );
  assert.doesNotMatch(
    stepRun('Retain latest KingTurf recovery point and active images'),
    /\bscp\b|\/tmp\//,
  );
  assert.equal(readFileSync(join(f.release, '.release-sha'), 'utf8'), f.candidate);
});

test('a missing cleanup control fails the release instead of only running probes', (t) => {
  const f = deploymentFixture(t);
  rmSync(join(f.root, '.release-control/scripts/cleanup_kingturf_release_artifacts.sh'));
  assert.equal(
    f.execute('success').failed,
    'Retain latest KingTurf recovery point and active images',
  );
  assert.doesNotMatch(readFileSync(f.log, 'utf8'), /cleanup/);
});

test('a cleanup read failure cannot be masked by the probe tail or successful SSH', (t) => {
  const f = deploymentFixture(t);
  assert.equal(
    f.execute('cleanup-read-failure').failed,
    'Retain latest KingTurf recovery point and active images',
  );
  assert.doesNotMatch(readFileSync(f.log, 'utf8'), /cleanup/);
});

test('deployment verification uses the guarded disposable test target and full candidate quality gate', () => {
  const verify = workflow.split('  verify:\n')[1].split('  deploy:\n')[0];
  assert.match(verify, /POSTGRES_DB: kingturf_test/);
  assert.match(verify, /DATABASE_URL: postgresql:\/\/kingturf_test:.*\/kingturf_test/);
  assert.match(verify, /postgres:17\.7-alpine3\.23/);
  assert.match(verify, /- run: pnpm ci:local/);
  assert.doesNotMatch(verify, /kingturf_ci/);
});

test('all production transports pin host keys and run read-only inventory before backups or writes', () => {
  const deploy = workflow.split('  deploy:\n')[1];
  assert.doesNotMatch(deploy, /ssh-keyscan/);
  assert.ok(deploy.indexOf('Pin independently verified') < deploy.indexOf('ssh-private-key:'));
  assert.ok(
    deploy.indexOf('Read-only production storage') <
      deploy.indexOf('Create production recovery point'),
  );
  for (const line of deploy.split('\n').filter((line) => /\b(?:ssh|scp) -(?:p|P) /u.test(line)))
    assert.fail(`Unpinned direct SSH transport: ${line}`);
  assert.match(deploy, /StrictHostKeyChecking=yes/);
  assert.match(deploy, /UserKnownHostsFile=/);
  assert.match(
    stepRun('Read-only production storage and candidate schema preflight'),
    /--manifest packages\/database\/migrations/,
  );
});

function hostKeyFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'kingturf-pinned-host-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const key = join(root, 'test-key');
  execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', key], { stdio: 'ignore' });
  const pub = readFileSync(`${key}.pub`, 'utf8').trim();
  const output = join(root, 'actions-env');
  writeFileSync(output, 'unchanged\n');
  return { root, pub, output };
}

test('an independently pinned valid host key authorizes transports without network discovery', (t) => {
  const f = hostKeyFixture(t);
  const result = spawnSync(
    'bash',
    ['-e', '-o', 'pipefail', '-c', stepRun('Pin independently verified production SSH host key')],
    {
      env: {
        ...process.env,
        RUNNER_TEMP: f.root,
        GITHUB_ENV: f.output,
        PROD_SSH_HOST: 'deployment.invalid',
        PROD_SSH_PORT: '22',
        PINNED_KNOWN_HOSTS: `deployment.invalid ${f.pub}`,
      },
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(f.output, 'utf8'), /SSH_KNOWN_HOSTS_FILE=/);
});
for (const mode of ['missing', 'wrong-host', 'invalid-key']) {
  test(`host key ${mode} cannot authorize production SSH`, (t) => {
    const f = hostKeyFixture(t);
    const pinned =
      mode === 'missing'
        ? ''
        : mode === 'wrong-host'
          ? `other.invalid ${f.pub}`
          : 'deployment.invalid ssh-ed25519 not-a-key';
    const result = spawnSync(
      'bash',
      ['-e', '-o', 'pipefail', '-c', stepRun('Pin independently verified production SSH host key')],
      {
        env: {
          ...process.env,
          RUNNER_TEMP: f.root,
          GITHUB_ENV: f.output,
          PROD_SSH_HOST: 'deployment.invalid',
          PROD_SSH_PORT: '22',
          PINNED_KNOWN_HOSTS: pinned,
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
