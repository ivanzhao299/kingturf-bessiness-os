# KingTurf Business OS

The P1 commercial boundary covers Opportunity through immutable Quote-to-Cash (E05–E17), with exact quote, credit-decision, contract, signature, order, AR, payment, and allocation evidence. See [ADR 0010](docs/adr/0010-immutable-quote-to-cash-ledger.md) and the [E11–E17 delivery map](docs/tasks/JTF-P1-E11-E17-QUOTE-TO-CASH.md).

金特夫（山东）人造草坪有限公司智能经营、生产与风险控制平台。

This repository provides identity/RBAC/DataScope, CRM, technical specifications, cost-to-quote and quote-to-cash, procurement/MRP, production, quality, shipment and governed document workflows. These are implemented business capabilities, not a claim of complete statutory accounting, customs, tax or manufacturing certification.

Production is served only at https://erp.kingturf.cn, on the Singapore host with project-isolated resources. See the [production runbook](docs/deployment/PRODUCTION_PARK_HOST.md) and [2026-09-05 product audit](docs/engineering/KT-UI-PROD-08_PRODUCT_AUDIT.md).

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
Replace `SESSION_SECRET=change-me` with a generated local secret before starting the API: `openssl rand -base64 48`. API dev/start commands read the repository-root `.env` using Node 24; explicitly injected process variables take precedence. The CI database gate still requires an explicitly injected test database; it does not invoke the API dev/start environment loader. Do not use production credentials or a production database for local initialization.

## Local PostgreSQL

Start the database and wait for its health check:

```bash
docker compose --env-file .env -f infra/docker/compose.yaml up -d --wait postgres
docker compose --env-file .env -f infra/docker/compose.yaml ps
docker compose --env-file .env -f infra/docker/compose.yaml exec postgres pg_isready -U kingturf -d kingturf_dev
node --env-file=.env --run db:status
node --env-file=.env --run db:migrate
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

The web app is at <http://localhost:5173> (or `WEB_PORT`). Vite development and preview bind to loopback by default and proxy `/api`, `/health`, `/ready` and `/version` to the loopback `KINGTURF_API_PROXY_TARGET` (default `http://127.0.0.1:3000`). Set its port to match `API_PORT`. Proxy targets with a remote host, credentials or URL path are rejected. The browser uses the normal bearer authentication flow; no CORS bypass or production endpoint is involved.

Verify the database-independent API health endpoint:

```bash
curl --fail --silent http://localhost:3000/health
# {"status":"ok"}
curl --fail --silent http://localhost:3000/ready
```

After `pnpm build`, compiled API artifacts can be exercised with:

```bash
pnpm --filter @kingturf/api start
pnpm --filter @kingturf/web preview
```

The API `dev` command watches TypeScript and uses Node 24 transform-types because the current code has constructor parameter properties. `start` runs `dist/server.js` with the same transformation support for existing workspace exports that still point to TypeScript. This matches the current API container runtime; it is not a pure JavaScript standalone distribution and does not change the production image. Both commands perform the existing startup migration check, so use only the isolated local database here.

There is no default administrator. Provision synthetic local identities only in an explicitly isolated database using the identity runbook; production provisioning requires its own approval.

Stop foreground application processes with `Ctrl-C`. Shut down PostgreSQL with the non-destructive `docker compose ... down` command above.

## Real local runtime acceptance

After `pnpm build`, provision an ephemeral loopback test database with an owned `runtime_web_...` schema and a synthetic CRM identity (`customer:read` and `customer:create` COMPANY scope). Use the normal scrypt credential and login endpoint; no default password or bearer bypass is provided. Set `KINGTURF_RUNTIME_DATABASE_URL`, `KINGTURF_TEST_LOGIN`, `KINGTURF_TEST_PASSWORD` and `KINGTURF_TEST_COMPANY` only in the acceptance process environment. The API must point to that same owned schema. Set `KINGTURF_RUNTIME_WEB_ORIGIN` to the local Vite dev/preview origin if it differs from `http://127.0.0.1:5173`.

```bash
NODE_ENV=test KINGTURF_RUNTIME_ACCEPTANCE=1 pnpm exec playwright test --config playwright.runtime.config.ts
```

This explicit test uses actual browser → Vite proxy → API → PostgreSQL authentication, creates a synthetic customer, verifies its PROSPECT lifecycle and success audit, and checks 401/403 rejection. It refuses a remote Web origin, non-test database or missing opt-in; it never runs automatically against production. Authentication traces/screenshots are disabled. Use Chromium and its platform dependencies. Stop the local processes and remove only the owned test resources/private environment files after acceptance. This test is automated synthetic acceptance, not human business UAT.

## Quality gates

Run the exact ordered CI gate. In Studio it uses the existing injected loopback PostgreSQL test
fixture; from another local shell, provide an equivalent ephemeral loopback test database through
the process environment:

```bash
pnpm ci:local
```

`ci:local` sets `NODE_ENV=test` only for its child process. Database commands use the ambient
`DATABASE_URL`, do not load `.env` automatically, and refuse migration unless the host is loopback
and the database name contains a distinct `test` segment. The gate does not print connection
strings or persist credentials. Vite may read repository-root local proxy/port settings during
Web testing/build; those non-`VITE_` settings are server-side and are not exposed to the browser.
Hosted CI uses its explicit workflow environment and a checkout without a local `.env`.

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
- [Long-term development plan and countdown](docs/engineering/MASTER_DEVELOPMENT_PLAN.md)
- [P1 E18-E21 closure task](docs/tasks/JTF-P1-E18-E21-CLOSURE.md)
- [Repository bootstrap task](docs/tasks/JTF-P0-E01-REPOSITORY-BOOTSTRAP.md)
- [Stack ADR](docs/adr/0001-typescript-monorepo-stack.md)
- [Database ADR](docs/adr/0002-postgresql-access-and-migrations.md)
- [Session ADR](docs/adr/0003-opaque-session-authentication.md)
- [Authorization ADR](docs/adr/0004-rbac-and-data-scope.md)
- [Identity and authorization runbook](docs/engineering/IDENTITY_AUTHORIZATION.md)

The API requires all environment variables shown in `.env.example`. Protected requests use `Authorization: Bearer <token>`; login is `POST /api/v1/auth/login`. No administrator or password is embedded. See the runbook for explicit provisioning and authorization semantics.

Production is served only at `https://erp.kingturf.cn` through the repository's production deployment workflow. Product acceptance is tracked in the [product audit](docs/engineering/KT-UI-PROD-08_PRODUCT_AUDIT.md) and [startup delivery plan](docs/engineering/KT-UI-PROD-09_STARTUP_DELIVERY.md); implemented business surfaces are not a substitute for role-specific end-to-end acceptance.
