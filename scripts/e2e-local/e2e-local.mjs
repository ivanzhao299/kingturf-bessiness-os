#!/usr/bin/env node
// 本地真浏览器 e2e 入口（TD-TEST-023）。在 Docker 官方 Playwright 镜像里跑真浏览器，不需要项目所有者
// 口令：自建一次性专用库 → 自举合成全权限账号 → 起「浏览器 + 预览 + API 同容器」栈 → 灌 P1 演示数据
// → 跑 e2e → 拆栈并删库。说明见 docs/engineering/local-e2e-browser-harness.md。
import assert from 'node:assert/strict';
import { redactText } from './redact.mjs';
import {
  DEFAULT_SPEC,
  assertStackRunning,
  bringUp,
  knownSecrets,
  newContainerName,
  prepareDatabase,
  readCredentials,
  readState,
  resolveContext,
  runPlaywright,
  runWalk,
  seedDemoData,
  tearDown,
} from './stack.mjs';

const HARNESS = 'scripts/e2e-local';
const USAGE = `usage: node ${HARNESS}/e2e-local.mjs <command>

  run [--keep-database] [--skip-build] [--skip-seed] -- [playwright args]
      全流程：建库 → 迁移 → 自举账号 → 构建 → 起栈 → 灌演示数据 → 跑 e2e → 拆栈删库。
      不带参数时跑 ${DEFAULT_SPEC}。
  up [--skip-build] [--skip-seed]
      起栈并保持运行（库与口令文件保留，供反复跑 e2e / walk）。
  e2e [playwright args]
      对运行中的栈跑 Playwright（在容器内执行）。
  walk [--viewport desktop|mobile|宽x高[@倍率]] [--routes a,b] [--out 目录]
      对运行中的栈跑全站走查，输出逐路由结果与截图。
  seed
      对运行中的栈重灌 P1 演示数据（幂等，可重复执行）。
  down [--keep-database]
      拆栈：停容器、删口令文件、删专用库。

环境变量（连接串与口令只经环境变量传入，仓库内不含任何凭据）：
  E2E_LOCAL_ADMIN_DATABASE_URL  必填。目标 PostgreSQL 的连接串（回环地址）；只取服务器地址与凭据，
                                本工具从不连接它指向的库，建库/删库只连 postgres 维护库。
  E2E_LOCAL_DATABASE            专用库名（必须含 test 段，不得是 kingturf_dev / kingturf_test）；缺省随机生成。
  E2E_LOCAL_OUT                 产物目录，必须在仓库之外；缺省 /tmp/kingturf-e2e-local。
  E2E_LOCAL_API_PORT / E2E_LOCAL_WEB_PORT  容器内端口；缺省 3938 / 4198（宿主机不监听任何端口）。
  E2E_LOCAL_CONTAINER           容器名，必须以 e2e-harness- 开头；缺省按时间戳生成。
  E2E_LOCAL_IMAGE               Playwright 镜像；缺省与仓库锁定的 @playwright/test 版本一致。`;

function split(args, allowed) {
  const flags = new Set();
  const passthrough = [];
  let own = true;
  for (const arg of args) {
    if (own && arg === '--') {
      own = false;
    } else if (own && arg.startsWith('--')) {
      const name = arg.slice(2);
      assert(allowed.includes(name), `unknown option --${name} for this command\n\n${USAGE}`);
      flags.add(name);
    } else passthrough.push(arg);
  }
  return { flags, passthrough };
}

async function main(argv, signal) {
  const [command = 'run', ...rest] = argv;
  if (['help', '--help', '-h'].includes(command)) {
    console.log(USAGE);
    return 0;
  }
  assert(
    ['run', 'up', 'e2e', 'walk', 'seed', 'down'].includes(command),
    `unknown command ${command}\n\n${USAGE}`,
  );
  const context = resolveContext();
  if (command === 'run' || command === 'up') {
    const options =
      command === 'run'
        ? ['keep-database', 'skip-build', 'skip-seed']
        : ['skip-build', 'skip-seed'];
    const { flags, passthrough } = split(rest, options);
    assert(
      readState(context) === null,
      `a stack is already recorded in ${context.stateFile}; run \`${HARNESS}/e2e-local.mjs down\` first`,
    );
    context.container = newContainerName();
    const running = { secrets: knownSecrets(), signal };
    if (command === 'up') {
      await prepareDatabase(context, running);
      await bringUp(context, {
        ...running,
        skipBuild: flags.has('skip-build'),
        skipSeed: flags.has('skip-seed'),
      });
      const credentials = readCredentials(context);
      console.log(
        `stack up: container ${context.container}, database ${process.env.E2E_LOCAL_DATABASE}\n` +
          `  e2e:     node ${HARNESS}/e2e-local.mjs e2e -- tests/e2e/p1-demo.spec.ts\n` +
          `  walk:    node ${HARNESS}/e2e-local.mjs walk --viewport desktop\n` +
          `  down:    node ${HARNESS}/e2e-local.mjs down\n` +
          `  (synthetic logins: ${Object.values(credentials)
            .map((account) => account.login)
            .join(', ')}; passwords only in ${context.credsFile})`,
      );
      return 0;
    }
    let code = 1;
    try {
      await prepareDatabase(context, running);
      await bringUp(context, {
        ...running,
        skipBuild: flags.has('skip-build'),
        skipSeed: flags.has('skip-seed'),
      });
      const credentials = readCredentials(context);
      code = await runPlaywright(
        context,
        credentials,
        { ...running, secrets: knownSecrets(credentials) },
        passthrough.length > 0 ? passthrough : [DEFAULT_SPEC],
      );
    } finally {
      await tearDown(context, { ...running, keepDatabase: flags.has('keep-database') });
    }
    return code ?? 1;
  }
  const state = readState(context);
  assert(
    state,
    `no stack recorded in ${context.stateFile}; run \`${HARNESS}/e2e-local.mjs up\` first`,
  );
  context.container = state.container;
  const credentials = readCredentials(context);
  const running = { secrets: knownSecrets(credentials), signal };
  if (command === 'down') {
    const { flags } = split(rest, ['keep-database']);
    await tearDown(context, { ...running, keepDatabase: flags.has('keep-database') });
    console.log(
      `stack down: container ${state.container} removed${flags.has('keep-database') ? `, database ${state.database} kept` : `, database ${state.database} dropped`}`,
    );
    return 0;
  }
  await assertStackRunning(context, running);
  if (command === 'seed') {
    await seedDemoData(context, credentials, running);
    console.log(`seeded P1 demo data into ${state.database}`);
    return 0;
  }
  if (command === 'e2e')
    return (
      (await runPlaywright(
        context,
        credentials,
        running,
        rest.length > 0 ? rest : [DEFAULT_SPEC],
      )) ?? 1
    );
  return (await runWalk(context, running, rest)) ?? 1;
}

const controller = new AbortController();
const interrupt = () => controller.abort();
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);

main(process.argv.slice(2), controller.signal).then(
  (code) => {
    process.exitCode = controller.signal.aborted ? 130 : code;
  },
  (error) => {
    let secrets = [];
    try {
      secrets = knownSecrets();
    } catch {
      secrets = [];
    }
    console.error(`e2e-local: ${redactText(error.message, secrets)}`);
    process.exitCode = controller.signal.aborted ? 130 : 1;
  },
);
