## 2026-10-10 Final isolated test acceptance — engineering scope closed

[Acceptance report](../evidence/PROJECT_TAKEOVER_DEV_TEST_ACCEPTANCE_REPORT_20261010.md), [HTTP evidence](../evidence/PROJECT_TAKEOVER_DEV_TEST_ACCEPTANCE_HTTP_20261010.json). Final main `3ec6d83c3e12a417dfe7087dd9a7d9fa6fc6d73f` was built and run in a new disposable internal Docker network with PostgreSQL17.7, an owned `runtime_web_final_20261010` schema and synthetic identities/data. API health/readiness/version returned 200 with the exact SHA; Web production preview returned 200; production-mode API startup passed the read-only migration check. Real browser runtime acceptance passed 1/1 before and 1/1 after restart; supplemental real HTTP smoke passed 19/19, including password/session revocation, customer lifecycle/audit, 401/403, Order360/legal denial and cross-tenant filtering. PostgreSQL and API restarts preserved test data. The public KingTurf instance remains old SHA `9d89c7d`; it and Phoenix/shared services were not changed. Test resources are removed after evidence capture. `ENGINEERING_ACCEPTANCE=PASS`; `DEV_TEST_ACCEPTANCE=PASS`; `PROJECT_TAKEOVER_CLOSED=YES_ENGINEERING_SCOPE`; formal production readiness remains deferred.

## CURRENT_STATUS

**ENGINEERING_SCOPE_CLOSED / PRODUCTION_GO_LIVE_DEFERRED**. Final main and an isolated runtime instance are accepted. No public or production deployment occurred.

## COMPLETED

- Exact final main worktree install/build and production-mode API startup verified.
- Isolated PostgreSQL17.7 schema migrated to 70/70 and synthetic data provisioned without production connections.
- Real Web proxy/browser path, HTTP business/security smoke, audit and tenant filtering verified.
- PostgreSQL/API restart persistence and health recovery verified.

## IN_PROGRESS

No engineering-scope batch remains open. The formal go-live backlog is maintained separately.

## BLOCKERS

Production readiness remains deferred for the previously recorded complete off-host recovery bundle/config encryption, safe rollback drill, GitHub production governance and human business UAT. These are not reclassified as engineering acceptance failures.

## NEXT

Use `docs/deployment/release-gates/PRODUCTION_GO_LIVE_BACKLOG.md` for a separately approved go-live phase; do not update the public instance from this acceptance result.

## 2026-10-10 Phase 7 — frozen backup recheck; full recovery materials still blocked

[Phase 7 report](../evidence/PRODUCTION_RECOVERY_PHASE7_REPORT_20261010.md), [machine evidence](../evidence/PRODUCTION_RECOVERY_PHASE7_REPORT_20261010.json). The Phase 6 frozen dump was rechecked on the production host: 1,399,180 bytes, SHA-256 `b95fb5a112a89c7016c2a6dbc5c880a72e6933a50098a709a24c78fdafc29491`, source SHA `9d89c7d6739454345b1397fe6b02c945fbe1cb99`, all three manifest entries 0600 and matching, zero `.partial` files. The staging directory remains mutable by the deployment account, so no immutability or independent-copy claim is made. `.env.production` remains root-only; no formal KingTurf config backup service, approved encryption recipient key, encrypted artifact, or independent receiver was found. No transfer or new dump was attempted. Phase 6 database-only restore evidence remains valid, but Phase 7 full restore was not run because the independent copy/configuration materials are absent. `ON_HOST_BACKUP=PASS`; `COMPLETE_RECOVERY_BUNDLE=NO`; `RESTORE_VERIFIED=NO`; production remains `NO_GO`.

## CURRENT_STATUS

**PRODUCTION_NO_GO**. Main remains `3ec6d83c3e12a417dfe7087dd9a7d9fa6fc6d73f`; production remains `9d89c7d6739454345b1397fe6b02c945fbe1cb99`. The database backup is preserved and revalidated. The remaining blockers are a named private independent receiver and an authorized encrypted configuration export/recovery path.

## COMPLETED

- Phase 6 database dump, attachment empty-state proof and manifest were rechecked against current host bytes; source SHA, sizes, SHA-256 values and modes match, with no partial artifacts.
- No old backup was changed or removed, and no live dump or SSH large-output transfer was repeated.
- Bounded inventory confirmed no approved KingTurf configuration backup service, recipient key ID/fingerprint or independent receiver is exposed to the current account. Plaintext configuration was not read.

