# KingTurf Takeover Status

Updated: 2026-10-08 Asia/Singapore. Current task: Batch 1 Hosted CI integration and Batch 2 Authentication Session Revocation & Atomic Audit. Worktree `/home/jinhuit/Kingturf/kingturf-bessiness-os`, branch `codex/batch2-auth-session-revocation`. Primary agent executes; independent agents review read-only.

## CURRENT_STATUS

Batch 1 [PR #31](https://github.com/ivanzhao299/kingturf-bessiness-os/pull/31) OPEN at `2d5a00838496cbb6200d4189fcffe41b3123d77d`; Hosted [run 37770650651](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/37770650651) quality FAIL from the historical Web test. Release tests 38/38 pass in Hosted CI. Not merged or deployed.

Batch 2 code checkpoint `e76cb1eee5b70f4328ca07a358aab65aab9bbf98` locally verified. Independent BASE_COMMIT/main `9d89c7d6739454345b1397fe6b02c945fbe1cb99`, not stacked on Batch 1; no dependency on its unmerged code/workflow. No Batch 2 push/PR/Hosted CI. Local review ready, production release NO.

Current evidence: [Batch 1 integration](../evidence/BATCH1_INTEGRATION_REPORT_20261008.md), [Batch 2 security](../evidence/BATCH2_AUTH_SECURITY_REPORT_20261008.md), [verification JSON](../evidence/BATCH2_VERIFICATION_20261008.json), [issue matrix](project-issue-matrix.md). Original accepted roadmap in [CANONICAL_EXECUTION_BASELINE](CANONICAL_EXECUTION_BASELINE.md) remains intact.

## COMPLETED

- Historical takeover `c14101d`: original main `9d89c7d`, install/lint/typecheck/format/build/dependency audit PASS; workspace324/326,70 migrations repeated, mock Chromium21/21 and transform API smoke. Public health/readiness/version PASS at that time; not rechecked as current production evidence in Batch 2. [Original report](../evidence/PROJECT_TAKEOVER_REPORT_20261008.md)/[baseline](../evidence/CURRENT_BASELINE_20261008.json) unchanged.
- Batch 1 code `61617c9608af59035117b050e24fd19f2aad8325`, docs `2d5a008`: release SHA/origin/main ancestry/controller pin, cross-job production lock, backup-before-sync, probe-gated marker/cleanup. Historical local362/364 and release38/38; no production changes. [Batch 1 report](../evidence/BATCH1_RELEASE_SAFETY_REPORT_20261008.md) retained as its historical snapshot.
- This round safe PR precheck, push, separate PR and Hosted CI observed. 224/225 tests pass Hosted, Web1 historical FAIL; API/build/audit NOT_RUN in Hosted fail-fast. Feature push/PR triggered no production workflow. main remains9d89c7d.
- Batch 2 existing PostgreSQL opaque sessions retained; self/admin password change revokes all target sessions; current-password verification, tenant/current-session/CAS checks; login/reset serialized with consistent row locks; password/revoke/audit and login/session audit atomic. No migration or global logout.
- Current API security87/87 (HTTP19 across2 real instances,service13,PG/RBAC16,route39); Web10/10; browser original21/21 plus2/2 added expiry/403 UI cases, mocked API only.
- Current all8-workspace lint/typecheck/build, frozen install/format/manifest/dependency audit PASS. Full combined workspace350/352, same2 historical FAIL,26 new tests pass; ci:local stops on Web, full API tested separately160/161. No assertion removal/skip/constraint weakening.
- Two independent read-only security reviews; stale-login failure audit and bounded fixture cleanup suggestions addressed. Diff/credential/scope checks complete; no production/workflow/migration edits.

## IN_PROGRESS

Implementation and local verification complete; documentation checkpoint records evidence and final worktree check. Batch1 is awaiting review/quality recovery. Batch2 is ready for separate review, not integrated. Continue from NEXT; do not restart Discovery.

## BLOCKERS

- KT-009/010: historical Web date/DOM and CAPA date constraints still fail. Hosted Batch1 quality FAIL; cannot claim CI green.
- KT-006/007: source DataScope and nested legal visibility confirmed code/dispatch gaps; real dual-tenant/business impact not production-tested.
- KT-002/003: no main/environment protections found; default Actions permissions403 NOT_VERIFIED; historical workflow reruns/manual writers bypass future controls. Admin changes not authorized.
- KT-005: locally repaired only; main/production still have old password/session/audit behavior. All instances must adopt the new lock protocol for the concurrency guarantee.
- KT-011/012/013: existing dev/start/proxy and startup migration governance issues deferred; transform runtime is tested here, no claim of original dev/start repair.
- Real role UAT, production schema/backup/attachments/restore and upstream login abuse protection still require evidence/accounts/approval. No production mutation or deployment authorized.

## NEXT

1. Batch3: fix Order360 per-source DataScope, legal nested and derived-field visibility with real HTTP/PG multi-role and dual-tenant negative cases.
2. Separate deterministic test batch for KT-009/010 preserving assertions/constraints; restore quality for Batch1 and independent Batch2 review. Batch2 push/PR/Hosted CI remains future work.
3. Admin approval for main reviewer/required quality/force-push/deletion rules and production main-only independent approval; restrict old run/manual deployment paths.
4. Local API dev/start/env/proxy; backup/schema/restore/attachment acceptance; real business and integration UAT before production approval.

## TECH_DEBT

Large app/bootstrap files and legacy test dates remain; improve incrementally after safety. No dependency modernization or broad rewrites. No refresh/forgot-password implementation; any future flow must reuse atomic reset/revocation, not add an inconsistent bypass. Existing sessions index performance under production volume not benchmarked.

## PRODUCTION_RISKS

No deployment or production SQL/settings/secrets changes. main/production keep old release and auth code; P1 authorization, governance and operational blockers remain. Mixed old/new API versions violate new login/reset serialization, and reverting old code restores the safety gap; revoked tokens never resurrect. Already authenticated in-flight business requests can finish. Third-party bearer integrations must reauthenticate after their own password changes; actual inventory not verified. No production P0 confirmed in the scoped evidence, not a comprehensive security certification.

```text
BATCH1_PR_STATUS=OPEN_PR_31
BATCH1_HOSTED_CI=FAIL_HISTORICAL_WEB_TEST
BATCH1_MERGE_STATUS=NOT_MERGED
BATCH2_STATUS=COMPLETE_LOCAL_VALIDATED
BATCH2_BASE_COMMIT=9d89c7d6739454345b1397fe6b02c945fbe1cb99
BATCH2_COMMIT=e76cb1eee5b70f4328ca07a358aab65aab9bbf98
FULL_TEST_BASELINE=350/352_PASS_2_HISTORICAL_FAIL
NEW_REGRESSIONS=0
DATABASE_MIGRATION_REQUIRED=NO
PRODUCTION_MUTATION=NO
PRODUCTION_DEPLOYMENT=NO
READY_FOR_PR=YES
READY_FOR_PRODUCTION_RELEASE=NO
NEXT=BATCH3_SOURCE_AND_NESTED_AUTHORIZATION
```
