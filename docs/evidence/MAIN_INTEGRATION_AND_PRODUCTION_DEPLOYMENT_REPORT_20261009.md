# MAIN_INTEGRATION_AND_PRODUCTION_DEPLOYMENT_REPORT

Date: 2026-10-09 Asia/Singapore. Code integration completed; production release remains independently **NO_GO**. No production workflow was dispatched, no production database mutation occurred, and Phoenix/shared services were not touched.

## A. Independent AI Review

The previously recorded three independent read-only AI reviews approved Batch 1–4 code after scoped fixes. The user explicitly waived independent human technical/production review and assigned Codex the technical decision. No GitHub personnel Review was fabricated. Main protection remains absent as a governance risk; no platform-required review rule was active during these merges.

## B. PR Merge Receipts

Merges were performed through normal GitHub PR merge with exact head matching, preserving merge history and without direct main push or force push.

| PR                              | Head verified                                                           | Merge commit / main after merge            | Hosted evidence                                                  |
| ------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| #33 CI gate recovery            | `ab26c6ebff7a4524a205f3a1ec92959a35c97f94`                              | `3d71fc690a66c4473bbdeb8c5c630580a598da71` | prior PR quality PASS; main Run `37890633826` PASS               |
| #31 release safety              | `f2286f7806feb2cefdd1a1364cd7f7799840174d`                              | `9364223d6ff8e13ae695e108555ad5f7a9347b94` | main Run `37891216819` PASS                                      |
| #32 authentication/session      | conflict-resolved `4e5d386ffccc76ddff03941ff1c41a283a8d56ec`            | `b9deb83806877d19c78a22c060769bd6b8491cc1` | conflict-resolution Hosted Run `37892144294` PASS                |
| #34 source/nested authorization | retargeted conflict-resolved `69cb6a632dc4ac102d38dd167e4b24d3938808e1` | `7a58bb0d8203ae57b0847af972b983e56e2c7b65` | new-base Hosted Run `37894436894` PASS                           |
| #35 clean Batch 4               | `b23aa23649568a24663e8ef7e7429775152699ea`                              | `3ec6d83c3e12a417dfe7087dd9a7d9fa6fc6d73f` | Hosted Run `37897245617` PASS; final main Run `37897784151` PASS |

#32 and #34 conflicts were documentation-only after merging current main; source security/runtime changes were retained. PR #34 was retargeted to main before its new Hosted run. PR #35 was created from actual integrated main and contained only the twelve runtime/startup/proxy/README/test files; old preview ancestry and duplicate Batch 1–3 source were excluded.

## C. Final Main Commit

`FINAL_MAIN_SHA=3ec6d83c3e12a417dfe7087dd9a7d9fa6fc6d73f`. Remote main has no open Batch PRs remaining. Main is still reported `protected=false`; this is recorded governance debt, not a claim that protection is configured.

## D. Final Main CI

Final main Hosted Run `37897784151` completed successfully with `quality`. The exact `pnpm ci:local` log reports:

- API: 184 tests passed.
- Web: 114 tests passed.
- Database: 68 tests passed.
- Domain: 14 tests passed.
- Config: 4 tests passed.
- Types/UI/testing suites: 3 tests passed total.
- Release Node guardrails: 46 passed.
- Operations Python tests: 10 passed.
- Total: **443/443**, with frozen install, format, capability manifest, database guard, migrations, lint, typecheck, build and production dependency audit (`No known vulnerabilities found`).

The final main CI log contains expected PostgreSQL rejection messages from tests exercising immutable and unauthorized operations; the job succeeded and these are not unhandled failures.

A local final-main browser replay was not run after merge because this execution host could not complete a separate worktree dependency install without slow external package downloads. Historical exact candidate browser evidence remains 26/26 replay cases plus two real local runtime executions; this is disclosed and is not relabeled as a final-main browser PASS. The final main Hosted quality gate is PASS; a fresh browser-only run remains a follow-up if required by release policy.

## E. Runtime and Security Tests

The integrated code includes session revocation/atomic audit, source/nested authorization, read-only production startup and release guardrails. Final main CI reran their unit, PostgreSQL and real HTTP suites. Prior candidate native HTTP auth and authorization evidence remains historical but source is now in final main. Local environment browser evidence is separate from final-main evidence as stated above.

