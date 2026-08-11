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
const app = buildApp({
  auth,
  organizations: new PostgresOrganizationRepository(database),
  employees: new PostgresEmployeeRepository(database),
  authorization: new PostgresAuthorizationRepository(database),
  audit: new PostgresAuditRepository(database),
  masterData: new PostgresMasterDataRepository(database),
  numbers: new PostgresNumberRepository(database),
  rules: new PostgresRuleRepository(database),
  workflows: new PostgresWorkflowRepository(database),
});
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
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
