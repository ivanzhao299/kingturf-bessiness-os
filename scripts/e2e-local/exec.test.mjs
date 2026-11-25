// docker 参数解析的单元测试（node --test；不启动 docker）：只把 docker 选项段里「按名转发」的环境
// 变量当作待转发的名字，容器内命令自带的 -e（如 node -e）不能被误认。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dropSeparator, forwardedEnvNames } from './exec.mjs';

test('only docker options before the first operand are inspected', () => {
  assert.deepEqual(
    forwardedEnvNames([
      'exec',
      '-d',
      '--workdir',
      '/work',
      '-e',
      'DATABASE_URL',
      '-e',
      'NODE_ENV=test',
      '--env=E2E_LOCAL_OUT=/out',
      'e2e-harness-abc',
      'sh',
      '-c',
      'exec node server.ts',
    ]),
    ['DATABASE_URL'],
  );
  assert.deepEqual(
    forwardedEnvNames([
      'run',
      '--rm',
      '-d',
      '--init',
      '--user',
      '1000:1000',
      '--add-host=host.docker.internal:host-gateway',
      '-e',
      'A',
      '--entrypoint',
      'node',
      'image',
      '-e',
      'process.exit(0)',
    ]),
    ['A'],
  );
});

test('commands without env forwarding yield no names and stop at the operand', () => {
  assert.deepEqual(forwardedEnvNames(['stop', '--time', '10', 'e2e-harness-abc', '-e', 'x']), []);
  assert.deepEqual(forwardedEnvNames(['ps', '-a', '--format', '{{.Names}}']), []);
});

test('a leading separator is dropped before the Playwright arguments are forwarded (TD-TEST-027)', () => {
  // 起栈横幅提示的写法。
  assert.deepEqual(dropSeparator(['--', 'tests/e2e/p1-demo.spec.ts']), [
    'tests/e2e/p1-demo.spec.ts',
  ]);
  assert.deepEqual(dropSeparator(['--', '--list', 'tests/e2e/p1-demo.spec.ts']), [
    '--list',
    'tests/e2e/p1-demo.spec.ts',
  ]);
  // 没有分隔符、空参数：原样返回（同一个数组，不复制）。
  const plain = ['tests/e2e/p1-demo.spec.ts'];
  assert.equal(dropSeparator(plain), plain);
  assert.deepEqual(dropSeparator([]), []);
  // 只看第一个参数：选项后面的「--」属于调用方自己的写法，不动。
  assert.deepEqual(dropSeparator(['-g', 'quote', '--', 'tests/a.spec.ts']), [
    '-g',
    'quote',
    '--',
    'tests/a.spec.ts',
  ]);
});
