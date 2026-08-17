# KingTurf Business OS V2 — Long Task Plan

## Goal

Implement the V2 atomic-operations blueprint as a continuous, dependency-aware engineering program. The plan is ordered to avoid rework: permission architecture and canonical business objects first, then acquisition/order/field operations, then deeper production/finance integration.

## Execution Rules

- Keep each task bounded and testable.
- Every business page/API receives atomic permission coverage before it is considered complete.
- Every core object must emit audit evidence.
- Do not use parent menu grants as operational fallback.
- Preserve multi-client capability from the first implementation.
- Prefer shared domain/API contracts over client-specific duplicated logic.
- New external channels enter through adapters and canonical objects.
- High-risk finance/credit/shipment actions remain governed.

## Program A — Atomic Authorization Foundation

### KT-V2-A01 Permission registry schema

Create MenuPermission, ActionPermission, RolePermission, UserPermission, DataScopePolicy and FieldAccessPolicy models.

Acceptance:

- menu codes are unique and registry-driven;
- action bits V/C/E/D/A/X are validated;
- unknown permissions fail closed.

### KT-V2-A02 Atomic menu catalog

Seed full CRM, Sales, Order, Field, Manufacturing, QA/WMS, Finance/Risk and System leaf menus defined in the V2 blueprint.

### KT-V2-A03 Backend permission guard

Implement leaf-menu + action-bit authorization decorator/guard and deny-by-default semantics.

### KT-V2-A04 DataScope runtime

Implement SELF/TEAM/DEPARTMENT/REGION/COMPANY/GROUP plus extensible object scopes.

### KT-V2-A05 Frontend permission runtime

Build shared permission hooks/components for route, sidebar, card and button visibility.

### KT-V2-A06 Dynamic role-based sidebar

Generate left navigation from registered atomic permissions rather than hard-coded role names.

### KT-V2-A07 Permission administration

Role templates, user overrides, scope assignment and permission audit UI.

### KT-V2-A08 Atomicity CI gate

Port the Phoenix-style static gate to KingTurf and block coarse permission regressions.

### KT-V2-A09 Role acceptance matrix

Create automated role fixtures and E2E tests for Executive, Sales Manager, Salesperson, Field Sales, Technical, Production, Warehouse, Finance and Admin.

## Program B — Multi-Client Shells

### KT-V2-B01 Management Web shell

Role-aware desktop navigation, global search, workbench and exception center.

### KT-V2-B02 Sales mobile shell

Mobile/PWA Today screen, task list, customer/lead quick actions and offline-friendly forms.

### KT-V2-B03 Operations Work Queue

Shared queue framework for technical, sales ops, finance, quality and planning.

### KT-V2-B04 Workshop/Warehouse terminal shell

Large-touch/scanner-first UI foundation.

### KT-V2-B05 Client capability contract

Define which atomic capabilities each client can expose; enforce same backend permissions.

## Program C — Lead Intake & Public Pool

### KT-V2-C01 Lead source master

Source/channel/campaign models and administration.

### KT-V2-C02 Lead Intake Gateway

Normalized ingestion API for website, forms, social, B2B platform, exhibition, email/phone and manual/API sources.

### KT-V2-C03 Raw lead evidence

Persist source metadata, source record ID, ingestion time and payload hash without making raw payload the operational customer record.

### KT-V2-C04 Lead normalization

Normalize identity, phone, email, country, company and demand fields.

### KT-V2-C05 Duplicate detection

Rule-based duplicate candidates by company/contact/email/phone/domain with merge-review flow.

### KT-V2-C06 Qualification Review Queue

Human/AI-assisted review before public-pool admission.

### KT-V2-C07 Public Pool

Qualified unowned lead/customer inventory with filters, SLA and aging.

### KT-V2-C08 Assignment Engine

Manual, round-robin, region, country/language, expertise, workload and performance-based allocation strategies.

### KT-V2-C09 Assignment acceptance SLA

Salesperson accepts/rejects/returns assignment with reason and timer.

### KT-V2-C10 Reclaim & redistribution

No-follow-up, expired SLA, leave/transfer and manager-reclaim workflows.

### KT-V2-C11 Ownership history

