# KingTurf production — Singapore runbook

The sole production entry is `https://erp.kingturf.cn`. The Singapore host is `47.236.122.224`, shared with Phoenix ERP and the independent KingTurf website. This file retains its historical filename for existing links; its authority is the current deployment below:

- separate `PROD_DEPLOY_PATH=/data/kingturf-erp`;
- separate Compose project `kingturf-erp-production`;
- PostgreSQL at `/data/kingturf-erp-data/postgres` via `KINGTURF_POSTGRES_DATA_PATH`;
- attachments at `/data/kingturf-erp-data/attachments` via `KINGTURF_ATTACHMENT_DATA_PATH`;
- separate web port (default `4332`);
- separate reverse-proxy virtual host for `erp.kingturf.cn`.

The ext4 data disk is mounted at `/data`; backups belong to `/data/kingturf-erp-backups`. Never fall back to the system disk silently if the mount is unavailable. Verify `findmnt /data` and bind mounts before deployment. The website uses its own `kingturf-site` container and port `3500`. Do not share directories, containers, volumes, ports or secrets between these projects.

The GitHub `production` environment must contain `PROD_SSH_HOST`, `PROD_SSH_PORT`, `PROD_SSH_USER`, `PROD_SSH_PRIVATE_KEY`, and `PROD_DEPLOY_PATH`. The remote `.env.production` is created and retained by operations; it is never overwritten by rsync.

Within the API container, persistent attachments are available at `/var/lib/kingturf/attachments`. They must be included in the backup policy and never removed by deployment or rollback. The host reverse proxy routes `erp.kingturf.cn` to port `4332`. Releases must use `.github/workflows/deploy-production.yml` with an exact main SHA; manual file uploads are not a release path.

Before every production synchronization, the deployment workflow creates a PostgreSQL custom-format recovery point under `.release-backups/` and records the previous and candidate release SHAs. The new recovery point and every older recovery point remain intact until the candidate passes local and public health, readiness, and exact-version checks. After those checks pass, the workflow retains only the newest verified `.dump` and matching `.metadata` pair and removes older KingTurf release-backup pairs. A failed deployment does not run cleanup, so it cannot erase the pre-deploy recovery point needed for investigation or recovery.

After a successful deployment, the workflow also removes unused Docker images carrying the `kingturf-erp-production` Compose project label. It derives the protected image IDs from every KingTurf project container before removal and verifies the live API again afterward. It does not run host-wide image or builder-cache pruning, does not remove the shared PostgreSQL image, and must never remove Phoenix ERP, the KingTurf website, another Compose project's images, containers, volumes, database files, attachments, or backups. Application rollback redeploys the selected immutable SHA through the same workflow; additive database migrations remain in place unless an explicitly reviewed forward-fix is required. Attachment storage is never deleted or rewritten by deployment, cleanup, or application rollback.

The deployment is successful only when the exact candidate SHA passes the verify job, the server-local health/readiness/version probes, and the public HTTPS health/readiness probes. A public probe failure blocks the workflow; it is not advisory evidence.

## Storage safeguards

Each of the three project containers uses JSON log rotation (`10m`, three files), approximately 30 MB per container plus rollover overhead. This affects diagnostic stdout/stderr only; business audit events and immutable document versions remain in PostgreSQL. Do not truncate Docker-owned log files by hand. Existing containers need recreation through the official deployment before the new policy applies.

The API installs production dependencies only. Docker build context excludes release backups, test reports and local output artifacts. These exclusions do not delete any source files or backups. The success-only, project-scoped backup/image cleanup above remains the only automated cleanup; no host-wide prune is authorized.

Retaining one deployment dump is not a complete disaster-recovery strategy. Independently verify attachment coverage and an isolated restore exercise, and establish off-host backup retention before claiming a recovery SLA. Existing migration recovery points must remain untouched without separately approved retirement and restore acceptance.
