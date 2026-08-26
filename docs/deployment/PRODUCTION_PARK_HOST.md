# KingTurf production on the Park host

KingTurf production is deployed to the same host as `park.cnjinhu.com`, but it is isolated from Park:

- separate `PROD_DEPLOY_PATH`;
- separate Compose project `kingturf-erp-production`;
- separate PostgreSQL and attachment volumes;
- separate web port (default `4332`);
- separate reverse-proxy virtual host for `erp.kingturf.cn`.

The GitHub `production` environment must contain `PROD_SSH_HOST`, `PROD_SSH_PORT`, `PROD_SSH_USER`, `PROD_SSH_PRIVATE_KEY`, and `PROD_DEPLOY_PATH`. The remote `.env.production` is created and retained by operations; it is never overwritten by rsync.

The attachment volume is persistent local storage at `/var/lib/kingturf/attachments`. It must be included in the server backup policy and must not be removed by deploy or rollback. The Park reverse proxy must route `erp.kingturf.cn` to the KingTurf web port; the workflow verifies both `/health` and `/ready` after deployment.

Before every production synchronization, the deployment workflow creates a PostgreSQL custom-format recovery point under `.release-backups/` and records the previous and candidate release SHAs. Backups are retained for 14 days. Application rollback redeploys the previous immutable SHA through the same workflow; additive database migrations remain in place unless an explicitly reviewed forward-fix is required. Attachment storage is never deleted or rewritten by either deployment or application rollback.

The deployment is successful only when the exact candidate SHA passes the verify job, the server-local health/readiness/version probes, and the public HTTPS health/readiness probes. A public probe failure blocks the workflow; it is not advisory evidence.