Immutable customer/lead ownership timeline.

### KT-V2-C12 Conversion

Lead -> Customer -> Contact -> Opportunity with attribution preserved.

### KT-V2-C13 Website connector reference implementation

Implement one generic webhook/form connector and adapter contract.

### KT-V2-C14 Social connector reference implementation

Implement one configurable social/API ingress adapter pattern; provider-specific credentials stay outside source control.

## Program D — Sales Workspace & Funnel

### KT-V2-D01 Sales Today dashboard

Follow-up due, assigned leads, visits, quotes, collection due and target gap.

### KT-V2-D02 Opportunity pipeline

Stages, probability, next action, expected close and loss reason.

### KT-V2-D03 Customer/Contact workspace

Ownership-aware Customer 360 with interaction timeline.

### KT-V2-D04 Sales activity timeline

Calls, messages, visits, notes, documents and structured next actions.

### KT-V2-D05 CTR workflow

Customer technical requirement capture, file/voice/text ingestion and structured requirements.

### KT-V2-D06 Technical solution link

CTR -> Technical Solution -> SKU/BOM candidate -> Cost Sheet.

### KT-V2-D07 CPQ & policy integration

Quote creation using cost, price policy, margin and approval rules.

### KT-V2-D08 Contract/order handoff

Accepted quote -> governed contract -> Canonical Order draft.

## Program E — Unified Order Hub

### KT-V2-E01 Canonical Order schema

Create CanonicalOrder, OrderSourceLink, OrderIngressEvent, OrderValidation, OrderHold and OrderRelease.

### KT-V2-E02 Order adapter SDK

Define adapter interface, idempotency keys, mapping result, errors and source evidence.

### KT-V2-E03 Direct B2B sales adapter

Native sales/contract channel into Order Hub.

### KT-V2-E04 Dealer/distributor adapter

Dealer portal/API order ingestion pattern.

### KT-V2-E05 Export order adapter

Multi-currency/trade term/export metadata support.

### KT-V2-E06 Manual/import adapter

Governed manual/CSV/API import with audit and duplicate checks.

### KT-V2-E07 Sample/replacement order types

Different commercial rules but same canonical lifecycle.

### KT-V2-E08 Order validation pipeline

Customer, product, technical, price, contract, payment/credit and duplicate checks.

### KT-V2-E09 Order hold/release engine

Structured holds with role-specific release permissions.

### KT-V2-E10 Order 360 source lineage

Show original channel, mapping, validation, hold/release and final Sales Order.

### KT-V2-E11 Order channel dashboard

Volume, errors, conversion and SLA by channel.

## Program F — Sales Workforce Operations

### KT-V2-F01 Field employee profile

Territory, role, work policy, schedule policy and manager relationship.

### KT-V2-F02 Weekly plan

Employee/manager weekly plan with customer and target linkage.

### KT-V2-F03 Daily schedule

Tasks generated from plans, CRM SLA, collections, manager dispatch and trips/exhibitions.

### KT-V2-F04 Dispatch center

Manager team scheduling and reassignment.

### KT-V2-F05 Attendance events

Start/end/check-in event model with device/session/time and policy-aware location evidence.

### KT-V2-F06 Location events

Event-based GPS for check-in, visit start/end and required route milestones. No continuous tracking by default.

### KT-V2-F07 Visit lifecycle

Scheduled -> arrived -> started -> completed -> follow-up with customer/location/evidence.

### KT-V2-F08 Acquisition activity

New prospect capture during field work and direct routing to Lead Intake/qualification.

### KT-V2-F09 Visit evidence

Notes, photos/files where justified, contact/result and next action.

### KT-V2-F10 AI daily report draft

Generate report draft from actual system activity.

### KT-V2-F11 Manager review

Daily/weekly review, coaching note and support request workflow.

### KT-V2-F12 Field exception engine

Missed schedule, impossible travel, abnormal check-in/activity gaps, duplicate reports and other review signals.

### KT-V2-F13 Field manager cockpit

Team schedule, visit status, lead production, funnel movement, collection actions and exceptions.

### KT-V2-F14 Employee 360 workforce tab

Attendance, schedule, visits, valid leads, opportunity movement, reports and risk events.

