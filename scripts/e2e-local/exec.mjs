// 子进程封装：所有输出经脱敏后再回显或返回；凭据只经环境变量传入（docker exec -e VAR 取
// 本进程环境的值），永不进入命令行参数，因此不会出现在进程列表里。
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { redactText, redactingWriter } from './redact.mjs';

const flushed = (stream) => new Promise((resolve) => stream.end(resolve));

/**
 * @param {string[]} args
 * @param {{env?: NodeJS.ProcessEnv, cwd?: string, secrets?: string[], capture?: boolean, signal?: AbortSignal}} [options]
 *   capture 为真时不回显，只返回脱敏后的 stdout / stderr。
 */
export function run(
  command,
  args,
  { env = process.env, cwd, secrets = [], capture = false, signal } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = { stdout: [], stderr: [] };
    const out = capture ? null : redactingWriter(process.stdout, secrets);
    const err = capture ? null : redactingWriter(process.stderr, secrets);
    child.stdout.on('data', (chunk) => {
      chunks.stdout.push(String(chunk));
      out?.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      chunks.stderr.push(String(chunk));
      err?.write(chunk);
    });
    const abort = () => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    child.once('error', (error) => {
      signal?.removeEventListener('abort', abort);
      reject(new Error(`${command} is required but could not be started: ${error.message}`));
    });
    child.once('close', (code, termination) => {
      signal?.removeEventListener('abort', abort);
      const sinks = [out, err].filter(Boolean);
      Promise.all(sinks.map(flushed)).then(() =>
        resolve({
          code,
          signal: termination,
          stdout: redactText(chunks.stdout.join(''), secrets),
          stderr: redactText(chunks.stderr.join(''), secrets),
        }),
      );
    });
  });
}

// docker 选项里取值的开关；其余以 - 开头的都是布尔开关（-d、--init、--rm 等）。
const VALUE_OPTIONS = new Set([
  '-e',
  '--env',
  '--entrypoint',
  '--user',
  '-u',
  '--name',
  '--workdir',
  '-w',
  '--mount',
  '--add-host',
  '--shm-size',
  '--time',
]);

/** 从 docker 参数里找出「按名转发」的环境变量名：只看第一个位置参数（镜像名或容器名）之前的 docker
 *  选项段，之后的 -e 属于容器内要执行的命令（例如 node -e）。 */
export function forwardedEnvNames(args) {
  const names = [];
  // args[0] 是 docker 子命令（run / exec / stop …），选项段从它之后开始。
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('-')) break;
    if (arg.includes('=')) continue;
    if (!VALUE_OPTIONS.has(arg)) continue;
    const value = args[index + 1] ?? '';
    if ((arg === '-e' || arg === '--env') && !value.includes('=')) names.push(value);
    index += 1;
  }
  return names;
}

/** 去掉参数开头的「--」。它是写给 shell 的分隔符（`e2e -- tests/e2e/x.spec.ts`），不是 Playwright 的参数：
 *  原样传过去，Playwright 会装载整个 testDir，在缺构建产物的文件上报错（TD-TEST-027）。只看第一个参数，
 *  选项后面的「--」属于调用方自己的写法，不动。 */
export function dropSeparator(args) {
  return args[0] === '--' ? args.slice(1) : args;
}

/** docker CLI 封装。`-e NAME`（不带值）表示从本进程环境取值转发进容器；环境里没有该变量时直接报错，
 *  否则容器内会拿到 undefined 且毫无提示（就绪探测曾因此永远失败）。 */
export function docker(args, options = {}) {
  const env = options.env ?? process.env;
  for (const name of forwardedEnvNames(args))
    assert(name in env, `docker -e ${name}: not set in the harness environment`);
  return run('docker', args, options);
}
