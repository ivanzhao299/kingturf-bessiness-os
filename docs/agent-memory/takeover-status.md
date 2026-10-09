# KingTurf Takeover Status — Final release preflight

Updated: 2026-10-09 Asia/Singapore. Current branch `codex/production-release-preflight`; validated source `20ded96e3e7176bb39f3ae036e1890b14e872392`. [Final integration/release report](../evidence/FINAL_INTEGRATION_AND_PRODUCTION_RELEASE_REPORT_20261009.md), [machine evidence](../evidence/FINAL_RELEASE_VERIFICATION_20261009.json). This snapshot supersedes the earlier same-day state below; preserve all historical facts.

## CURRENT_STATUS

Conditional main merge and application deployment are explicitly authorized. Execution is **NO_GO / BLOCKED_RELEASE_GATES**, not an authorization refusal. Actual main/production remain9d89c7d6739454345b1397fe6b02c945fbe1cb99. No PR merged, no production mutation/deployment or protection change. Three independent AI code reviews APPROVE after scoped P1 fixes; independent personnel approval absent. Main/environment protection still missing; connection admin=false.

## COMPLETED

- Read existing reports/status and current Git/GitHub state without Discovery. Original Batch1–4 checkpoints preserved, no user WIP overwritten, no force push/direct main push.
- Release source fixes: test DB guard compatibility; pinned approved public SSH key and curve25519 exchange; read-only mounted-data/live-container/schema preflight; required bind paths; preserved all backups/images; shared Nginx hash checks only, no shared install/reload.
- Production startup/status now SELECT-only and fail closed; explicit migration retained only for authorized dev/test/migration use. No migration SQL or schema added. Read-only DB7 and production-startup4 cases passed.
- PR31 normal feature update to f2286f7806feb2cefdd1a1364cd7f7799840174d; latest Hosted37869370730 PASS387/387. PR32/33/34 unchanged latest heads with prior HostedPASS and reviews[]/threads unresolved0.
- Batch4 branch published at444fdfa85992218fa5ebcab2976879c3774672bc; full local+Hosted37869588268 PASS425/425, original preview base7341f4f explicitly retained. A pure-main PR awaits base integration; preview ancestry was not presented as independent main diff.
- Combined feature source20ded: fresh full `pnpm ci:local` and Hosted37869606128 PASS443/443, all lint/type/format/build/audit and70 isolated migrations. Browser mock/replay26/26, auth nativeHTTP19, authorization nativeHTTP19 and targeted59/59, real dev browser1/1 and production-mode compiled/preview browser1/1 passed. No new regressions or skips.
- Approved SSH alias/fingerprint/hostname and mounted/data verified; Kingturf3 containers healthy/restarts0, actual bind paths and API secret presence only; Phoenix3 containers freshly healthy and untouched. Root~9.4GiB/data~91GiB free; ingress existing hash matches. Public old-version health/ready/version freshly200 at9d89, builtAt33996421402.
- Accessible backup inventory only one historical20260905 DB dump; independent backup directory permission denied (not empty), current config unreadable to SSH account. Transfer and SELECT-only registry attempts timed out, never promoted to PASS. Owned local test services/schema/container/private fixtures/worktrees cleaned after verification; branch checkpoints retained.

## IN_PROGRESS

Concrete code/checkpoint and evidence ready for independent personnel review. Final documentation checkpoint; subsequent work resumes from external gates below. Quality-only Hosted runs completed; production workflow was not dispatched.

## BLOCKERS

