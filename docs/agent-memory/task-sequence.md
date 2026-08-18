# Long Task Sequence

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
- 204 deployment and UAT must be retried through the existing route; the last probe timed out at SSH `192.168.2.204:22` and found no local tunnel on `127.0.0.1:14331`. Do not treat this as a code failure or reopen the website work.
- Architecture/management/UI blueprint is now fixed in `docs/engineering/OPERATING_MODEL_AND_ROLE_CATALOG.md`. Every next task must pass the three reviews (architecture, enterprise management, frontend/product) and implement role ownership, server-side permission gates, business-object traceability, responsive work queues and evidence.
- L02 execution order: CRM/Customer 360 → CTR/solution → cost/quote → credit/contract/order → AR/payment → one-order proving ground. The acceptance target is a complete seeded order with success, low-margin rejection, insufficient-credit rejection, missing-contract rejection and overdue-shipment rejection.

Do not advance on a self-reported completion; require a repository SHA and evidence entry.

## Two fixed long tasks (2026-08-17 22:35 Asia/Shanghai)

### KT-T1 — Studio → Office 204 deployment recovery

- Scope: ERP only; the website is permanently excluded.
- Preserve: original repository, `main`, worktree, and all existing Memory/WIP.
- Repair the server bootstrap/deployment gate, then rerun the existing Studio deployment route.
- Required proof: CI green, deployment job actually executed, deployed SHA matches ERP SHA, `/health` and `/ready` green, public ERP smoke/UAT green.
- A deployment is not successful if any gate is skipped, blocked, or only simulated.

### KT-T2 — Business blueprint implementation continuation

- Start only after KT-T1 is either green or has a recorded operational handoff that does not require code rollback.
- Implement L02 CRM/Customer 360, then CTR/solution, cost/quote, credit/contract/order, AR/payment, and the seeded order proving ground.
- Each slice requires architecture, management, frontend, RBAC, audit, API, tests, commit SHA, and UAT evidence.
- Continue through KT-L16 quality/WMS and the remaining blueprint slices; do not stop after a single commit.

Execution policy: one KingTurf Runner, one task ledger, sequential KT-T1 → KT-T2, heartbeat at least every 15 minutes, minimum continuation window 10 hours. Website messages, legacy Codex windows, and stale cron reports cannot change this sequence.
