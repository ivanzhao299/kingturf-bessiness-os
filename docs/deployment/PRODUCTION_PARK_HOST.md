# KingTurf production on the Park host

KingTurf production is deployed to the same host as `park.cnjinhu.com`, but it is isolated from Park:

- separate `PROD_DEPLOY_PATH`;
- separate Compose project `kingturf-erp-production`;
- separate PostgreSQL and attachment volumes;
- separate web port (default `4332`);
- separate reverse-proxy virtual host for `erp.kingturf.cn`.

The GitHub `production` environment must contain `PROD_SSH_HOST`, `PROD_SSH_PORT`, `PROD_SSH_USER`, `PROD_SSH_PRIVATE_KEY`, and `PROD_DEPLOY_PATH`. The remote `.env.production` is created and retained by operations; it is never overwritten by rsync.

The attachment volume is persistent local storage at `/var/lib/kingturf/attachments`. It must be included in the server backup policy and must not be removed by deploy or rollback. The Park reverse proxy must route `erp.kingturf.cn` to the KingTurf web port; the workflow verifies both `/health` and `/ready` after deployment.
