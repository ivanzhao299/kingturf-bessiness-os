# JTF-P0-E12 — Notification Center

Notification creation carries the complete `notification:manage` AuthorizedQuery into the
PostgreSQL transaction. Every deduplicated recipient must be an active employee in the actor's
tenant and match either a granted role scope or a valid persisted typed anchor. A single foreign or
out-of-scope recipient rejects the entire operation before the notification, recipient, delivery,
outbox, or audit rows are written. API coverage verifies the restricted-scope 403 contract, and the
PostgreSQL suite covers SELF and explicit TEAM-anchor allow/deny cases.

Implemented tenant-scoped recipient inbox, unread/read state, preferences, idempotent internal creation, immutable delivery attempts, transactional audit, and domain-event linkage. IN_APP is local; external channels are modeled but unconfigured.

Preference writes use an explicit compare-and-swap contract: `expectedVersion: 0` creates a
previously absent channel preference, while updates must provide the current positive version.
Omitted and stale versions are rejected, so concurrent clients cannot silently overwrite one
another.

Each tenant/idempotency key is bound to the sorted unique recipient set and complete semantic payload (kind, title, message, and optional subject). A retry passes the same RBAC and DataScope authorization before comparison, returns the original row only for an exact match, and otherwise fails with `409 conflict` without creating event, recipient, delivery, or audit rows.
