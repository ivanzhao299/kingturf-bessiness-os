# KT-L19 Collections, Legal Handoff and Debt Evidence — Local Gate

Date: 2026-08-25 Asia/Shanghai
Status: local release candidate; production acceptance pending

## Accepted scope

- Overdue positive receivables can open immutable collection cases with a server-derived balance snapshot.
- Follow-ups and payment promises form append-only ledgers; fulfillment requires real allocation evidence.
- Broken promises can be escalated to legal only from allowed states and at the current receivable balance.
- A legal requester cannot accept or return their own handoff.
- Accepted handoffs can generate versioned debt evidence packages with explicit missing requirements and a canonical hash.
- A collection case cannot close from the legal path until a `READY` evidence package exists.
- Collection, promise, legal and evidence-package actions write security audit events.
- Order 360 and its timeline expose the new records only when the corresponding atomic read capability is present.
- The web workbench exposes field-based case, follow-up, promise, escalation, acceptance and evidence actions without raw JSON entry.

## Atomic authorization

- Roles: `KT_COLLECTION_SPECIALIST`, `KT_COLLECTION_MANAGER`, `KT_LEGAL_CASE_MANAGER`.
- Capabilities: `collection:read`, `collection:manage`, `collection:escalate`, `collection:close`, `legal-case:read`, `legal-case:decide`, `debt-evidence:generate`.
- Segregation: collection specialist and legal case manager cannot be assigned to the same employee; the database independently rejects requester self-acceptance.

## Verified rejection paths

1. A non-overdue or settled receivable cannot become a collection case.
2. A promise cannot be marked fulfilled without sufficient allocation entries.
3. A promise cannot be marked broken before its due time.
4. A legal claim cannot diverge from the current open balance.
5. A requester cannot decide their own legal handoff.
6. A legal case cannot close without a ready evidence package.
7. Collection, legal and evidence records cannot be updated or deleted after insertion.

## Local evidence

- Fresh disposable PostgreSQL database accepted migrations `0001` through `0053` with matching checksums.
- Database: 43 tests passed.
- API: 119 tests passed, including the PostgreSQL collection/legal acceptance scenario.
- Web: 44 tests passed; production web build passed.
- Domain: 14 tests passed; all remaining package tests passed.
- Frontend capability verification: 96 direct capabilities and 19 governed endpoint families.
- Formatting, lint, typecheck, all builds and production dependency security audit passed.

## Remaining production gate

This document does not claim production completion. The release must still be committed, pushed and deployed through the canonical workflow, then prove release SHA, `/health`, `/ready`, authenticated role visibility, forbidden self-acceptance, accepted independent handoff, generated `READY` evidence package and immutable close evidence.
