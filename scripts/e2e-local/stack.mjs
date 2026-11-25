// 「浏览器 + 预览 + API 同容器」栈（TD-TEST-023）。浏览器、vite preview、API 三个进程都在同一个
// Playwright 容器的网络命名空间里，只有数据库连接经 host.docker.internal 穿过 Docker。
// 不采用「容器内中转访问宿主机」：那种拓扑下首屏约 70 个新连接偶发 TCP 建连卡顿（约 15 秒），
// tests/e2e/p1-demo.spec.ts 随机失败 1–2 例；同一网络命名空间下仓库原配置稳定通过。
// 栈内进程随容器整体启停，宿主机上没有常驻进程，清理只按本工具自己的容器名。
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { docker, dropSeparator, run } from './exec.mjs';
import { ADMIN_DATABASE_URL, dedicatedDatabaseName, dedicatedUrl } from './db-target.mjs';
import { createDatabase, dropDatabase, migrateDatabase } from './database.mjs';
import { redactText } from './redact.mjs';

export const CONTAINER_PREFIX = 'e2e-harness-';
export const DEFAULT_SPEC = 'tests/e2e/p1-demo.spec.ts';
export const DEFAULT_OUT = '/tmp/kingturf-e2e-local';
const HARNESS = 'scripts/e2e-local';
const READY_PROBE = `const ok = async (url) => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
};
const api = 'http://127.0.0.1:' + process.env.E2E_LOCAL_API_PORT;
const web = 'http://127.0.0.1:' + process.env.E2E_LOCAL_WEB_PORT;
// 经预览代理探 /ready，同时验证代理与 API。
process.exit((await ok(api + '/ready')) && (await ok(web + '/ready')) ? 0 : 1);`;
const API_COMMAND =
  'mkdir -p "$E2E_LOCAL_OUT/logs" "$ATTACHMENT_LOCAL_DIRECTORY" && exec node --experimental-transform-types apps/api/src/server.ts >> "$E2E_LOCAL_OUT/logs/api.log" 2>&1';
const WEB_COMMAND =
  'exec node node_modules/vite/bin/vite.js preview --config "$E2E_LOCAL_ROOT/scripts/e2e-local/vite.preview.config.mjs" >> "$E2E_LOCAL_OUT/logs/web.log" 2>&1';

const tcpPort = (value, name) => {
  const number = Number(value);
  assert(
    Number.isSafeInteger(number) && number > 0 && number < 65536,
    `${name} must be a TCP port`,
  );
  return number;
};

const ownedName = (name) =>
  assert(
    /^e2e-harness-[a-z0-9-]+$/u.test(name ?? ''),
    `refusing to touch container ${name}: only ${CONTAINER_PREFIX}* is owned by this harness`,
  );

export function newContainerName() {
  const name = process.env.E2E_LOCAL_CONTAINER ?? `${CONTAINER_PREFIX}${Date.now().toString(36)}`;
  ownedName(name);
  return name;
}

/** 上下文：仓库根、仓库之外的产物目录、两个容器内端口（宿主机上不监听任何端口）。 */
export function resolveContext() {
  const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
  const out = resolve(process.env.E2E_LOCAL_OUT ?? DEFAULT_OUT);
  assert(
    relative(root, out).startsWith('..'),
    `E2E_LOCAL_OUT must be outside the repository: ${out}`,
  );
  return {
    root,
    out,
    apiPort: tcpPort(process.env.E2E_LOCAL_API_PORT ?? 3938, 'E2E_LOCAL_API_PORT'),
    webPort: tcpPort(process.env.E2E_LOCAL_WEB_PORT ?? 4198, 'E2E_LOCAL_WEB_PORT'),
    stateFile: join(out, 'state.json'),
    credsFile: join(out, 'creds.json'),
    container: null,
  };
}

export function resolveImage() {
  if (process.env.E2E_LOCAL_IMAGE) return process.env.E2E_LOCAL_IMAGE;
  // 镜像版本跟随仓库锁定的 @playwright/test，避免浏览器与测试框架版本错配。
  const entry = createRequire(import.meta.url).resolve('@playwright/test');
  const { version } = JSON.parse(readFileSync(join(dirname(entry), 'package.json'), 'utf8'));
  return `mcr.microsoft.com/playwright:v${version}-noble`;
}

