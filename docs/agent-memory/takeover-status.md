# KingTurf Takeover Status

Updated: 2026-10-08 Asia/Singapore. Current task: Batch2 integration, Batch2.5 CI Gate Recovery, Batch3 Source and Nested Authorization. Worktree `/home/jinhuit/Kingturf/kingturf-bessiness-os`, branch `codex/batch3-source-nested-authorization`. Continue from NEXT; do not repeat Discovery.

## CURRENT_STATUS

Batch1 [PR31](https://github.com/ivanzhao299/kingturf-bessiness-os/pull/31), Batch2 [PR32](https://github.com/ivanzhao299/kingturf-bessiness-os/pull/32), CI-only [PR33](https://github.com/ivanzhao299/kingturf-bessiness-os/pull/33) are OPEN, unmerged, independently green at their latest heads. main remains `9d89c7d6739454345b1397fe6b02c945fbe1cb99`; no production mutation/deployment. Batch3 final code `7562baf83a0d5b65d12fdedade511607e88136db` locally validated and independently reviewed, not pushed/Hosted tested.

| Batch | Latest head / base                                                         | Current evidence                                                     |
| ----- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1     | f7489e77cd059d37e049c70685e4025de0187cb5                                   | Hosted37790721061 PASS369/369, release38/38                          |
| 2     | 8cbe6deb8efcd0d650007972c7b0516ea18cca87; independent original base9d89c7d | Hosted37795523187 PASS357/357; initial historical failure retained   |
| 2.5   | ab26c6ebff7a4524a205f3a1ec92959a35c97f94; code58fe039                      | Hosted37795089674 PASS331/331; CI fixtures only                      |
| 3     | code7562baf; BASE58fe03930e47f4f24804db88518be3dabb093d6f                  | local full350/350, targeted59/59 including19 real HTTP, browser23/23 |

Batch3 depends on the unmerged CI-only PR33 checkpoint, contains no Batch1/2 source. Review its authorization diff against58fe039; disclose and update baseline through normal integration before standalone Hosted acceptance. Historical reports retain their original commit-scoped results.

Current evidence: [Batch2 PR integration](../evidence/BATCH2_PR_INTEGRATION_REPORT_20261008.md), [CI Gate Recovery](../evidence/BATCH25_CI_GATE_RECOVERY_REPORT_20261008.md), [Batch3 authorization](../evidence/BATCH3_AUTHORIZATION_REPORT_20261008.md), [machine verification](../evidence/BATCH3_VERIFICATION_20261008.json), [issue matrix](project-issue-matrix.md). [CANONICAL_EXECUTION_BASELINE](CANONICAL_EXECUTION_BASELINE.md) remains intact.

## COMPLETED

- Historical takeover c14101d:324/326 tests,70 migrations/repeat,21 mock browser cases and public health/readiness/version PASS at that checkpoint. [Original report](../evidence/PROJECT_TAKEOVER_REPORT_20261008.md)/[baseline](../evidence/CURRENT_BASELINE_20261008.json) retained, not current production evidence.
- Batch1 code61617c/docs2d5a008 retained: pinned trusted main-history release SHA, shared non-canceling deployment lock, backup-before-sync and probe-gated marker. Initial Hosted37770650651 historical Web failure retained; CI patch cherry-picked normally, latest independent quality PASS.
- Batch2 codee76cb1e/docs01fe23b retained: existing opaque PostgreSQL sessions, self/admin password change revokes all target sessions, consistent login/reset locks, password/revoke/success-audit atomic. Pre-push security87/87 rechecked; true HTTP two-instance/transaction/concurrency coverage. No refresh flow (N/A), no migration/global logout.
- Batch2.5 code58fe039 fixes the test DOMTokenList contract with meaningful overdue assertions and controlled clock; CAPA fixture uses database-relative chronology with +1/-1/0 microsecond and timezone assertions. Preserved checks/triggers/assertions. Web bootstrap87/87, CAPA4/4, complete local331/331 and final Hosted331/331.
- Batch3 sources independently enforce capability/scope/anchors/fields and entry intersection; nested legal event/evidence/manifest and mutation response require independent read authorization; UI aligns with parent/child capability. Corrected nonexistent organization scope columns using existing CRM policy, no schema change.
- Final Batch3 complete pnpm ci:local PASS: API158/Web110/shared82=350/350; all8 workspace lint/typecheck/build, format/frozen install/manifest/test DB guard/70 migrations/dependency audit. Targeted59/59 includes19 native-server HTTP cases with real PostgreSQL/RBAC; browser21 original+2 permission-response replay PASS. No skip or new regression.
- Read-only independent security reviews and latest GitHub GET completed; feature pushes triggered no production workflow. No force push, merge, production SQL/config/secrets or protection changes.

## IN_PROGRESS

Batch3 source checkpoint complete; evidence/documentation checkpoint and final clean-tree verification. All three PRs await independent human review. Batch3 PR/Hosted integration pending with explicit PR33 dependency.

## BLOCKERS

- GitHub main protected=false, rulesets/effective rules empty; production protection_rules empty, deployment_branch_policy null. Default Actions permission GET403 remains NOT_VERIFIED. Administrator authorization/configuration required; code guards cannot replace repository/environment protection.
- All release/auth/authorization fixes remain feature-only; main/production retain the previous behavior. Batch3 Hosted CI not run; do not borrow other branches' PASS.
- Production schema/backup/restore/attachments, external integration and actual multi-role UAT not verified. Physical stock/production/shipment lifecycle not newly populated in Batch3 tests.
- KT-011/012/013 runtime/proxy/startup migration governance deferred. No production P0 confirmed in scoped synthetic tests; no comprehensive certification.

## NEXT

1. Obtain independent review of PR33/31/32, then integrate only through separately authorized normal PR process; no bypass or force push. CI patches already exist on each feature and each latest head is green.
2. Disclose/update Batch3 CI-only baseline, create its independent PR and execute Hosted quality at the actual new head; keep authorization separate from authentication/release code.
3. Seek administrator approval for PR/quality/independent-review/no-force-delete main rules and independent main-only production approvals; verify default Actions policies and restrict old/manual deployment writers.
4. Repair local API dev/start/env/proxy; review migration concurrency and schema/backup/restore/attachment acceptance; complete real business-role UAT before any production release authorization.

## TECH_DEBT

Large app/bootstrap modules remain; no broad rewrite or dependency upgrades. Legacy chronology fixtures repaired incrementally. No refresh/forgot-password flow; future flows must reuse atomic revocation. Production session lookup performance, other dashboard derived-field policy and full shipment UAT remain unverified.

## PRODUCTION_RISKS

No production mutation or deployment. All instances must adopt Batch2 login/reset locking for its concurrency guarantee. Authentication queries begun before revocation commit and already authorized in-flight business requests may finish; new guard queries after commit reject old tokens. Reverting old code restores the safety gap, revoked tokens do not resurrect. Third-party bearer users must reauthenticate after their own password changes. Batch3 restricted fields reduce timeline details intentionally, unlimited roles preserve their permitted evidence. Main is not production-ready until integration, governance and operational gates are satisfied.

```text
BATCH1_PR=OPEN_31
BATCH1_HOSTED_CI=PASS_37790721061
BATCH1_MERGED=NO
BATCH2_PR=OPEN_32
BATCH2_HOSTED_CI=PASS_37795523187
BATCH2_MERGED=NO
CI_GATE_RECOVERY=PASS_PR33_UNMERGED
WEB_HISTORICAL_TEST=FIXED_VALIDATED
CAPA_HISTORICAL_TEST=FIXED_VALIDATED
FULL_CI=PASS_LOCAL_BATCH3_350/350
BATCH3_STATUS=COMPLETE_LOCAL_CHECKPOINT_NOT_PUSHED
ORDER360_SOURCE_SCOPE=PASS_TARGETED_HTTP
LEGAL_NESTED_AUTHORIZATION=PASS_TARGETED_HTTP
TENANT_ISOLATION=PASS_SYNTHETIC_HTTP
AUTHORIZATION_TESTS=59/59_HTTP19_BROWSER2
NEW_REGRESSIONS=0
MAIN_BRANCH_PROTECTION=MISSING_ADMIN_ACTION_REQUIRED
PRODUCTION_ENVIRONMENT_PROTECTION=MISSING_ADMIN_ACTION_REQUIRED
PRODUCTION_MUTATION=NO
PRODUCTION_DEPLOYMENT=NO
READY_FOR_PR=YES
READY_FOR_PRODUCTION_RELEASE=NO
NEXT=INDEPENDENT_PR_REVIEW_BATCH3_HOSTED_THEN_RUNTIME_RESTORE_UAT
```

## Historical integration update (superseded by current status above)

## 2026-10-08 Integration and gate recovery update

Batch2 PR32 is now OPEN (previous no-push statements above are historical checkpoint01fe23b). Pre-push trueHTTP/security87/87 rechecked; initial Hosted37789585670 failed historical Web. Separate CI-only checkpoint58fe039 was normally cherry-picked to e609514; Hosted37790728699 PASS,357/357 workspace tests, complete quality. Batch1 PR31 independently PASS at f7489e7/run37790721061,369/369; CI recovery PR33 independently PASS at58fe039/run37790678497. No merges/force pushes/production writes/deploys/protection changes. New integration documentation requires latest-head CI verification. Batch3 independent work continues from CI-only58fe039; its authority/fields/tenant tests and checkpoint must remain separate. See [Batch2 PR integration](../evidence/BATCH2_PR_INTEGRATION_REPORT_20261008.md). Original historical status and reports remain valid for their recorded commits.
