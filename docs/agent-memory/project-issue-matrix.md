# Latest gate closure — 2026-10-10 Phase 7 recovery gate

[Phase 7 report](../evidence/PRODUCTION_RECOVERY_PHASE7_REPORT_20261010.md), [machine evidence](../evidence/PRODUCTION_RECOVERY_PHASE7_REPORT_20261010.json). The Phase 6 frozen database artifact remains byte-for-byte valid and has no partial companion. No approved encrypted configuration export or independent receiver is available, so the complete-bundle and full-restore gates remain blocked.

| ID                              | Updated actual status                       | Evidence / minimal next                                                                                                                        |
| ------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| KT-004                          | HOST_BACKUP_RECHECK_PASS_OFFHOST_BLOCKED    | Frozen DB size/SHA/mode/manifest rechecked; staging is mutable and no independent receiver or receiver-side checksum exists                    |
| KT-013                          | RESTORED_DATABASE_EVIDENCE_RETAINED         | Phase 6 isolated DB restore remains valid; no new registry run because production version/materials are unchanged                               |
| KT-017                          | FULL_RESTORE_MATERIALS_BLOCKED              | Database-only evidence exists; full independent files/config restore is not executable without the missing materials                           |
| KT-022                          | CONFIG_ENCRYPTED_EXPORT_BLOCKED             | `.env.production` remains root-only; generic `gpg` is present but no approved recipient key or managed export entrypoint was found              |
| KT-025                          | ROLLBACK_BLOCKED_BY_FULL_RESTORE            | No safe application rollback drill until independent recovery and configuration evidence are complete                                          |

`ON_HOST_BACKUP=PASS`; `COMPLETE_RECOVERY_BUNDLE=NO`; `RESTORE_VERIFIED=NO`; `PRODUCTION_GO_NO_GO=NO_GO`. No production or Phoenix/shared-service mutation occurred.

# Latest gate closure — 2026-10-10 Phase 6 backup execution

[Phase 6 backup result](../evidence/PRODUCTION_OPERATIONS_TAKEOVER_PHASE6_BACKUP_RESULT_20261010.md), [machine evidence](../evidence/PRODUCTION_OPERATIONS_TAKEOVER_PHASE6_BACKUP_RESULT_20261010.json). Administrator ACL is now effective and a KingTurf-only host-side custom-format database backup was created and independently restored in a temporary no-network PostgreSQL 17.7 container. This advances recovery evidence without making a complete-bundle or release claim.

| ID                              | Updated actual status                       | Evidence / minimal next                                                                                                                                    |
| ------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KT-004                          | ON_HOST_DATABASE_BACKUP_AND_DB_RESTORE_PASS | Frozen 1,399,180-byte dump, SHA-256 recorded, `pg_restore --list` 0, real isolated DB restore/integrity 0; configuration, independent copy and atomic files+DB bundle remain absent |
| KT-013                          | RESTORED_DATABASE_REGISTRY_AND_CATALOG_PASS | Isolated restore has 70 migrations; 17 expected historical NOT VALID constraints; CHECK/FK/business checks all 0 violations; full production compatibility remains scoped to restored material |
| KT-017                          | REAL_RESTORE_PARTIAL_DATA_PASS              | Real restored-data checks passed; full recovery acceptance still requires config, independent copy and complete runbook evidence                                        |
| KT-025                          | ROLLBACK_BLOCKED_BY_MATERIALS_TARGET        | No rollback drill performed; current dump is a recovery point, not a safe application rollback target                                                             |

`ON_HOST_BACKUP=PASS`; `COMPLETE_RECOVERY_BUNDLE=NO`; `RESTORE_VERIFIED=NO`. No production database mutation, deployment, Phoenix action or shared-service change occurred. Next: approved encrypted configuration material and independent copy, then complete restore and rollback/UAT gates.

# Latest gate closure — 2026-10-09

[Current gate report](../evidence/RELEASE_GATE_CLOSURE_REPORT_20261009.md) supersedes previous remaining-human-technical-review claims: user expressly waives personnel technical/prod review; no GitHub human approvals fabricated. Other gates remain; actual main old9d89. Candidate443 remains historical exact20ded evidence.

