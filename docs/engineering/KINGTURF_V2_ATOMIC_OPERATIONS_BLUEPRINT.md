# KingTurf Business OS V2 — Atomic Operations & Multi-Channel Sales Blueprint

## 1. Purpose

This document extends PRODUCT_BLUEPRINT.md with four mandatory capabilities:

1. Atomic role/menu/action permissions modeled after the proven Phoenix ERP permission discipline.
2. Multi-client architecture for management, sales/field staff, production/warehouse and external/customer use cases.
3. A unified Order Hub that accepts orders from multiple business channels but normalizes them into one governed order lifecycle.
4. A closed-loop Sales Workforce Operations system covering scheduling, field attendance, location, visits, acquisition progress, reporting, target tracking and anti-fraud controls.

The central operating chain becomes:

Traffic Source -> Lead Intake -> Lead Qualification -> Public Pool -> Assignment -> Sales Workspace -> Opportunity -> CTR -> Quote -> Contract -> Order Hub -> Production -> Delivery -> AR/Collection -> Commission -> Customer/Employee/Order P&L.

## 2. Atomic Permission Architecture

### 2.1 Four-layer authorization model

- Menu Permission: determines whether a left-navigation leaf is visible.
- Action Permission: controls V/C/E/D/A/X operations.
- Data Scope: SELF / TEAM / DEPARTMENT / REGION / COMPANY / GROUP plus customer-owner, warehouse, channel and project scopes.
- Field Permission: controls sensitive data such as actual manufacturing cost, bank accounts, commission formula internals and legal data.

Frontend visibility is not security. Every API must enforce the same atomic permission server-side.

### 2.2 Action bits

- V = View
- C = Create
- E = Edit
- D = Delete/void where allowed
- A = Approve/authorize
- X = Execute/special operation (release shipment, allocate lead, confirm bank payment, export sensitive data, etc.)

### 2.3 Parent menus must not grant leaf access

Examples:

MENU_CRM is navigation grouping only.
Operational roles receive leaf permissions such as:

- MENU_CRM_LEAD_INBOX
- MENU_CRM_LEAD_REVIEW
- MENU_CRM_PUBLIC_POOL
- MENU_CRM_ASSIGNMENT
- MENU_CRM_CUSTOMER
- MENU_CRM_CONTACT
- MENU_CRM_OPPORTUNITY
- MENU_CRM_VISIT
- MENU_CRM_CHANNEL
- MENU_CRM_CAMPAIGN

The same principle applies to ORDER, SALES_POLICY, FIELD_WORK, PRODUCTION, QUALITY, WMS, FINANCE and ADMIN domains.

### 2.4 Atomic menu domains

#### CRM / Acquisition

MENU_CRM_DASHBOARD
MENU_CRM_LEAD_INBOX
MENU_CRM_LEAD_REVIEW
MENU_CRM_PUBLIC_POOL
MENU_CRM_ASSIGNMENT
MENU_CRM_CUSTOMER
MENU_CRM_CONTACT
MENU_CRM_OPPORTUNITY
MENU_CRM_VISIT
MENU_CRM_CHANNEL
MENU_CRM_CAMPAIGN
MENU_CRM_DUPLICATE_REVIEW
MENU_CRM_CUSTOMER_TRANSFER

#### Sales / CPQ / Contract

MENU_SALES_DASHBOARD
MENU_SALES_CTR
MENU_SALES_SOLUTION
MENU_SALES_COST_ESTIMATE
MENU_SALES_QUOTE
MENU_SALES_PRICE_EXCEPTION
MENU_SALES_CREDIT
MENU_SALES_CONTRACT
MENU_SALES_ESIGN
MENU_SALES_POLICY
MENU_SALES_COMMISSION
MENU_SALES_TARGET

#### Order Hub

MENU_ORDER_DASHBOARD
MENU_ORDER_INBOX
MENU_ORDER_MANUAL
MENU_ORDER_CHANNEL
MENU_ORDER_REVIEW
MENU_ORDER_SALES_ORDER
MENU_ORDER_CHANGE
MENU_ORDER_HOLD
MENU_ORDER_RELEASE
MENU_ORDER_FULFILLMENT
MENU_ORDER_EXCEPTION
MENU_ORDER_360

#### Field Sales Workforce

