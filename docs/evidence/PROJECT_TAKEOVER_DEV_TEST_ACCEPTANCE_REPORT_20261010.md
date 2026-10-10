# PROJECT_TAKEOVER_DEV_TEST_ACCEPTANCE_REPORT

Date: 2026-10-10 (Asia/Singapore)

## A. Scope and environment

The final main commit `3ec6d83c3e12a417dfe7087dd9a7d9fa6fc6d73f` was exercised in a new disposable local test instance. The existing public KingTurf endpoint was not used or changed; it remains on `9d89c7d6739454345b1397fe6b02c945fbe1cb99`. Phoenix and shared host services were not accessed.

The instance topology was:

- PostgreSQL `17.7-alpine3.23`, container `kingturf-final-isolated-pg-20261010`, with its own host data directory under `.local-acceptance/final-test/pgdata`.
- Schema `runtime_web_final_20261010` in database `kingturf_test`, with all 70 migrations applied.
- API built from the final main worktree, container `kingturf-final-isolated-api-20261010`, listening only inside the private Docker network.
- Web production preview from the final main build, container `kingturf-final-isolated-web-20261010`, sharing only the API test network namespace for the loopback proxy.
- Docker network `kingturf-final-isolated-net-20261010` was `internal=true`; no public port, production volume, production secret, or shared service was attached.

Synthetic identities and records were created only in the test schema. No production credentials or business data were copied.

## B. Build and startup evidence

From a detached worktree at the exact final main SHA:

```text
pnpm install --frozen-lockfile --offline       PASS
pnpm build                                    PASS
```

The API built artifact started successfully with both `NODE_ENV=test` and a separate `NODE_ENV=production` read-only startup check. The production-mode check did not run migrations; it verified the existing test schema and returned:

```text
/health 200 {"status":"ok"}
/ready  200 {"status":"ready"}
/version 200 {"sha":"3ec6d83c3e12a417dfe7087dd9a7d9fa6fc6d73f","environment":"isolated-production-check"}
```

The Web production preview returned HTTP 200. API and Web logs had zero `level=error`, `Unhandled`, `ECONN` or stack-error matches during the acceptance run.

## C. Real browser and HTTP acceptance

The existing real runtime browser test was run against the isolated Web preview and real API/PostgreSQL path twice: once before the recovery check and once after API/PostgreSQL restart. Both runs passed `1/1`.

The supplemental real HTTP test passed all 19 checks. Evidence is in [PROJECT_TAKEOVER_DEV_TEST_ACCEPTANCE_HTTP_20261010.json](PROJECT_TAKEOVER_DEV_TEST_ACCEPTANCE_HTTP_20261010.json). It covered:

- login, session profile, customer create/list/update and Customer 360;
- wrong-password rejection, password change, old access-token rejection, old-password rejection, new-password login, logout and logged-out token rejection;
- anonymous customer access returning 401;
- AR, sales orders, Order 360 and legal collection access returning 403 without their capabilities;
- a synthetic second organization whose customer was not present in the first organization’s API result;
- successful customer and password-change audit events;
- database persistence with the updated customer status.

The Browser test also verified the Vite proxy, UI customer creation, database persistence, success audit, and 401/403 behavior. These are automated synthetic acceptance results; they are not human business UAT or external provider acceptance. Opportunity, order, AR/payment and legal positive records were not seeded; their unauthorized paths were verified and positive business approval remains in the go-live backlog.

## D. Compose project replay

To satisfy the isolated deployment boundary, the same final main build was also started as Compose project `kingturf-final-compose-20261010` with services `db`, `api` and `web`, a dedicated internal network `kingturf-final-compose-net-20261010`, and a dedicated test volume `kingturf-final-compose-pgdata-20261010`. The API and Web services used the loopback proxy inside the API network namespace; no host port or public ingress was published.

The Compose schema applied all 70 migrations. Compose API health/readiness/version returned 200 with the final SHA after a database restart. The Compose real HTTP smoke passed login, session, customer create/list, AR 403, anonymous 401, password change, old-token 401 and new-login checks. The Compose browser test passed `1/1` through the Web proxy and PostgreSQL. Machine-readable HTTP evidence is in [PROJECT_TAKEOVER_DEV_TEST_ACCEPTANCE_COMPOSE_HTTP_20261010.json](PROJECT_TAKEOVER_DEV_TEST_ACCEPTANCE_COMPOSE_HTTP_20261010.json).

## D. Persistence and recovery checks

The PostgreSQL container was restarted and the API remained healthy and ready. A post-restart database query found the previously created synthetic customers (`6` records from repeated controlled fixture runs), showing persistence through the container restart. The API container was restarted and the Web preview was recreated; health, readiness and Web HTTP 200 checks passed again. The test-only production-mode API startup also passed against the already migrated schema.

Only resources created for this acceptance were used. They are removed after this report is recorded; the reusable topology and commands are documented in the repository runtime acceptance section and the evidence above.

## E. Acceptance decision

`ENGINEERING_ACCEPTANCE=PASS` remains supported by the final main Hosted CI and existing 26/26 Chromium evidence. The new isolated deployment, real HTTP smoke, browser proxy path and restart persistence checks pass, therefore `DEV_TEST_TECHNICAL_ACCEPTANCE=PASS` and `PROJECT_TAKEOVER_CLOSED=YES_ENGINEERING_SCOPE`.

`FORMAL_PRODUCTION_READINESS=DEFERRED`. The existing public instance was not updated. Formal go-live remains governed by [PRODUCTION_GO_LIVE_BACKLOG.md](../deployment/release-gates/PRODUCTION_GO_LIVE_BACKLOG.md), including independent recovery materials, encrypted configuration recovery, safe rollback drill, governance controls and human business UAT.
