# KT-UI-PROD-02 Production Frontend Refinement Audit

Date: 2026-08-25 Asia/Shanghai

## Production findings

1. Route descriptions repeat section headings and read like operating-manual prose.
2. Collection/legal content had no route token, so it leaked into governance instead of remaining in receivables.
3. Least-privilege users fall back to an internal employee identifier when employee directory access is absent.
4. Successful form closure can hide a rejected business command; feedback needs a durable toast and field-level error contract.
5. Governance repeats capability explanations on every card and exposes counts without prioritizing actions or exceptions.
6. Dense workbenches rely on stacked paragraphs where metadata rows, status labels and progressive disclosure are more appropriate.

## Remediation order

1. Fix route leakage and shorten global route/subsection copy.
2. Establish shared status, empty-state, error, table-toolbar and action hierarchy patterns.
3. Traverse every route against its backend capability family and atomic roles.
4. Replace explanatory paragraphs with labels, tooltips or contextual help only where a decision needs explanation.
5. Verify desktop, tablet and 390px layouts, keyboard focus, loading/empty/error states and forbidden actions.

## Execution checkpoints

| Checkpoint | State    | Evidence                                                                                                    |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| P1         | Complete | Twelve-route ownership matrix, backend families, representative roles and priority gaps recorded below      |
| P2-A       | Complete | Shared color, surface, focus, button, responsive and reduced-motion tokens applied to the application shell |
| P3-A       | Complete | Dialog rejection remains visible; duplicate submission and cancellation are blocked while a command runs    |
| P3-B       | Complete | Legacy commercial actions now catch asynchronous rejection and publish loading, success or error state      |
| P4-A       | Complete | Contract-to-order readiness exposes the first blocked gate from live quote, credit, contract and order data |
| P4-B       | Complete | Permission-scoped commercial views and Order 360 records load concurrently instead of serially              |
| P4-C       | Complete | Opportunity exceptions and CTR-to-quote prerequisites are visible, prioritized and route-scoped             |
| P4-D       | Complete | CTR submission and quote issuance use durable confirmation, loading and rejection feedback                  |
| P5-A       | Complete | AR, payment, broken-promise and legal-intake queues are summarized and prioritized by urgency               |
| P5-B       | Complete | Receivables sort by due date and reconciliation uses durable confirmation and rejection feedback            |
| P5-C       | Complete | Commission and risk queues prioritize actionable records, translate rule evidence and expose next actions   |
| P6-A       | Complete | Production, cost and MRP queues prioritize actionable work and expose accountable next actions              |
| P6-B       | Complete | Procurement, quality, inventory and shipment queues summarize exceptions and translate operational codes    |
| P6-C       | Complete | Cost, MRP, quality-plan and shipment decisions require explicit confirmation and traceable evidence         |

P3-A was verified with a regression test for the shared operation-state contract plus the complete web lint,
typecheck, 45-test and production-build gate. Authenticated production UAT remains a P9/P10 release condition;
local test success is not treated as production acceptance.

P4-A/P4-B were verified with deterministic readiness and concurrency regression tests plus the complete web
gate. The readiness strip is route-scoped to `contract-order`; it does not disclose data outside the current
session's existing API permissions.

P4-C/P4-D add active, overdue, 30-day close and missing-customer opportunity signals; correct the overview's
mislabelled lead metric; and expose the first missing approved CTR, final solution, cost decision, published
policy or quote prerequisite. Direct CTR submission and quote issuance no longer bypass shared rejection
feedback.

P5-A/P5-B introduce route-scoped cash and debt queues, mark overdue open items, order them by earliest due
date, and move automatic reconciliation behind the shared command lifecycle. Queue counts are derived from
the same permission-filtered API records already available to the session.

P5-C orders commission work by payment, frozen and accrued action priority; orders risk work by severity;
translates internal risk-rule codes into operational Chinese; and adds permission-filtered summary counts and
explicit next-action guidance without changing immutable ledger or policy evidence.

