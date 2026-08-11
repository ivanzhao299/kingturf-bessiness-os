# JTF-P0-E06: RBAC and DataScope

Status: Implemented foundation

Contract: capabilities use `resource:action`; grants combine field allowlists and SELF, TEAM, DEPARTMENT, REGION, COMPANY, or GROUP. Authorization administration requires `authorization:read`/`authorization:manage`.

Security invariants: every protected route defaults to deny when any context is absent. Employee repository queries combine tenant and DataScope predicates; identifiers cannot bypass them. Acceptance evidence: all-scope predicate tests, centralized policy, schema grants, and dedicated protected namespace.
## Hardening implementation

- Added append-only migration `0003_identity_authorization_hardening.sql` for transactional closure maintenance, tenant grant constraints, audit immutability, and migration checksums.
- Implemented typed ancestor resolution with absent-ancestor denial and mandatory tenant qualification.
- Added secured role, permission, grant, and assignment repositories and HTTP routes.
- Loaded explicit persisted data-scope grants and deterministically composed them with role grants.
- CI requires PostgreSQL 17 and fails if its database integration suite lacks `DATABASE_URL`.
