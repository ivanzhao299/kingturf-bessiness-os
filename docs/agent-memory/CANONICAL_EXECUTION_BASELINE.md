# KingTurf Canonical Execution Baseline

Updated: 2026-08-22 Asia/Shanghai

This file is the single authoritative execution route. `MASTER_DEVELOPMENT_PLAN.md` owns product milestones; this file owns current ordering and release evidence. Older cron reports and KT-T2 notes are historical evidence, not parallel roadmaps.

## Current baseline

- Repository: `ivanzhao299/kingturf-bessiness-os`
- Branch: `main`
- Production: Park isolated runtime at `erp.kingturf.cn`, Compose project `kingturf-erp-production`, web port `4332`.
- Office 204 is a historical preview environment and is not the production acceptance target.
- KT-L01 through KT-L15 remain capability-complete. Their production acceptance is rechecked by `KT-RG01`; this does not reopen them as duplicate development routes.

## Only valid execution order

1. `KT-GOV-01`: close repository, ingress verification and Feishu delivery governance.
2. `KT-RG01`: reaccept Sales-to-Cash and KT-L02 through KT-L15 against the current production release, including happy path and policy rejections.
3. `KT-L16`: close quality/WMS with production evidence.
4. `KT-L17` through `KT-L25`: continue the master roadmap in numeric order.

## Completion gate

Every task requires one immutable commit SHA, supported tests, PostgreSQL evidence where applicable, permissions and rejection paths, production deployment SHA, `/health`, `/ready`, authenticated business UAT, rollback notes, and a Feishu receipt. CI, deployment and UAT are reported separately. No task advances on self-report alone.

## Feishu closure

One canonical 30-minute KingTurf inspection job is responsible for status delivery. A successful cycle must record delivered status; a failed delivery alerts immediately. Duplicate KingTurf inspection jobs remain disabled.
