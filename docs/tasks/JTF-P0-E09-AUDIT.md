# JTF-P0-E09 — Transactional audit

`TransactionalAuditWriter` accepts an existing SQL client, so audit failure rolls back business state. Metadata is explicit-allowlist only, limited to 8 KiB, five levels, and 50 list items; secret/token/credential fields and arbitrary bodies are rejected. `GET /api/v1/audit-events[/:id]` requires `audit:read`, derives the tenant from the authenticated session, and filters actor, action, target, correlation, and time with bounded cursor pagination. Database update/delete triggers preserve immutability.

Queries also apply the permission grant's DataScope to event actors. SELF, anchored TEAM/DEPARTMENT/REGION, COMPANY, and GROUP remain inside the mandatory tenant predicate; missing or invalid typed anchors fail closed.
