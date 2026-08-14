# ADR 0009: Commercial revision graph and exact decisions

## Status

Accepted.

## Decision

Opportunities are optimistic-lock aggregates. CTR versions, Technical Solution revisions, cost decisions, policy evaluations, and quote revisions form a tenant-composite directed graph. Every edge stores the exact immutable row ID and version; “latest” is never resolved while calculating or issuing a quote.

Commercial decimals cross API and domain boundaries as canonical strings. PostgreSQL stores `numeric(24,6)` and the TypeScript domain uses scaled `bigint`; floating-point money arithmetic is prohibited. Currency and unit codes are allowlisted by database reference tables.

Cost and sales-policy rules are validated closed JSON AST nodes. The interpreter has bounded depth/group size and a fixed operator allowlist. `eval`, `Function`, executable expressions, and dynamic imports are not permitted. Canonical inputs, hashes, traces, reasons, rule-version pins, and outcomes are retained. Idempotency is transaction-serialized by tenant and key, then bound to command type, subject, actor, and canonical request hash. Exact retries return the retained result; any collision is rejected.

Submitted CTRs, final Technical Solutions, cost decisions, policy evaluations, quote pins/values, and issued quote snapshots are database-guarded immutable. Solution-to-CTR opportunity identity, final-solution cost pins, and quote-to-cost-solution identity are checked again in PostgreSQL. State change, history/decision evidence, audit, outbox, and command result are committed in one transaction.

Later versions are child resources of a stable tenant-qualified root. Creation locks that root and allocates `max(version)+1` or `max(revision)+1` in the same transaction; concurrent writers therefore cannot fork a sequence. CTR snapshot hashes cover the title, requirements, and the canonically sorted attachment-ID membership frozen at submission.

## Consequences

Recalculation produces a new decision instead of rewriting history. Quote issue requires an unexpired revision and all required approvals, then freezes the revision and snapshot. E11+ credit, contract, order, fulfillment, invoice, and collection remain outside this boundary.
