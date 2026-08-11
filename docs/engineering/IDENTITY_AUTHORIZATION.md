# Identity and authorization operations

## Configuration

All variables in `.env.example` are required by the API. Production rejects placeholder/short session secrets and database URLs that explicitly disable TLS. Values are parsed once at startup and exposed as a frozen typed object. Generate a secret with `openssl rand -base64 48`; never commit `.env`.

## Database

Start PostgreSQL 17 with `docker compose --env-file .env -f infra/docker/compose.yaml up -d --wait postgres`. Export `DATABASE_URL` before `pnpm test`. Both integration suites fail immediately when it is absent; each creates and drops a unique schema, so there is no skip path. Run `pnpm db:status` and `pnpm db:migrate`. A destructive local reset is `docker compose --env-file .env -f infra/docker/compose.yaml down --volumes`, followed by startup and migration.

Migrations are append-only and owned by `packages/database/migrations`. Tests use disposable schemas. Migration 0004 reconciles historical duplicate unanchored DataScope grants by retaining the earliest `created_at`, then lowest `id`, before adding its partial unique index; the PostgreSQL suite covers both 0001–0003 upgrades and fresh installs. Failed migrations roll back; resolve the SQL and rerun rather than editing `schema_migrations`.

## Initial administrator

No default credential exists. Local/test provisioning creates the company, membership, employee, identity, a scrypt credential produced by `PasswordHasher`, administrative role/grants, and assignment in one explicit transaction. Production provisioning requires a separately approved operator workflow.

## API and authorization

JSON endpoints are under `/api/v1`: `POST /auth/login`, `POST /auth/logout`, `GET /auth/session`, `PUT /auth/credential`, and create/read/update/list operations at `/organizations` and `/employees`. Send `Authorization: Bearer <opaque-token>` and optionally `X-Correlation-ID`. Errors use `{ "error": { "code", "message", "correlationId", "details"? } }`.

RBAC is default deny. Field allowlists cover PATCH fields. Employee reads and updates apply DataScope in SQL; grants from multiple roles union their scopes and allowed fields, while any unrestricted-field grant remains unrestricted. Organization updates reject actor/company mismatches before starting a transaction, and their SQL remains tenant-qualified, so cross-tenant attempts mutate and audit nothing. PostgreSQL independently requires an employee's organization to belong to the employee company and validates parent ownership on both insert and update. Inactive identities, employees or memberships and expired/revoked sessions are rejected on every request.

PATCH requests require a positive integer `version`; invalid or missing versions return HTTP 400. Caller correlation IDs are accepted only when they are UUIDs, otherwise the API generates a UUID safe for the audit column. CI migrates and exercises a real disposable PostgreSQL service, including cross-company constraint failures.

Troubleshooting: confirm PostgreSQL health, compare `pnpm db:status`, verify all required environment variables, then use the error correlation ID to locate an audit event. Raw tokens and passwords must never be logged.

Production deployment, push/merge automation, sales features, manufacturing features, a full audit-trail product UI/API, and later P0 engines are out of scope.

## Authorization administration and audit guarantees

Authenticated administration is available at `/api/v1/roles`, `/api/v1/permissions`, `/api/v1/grants`, `/api/v1/assignments`, and `/api/v1/scope-grants`. `GET` requires `authorization:read`; `POST` and `DELETE` require `authorization:manage`. The default is deny. UUIDs, capability syntax, DataScopes, typed anchors, and request fields are validated before repository calls. Repository lookups qualify tenant-owned roles and employees, and PostgreSQL rejects foreign, inactive, deleted, wrongly typed, or incorrectly null scope anchors.

Authorization create, grant, revoke, assign, and unassign operations insert an audit event in the same transaction as the business mutation. Events contain actor, tenant organization, action, target, correlation ID, server timestamp, outcome, and safe metadata. Database triggers reject updates and deletes of audit events.

## Migration integrity recovery

Migration files are SHA-256 checksummed before execution. The filename and checksum are committed atomically. `db:status` reports `pending`, `applied`, and `drifted`; migration fails closed if an applied file is missing or differs from its stored checksum. Pre-checksum installations receive a one-time backfill only when current bytes match an immutable release-pinned digest; current contents are never their own trust source. Missing files, unknown applied names, incorrect stored digests, changed bytes, and unpinned NULL checksums fail closed. Never edit an accepted migration. Restore the exact released file from source control, verify status, and add a new append-only migration for corrections.
