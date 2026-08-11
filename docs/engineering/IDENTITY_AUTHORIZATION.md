# Identity and authorization operations

## Configuration

All variables in `.env.example` are required by the API. Production rejects placeholder/short session secrets and database URLs that explicitly disable TLS. Values are parsed once at startup and exposed as a frozen typed object. Generate a secret with `openssl rand -base64 48`; never commit `.env`.

## Database

Start PostgreSQL with `docker compose --env-file .env -f infra/docker/compose.yaml up -d --wait postgres`. Run `pnpm db:status` and `pnpm db:migrate`. A destructive local reset is `docker compose --env-file .env -f infra/docker/compose.yaml down --volumes`, followed by startup and migration.

Migrations are append-only and owned by `packages/database/migrations`. Tests use a disposable database. Failed migrations roll back; resolve the SQL and rerun rather than editing `schema_migrations`.

## Initial administrator

No default credential exists. Local/test provisioning creates the company, membership, employee, identity, a scrypt credential produced by `PasswordHasher`, administrative role/grants, and assignment in one explicit transaction. Production provisioning requires a separately approved operator workflow.

## API and authorization

JSON endpoints are under `/api/v1`: `POST /auth/login`, `POST /auth/logout`, `GET /auth/session`, `PUT /auth/credential`, and create/read/update/list operations at `/organizations` and `/employees`. Send `Authorization: Bearer <opaque-token>` and optionally `X-Correlation-ID`. Errors use `{ "error": { "code", "message", "correlationId", "details"? } }`.

RBAC is default deny. Field allowlists cover PATCH fields. Employee reads and updates apply DataScope in SQL; grants from multiple roles union their scopes and allowed fields, while any unrestricted-field grant remains unrestricted. PostgreSQL independently requires an employee's organization to belong to the employee company and validates parent ownership on both insert and update. Inactive identities, employees or memberships and expired/revoked sessions are rejected on every request.

PATCH requests require a positive integer `version`; invalid or missing versions return HTTP 400. Caller correlation IDs are accepted only when they are UUIDs, otherwise the API generates a UUID safe for the audit column. CI migrates and exercises a real disposable PostgreSQL service, including cross-company constraint failures.

Troubleshooting: confirm PostgreSQL health, compare `pnpm db:status`, verify all required environment variables, then use the error correlation ID to locate an audit event. Raw tokens and passwords must never be logged.

Production deployment, push/merge automation, sales features, manufacturing features, a full audit-trail product UI/API, and later P0 engines are out of scope.