- Main protected=false, rulesets/effective main rules empty; production approvals/source policy empty. All four PRs lack independent human approvals; Actions defaults403 NOT_VERIFIED. Administrator-approved minimum protections and qualified personnel reviews required; existing merge authorization does not waive gates.
- Actual production migration/checksum compatibility NOT_VERIFIED (read-channel timeout). Current startup fails closed, so do not discover mismatch by replacing production containers.
- Current DB+attachment+configuration backup/off-host retention, actual isolated restore/RPO/RTO not accepted. Historical dump alone insufficient; transfer failed. Do not bypass filesystem access with Docker privilege or modify Phoenix material.
- Safe app rollback target/drill NOT_VERIFIED: old main runs startup DDL and old session-signing locks; no authorized migration or old-version security race permitted.
- Real-role HUMAN_UAT/provider/closure acceptance pending. Canonical required receipt is not fabricated or sent. Batch4 pure-main PR blocked by unintegrated dependency baseline.

## NEXT

1. Qualified independent reviewer + administrator-reviewed main PR/quality/current-base/review/no-force-delete and production independent main-only approval rules; verify Actions defaults and historical/manual rerun restrictions. Do not ask again for already granted merge/deploy authorization.
2. Sequential approved33→31→32→34, exact HEAD guard each merge, actual newmain SHA/fullCI and remainingbranch update. Retarget34 to main only after33 integration. Then prepare pure Batch4 main PR preserving be6f56b/58602af/444fdfa; rerun exact tree review/Hosted and merge only after gates.
3. Use approved operations ownership/channel for current registry read and current DB/files/config backups. Strict isolated real-material restore, reconciliation, RPO/RTO and no-DDL/session-safe rollback drill. No production schema write or shared-service change authorized implicitly.
4. Revalidate final actual main complete quality/browser/runtime, human UAT/receipt and production gates. Publish concrete GO/NO_GO; formal `Deploy KingTurf Production` only if GO, exact40-character main SHA. Stop risky operations while gates unresolved.

## TECH_DEBT

Legal-only collection UI workflow needs human-role UAT; typed distribution still needs existing transform-types, large app/bootstrap and other field-derived dashboards remain scoped debt. Historical test fixtures repaired, no standards lowered. Migration explicit-write concurrency and older candidate compatibility remain separate governance topics, not new migration authorization.

## PRODUCTION_RISKS

Old main9d89 remains live with previously identified security gaps. Post-change in-flight authentication may finish; post-commit fresh guard rejects revoked tokens. All instances must cut over to new locks together; old-code rollback can reopen login/reset race. No P0 confirmed in synthetic scope; actual production permission acceptance unverified. Backup/restore/rollback/human governance incomplete; READY_FOR_PRODUCTION_RELEASE=NO. Future stabilization observation is planned only, not elapsed/complete.

## Earlier 2026-10-09 snapshot — before final release authorization

# KingTurf Takeover Status

Updated: 2026-10-09 Asia/Singapore. Current branch `codex/batch4-runtime-recovery`, source checkpoint be6f56bd5db8355e08c5b2d841759dcad92c2cd0. No new Discovery; continue from NEXT. The dated 2026-10-08 snapshot below remains historical, not current status.

## CURRENT_STATUS

main is still9d89c7d6739454345b1397fe6b02c945fbe1cb99. PR31/32/33/34 all OPEN/unmerged; each latest Hosted quality is PASS. Independent human reviews are absent and main/environment protections remain missing. Actual integration is not authorized; local preview validation cannot substitute for actual main quality.

Batch3 original7562baf/23c2764 retained, normal CI-base merge9c79da1 and reviewed fixesae8e9f7/e33e414. PR34 head e33e414c1de805714af6641c274723e56ef53482 targets PR33 headab26c6e until its main integration; Hosted37855253180 PASS350/350. Parent collection lifecycle state is intentionally visible under collection permission; independent legal records/metadata remain protected. Unavailable legal queue counts now hide instead of misleading zero; field-masked currency renders safely.

Final local integration previewa83c93311ea2dca2e605eaf018f2c03991357675 merged33→31→32→34 from unchangedmain; source conflicts0, documentation conflicts resolved from newer checkpoint preserving historical evidence; full414/414 PASS. Not pushed or mergedmain. Batch4 baseline7341f4f729878fb912c6f404d61b49f518455a2d contains that unmerged preview, explicitly disclosed; sourcebe6f56b only8 runtime/config/test/doc files. Batch4 not pushed/Hosted.

