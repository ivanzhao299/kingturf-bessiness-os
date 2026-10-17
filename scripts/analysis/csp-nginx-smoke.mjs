// Local cached image only; never installs/reloads host nginx or builds an image.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { CONTENT_SECURITY_POLICY } from '../../packages/config/src/csp.ts';
import { readResponse } from './csp-nginx-client.mjs';

const image = 'nginx:1.28-alpine';
const source = readFileSync('infra/nginx/erp.kingturf.cn.conf', 'utf8');
assert.ok(
  source.includes('set $kingturf_csp_enforce off;'),
  'Repository enforcement default must be off',
);
assert.ok(
  source.includes('set $kingturf_csp_policy "' + CONTENT_SECURITY_POLICY + '";'),
  'API/nginx policy must match',
);
const prefix = source.slice(0, source.indexOf('  listen 443 ssl;'));
assert.ok(prefix.includes('proxy_hide_header Content-Security-Policy;'));
assert.ok(
  prefix.includes('add_header Content-Security-Policy-Report-Only $kingturf_csp_policy always;'),
);
const docker = (args, input) =>
  spawnSync('docker', args, {
    encoding: 'utf8',
    timeout: 15000,
    killSignal: 'SIGKILL',
    ...(input === undefined ? {} : { input }),
  });
