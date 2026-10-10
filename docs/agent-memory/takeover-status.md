# KingTurf Takeover Status

Updated: 2026-10-08 Asia/Singapore. Task: Batch 1 Release Pipeline Safety Hardening. Runner: Codex primary with read-only scout/reviewer support. Worktree: `/home/jinhuit/Kingturf/kingturf-bessiness-os`; branch: `codex/batch1-release-guardrails`.

Original application baseline: `9d89c7d6739454345b1397fe6b02c945fbe1cb99`, identical to remote main and the production public version rechecked this session. Batch 1 code checkpoint: `61617c9608af59035117b050e24fd19f2aad8325`; business modules remain unchanged. Documentation checkpoints record evidence without implying deployment.

Evidence: [PROJECT TAKEOVER REPORT](../evidence/PROJECT_TAKEOVER_REPORT_20261008.md), [CURRENT BASELINE](../evidence/CURRENT_BASELINE_20261008.json), [BATCH 1 REPORT](../evidence/BATCH1_RELEASE_SAFETY_REPORT_20261008.md), [BATCH 1 VERIFICATION](../evidence/BATCH1_VERIFICATION_20261008.json), [live issue matrix](project-issue-matrix.md). Historical roadmap and accepted milestones remain in [CANONICAL_EXECUTION_BASELINE](CANONICAL_EXECUTION_BASELINE.md); this status supplements current engineering facts, without claiming new production acceptance.

## CURRENT_STATUS

Batch 1 locally validated and checkpointed at `61617c9608af59035117b050e24fd19f2aad8325`; ready for code review. Current local full test gate still fails with the two reproduced historical tests; the Batch 1 GitHub CI has not run. No confirmed P0, but three P1 authentication/authorization issues remain. Production public health/readiness/version rechecked and pass at original main `9d89c7d`; this code is not merged or deployed. GitHub settings and production resources were not changed.

## COMPLETED

- Historical takeover c14101d: discovery, 324/326 tests, 70 migrations, 21/21 mock Chromium UI and transform API smoke; immutable report retained. Browser/local runtime were not rechecked in Batch 1.
- Batch 1: exact lowercase SHA/canonical origin/main ancestry, fixed workflow control, matching verified/deployed SHA, production concurrency and lock-time revalidation implemented.
- Backup before configuration sync, probe-gated atomic release marker, cleanup streamed from trusted control without remote staging; missing/read-failing control fails closed.
- 38/38 release tests pass; current install/format/manifest/lint/typecheck/build/dependency audit pass; actionlint 1.7.12/ShellCheck 0.11.0/PyYAML and shell checks pass.
- All original workspace tests rechecked: 324/326; Web 104/105, API 138/139, other packages pass. With release tests, 362/364 pass; no lowered assertions or skips.
- Real PostgreSQL/API credential probe confirms old session remains authorized after password change; explicit logout invalidates it. Synthetic dispatch confirms source-scope and nested legal read gaps.
- Independent read-only security/deployment review completed; primary validated isolated fixtures. Fresh GitHub audit confirms missing protections; default workflow permissions returned 403 and remain NOT_VERIFIED; public runtime unchanged and healthy.

## IN_PROGRESS

No further implementation is active. Batch 1 is locally complete; no PR/push/merge/deployment performed. Continue from NEXT rather than restarting discovery. Applying GitHub protection recommendations requires separate administrator authorization.

## BLOCKERS

- KT-009: Web fixed date plus incomplete DOM fixture; actual CI failure.
- KT-010: CAPA fixed dates violate preserved database constraints; actual integration failure.
- KT-011/012: documented API dev/start and local Web/API failures from takeover; business source unchanged, not rerun this batch.
- KT-005/006/007: confirmed P1 credential session behavior and authorization gaps; no production P0 exploit demonstrated.
- KT-002/003: external main/environment protection missing; historical workflow reruns/manual SSH are outside the new concurrency contract.
- Real role/business UAT needs dedicated accounts and complete safe fixtures; never infer acceptance from mocked browser tests.
- Production schema/backup/restore/upstream login protection need read-only operational evidence; none obtained this session.

## NEXT

1. Batch 2: credential change/admin identity reset with transactionally revoked sessions and success audit; current-password/reauthentication and frontend relogin compatibility. Real PostgreSQL/API failure and concurrent paths; independent review.
2. Separate source DataScope/legal nested/derived-field authorization fixes with actual role and dual-tenant negative fixtures.
3. Restore deterministic date/DOM tests without weakening assertions, then local API runtime/environment/proxy and real network smoke. Existing gate failures must be cleared before production release.
4. Prepare main/environment protection recommendations for administrator approval; do not apply settings or release without authorization.
5. Verify backup/attachments/restore/schema compatibility and real multi-role business flows before production acceptance.

## TECH_DEBT

Large app/bootstrap files, duplicate UI/scope helpers, some full-list and DOM-text filtering, stale current-status statements. Improve incrementally after safety and usable verification are restored; no framework modernization or historical rewrite is planned.

## PRODUCTION_RISKS

Batch 1 guards exist only in the local review branch; production/main retain the old workflow. External branch/environment protection, old workflow reruns/manual paths, startup DDL/non-read-only db:status, backup/restore/schema compatibility and real UAT remain. Confirmed P1 credential and aggregate authorization gaps are open. Configuration synchronized after a successful dump is not automatically restored on later failure. No production P0 was established.

`BATCH1_STATUS=COMPLETE_LOCAL_VALIDATED`

`BATCH1_COMMIT=61617c9608af59035117b050e24fd19f2aad8325`

`READY_FOR_PR=YES`

`READY_FOR_PRODUCTION_RELEASE=NO`

## 2026-10-10 Final engineering archive verification

Checkpoint `d6d515495a953d5675e829dc0672549fea36a5a7` is preserved and contains the final isolated development/test acceptance report plus direct and Compose HTTP evidence. The evidence files are tracked, non-empty, JSON-valid where applicable, and pass targeted formatting/diff checks. This archive records engineering-scope closure only; the formal production `NO_GO` decision and `PRODUCTION_GO_LIVE_BACKLOG` remain unchanged. No CI/E2E rerun, public-instance change, production database operation, deployment, Phoenix operation, or shared-service change was performed. The archive is submitted from an independent documentation branch for review.
