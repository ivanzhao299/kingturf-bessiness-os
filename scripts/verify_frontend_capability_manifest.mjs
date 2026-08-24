import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const api = await readFile(new URL('../apps/api/src/app.ts', import.meta.url), 'utf8');
const web = await readFile(new URL('../apps/web/src/bootstrap.ts', import.meta.url), 'utf8');

const directPermissions = [
  ...new Set([...api.matchAll(/authorizeQuery\(context,\s*'([^']+)'/gu)].map((match) => match[1])),
].sort();
const missingPermissions = directPermissions.filter(
  (permission) => !web.includes(`'${permission}'`),
);
assert.deepEqual(
  missingPermissions,
  [],
  `Backend capabilities without an explicit frontend disposition: ${missingPermissions.join(', ')}`,
);

const governedPlatformPaths = [
  '/api/v1/organizations',
  '/api/v1/employees',
  '/api/v1/roles',
  '/api/v1/permissions',
  '/api/v1/grants',
  '/api/v1/assignments',
  '/api/v1/scope-grants',
  '/api/v1/audit-events',
  '/api/v1/master-data/categories',
  '/api/v1/master-data/entries',
  '/api/v1/number-definitions',
  '/api/v1/rules',
  '/api/v1/workflows',
  '/api/v1/workflow-tasks',
  '/api/v1/notifications',
  '/api/v1/notifications/unread-count',
  '/api/v1/notification-preferences',
  '/api/v1/business-objects',
  '/api/v1/operations/events',
];
const missingPaths = governedPlatformPaths.filter((path) => !web.includes(`'${path}'`));
assert.deepEqual(
  missingPaths,
  [],
  `Governed platform endpoints without a frontend surface: ${missingPaths.join(', ')}`,
);

process.stdout.write(
  `Verified ${String(directPermissions.length)} direct capabilities and ${String(governedPlatformPaths.length)} governed platform endpoint families.\n`,
);