| ID                              | Updated actual status                      | Evidence / minimal next                                                                                                                                       |
| ------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KT-002                          | ADMIN_CONFIGURATION_BLOCKED                | emviawrite/adminfalse; protectionsabsent; two reviewed policyvariants prepared, actualownerconfiguration/readback needed                                      |
| KT-004                          | BACKUP_TRANSFER_AND_ACCESS_BLOCKED         | current20,480bytepartialinvalid; olddumpchecksumverified; config/root750dir inaccessible, approvedstagingunwritable; approvedownerstablebundle/channel needed |
| KT-013                          | REGISTRY70_EXACT_PASS_FULL_SCHEMA_PENDING  | Productionquery0.053s missing/extra/drift0, noDDL; restoredcatalog/businesscompatnotverified                                                                  |
| KT-017                          | REAL_RESTORE_CONSTRAINT_ACCEPTANCE_PENDING | FrozenSQLschema70+17historicalNOTVALID baseline, checks/fks/countfailclosed synthetic7outcomesPASS; actualconstraint-expression/realdataunknown               |
| KT-025                          | ROLLBACK_BLOCKED_BY_MATERIALS_TARGET       | No security/DDL downgrade; emergencybaseline preservingnewlocks/authz/startup designed, not implemented/drilled                                               |
| KT-026 recovery admission tools | PREPARED_REVIEWED_TARGETED_PASS            | Pythonoperations25, SQL7, nofake restore/provenance/timePASS; partial/age/path/tar failures tested                                                            |
| KT-027 runtime documentation    | FIXED_CHECKPOINT_NOT_MAIN                  | NativeenvfileCLI migrate/status verified, avoidsNode--run childenv issue; carryREADMEpatchintoBatch4mainPR                                                    |

Source3adb383 normalfeaturepush, PRbodyreviewpacketsupdated, no main merge/productionmutation/Phoeniximpact. Originalissues/historicalscopepreserved below.

## Previous issue snapshot (historical)

# Current release preflight update — 2026-10-09

[Final release evidence](../evidence/FINAL_INTEGRATION_AND_PRODUCTION_RELEASE_REPORT_20261009.md) supersedes earlier same-day status below. Conditional merge/deploy authorized; actual main unchanged, no merge/production mutation. Code review approvals are AI reviews only, independent personnel and protections missing. Source candidate20ded96 Hosted/local443/443; latestPR31f2286f7 Hosted37869370730 PASS387; Batch4444fdfa Hosted37869588268 PASS425. Read-only production/data/mounts/healthy Kingturf/Phoenix verified, current registry/backup restore/rollback not accepted. NO_GO.

