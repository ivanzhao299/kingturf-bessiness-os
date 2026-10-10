# Production Operations Takeover — Phase 6 Backup Result

Date: 2026-10-10 (Asia/Singapore). This report records the first successful KingTurf-scoped host-side backup after the administrator granted the approved SSH account ACL access to `/data/kingturf-erp-backups/staging`. It does not claim a complete disaster-recovery bundle or production release readiness.

## A. Scope and safety boundary

The approved identity was `phoenix-codex-deploy` through the existing `phoenix-prod` SSH alias. The operation was limited to the KingTurf PostgreSQL container, the KingTurf attachment bind, and the dedicated staging directory. No Phoenix path, Phoenix container, shared Nginx, production schema, migration, application container, or production deployment was modified.

The staging ACL was verified before writing:

```text
owner root:root, directory mode 0770
user:phoenix-codex-deploy:rwx, mask:rwx, other:---
```

An exclusive create/write/read/delete probe succeeded as the approved account. The `/data` filesystem was the expected ext4 data mount and had sufficient free space for this small database. The KingTurf web, API and PostgreSQL containers were healthy before and after the operation; all observed restart counts remained zero. The temporary restore containers were removed after each isolated test.

## B. Database backup

The PostgreSQL container was `postgres:17.7-alpine3.23`. A custom-format `pg_dump` ran inside the KingTurf PostgreSQL container, with its output redirected on the production host to a staging partial file. The complete dump was never streamed through SSH stdout. The command exited 0 and the archive began with the PostgreSQL custom-format `PGDMP` header.

The partial file was promoted without overwriting an existing file by creating a same-filesystem hard link, applying mode 0600, and removing only the operation-owned partial name. The frozen artifact is:

```text
/data/kingturf-erp-backups/staging/kingturf-20261010T010031Z-before-9d89c7d6739454345b1397fe6b02c945fbe1cb99.dump
bytes: 1,399,180
sha256: b95fb5a112a89c7016c2a6dbc5c880a72e6933a50098a709a24c78fdafc29491
mode: 0600
source production SHA: 9d89c7d6739454345b1397fe6b02c945fbe1cb99
```

`pg_restore --list` ran against the frozen file in a read-only helper container and exited 0. Its frozen listing is 171,004 bytes with SHA-256 `0502bc034d9d8e0581a87a84a73114687611d0f2fcd4f805ed914be63a846448`.

The first wrapper attempt stopped after creating the archive because its assertion queried a non-existent table named `migration_registry`. The production schema uses `public.schema_migrations`; this was a validation-script defect, not an archive or database failure. The archive was retained and revalidated without regenerating or overwriting it. No schema or data write occurred.

## C. Attachment state

The host attachment directory was scanned for regular files, directories and symlinks, and the database was checked against `public.attachments` and its `AVAILABLE` state. The result at the bounded observation was:

```text
regular files: 0
directories: 0
symlinks: 0
database attachment rows: 0
AVAILABLE rows: 0
schema_migrations rows: 70
```

The empty-state proof is frozen at:

```text
/data/kingturf-erp-backups/staging/kingturf-20261010T010031Z-before-9d89c7d6739454345b1397fe6b02c945fbe1cb99.attachments-empty.json
sha256: 79ad9e34f628d2f749b96a31348b14fef02e822e8d39cf5cf54973cc54717a29
mode: 0600
```

This supports an empty attachment state, but the filesystem observation and PostgreSQL dump are not one atomic filesystem/database snapshot. It is therefore not treated as proof of a general files-plus-database disaster-recovery snapshot.

## D. Manifest and configuration

The host manifest was created with source SHA, UTC creation time, PostgreSQL image, artifact sizes, modes and SHA-256 values. It is stored at:

```text
/data/kingturf-erp-backups/staging/kingturf-20261010T010031Z-before-9d89c7d6739454345b1397fe6b02c945fbe1cb99.manifest.json
sha256: b69257bf83737d0676f99e25723e46acde535c49ecf8e30ce5e36b5a92ed606c
mode: 0600
```

No approved encrypted configuration-backup entry was exposed to this identity. Production configuration plaintext was not read, printed or permission-bypassed. The manifest records configuration recovery as unavailable and is deliberately not a complete recovery manifest.

## E. Isolated database restore evidence

The frozen dump was restored twice in temporary PostgreSQL 17.7 containers with `--network none`, a temporary filesystem, and a read-only bind of only the frozen dump. No production volume or external service was connected. The successful restore exited 0; total container start/restore time was 2 seconds, with the restore itself taking 1 second.

Restored metadata counts were:

```text
schema_migrations: 70
attachments: 0
customers: 2
sales_orders: 1
ar_documents: 2
bank_payments: 2
collection_cases: 0
capa_cases: 0
```

The read-only integrity run exited 0. It reported 17 unvalidated constraints, matching the documented historical `0055` NOT VALID baseline. All evaluated CHECK/FK and business checks passed: negative AR balances 0, negative payment balances 0, allocation currency mismatches 0, order-line total mismatches 0, invalid available attachments 0 and active bindings to unavailable attachments 0. This is a real isolated database restore and data-integrity result, not the earlier synthetic SQL-only result.

It is not full `RESTORE_VERIFIED`: no independent copy was available, configuration recovery was unavailable, and no atomic files-plus-database snapshot was established.

## F. Current acceptance state

```text
ON_HOST_BACKUP=PASS
DATABASE_BACKUP=PASS
ATTACHMENT_BACKUP=EMPTY_STATE_PROOF_PASS
CONFIG_ENCRYPTED_BACKUP=NO
MANIFEST_VERIFIED=PASS_ON_HOST
SECURE_TRANSFER=NOT_AVAILABLE
INDEPENDENT_COPY=NO
COMPLETE_RECOVERY_BUNDLE=NO
ISOLATED_DATABASE_RESTORE=PASS
DATABASE_INTEGRITY=PASS
SCHEMA_COMPATIBILITY=PASS_FOR_RESTORED_DATABASE_ONLY
ATTACHMENT_INTEGRITY=EMPTY_STATE_ONLY
CONFIG_RECOVERY_VERIFIED=NO
RESTORE_VERIFIED=NO
PRODUCTION_DATABASE_MUTATION=NO
PRODUCTION_DEPLOYMENT=NO
PHOENIX_IMPACT=NONE_OBSERVED; Phoenix containers healthy, restart count 0
SHARED_SERVICE_IMPACT=NONE_OBSERVED
RELEASE_GO_NO_GO=NO_GO
```

The remaining blockers are narrow and concrete: an approved encrypted configuration recovery artifact, an approved independent receiving/retention endpoint with read-back checksum verification, and then a complete restore acceptance that includes those materials. A safe application rollback drill and business UAT remain separate release gates.

## G. Next

1. Keep the frozen host artifacts unchanged and obtain an approved independent copy through the existing backup service or controlled receiver; do not use SSH stdout, Docker host mounts or alternate identities.
2. Obtain the encrypted configuration recovery artifact through its authorized entrypoint without exposing plaintext.
3. Re-run the existing restore runbook from the independent copy, including configuration reconstruction and full files-plus-database acceptance; then perform the emergency application rollback drill.
4. Keep production deployment `NO_GO` until complete recovery, rollback and business UAT gates are independently satisfied.