P6-A/P6-B order production execution, manufacturing cost, MRP proposals, quality disposition and shipment
release work by operational urgency. Procurement and quality summaries surface pending admission, receipts,
inspection and quarantine work; supply modes, inspection stages, quality states and shipment gate failures use
daily Chinese business language instead of internal codes.

P6-C moves manufacturing-cost approval, MRP release, quality-plan publication, shipment exception approval and
warehouse release behind the shared confirmation lifecycle. Operators must now provide a reason and evidence
reference for governed decisions; no production decision relies on a hard-coded test-channel marker.

## 128-hour execution plan

| Phase                        | Hours | Exit evidence                                                                                     |
| ---------------------------- | ----: | ------------------------------------------------------------------------------------------------- |
| P1 Route/capability audit    |     8 | Every route has owners, roles, API families, actions and known gaps                               |
| P2 Shell and design system   |    16 | Navigation, title hierarchy, spacing, type, color, focus and responsive tokens are consistent     |
| P3 Interaction feedback      |    16 | Loading, success, rejection, empty state, validation and confirmation patterns are shared         |
| P4 Commercial refinement     |    20 | CRM through contract/order pages expose complete allowed actions without prose-heavy layouts      |
| P5 Cash and legal refinement |    16 | AR, payment, collection, legal, commission and risk workbenches are operationally prioritized     |
| P6 Operations refinement     |    20 | Planning through delivery pages use consistent queues, evidence and exception handling            |
| P7 Governance refinement     |    12 | IAM, audit and platform pages prioritize actions and exceptions over capability descriptions      |
| P8 Copy/capability closure   |     8 | Repeated instructional copy is removed and every backend family has an intentional UI disposition |
| P9 Responsive/role UAT       |     8 | Desktop, tablet, 390px, keyboard and representative atomic roles pass                             |
| P10 Release                  |     4 | Full gate, exact SHA deployment, health/readiness and authenticated production acceptance pass    |

## Route and backend ownership matrix

| Route                  | Primary work             | Backend families                                            | Representative roles             | Current priority                                           |
| ---------------------- | ------------------------ | ----------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------- |
| `overview`             | KPIs, tasks, exceptions  | dashboard, risks, notifications                             | executive viewer                 | Replace generic cards with action-ranked exceptions        |
| `sales-workspace`      | Commercial queue         | customers, opportunities, orders, AR                        | sales and finance roles          | Reduce duplicated subsection introductions                 |
| `operations-workspace` | Operations queue         | MRP, production, quality, shipments                         | planning and operations roles    | Establish queue status and exception hierarchy             |
| `crm`                  | Leads and Customer 360   | employees, customers, leads, activities                     | lead operator, customer steward  | Compact filters and persistent result state                |
| `opportunity-ctr`      | Opportunity and CTR      | opportunities, CTR, attachments, solutions                  | opportunity owner, CTR reviewer  | Clarify revision and approval state                        |
| `cost-quote`           | Cost, policy, quote      | cost, sales policy, quote                                   | cost analyst, quote roles        | Consolidate economics and approval actions                 |
| `contract-order`       | Credit to order          | credit, contracts, sales orders, Order 360                  | credit, contract and order roles | Prioritize blockers and next valid action                  |
| `ar-payment`           | Cash and debt            | AR, payment, allocation, commission, risk, collection/legal | finance, collection, legal       | Separate daily queues and expose rejection feedback        |
| `planning-production`  | Supply and execution     | master data, procurement, inventory, MRP, production, cost  | planning and production roles    | Normalize dense cards into tables and timelines            |
| `quality-warehouse`    | Quality and traceability | quality, inventory, traceability                            | quality and warehouse roles      | Emphasize disposition and blocked stock                    |
| `delivery-evidence`    | Release to POD           | shipment, exception, POD                                    | logistics and release roles      | Show gate failures before historical evidence              |
| `governance`           | IAM and platform         | organization, employee, authorization, audit, engines       | IAM, platform, auditor           | Remove repeated permission prose and prioritize exceptions |
