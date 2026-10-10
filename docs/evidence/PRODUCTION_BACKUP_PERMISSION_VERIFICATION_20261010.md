# PRODUCTION_BACKUP_PERMISSION_VERIFICATION

Date: 2026-10-10 Asia/Singapore. This is a read-only deployment and backup-permission verification after the reported SSH whitelist change. No backup command, production write, permission change or shared-service operation was performed.

## Production server

```text
PRODUCTION_SERVER_VERIFICATION=PASS_READONLY
SSH_APPROVED_USER=phoenix-codex-deploy
SSH_HOST=iZt4nj11ry11ofv03yi35vZ
SSH_PORT=22
OS=Ubuntu 24.04.4 LTS
KERNEL=6.8.0-107-generic x86_64
DATA_MOUNT=/data -> /dev/nvme1n1 ext4
DATA_AVAILABLE_BYTES=96826028032
```

The approved host key and curve25519 exchange remain in use. No private key or configuration secret was read.

## Deployment and storage

```text
COMPOSE_PROJECT=kingturf-erp-production
POSTGRES_CONTAINER=kingturf-erp-production-postgres-1
POSTGRES_IMAGE=postgres:17.7-alpine3.23
POSTGRES_BIND_PATH=/data/kingturf-erp-data/postgres:/var/lib/postgresql/data (rw)
ATTACHMENT_BIND_PATH=/data/kingturf-erp-data/attachments:/var/lib/kingturf/attachments (rw)
BACKUP_DIRECTORY=/data/kingturf-erp-backups
BACKUP_STAGING=/data/kingturf-erp-backups/staging (ABSENT)
```

All three KingTurf containers were reported healthy and running. The API release marker and `/version` both report the current production SHA `9d89c7d6739454345b1397fe6b02c945fbe1cb99`, builtAt `33996421402`; the requested main SHA has not been deployed.

## Permission and service result

```text
BACKUP_ACL=/data/kingturf-erp-backups root:root 750; read=no write=no search=no
BACKUP_STAGING=ABSENT
RELEASE_BACKUPS=/data/kingturf-erp/.release-backups root:root 755; read=yes write=no search=yes
ATTACHMENTS_DIRECTORY=root:root 755; read=yes write=no
CONFIGURATION=/data/kingturf-erp/.env.production root:root 600; read=no
BACKUP_EXECUTION_IDENTITY=phoenix-codex-deploy uid1002 groups docker
BACKUP_SERVICE_AVAILABLE=NO_KINGTURF_SERVICE_FOUND
```

The only matching systemd timer found in the bounded host check was `dpkg-db-backup.timer`; no KingTurf/PostgreSQL backup service or controlled private receiving endpoint was identified. `getfacl` is unavailable on the host, so no ACL grant is inferred from mode bits.

## Current decision

No backup was started because there is no approved writable KingTurf destination and no formal backup service read-back path. Docker metadata access does not authorize using the Docker daemon to bypass host file permissions. No root, chmod/chown, alternate identity, Phoenix storage, temporary public path or SSH stdout transfer was used.

Minimum administrator operation: create `/data/kingturf-erp-backups/staging` as a KingTurf-only directory with a narrowly scoped write/read-back ACL for the approved backup execution identity, or provide an existing authorized backup service that returns a frozen custom dump, attachment/configuration materials and manifest. This must include an independent-copy route before `COMPLETE_RECOVERY_BUNDLE=PASS`.

```text
ON_HOST_BACKUP=NO
DATABASE_DUMP_SHA256=N/A
ATTACHMENT_BACKUP=NOT_STARTED
ENCRYPTED_CONFIG_BACKUP=NOT_STARTED
INDEPENDENT_COPY=NO
COMPLETE_RECOVERY_BUNDLE=NO
ISOLATED_RESTORE=NO
RESTORE_VERIFIED=NO
PRODUCTION_DATABASE_MUTATION=NO
PRODUCTION_DEPLOYMENT=NO
PHOENIX_IMPACT=NONE_OBSERVED
BLOCKERS=NO_APPROVED_WRITABLE_BACKUP_DESTINATION_NO_FORMAL_KINGTURF_BACKUP_SERVICE
NEXT=ADMIN_CREATE_STAGING_ACL_OR_ENABLE_EXISTING_BACKUP_SERVICE_THEN_HOST_SIDE_DUMP
```
