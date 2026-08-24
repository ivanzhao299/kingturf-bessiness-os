# Long Task Sequence

> Authoritative current ordering is in `CANONICAL_EXECUTION_BASELINE.md`. The KT-T2 section below is retained as historical scope detail and is folded into `KT-RG01`; it is not a second roadmap.

1. L01: wire navigation to existing workbenches/APIs, URL and refresh recovery.
2. L02: productize P1 sales-to-cash screens.
3. L03: verify one real order end to end.
4. L04: close KT-L16 quality/WMS.
5. L05-L09: cost variance, delivery evidence, collections/CAPA, cockpit, production gates.

Each step requires tests, Validator/Reviewer evidence, commit SHA, UAT evidence, and rollback notes before advancing.

## Current execution plan (2026-08-17)

- Gate 0: preserve the existing `main` WIP; run the Web navigation contract tests and record the current SHA.
- Gate 1: implement navigation state, route mapping, active state, and refresh recovery against existing workbenches.
- Gate 2: validate desktop and 390px mobile click flows; then run lint, typecheck, build, and focused/full tests.
- Gate 3: continue P1 Sales-to-Cash as one real order path, with RBAC/DataScope/audit and rejection paths.
- Gate 4: close KT-L16 quality/WMS with inspection, disposition, locations, finished-goods receipt, and traceability.

## Current handoff after L01

- L01 is code-complete for the current scope and is committed as `4f4f432` on `main`; the original worktree is clean and synchronized with `origin/main`.
- Do not wait for or inspect `kingturf.cn` website source. It is outside the ERP task sequence.
- L02 starts immediately: productize the sales-to-cash screens and run one seeded order through Lead → Customer → Opportunity → CTR → Solution → Cost → Quote → Credit → Contract → Order → AR → Payment → Commission, including permissions, rejection paths, and audit evidence.
- Historical deployment retry notes are superseded. All deployment and UAT use the canonical production workflow and `https://erp.kingturf.cn`.
- Architecture/management/UI blueprint is now fixed in `docs/engineering/OPERATING_MODEL_AND_ROLE_CATALOG.md`. Every next task must pass the three reviews (architecture, enterprise management, frontend/product) and implement role ownership, server-side permission gates, business-object traceability, responsive work queues and evidence.
- L02 execution order: CRM/Customer 360 → CTR/solution → cost/quote → credit/contract/order → AR/payment → one-order proving ground. The acceptance target is a complete seeded order with success, low-margin rejection, insufficient-credit rejection, missing-contract rejection and overdue-shipment rejection.

Do not advance on a self-reported completion; require a repository SHA and evidence entry.

## Historical fixed long task (2026-08-19; folded into KT-RG01)

### KT-T2 — Sales-to-Cash productization and one-order proving ground

- Baseline: `main` at `4f19b957fe3ea6ea5247526bf30b02a39ed192e3`, synchronized with `origin/main`; preserve all WIP and branch ownership.
- L01 information architecture, navigation and workbench foundation are complete.
- Business chain: Lead → Customer → Opportunity → CTR → Technical Solution → Cost → Quote → Credit → Contract → Sales Order → Plan/Purchase → Production → Quality → WMS → Delivery → AR → Payment → Commission → Order P&L → Close.
- Execution order: CRM/Customer 360 → CTR/solution → cost/quote → credit/contract/order → AR/payment → one-order proving ground.
- CRM/Customer 360 scope: customers, contacts, ownership, status, lead pool, claim/transfer, conversion, duplicate detection, search/filter/pagination, detail and activity timeline.
- Opportunity/CTR scope: stage, probability, amount, expected close date, next action, loss reason, technical requirements, attachments, approval submission and revision comparison.
- Solution/cost/policy scope: structured specifications, BOM candidates, standard/quote cost, margin/discount policy, version pinning and explainability.
- CPQ scope: line items, quantity, currency, discount, tax, margin, server-side recalculation, validity, revision, approval, signed snapshot and PDF.
- Credit/contract/order scope: limit, exposure, overdue, contract revisions/signatures, quote-to-contract-to-order, release/hold; insufficient credit, low margin and missing contract are hard stops.
- AR/payment scope: receivables, due dates, balances, bank receipts, partial payment and allocation/reconciliation; official receipt totals cannot be manually overwritten.
- One-order acceptance must cover the happy path plus low-margin, insufficient-credit, missing-contract and overdue/risk rejection paths.

### Unified completion gate

Every slice must include requirements/non-goals, migration/rollback, API, RBAC, DataScope, field/action permissions, state machine, idempotency, concurrency, audit, desktop/mobile UI, unit/integration/PostgreSQL/browser E2E, lint/typecheck/build/security evidence, immutable commit SHA, deployment SHA, health/ready, UAT and known limitations. No slice advances on self-reported completion.

### Subsequent queue

- KT-L08 commission engine and immutable ledger: `ACCRUED → FROZEN → RELEASED → PAID`, clawback support.
- KT-L09 Order 360; KT-L10 Risk Engine v1; KT-L11 Management Cockpit.
- KT-L12–KT-L17 SKU/BOM/routing, purchasing/inventory, MRP, production, quality/WMS, actual manufacturing cost.
- KT-L18–KT-L20 shipment gates, logistics, collections/legal evidence, complaints/NCR/CAPA.
- KT-L21–KT-L22 targets, visits, daily reports, expenses, Employee 360 and performance.
- KT-L23–KT-L25 AI business brain, security/operations, backup/recovery, performance, disaster recovery and formal release acceptance.

Execution policy: one KingTurf Runner and one active task ledger; heartbeat at least every 15 minutes; every material slice ends with evidence and an authorized push/release checkpoint. A blocked or approval-bound state must be reported immediately and never silently waited out.
