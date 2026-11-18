import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditPermissionRows,
  buildSeedBaseline,
  extractCapabilityLiterals,
  extractFoundationCapabilities,
} from './permission-catalog-audit.mjs';

const fixtureMigrations = [
  `INSERT INTO permissions(capability,description) VALUES
   ('customer:read','Read customers'),('customer:manage','Manage customers');
  CREATE TABLE permissions (capability text CHECK (capability ~ '^[a-z][a-z0-9_.-]*:[a-z][a-z0-9_.-]*$'));`,
  `WITH grants(role_code,capability) AS (VALUES
   ('KT_IAM_ADMIN','authorization:manage'),('KT_IAM_ADMIN','authorization:read'))
   INSERT INTO role_permission_grants(role_id,permission_id) SELECT 1,id FROM permissions;`,
];
const fixtureTypes = `export const FOUNDATION_CAPABILITIES = [
  'notification:read',
  'notification:manage',
] as const satisfies readonly PermissionKey[];`;

test('capability literals come from quoted strings only, ignoring regex check constraints', () => {
  const extracted = extractCapabilityLiterals(fixtureMigrations[0]);
  assert.deepEqual([...extracted].sort(), ['customer:manage', 'customer:read']);
});

test('foundation capabilities are parsed from the as-const array block', () => {
  assert.deepEqual(extractFoundationCapabilities(fixtureTypes), [
    'notification:manage',
    'notification:read',
  ]);
});

test('the seed baseline is the union of foundation constants and migration literals', () => {
  const baseline = buildSeedBaseline({
    migrationTexts: fixtureMigrations,
    foundationCapabilities: extractFoundationCapabilities(fixtureTypes),
  });
  assert.deepEqual([...baseline].sort(), [
    'authorization:manage',
    'authorization:read',
    'customer:manage',
    'customer:read',
    'notification:manage',
    'notification:read',
  ]);
});

test('catalog rows outside the baseline are reported with grant references (fixture db)', () => {
  const baseline = new Set(['customer:read', 'customer:manage']);
  const report = auditPermissionRows(baseline, [
    { id: 'seed-1', capability: 'customer:read', created_by: null, grant_count: 3 },
    { id: 'extra-1', capability: 'tenant-custom:run', created_by: 'employee-1', grant_count: 2 },
    { id: 'extra-2', capability: 'tenant-custom:idle', created_by: 'employee-2', grant_count: 0 },
  ]);
  assert.equal(report.baselineSize, 2);
  assert.equal(report.catalogSize, 3);
  assert.equal(report.nonSeedCount, 2);
  assert.deepEqual(report.nonSeed, [
    { id: 'extra-1', capability: 'tenant-custom:run', createdBy: 'employee-1', grantCount: 2 },
    { id: 'extra-2', capability: 'tenant-custom:idle', createdBy: 'employee-2', grantCount: 0 },
  ]);
});
