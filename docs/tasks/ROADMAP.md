# KingTurf Business OS — Engineering Roadmap

长期节点、倒计时、工时和统一验收门槛见
[`MASTER_DEVELOPMENT_PLAN.md`](../engineering/MASTER_DEVELOPMENT_PLAN.md)。

## Execution Rule

Development follows ordered phases. Do not start feature sprawl before the preceding foundation gates pass.

Each Epic is decomposed into implementation tasks covering, where applicable:

- domain model
- database migration
- repository/data access
- service/application logic
- state machine
- API
- RBAC/DataScope
- audit log
- domain events
- frontend
- tests/E2E
- documentation

## P0 — Foundation

- JTF-P0-E01 Repository & Monorepo Bootstrap
- JTF-P0-E02 Environment & Configuration
- JTF-P0-E03 Database Foundation
- JTF-P0-E04 Organization & Employee
- JTF-P0-E05 Authentication
- JTF-P0-E06 RBAC + DataScope
- JTF-P0-E07 Master Data Foundation
- JTF-P0-E08 Number Generator
- JTF-P0-E09 Audit Trail
- JTF-P0-E10 Workflow & Approval Engine
- JTF-P0-E11 Rule Engine Foundation
- JTF-P0-E12 Notification Center
- JTF-P0-E13 File/Attachment Service
- JTF-P0-E14 Event Bus / Domain Events
- JTF-P0-E15 Business Object Registry
- JTF-P0-E16 Observability / Error Handling
- JTF-P0-E17 CI Quality Gates

## P1 — Sales-to-Cash

- JTF-P1-E01 Customer Master
- JTF-P1-E02 Lead Pool
- JTF-P1-E03 Customer Assignment
- JTF-P1-E04 Customer 360
- JTF-P1-E05 Opportunity
- JTF-P1-E06 CTR
- JTF-P1-E07 Technical Solution Lite
- JTF-P1-E08 Cost Engine v1
- JTF-P1-E09 Sales Policy Engine
- JTF-P1-E10 CPQ / Quote
- JTF-P1-E11 Credit Management — delivered in the immutable E11-E17 Quote-to-Cash boundary
- JTF-P1-E12 Contract Center
- JTF-P1-E13 E-Sign Integration
- JTF-P1-E14 Sales Order
- JTF-P1-E15 AR
- JTF-P1-E16 Bank Payment
- JTF-P1-E17 Reconciliation — delivered with canonical ordering and retained replay results
- JTF-P1-E18 Commission Engine — planned in KT-L08
- JTF-P1-E19 Order 360 — planned in KT-L09
- JTF-P1-E20 Risk Engine v1 — planned in KT-L10
- JTF-P1-E21 Executive Cockpit — planned in KT-L11

## P2 — Production & Cost

- Product/SKU/BOM/Routing
- Supplier & Purchasing
- Material Inventory
- MRP
- Production Demand
- Production Order
- Work Order
- Material Issue / Consumption
- Work Reporting
- Batch & Finished Roll
- Quality
- WMS
- Actual Manufacturing Cost
- Cost Variance

## P3 — Delivery & Evidence

- Shipment Release Control
- Logistics
- Delivery Receipt
- Reconciliation
- Collection Workflow
- Legal Case Handoff
- Evidence Timeline
- Debt Evidence Package
- Complaint
- NCR/CAPA

## P4 — People & Performance

- Targets
- KPI
- Visits
- Daily Reports
- Business Trips
- Exhibitions
- Expenses
- Employee 360
- Advanced Commission
- Team Performance

## P5 — AI Business Brain

- AI Daily Business Brief
- Sales Agent
- Credit Agent
- Production Agent
- Cost Agent
- Collection Agent
- Management Agent
- Risk Prediction
- Cash Prediction
- Delivery Delay Prediction
- Auto Task
- Escalation

## First Execution Target

Start with `JTF-P0-E01 Repository & Monorepo Bootstrap`.

Do not implement CRM feature code before P0 architectural choices, repository structure, database foundation, auth/RBAC, audit and rule/approval foundations have explicit acceptance criteria.
