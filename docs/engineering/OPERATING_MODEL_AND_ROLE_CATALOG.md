# KingTurf Business OS — Operating Model, Roles and Delivery Blueprint

Version: 1.0 · 2026-08-17

## 1. Design authority

This document is the working contract for three reviews on every long-task package:

- **Chief architect review:** domain boundaries, data ownership, state machines, tenancy, integration, auditability and operability.
- **Enterprise-management review:** pain point removed, owner/accountability, approval boundary, exception handling, KPI and evidence.
- **Product/UI review:** user journey, role-specific queue, information hierarchy, mobile/desktop behavior, accessibility and failure feedback.

No package is complete until all three reviews have evidence in the project Memory and the repository has code/test/UAT evidence.

## 2. Industry pain points to solve

| Pain point | System response | Business proof |
|---|---|---|
| Sales promises diverge from technical/manufacturing reality | CTR, versioned solution, BOM/routing and server-side cost snapshot | Order retains exact commercial and technical versions |
| Quotation margin is unclear or manually altered | CPQ + policy + cost engine with explainable approval | Quote shows planned margin and blocked exceptions |
| Credit and overdue risk appears after shipment | Credit exposure, AR aging and shipment hard gates | Unpaid/overdue orders cannot ship without exception approval |
| Production, quality and warehouse use separate ledgers | Immutable material, work, lot, inspection and location events | Order/lot traceability reaches finished goods |
| Management relies on Excel and verbal escalation | Exception queues, ownership, SLA, escalation and cockpit drill-down | Every alert opens a task tied to a business object |
| Disputes lack evidence | Order 360 evidence timeline and immutable audit events | Debt/quality/legal evidence package is exportable |

## 3. Role taxonomy and responsibility

Roles are job responsibilities, not UI menus. A user may hold several roles, but each action is checked by server-side RBAC, data scope, field permissions and action permissions.

| Role | Owns | Can approve | Must not do |
|---|---|---|---|
| Sales owner | Lead, customer relationship, opportunity, visit, collection follow-up | Within delegated commercial policy | Override cost, credit or shipment gates |
| Sales manager | Team pipeline, forecast, price exception, performance | Delegated quote/discount and team assignment | Edit immutable issued documents |
| Sales operations | Master-data quality, CTR/quote/order completeness | Process acceptance and exception routing | Approve own commercial exception |
| Technical engineer | CTR, solution, BOM/routing feasibility | Technical release | Change signed commercial terms |
| Cost/pricing analyst | Cost sheet, standard/estimated cost, price explanation | Cost validation | Alter actual ledger or payment |
| Credit/finance reviewer | Credit limit, exposure, AR, reconciliation | Credit terms and payment application | Approve unsupported shipment override |
| Contract/legal reviewer | Contract clauses, signatures, legal hold, evidence | Legal terms and exceptions | Delete evidence or bypass audit |
| Planner/procurement | Demand, MRP, supplier, purchasing and inventory | Plan release within policy | Manufacture without authorized demand |
| Workshop supervisor | Work order, material issue/return, reporting, yield | Production completion within controls | Backdate or overwrite immutable events |
| Quality inspector/manager | Inspection, NCR, disposition, release | Lot/finished-goods release | Release without required results |
| Warehouse/logistics | Locations, lot movement, shipment preparation, receipt | Operational confirmation | Ship through a failed hard gate |
| Collection specialist | Promise-to-pay, notices, escalation | Collection workflow actions | Alter official receipt totals |
| Executive/GM | Cross-domain exceptions, targets, risk and cash | High-risk exception and policy | Operate as a hidden data editor |
| System auditor | Evidence, audit export, control review | None by default | Modify business records |
| Platform administrator | Users, role grants, integration and operations | Access requests under policy | Use technical access to approve business decisions |

## 4. Canonical business lifecycle

`Lead → Customer → Opportunity → CTR → Solution → Cost → Quote → Credit → Contract → Order → Demand → MRP/Purchase → Work Order → Quality → Finished Goods → Shipment → Receipt → Invoice → AR → Payment → Commission → Order P&L → Close`

Every transition specifies: actor, preconditions, command idempotency key, optimistic version, audit event, notification/task, rejection reason and next owner. Historical policy, quote, contract, cost, commission and approval versions are immutable.

## 5. Frontend and backend contract

### Frontend

- Three surfaces: Sales Workspace, Operations Workspace, Management Cockpit.
- Each route has a queue, filters, primary action, detail/360 view, status timeline and exception panel.
- Forms are role-specific and field-permission aware; no raw JSON as the primary business action.
- Every mutation returns correlation ID, updated version, audit summary and actionable failure feedback.
- Desktop supports dense operations; 390px mobile prioritizes sales tasks, approvals, visits and collection follow-up.

### Backend

- Domain modules own their tables, commands, queries and policies; cross-domain reads use explicit projections/aggregates.
- Commands are transactional, idempotent, optimistic-concurrency protected and emit immutable events.
- Server enforces RBAC + DataScope + field/action permissions; UI hiding is only a usability layer.
- APIs expose list/detail/command/decision/history/evidence shapes, not storage-shaped blobs.
- Metrics and audit events carry correlation ID and business object ID; secrets and sensitive payloads never enter logs.

## 6. Delivery sequence

1. **L01 foundation UX:** navigation, design system, route contract, responsive shell and workbench boundaries. Evidence: `4f4f432`.
2. **L02 sales-to-cash productization:** field forms and queues for CRM, CTR, solution, cost, quote, credit, contract, order, AR and payment.
3. **L03 one-order proving ground:** repeatable seed, success/rejection/overdue scenarios, Order 360 and browser evidence.
4. **L04 manufacturing control:** quality/WMS closure, then actual cost and variance tied to order/lot.
5. **L05 delivery and risk:** shipment hard gates, logistics, collections, legal evidence, complaints/NCR/CAPA.
6. **L06 management and people:** cockpit responsibility drill-down, targets, field work, employee 360 and commission/performance.
7. **L07 AI operating loop:** read → analyze → recommend → task → track → escalate; high-risk decisions remain human-approved.
8. **L08 production readiness:** security, backups, observability, performance, recovery, release and rollback drills.

Each package must include: specification, migration/rollback, API, permissions, frontend, tests, Validator/Reviewer review, UAT evidence, project-local Memory update, commit SHA and deployment result.

## 7. Immediate implementation package

Start L02 with CRM and Customer 360, then CTR and solution, then cost/quote, then credit/contract/order, then AR/payment. Do not build isolated CRUD screens: each slice must connect to the canonical Business Order ID and preserve the next downstream gate. The first executable acceptance is a seeded order with one successful path and explicit rejection paths for low margin, insufficient credit, missing contract and overdue shipment.
