// 本地真浏览器 e2e 的数据库目标守卫（TD-TEST-023，零第三方依赖）。本工具的每一次数据库连接
// 都必须经过这里：
//   · 专用库库名必须含 test 段（复用 packages/database 的 assertTestDatabaseTarget），否则直接报错退出；
//   · 不得是共享的 kingturf_dev / kingturf_test（.env.example 与 CI 工作流在用）；
//   · 管理连接串只用于取服务器地址与凭据，必须指向回环地址，本工具从不连接它指向的库；
//   · 建库/删库只连 postgres 维护库，其余连接只连专用库本身。
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const { assertTestDatabaseTarget } = await import(
  new URL('../../packages/database/src/index.ts', import.meta.url)
);

export const ADMIN_DATABASE_URL = 'E2E_LOCAL_ADMIN_DATABASE_URL';
export const SHARED_DATABASES = Object.freeze(['kingturf_dev', 'kingturf_test']);
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export const databaseName = (connectionString) =>
  new URL(connectionString).pathname.replace(/^\/+/u, '');

export function assertDedicatedName(name) {
  assert.match(name, /^[a-z0-9_]+$/u, 'dedicated database name may only contain [a-z0-9_]');
  assert(
    !SHARED_DATABASES.includes(name),
    `refusing shared database ${name}; pass a dedicated one via E2E_LOCAL_DATABASE`,
  );
  // 复用仓库既有守卫（库名必须含独立的 test 段，kingturf_contest 不算），只换成带上下文的提示。
  try {
    assertTestDatabaseTarget(`postgresql://localhost/${name}`, 'test');
  } catch {
    throw new Error(
      `refusing database ${name}: the name must contain a standalone test segment, e.g. kingturf_test_e2e_demo`,
    );
  }
  return name;
}

export function assertDedicatedUrl(connectionString) {
  assertTestDatabaseTarget(connectionString, 'test');
  const name = databaseName(connectionString);
  assert(
    !SHARED_DATABASES.includes(name),
    `refusing shared database ${name}; the harness only writes to a dedicated test database`,
  );
  return connectionString;
}

/** 调用方经环境变量传入的管理连接串：只取服务器地址与凭据。 */
export function adminServer() {
  const value = process.env[ADMIN_DATABASE_URL] ?? '';
  assert(
    value,
    `${ADMIN_DATABASE_URL} is required (connection string of a loopback PostgreSQL server; the database it names is never connected)`,
  );
  const target = new URL(value);
  assert(/^postgres(?:ql)?:$/u.test(target.protocol), `${ADMIN_DATABASE_URL} must use PostgreSQL`);
  assert(LOOPBACK.has(target.hostname), `${ADMIN_DATABASE_URL} must point at a loopback host`);
  return target;
}

/** 专用库库名：调用方经 E2E_LOCAL_DATABASE 指定，缺省随机生成（自建自清的一次性库）。 */
export function dedicatedDatabaseName() {
  const name =
    process.env.E2E_LOCAL_DATABASE ?? `kingturf_test_e2e_${randomBytes(4).toString('hex')}`;
  return assertDedicatedName(name);
}

/** 建库/删库用的维护连接：同一台服务器上的 postgres 库（PostgreSQL 建库必须先连到一个已存在的库）。 */
export function maintenanceUrl() {
  const target = new URL(adminServer().href);
  target.pathname = '/postgres';
  target.search = '';
  target.hash = '';
  return target.href;
}

/** 专用库连接串。fromContainer 为真时主机名换成 host.docker.internal（容器内经 Docker 网关访问宿主机）。 */
export function dedicatedUrl({ fromContainer = false } = {}) {
  const target = new URL(adminServer().href);
  target.pathname = `/${dedicatedDatabaseName()}`;
  target.search = '';
  target.hash = '';
  if (fromContainer) {
    target.hostname = 'host.docker.internal';
    return target.href;
  }
  return assertDedicatedUrl(target.href);
}