## IN_PROGRESS

- Await the minimum authorized configuration-recipient/export material and private independent receiver details.
- Preserve the host artifact until receiver-side checksum and manifest read-back are available.

## BLOCKERS

1. No approved encrypted configuration export/recovery recipient is available; the generic `gpg` executable alone is insufficient.
2. No independent off-host receiver/retention policy is available; staging remains mutable by the deployment account.
3. Full independent-copy restore, configuration reconstruction, rollback drill and business UAT remain unverified.

## NEXT

1. Obtain the named private receiver, access method, retention policy and checksum read-back procedure.
2. Obtain the recipient public key/key ID and formal root-controlled encrypted configuration export entrypoint.
3. Copy and verify the frozen artifacts, then execute the full restore runbook and security-preserving rollback drill.
4. Keep production deployment `NO` until full recovery, rollback and UAT gates pass.

## 2026-10-10 Phase 6 — host backup and isolated database restore completed

[Backup result](../evidence/PRODUCTION_OPERATIONS_TAKEOVER_PHASE6_BACKUP_RESULT_20261010.md), [machine evidence](../evidence/PRODUCTION_OPERATIONS_TAKEOVER_PHASE6_BACKUP_RESULT_20261010.json). Administrator ACL is effective on `/data/kingturf-erp-backups/staging` for `phoenix-codex-deploy`. A host-side KingTurf PostgreSQL custom-format dump was completed without SSH stdout transfer: 1,399,180 bytes, SHA-256 `b95fb5a112a89c7016c2a6dbc5c880a72e6933a50098a709a24c78fdafc29491`, `pg_restore --list` exit 0, frozen mode 0600. The attachment bind and `public.attachments` both contain zero records/files; an empty-state proof and manifest were created. The frozen dump restored successfully in temporary PostgreSQL17.7 containers with `--network none` and no production volume; 70 migrations, historical 17 NOT VALID constraints, CHECK/FK and business integrity checks passed. The first wrapper assertion used an invalid `migration_registry` table name; it was corrected to `public.schema_migrations` without regenerating or overwriting the dump. No production database/schema write, deployment, Phoenix/shared-service action or container restart occurred. `ON_HOST_BACKUP=PASS`; `ISOLATED_DATABASE_RESTORE=PASS`; `COMPLETE_RECOVERY_BUNDLE=NO`; `RESTORE_VERIFIED=NO` because no approved independent copy or encrypted configuration recovery artifact is available and the empty attachment observation is not an atomic files+DB snapshot.

## CURRENT_STATUS

**PRODUCTION_NO_GO**. Code/main remains `3ec6d83c3e12a417dfe7087dd9a7d9fa6fc6d73f`; production remains old `9d89c7d6739454345b1397fe6b02c945fbe1cb99`. The host backup gate advanced, but complete disaster-recovery, rollback and business UAT gates are still open.

## COMPLETED

- Dedicated staging ACL and write/read/delete probe verified for the approved SSH account; no permission bypass was used.
- Current KingTurf database custom-format backup frozen on host with size, `PGDMP` header, `pg_restore --list`, SHA-256 and manifest evidence.
- Attachment empty-state proof generated from both filesystem and database metadata; no attachment file or symlink was found.
- Real isolated database restore completed in a temporary no-network PostgreSQL17.7 container; the restored 70-row migration registry, 17 expected historical unvalidated constraints, and fail-closed CHECK/FK/business checks passed.
- KingTurf and Phoenix containers remained healthy with zero observed restarts; temporary Phase6 restore containers were removed.

## IN_PROGRESS

- Preserve the frozen host artifacts and obtain an approved independent copy plus encrypted configuration recovery material through a formal receiver/backup service.
- Complete full files/database/config restore acceptance, then perform the security-preserving application rollback drill and business UAT.

## BLOCKERS

1. No approved independent receiving/retention endpoint has been exposed to the current identity; the frozen dump is single-host only.
2. No approved encrypted configuration recovery artifact/entrypoint is available; plaintext configuration was not read.
3. Full atomic files+database restore and application rollback remain unverified; the isolated database result is partial evidence.
4. Production deployment remains prohibited until recovery, rollback and business UAT gates are satisfied. Existing main/production protection gaps remain governance risk.

## NEXT

