/* eslint-disable @typescript-eslint/no-misused-promises, @typescript-eslint/no-unsafe-argument */
import { createServer } from 'node:http';
import { parseEnvironment } from '@kingturf/config';
import { Database, migrate } from '@kingturf/database';
import { buildApp } from './app.ts';
import {
  PostgresAuthorizationRepository,
  PostgresEmployeeRepository,
  PostgresOrganizationRepository,
  PostgresSecurityStore,
} from './repositories.ts';
import { AuthenticationService, PasswordHasher } from './security.ts';
import {
  PostgresAuditRepository,
  PostgresMasterDataRepository,
  PostgresNumberRepository,
  PostgresRuleRepository,
  PostgresWorkflowRepository,
} from './platform-repositories.ts';
import {
  EmployeeObjectInstanceResolver,
  LocalAttachmentStorage,
  PostgresAttachmentRepository,
  PostgresBusinessObjectRepository,
  PostgresEventRepository,
  PostgresNotificationRepository,
  PostgresRegistryObjectAccessAuthorizer,
} from './foundation-repositories.ts';
import { StructuredTelemetry } from './runtime-telemetry.ts';
import { PostgresCrmRepository } from './crm-repositories.ts';
import { PostgresCommercialRepository } from './commercial-repositories.ts';
import { PostgresQuoteToCashRepository } from './qtc-repositories.ts';
import { PostgresCommissionRepository } from './commission-repositories.ts';
import { PostgresOrder360Repository } from './order-360-repositories.ts';
import { PostgresRiskRepository } from './risk-repositories.ts';
import { PostgresDashboardRepository } from './dashboard-repositories.ts';
import { PostgresManufacturingRepository } from './manufacturing-repositories.ts';
import { PostgresProcurementRepository } from './procurement-repositories.ts';
import { PostgresMrpRepository } from './mrp-repositories.ts';

const config = parseEnvironment(process.env);
const database = new Database(config.databaseUrl);
await migrate(database);
const securityStore = new PostgresSecurityStore(database);
const auth = new AuthenticationService(
  securityStore,
  new PasswordHasher(config.password),
  config.session,
  securityStore,
);
const employees = new PostgresEmployeeRepository(database);
const objectAccess = new PostgresRegistryObjectAccessAuthorizer(
  database,
  new Map([['employee', new EmployeeObjectInstanceResolver(employees)]]),
);
const app = buildApp({
  auth,
  organizations: new PostgresOrganizationRepository(database),
  employees,
  authorization: new PostgresAuthorizationRepository(database),
  audit: new PostgresAuditRepository(database),
  masterData: new PostgresMasterDataRepository(database),
  numbers: new PostgresNumberRepository(database),
  rules: new PostgresRuleRepository(database),
  workflows: new PostgresWorkflowRepository(database),
  notifications: new PostgresNotificationRepository(database),
  attachments: new PostgresAttachmentRepository(
    database,
    new LocalAttachmentStorage(config.attachmentStorage.directory),
    objectAccess,
  ),
  events: new PostgresEventRepository(database),
  businessObjects: new PostgresBusinessObjectRepository(database),
  crm: new PostgresCrmRepository(database),
  commercial: new PostgresCommercialRepository(database),
  quoteToCash: new PostgresQuoteToCashRepository(database),
  commissions: new PostgresCommissionRepository(database),
  order360: new PostgresOrder360Repository(database),
  risks: new PostgresRiskRepository(database),
  dashboard: new PostgresDashboardRepository(database),
  manufacturing: new PostgresManufacturingRepository(database),
  procurement: new PostgresProcurementRepository(database),
  mrp: new PostgresMrpRepository(database),
  readiness: async () => {
    try {
      await database.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  },
  logger: {
    write(entry) {
      process.stdout.write(`${JSON.stringify(entry)}\n`);
    },
  },
  telemetry: new StructuredTelemetry((entry) => {
    process.stdout.write(`${JSON.stringify(entry)}\n`);
  }),
});
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const chunks: Buffer[] = [];
  let received = 0;
  const maximumBodyBytes = 35_000_000;
  const declared = Number(request.headers['content-length'] ?? 0);
  const rejectOversized = (): void => {
    const result = app.rejectOversized(request.headers['x-correlation-id'] as string | undefined);
    response.writeHead(result.statusCode, {
      'content-type': 'application/json; charset=utf-8',
      ...result.headers,
    });
    response.end(JSON.stringify(result.body));
  };
  if (Number.isFinite(declared) && declared > maximumBodyBytes) {
    rejectOversized();
    return;
  }
  for await (const chunk of request) {
    received += Buffer.byteLength(chunk);
    if (received > maximumBodyBytes) {
      rejectOversized();
      return;
    }
    chunks.push(Buffer.from(chunk));
  }
  let body: unknown;
  try {
    body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
  } catch {
    body = undefined;
  }
  const result = await app.dispatch({
    method: request.method ?? 'GET',
    pathname: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: {
      authorization: request.headers.authorization,
      'x-correlation-id': request.headers['x-correlation-id'] as string | undefined,
      'idempotency-key': request.headers['idempotency-key'] as string | undefined,
    },
    body,
  });
  response.writeHead(result.statusCode, {
    'content-type': 'application/json; charset=utf-8',
    ...result.headers,
  });
  response.end(JSON.stringify(result.body));
});
server.on('error', (failure) => {
  console.error(failure);
  process.exit(1);
});
const shutdown = (): void => {
  server.close(async (failure) => {
    await database.close();
    process.exit(failure ? 1 : 0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
server.listen(config.api.port, config.api.host);
