# JTF P1 E11-E17: Quote-to-Cash

Status: DELIVERED

The boundary adds versioned credit evaluation/approval, versioned contracts and signature receipts, exact-pin order release, append-only AR and bank intake, and deterministic reconciliation/allocation.

## Governing invariants

- Exposure and eligibility are calculated server-side with six-decimal exact arithmetic.
- Every decision carries canonical input, trace, hash, actor, correlation, idempotency key, and validity window.
- Orders require the exact unexpired issued quote snapshot, approved/unexpired credit decision, signed contract revision, and matching signature evidence.
- AR and payment remaining balances are derived solely from immutable postings and allocations.
- Every graph edge is tenant-composite; known-ID commands remain anchored to the owning opportunity/customer and current DataScope.
- Reads default deny and field grants filter nested financial, signature, bank, and reconciliation evidence.

## Evidence

Domain tests cover decimal boundaries, expiry/rejection and exact pins, over-allocation, currency mismatch, canonical ordering, and replay. Migration and PostgreSQL suites cover ordering, tenant constraints, immutability, rollback, and command identity.

## Governed API

- `POST /api/v1/credit-limits`, `POST /api/v1/credit-decisions`, and `POST /api/v1/credit-decisions/:id/approve`
- `POST /api/v1/contracts` and `POST /api/v1/contracts/:revisionId/sign`
- `POST /api/v1/sales-orders`, `POST /api/v1/ar-open-items`, and `POST /api/v1/bank-payments`
- `POST /api/v1/reconciliation-runs`
- `GET` collection reads for credit decisions, contracts, sales orders, AR open items, bank payments, and reconciliation runs

Every command requires an `Idempotency-Key`. Authentication is resolved again for each request; capability field grants and the current DataScope are passed into the repository transaction. Read DTOs are reduced to the caller's field grant before leaving the application boundary.

Reconciliation uses the stable order `due_at, created_at, id`. It locks the payment and candidate open-item ledger rows, appends allocation entries, audit evidence, outbox evidence, and the retained command result in one transaction. Remaining balances are views derived from immutable postings and allocations; there is no balance update API.