| ID                                        | Severity | Latest status                        | Evidence / next                                                                                                                        |
| ----------------------------------------- | -------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| KT-001                                    | P1       | PR31_UPDATED_HOSTED_PASS_NOT_MERGED  | Exact source/immutable main guard preserved; latest f2286f7                                                                            |
| KT-002                                    | P1       | RELEASE_BLOCKER_GOVERNANCE           | main/environment rules absent, admin=false, human reviews0                                                                             |
| KT-003                                    | P1       | PREFLIGHT_IMPLEMENTED_HOSTED_PASS    | Live mount/config/schema gate, singleton health and shared concurrency; production registry query unverified                           |
| KT-004                                    | P1       | RELEASE_BLOCKER_RESTORE              | Historical20260905 DBdump only; independent directory permission denied, transfer timeout, no current files/config restore             |
| KT-005                                    | P1       | PR32_REVIEW_APPROVED_NOT_MERGED      | Native HTTP19/19 current candidate; old-main/mixed-version cutover and rollback risks                                                  |
| KT-006 / KT-007                           | P1       | PR34_REVIEW_APPROVED_NOT_MERGED      | Source/nested grants intact; current targeted59/59 and realHTTP19; human/real-state UAT pending                                        |
| KT-009 / KT-010                           | P1       | PR33_HOSTED_PASS_NOT_MERGED          | Web/CAPA assertions preserved; latest combined full CI clean                                                                           |
| KT-011 / KT-012                           | P1       | BATCH4_PUBLISHED_HOSTED_PASS         | 425/425; realdev andbuilt browser1/1 each; puremainPR awaits protected integration                                                     |
| KT-013                                    | P1       | READONLY_STARTUP_IMPLEMENTED         | No migration SQL change; restricted-role DB7/native startup4 pass; actual production registry/read compatibility still release blocker |
| KT-014                                    | P2       | CURRENT_COMBINED_VERIFIED_NOT_MAIN   | Hosted/local443; UI replay26; real runtime2; final main not integrated                                                                 |
| KT-021 / KT-022                           | P1 / P2  | MARKER_ORDER_PRESERVED_RECOVERY_OPEN | Backup failure blocks sync; marker after exact success, no auto app/config rollback                                                    |
| KT-023 SSH trust                          | P1       | IMPLEMENTED_REVIEWED_HOSTED_PASS     | Public approved fingerprint, immutable pin before agent, strict transports andcurve25519; secret host/port match still verify          |
| KT-024 persistent storage/shared services | P1       | IMPLEMENTED_REVIEWED_HOSTED_PASS     | No named fallback, no Nginx mutation, backups/images preserved; no shared/Phoenix changes                                              |
| KT-025 rollback/cutover                   | P1       | RELEASE_BLOCKER                      | Approved schema/session-safe rollback and restore drill missing; oldmain startup DDL unsafe                                            |

## Earlier issue matrix snapshot (historical)

# KingTurf Project Issue Matrix

Updated: 2026-10-09 Asia/Singapore. [Current stabilization evidence](../evidence/PR_INTEGRATION_READINESS_REPORT_20261009.md), [runtime](../evidence/BATCH4_RUNTIME_RECOVERY_REPORT_20261009.md). Original prior snapshot references retained. Current Batch3 code `7562baf83a0d5b65d12fdedade511607e88136db`; [authorization evidence](../evidence/BATCH3_AUTHORIZATION_REPORT_20261008.md). This live matrix supplements the immutable [takeover report](../evidence/PROJECT_TAKEOVER_REPORT_20261008.md). Current evidence: [Batch 1](../evidence/BATCH1_RELEASE_SAFETY_REPORT_20261008.md), code checkpoint `61617c9608af59035117b050e24fd19f2aad8325`; [integration](../evidence/BATCH1_INTEGRATION_REPORT_20261008.md), [Batch 2](../evidence/BATCH2_AUTH_SECURITY_REPORT_20261008.md) code `e76cb1eee5b70f4328ca07a358aab65aab9bbf98`.

Implemented/Hosted validated means available for review; it does not mean merged, enabled in GitHub or deployed. Historical observations retain their evidence date.

