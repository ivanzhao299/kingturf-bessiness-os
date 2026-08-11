# JTF-P0-E03: PostgreSQL foundation

Status: Implemented

Contract: `@kingturf/database` exposes parameterized queries, explicit transactions, ordered migrations, status, and test commands. It alone owns `packages/database/migrations`; applied files are immutable.

Security invariants: UUID/FK/unique/check constraints, tenant ownership, logical deletion, UTC timestamps, version/actor metadata, token hashes, and no sales/manufacturing tables. Acceptance evidence: migration SQL, transactional migrator, PostgreSQL CI service, and `pnpm db:migrate`.
