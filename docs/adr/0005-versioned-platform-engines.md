# ADR 0005: Versioned platform engines and immutable decisions

Status: Accepted

Master data and every configurable engine use a stable tenant-owned identity plus append-only versions. Workflow instances, number issues, and rule evaluations reference an exact version. Published/version history rows are database-protected from mutation. This prevents later configuration edits from reinterpreting historical decisions.

Audit writes share the business transaction and accept bounded allowlisted metadata only. Number counters are atomic and ledgers idempotent. Workflows use generic state-machine specifications with server-side eligibility and separation constraints. Rules use a closed interpreted AST, never dynamic code, and default deny on every evaluation failure.

Published rows are protected from both UPDATE and DELETE. Retry keys are serialized inside the transaction where a check-then-insert ledger is required, and retries return stored immutable snapshots rather than recomputing. Audit reads combine tenant qualification, RBAC, and the granted DataScope. Migration `0006_platform_engine_integrity.sql` is append-only because released migration bytes are never rewritten.