## F. Production Compatibility

Registry evidence previously obtained from production remains **70/70 exact name+SHA match**, missing/extra/mismatch zero. This was not unnecessarily repeated. Full catalog expression equivalence, restored historical data compatibility and file/config consistency remain unverified. Production still reports the old SHA `9d89c7d6739454345b1397fe6b02c945fbe1cb99`; no application deployment occurred.

## G. Backup & Restore

`BACKUP_READY=NO`. The current complete DB/files/config recovery bundle has not been delivered. The approved SSH channel is classified `SSH_OUTPUT_TRANSFER_FAILURE_ROOT_CAUSE_UNCONFIRMED`; no repeated output experiments were performed. Historical dump metadata/checksum and bounded prefix evidence are not a current consistent backup. No real restore was attempted.

## H. Rollback Readiness

`ROLLBACK_READY=NO`. Old main is not accepted as a safe target because of startup DDL and the old authentication lock protocol. A compatible emergency baseline preserving current authentication, audit, authorization and SELECT-only startup has not been implemented or drilled against real restored data.

## I. UAT

`UAT_READY=NO`. Automated candidate and final-main CI evidence do not constitute business-role acceptance. No final-SHA business sign-off, real role evidence, current-data restore acceptance or provider confirmation was supplied.

## J. Production GO/NO_GO

```text
INTEGRATION_GO=YES
GITHUB_PROTECTION_STATUS=MISSING_GOVERNANCE_RISK
PRODUCTION_SCHEMA=70/70_REGISTRY_MATCH_FULL_DATA_CATALOG_PENDING
BACKUP_READY=NO
RESTORE_VERIFIED=NO
ROLLBACK_READY=NO
UAT_READY=NO
PRODUCTION_GO=NO_GO
```

Code integration and production deployment are intentionally separate decisions. `INTEGRATION_GO=YES` means the reviewed PR set is in main and final Hosted quality passed; it does not mean production is releasable.

## K. Deployment Run

`DEPLOY_RUN_ID=N/A`, `DEPLOY_STATUS=NOT_RUN`. The formal `Deploy KingTurf Production` workflow was not dispatched because the nonwaived recovery, restore, rollback and UAT gates are incomplete. No local SSH deployment was used as a substitute.

## L. Post-Deploy Smoke

`NOT_RUN`. Pre-deployment public health/ready/version evidence still describes the old production SHA only. No post-deploy version, login, authorization or audit smoke is claimed.

## M. Production Version Receipt

```text
PRODUCTION_PREVIOUS_SHA=9d89c7d6739454345b1397fe6b02c945fbe1cb99
PRODUCTION_TARGET_SHA=NOT_SELECTED_PRODUCTION_NO_GO
API_HEALTH=OLD_VERSION_BASELINE_ONLY
API_READY=OLD_VERSION_BASELINE_ONLY
API_VERSION=9d89c7d6739454345b1397fe6b02c945fbe1cb99
WEB_VERSION=NOT_VERIFIED_POST_DEPLOY
POST_DEPLOY_SMOKE=NOT_RUN
POST_DEPLOY_SECURITY=NOT_RUN
PHOENIX_IMPACT=NONE_OBSERVED_NO_CHANGE
```

## N. Remaining Risks

- Administrator protection and production environment rules remain unconfigured; current account cannot change them.
- Complete current recovery materials, trusted provenance/retention and isolated restore are missing.
- Safe application rollback target and real failure drill are missing.
- Business-role UAT remains pending.
- Final-main browser-only replay is not freshly executed after merge; Hosted full quality passed and historical browser evidence is retained separately.

## O. Next

1. Keep final main `3ec6d83...` as the integration checkpoint; do not rerun unchanged full CI.
2. Operations owner delivers the frozen current DB/files/config bundle through an approved complete-transfer channel; record manifest, SHA, source SHA, UTC time and independent-copy evidence.
3. Run the prepared isolated restore and integrity checks without migration repair, then build and test the compatible emergency rollback baseline.
4. Complete final-SHA business UAT and any required browser-only replay.
5. Only when all nonwaived gates pass, dispatch the formal production workflow with exact final main SHA and record deployment/post-deploy receipts.
