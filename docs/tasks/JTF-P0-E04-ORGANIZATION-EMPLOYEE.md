# JTF-P0-E04: Organization and employee foundation

Status: Implemented

Contract: `/api/v1/organizations` and `/api/v1/employees` provide authenticated create, get, patch, and list JSON operations with stable error envelopes. Repositories are injected and transaction-capable; handlers contain no SQL.

Security invariants: immutable company ownership, active organization membership, normalized unique employee email, hierarchy integrity, optimistic versioning, field authorization, and tenant-qualified lookups. Acceptance evidence: repository constraints, policy tests, API health test, strict typecheck.
