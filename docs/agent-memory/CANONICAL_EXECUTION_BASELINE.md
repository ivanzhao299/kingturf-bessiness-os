# KingTurf Canonical Execution Baseline

Updated: 2026-08-22 Asia/Shanghai

This file is the single authoritative execution route. `MASTER_DEVELOPMENT_PLAN.md` owns product milestones; this file owns current ordering and release evidence. Older cron reports and KT-T2 notes are historical evidence, not parallel roadmaps.

## Current baseline

- Repository: `ivanzhao299/kingturf-bessiness-os`
- Branch: `main`
- Production: Park isolated runtime at `erp.kingturf.cn`, Compose project `kingturf-erp-production`, web port `4332`.
- Office 204 is a historical preview environment and is not the production acceptance target.
- KT-L01 through KT-L16 are capability-complete and production-reaccepted through `KT-RG01` at release `452ced1` on 2026-08-22.
- `KT-RBAC-UAT-01` is complete at release `0cbe8f203ad3285874a7ce2d9ef643ba50ba8520`: 38 atomic roles, 214 least-privilege grants, eight hard segregation-of-duties rules, and 38/38 production role UAT passes.
- `KT-L17` is capability-complete and production-accepted at release `266ccdfdfe89d35e9a24f477d77ce6d3cb107403`: actual manufacturing cost policy, immutable calculation snapshots, variance, independent approval and close gate; production UAT is recorded in `docs/evidence/KT-L17_ACTUAL_MANUFACTURING_COST_20260822.md`.

## Only valid execution order

1. `KT-GOV-01`: close repository, ingress verification and Feishu delivery governance.
2. `KT-RG01`: completed; Sales-to-Cash and KT-L02 through KT-L15 passed production data and authenticated UAT.
3. `KT-L16`: completed; incoming inspection, quarantine/release, production consumption and batch traceability passed production evidence.
4. `KT-RBAC-UAT-01`: completed; atomic role catalogue, segregation guards and production role UAT are recorded in `docs/evidence/KT_RBAC_ATOMIC_ROLE_UAT_20260822.md`.
5. `KT-L17`: completed; actual manufacturing cost and variance production UAT is delivered.
6. `KT-L18`: next active long task—shipment release and logistics proof of delivery (56h).
7. `KT-L19` through `KT-L25`: continue the master roadmap in numeric order.

## Completion gate

Every task requires one immutable commit SHA, supported tests, PostgreSQL evidence where applicable, permissions and rejection paths, production deployment SHA, `/health`, `/ready`, authenticated business UAT, rollback notes, and a Feishu receipt. CI, deployment and UAT are reported separately. No task advances on self-report alone.

The GitHub-hosted runner's cross-border HTTPS probe is advisory because that route is reset upstream even when the same release passes local Nginx TLS and real China browser traffic. It must remain visible as a warning, but production acceptance uses verified Nginx HTTPS, certificate/SNI, health/ready, release SHA and real browser access; the advisory probe alone cannot overturn those controls.

## Feishu closure

One canonical 30-minute KingTurf inspection job is responsible for status delivery. A successful cycle must record delivered status; a failed delivery alerts immediately. Duplicate KingTurf inspection jobs remain disabled.
