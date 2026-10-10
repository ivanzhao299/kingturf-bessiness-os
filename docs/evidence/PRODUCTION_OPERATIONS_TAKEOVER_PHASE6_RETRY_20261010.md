# PRODUCTION_OPERATIONS_TAKEOVER_PHASE6_RETRY

Date: 2026-10-10 Asia/Singapore. The user reported a new SSH whitelist change, so Phase 6 performed one bounded retry. Large-output diagnostics were not repeated. Small authorized commands succeeded, but no production backup write was attempted because the approved KingTurf destinations are not writable by the current identity.

## New production facts

- SSH alias `phoenix-prod` reached the expected host and identity; small command sessions completed.
- UID `1002` is `phoenix-codex-deploy`, in Docker group `988`.
- `/data` is `/dev/nvme1n1` ext4 with approximately `96,826,036,224` bytes available.
- `kingturf-erp-production-web-1`, `api-1` and `postgres-1` are healthy and running. No Phoenix or shared service was touched.
- Read-only PostgreSQL metadata: database size `31,935,635` bytes; registry rows `70`; `AVAILABLE` attachment rows `0`.
- `/data/kingturf-erp/.release-backups`: root:root mode755, readable but not writable by the current identity.
- `/data/kingturf-erp-backups`: root:root mode750, not readable, searchable or writable by the current identity.
- `/data/kingturf-erp-data/attachments`: root:root mode755, readable but not writable by the current identity.
- `/data/kingturf-erp/.env.production`: root:root mode600, not readable or writable by the current identity.
- No formal KingTurf backup executable was found in the bounded read-only search of `/usr/local/bin`, `/opt` and the KingTurf directory. `getfacl` is not installed, so no ACL evidence is inferred.

## Backup decision

The database is small enough for a host-side custom-format dump in principle, and `/data` has sufficient free space. However, there is no authorized writable KingTurf backup destination available to the current identity. The backup command was intentionally **not** started: writing to `/tmp`, the PostgreSQL data bind, a container filesystem, or a root-only directory would violate the production boundary or fail to provide a durable approved recovery point.

```text
ACTION=HOST_SIDE_KINGTURF_CUSTOM_DUMP_PRECHECK
IMPACT=READ_ONLY_METADATA_ONLY
TARGET=KINGTURF_DATABASE_AND_ATTACHMENTS_CONFIG_RECOVERY
STORAGE=NO_CURRENT_IDENTITY_WRITABLE_APPROVED_DESTINATION
ROLLBACK=NO_PRODUCTION_CHANGE_PERFORMED
VERIFICATION=PRECHECK_COMPLETE_BACKUP_NOT_STARTED
```

## Exact minimum unblock

One of these narrowly scoped operations is required from an authorized administrator or existing backup service:

1. Grant the approved account write-only access to a new KingTurf-specific directory on `/data` (for example a dedicated subdirectory, mode0700 with ownership/ACL for `phoenix-codex-deploy`) while preserving existing historical backup files; or
2. Run an existing host-side backup service as its already authorized identity and expose a frozen custom dump, attachment empty-state/archive, encrypted configuration package and manifest through a controlled read-back path.

This does not require root shell access, Phoenix access, Docker host mounts or broad permission changes. The operation must return the destination path, capacity, owner/ACL policy and independent-copy route. After that single resource change, the prepared sequence can generate the custom dump host-side, create the attachment/configuration evidence and continue to isolated restore.

## Current state

No database dump, attachment archive, configuration recovery material, manifest, checksum or independent copy was created in this retry. No production database/schema write, container restart, Phoenix/shared-service action or deployment occurred. Existing historical backup material remains untouched.

```text
ON_HOST_BACKUP=NO
DATABASE_BACKUP=NOT_STARTED
ATTACHMENT_BACKUP=NOT_STARTED
CONFIG_ENCRYPTED_BACKUP=NOT_STARTED
MANIFEST_VERIFIED=NO
SECURE_TRANSFER=NOT_STARTED
INDEPENDENT_COPY=NO
COMPLETE_RECOVERY_BUNDLE=NO
ISOLATED_RESTORE=NO
ROLLBACK_DRILL=NOT_RUN
PRODUCTION_DATABASE_MUTATION=NO
PRODUCTION_DEPLOYMENT=NO
PHOENIX_IMPACT=NONE_OBSERVED
RECOVERY_BLOCKER_RESOLVED=NO
RELEASE_GO_NO_GO=NO_GO
NEXT=PROVIDE_DEDICATED_WRITABLE_BACKUP_DESTINATION_OR_RUN_APPROVED_BACKUP_SERVICE
```
