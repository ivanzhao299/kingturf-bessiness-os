# JTF-P0-E06: RBAC and DataScope

Status: Implemented and hardened

Contract: capabilities use `resource:action`; grants combine field allowlists and SELF, TEAM, DEPARTMENT, REGION, COMPANY, or GROUP. Authorization administration requires `authorization:read`/`authorization:manage`.

Security invariants: every protected route defaults to deny when any context is absent. Employee repository queries combine tenant and DataScope predicates; identifiers cannot bypass them. Acceptance evidence: all-scope predicate tests, centralized policy, schema grants, and dedicated protected namespace.

## Hardening implementation

- Added append-only migration `0003_identity_authorization_hardening.sql` for transactional closure maintenance, tenant grant constraints, audit immutability, and migration checksums.
- Implemented typed ancestor resolution with absent-ancestor denial and mandatory tenant qualification.
- Added secured role, permission, grant, and assignment repositories and HTTP routes.
- Loaded explicit persisted data-scope grants and deterministically composed them with role grants.
- CI requires PostgreSQL 17 and fails if its database integration suite lacks `DATABASE_URL`.
- Added append-only `0004_authorization_integrity_completion.sql` for exact closure rebuilding, stale-path removal, serialized cycle prevention, and active typed direct-grant constraints.
- Made 0004 upgrade-safe by deterministically reconciling historical unanchored grant duplicates before uniqueness enforcement, with real PostgreSQL upgrade and fresh-install coverage.
- Hardened organization updates to reject actor/company mismatches before transactions and proved cross-tenant attempts produce neither mutation nor audit.
- Completed direct scope-grant administration and atomic audit rollback evidence.
- Pinned all pre-checksum migration digests; missing, unknown, altered, incorrectly checksummed, or untrusted NULL history fails closed.
- Local acceptance requires the PostgreSQL 17 fixture and exported `DATABASE_URL`; integration tests use isolated disposable schemas and never skip.