Current evidence: [PR integration readiness](../evidence/PR_INTEGRATION_READINESS_REPORT_20261009.md), [Batch3 Hosted](../evidence/BATCH3_HOSTED_CI_REPORT_20261009.md), [Batch4 runtime](../evidence/BATCH4_RUNTIME_RECOVERY_REPORT_20261009.md), [business UAT](../evidence/CORE_BUSINESS_UAT_MATRIX_20261009.md), [production gaps](../evidence/PRODUCTION_READINESS_GAP_REPORT_20261009.md), [machine verification](../evidence/PROJECT_STABILIZATION_VERIFICATION_20261009.json), [issue matrix](project-issue-matrix.md). Original canonical roadmap and baseline reports preserved.

## COMPLETED

- Re-read existing reports/AGENTS context and verified clean initial tree/checkpoints, remote/main, latest PR heads/reviews/files/threads/mergeability/checks. PR31 f7489e7/run37790721061 PASS369; PR32 8cbe6de/run37795523187 PASS357; PR33 ab26c6e/run37795089674 PASS331; all unmerged.
- Identical Web/CAPA patch stable-id verified on all3 branches; no source conflicts in actual local combined tree. Normal merges retained history, no force push/rebase/reset. Future main merge order33→31→32→34.
- Independent Batch3 security review;19 real HTTP and59 targeted passed, final Web110/110/lint/type/build;3 permission-response replay browser cases passed. Hosted finalhead350/350, all quality checks passed. No new migration or privilege expansion.
- Runtime dev/start transform-types, native root.env loading with injected environment precedence, DB local commands documented explicitly; CI DB uses injected environment, Vite separately reads local proxy/port settings; dev/preview proxy+loopback binding and target guard. Current production Docker CMD and exports unchanged. Runtime test/config included in root lint without relaxing existing TS rules.
- Actual browser login→customer create201→UIquery→PG tenant/PROSPECT and successaudit, anonymous401/noar403:1/1 dev and1/1 compiled preview. Compiled API ran NODE_ENV=production only on owned local synthetic DB. Final Batch4 complete pnpm ci:local PASS414/414 (release38,API180,Web114,shared82);26 legacy/auth/permission browser regression cases passed. Negative remote/DB/opt-in guards reject before HTTP. Real business human UAT remains NOT VERIFIED.
- Public production GET health/ready/version freshly PASS at9d89c7d/builtAt33996421402. No production mutation/deployment/protection changes. Existing internal backup/schema/files/restore facts not available.

## IN_PROGRESS

Implementation/verification complete; owned test resources and private credentials cleaned, API/Web stopped after actual validation. Documentation checkpoint and final clean-tree verification. AllPRs need independent human review and protection/merge authorization. Batch4 source patch is independently reviewable against its disclosed unmerged baseline.

## BLOCKERS

- main protected=false, rulesets/effective rules empty; production approvals/source policy empty. Default Actions permissions403 NOT_VERIFIED. Administrator-approved configuration and independent review needed; current GitHub CLEAN is not sufficient.
- No explicit main merge authorization. All security fixes feature-only; PR34 base is PR33 feature and must not be merged there. After33 main integration, retarget/update34 and run Hosted against exact newmain; every main merge requires fullquality recheck.
- Backup metadata/checksums/off-host retention, actual migration state, mounted disk/files/attachments and DB+files restore/RPO/RTO NOT VERIFIED; publicready only SELECT1.
- Actual multi-role UAT/external signature/bank/document provider acceptance NOT VERIFIED. Physical shipment lifecycle still not newly populated. Batch4 Hosted NOT_RUN, its local combined baseline not actualmain.

## NEXT