1. Provide the exact approved backup receiver or existing backup-service read-back path; transfer the frozen immutable artifacts and verify receiver-side size/SHA-256.
2. Provide the encrypted configuration recovery artifact through its authorized path without exposing plaintext.
3. Run `RESTORE_ROLLBACK_UAT_EXECUTION.md` from the independent copy, including application read-only startup and full business/permission checks; then drill the emergency application rollback.
4. Keep `PRODUCTION_GO_NO_GO=NO_GO` and `PRODUCTION_DEPLOYMENT=NO` until all non-waived gates pass.

## 2026-10-10 Backup permission/deployment verification — staging ACL absent

[Read-only verification](../evidence/PRODUCTION_BACKUP_PERMISSION_VERIFICATION_20261010.md), [machine evidence](../evidence/PRODUCTION_BACKUP_PERMISSION_VERIFICATION_20261010.json). SSH whitelist now permits small commands. Production remains old SHA9d89c7d; KingTurf3 containers healthy, PostgreSQL17.7 and attachment bind mounts verified, `/data` has~96.8GB free. `/data/kingturf-erp-backups/staging` is absent; backup dir root750 is not readable/writable/searchable by phoenix-codex-deploy, `.release-backups` root755 is read-only, config root600 unreadable. No KingTurf backup service found; only dpkg-db-backup.timer. No backup command started and no production/Phoenix mutation. Minimum next action is admin-created KingTurf-only staging ACL or existing backup-service read-back; then host-side dump/manifest/independent copy/restore.

## 2026-10-10 Phase 6 retry — small SSH checks pass, backup destination remains blocked

[Phase6 retry](../evidence/PRODUCTION_OPERATIONS_TAKEOVER_PHASE6_RETRY_20261010.md), [machine evidence](../evidence/PRODUCTION_OPERATIONS_TAKEOVER_PHASE6_RETRY_VERIFICATION_20261010.json). After the reported SSH whitelist change, small authorized commands succeeded. Fresh read-only facts: KingTurf3 containers healthy, DB size31,935,635 bytes, registry70, AVAILABLE attachments0, `/data` has~96.8GB free. No backup started because `.release-backups` root755 is not writable, independent backup dir root750 is inaccessible, attachments root755 is not writable and `.env.production` root600 is unreadable. No Docker/root/permission bypass. Need one dedicated writable KingTurf backup destination or existing backup service read-back; then host-side dump→manifest→independent copy→isolated restore. NO_GO remains.

## 2026-10-10 Phase 6 — production backup preflight blocked before any write

[Operations report](../evidence/PRODUCTION_OPERATIONS_TAKEOVER_AND_RECOVERY_REPORT_20261010.md), [machine evidence](../evidence/PRODUCTION_OPERATIONS_TAKEOVER_AND_RECOVERY_VERIFICATION_20261010.json). Scoped backup operations were authorized and attempted, but the approved SSH session reset before the remote preflight emitted output. No pg_dump, host file, attachment archive, config read, permission change, container restart, Phoenix access or production mutation occurred. This is `EXTERNAL_BACKUP_ENTRYPOINT_PENDING`, not a backup failure or PASS. Do not repeat the same SSH/output/SFTP diagnostics. Need an existing formal host-side backup service or approved writable KingTurf staging/receiving endpoint with manifest/checksum/read-back and independent-copy support. Main remains3ec6d83 and technical CI/browser evidence remains complete; production GO remains NO_GO.

## 2026-10-10 Phase 5 — final browser evidence, production remains NO_GO

[Phase5 recovery report](../evidence/PRODUCTION_RECOVERY_PHASE5_REPORT_20261010.md), [machine evidence](../evidence/PRODUCTION_RECOVERY_PHASE5_VERIFICATION_20261010.json). Final main `3ec6d83c3e12a417dfe7087dd9a7d9fa6fc6d73f` production build and Chromium regression are now verified: 26/26 PASS on loopback static preview; final Hosted CI remains443/443 and native HTTP suites pass. No production or external service access was used. GitHub protection remains missing; no current recovery bundle, real restore, accepted emergency rollback or business UAT has arrived. `PRODUCTION_GO=NO_GO`; no deployment. Stop repeated SSH/CI/registry work until external materials, admin readback or business UAT state changes.

## 2026-10-09 Main integration complete — production remains NO_GO

