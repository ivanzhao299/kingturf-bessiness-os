# KingTurf 204 Preview Deployment

This deployment is an isolated preview, not a production release. The application currently
supports only local attachment storage, which the configuration layer intentionally rejects in
`NODE_ENV=production`.

## Boundary

- Host: `192.168.2.204`
- Directory: `/opt/kingturf/preview`
- URL: `http://192.168.2.204:4331/`
- Public URL: `https://erp.kingturf.cn/` through the jump-host reverse proxy. DNS, HTTPS,
  HTTP-to-HTTPS redirection, and automatic certificate renewal are active.
- Compose project: `kingturf-preview`
- Persistent volumes: `kingturf-preview_postgres_data` and `kingturf-preview_attachments`
- No host PostgreSQL port is published.
- Existing host Nginx configuration is not modified.

## Guarded Office 204 deployment route

The ERP repository now has a manual GitHub Actions release workflow that reuses the
validated Agent Studio route:

`GitHub Actions → 123.57.220.65 → WireGuard → 192.168.2.204`

The server-side command is intentionally project-specific: `kingturf-erp deploy <40-character SHA>`.
It must deploy only this repository to `/opt/kingturf/preview`, the `kingturf-preview` Compose
project, and the `erp.kingturf.cn` endpoint. It must not touch `/opt/anksen/agent-studio` or the
website's `/srv/app/kingturf` directory. Until that forced command is installed on the jump host,
the workflow is fail-closed and no arbitrary SSH shell is permitted.

The workflow streams a Git bundle containing the exact validated SHA, so neither server needs
GitHub credentials. Install `infra/deployment/kingturf-erp-jump` as
`/usr/local/sbin/kingturf-erp` on the jump host and use it as the deploy key's `authorized_keys`
forced command. Install `infra/deployment/kingturf-erp-office` as
`/usr/local/sbin/kingturf-erp-office` on Office 204 and restrict the jump-to-office key to that
command. Both keys must disable PTY, forwarding, agent forwarding, and X11 forwarding.

Before the first guarded deployment, preserve the legacy runtime: move the existing
`/opt/kingturf/preview` source directory under `/opt/kingturf/releases/<its-SHA>`, copy its `.env`
to `/opt/kingturf/shared/preview.env` with mode `0600`, and replace `preview` with a symlink to that
release. The deploy command then creates SHA-addressed releases, reuses the existing
`kingturf-preview` named volumes, and restores the prior Compose release if build, `/health`, or
`/ready` fails. It never runs `down --volumes` or overwrites the shared environment.

The server-local `.env` contains generated preview-only secrets and must never be committed.

## Verification

```sh
docker compose --env-file .env -f infra/docker/compose.preview.yaml ps
curl --fail http://127.0.0.1:4331/health
curl --fail http://127.0.0.1:4331/ready
curl --fail http://127.0.0.1:4331/
```

## Rollback

Redeploy the previous reviewed source archive, or stop the preview without deleting data:

```sh
docker compose --env-file .env -f infra/docker/compose.preview.yaml down
```

Do not add `--volumes` during ordinary rollback.
