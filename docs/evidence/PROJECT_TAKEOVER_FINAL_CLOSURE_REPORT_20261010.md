# Project Takeover Final Closure Report

Date: 2026-10-10 (Asia/Singapore)

## A. Project overview

Kingturf Business OS is a TypeScript monorepo for identity/RBAC/DataScope, CRM, technical specifications, cost-to-quote, quote-to-cash, procurement/MRP, production, quality, shipment, receivables and governed legal/document workflows. Final main is `3ec6d83c3e12a417dfe7087dd9a7d9fa6fc6d73f`.

This report closes the engineering takeover scope. It does not declare formal production go-live readiness.

## B. Actual environment classification

The project owner has clarified that the currently reachable KingTurf instance is a development/test and acceptance environment, not a formally launched production business system. The technical evidence supports a more precise classification:

```text
ENVIRONMENT_CLASSIFICATION=DEVELOPMENT_TEST_WITH_PRODUCTION_LIKE_SURFACE
```

The instance still uses the historical production names `kingturf-erp-production`, `NODE_ENV=production`, the `production` GitHub Environment and `https://erp.kingturf.cn`. The public health/readiness/version endpoints are reachable. The shared host also contains Phoenix ERP, with separate containers and bind mounts.

The current database footprint is small but not empty: 5 organizations, 205 employees (12 active), 2 customers, 1 opportunity, 1 sales order, 2 AR documents, 2 bank payments, 1 contract and 0 attachments. Twelve active employees and 204 employee email addresses do not match obvious test-domain patterns. This does not disprove the owner’s development/test classification, but it means the data and public surface must continue to be handled as sensitive until the data owner confirms that the records are synthetic or authorized test data.

The API environment exposes only local attachment storage, database/session settings and a website lead-ingest secret among the inspected integration names. No payment, SMS, SMTP or generic cloud-storage integration variable was observed. Values were never printed. The website lead secret and public domain remain production-like integration risks.

## C. Initial problems and baseline

The takeover began with release-input/source validation gaps, missing deployment concurrency, session-revocation and authorization concerns, two historical CI failures, incomplete runtime documentation, and unverified recovery/rollback/UAT gates. Historical production `NO_GO` reports were correct for the then-assumed production scope and remain unchanged.

## D. Batch 1–4 completed changes

- Batch 1: exact main-history release SHA/source validation, deployment concurrency, pinned SSH host key, read-only preflight, recovery-point and release-marker safeguards.
- Batch 2: password-change/admin-reset session revocation, old access-token rejection, atomic password/audit behavior and real HTTP security coverage.
- Batch 2.5: deterministic Web DOM overdue fixture and CAPA date fixture repairs without weakening assertions.
- Batch 3: per-source Order 360 scope/capability checks and legal nested/derived-field authorization.
- Batch 4: local API development/build startup recovery, Web API proxy behavior and production-mode runtime validation.

No migration was added in these batches, no production database write was performed, and no Phoenix/shared-service modification was made.

## E. Security and database improvements

Final main includes session revocation and atomic audit controls, tenant/organization/DataScope checks, Order 360 source authorization, legal nested authorization, SELECT-only production startup checks, exact migration checksums and fail-closed release validation. The 70-entry migration registry matches the verified production registry. Seventeen historical `NOT VALID` constraints are retained and were evaluated during the real isolated database restore.

## F. Git main integration

PR #31 through PR #35 are merged. Final main is `3ec6d83c3e12a417dfe7087dd9a7d9fa6fc6d73f`. The current test instance still reports old runtime SHA `9d89c7d6739454345b1397fe6b02c945fbe1cb99`; final main has not been deployed there.

## G. Final CI/build/browser verification

The final main Hosted CI result is 443/443 PASS. Lint, typecheck, formatting, build and dependency audit passed. Final-main Chromium regression is 26/26 PASS. Native HTTP/PostgreSQL and authorization/security suites passed in the recorded final-main evidence. These are engineering and isolated acceptance results; they are not a human business UAT signature.

## H. Backup and restore evidence

Phase 6 created and revalidated a host-side PostgreSQL custom-format dump for the old runtime: 1,399,180 bytes, SHA-256 `b95fb5a112a89c7016c2a6dbc5c880a72e6933a50098a709a24c78fdafc29491`, `pg_restore --list` PASS. The attachment directory and database attachment rows were empty. A temporary no-network PostgreSQL 17.7 restore passed with 70 migrations and all evaluated integrity checks at zero violations.