Final integration report: [MAIN_INTEGRATION_AND_PRODUCTION_DEPLOYMENT_REPORT_20261009](../evidence/MAIN_INTEGRATION_AND_PRODUCTION_DEPLOYMENT_REPORT_20261009.md), machine evidence [JSON](../evidence/MAIN_INTEGRATION_AND_PRODUCTION_DEPLOYMENT_VERIFICATION_20261009.json). PR33→31→32→34 and clean Batch4 PR35 are merged. Final main `3ec6d83c3e12a417dfe7087dd9a7d9fa6fc6d73f`; Hosted final Run37897784151 PASS443/443. `INTEGRATION_GO=YES`. Main protection remains absent but no forced platform rule blocked authorized normal merges. Production is independently `NO_GO`: registry70/70 prior exact, current complete recovery bundle absent, real restore/rollback/UAT absent. No production deployment or mutation; Phoenix untouched. Browser-only final-main replay not rerun; historical candidate26/26+runtime2 retained separately. NEXT is external recovery bundle→restore→safe rollback→business UAT, then optional browser replay and production gate review.

## 2026-10-09 Release Gate Closure Phase 3 — current

[Phase3 report](../evidence/RELEASE_GATE_CLOSURE_PHASE3_REPORT_20261009.md), [machine state](../evidence/RELEASE_GATE_CLOSURE_PHASE3_VERIFICATION_20261009.json). Fresh GitHub readback unchanged: main9d89 unprotected, production rules empty, actor emvia non-admin; PR33/31/32/34 open, PR34 still PR33 base, no Reviews. Do not repeat SSH transfer tests or CI/registry checks. `SSH_OUTPUT_TRANSFER_FAILURE_ROOT_CAUSE_UNCONFIRMED` and `EXTERNAL_MATERIALS_PENDING` remain. User waiver means Codex technical/prod decision is accepted; no GitHub person review fabricated. Await administrator protection readback and operations-owner frozen DB/files/config recovery bundle. RELEASE_GO_NO_GO=NO_GO.

## 2026-10-09 Release Gate Closure Phase 2 — current

Latest phase report: [RELEASE_GATE_CLOSURE_PHASE2_REPORT_20261009](../evidence/RELEASE_GATE_CLOSURE_PHASE2_REPORT_20261009.md), machine evidence [JSON](../evidence/RELEASE_GATE_CLOSURE_PHASE2_VERIFICATION_20261009.json). Main remains9d89c7d, NO_GO. User waived human technical/production approval and approved emvia backup acquisition; no GitHub human review fabricated. Admin protections remain absent and acting account non-admin. Registry70/70 exact remains prior verified. New bounded SSH probes locate a size-dependent output failure: fixed1KiB and file metadata/1KiB prefix pass; fixed8/32/128KiB fail/reset/timeout; no root/permission/Docker/Phoenix bypass. Complete current DB/files/config bundle unavailable, restore/rollback/UAT and main integration not run. Next: administrator readback, stable approved recovery bundle, isolated restore and safe rollback/UAT, then protected exact-head integration; do not repeat unchanged full CI or registry check.

# KingTurf Takeover Status — Release gate closure

Updated2026-10-09 Asia/Singapore; branch `codex/release-gate-closure`, preparation3adb38341f06bf63be966383cefc7af10c05e203. [Gate closure report](../evidence/RELEASE_GATE_CLOSURE_REPORT_20261009.md), [machine evidence](../evidence/RELEASE_GATE_CLOSURE_VERIFICATION_20261009.json). Continue NEXT; do not redo Discovery or unchanged full CI. Earlier snapshots preserved below.

## CURRENT_STATUS

**NO_GO**, actual main/production9d89c7d6739454345b1397fe6b02c945fbe1cb99. Conditional merge/deploy authorization retained. Latest user explicitly assigns technical Review and production approval to Codex without humans; do not keep requesting personnel technical review or fabricate GitHub approvals. Codex technical approves unchanged Batch1–4; actual production approval remains NO_GO on nonwaived gates. emvia backup acquisition approval recorded; no filesystem privilege expansion inferred. Business-role signature not supplied.

## COMPLETED

