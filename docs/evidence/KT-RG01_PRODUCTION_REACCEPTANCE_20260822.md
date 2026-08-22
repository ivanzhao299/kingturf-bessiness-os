# KT-RG01 Production Reacceptance — 2026-08-22

## Result

KT-RG01 and the KT-L16 production evidence gate passed on the Park production runtime at `erp.kingturf.cn`. The accepted release is `452ced1884be34b83ea22420b058c51513d59ba4`, deployed by GitHub Actions run `32550422573`.

## Evidence

- Local full gate passed against disposable PostgreSQL: 45 migrations, lint, typecheck, 198 tests, production builds, and production dependency audit with no high-severity findings.
- Production seed and verifier passed idempotently. Credit outcomes include `APPROVED`, `REJECTED`, and `EXPIRED` using a separate least-privilege approver.
- Sales-to-Cash evidence: issued quote, signed contract, released order `SO-KT-P1-DEMO`, CNY 950,000 receivable, two fully allocated payments, zero open balance.
- Commission evidence: CNY 28,500 and immutable states `ACCRUED → FROZEN → RELEASED → PAID → CLAWED_BACK`.
- Order 360 evidence: 18 timeline events, seven governed sections, and zero active anomalies.
- Manufacturing evidence: six MRP proposals; closed production order; three operations/reports; material issue and return-control transactions; one produced roll.
- Quality/WMS evidence: published incoming plan, sampled inspection with recorded result, disposition evidence, yarn lot released before production consumption, and batch traceability visible in production.
- Authenticated browser UAT passed at 390 px: route isolation shows only `quality-workbench`, page width equals viewport width, horizontal module navigation is visible, and the production environment label is correct.
- Production `/health`, `/ready`, Nginx HTTPS/SNI and deployment checks passed. The hosted-runner public HTTPS probe remains advisory under the documented cross-border reset policy.

## Repairs included

- Granted commercial COMPANY scope to both bootstrap administrator role variants.
- Made the production seed resume correctly across API response naming and quality-state transitions.
- Restored route isolation by enforcing the HTML `hidden` contract.
- Moved commercial workbenches into the bounded page workspace, removed mobile overflow, and exposed a 44 px horizontal mobile navigation rail.

## Rollback

Application rollback uses the previous immutable release SHA through the same production workflow. Migration `0045` only adds role grants and can be reversed by deleting its exact role-permission-scope rows if required. Seed evidence is deliberately immutable; do not delete it as a rollback mechanism.

## Next production-standard task

Start `KT-L17` (64h): actual manufacturing cost and variance. Exit evidence must reconcile planned versus actual material, labor and overhead by production order; explain variances; preserve frozen source snapshots; expose role-scoped drilldowns; cover rejection/idempotency/concurrency paths; pass desktop/mobile authenticated UAT; deploy by exact SHA; and publish a Feishu receipt.
