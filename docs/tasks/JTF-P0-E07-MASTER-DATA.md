# JTF-P0-E07 — Versioned master data

Tenant-owned category and entry identities have stable uppercase codes, optimistic identity versions, immutable effective-dated versions, and logical deletion. APIs require `master-data:read|create|update|delete`; tenant identity always comes from the session. Category and entry writes use `TransactionalAuditWriter` in the business transaction. Migration 0005 supplies tenant-qualified foreign keys, uniqueness, range checks, effective-date indexes, and immutable-version triggers.

Acceptance evidence: domain effective-range/code validators, API allowlists, migration checks, and PostgreSQL repository scenarios cover history, stale versions, deletion, and tenant isolation.

Entry parity includes collection/item reads at a requested effective timestamp, PATCH as an immutable version append, and logical DELETE of the stable identity. `platform-postgres.integration.test.ts` proves retrieval, history, logical deletion, and same-transaction audit evidence.