| ID                                      | Severity | Current status              | Evidence / next action                                                                                                                     |
| --------------------------------------- | -------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| KT-001 release input/source             | P1       | PR31_OPEN_HOSTED_PASS       | Exact SHA, canonical main history, immutable control/candidate, lock-time revalidation; main still has old workflow                        |
| KT-002 GitHub protection                | P1       | CONFIRMED_EXTERNAL_BLOCKER  | Current main/environment rules absent; defaults permissions403 NOT_VERIFIED; administrator approval/configuration required                 |
| KT-003 deployment concurrency/preflight | P1       | PR31_OPEN_HOSTED_PASS       | Current deploy job shared group/non-canceling implemented; mount/schema preflight and historical/manual writers remain                     |
| KT-004 recovery                         | P1       | NOT_VERIFIED                | Attachment/off-host backup and restore acceptance not performed                                                                            |
| KT-005 credential/session/audit         | P1       | PR32_OPEN_HOSTED_PASS       | Batch2 real HTTP old token401; audit/revoke rollback and concurrency pass; main still vulnerable                                           |
| KT-006 Order360 source scope            | P1       | PR34_OPEN_HOSTED_PASS       | Per-source+entry scopes/fields, dual-tenant/TEAM/SELF realHTTP19; Hosted350; main/production not integrated                                |
| KT-007 nested legal permissions         | P1       | PR34_OPEN_HOSTED_PASS       | Independent legal/parent masks/mutation responses; parent collectionstate contract retained; field-count UI/currency fixed; main unchanged |
| KT-008 login anti-abuse                 | P1       | NOT_VERIFIED_UPSTREAM       | App/ingress historical missing controls; external runtime protection unknown                                                               |
| KT-009 Web date/DOM test                | P1       | PR33_OPEN_HOSTED_PASS       | DOMTokenList contract/overdue assertions/controlled clock; bootstrap87/87 and full Web110/110; main not merged                             |
| KT-010 CAPA date test                   | P1       | PR33_OPEN_HOSTED_PASS       | Database-relative CAPA dates; preserved CHECK and boundary/timezone assertions; CAPA4/4; main not merged                                   |
| KT-011 API local runtime                | P1       | BATCH4_LOCAL_VALIDATED      | dev/start transform-types+rootenv; actual dev and compiled production-mode local startup/login pass; sourcebe6f56b not pushed              |
| KT-012 local env/proxy                  | P1       | BATCH4_LOCAL_VALIDATED      | Loopback dev/preview proxy, env precedence/README; real browser customer persistence/audit/401/403 pass                                    |
| KT-013 migration control                | P1       | OPEN                        | Startup DDL/non-read-only status and migration concurrency remain; no production DB audit                                                  |
| KT-014 CI/browser coverage              | P2       | PARTIAL_IMPROVEMENT         | 31/32/33/34 latest Hosted green; combined local414, browser26 mock/replay plus2 real runtime executions; human UAT pending                 |
| KT-015 document delivery                | P1       | NOT_VERIFIED                | Provider consumer/receipt acceptance still pending                                                                                         |
| KT-016 UX/volume                        | P2       | OPEN                        | Pagination, typed filters and handoffs after safety fixes                                                                                  |
| KT-017 historical DB constraints        | P2       | NOT_VERIFIED                | No production historical-row checks or constraint validation                                                                               |
| KT-018 state drift                      | P2       | INCREMENTALLY_MAINTAINED    | Current report/status/matrix linked; historical acceptance not rewritten                                                                   |
| KT-019 architecture debt                | P2       | DEFERRED                    | No broad rewrite; large app/bootstrap files unchanged                                                                                      |
| KT-020 derived risk fields              | P2       | PARTIAL_IMPLEMENTED         | Order360 derived anomalies/type/labels scope+fields pass HTTP; other dashboards not assessed                                               |
| KT-021 premature release marker         | P1       | IMPLEMENTED_LOCAL_VALIDATED | Atomic promotion only after probes/exact JSON version; failure/retry shell tests                                                           |
| KT-022 backup/config order              | P2       | PARTIAL_IMPLEMENTED         | Dump failure now prevents secret sync; later failure may retain synchronized config; no automatic config rollback                          |

No production P0 was confirmed in scoped synthetic tests. KT-009/010 are repaired and Hosted validated on each feature, not merged into main. Batch3 KT-006/007/Order360-derived fields are locally repaired and independently reviewed, not production acceptance. Production release remains blocked by unmerged code, missing protection and operational/UAT gates. Follow NEXT in takeover-status; historical baseline reports remain immutable.

## 2026-10-09 stabilization status

PR31/32/33/34 all OPEN/latest-head HostedPASS, independent humanapproval absent; main unchanged9d89c7d and rules missing. Current Batch3e33e414 locally/Hosted fixed KT006/007 and relevant derived fields, not production acceptance. Batch4be6f56b resolves KT011/012 in real isolateddev/compiled-runtime paths, complete local414/414; not pushed/Hosted. KT013/004/015 production migration/DB+attachments recovery/provider and actualUAT remain open; local environment badge is a P2 UX follow-up. [Current status](takeover-status.md) supersedes historical pending-push/gate observations without rewriting old checkpoint reports.
