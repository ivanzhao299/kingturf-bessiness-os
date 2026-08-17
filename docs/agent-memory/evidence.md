# Evidence Index

- 2026-08-17 20:02 Asia/Shanghai, cron `b42ae80f-26ae-4893-b6b7-1bfb731cd25e`, task/runner `KingTurf+Jinhu+Phoenix` / `kingturf-business-os-runner`: original `main` at `4f4f432c1b06215254f3030c4f0497c496f59c16`; `npm test -- --run src/bootstrap.test.ts` PASS (23/23), Studio RK3 `git diff --check` PASS. Existing deployment route retried: SSH `192.168.2.204:22` timed out; local `127.0.0.1:14331` health/ready refused. No secret access or production mutation.

- 2026-08-17 19:25 Asia/Shanghai, cron `b42ae80f-26ae-4893-b6b7-1bfb731cd25e`, task/runner `b42ae80f-26ae-4893-b6b7-1bfb731cd25e` / `kingturf-business-os-runner`: HEAD `a2666f9c8fae9c33aa815b4fc7890d1a9c2b8be4`; existing WIP preserved. `pnpm ci:local` passed install and format check, then stopped at database guard because `DATABASE_URL` is absent; no credential read, commit, push, or deploy.

- 2026-08-17 19:10 Asia/Shanghai, cron `b42ae80f-26ae-4893-b6b7-1bfb731cd25e`: task ID `KingTurf+Jinhu+Phoenix`; 7 Studio workers alive. SHA `a2666f9c8fae9c33aa815b4fc7890d1a9c2b8be4`; `git diff --check` PASS. Existing WIP preserved; menu/full-gate/Validator/Reviewer continuation remains in progress.

- 2026-08-17 19:00 Asia/Shanghai, cron `b42ae80f-26ae-4893-b6b7-1bfb731cd25e`, task `e921724e-d389-456b-91a1-98176be6cdd5`, runner `kingturf-business-os-runner` (PID 59245 IDLE): `pnpm --filter @kingturf/web test -- --runInBand` PASS, 1 file/23 tests; local/remote SHA `a2666f9c8fae9c33aa815b4fc7890d1a9c2b8be4`; existing WIP preserved; no commit/push/deploy.

- 2026-08-17 18:28 audit: `git status --short --branch; git rev-parse HEAD; git rev-parse origin/main`; original repo and branch preserved, local/remote `a2666f9c8fae9c33aa815b4fc7890d1a9c2b8be4`; heartbeat unavailable; no mutation or delivery.

- 2026-08-17 18:23 audit, cron `b42ae80f-26ae-4893-b6b7-1bfb731cd25e`: original repo/branch/worktree preserved; local/remote `a2666f9c8fae9c33aa815b4fc7890d1a9c2b8be4`; runner heartbeat unavailable; no tests/commit/push/deploy.

- 2026-08-17 18:13 audit, cron `b42ae80f-26ae-4893-b6b7-1bfb731cd25e`: `git status --short --branch; git rev-parse HEAD; git rev-parse origin/main`; original repo/branch preserved, local/remote `a2666f9c8fae9c33aa815b4fc7890d1a9c2b8be4`; heartbeat unavailable; no tests/commit/push/deploy.

- 2026-08-17 18:08 audit: `git status --short --branch; git rev-parse HEAD; git rev-parse origin/main`; original repo/branch preserved, local/remote `a2666f9c8fae9c33aa815b4fc7890d1a9c2b8be4`; heartbeat unavailable; no tests/commit/push/deploy.

- 2026-08-17 audit: `git status`, local/remote SHA; runtime heartbeat not available in shell.
- Historical artifacts: Studio/runtime records in `/Users/mac/.openclaw/workspace/memory/`.
- 2026-08-17 17:34 audit: original repo `/Users/mac/Documents/kingturf-bessiness-os`, branch `main`, local/remote `a2666f9c8fae9c33aa815b4fc7890d1a9c2b8be4`; dirty WIP preserved; no tests/commit/push/deploy.
- 2026-08-17 17:53 audit: same original repo/branch, local/remote `a2666f9c8fae9c33aa815b4fc7890d1a9c2b8be4`; `git status --short --branch` shows existing WIP plus untracked project Memory; runner heartbeat unavailable.
- 2026-08-17 17:58 audit: same original repo/branch, local/remote `a2666f9c8fae9c33aa815b4fc7890d1a9c2b8be4`; WIP preserved; heartbeat unavailable; no tests/commit/push/deploy.
- 2026-08-17 18:03 Asia/Shanghai audit, cron `b42ae80f-26ae-4893-b6b7-1bfb731cd25e`: original `/Users/mac/Documents/kingturf-bessiness-os`, branch `main`, local/remote `a2666f9c8fae9c33aa815b4fc7890d1a9c2b8be4`; existing WIP preserved. Commands: `git status --short --branch; git rev-parse HEAD; git log -1 --oneline`. Runner heartbeat unavailable; no tests/commit/push/deploy.
- 2026-08-17 18:33 audit: `git status --short --branch; git rev-parse HEAD; git rev-parse origin/main`; original repo/branch preserved, local/remote `a2666f9c8fae9c33aa815b4fc7890d1a9c2b8be4`; heartbeat unavailable; no tests/commit/push/deploy.
- 2026-08-17 19:14 Asia/Shanghai audit, cron `b42ae80f-26ae-4893-b6b7-1bfb731cd25e`: lane `kingturf-business-os-runner` PID 59245 alive/IDLE; SHA `a2666f9c8fae9c33aa815b4fc7890d1a9c2b8be4`; WIP preserved; no tests/Validator/Reviewer/delivery.
- 2026-08-17 19:43 Asia/Shanghai, cron `b42ae80f-26ae-4893-b6b7-1bfb731cd25e`: runner `kingturf-business-os-runner` PID 59245 heartbeat IDLE; SHA `a2666f9c8fae9c33aa815b4fc7890d1a9c2b8be4`. Menu/full test command started; 27 migration tests and package tests passed, but PostgreSQL integration gate failed immediately because `DATABASE_URL` was absent. Validator/Reviewer not run; WIP preserved; no delivery.
- 2026-08-17 19:48: L01 evidence: `npm test -- --run src/bootstrap.test.ts` = 23 passed; `npm run lint` PASS; `npm run typecheck` PASS; `npm run build` PASS; commit/push `4f4f432`; `git status` clean and `main...origin/main` synchronized. Deployment evidence unavailable because `ssh 192.168.2.204` timed out and `curl 127.0.0.1:14331/{health,ready}` could not connect.
- 2026-08-17 20:06 deployment retry: `192.168.2.204` route exists via local gateway `192.168.77.1`, but TCP 22/80/443/4331 all timed out; `47.236.122.224` is reachable over HTTP/HTTPS but SSH returns `Permission denied (publickey)`; `erp.kingturf.cn` resolves to `198.18.0.50` and HTTPS cannot establish. Root cause is deployment-route/access availability, not website source or application code.
- 2026-08-17 19:47 Asia/Shanghai, cron `b42ae80f-26ae-4893-b6b7-1bfb731cd25e`, task `KingTurf+Jinhu+Phoenix`: runner `kingturf-business-os-runner` heartbeat/status not callable from this shell; current local/remote SHA `4f4f432c1b06215254f3030c4f0497c496f59c16`; `git diff --check` PASS; `pnpm --filter @kingturf/web test -- --runInBand` PASS (1 file/23 tests). Working tree clean. Menu contract remains green; full gate, Validator/Reviewer, and UAT are not claimed in this audit. No commit/push/deploy performed.