MENU_FIELD_TODAY
MENU_FIELD_SCHEDULE
MENU_FIELD_CHECKIN
MENU_FIELD_ROUTE
MENU_FIELD_LOCATION
MENU_FIELD_VISIT
MENU_FIELD_ACQUISITION
MENU_FIELD_DAILY_REPORT
MENU_FIELD_WEEKLY_REPORT
MENU_FIELD_TARGET
MENU_FIELD_EXPENSE
MENU_FIELD_TRIP
MENU_FIELD_EXHIBITION
MENU_FIELD_MANAGER
MENU_FIELD_EXCEPTION

#### Production

MENU_MFG_DEMAND
MENU_MFG_PLAN
MENU_MFG_MRP
MENU_MFG_SCHEDULE
MENU_MFG_ORDER
MENU_MFG_WORKORDER
MENU_MFG_REPORT
MENU_MFG_BATCH
MENU_MFG_COST
MENU_MFG_VARIANCE
MENU_MFG_EQUIPMENT

#### Quality / WMS / Delivery

MENU_QA_IQC
MENU_QA_IPQC
MENU_QA_FQC
MENU_QA_OQC
MENU_QA_NCR
MENU_QA_CAPA
MENU_WMS_INBOUND
MENU_WMS_INVENTORY
MENU_WMS_TRANSFER
MENU_WMS_OUTBOUND
MENU_WMS_STOCKTAKE
MENU_DELIVERY_RELEASE
MENU_DELIVERY_SHIPMENT
MENU_DELIVERY_RECEIPT
MENU_DELIVERY_EXCEPTION

#### Finance / Risk

MENU_FIN_AR
MENU_FIN_COLLECTION
MENU_FIN_BANK_TXN
MENU_FIN_PAYMENT_MATCH
MENU_FIN_RECONCILIATION
MENU_FIN_COMMISSION_LEDGER
MENU_FIN_ORDER_PNL
MENU_RISK_CREDIT
MENU_RISK_EVENTS
MENU_RISK_EVIDENCE
MENU_RISK_LEGAL

#### System / Organization

MENU_SYS_ORG
MENU_SYS_EMPLOYEE
MENU_SYS_ROLE
MENU_SYS_PERMISSION
MENU_SYS_DATASCOPE
MENU_SYS_WORKFLOW
MENU_SYS_APPROVAL_RULE
MENU_SYS_AUDIT
MENU_SYS_INTEGRATION
MENU_SYS_MASTER_DATA

### 2.5 CI permission gate

Introduce scripts/ci/check-menu-permission-atomicity.mjs for KingTurf.

It must fail CI when:

- backend endpoints use coarse parent permissions instead of leaf permissions;
- frontend routes/cards/buttons have no matching atomic gate;
- mobile and desktop visibility diverge from backend permission semantics;
- data scope is resolved with a parent menu rather than the relevant leaf context;
- unregistered menu codes appear in frontend or backend;
- an operational role accidentally receives an entire parent domain grant.

## 3. Role Model

Roles are templates; real authorization is permission + data scope.

Recommended role templates:

- Group/Company Executive
- General Manager
- Sales Director
- Regional Sales Manager
- Domestic Sales
- Export Sales
- Field Business Development
- Sales Operations
- Channel Manager
- Technical/Product Engineer
- Costing/Pricing Controller
- Credit Controller
- Contract/Legal
- Production Director
- Production Planner
- Workshop Supervisor
- Workshop Operator
- Quality Manager
- Quality Inspector
- Warehouse Manager
- Warehouse Operator
- Logistics Coordinator
- AR Accountant
- Cash/Bank Accountant
- Finance Manager
- HR/Admin Manager
- Field Workforce Manager
- Internal Auditor
- System Administrator

Each user may hold multiple role templates, but effective permissions are materialized at leaf level.

## 4. Client Architecture

### 4.1 Management Web

Desktop-first full management platform for executives and functional managers.

Characteristics:

- left navigation is atomic and role-generated;
- dashboards are exception-first;
- supports large tables, configuration, approvals, analytics and 360 views.

### 4.2 Sales / Field Mobile Client

Mobile-first PWA / enterprise WeCom-compatible client.

Primary screen: Today.

Shows:

- today schedule;
- required visits;
- leads needing follow-up;
- quotes requiring action;
- collections due;
- targets and gap;
- check-in status;
- manager tasks;
- report draft.

### 4.3 Operations Client

PC/tablet role workspaces for sales operations, technical, planning, quality and finance.

Primary paradigm is Work Queue, not large navigation trees.

### 4.4 Workshop / Warehouse Terminal

Simplified terminal/PDA UI for work order, reporting, scanning, QC, inbound/outbound and shipment execution.

### 4.5 Customer / Dealer Portal