const requireSuccess = (result, label) => {
  assert.equal(result.status, 0, label + ' failed (command/output withheld)');
  return result.stdout.trim();
};
const cases = [];
function removeOwnedContainer(name) {
  const inspection = docker([
    'container',
    'inspect',
    '--format',
    '{{ index .Config.Labels "kingturf.csp-smoke-owner" }}',
    name,
  ]);
  const missing = [
    'Error: No such object: ' + name,
    'Error: No such container: ' + name,
    'Error response from daemon: No such container: ' + name,
  ].includes(inspection.stderr.trim());
  if (!inspection.error && inspection.status !== 0 && missing) return false;
  if (inspection.status !== 0)
    console.error(
      JSON.stringify({
        kind: 'owned-container-inspection-failure',
        name,
        status: inspection.status,
      }),
    );
  requireSuccess(inspection, 'Owned container existence check');
  if (inspection.stdout.trim() !== name)
    console.error(JSON.stringify({ kind: 'owned-container-ownership-mismatch', name }));
  assert.ok(inspection.stdout.trim() === name, 'Refuse cleanup without exact random owner label');
  const removal = docker(['rm', '--force', name]);
  if (removal.status !== 0)
    console.error(
      JSON.stringify({ kind: 'owned-container-cleanup-failure', name, status: removal.status }),
    );
  requireSuccess(removal, 'Owned synthetic container cleanup');
  return true;
}
function cleanupOwnedContainers(names) {
  const failures = [];
  let removed = 0;
  for (const name of names) {
    try {
      if (removeOwnedContainer(name)) removed++;
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      'Owned container cleanup failed; inspect only the reported owned names',
    );
  return { attempted: names.length, removed, notFound: names.length - removed };
}
const headerValues = (headers, key) =>
  headers
    .filter((line) => line.toLowerCase().startsWith(key + ':'))
    .map((line) => line.slice(line.indexOf(':') + 1).trim());
for (const apiEnforce of [false, true]) {
  for (const outerEnforce of [false, true]) {
    const directory = mkdtempSync(join(tmpdir(), 'kingturf-csp-nginx-'));
    const name = 'kingturf-csp-' + randomUUID();
    let startAttempted = false;
    let cleaned = false;
    const attemptedNames = [];
    let cleanupSummary;
    try {
      const outer = prefix
        .replace('server_name erp.kingturf.cn;', 'server_name localhost;')
        .replace(/access_log [^;]+;/u, 'access_log off;')
        .replace(/error_log [^;]+;/u, 'error_log /dev/stderr warn;')
        .replace('proxy_pass http://127.0.0.1:4332;', 'proxy_pass http://127.0.0.1:8081;')
        .replace(
          'set $kingturf_csp_enforce off;',
          `set $kingturf_csp_enforce ${outerEnforce ? 'on' : 'off'};`,
        );
      const upstreamHeaders =
        'add_header Cache-Control "no-cache" always;\n' +
        'add_header Content-Security-Policy-Report-Only "synthetic-upstream-report" always;\n' +
        (apiEnforce
          ? 'add_header Content-Security-Policy "synthetic-upstream-enforced" always;\n'
          : '');
      const config =
        'pid /tmp/nginx.pid;\nerror_log /dev/stderr warn;\nevents {}\nhttp {\n' +
        outer +
        'listen 8080;\n}\nserver {listen 8081;\n' +
        'location / { ' +
        upstreamHeaders +
        'return 200 "synthetic"; }\n' +
        'location = /failure { ' +
        upstreamHeaders +
        'return 503 "synthetic"; }\n}\n}\n';
      writeFileSync(join(directory, 'nginx.conf'), config);
      const base = [
        'run',
        '--rm',
        '--pull',
        'never',
        '--network',
        'none',
        '--mount',
        `type=bind,source=${directory},target=/csp,readonly`,
        '--entrypoint',
        'nginx',
      ];
      const syntaxName = name + '-syntax';
      attemptedNames.push(syntaxName);
      requireSuccess(
        docker([
          ...base.slice(0, 2),
          '--name',
          syntaxName,
          '--label',
          'kingturf.csp-smoke-owner=' + syntaxName,
          ...base.slice(2),
          image,
          '-t',
          '-c',
          '/csp/nginx.conf',
        ]),
        'Local nginx syntax',
      );
      startAttempted = true;
      attemptedNames.push(name);
      const launch = docker([
        ...base.slice(0, 2),
        '--detach',
        '--name',
        name,
        '--label',
        'kingturf.csp-smoke-owner=' + name,
        ...base.slice(2),
        image,
        '-c',
        '/csp/nginx.conf',
        '-g',
        'daemon off;',
      ]);
      if (process.argv.includes('--fault-start-result'))
        throw new Error('Injected unknown Docker start result after actual launch');
      requireSuccess(launch, 'Owned local nginx start');
      let ready = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        if (
          docker(['exec', name, 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1:8080/'])
            .status === 0
        ) {
          ready = true;
          break;
        }
        await delay(100);
      }
      assert.ok(ready, 'Owned network-none nginx must become ready');
      const paths = [];
      for (const path of [
        '/',
        '/index.html',
        '/assets/synthetic.css',
        '/api/v1/synthetic',
        '/failure',
      ]) {
        const response = await readResponse(name, path);
        assert.ok(!response.error, 'Owned nginx HTTP command must complete');
        assert.equal(response.status, 0, 'Owned Docker HTTP client must exit successfully');
        const headers = response.stdout.split(/\r?\n/u).map((line) => line.trim());
        const values = (key) => headerValues(headers, key);
        const report = values('content-security-policy-report-only');
        const enforced = values('content-security-policy');
        assert.deepEqual(report, [CONTENT_SECURITY_POLICY], 'Exactly one outer RO header');
        assert.deepEqual(
          enforced,
          outerEnforce ? [CONTENT_SECURITY_POLICY] : [],
          'Only outer controls proxied enforcement',
        );
        assert.deepEqual(values('cache-control'), ['no-cache'], 'Inner Cache-Control remains');
        const status = Number(headers.find((line) => line.startsWith('HTTP/'))?.split(' ')[1]);
        assert.equal(status, path === '/failure' ? 503 : 200);
        paths.push({ path, status, reportOnly: report.length, enforced: enforced.length });
      }
      cases.push({ apiEnforce, outerEnforce, syntax: true, paths });
    } finally {
      try {
        cleanupSummary = cleanupOwnedContainers(attemptedNames);
        cleaned = true;
      } finally {
        // Even a container cleanup error must not skip this exact fresh fixture directory.
        assert.ok(directory.startsWith(join(tmpdir(), 'kingturf-csp-nginx-')));
        rmSync(directory, { recursive: true });
        console.error(
          JSON.stringify({
            kind: 'nginx-owned-cleanup',
            verified: cleaned,
            directoryGone: !existsSync(directory),
            ...cleanupSummary,
          }),
        );
      }
      assert.ok(!startAttempted || cleaned);
    }
  }
}
console.log(
  JSON.stringify({
    image,
    network: 'none',
    pull: 'never',
    cases,
    ownedCleanup: true,
    notTested: 'host TLS/ACME, real inner HTML app, deployment',
  }),
);
