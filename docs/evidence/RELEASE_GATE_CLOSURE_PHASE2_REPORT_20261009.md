# RELEASE_GATE_CLOSURE_PHASE2_REPORT

Date: 2026-10-09 Asia/Singapore. Branch `codex/release-gate-closure`; prior checkpoint `3151a36`; phase-2 preparation follows checkpoint `3adb383`. This phase does not repeat the solved migration-registry comparison or candidate CI. **RELEASE_GO_NO_GO=NO_GO.**

## A. Current Gate State

Read-only GitHub refresh shows main `9d89c7d6739454345b1397fe6b02c945fbe1cb99`, `protected=false`, rulesets/effective main rules empty, production protection rules empty and deployment branch policy null. Acting `emvia` remains write/non-admin. PR #33/#31/#32/#34 remain open with exact heads unchanged; each current check is the GitHub Actions App15368 `quality` job and prior Hosted runs remain successful. PR #34 still targets the PR #33 branch. No merge, protection mutation, direct main push, force push or deployment was attempted. The user waived human technical/production approval in the current instruction; no GitHub human Review was fabricated. Administrator configuration remains an external action, not repeatedly attempted.

Prepared governance and review packet: `docs/deployment/release-gates/ADMIN_AND_REVIEW_HANDOFF.md`, protection payload alternatives, and updated PR bodies linked to checkpoint `3adb383`. Minimum policy remains PR-only, current-base `quality` from App15368, no force/delete/bypass, and production main-only. The user's Codex approval waiver does not grant GitHub Administration permission or override platform protection when configured.

## B. Production Read-only Diagnostics

Approved SSH alias, host fingerprint, curve25519 exchange, identity existence and UID/group were revalidated. A phase probe completed connection, public-key authentication, remote command acceptance and exit status 0. Inventory completed mount, disk, protected-file and Docker metadata checks. KingTurf and Phoenix containers remained healthy; no shared service was changed.

Production registry remains already verified **70/70 exact name+SHA match**, missing/extra/mismatch 0. It was not re-run in this phase. Minimal read-only query and server-side bounded summary evidence remain in the previous report.

## C. Transfer Failure Localization

The previous report's “20,480 bytes” is historical report metadata; the raw SSH logs do not contain a direct byte count. This phase records a bounded size experiment using fixed non-sensitive output and a 1 KiB historical-file prefix:

| Probe                          | Result                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| Fixed 1 KiB stdout             | exit 0, 1,025 bytes including newline                                                         |
| Fixed 8 KiB stdout             | exit 255, 0 bytes after timeout                                                               |
| Fixed 32 KiB stdout            | exit 255, 0 bytes after timeout                                                               |
| Fixed 128 KiB stdout           | exit 255, 0 bytes after timeout                                                               |
| Historical dump metadata + SHA | exit 0; size1,372,272; SHA `c8219065119fedd58096f8b3cd85cb099b2792c26436cc31a64b7878c515eba4` |
| Historical dump 1 KiB prefix   | exit 0, decoded1,024 bytes                                                                    |

The probes used the approved host, identity, strict host key and curve25519 settings. They made no remote writes and returned no business data beyond a bounded prefix in a private ignored evidence directory. SSH debug shows the failure after command acceptance during output/connection handling; `read failed rfd ... Broken pipe` is followed by EOF and can be stdin-pipe cleanup, so it is not treated as the root cause. Successful queries received SSH window adjustments; evidence does not support an MTU or SSH-window exhaustion conclusion. The exact lower-layer disconnect remains NOT_VERIFIED.

Metadata-only access and a 1 KiB prefix are insufficient for a backup. The current database dump stream previously stopped partway through; no complete current dump, attachment archive or configuration recovery material exists locally. Current config remains root:600 and unreadable; independent backup directory remains root:750 and unreadable/unsearchable. Approved directories are not writable. No Docker host bind, root, alternate identity or permission workaround was used.

