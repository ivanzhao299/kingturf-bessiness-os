// 自举合成全权限账号到专用库（在宿主机执行；与 scripts/e2e-docker/fixture.mjs 的 seedUser(null)
// 同一建模）。登录名沿用 scripts/seed_p1_demo.mjs 与 tests/e2e/p1-demo.spec.ts 的默认值。
// 口令随机生成，只写入 E2E_LOCAL_CREDS_FILE（0600，缺省在仓库之外），绝不回显。
// 用法：DATABASE_URL=<专用库> node --experimental-transform-types scripts/e2e-local/bootstrap.mjs
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { chmodSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { assertDedicatedUrl, dedicatedUrl } from './db-target.mjs';

// apps/api/src/security.ts 含需要转换的 TypeScript 语法，故本脚本须以
// --experimental-transform-types 启动（与 apps/api/src/server.ts 相同）。
const { Database } = await import(new URL('../../packages/database/src/index.ts', import.meta.url));
const { PasswordHasher } = await import(new URL('../../apps/api/src/security.ts', import.meta.url));

export const DEFAULT_CREDS_FILE = '/tmp/kingturf-e2e-local/creds.json';
export const SYNTHETIC_ACCOUNTS = Object.freeze([
  { key: 'admin', login: 'admin', displayName: '本地 e2e 管理员' },
  { key: 'approver', login: 'credit.approver', displayName: '本地 e2e 信用审批' },
]);

export async function bootstrapAccounts(connectionString) {
  // 与自举目标保持同一硬闸：DATABASE_URL 必须就是本工具的专用库，拒绝任何其它目标。
  const target = new URL(assertDedicatedUrl(connectionString));
  target.search = '';
  target.hash = '';
  assert.equal(
    target.href,
    dedicatedUrl(),
    'DATABASE_URL must be the dedicated database derived from E2E_LOCAL_ADMIN_DATABASE_URL',
  );
  const database = new Database(connectionString);
  try {
    const existing = await database.query('SELECT count(*)::int AS n FROM identities');
    assert.equal(
      existing.rows[0].n,
      0,
      'dedicated database already has identities; refusing to seed into it (use a fresh database)',
    );
    const hasher = new PasswordHasher({
      saltBytes: 16,
      keyLength: 32,
      cost: 16384,
      blockSize: 8,
      parallelization: 1,
    });
    const companyId = randomUUID();
    await database.query(
      "INSERT INTO organizations(id,code,name,organization_type) VALUES($1,$2,'金特夫草坪（本地 e2e）','COMPANY')",
      [companyId, randomUUID()],
    );
    const accounts = {};
    for (const account of SYNTHETIC_ACCOUNTS) {
      accounts[account.key] = await seedUser(database, hasher, companyId, account);
    }
    return { companyId, accounts };
  } finally {
    await database.close();
  }
}

async function seedUser(database, hasher, companyId, account) {
  const teamId = randomUUID();
  await database.query(
    "INSERT INTO organizations(id,owner_organization_id,parent_id,code,name,organization_type) VALUES($1,$2,$2,$3,'本地 e2e 组','TEAM')",
    [teamId, companyId, randomUUID()],
  );
  const employeeId = randomUUID();
  const roleId = randomUUID();
  const identityId = randomUUID();
  const password = randomBytes(24).toString('base64url');
  const hash = await hasher.hash(password);
  await database.query(
    'INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,$4,$5,$6)',
    [
      employeeId,
      companyId,
      teamId,
      `E2E-${randomUUID().slice(0, 8)}`,
      account.displayName,
      `${employeeId}@example.test`,
    ],
  );
  await database.query('INSERT INTO identities(id,employee_id,login_name) VALUES($1,$2,$3)', [
    identityId,
    employeeId,
    account.login,
  ]);
  await database.query(
    "INSERT INTO password_credentials(identity_id,algorithm,password_hash,must_change_password) VALUES($1,'scrypt',$2,false)",
    [identityId, hash],
  );
  await database.query(
    'INSERT INTO organization_memberships(organization_id,employee_id) VALUES($1,$2)',
    [companyId, employeeId],
  );
  await database.query(
    "INSERT INTO roles(id,organization_id,code,name) VALUES($1,$2,$3,'本地 e2e 全权限')",
    [roleId, companyId, `E2E-LOCAL-${randomUUID().slice(0, 8)}`],
  );
  await database.query('INSERT INTO employee_role_assignments(employee_id,role_id) VALUES($1,$2)', [
    employeeId,
    roleId,
  ]);
  const granted = await database.query(
    "INSERT INTO role_permission_grants(role_id,permission_id,data_scopes) SELECT $1,id,ARRAY['COMPANY']::data_scope[] FROM permissions RETURNING 1",
    [roleId],
  );
  return { login: account.login, password, permissions: granted.rowCount };
}

export function writeCredentials(file, accounts) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  // 先写同目录临时文件再改名，保证已有同名文件时最终权限仍是 0600。
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(accounts), { mode: 0o600, flag: 'wx' });
  chmodSync(temporary, 0o600);
  renameSync(temporary, file);
}

async function main() {
  const file = process.env.E2E_LOCAL_CREDS_FILE ?? DEFAULT_CREDS_FILE;
  const { accounts } = await bootstrapAccounts(process.env.DATABASE_URL ?? '');
  writeCredentials(file, accounts);
  console.log(
    JSON.stringify({
      event: 'accounts-bootstrapped',
      file,
      logins: SYNTHETIC_ACCOUNTS.map((account) => account.login),
      permissions: accounts.admin.permissions,
    }),
  );
}

if (process.argv[1] === new URL(import.meta.url).pathname)
  main().catch((error) => {
    console.error(`bootstrap: ${error.message}`);
    process.exitCode = 1;
  });
