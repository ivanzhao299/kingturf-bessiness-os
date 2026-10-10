# PRODUCTION_OPERATIONS_TAKEOVER_AND_RECOVERY_REPORT

Date: 2026-10-10 Asia/Singapore. Phase 6 backup-operation handoff was attempted within the approved KingTurf scope but could not begin because the approved SSH session reset before the remote preflight emitted any result. No production file, database, container, Phoenix or shared-service mutation occurred. This report records an operational blocker; it does not claim a backup or another recovery PASS.

## A. Production Operations Scope

Authorized scope: KingTurf production database logical backup, KingTurf attachment/configuration recovery material, checksums, controlled isolated restore and evidence. Excluded: production DDL/DML/migration, restore-over-production, Phoenix, shared Nginx/DNS/cert/firewall/systemd, root/alternate identities, permission bypasses, historical-backup deletion and production deployment.

The approved target remains the separate Compose project `kingturf-erp-production` under `/data/kingturf-erp`; Phoenix remains `/data/phoenix-erp` and its resources were not addressed. The formal deployment workflow's database backup step is a reference for intended custom-format backup semantics, not evidence that a current backup was produced by this turn.

## B. Access and Privilege Assessment

Previously verified approved SSH alias `phoenix-prod` uses the supplied ED25519 host key and curve25519 exchange. Existing sanitized inventory showed UID1002 with Docker group, KingTurf containers healthy, `/data` mounted and the database/attachment bind paths. Existing file metadata showed `.release-backups` readable but not writable, `/data/kingturf-erp-backups` root750 inaccessible, and `.env.production` root600 unreadable. Those facts are prior evidence, not a new write authorization.

This phase's bounded read-only preflight attempted to recheck identity, mounts, disk, directory permissions, KingTurf containers and read-only database size/attachment metadata. The SSH channel reset before the remote Python probe returned any JSON (`phase6-preflight.json` is empty; stderr records `Connection reset by peer`/`Broken pipe`). Therefore this run has no fresh size or permission result and did not continue to backup commands.

No root, sudo, alternate identity, Docker host bind or chmod/chown workaround was used. No formal backup service or approved private object-storage endpoint is configured in the repository or exposed to this execution context.

## C. Production Backup Plan

The intended safe sequence remains:

1. Read-only preflight with current host access.
2. Verify an existing writable, KingTurf-only backup directory on `/data` or an approved host-side backup service.
3. Generate custom-format `pg_dump` into a host-side temporary file using the KingTurf PostgreSQL container, never SSH stdout.
4. Validate nonzero size, PGDMP header, PostgreSQL version, SHA-256 and byte count.
5. Atomically publish a new0600 frozen file in a0700 dedicated directory without overwriting historical artifacts.
6. Create a trusted manifest with source SHA, UTC time, database version, snapshot consistency and attachment/configuration references.
7. Create or verify an independent controlled copy through an already approved backup channel.

The current run stopped before step2. No production backup command was launched.

## D. Actual Database Backup

```text
BACKUP_METHOD=NOT_STARTED_SSH_PREFLIGHT_RESET
BACKUP_LOCATION=NONE_CREATED
DATABASE_BACKUP=NO
DATABASE_BACKUP_SIZE=N/A
DATABASE_BACKUP_SHA256=N/A
ON_HOST_BACKUP=NO
```

The prior 2026-09-05 historical dump and checksum are not reused as a current backup. No partial current dump exists from this phase.

## E. Attachment Backup

No new attachment scan or archive was completed in this phase because the preflight session reset first. Prior evidence observed zero AVAILABLE attachment rows and zero attachment-directory entries, but this is not a current same-window empty-state proof. `ATTACHMENT_BACKUP=NO`.

## F. Encrypted Configuration Recovery

No configuration was read, copied, decrypted or changed. The current account previously could not read root600 `.env.production`. No approved encryption recipient or controlled configuration backup endpoint is available in the current execution context. `CONFIG_ENCRYPTED_BACKUP=NO`.

## G. Manifest and Checksums

No new recovery manifest was created. Existing manifest verifier and restore SQL remain preparation tools only. `MANIFEST_VERIFIED=NO`.

## H. Secure Transfer and Independent Copy

No transfer was attempted in this phase. The previously diagnosed SSH output channel remains `SSH_OUTPUT_TRANSFER_FAILURE_ROOT_CAUSE_UNCONFIRMED`; no repeated large-output or SFTP experiment was performed. There is no independent copy of a current snapshot in the controlled local evidence area. A complete package requires an approved host-side staging path plus an already approved private receiving endpoint, or a formally authorized read/write backup service identity.

## I. Isolated Restore

Not started because no current database/files/configuration package exists. `ISOLATED_RESTORE=NO`, `DATABASE_INTEGRITY=NOT_VERIFIED`, `SCHEMA_COMPATIBILITY=REGISTRY_ONLY`, `ATTACHMENT_INTEGRITY=NOT_VERIFIED`, `CONFIG_RECOVERY_VERIFIED=NO`.

## J. Data and Schema Integrity

Production registry 70/70 exact name/checksum matching remains previously verified and was not repeated. It does not establish complete catalog, historical data, attachment or configuration compatibility. No production schema or data was changed.

## K. Operational Impact

No backup command, database write, container restart, volume operation, file permission operation, Phoenix operation or shared-service operation occurred. The failed SSH preflight produced no application load beyond the connection attempt. `PHOENIX_IMPACT=NONE_OBSERVED`; `SHARED_SERVICE_IMPACT=NONE`.

## L. Remaining Risks

- The approved SSH channel reset before backup preflight; root cause remains unconfirmed.
- No current DB/files/config recovery package, independent copy, restore, RPO/RTO or rollback evidence.
- Existing user cannot write the previously observed approved directories or read root-only configuration.
- No formal private backup receiving endpoint or backup-service identity is available in the current repository/execution context.
- Production remains old SHA with previously identified security gaps; no deployment is safe until recovery and rollback gates pass.

## M. Minimum External Operation Required

Provide exactly one of the following through an existing approved operations channel:

1. A KingTurf-only host-side backup service/task that can write a0600 custom dump and attachment/config recovery materials to a dedicated0700 location and expose a manifest/checksum for controlled retrieval; or
2. A formally approved receiving endpoint and write-only/read-back credentials for the current SSH identity, with a documented path and capacity; or
3. A one-time authorized operator action that stages the frozen current bundle in a readable, non-Phoenix KingTurf directory while preserving permissions and an independent copy.

No root grant, Docker socket bypass, permission broadening, alternate account, public upload or shared-service change is requested. After delivery, resume the prepared restore/rollback runbook exactly once for the frozen package.

## N. Next

Stop this phase at `EXTERNAL_BACKUP_ENTRYPOINT_PENDING`. Do not repeat the same SSH preflight, stdout size tests, SFTP attempt or pg_dump stream. Resume only when a formal backup entrypoint/materials or new access/log evidence changes the gate state. Then validate source/checksums, restore in isolated PostgreSQL, verify data/attachments/configuration, perform the emergency-baseline drill and reassess production GO/NO_GO.
