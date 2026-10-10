# Production Recovery Phase 7 Report

Date: 2026-10-10 (Asia/Singapore). This is an incremental gate report after Phase 6. It records the unchanged frozen host artifact, configuration/receiver discovery, and the exact external resources still required. No new database dump was generated.

## A. Frozen artifact verification

The approved SSH account re-read the Phase 6 manifest and verified every listed artifact on the production host without exposing business rows or configuration plaintext:

```text
manifest entries: 3
source production SHA: 9d89c7d6739454345b1397fe6b02c945fbe1cb99
database bytes: 1,399,180
database SHA-256: b95fb5a112a89c7016c2a6dbc5c880a72e6933a50098a709a24c78fdafc29491
pg_restore listing bytes: 171,004
pg_restore listing SHA-256: 0502bc034d9d8e0581a87a84a73114687611d0f2fcd4f805ed914be63a846448
attachment proof SHA-256: 79ad9e34f628d2f749b96a31348b14fef02e822e8d39cf5cf54973cc54717a29
manifest SHA-256: b69257bf83737d0676f99e25723e46acde535c49ecf8e30ce5e36b5a92ed606c
artifact modes: 0600
partial files: 0
```

The staging directory remains writable by the deployment account, so these files are verified and frozen by naming/mode/process evidence only; they are not an immutable independent archive. No existing historical backup was modified or removed.

## B. Configuration recovery assessment

`/data/kingturf-erp/.env.production` remains mode 0600 and owned by root. Its contents were not read, copied, printed or mounted through Docker. A bounded host inventory found `gpg` installed, but no `age`, `sops`, `restic` or `rclone`, no KingTurf configuration-backup service, no encrypted configuration artifact in the dedicated staging directory, and no approved recipient key fingerprint or key identifier. The presence of a generic `gpg` binary is not evidence of a managed recovery recipient.

`CONFIG_ENCRYPTED_BACKUP=NOT_AVAILABLE` and `CONFIG_DECRYPTION_TEST=NOT_RUN`. The minimum missing resource is an administrator-approved recipient public key/key ID plus a documented production-side encrypted export entrypoint (or an existing configuration backup service). No key was generated because there is no separately controlled holder or recovery process.

## C. Independent copy assessment

No approved private object-storage bucket, backup receiver, or other independent KingTurf retention endpoint was exposed to the current identity. The only newly created artifacts remain on the production host under `/data/kingturf-erp-backups/staging`; no transfer was attempted. The prior unstable SSH output channel was not reused for a live dump or a speculative file transfer.

`INDEPENDENT_BACKUP_ENDPOINT=NOT_FOUND_OR_NOT_EXPOSED`, `INDEPENDENT_COPY=NO`, and `OFF_HOST_CHECKSUM=NOT_RUN`. The minimum missing resource is a named private receiver with an approved access path, encryption/retention policy, and receiver-side size/SHA-256 read-back.

## D. Full restore gate

The Phase 6 temporary no-network database-container restore remains valid historical evidence for the frozen host file: PostgreSQL 17.7 restore exit 0, 70 migration rows, the expected 17 historical `NOT VALID` constraints and all evaluated data checks passed. Phase 7 did not repeat it because no independent copy or configuration material became available.

The complete restore runbook therefore remains unexecuted from an independent copy. There is no configuration reconstruction, full application startup, joint database/files snapshot, or full-system RPO/RTO result to accept.

```text
MANIFEST_PROVENANCE=HOST_GENERATED_AND_RECHECKED; INDEPENDENT_ATTESTATION=NO
JOINT_SNAPSHOT_CONSISTENCY=NOT_VERIFIED
COMPLETE_RECOVERY_BUNDLE=NO
ISOLATED_FULL_RESTORE=NOT_RUN
SCHEMA_COMPATIBILITY=PHASE6_DATABASE_ONLY_EVIDENCE
DATA_INTEGRITY=PHASE6_DATABASE_ONLY_PASS
ATTACHMENT_INTEGRITY=EMPTY_STATE_PROOF_ONLY
CONFIG_RECOVERY=NOT_VERIFIED
RECOVERY_POINT=2026-10-10T01:00:31Z database artifact filename; joint snapshot not established
RESTORE_DURATION=NOT_RUN_PHASE7 (Phase6 database-only restore was 1s, 2s total container)
RPO_EVIDENCE=DATABASE_ONLY
RTO_EVIDENCE=NO_FULL_SYSTEM_MEASUREMENT
RESTORE_VERIFIED=NO
ROLLBACK_READY=NO
BUSINESS_UAT=NOT_VERIFIED
```

## E. Production safety

No production database/schema mutation, deployment, container restart, Phoenix operation, shared-service change, or permission bypass occurred. The production application remains on `9d89c7d6739454345b1397fe6b02c945fbe1cb99`; the candidate main remains `3ec6d83c3e12a417dfe7087dd9a7d9fa6fc6d73f`. Production remains `NO_GO`.

## F. Minimum next actions

1. An authorized administrator supplies a named private independent receiver and its approved access path, retention policy and receiver-side checksum procedure.
2. An authorized configuration owner supplies a recipient public key/key ID and the formal host-side encrypted export/recovery procedure; the plaintext remains root-controlled.
3. Copy the already-frozen artifacts only after those controls exist, verify receiver-side bytes/SHA-256/manifest, and retain the independent copy.
4. Execute the complete isolated restore and application read-only startup from that independent copy, then perform the security-preserving rollback drill and business UAT.

Until those actions produce evidence, retain the successful host backup and keep production deployment blocked.
