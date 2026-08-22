# Project State

- 2026-08-22 governance reconciliation: `docs/agent-memory/CANONICAL_EXECUTION_BASELINE.md` is now the sole current execution route. KT-T2 is folded into production reacceptance `KT-RG01`; Office 204 is historical preview only. Park production and Feishu receipts are required for completion.

- 2026-08-19 12:20 Asia/Shanghai, task `KT-T2`: verified repository `/Users/mac/Documents/kingturf-bessiness-os` on `main`, local HEAD `4f19b957fe3ea6ea5247526bf30b02a39ed192e3`, `origin/main` identical, worktree clean before plan update. Solidified the current KT-T2 Sales-to-Cash sequence and unified completion gate in `docs/agent-memory/task-sequence.md`; this documentation change is currently uncommitted and must be preserved. Baseline gates: Web 25/25 PASS, lint PASS, typecheck PASS, build PASS. API command was invoked with unsupported Vitest `--runInBand` and therefore is not evidence; rerun with the repository-supported command. PostgreSQL, browser E2E, Validator/Reviewer, deployment SHA, health/ready and UAT remain unproven and are next gates. No production action or external write performed.

- 2026-08-17 20:02 Asia/Shanghai, cron `b42ae80f-26ae-4893-b6b7-1bfb731cd25e`: L01 menu gate remains green at `4f4f432`; 23/23 web tests PASS and Studio diff check PASS. Existing 204 route was retried; SSH timed out and local tunnel was unavailable. This is reachability evidence, not a permission blocker; continue L02 while retrying the approved route when reachable.

- 2026-08-17 19:00 Asia/Shanghai, cron `b42ae80f-26ae-4893-b6b7-1bfb731cd25e`, task `e921724e-d389-456b-91a1-98176be6cdd5`: L01 Gate 0 web navigation contract PASS 23/23 at SHA `a2666f9`; proceed to implementation/desktop-mobile validation while preserving WIP.

- 2026-08-17 19:48 Asia/Shanghai: L01 implementation committed and pushed from the original `/Users/mac/Documents/kingturf-bessiness-os`, branch `main`; local and `origin/main` are both `4f4f432`. Web navigation, quality/WMS workbench, hash routing, active state, refresh recovery, and placeholder handling are included. Web test 23/23, lint, typecheck, and production build pass. Website source is explicitly out of scope and is not a blocker.
- Deployment probe: SSH to `192.168.2.204` timed out and `127.0.0.1:14331` was not listening, so 204 deployment/health/UAT could not be executed in this session. This is an environment reachability blocker, not a request for new permissions. Next development milestone is L02 sales-to-cash; deployment retry is a parallel operational check when the existing 204 route is reachable.
- 2026-08-17 20:06 retry: route table points `192.168.2.204` through `192.168.77.1`, but all expected service ports time out. Public jump host responds but rejects the available SSH key; domain is intercepted by local proxy DNS and TLS fails. Keep L02 development moving; deployment can resume only after the existing 204 route or approved jump-host SSH path is restored.
- 2026-08-17 20:10: ChatGPT architecture/management/UI planning adopted as the governing review model. New blueprint: `docs/engineering/OPERATING_MODEL_AND_ROLE_CATALOG.md`; next implementation slice is L02 CRM/Customer 360, followed by the complete sales-to-cash proving ground.

- 2026-08-17 18:28 Asia/Shanghai audit, cron `b42ae80f-26ae-4893-b6b7-1bfb731cd25e`, runner `kingturf-business-os-runner`: original `/Users/mac/Documents/kingturf-bessiness-os`, branch `main`, local/remote `a2666f9c8fae9c33aa815b4fc7890d1a9c2b8be4`; heartbeat unavailable. WIP preserved; no stage transition. Blocker: fresh runner evidence unavailable. Next: revalidate heartbeat before L01.