### Required operational action

The approved operations owner must provide a stable, frozen recovery bundle through an approved channel that supports a complete transfer: database custom dump, attachment archive, encrypted/separately held configuration recovery material, manifest, SHA-256, byte sizes, UTC backup time, exact source SHA and independent-copy/retention evidence. The current SSH identity needs a readable staged export or an approved resumable transport endpoint. A 1 KiB success does not prove that a 1 MB transfer can succeed. Partial files remain invalid and must not be concatenated with a new live dump.

## D. Restore and Rollback

No real restore was started because the complete bundle is unavailable. The previously prepared `restore-integrity.sql`, manifest verifier and isolation runbook remain validated on synthetic fixtures only. They correctly keep `RESTORE_VERIFIED`, provenance, snapshot-time and independent-copy fields false until real materials and restored data are checked.

No rollback drill was started. Old main remains unsafe as a target because it runs startup DDL and lacks the new session lock protocol. The minimum safe target remains an emergency baseline preserving SELECT-only startup, authentication locking/revocation/audit and source/nested authorization, with only the faulty application surface reverted. That baseline is designed but not implemented or drilled.

## E. UAT and Integration

Final main is still not integrated, so no final-SHA business acceptance was manufactured. Automated candidate evidence remains historical and synthetic. Business role acceptance remains `PENDING`; Codex does not sign for business participants. The merge order remains #33 → #31 → #32 → #34, followed by a clean-main Batch 4 PR and final main verification. No merge was attempted because actual administrator protection is still absent.

## F. Current Decision

```text
MAIN_HEAD=9d89c7d6739454345b1397fe6b02c945fbe1cb99
MAIN_PROTECTION=MISSING_ACTOR_NON_ADMIN
PRODUCTION_PROTECTION=MISSING
PR33_MERGED=NO
PR31_MERGED=NO
PR32_MERGED=NO
PR34_MERGED=NO
BATCH4_PR=BLOCKED_UNINTEGRATED_BASE
BATCH4_MERGED=NO
FINAL_MAIN_CI=NOT_RUN_UNINTEGRATED
PRODUCTION_MIGRATION_REGISTRY=70/70_EXACT_MATCH_PREVIOUSLY_VERIFIED
PRODUCTION_CATALOG_COMPATIBILITY=NOT_VERIFIED_FULL_CONSTRAINT_AND_DATA_RESTORE
CURRENT_BACKUP_COMPLETE=NO
BACKUP_TRANSFER=SIZE_THRESHOLD_FAILURE_METADATA_AND_1K_ONLY
CONFIG_RECOVERY_MATERIAL=NOT_READABLE_CURRENT_USER
RESTORE_VERIFIED=NO
ROLLBACK_TARGET=NOT_ACCEPTED
ROLLBACK_DRILL=NOT_RUN
BUSINESS_UAT=PENDING
RELEASE_GO_NO_GO=NO_GO
DEPLOY_RUN_ID=N/A
DEPLOY_STATUS=NOT_RUN
POST_DEPLOY_VERIFICATION=NOT_RUN
PHOENIX_IMPACT=NONE_OBSERVED
PRODUCTION_DATABASE_MUTATION=NO
BLOCKERS=ADMIN_PROTECTION_COMPLETE_BUNDLE_REAL_RESTORE_SAFE_ROLLBACK_BUSINESS_UAT
NEXT=ADMIN_READBACK_STABLE_BUNDLE_ISOLATED_RESTORE_ROLLBACK_UAT_THEN_PROTECTED_INTEGRATION
```

## G. Evidence and Cleanup

Phase-2 sanitized probe outputs are under ignored `.local-acceptance/gate-phase2-20261009/`; no secrets, private keys, connection strings or unbounded business data are included. Any partial transfer is not accepted as a backup. No production or Phoenix write occurred. The source remains ready for the next gate change; do not repeat unchanged full CI or migration investigation.
