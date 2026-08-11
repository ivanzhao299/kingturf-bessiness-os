# JTF-P0-E06: RBAC and DataScope

Status: Implemented foundation

Contract: capabilities use `resource:action`; grants combine field allowlists and SELF, TEAM, DEPARTMENT, REGION, COMPANY, or GROUP. Authorization administration requires `authorization:read`/`authorization:manage`.

Security invariants: every protected route defaults to deny when any context is absent. Employee repository queries combine tenant and DataScope predicates; identifiers cannot bypass them. Acceptance evidence: all-scope predicate tests, centralized policy, schema grants, and dedicated protected namespace.