- 2026-08-17 18:13 Asia/Shanghai audit, cron `b42ae80f-26ae-4893-b6b7-1bfb731cd25e`, task `e921724e-d389-456b-91a1-98176be6cdd5`, runner `kingturf-business-os-runner`: original `/Users/mac/Documents/kingturf-bessiness-os`, branch `main`, local/remote `a2666f9c8fae9c33aa815b4fc7890d1a9c2b8be4`; heartbeat unavailable. Existing WIP preserved; no tests/commit/push/deploy. Blocker: fresh runner evidence unavailable. Next: revalidate heartbeat before L01 transition.

- 2026-08-17 18:08 Asia/Shanghai audit, task `e921724e-d389-456b-91a1-98176be6cdd5`, runner `kingturf-business-os-runner`: original `/Users/mac/Documents/kingturf-bessiness-os`, branch `main`, local/remote `a2666f9c8fae9c33aa815b4fc7890d1a9c2b8be4`; heartbeat unavailable; WIP preserved; no tests/commit/push/deploy. Blocker: fresh runner evidence unavailable. Next: revalidate heartbeat before L01 transition.

- Updated: 2026-08-17 Asia/Shanghai
- Project: KingTurf Business OS
- Repository: `/Users/mac/Documents/kingturf-bessiness-os`
- Branch: `main`
- Last observed HEAD: `a2666f9`
- Local WIP: `apps/web/src/bootstrap.ts` (preserve; do not reset)
- Active Studio task: `e921724e-d389-456b-91a1-98176be6cdd5` (`kingturf-business-os-runner`)
- Current milestone: L01 navigation/API workbench wiring
- Next: P1 sales-to-cash, then KT-L16 quality/WMS

This is an initial continuity snapshot. Subsequent agents append dated evidence below or in the linked files.

- Audit 2026-08-17 17:19 Asia/Shanghai, task `e921724e-d389-456b-91a1-98176be6cdd5`: local/remote SHA `a2666f9c8fae9c33aa815b4fc7890d1a9c2b8be4`; runner heartbeat not freshly callable in this shell. Existing WIP preserved; no commit/push/deploy.
- 2026-08-17 18:33 Asia/Shanghai audit, cron `b42ae80f-26ae-4893-b6b7-1bfb731cd25e`, task `e921724e-d389-456b-91a1-98176be6cdd5`, runner `kingturf-business-os-runner`: original `/Users/mac/Documents/kingturf-bessiness-os`, branch `main`, local/remote `a2666f9c8fae9c33aa815b4fc7890d1a9c2b8be4`; heartbeat unavailable; WIP preserved; no tests/commit/push/deploy. Blocker: fresh runner evidence unavailable; next revalidate heartbeat before L01 transition.
- 2026-08-17 19:47 Asia/Shanghai: menu/navigation contract revalidated PASS 23/23 at SHA `4f4f432`; working tree clean and local/remote aligned. Full PostgreSQL gate remains unproven because the prior run lacked `DATABASE_URL`; Validator/Reviewer and UAT remain pending. This is an environment/configuration prerequisite, not a permission blocker.
- 2026-08-17 21:39 Asia/Shanghai, cron `b42ae80f-26ae-4893-b6b7-1bfb731cd25e`: full `pnpm test -- --runInBand` ran at SHA `a2666f9`; config/database migration/testing/types suites passed (32 tests observed), then the mandatory PostgreSQL suite stopped because `DATABASE_URL` is unset. No code change, commit, push, deploy, or UAT claim. Runner heartbeat is not exposed in this shell; this is monitoring evidence only, not a work blocker.

- 2026-08-17 23:18 Asia/Shanghai, task `KT-T2/L02 CRM/Customer 360`, runner `Codex sole coding Worker`, branch/worktree `main` at `/Users/mac/Documents/kingturf-bessiness-os`: first Customer 360 vertical slice now connects customer identity, contacts, ownership, leads, activities and opportunities. Opportunity access is independently default-denied by `opportunity:read`, filtered by its server-side DataScope and intersected with Customer 360 and opportunity field permissions; the responsive workbench exposes the visible commercial amount, probability and close date. Static/build and focused tests pass. Remaining L02 CRM work: server-side list filtering/pagination, richer contact capture/edit, opportunity drill-through, downstream quote/order/AR aggregates and PostgreSQL/browser UAT. Office 204 deployment configuration was not touched by this slice.
