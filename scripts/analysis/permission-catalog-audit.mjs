// 权限目录盘点（A2 / TD-SEC-012，只读回归工具，优先级随 2026-11-18 二次人裁降低）。
// 基准 = packages/types 的 FOUNDATION_CAPABILITIES + 全部迁移 SQL 中出现的 capability 字面量；
// 提供 DATABASE_URL 时额外对 permissions 表输出非种子行报告（含 grant 引用计数）。
// 本脚本只读、不修改任何数据；退出码恒为 0，清理为数据操作须另行批准。
//
//   node scripts/analysis/permission-catalog-audit.mjs [--json]
//   DATABASE_URL=postgresql://... node scripts/analysis/permission-catalog-audit.mjs
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../packages/database/package.json', import.meta.url));
const CAPABILITY = /^[a-z][a-z0-9_.-]*:[a-z][a-z0-9_.-]*$/u;
const QUOTED = /'([^'\n]+)'/gu;

/** 提取一段 SQL 文本中以字面量出现的 capability（覆盖种子 INSERT 与授权 VALUES）。 */
export function extractCapabilityLiterals(sqlText) {
  const found = new Set();
  for (const match of sqlText.matchAll(QUOTED)) {
    const literal = match[1];
    if (CAPABILITY.test(literal)) found.add(literal);
  }
  return found;
}

/** 从 packages/types 源文本中解析 FOUNDATION_CAPABILITIES 数组成员。 */
export function extractFoundationCapabilities(typesSource) {
  const start = typesSource.indexOf('FOUNDATION_CAPABILITIES = [');
  if (start < 0) throw new Error('FOUNDATION_CAPABILITIES array not found in types source');
  const end = typesSource.indexOf('] as const', start);
  if (end < 0) throw new Error('FOUNDATION_CAPABILITIES array is not closed as const');
  return [...extractCapabilityLiterals(typesSource.slice(start, end))].sort();
}

/** 汇总种子基准：foundation 常量 + 迁移字面量的并集。 */
export function buildSeedBaseline({ migrationTexts, foundationCapabilities }) {
  const baseline = new Set(foundationCapabilities);
  for (const text of migrationTexts) {
    for (const capability of extractCapabilityLiterals(text)) baseline.add(capability);
  }
  return baseline;
}

/** 对目录行产出非种子报告；rows 形如 {id,capability,created_by,grant_count}。 */
export function auditPermissionRows(baseline, rows) {
  const nonSeed = rows
    .filter((row) => !baseline.has(row.capability))
    .map((row) => ({
      id: row.id,
      capability: row.capability,
      createdBy: row.created_by ?? null,
      grantCount: Number(row.grant_count ?? 0),
    }));
  return {
    baselineSize: baseline.size,
    catalogSize: rows.length,
    nonSeedCount: nonSeed.length,
    nonSeed,
  };
}

async function loadBaseline() {
  const migrationsUrl = new URL('../../packages/database/migrations/', import.meta.url);
  const names = (await readdir(migrationsUrl)).filter((name) => name.endsWith('.sql')).sort();
  const migrationTexts = await Promise.all(
    names.map((name) => readFile(new URL(name, migrationsUrl), 'utf8')),
  );
  const typesSource = await readFile(
    new URL('../../packages/types/src/index.ts', import.meta.url),
    'utf8',
  );
  return {
    names,
    baseline: buildSeedBaseline({
      migrationTexts,
      foundationCapabilities: extractFoundationCapabilities(typesSource),
    }),
  };
}

async function loadCatalogRows() {
  if (!process.env.DATABASE_URL) return null;
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      'SELECT p.id,p.capability,p.created_by,count(g.role_id) AS grant_count FROM permissions p LEFT JOIN role_permission_grants g ON g.permission_id=p.id GROUP BY p.id,p.capability,p.created_by ORDER BY p.capability',
    );
    return result.rows;
  } finally {
    await client.end();
  }
}

export async function main(argv = process.argv.slice(2)) {
  const asJson = argv.includes('--json');
  const { names, baseline } = await loadBaseline();
  const rows = await loadCatalogRows();
  const report = rows ? auditPermissionRows(baseline, rows) : { baselineSize: baseline.size };
  if (asJson) {
    console.log(JSON.stringify({ migrations: names.length, ...report }, null, 2));
    return;
  }
  console.log(`permission catalog audit (read-only)`);
  console.log(`  migrations scanned: ${String(names.length)}`);
  console.log(`  seed baseline capabilities: ${String(baseline.size)}`);
  if (!rows) {
    console.log('  database comparison skipped (DATABASE_URL not provided)');
    return;
  }
  console.log(`  catalog rows: ${String(report.catalogSize)}`);
  console.log(`  non-seed rows: ${String(report.nonSeedCount)}`);
  for (const row of report.nonSeed)
    console.log(
      `    - ${row.capability} (id=${row.id} createdBy=${row.createdBy ?? 'null'} grants=${String(row.grantCount)})`,
    );
}

const invokedDirectly =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) {
  await main();
}