The artifact remains on a mutable production-named host staging directory. No independent copy or encrypted configuration recovery material is available. `COMPLETE_RECOVERY_BUNDLE=NO` and `RESTORE_VERIFIED=NO` remain correct for formal production recovery.

## I. Development/test deployment assessment

The existing `Deploy KingTurf Production` workflow is not a test-only deployment entry. Its deploy job uses the `production` Environment and concurrency group, modifies `/data/kingturf-erp`, writes `WEBSITE_LEAD_INGEST_SECRET` into `.env.production`, rsyncs application files, runs `docker compose up -d --build`, writes `.release-sha`, and performs public HTTPS probes. It excludes database/attachment volumes and does not invoke the migration CLI, but it can restart the KingTurf API/Web/PostgreSQL Compose project and changes a public endpoint.

The target is therefore not safe to update solely from the owner’s DEV/TEST label while the public domain, production-named workflow, website lead secret and non-obvious employee identities remain unresolved. No workflow dispatch or direct SSH deployment was performed. The existing instance remains healthy on the old SHA.

```text
DEV_TEST_DEPLOYMENT=PENDING_TARGET_AND_DATA_SAFETY_CONFIRMATION
DEV_TEST_DEPLOYED_SHA=9d89c7d6739454345b1397fe6b02c945fbe1cb99 (current old runtime)
DEV_TEST_API_HEALTH=PASS_OLD_RUNTIME
DEV_TEST_WEB_HEALTH=PASS_OLD_RUNTIME
DEV_TEST_CORE_SMOKE=FINAL_MAIN_AUTOMATED_ONLY; ACTUAL_FINAL_RUNTIME_NOT_RUN
```

The minimum unblock is a written data-owner confirmation that the 205 employee records and business rows are synthetic/authorized test data, confirmation that no external lead or other business integration may receive real traffic during the update, and explicit approval to use the production-named workflow against this test instance. A separate test-specific workflow would be cleaner, but is not introduced in this closure without that decision.

## J. Runtime and core business smoke

Automated final-main HTTP, PostgreSQL, browser, auth, authorization and audit checks are PASS. The reachable instance’s health/readiness/version smoke is PASS only for the old runtime SHA. Customer/order/AR/legal writes were not issued against the current host because the target data classification and external traffic boundary were not independently established. Real business-person UAT remains unperformed.

## K. Known limitations

- Current host classification is owner-declared development/test but retains public production-like naming and access.
- Final main is not running on that host.
- No independent off-host recovery copy or encrypted configuration recovery artifact.
- No full application restore, safe emergency rollback drill or business-role UAT.
- GitHub main/production protection remains a future governance control, not a completed go-live gate.

## L. Deferred production-readiness gates

These are moved to [`PRODUCTION_GO_LIVE_BACKLOG.md`](../deployment/release-gates/PRODUCTION_GO_LIVE_BACKLOG.md): independent recovery retention, encrypted configuration recovery, complete restore, RPO/RTO, security-preserving rollback, real business UAT, GitHub protection/approval, production deployment and monitoring/SLA.

The previous formal-production `NO_GO` reports are not rewritten. They were the correct conservative decisions under the earlier production classification and remain valid as go-live history.

## M. Operational handover

The current branch contains the documentation checkpoint and no uncommitted changes. The frozen host artifact must be preserved. Any future test deployment must use an exact main SHA, a documented test-data boundary, a no-external-write window, health/readiness/version checks and a test-specific recovery plan. Do not use production credentials in local or isolated tests.

## N. Final acceptance decision

```text
ENGINEERING_ACCEPTANCE=PASS
DEV_TEST_ACCEPTANCE=PENDING_SAFE_FINAL_MAIN_DEPLOYMENT
PRODUCTION_READINESS=DEFERRED_TO_GO_LIVE_BACKLOG
PROJECT_TAKEOVER_CLOSED=PARTIAL
```

Engineering implementation, integration and automated verification are complete. The project is not marked fully closed because the actual final-main test-instance deployment and runtime smoke could not be proven safe from the available evidence. This is a bounded closure, not a production release approval.