- Current PR33/31/32/34 exact heads/checks remain unchanged and OPEN, qualityPASS; main/environment protections absent, actor emvia write/adminfalse. Exact quality provider App15368 verified. Administrator ivanzhao299 exists; no alternate admin credential used.
- Three previous independent AI code approvals retained; new readonly preparation-tool review REQUEST_CHANGES findings corrected and finalAPPROVE. No human Review fabricated. Four PR descriptions now link immutable3adb383 packet with risk/test/recovery/user-waiver information. No source branch HEAD change or unnecessary CI rerun.
- Production registry blocker **resolved**: actual70/candidate70 name+digest exact, missing/extra/drift0, read-only query0.053s. Minimal PGread-only query0.05s; actual catalog-expression/full restored-data proof stillpending. Same approved SSH identity/fingerprint/KEX/host.
- Stage diagnosis: connect/auth/exec succeed, normal authorized Docker CLI succeeds with nonfatal config permissionwarning; large return/output/stream failures persist. Current custom read-only dump returned20,480 partialbytes thenSSHtimeout; boundedhistoricalchunk reset0bytes. Exact lower-layer causeunknown; never labelcompletebackup/restorePASS. Existinghistoricaldump1,372,272bytes checksumverified, notcurrentbundle.
- Confirmed approved staging dirs notwritable; independentbackups root750 unreadable, configuration root600 unreadable. No Docker socket/hostbind/root/otheridentity bypass. Current availableattachments0 anddirectoryentries0 supportemptystate only. Activepg_dumpclients0 afterattempt.
- Admin policy payload alternatives and exact operational review materials ready: original1person vs userAIwaiver0platformapprovals proposal, mainPR/strictquality/no-force/delete/bypass, productionmain-only. Actual admin config stillnotapplied.
- Recovery artifact verifier25/25 Python operations and frozenSQL7positive/error outcomes passed on owned syntheticPG17.7/70migrations; explicitfalse restore/provenance/time flags, age/path/tar/checksum/partial guards, precise registry, failclosedCHECK/FK/business counts, internalONERRORSTOP. Known17historicalNOTVALID metadata retained; unknown additions rejected, no productionDDL.
- CorrectedREADME directnativeCLI dotenv commands: old envfile--run failedchildDATABASE_URL propagation; guardedownDB migrate/status actuallypassed. Existingapps/workflows unchanged. Source/doccheckpoint3adb383 normallypushed. Format/diffPASS; no skips/lower standards. Originalcandidate20ded Hosted443 andBatch4444fdfa425 remain exact historicalevidence, notfinalmain.
- Fresh old-version publichealth/ready/version200old9d89; Kingturf healthy, Phoenixall3healthy/untouched. Owned syntheticcontainer/privateinvalidfragments/env removed afterevidence. No prodDBmutation/deploy/sharedchanges.

## IN_PROGRESS

Gate preparation complete and reviewable; finaldocumentationcheckpoint. No technical full-review restart. Conditional execution ready to resume when realplatform/materialsgates resolve.

## BLOCKERS

1. GitHub actualprotectionmissing andconnectionnotadmin. Userwaiveracknowledged; protection mustactuallytakeeffect throughauthorizedadminconfiguration. No need to renew mergeauthorization.
2. CompletecurrentDB+attachment+config bundle/provenance/independentcopy absent; approvedSSHread/exportstreamresets andexistingstorage/configaccesslimited. Needowner-exportedstablecontrolledmaterial andapprovedread channel, not generalprivilege/rootbypass.
3. Actualreal-material restore/RPO/RTO, catalog/constraint/old-data compatibility and safe no-DDL/new-lock rollback target/drill notverified. Registrymatch aloneinsufficient.
4. Actualintegratedmain/Batch4puremainPR andqualitystillnotrunbecauseprotectedbaseintegrationpending; no source securitychanges reachedproduction.
5. Business-role UAT signaturepending. Technical/prod personnelapprovalwaived; businesssignature was notprovided orAI-signed.

## NEXT

1. Administrator applies andreadsbackconfirmedpolicyvariant/main+productionprotections, Actionsdefaults/historicalrerunoperators; currentemvia approvaldoesnotchangetechnicaladminrole. Never self-approve a personreviewevent or bypass configured rules.
2. ProtectedexactHEAD33→31→32→34 merges with eachnewmainquality andremainingbranchupdates, retarget34after33 main. PureBatch4 runtime/startupPRfromactualmain, carryREADMEfix3adb383 scopedpatchwithoutpreviewancestry; review/Hosted/merge. Full finalmain verificationboundnewSHA.
3. Owner-stage currentcompleteKingDB/files/config exports andtrustedmanifest/copy evidence viaapprovedidentity/channel; diagnoseoutputresetsusing scopedlogs. Realisolatedrestore with noexternalproviders/prodcredentials/mounts; preparedmaterial/SQL checkdoesnotprovefullrestore.
4. Acceptedemergencybaseline preservesauth/audit/source/nested/read-onlystartup, realfailure/rollbackdrill, finalSHA businessUATrecord; CodexGO onlywhen nonwaivedgatespassed, formalGithubdeployexactSHA. No productionmigration orsharedinfra authorizationinferred.

