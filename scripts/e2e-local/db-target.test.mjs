// 库名硬闸的单元测试（node --test；不连数据库、不用 Docker）：不合规的目标必须直接报错。
// 连接串里的口令是字面量占位符，不是任何真实凭据。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ADMIN_DATABASE_URL,
  assertDedicatedName,
  assertDedicatedUrl,
  databaseName,
  dedicatedDatabaseName,
  dedicatedUrl,
  maintenanceUrl,
} from './db-target.mjs';

const PLACEHOLDER = 'postgresql://user:placeholder@127.0.0.1:5432/kingturf_dev';

async function withEnvironment(variables, run) {
  const saved = new Map(Object.keys(variables).map((key) => [key, process.env[key]]));
  const restore = () => {
    for (const [key, value] of saved)
      if (value === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = value;
  };
  for (const [key, value] of Object.entries(variables))
    if (value === undefined) Reflect.deleteProperty(process.env, key);
    else process.env[key] = value;
  try {
    await run();
  } finally {
    restore();
  }
}

test('dedicated names must contain a standalone test segment and be plain identifiers', () => {
  assert.equal(assertDedicatedName('kingturf_test_e2e_1a2b'), 'kingturf_test_e2e_1a2b');
  assert.equal(assertDedicatedName('test'), 'test');
  assert.throws(() => assertDedicatedName('kingturf_e2e_demo'), /test segment/u);
  assert.throws(() => assertDedicatedName('kingturf_contest'), /test segment/u);
  assert.throws(() => assertDedicatedName('KingTurf_test'), /may only contain/u);
  assert.throws(() => assertDedicatedName('kingturf_test;drop'), /may only contain/u);
});

test('the shared development and CI databases are refused even though one has a test segment', () => {
  for (const name of ['kingturf_dev', 'kingturf_test'])
    assert.throws(() => assertDedicatedName(name), /refusing shared database/u);
});

test('dedicated URLs must be loopback, test-segmented and not shared', () => {
  assert.equal(
    assertDedicatedUrl('postgresql://user:placeholder@localhost:5432/kingturf_test_e2e'),
    'postgresql://user:placeholder@localhost:5432/kingturf_test_e2e',
  );
  assert.throws(
    () => assertDedicatedUrl('postgresql://user:placeholder@localhost:5432/kingturf_test'),
    /refusing shared database kingturf_test/u,
  );
  assert.throws(
    () => assertDedicatedUrl('postgresql://user:placeholder@localhost:5432/kingturf_e2e'),
    /test segment/u,
  );
  assert.throws(
    () => assertDedicatedUrl('postgresql://user:placeholder@db.example.com:5432/kingturf_test_e2e'),
    /loopback host/u,
  );
});

test('the admin connection string is required and must point at a loopback server', async () => {
  await withEnvironment({ [ADMIN_DATABASE_URL]: undefined }, async () => {
    for (const derive of [maintenanceUrl, dedicatedUrl])
      assert.throws(() => derive(), new RegExp(`${ADMIN_DATABASE_URL} is required`, 'u'));
  });
  await withEnvironment(
    { [ADMIN_DATABASE_URL]: 'postgresql://user:placeholder@db.example.com:5432/kingturf_dev' },
    async () => {
      assert.throws(() => maintenanceUrl(), /loopback host/u);
    },
  );
  await withEnvironment({ [ADMIN_DATABASE_URL]: 'https://example.com/kingturf_dev' }, async () => {
    assert.throws(() => maintenanceUrl(), /must use PostgreSQL/u);
  });
});

test('maintenance goes to postgres; the dedicated URL is derived without its query string', async () => {
  await withEnvironment(
    {
      [ADMIN_DATABASE_URL]: `${PLACEHOLDER}?sslmode=disable`,
      E2E_LOCAL_DATABASE: 'kingturf_test_e2e_demo',
    },
    async () => {
      assert.equal(databaseName(maintenanceUrl()), 'postgres');
      assert.equal(databaseName(dedicatedUrl()), 'kingturf_test_e2e_demo');
      assert.equal(new URL(dedicatedUrl()).search, '');
      const inContainer = new URL(dedicatedUrl({ fromContainer: true }));
      assert.equal(inContainer.hostname, 'host.docker.internal');
      assert.equal(inContainer.pathname, '/kingturf_test_e2e_demo');
      assert.equal(inContainer.port, '5432');
    },
  );
  await withEnvironment(
    { [ADMIN_DATABASE_URL]: PLACEHOLDER, E2E_LOCAL_DATABASE: undefined },
    async () => {
      assert.match(dedicatedDatabaseName(), /^kingturf_test_e2e_[a-f0-9]{8}$/u);
    },
  );
  await withEnvironment(
    { [ADMIN_DATABASE_URL]: PLACEHOLDER, E2E_LOCAL_DATABASE: 'kingturf_test' },
    async () => {
      assert.throws(() => dedicatedUrl(), /refusing shared database/u);
    },
  );
});