/** 需要脱敏的值：管理连接串及其口令（编码/解码两种形态）、两个合成账号的口令。 */
export function knownSecrets(credentials) {
  const admin = process.env[ADMIN_DATABASE_URL] ?? '';
  const encoded = admin ? new URL(admin).password : '';
  let decoded = '';
  try {
    decoded = encoded ? decodeURIComponent(encoded) : '';
  } catch {
    decoded = '';
  }
  return [
    admin,
    encoded,
    decoded,
    credentials?.admin?.password,
    credentials?.approver?.password,
  ].filter(Boolean);
}

export function readCredentials(context) {
  return JSON.parse(readFileSync(context.credsFile, 'utf8'));
}

const removeIfExists = (file) => {
  try {
    unlinkSync(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

export function readState(context) {
  try {
    return JSON.parse(readFileSync(context.stateFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export function writeState(context, state) {
  mkdirSync(dirname(context.stateFile), { recursive: true, mode: 0o700 });
  writeFileSync(context.stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
  chmodSync(context.stateFile, 0o600);
}

export const clearState = (context) => {
  // 口令文件与状态文件一起清掉；库由调用方随后删除。
  removeIfExists(context.credsFile);
  removeIfExists(context.stateFile);
};

const containerExists = async (name, options) =>
  (await docker(['container', 'inspect', name], { ...options, capture: true })).code === 0;

async function logTails(context, secrets) {
  const lines = [];
  for (const name of ['api.log', 'web.log']) {
    let text = '';
    try {
      text = readFileSync(join(context.out, 'logs', name), 'utf8');
    } catch {
      text = '';
    }
    lines.push(`--- ${name} (last 15 lines) ---`);
    lines.push(...text.trimEnd().split('\n').slice(-15));
  }
  return redactText(lines.join('\n'), secrets);
}

/** 建专用库（自建）→ 写状态 → 迁移 → 自举两个合成全权限账号（口令落 0600 文件）。 */
export async function prepareDatabase(context, options = {}) {
  const database = dedicatedDatabaseName();
  // 固定库名：随后的迁移、自举与容器内连接都必须落到同一个库（随机名只生成一次）。
  process.env.E2E_LOCAL_DATABASE = database;
  await createDatabase(database);
  writeState(context, {
    container: context.container,
    database,
    image: context.image,
    apiPort: context.apiPort,
    webPort: context.webPort,
    root: context.root,
    out: context.out,
    startedAt: new Date().toISOString(),
  });
  await migrateDatabase();
  // bootstrap.mjs 依赖 apps/api 的口令哈希实现，须以 --experimental-transform-types 启动。
  const bootstrap = await run(
    process.execPath,
    ['--experimental-transform-types', join(context.root, HARNESS, 'bootstrap.mjs')],
    {
      ...options,
      capture: true,
      env: {
        ...process.env,
        DATABASE_URL: dedicatedUrl(),
        E2E_LOCAL_CREDS_FILE: context.credsFile,
        E2E_LOCAL_OUT: context.out,
      },
    },
  );
  assert.equal(bootstrap.code, 0, `bootstrap failed: ${bootstrap.stderr.trim()}`);
  return database;
}

const HOST_USER =
  typeof process.getuid === 'function' ? `${process.getuid()}:${process.getgid()}` : null;

/** 容器尽量以宿主机用户的身份运行：写进产物目录的文件归宿主机用户所有，宿主机侧可读可删。
 *  镜像里没有这个 uid 的账号时（os.userInfo 会失败）退回 root，由 restoreOwnership 兜底。 */
async function resolveContainerUser(image, options) {
  if (!HOST_USER) return null;
  const probe = await docker(
    [
      'run',
      '--rm',
      '--user',
      HOST_USER,
      '--entrypoint',
      'node',
      image,
      '-e',
      'require("node:os").userInfo()',
    ],
    { ...options, capture: true },
  );
  return probe.code === 0 ? HOST_USER : null;
}

/** 把产物目录的属主改回宿主机用户（容器以 root 运行时的兜底；本来就是宿主机用户的文件则不变）。 */
async function restoreOwnership(context, options) {
  if (!HOST_USER) return;
  // vite 会把打包后的配置写到源码树的 node_modules/.vite-temp，一并归还属主。
  const viteTemp = join(context.root, 'node_modules', '.vite-temp');
  const owned = [context.out, ...(existsSync(viteTemp) ? [viteTemp] : [])];
  await docker(['exec', '-u', '0', context.container, 'chown', '-R', HOST_USER, ...owned], {
    ...options,
    capture: true,
  });
}

async function startContainer(context, options) {
  ownedName(context.container);
  assert(
    !(await containerExists(context.container, options)),
    `container ${context.container} already exists; remove it first or set E2E_LOCAL_CONTAINER`,
  );
  const image = context.image ?? resolveImage();
  assert(
    (await docker(['image', 'inspect', image], { ...options, capture: true })).code === 0,
    `Docker image ${image} is missing; run: docker pull ${image}`,
  );
  const user = await resolveContainerUser(image, options);
  mkdirSync(context.out, { recursive: true, mode: 0o700 });
  // 源码树与产物目录按相同路径挂进容器，容器内外的相对布局一致。
  const started = await docker(
    [
      'run',
      '-d',
      '--name',
      context.container,
      ...(user ? ['--user', user] : []),
      '--init',
      '--shm-size=1g',
      '--add-host=host.docker.internal:host-gateway',
      '--mount',
      `type=bind,source=${context.root},target=${context.root}`,
      '--mount',
      `type=bind,source=${context.out},target=${context.out}`,
      '--workdir',
      context.root,
      image,
      'sleep',
      'infinity',
    ],
    { ...options, capture: true },
  );
  assert.equal(started.code, 0, `docker run failed: ${started.stderr.trim()}`);
}

/** 容器内 API 与预览共用的环境设置（不含本进程环境）。 */
function containerSettings(context, sessionSecret) {
  return {
    E2E_LOCAL_ROOT: context.root,
    E2E_LOCAL_OUT: context.out,
    E2E_LOCAL_API_PORT: String(context.apiPort),
    E2E_LOCAL_WEB_PORT: String(context.webPort),
    // 容器内经 Docker 网关访问宿主机上的数据库；值只进环境，不进命令行。
    DATABASE_URL: dedicatedUrl({ fromContainer: true }),
    NODE_ENV: 'test',
    SESSION_SECRET: sessionSecret,
    SESSION_TTL_SECONDS: '14400',
    SESSION_TRUSTED_ORIGINS: `http://127.0.0.1:${context.webPort}`,
    TOKEN_LOGIN_ENABLED: 'true',
    API_HOST: '127.0.0.1',
    API_PORT: String(context.apiPort),
    PASSWORD_SALT_BYTES: '16',
    PASSWORD_KEY_LENGTH: '32',
    PASSWORD_SCRYPT_COST: '16384',
    PASSWORD_SCRYPT_BLOCK_SIZE: '8',
    PASSWORD_SCRYPT_PARALLELIZATION: '1',
    ATTACHMENT_STORAGE_ADAPTER: 'local',
    ATTACHMENT_LOCAL_DIRECTORY: join(context.out, 'attachments'),
    WEBSITE_LEAD_INGEST_SECRET: '',
    LOGIN_RATE_LIMIT_ENABLED: 'false',
  };
}

async function startServices(context, options) {
  // 转发的变量名直接取自设置对象，两者不会漂移；值经环境传入，不进命令行。
  const settings = containerSettings(context, randomBytes(32).toString('hex'));
  const forwarded = Object.keys(settings).flatMap((name) => ['-e', name]);
  const env = { ...process.env, ...settings };
  const api = await docker(
    [
      'exec',
      '-d',
      '--workdir',
      context.root,
      ...forwarded,
      context.container,
      'sh',
      '-c',
      API_COMMAND,
    ],
    { ...options, env, capture: true },
  );
  assert.equal(api.code, 0, `API failed to start: ${api.stderr.trim()}`);
  const web = await docker(
    [
      'exec',
      '-d',
      '--workdir',
      join(context.root, 'apps/web'),
      ...forwarded,
      context.container,
      'sh',
      '-c',
      WEB_COMMAND,
    ],
    { ...options, env, capture: true },
  );
  assert.equal(web.code, 0, `web preview failed to start: ${web.stderr.trim()}`);
}

export async function waitUntilReady(context, options = {}, attempts = 120) {
  const started = Date.now();
  const env = {
    ...process.env,
    E2E_LOCAL_API_PORT: String(context.apiPort),
    E2E_LOCAL_WEB_PORT: String(context.webPort),
  };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const probe = await docker(
      [
        'exec',
        '-e',
        'E2E_LOCAL_API_PORT',
        '-e',
        'E2E_LOCAL_WEB_PORT',
        context.container,
        'node',
        '-e',
        READY_PROBE,
      ],
      { ...options, env, capture: true },
    );
    if (probe.code === 0) {
      console.log(`stack ready after ${((Date.now() - started) / 1000).toFixed(1)}s`);
      await restoreOwnership(context, options);
      return;
    }
    if (attempt > 0 && attempt % 20 === 0)
      console.log(`waiting for the stack… ${Math.round((Date.now() - started) / 1000)}s`);
    await delay(1000);
  }
  throw new Error(
    `stack did not become ready within ${attempts} seconds\n${await logTails(context, options.secrets ?? [])}`,
  );
}

/** 用仓库自带的 scripts/seed_p1_demo.mjs（在容器内经 API 写入专用库）灌 P1 演示数据。 */
export async function seedDemoData(context, credentials, options = {}) {
  const settings = {
    KINGTURF_BASE_URL: `http://127.0.0.1:${context.apiPort}`,
    KINGTURF_ADMIN_LOGIN: credentials.admin.login,
    KINGTURF_ADMIN_PASSWORD: credentials.admin.password,
    KINGTURF_CREDIT_APPROVER_LOGIN: credentials.approver.login,
    KINGTURF_CREDIT_APPROVER_PASSWORD: credentials.approver.password,
  };
  const seeded = await docker(
    [
      'exec',
      '--workdir',
      context.root,
      ...Object.keys(settings).flatMap((name) => ['-e', name]),
      context.container,
      'node',
      'scripts/seed_p1_demo.mjs',
    ],
    { ...options, capture: true, env: { ...process.env, ...settings } },
  );
  mkdirSync(join(context.out, 'logs'), { recursive: true, mode: 0o700 });
  writeFileSync(join(context.out, 'logs', 'seed.log'), `${seeded.stdout}${seeded.stderr}`, {
    mode: 0o600,
  });
  assert.equal(seeded.code, 0, `P1 demo seed failed; see ${join(context.out, 'logs', 'seed.log')}`);
}

/** 构建 web 产物（宿主机执行，产物留在源码树的 apps/web/dist，容器直接读取）。 */
export async function buildWeb(context, options = {}) {
  const built = await run('pnpm', ['--silent', '--filter', '@kingturf/web', 'build'], {
    ...options,
    cwd: context.root,
  });
  assert.equal(built.code, 0, 'web build failed');
}

/** 起栈：构建 → 起容器 → 起同容器内的 API 与预览 → 等就绪 → 灌演示数据。 */
export async function bringUp(context, { skipBuild = false, skipSeed = false, ...options } = {}) {
  if (!skipBuild) await buildWeb(context, options);
  await startContainer(context, options);
  await startServices(context, options);
  await waitUntilReady(context, options);
  if (!skipSeed) await seedDemoData(context, readCredentials(context), options);
}

/** 在容器内跑 Playwright（仓库原配置经 pw.config.ts 包装：改用自带 Chromium）。 */
export async function runPlaywright(context, credentials, options = {}, args = [DEFAULT_SPEC]) {
  const config = args.some((arg) => arg.startsWith('--config'))
    ? []
    : [`--config=${join(context.root, HARNESS, 'pw.config.ts')}`];
  const reporter = args.some((arg) => arg.startsWith('--reporter')) ? [] : ['--reporter=list'];
  const settings = {
    KINGTURF_BASE_URL: `http://127.0.0.1:${context.webPort}`,
    KINGTURF_ADMIN_LOGIN: credentials.admin.login,
    KINGTURF_ADMIN_PASSWORD: credentials.admin.password,
    E2E_LOCAL_RESULTS: join(context.out, 'results'),
  };
  const played = await docker(
    [
      'exec',
      '--workdir',
      context.root,
      ...Object.keys(settings).flatMap((name) => ['-e', name]),
      context.container,
      'node',
      'node_modules/@playwright/test/cli.js',
      'test',
      ...config,
      ...reporter,
      // 起栈横幅提示的写法是 `e2e -- tests/e2e/p1-demo.spec.ts`；「--」到不了 Playwright（TD-TEST-027）。
      ...dropSeparator(args),
    ],
    { ...options, env: { ...process.env, ...settings } },
  );
  await restoreOwnership(context, options);
  return played.code;
}

/** 在容器内跑全站走查；参数原样传给 walk.mjs。 */
export async function runWalk(context, options = {}, args = []) {
  const settings = {
    KINGTURF_BASE_URL: `http://127.0.0.1:${context.webPort}`,
    KINGTURF_CREDS_FILE: context.credsFile,
    E2E_LOCAL_OUT: context.out,
  };
  const walked = await docker(
    [
      'exec',
      '--workdir',
      context.root,
      ...Object.keys(settings).flatMap((name) => ['-e', name]),
      context.container,
      'node',
      `${HARNESS}/walk.mjs`,
      ...args,
    ],
    { ...options, env: { ...process.env, ...settings } },
  );
  await restoreOwnership(context, options);
  return walked.code;
}

/** 在容器内跑写流程冒烟；参数原样传给 write-smoke.mjs。KINGTURF_API_URL 供信用流程里明确标注的
 *  接口前置数据使用（令牌登录，与 seed 同款）。 */
export async function runWriteSmoke(context, options = {}, args = []) {
  const settings = {
    KINGTURF_BASE_URL: `http://127.0.0.1:${context.webPort}`,
    KINGTURF_API_URL: `http://127.0.0.1:${context.apiPort}`,
    KINGTURF_CREDS_FILE: context.credsFile,
    E2E_LOCAL_OUT: context.out,
  };
  const smoked = await docker(
    [
      'exec',
      '--workdir',
      context.root,
      ...Object.keys(settings).flatMap((name) => ['-e', name]),
      context.container,
      'node',
      `${HARNESS}/write-smoke.mjs`,
      ...args,
    ],
    { ...options, env: { ...process.env, ...settings } },
  );
  await restoreOwnership(context, options);
  return smoked.code;
}

export const assertStackRunning = async (context, options = {}) => {
  ownedName(context.container);
  assert(
    await containerExists(context.container, options),
    `container ${context.container} is not running; run \`node ${HARNESS}/e2e-local.mjs up\` first`,
  );
};

/** 拆栈：只按本工具自己的容器名停容器 → 清口令与状态文件 → 删专用库（自清）。 */
export async function tearDown(context, { keepDatabase = false, ...options } = {}) {
  const state = readState(context);
  const problems = [];
  if (context.container) {
    try {
      ownedName(context.container);
      if (await containerExists(context.container, options)) {
        await restoreOwnership(context, options);
        await docker(['stop', '--time', '10', context.container], { ...options, capture: true });
        await docker(['rm', context.container], { ...options, capture: true });
      }
    } catch (error) {
      problems.push(`container ${context.container}: ${error.message}`);
    }
  }
  clearState(context);
  if (!keepDatabase && state?.database) {
    try {
      await dropDatabase(state.database);
    } catch (error) {
      problems.push(`database ${state.database}: ${error.message}`);
    }
  }
  // 口令文件已删，这里只剩连接串口令需要脱敏。
  assert.equal(problems.length, 0, `teardown incomplete:\n  ${problems.join('\n  ')}`);
}
