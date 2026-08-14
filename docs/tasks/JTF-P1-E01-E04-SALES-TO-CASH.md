# JTF-P1-E01 through E04: CRM sales-to-cash entry slice

Status: Implemented; host PostgreSQL validation required (2026-08-13)

## Delivered boundary

- E01 Customer Master: tenant-keyed identity and contact deduplication, lifecycle transitions, ownership history, scoped reads, field-filtered contact details, audit, and transactional outbox events.
- E02 Lead Pool: explicit `NEW`, `POOL`, `CLAIMED`, `QUALIFIED`, `DISQUALIFIED`, and `CONVERTED` transitions; row-locked optimistic claims; tenant-keyed idempotency results.
- E03 Customer Assignment: tenant-qualified assignees, conflict-safe active assignment replacement, distinct assign/reassign capabilities, separation of reassignment actor and assignee, append-only assignment/ownership history, audit, and events.
- E04 Customer 360: identity, contacts, ownership, related leads, and activity timeline. `orders` and `finance` are explicitly unavailable until later bounded contexts exist.

All persistence paths retain the P0 tenant composite keys, parameterized SQL, RBAC/DataScope authorization, opaque session boundary, immutable audit records, and transactionally coupled domain outbox. Every known-ID mutation applies the authorized scope and organization anchors inside its transaction before locking or changing the aggregate. The responsive API-backed CRM client exposes only navigation, data fetches, and actions granted by the caller's capability set; customer and Customer 360 rendering additionally default-deny without `customer:read`.

The rendered Customer 360 detail displays the available customer name, number, status, and owner plus permission-filtered contact cards, ownership history, related leads, and a newest-first activity timeline. Restricted identity properties render neutral placeholders. Missing email/phone properties in a restricted DTO render a neutral restricted/unavailable message and are never interpolated. Orders and finance remain explicitly unavailable in the API DTO and are not rendered as invented business data. Ownership, lead, and activity collections are independently capability- and DataScope-filtered by the API. The stylesheet defines desktop, tablet, and mobile layouts; rendered-shell tests exercise the corresponding 1280 px, 800 px, and 390 px class/structure/content variants. They do not claim browser computed-style or visual-regression coverage.

## Executable evidence

- `apps/web/src/bootstrap.test.ts` creates the rendered shell at all three breakpoints, asserts the four Customer 360 sections and chronological activity ordering, and proves that an omitted sensitive contact field is not leaked.
- `apps/api/test/crm-postgres.integration.test.ts` uses a migrated disposable schema on `DATABASE_URL` and fails closed when that variable is absent. It covers tenant isolation, DataScope, contact filtering, concurrent/idempotent claims, assignment separation of duties, lifecycle/contact/activity/claim/release/assign/reassign audit-outbox pairs, rollback/replay non-emission, and immutable history.
- `packages/database/test/migrations.test.ts` verifies the append-only migration chain and the CRM migration constraints/triggers.

No passing host-PostgreSQL claim is recorded here until the complete command sequence below runs with zero skipped tests in an environment permitted to connect to the existing fixture.

## Validation contract

Use the existing loopback PostgreSQL test target and installed Node/pnpm line:

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm ci:database:guard
pnpm db:migrate
pnpm db:status
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm security:check
```

No container is required or started. PostgreSQL integration tests fail closed when `DATABASE_URL` is absent and create disposable per-suite schemas on the existing test database.
