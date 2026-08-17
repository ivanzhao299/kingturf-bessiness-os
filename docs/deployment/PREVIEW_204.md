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
