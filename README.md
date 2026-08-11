# KingTurf Business OS

金特夫（山东）人造草坪有限公司智能经营、生产与风险控制平台。

## Product Positioning

KingTurf Business OS is an end-to-end operating system for the artificial turf business, covering customer acquisition, CRM, technical requirements, product configuration, costing, CPQ, credit, contracts, sales orders, production, quality, warehouse, delivery, accounts receivable, collection, commissions, performance, evidence, risk and AI-assisted management.

Core business chain:

`Lead -> Customer -> Opportunity -> CTR -> Technical Solution -> Cost Sheet -> Quote -> Credit -> Contract -> Sales Order -> Production -> Quality -> Shipment -> AR -> Payment -> Commission -> Order P&L -> Close`

## Engineering Principles

- One Business Order ID across the full lifecycle.
- Normal business flows automatically; exceptions trigger approvals.
- Payments are confirmed from finance/bank data, not by sales staff.
- Production and shipment are blocked when contract, credit or payment gates fail.
- Policies, pricing, commissions and approvals are versioned rule-engine objects, not hard-coded logic.
- Core business records are auditable and cannot be silently deleted.
- Customer 360, Order 360 and Employee 360 are primary product views.
- AI observes, analyzes, recommends, creates tasks, tracks execution and escalates; high-risk decisions remain governed by rules and permissions.

## Delivery Phases

- P0 Foundation
- P1 Sales-to-Cash
- P2 Production & Cost
- P3 Delivery & Evidence
- P4 People & Performance
- P5 AI Business Brain

Engineering specifications live under `docs/engineering/` and executable delivery tasks under `docs/tasks/`.
