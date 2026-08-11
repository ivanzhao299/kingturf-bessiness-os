# JTF-P0-E08 — Atomic numbering

Definitions use immutable versions and declarative prefix/suffix, padding, start, increment, and UTC reset periods. Allocation locks the selected published version, atomically advances a period counter with `INSERT … ON CONFLICT … UPDATE … RETURNING`, records the exact version/sequence/value/requester/correlation, and returns the original ledger row for an idempotency retry. Tenant-qualified uniqueness protects sequences, rendered values, and keys. Permissions are `number:create|update|allocate`.

`POST /number-definitions/{id}/versions` creates later drafts. PostgreSQL scenarios allocate concurrently, verify uniqueness and retry identity, create a later version, and prove published versions cannot be updated or deleted.
