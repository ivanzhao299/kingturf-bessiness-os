# ADR 0006 — Transactional outbox and local adapters

Accepted. Business mutations, immutable audit events, and bounded versioned domain-event envelopes commit in one PostgreSQL transaction. Workers claim with `FOR UPDATE SKIP LOCKED`, recover expired leases, retry with bounded backoff, and terminate in observable dead-letter state. Consumer checkpoints are immutable and idempotent.

External brokers, delivery providers, and production object storage are deliberately absent. Local/test operation uses an in-process poller contract and temporary-directory attachment storage; production adapters must be explicitly configured and reviewed.
