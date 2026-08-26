# KT-L20 Customer Complaint, NCR and CAPA Specification

Date: 2026-08-26 Asia/Shanghai  
Status: architecture frozen; implementation active  
Estimated effective engineering effort: 40 hours

## 1. Objective

Create one traceable quality loop from a customer complaint to product/order/lot evidence, nonconformance investigation, containment, root cause, corrective and preventive actions, independent effectiveness verification and final closure.

This is the only active task after KT-L19. Existing operational paging and `BatchCommandResult` contracts are reused as platform foundations and do not form a separate roadmap.

## 2. Industry scope

The defect taxonomy must support artificial-turf operations:

- pile height, gauge, stitch density, face weight and roll-length deviation;
- colour difference, mixed batches, yarn splitting, shedding and wear resistance;
- coating, backing, lamination, delamination and drainage defects;
- tuft bind, fire, UV, environmental and laboratory nonconformance;
- roll width, packaging, label, container loading, transit damage and shortage;
- installation compatibility, site-foundation conditions and non-product responsibility.

## 3. State machines

Complaint:

`REPORTED -> TRIAGED -> INVESTIGATING -> NCR_OPEN -> CAPA_ACTIVE -> VERIFIED -> CLOSED`

`REPORTED` or `TRIAGED` may become `REJECTED` only with a reason and evidence. Major or critical complaints cannot skip NCR and CAPA.

NCR:

`OPEN -> CONTAINED -> ROOT_CAUSE_CONFIRMED -> DISPOSITIONED -> CLOSED`

Disposition is one of rework, repair, concession, return, scrap or supplier claim. An NCR cannot close before containment, confirmed root cause and disposition evidence exist.

CAPA:

`OPEN -> ACTIONS_IN_PROGRESS -> READY_FOR_VERIFICATION -> VERIFIED -> CLOSED`

All actions must be complete before verification. The verifier must be independent from every action owner. A failed verification returns the case to `ACTIONS_IN_PROGRESS` through an append-only event; history is never rewritten.

## 4. Atomic authorization and segregation

Capabilities:

- `complaint:read`, `complaint:create`, `complaint:triage`, `complaint:assign`, `complaint:close`
- `ncr:read`, `ncr:manage`, `ncr:disposition`, `ncr:close`
- `capa:read`, `capa:manage`, `capa:verify`

Roles:

- complaint registrar: create and read;
- complaint coordinator: triage, assign and follow up;
- quality investigator: open NCR, contain and record root cause;
- quality manager: approve disposition and close the independently verified nonconformance report;
- CAPA owner: create and complete actions;
- CAPA verifier: independently verify effectiveness;
- sales viewer and executive viewer: scoped read only.

Hard controls:

- complaint registrar and final closer must be different employees;
- major NCR investigator and disposition approver must be different employees;
- no CAPA action owner may verify the CAPA;
- a complaint with an NCR may close only after both its CAPA and NCR are closed;
- quality roles may propose returns, compensation or credits but L20 never posts accounting, payment, inventory reversal or refund entries.

## 5. Query and command contract

Lists use stable server-side cursor pagination. Each page reapplies tenant, DataScope and field grants. Filters include query, state, severity, assignee, customer, order, batch, created/SLA date ranges and overdue state. List rows contain queue summaries; full timelines load only by identifier.

The first batch command is `POST /api/v1/complaints/batch-triage`:

- maximum 50 unique complaints;
- may triage, prioritize and assign only;
- each item supplies expected version and receives a derived idempotency key;
- authorization, DataScope, state, version and assignee are rechecked per item;
- item transactions are independent, so valid items commit even when other items are rejected;
- response uses `BatchCommandResult` with deterministic per-item status and reason;
- bulk close, disposition, verification and financial effects are prohibited.

## 6. Audit and event evidence

Every command writes the business event, security audit event, transactional outbox event and idempotent result in one transaction. Required actions include `complaint.created`, `complaint.triaged`, `complaint.assigned`, `ncr.opened`, `ncr.contained`, `ncr.root-cause-confirmed`, `ncr.dispositioned`, `capa.created`, `capa.action-completed`, `capa.verified`, `complaint.closed` and `complaint.batch-triaged`.

## 7. Product surface

The quality workspace uses a compact queue/table as the primary surface, not stacked cards. It contains complaint queue, NCR investigation, CAPA actions, pending verification and closed archive sub-navigation; a right-side detail drawer shows customer, order, shipment/POD, roll/batch, inspection and the immutable event timeline. Mobile uses task lists and step forms rather than compressed desktop tables.

Complaint summaries must later connect to Customer 360, Order 360, lot traceability and executive quality/SLA metrics.

## 8. Acceptance gate

Acceptance must prove valid and rejected transitions, cross-tenant and DataScope isolation, immutable event protection, idempotent replay, same-key/different-payload conflict, expected-version conflict, concurrent processing, mixed batch results, independent CAPA verification, field grants, desktop/mobile role UAT, exact local/remote/runtime SHA, health/readiness/version, rollback notes and production business evidence.

No production release may expose the batch action until its per-item authorization, idempotency, concurrency, partial-failure and audit tests pass.
