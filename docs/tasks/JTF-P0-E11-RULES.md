# JTF-P0-E11 — Safe rules

The closed AST permits literals, safe named paths, boolean composition, comparisons, and membership. Validation rejects unknown fields/operators, prototype paths, non-finite values, depth/list excess, and malformed nodes. Evaluation uses explicit TypeScript dispatch only and defaults deny on missing input or interpreter error. Published versions are immutable; snapshots retain normalized input hash, exact version, bounded trace, decision, actor, time, and correlation. APIs require `rule:create|update|evaluate`.

`POST /rules/{id}/versions` creates later drafts. Evaluation serializes each idempotency key and checks the stored snapshot before interpreting input, so a retry returns the exact original decision, trace, hash, timestamp, and correlation without another audit event. Migration 0006 protects published versions from deletion as well as update, with real PostgreSQL coverage.