1. Obtain administrator approval/configuration for minimum main PR+quality+independent reviewer+no-force-delete, production independent main-only approvals, and read current Actions defaults; restrict historical/manual deployment writers.
2. Independent human review and separate explicit merge authorization, sequential33→31→32→34. Record each actualmain SHA, completeCI, diff and remainingbranch updates; retarget34 to main only after approvedbase integration. Do not use preview414 as substitute.
3. After base integration, prepare separate Batch4 PR from precise main (normal cherry-pick/update preserving sourcebe6f56b), disclose dependencies and run Hosted; no production deployment inferred.
4. Freeze acceptedUAT SHA, arrange scoped role accounts/deidentified samples/isolated environment and execute coreUAT matrix; approve isolated DB+files restore/rollback drill plan. Record human acceptance separately before production approval.

## TECH_DEBT

KT-013 startup migration/status DDL/concurrency/checksum governance unchanged; investigate safely in next scoped engineering batch. Existing workspace sourceTS exports mean compiled API still needs transform-types; not pureJS distribution. Historical local UI environment badge still hardcodes production domain. Full shipment/UAT/provider and other dashboard field-derived statistics remain unverified. No modernization/broad rewriting.

## PRODUCTION_RISKS

Production remains oldSHA9d89c7d with release/auth/authorization gaps despite current feature successes. No P0 confirmed in scoped synthetic tests, no security certification. Batch2 multi-instance login/reset locks require every API version aligned; already authenticated in-flight requests may finish, post-commit guard queries reject revokedtokens; rollback oldcode restores gap, does not resurrectrevokedtokens. Before any production mutation separately confirmACTION/IMPACT/ROLLBACK/VERIFICATION, actualSHA, backup/migration/files/health/UAT. READY_FOR_PRODUCTION_RELEASE=NO.

```text
MAIN_HEAD=9d89c7d6739454345b1397fe6b02c945fbe1cb99
PR31_STATUS=OPEN_HOSTED_PASS_UNMERGED_NO_HUMAN_REVIEW
PR32_STATUS=OPEN_HOSTED_PASS_UNMERGED_NO_HUMAN_REVIEW
PR33_STATUS=OPEN_HOSTED_PASS_UNMERGED_NO_HUMAN_REVIEW
PR_INTEGRATION_ORDER=33_31_32_34
MAIN_PROTECTION=MISSING
HOSTED_CI=PASS_EACH_PR_31_32_33_34
BATCH3_BASE_COMMIT=ab26c6ebff7a4524a205f3a1ec92959a35c97f94_PR33_UNMERGED
BATCH3_PR=OPEN_34
BATCH3_HOSTED_CI=PASS_37855253180_350/350
BATCH3_SECURITY_REVIEW=INDEPENDENT_READONLY_PASS_HUMAN_REVIEW_PENDING
BATCH3_NEW_REGRESSIONS=0
BATCH4_STATUS=COMPLETE_LOCAL_CHECKPOINT_NOT_PUSHED
API_DEV_START=PASS_REAL_LOCAL
API_PRODUCTION_BUILD_START=PASS_LOCAL_NODE_ENV_PRODUCTION
WEB_API_PROXY=PASS_DEV_PREVIEW_LOOPBACK
REAL_WEB_API_LOGIN=PASS_REAL_BROWSER_DEV_AND_BUILD
BUSINESS_UAT=AUTOMATED_SYNTHETIC_VERIFIED_HUMAN_NOT_VERIFIED
BACKUP_RESTORE_VERIFIED=NO
ROLLBACK_READY=PLAN_ONLY_NOT_VERIFIED
PRODUCTION_MUTATION=NO
PRODUCTION_DEPLOYMENT=NO
READY_FOR_NEXT_BATCH=YES
READY_FOR_PRODUCTION_RELEASE=NO
NEXT=PROTECTION_AND_HUMAN_REVIEW_AUTHORIZED_SEQUENTIAL_INTEGRATION_THEN_BATCH4_PR_RESTORE_UAT
```

## Historical snapshot — 2026-10-08

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