## TECH_DEBT

17 intentionalhistoricalNOTVALID constraints from0055 retained; actualrows checked onlysyntheticallyuntilrealrestore. SQLdoesnotprove constraint-expression/domain/triggerbusiness equivalence. Legal-only workbench/historicalproviders/UX/largefilesremain scopeddebt, notrewritten. OperationalPython verifier requiresPython3.11+; current/Hostedruntime compatible.

## PRODUCTION_RISKS

Old9d89securitygapsstilllive; safeall-instancecutover andno-DDL/new-lockrollbackunknown. No completecurrentbackup/restoreresilience guarantee, no artificialSHA/source/timeprovenance. User AI approval decision changesreviewmodel only; no mandatoryplatform/data/rollbackgate waived. RELEASE_GO_NO_GO=NO_GO.

## Previous final preflight snapshot (historical)

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
## 2026-10-10 Final engineering acceptance — environment reclassified as development/test

[Final closure report](../evidence/PROJECT_TAKEOVER_FINAL_CLOSURE_REPORT_20261010.md), [machine evidence](../evidence/PROJECT_TAKEOVER_FINAL_CLOSURE_REPORT_20261010.json), [production go-live backlog](../deployment/release-gates/PRODUCTION_GO_LIVE_BACKLOG.md). The project owner has clarified that the reachable KingTurf instance is development/test, not formal production business use. Technical read-only checks confirm a production-like surface remains: `kingturf-erp-production` Compose labels, `NODE_ENV=production`, public `erp.kingturf.cn`, shared Phoenix host, 5 organizations, 205 employees (12 active), and non-empty CRM/order/AR/payment data. No payment/SMS/SMTP/cloud-storage environment names were observed; a website lead-ingest secret remains configured. The existing deployment workflow writes the KingTurf path, `.env.production` lead secret, containers and `.release-sha`, so no final-main update was dispatched while the synthetic-data/external-traffic boundary remained unconfirmed. Final engineering artifacts and automated verification are complete; current runtime is still old SHA `9d89c7d6739454345b1397fe6b02c945fbe1cb99`. `ENGINEERING_ACCEPTANCE=PASS`; `DEV_TEST_ACCEPTANCE=PENDING`; `PRODUCTION_READINESS=DEFERRED`; `PROJECT_TAKEOVER_CLOSED=PARTIAL`. Prior production `NO_GO` reports remain unchanged and valid for formal go-live.

## CURRENT_STATUS

**ENGINEERING_ACCEPTED / DEV_TEST_DEPLOYMENT_PENDING / PRODUCTION_DEFERRED**. Final main is `3ec6d83c3e12a417dfe7087dd9a7d9fa6fc6d73f`; the reachable instance remains on old SHA `9d89c7d6739454345b1397fe6b02c945fbe1cb99`.

## COMPLETED

- Batch 1–4 code changes are integrated in main; final Hosted CI 443/443 and Chromium 26/26 remain the recorded final-main results.
- Security, authorization, migration, build and isolated database restore evidence is archived.
- Environment classification and the separate production go-live backlog are documented without rewriting historical production reports.

## IN_PROGRESS

- Safe update of the owner-classified test instance to final main, pending data-owner confirmation and an explicitly approved no-external-write deployment window.
- Actual final-main runtime smoke and business-owner UAT remain separate from automated engineering acceptance.

## BLOCKERS

1. Production-like public target and historical production workflow are not yet proven to be a safe test-only target for replacement; the database has non-empty records and 204 non-obvious employee email domains.
2. No final-main runtime smoke has been executed on the reachable instance.
3. Human business UAT, independent recovery retention, encrypted configuration recovery and formal go-live governance remain deferred backlog items.

## NEXT

1. Obtain data-owner confirmation that existing records are synthetic/authorized test data, no external lead traffic will be processed during deployment, and the production-named workflow is approved for this test instance.
2. If confirmed, dispatch the exact final main SHA through the reviewed workflow, capture Run ID, and verify health/ready/version, containers, logs and non-destructive core smoke.
3. Record actual test-instance acceptance; keep formal production gates in `PRODUCTION_GO_LIVE_BACKLOG.md`.