Later phase external portal for:

- inquiry / technical requirements;
- quotations;
- contract/e-sign;
- order status;
- shipment tracking;
- statement confirmation;
- after-sales cases.

## 5. Acquisition & Customer Pool Architecture

### 5.1 Lead Source Connectors

All acquisition sources enter a standardized Lead Intake Gateway.

Source types include:

- company independent websites;
- landing pages;
- Google Ads/forms;
- Alibaba / Made-in-China / B2B platforms;
- Facebook / Instagram / LinkedIn;
- TikTok / Douyin and other social media;
- WeChat / WeCom;
- WhatsApp;
- exhibitions;
- QR codes;
- inbound phone/email;
- manual referral;
- distributor/project registration;
- API/import.

Every source produces source_id, campaign_id, channel_id, raw_payload_hash, received_at and consent/source evidence where applicable.

### 5.2 Lead states

RAW
-> NORMALIZED
-> DUPLICATE_CHECK
-> QUALIFICATION_REVIEW
-> QUALIFIED
-> PUBLIC_POOL
-> ASSIGNED
-> ACCEPTED
-> WORKING
-> CONVERTED

Exit states:
REJECTED / SPAM / INVALID / DUPLICATE / ARCHIVED.

### 5.3 Qualification gate

A raw lead cannot enter the public pool directly.

Minimum review:

- valid company/person identity;
- contactability;
- target market fit;
- basic demand or channel intent;
- duplicate check;
- blacklist/risk check;
- source traceability.

### 5.4 Public Pool

Qualified but unowned leads/customers enter the Public Pool.

Allocation methods:

- manual manager allocation;
- round robin;
- region;
- country/language;
- product expertise;
- channel specialization;
- workload;
- SLA/performance score;
- AI recommended assignment.

Allocation creates an immutable Assignment record with assigner, assignee, reason, time, SLA and ownership version.

### 5.5 Ownership rules

The company owns the customer. The salesperson receives operational ownership for a bounded period.

Rules:

- failure to accept within SLA -> reclaim;
- no meaningful follow-up within threshold -> warning/reclaim;
- employee transfer/leave -> batch transfer;
- manager override -> audited transfer;
- customer cannot disappear from company visibility;
- historical owners remain traceable.

### 5.6 Conversion chain

Lead Assignment -> Salesperson -> Opportunity -> CTR -> Quote -> Contract -> Order -> AR -> Payment -> Commission.

Commission eligibility requires traceable attribution; manual off-system claims are not authoritative.

## 6. Unified Order Hub

### 6.1 Principle

All order channels normalize into one Canonical Order before production/finance processing.

No sales channel is allowed to create an uncontrolled production order directly.

### 6.2 Order channels

- sales-created B2B contract order;
- dealer/distributor portal order;
- domestic web order/inquiry conversion;
- export order;
- OEM order;
- project order;
- sample order;
- replacement/after-sales order;
- marketplace/API order;
- manager-authorized manual order/import.

### 6.3 Canonical Order stages

INGESTED
-> NORMALIZED
-> DUPLICATE_CHECK
-> COMMERCIAL_REVIEW
-> TECH_CHECK
-> PRICE_POLICY_CHECK
-> CREDIT/PAYMENT_CHECK
-> CONTRACT_CHECK
-> CONFIRMED
-> RELEASED
-> PRODUCTION
-> READY_TO_SHIP
-> SHIPMENT_RELEASE
-> SHIPPED
-> DELIVERED
-> AR_OPEN
-> PAID
-> CLOSED

Exception state: ON_HOLD with structured hold reasons.

### 6.4 Channel adapters

OrderChannelAdapter interface:

- identify source;
- map external customer/contact;
- map product/technical requirements;
- map currency/tax/trade terms;
- idempotency/deduplication;
- preserve original source payload hash;
- create Canonical Order draft;
- report validation errors.

## 7. Sales Workforce Operations

### 7.1 Objective

Manage not only sales outcomes but daily execution evidence.

The system must answer:

- What was this employee expected to do today?
- Where and when did the employee work?
- Which customers were contacted/visited?
- What business evidence was produced?
- What changed in opportunities/quotes/collections?
- What work is overdue?
- Is attendance/work activity plausible?

### 7.2 Daily operating loop

Target -> Weekly Plan -> Daily Schedule -> Task Dispatch -> Check-in -> Route/Visit -> Evidence -> Lead/Opportunity Update -> Daily Report -> Manager Review -> Exception/Coaching -> Performance.

### 7.3 Scheduling

Sources:

- salesperson self-plan;
- manager dispatch;
- CRM follow-up SLA;
- collection due tasks;
- AI suggested visits;
- exhibition/business-trip plan.

Every task has target object, expected output, due time, location requirement and completion evidence rule.

### 7.4 Attendance & field evidence

Check-in can record:

- time;
- GPS;
- device/session;
- customer/site association;
- approved business trip context;
- optional photo/visit evidence when policy requires.

The product should avoid continuous invasive tracking by default. Use event-based location collection (check-in, visit start/end, route milestone) and enable higher-frequency tracking only for roles/policies with a legitimate operational need and clear notice.

### 7.5 Anti-fraud checks

Risk signals:

- impossible travel speed;
- repeated identical GPS points inconsistent with visits;
- check-in outside task region;
- check-in with no CRM/customer activity;
- repeated copy/paste report text;
- visits with no contact/result evidence;
- long idle periods during assigned field work;
- abnormal device/account switching;
- fake or duplicate customer creation;
- high activity volume with zero funnel movement.

Risk signals create Review Events; they do not automatically conclude employee misconduct.

### 7.6 Visit object

A structured visit contains:

- customer/contact;
- purpose;
- scheduled vs actual time;
- location;
- participants;
- demand/technical notes;
- competitor information;
- next action;
- opportunity update;
- attachments;
- customer confirmation where appropriate.

### 7.7 Daily report

AI pre-fills from system activity:

- customers contacted;
- visits;
- leads acquired;
- opportunity movements;
- quotations;
- order/collection actions;
- tasks completed/overdue.

Employee adds only:

- key findings;
- risks;
- competitor information;
- support needed;
- tomorrow priorities.

### 7.8 Manager console

Managers see:

- team map/status where policy permits;
- today's schedule completion;
- missed check-ins;
- overdue follow-ups;
- new valid leads;
- funnel movement;
- collection activity;
- abnormal field events;
- workload balance;
- target forecast.

## 8. Core New Entities

LeadSource
LeadRawEvent
Lead
LeadQualification
LeadDuplicateCase
PublicPoolEntry
LeadAssignment
OwnershipHistory
SalesActivity
FieldTask
FieldSchedule
AttendanceEvent
LocationEvent
Visit
VisitEvidence
DailyReport
WeeklyPlan
WorkException
Campaign
Exhibition
BusinessTrip
OrderChannel
OrderIngressEvent
CanonicalOrder
OrderSourceLink
OrderValidation
OrderHold
OrderRelease
RoleTemplate
MenuPermission
ActionPermission
RolePermission
UserPermission
DataScopePolicy
FieldAccessPolicy
PermissionAudit

## 9. Integration with Existing Blueprint

Customer 360 adds acquisition source, ownership history and sales activity timeline.

Order 360 adds source channel, canonicalization, validation and hold/release history.

Employee 360 adds schedule, attendance, location events, visits, valid lead production, funnel movement and workforce-risk indicators.

## 10. Engineering Red Lines

1. Parent menu permission cannot grant leaf business access.
2. Hidden frontend menu never replaces backend authorization.
3. Raw internet/social leads cannot enter salesperson ownership without qualification and duplicate screening.
4. Customer ownership transfer must be versioned and auditable.
5. No channel bypasses the Canonical Order lifecycle.
6. No direct production release from an external channel payload.
7. Attendance alone is not counted as productive work; evidence must link to actual tasks/customer/business objects.
8. GPS anomalies are risk signals, not automatic disciplinary conclusions.
9. Salesperson cannot confirm bank receipt or alter official company collection accounts.
10. Sales commission is derived only from governed orders, payments and policy versions.

## 11. Acceptance Scenarios

A. Social-media lead -> qualification -> public pool -> assignment -> salesperson acceptance -> opportunity -> order -> payment -> commission.

B. Duplicate leads from website and WhatsApp merge without creating two customers.

C. Regional sales user sees only atomic sales/field menus and assigned-region data; direct unauthorized URL/API is rejected.

D. Sales manager sees team functions but cannot access finance/system configuration without explicit atomic grants.

E. Dealer order enters Order Hub, is normalized, passes technical/price/credit checks and becomes the same Sales Order model as a direct sales order.

F. Field salesperson receives daily schedule, checks in, completes customer visit with evidence, updates opportunity and submits AI-assisted report.

G. Suspicious attendance/location pattern creates a workforce risk event for manager review with complete evidence trail.

H. Employee leaves company and all active customers/opportunities/tasks transfer without losing ownership history.
