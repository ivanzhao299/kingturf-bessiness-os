import { randomBytes, randomUUID } from 'node:crypto';
import { Database } from '@kingturf/database';
import { buildApp } from '../../src/app.js';
import { PostgresCollectionRepository } from '../../src/collection-repositories.js';
import { PostgresCommercialRepository } from '../../src/commercial-repositories.js';
import { PostgresCommissionRepository } from '../../src/commission-repositories.js';
import { PostgresContractDocumentRepository } from '../../src/contract-document-repositories.js';
import { PostgresCrmRepository } from '../../src/crm-repositories.js';
import { PostgresQuoteToCashRepository } from '../../src/qtc-repositories.js';
import {
  PostgresAuthorizationRepository,
  PostgresEmployeeRepository,
  PostgresOrganizationRepository,
  PostgresSecurityStore,
} from '../../src/repositories.js';
import { PostgresRiskRepository } from '../../src/risk-repositories.js';
import { AuthenticationService, hashSessionToken, PasswordHasher } from '../../src/security.js';
import { ownedPostgres } from './owned-postgres.js';
import { releasedOrderFixture } from './released-order-http.js';

/** Real application dispatch + real PG; no HTTP server/browser or exported authentication material. */
export async function ownedCommercialGraph() {
  const owned = await ownedPostgres('commercial_graph_pg');
  let db: Database | undefined;
  const close = async () => {
    const failures: unknown[] = [];
    try {
      await db?.close();
    } catch (error) {
      failures.push(error);
    }
    try {
      await owned.close();
    } catch (error) {
      failures.push(error);
    }
    if (failures.length) throw new AggregateError(failures, 'Commercial graph cleanup failed');
  };
  try {
    const connection = process.env.DATABASE_URL;
    if (!connection) throw new Error('DATABASE_URL required');
    const target = new URL(connection);
    // Match the existing real HTTP fixture: migrate in owned schema first;
    // only afterwards expose public extension functions to application queries.
    target.searchParams.set('options', `-csearch_path=${owned.schema},public`);
    db = new Database(target.href);
    const database = db;
    const active = await database.query<{ schema: string }>('SELECT current_schema() schema');
    if (active.rows[0]?.schema !== owned.schema) throw new Error('Commercial schema mismatch');
    const sessionSecret = randomBytes(32).toString('hex');
    const reviewer = randomUUID();
    await database.query(
      "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'REVIEWER','Synthetic reviewer','reviewer@owned.test')",
      [reviewer, owned.company, owned.team],
    );
    const session = async (employee: string) => {
      const identity = randomUUID(),
        role = randomUUID();
      const token = randomBytes(32).toString('base64url');
      try {
        await database.query(
          'INSERT INTO identities(id,employee_id,login_name) VALUES($1,$2,$2::uuid::text)',
          [identity, employee],
        );
        await database.query(
          'INSERT INTO organization_memberships(employee_id,organization_id) VALUES($1,$2)',
          [employee, owned.company],
        );
        await database.query(
          "INSERT INTO roles(id,organization_id,code,name) VALUES($1,$2,$1::uuid::text,'Synthetic commercial fixture role')",
          [role, owned.company],
        );
        await database.query(
          'INSERT INTO employee_role_assignments(employee_id,role_id) VALUES($1,$2)',
          [employee, role],
        );
        await database.query(
          "INSERT INTO role_permission_grants(role_id,permission_id,data_scopes) SELECT $1,id,ARRAY['COMPANY']::data_scope[] FROM permissions",
          [role],
        );
        await database.query(
          "INSERT INTO sessions(identity_id,organization_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
          [identity, owned.company, hashSessionToken(token, sessionSecret)],
        );
      } catch {
        // Do not attach PG auth row details or generated values to test diagnostics.
        throw new Error('Synthetic commercial identity initialization failed');
      }
      return token;
    };
    const builder = await session(owned.employee),
      approver = await session(reviewer);
    const store = new PostgresSecurityStore(database);
    const auth = new AuthenticationService(
      store,
      new PasswordHasher({
        saltBytes: 16,
        keyLength: 32,
        cost: 16384,
        blockSize: 8,
        parallelization: 1,
      }),
      { secret: sessionSecret, ttlSeconds: 3600 },
      store,
    );
    const app = buildApp({
      auth,
      organizations: new PostgresOrganizationRepository(database),
      employees: new PostgresEmployeeRepository(database),
      authorization: new PostgresAuthorizationRepository(database),
      crm: new PostgresCrmRepository(database),
      commercial: new PostgresCommercialRepository(database),
      quoteToCash: new PostgresQuoteToCashRepository(database),
      commissions: new PostgresCommissionRepository(database),
      risks: new PostgresRiskRepository(database),
      collections: new PostgresCollectionRepository(database),
      contractDocuments: new PostgresContractDocumentRepository(database),
    });
    const request = async (
      path: string,
      token: string,
      body?: Record<string, unknown>,
    ): Promise<Record<string, unknown>> => {
      const result = await app.dispatch({
        method: body ? 'POST' : 'GET',
        pathname: `/api/v1${path}`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'x-correlation-id': randomUUID(),
          ...(body ? { 'idempotency-key': randomUUID() } : {}),
        },
        ...(body ? { body } : {}),
      });
      if (result.statusCode < 200 || result.statusCode >= 300)
        throw new Error(
          `Commercial fixture application request failed: ${String(result.statusCode)} ${path}`,
        );
      if (typeof result.body !== 'object' || result.body === null || Array.isArray(result.body))
        throw new Error('Commercial fixture application response must be an object');
      return result.body as Record<string, unknown>;
    };
    const graph = await releasedOrderFixture(request, builder, approver);
    const customer = (
      await database.query<{ version: number }>(
        'SELECT version FROM customers WHERE id=$1 AND tenant_id=$2',
        [graph.customerId, owned.company],
      )
    ).rows[0];
    if (!customer) throw new Error('Commercial graph customer missing');
    await request(`/customers/${graph.customerId}/ownership`, builder, {
      assigneeId: owned.employee,
      expectedVersion: customer.version,
      reason: 'Assign synthetic graph owner for record-scope tests',
      reassignment: false,
    });
    return {
      db: database,
      schema: owned.schema,
      context: owned.context,
      otherContext: owned.otherContext,
      reviewerEmployee: reviewer,
      teamId: owned.team,
      graph,
      close,
    };
  } catch (error) {
    try {
      await close();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Commercial graph setup and cleanup failed');
    }
    throw error;
  }
}