## Program G — Targets, Performance & Commission Linkage

### KT-V2-G01 Target hierarchy

Company -> department -> region -> manager -> employee targets.

### KT-V2-G02 Activity/output metrics

Separate activity metrics from business-result metrics.

### KT-V2-G03 Valid-lead metric

Count only qualified leads, not raw contacts.

### KT-V2-G04 Sales contribution model

Revenue, margin, collection, overdue, expense and customer quality.

### KT-V2-G05 Commission attribution

Assignment/ownership/order/payment lineage determines commission eligibility.

### KT-V2-G06 Performance dashboard

Employee and manager views with target, forecast and contribution.

## Program H — Production/Cost Integration

### KT-V2-H01 Order -> Production Demand

Only released canonical/sales orders can create production demand.

### KT-V2-H02 Product/technical snapshot

Freeze approved technical parameters at production release.

### KT-V2-H03 Cost estimate snapshot

Freeze quoted estimated cost/policy version for variance comparison.

### KT-V2-H04 Production status bridge

Expose plan/work order/batch progress to Order 360 and sales client with appropriate field permissions.

### KT-V2-H05 Actual cost bridge

Actual manufacturing cost -> Order P&L; restrict sensitive visibility.

## Program I — Finance, Collection & Evidence

### KT-V2-I01 AR generation from governed order

### KT-V2-I02 Bank transaction matching

### KT-V2-I03 Collection task generation

Collection due creates salesperson/finance tasks automatically.

### KT-V2-I04 Commission release on governed payment

### KT-V2-I05 Customer statement confirmation

### KT-V2-I06 Debt evidence timeline

### KT-V2-I07 Legal evidence package

## Program J — AI & Management Control

### KT-V2-J01 Lead qualification assistant

### KT-V2-J02 Assignment recommendation

### KT-V2-J03 Sales follow-up coach

### KT-V2-J04 Field schedule optimization

### KT-V2-J05 Fraud/anomaly review scoring

### KT-V2-J06 Order exception summarizer

### KT-V2-J07 Management daily brief

### KT-V2-J08 Auto task/escalation

## Recommended Delivery Waves

### Wave 1 — Governance foundation

A01-A09 + B01-B05

Exit gate: role-specific atomic menus work across clients and unauthorized direct API access is blocked.

### Wave 2 — Customer acquisition ownership loop

C01-C14 + D01-D04

Exit gate: external lead -> review -> public pool -> assignment -> salesperson -> opportunity works end-to-end.

### Wave 3 — Sales technical/commercial loop

D05-D08 + E01-E10

Exit gate: salesperson can move assigned customer through CTR/quote/contract into one canonical order model.

### Wave 4 — Workforce closed loop

F01-F14 + G01-G03

Exit gate: one field salesperson's full workday is reconstructable from plan, tasks, attendance/visit evidence, CRM updates and report without relying on manual narrative alone.

### Wave 5 — Production/cash/profit integration

H01-H05 + I01-I07 + G04-G06

Exit gate: order connects to production, delivery, AR, payment, commission and contribution P&L.

### Wave 6 — AI operating layer

J01-J08

Exit gate: system proactively identifies stalled leads, field exceptions, order risks and cash risks and generates traceable tasks/escalations.

## Cross-Cutting Tests

Every wave must include:

- atomic permission E2E;
- data-scope isolation;
- audit/event assertions;
- idempotency for external ingestion;
- direct URL/API denial tests;
- mobile/desktop permission parity;
- customer/order/employee 360 consistency;
- no-secret logging checks;
- migration rollback or forward-fix plan.

## Product-Level Done Criteria

The V2 program is complete when the following real scenario works:

A lead originates from an external website/social channel, is normalized and reviewed, enters the public pool, is allocated to an authorized salesperson, appears in that salesperson's mobile Today workspace, becomes a documented opportunity and technical requirement, produces an approved quote/contract, enters the unified Order Hub, drives production and delivery, creates AR, receives matched bank payment, releases policy-based commission, updates Employee 360/Customer 360/Order 360, and leaves a complete audit/evidence trail. A manager with different permissions sees only their authorized team/data, while unauthorized users cannot discover the function in navigation or access it directly via URL/API.
