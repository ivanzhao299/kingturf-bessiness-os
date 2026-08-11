# KingTurf Business OS

金特夫（山东）人造草坪有限公司智能经营、生产与风险控制平台。

This repository provides the organization, employee, identity, opaque-session, RBAC, and DataScope foundation. It intentionally contains no CRM/sales or MES/manufacturing implementation.

## Prerequisites

- Node.js 24.x (CI uses `24.13.0`)
- Corepack and pnpm `10.33.4`
- Docker Engine with Docker Compose v2 (for local PostgreSQL)

## Fresh-checkout setup

```bash
corepack enable
corepack prepare pnpm@10.33.4 --activate
pnpm install --frozen-lockfile
cp .env.example .env
```

The committed `.env.example` contains local-only placeholders. Keep real credentials in the ignored `.env` file and never commit them.
Generate a non-placeholder session secret before starting the API: `openssl rand -base64 48`.

## Local PostgreSQL

Start the database and wait for its health check:

```bash
docker compose --env-file .env -f infra/docker/compose.yaml up -d --wait postgres
docker compose --env-file .env -f infra/docker/compose.yaml ps
docker compose --env-file .env -f infra/docker/compose.yaml exec postgres pg_isready -U kingturf -d kingturf_dev
pnpm db:status
pnpm db:migrate
```

Stop it while preserving data:

```bash
docker compose --env-file .env -f infra/docker/compose.yaml down
```

Reset the local database volume (destructive to local database data):

```bash
docker compose --env-file .env -f infra/docker/compose.yaml down --volumes
```

## Run the applications

Run both development processes from one terminal:

```bash
pnpm dev
```

Or run them separately:

```bash
pnpm --filter @kingturf/web dev
pnpm --filter @kingturf/api dev
```

The web app is at <http://localhost:5173>. Verify the database-independent API health endpoint:

```bash
curl --fail --silent http://localhost:3000/health
# {"status":"ok"}
```

After `pnpm build`, production artifacts can be exercised with:

```bash
pnpm --filter @kingturf/api start
pnpm --filter @kingturf/web preview
```

Stop foreground application processes with `Ctrl-C`. Shut down PostgreSQL with the non-destructive `docker compose ... down` command above.

## Quality gates

These are the exact commands run by CI:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Formatting is available through `pnpm format`; check it without changing files using `pnpm format:check`.

## Workspace structure

```text
apps/api             versioned organization, employee, authentication and authorization API
apps/web             Vite web application and bootstrap test
packages/config      shared TypeScript configuration and neutral defaults
packages/database    PostgreSQL driver, transactions, migration CLI and ordered SQL
packages/domain      framework-independent domain boundary
packages/testing     shared test helpers
packages/types       framework-independent shared types
packages/ui          reusable browser UI primitives
infra/docker         local PostgreSQL Compose configuration
```

## Project documents

- [Product blueprint](docs/engineering/PRODUCT_BLUEPRINT.md)
- [Engineering roadmap](docs/tasks/ROADMAP.md)
- [Repository bootstrap task](docs/tasks/JTF-P0-E01-REPOSITORY-BOOTSTRAP.md)
- [Stack ADR](docs/adr/0001-typescript-monorepo-stack.md)
- [Database ADR](docs/adr/0002-postgresql-access-and-migrations.md)
- [Session ADR](docs/adr/0003-opaque-session-authentication.md)
- [Authorization ADR](docs/adr/0004-rbac-and-data-scope.md)
- [Identity and authorization runbook](docs/engineering/IDENTITY_AUTHORIZATION.md)

The API requires all environment variables shown in `.env.example`. Protected requests use `Authorization: Bearer <token>`; login is `POST /api/v1/auth/login`. No administrator or password is embedded. See the runbook for explicit provisioning and authorization semantics.

Production deployment, automated push/merge, sales, manufacturing, full audit-trail product functionality, and later P0 engines remain out of scope.
