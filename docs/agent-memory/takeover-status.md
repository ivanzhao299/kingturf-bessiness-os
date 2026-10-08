# KingTurf Takeover Status

Updated: 2026-10-08 Asia/Singapore. Task: repository takeover discovery. Runner: Codex primary with read-only scout/reviewer support. Worktree: `/home/jinhuit/Kingturf/kingturf-bessiness-os`; branch: `codex/project-takeover-baseline`.

Code baseline: `9d89c7d6739454345b1397fe6b02c945fbe1cb99`, identical to remote main and the production public version observed this session. A documentation checkpoint does not change the tested code SHA.

Evidence: [PROJECT TAKEOVER REPORT](../evidence/PROJECT_TAKEOVER_REPORT_20261008.md), [CURRENT BASELINE](../evidence/CURRENT_BASELINE_20261008.json). Historical roadmap and accepted milestones remain in [CANONICAL_EXECUTION_BASELINE](CANONICAL_EXECUTION_BASELINE.md); this status supplements current engineering facts, without claiming new production acceptance.

## CURRENT_STATUS

Discovery complete. Current CI is not green, despite the September historical success. Production public health/readiness/version pass; production database, backup recovery and authenticated business acceptance are unverified. Business code and production resources were not changed.

## COMPLETED

- Repository/Git/architecture/runtime/CI investigation and three independent read-only audits.
- Frozen dependency install; format, capability manifest, lint, typecheck, build and production dependency audit pass.
- Disposable loopback PostgreSQL 17.7: all 70 migrations applied, checksums present, second migrate succeeds.
- All 326 distinct workspace tests executed: 324 pass, 2 fail. Web 104/105; API 138/139; other packages pass.
- Chromium UI regressions 21/21, with mocked APIs and a local browser runner; original Chrome unavailable.
- Local API smoke by production transform mode: health/ready/version and unauthorized request pass.
- Public production health/ready/version reads and GitHub governance queries completed; no external writes.
- Synthetic Order 360 dispatch reproduces nested legal manifest visibility and low-margin inference without corresponding source capabilities. Real source-scope combinations remain to verify.

## IN_PROGRESS

No business-code batch is active. Batch 1 release safety scope is ready for local implementation. Do not restart full discovery next turn; use issue IDs and evidence in the report.

## BLOCKERS

- KT-009: Web fixed date plus incomplete DOM fixture; actual CI failure.
- KT-010: CAPA fixed dates violate preserved database constraints; actual integration failure.
- KT-011/012: documented API dev/start and local Web/API connection fail.
- Real role/business UAT needs dedicated accounts and complete safe fixtures; never infer acceptance from mocked browser tests.
- Production schema/backup/restore/upstream login protection need read-only operational evidence; none obtained this session.

## NEXT

1. Implement proposed Batch 1 on a separate `codex/` branch: exact main SHA validation, safe parameter passing and serialized production workflow. Do not trigger a release.
2. Restore deterministic tests with DOM semantics and relative/controlled clocks; preserve existing assertions and historical migrations.
3. Fix local runtime/environment/proxy with real network smoke and production compatibility checks.
4. Harden credential/session/audit atomicity, then aggregate source scopes/nested legal/derived-field authorization, with independent review.
5. Verify recovery and real multi-role business flows before describing the project as deployable/operable/acceptable.

## TECH_DEBT

Large app/bootstrap files, duplicate UI/scope helpers, some full-list and DOM-text filtering, stale current-status statements. Improve incrementally after safety and usable verification are restored; no framework modernization or historical rewrite is planned.

## PRODUCTION_RISKS

Unvalidated workflow input and no main provenance gate; no queried main/environment protection; no workflow concurrency; startup DDL and non-read-only db:status; backup/attachment/off-host restore evidence missing; credential session revocation and aggregate authorization concerns. No production incident or P0 exploit was established.

`READY_FOR_BATCH_1=YES`

`READY_FOR_PRODUCTION_RELEASE=NO`
