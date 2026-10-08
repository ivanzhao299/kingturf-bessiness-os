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

## Release input and control policy

Dispatch the workflow from `main` in `ivanzhao299/kingturf-bessiness-os`. The only accepted input is an exact lowercase 40-character commit SHA in the freshly fetched canonical `origin/main` history. Branch names, tag names, abbreviated SHAs, annotated tag object SHAs, missing commits and unmerged branch commits are rejected. A tagged main commit is accepted by its underlying commit SHA. There is no separate release-branch or tag-ref publishing policy.

The validator checks the canonical origin URL, exact control checkout, commit object types and ancestry before verification. It pins the workflow's own commit as the release control version; verification and deployment both check out and assert the same validated application SHA. After the production concurrency slot is acquired, the control checkout fetches main and revalidates both application and control commits before loading the SSH key. Network or validation failures deny deployment.

Historical main commits remain eligible for application rollback using the same workflow. Use the current main workflow with the old application SHA; do not dispatch an old workflow branch. The cleanup control comes from the pinned workflow commit and is streamed over SSH, so an old application's cleanup script is not executed and no predictable temporary cleanup script is staged on the shared host. Historical SHA eligibility does not prove compatibility with the current database schema: verify that compatibility, the existing backup, migration state and rollback plan before releasing. Do not restore or reverse production migrations automatically.

Only the production `deploy` job uses concurrency group `kingturf-erp-production` with `cancel-in-progress: false`; ordinary CI and verification remain parallel. Any future workflow writing the same production target must use this exact group, without incorporating branch, workflow name or candidate SHA. GitHub's default concurrency has one pending slot; a newer pending request can replace an older pending request. This is mutual exclusion, not a durable queue for every dispatch. See [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency). Manual SSH, interrupted remote processes and out-of-band scripts are outside this scheduler's lock; operators must inspect running processes and runtime health before recovery.

These controls require a trusted workflow and protected main history. Enable main required reviews/status checks, forbid force push/deletion and restrict the production environment to main with independent approval. Workflow self-checks cannot prevent a sufficiently privileged user from modifying the workflow to bypass them. Batch 1 audits and recommends these GitHub settings; it does not apply them.

Run `pnpm test:release-guardrails` for local Git/input tests and shell replay with isolated command substitutes. `pnpm lint` includes the release scripts and `pnpm test` includes these guardrail tests before workspace tests. This does not trigger a deployment or prove the hosted scheduler, SSH runtime or database rollback has been exercised.

Before every production synchronization, the deployment workflow creates a PostgreSQL custom-format recovery point under `.release-backups/` and records the previous and candidate release SHAs. The new recovery point and every older recovery point remain intact until the candidate passes local and public health, readiness, and exact-version checks. After those checks pass, the workflow retains only the newest verified `.dump` and matching `.metadata` pair and removes older KingTurf release-backup pairs. A failed deployment does not run cleanup, so it cannot erase the pre-deploy recovery point needed for investigation or recovery.

The recovery point is created and checked before synchronizing the configured website ingest secret. Backup failure prevents that configuration write. A later release failure can still leave the synchronized configuration or partially updated application in place; there is no automatic configuration or application rollback. Preserve recovery artifacts and inspect actual runtime state before an explicitly approved recovery.

`.release-sha` records the last release that passed the required local and public probes. It is atomically replaced only after a fresh exact JSON `/version` check. Compose failure, readiness failure or a required version/HTTPS probe failure preserves the previous marker and recovery dump. The marker does not prove the runtime remained unchanged after a partial update or interruption; always compare `/version`, container state and health. Success-only cleanup runs after marker promotion, so cleanup failure may coexist with a verified running candidate and must be investigated separately.

After a successful deployment, the workflow also removes unused Docker images carrying the `kingturf-erp-production` Compose project label. It derives the protected image IDs from every KingTurf project container before removal and verifies the live API again afterward. It does not run host-wide image or builder-cache pruning, does not remove the shared PostgreSQL image, and must never remove Phoenix ERP, the KingTurf website, another Compose project's images, containers, volumes, database files, attachments, or backups. Application rollback redeploys the selected immutable SHA through the same workflow; additive database migrations remain in place unless an explicitly reviewed forward-fix is required. Attachment storage is never deleted or rewritten by deployment, cleanup, or application rollback.

The deployment is successful only when the exact candidate SHA passes the verify job, the server-local health/readiness/version probes, and the public HTTPS health/readiness probes. A public probe failure blocks the workflow; it is not advisory evidence.

## Storage safeguards

Each of the three project containers uses JSON log rotation (`10m`, three files), approximately 30 MB per container plus rollover overhead. This affects diagnostic stdout/stderr only; business audit events and immutable document versions remain in PostgreSQL. Do not truncate Docker-owned log files by hand. Existing containers need recreation through the official deployment before the new policy applies.

The API installs production dependencies only. Docker build context excludes release backups, test reports and local output artifacts. These exclusions do not delete any source files or backups. The success-only, project-scoped backup/image cleanup above remains the only automated cleanup; no host-wide prune is authorized.

Retaining one deployment dump is not a complete disaster-recovery strategy. Independently verify attachment coverage and an isolated restore exercise, and establish off-host backup retention before claiming a recovery SLA. Existing migration recovery points must remain untouched without separately approved retirement and restore acceptance.
