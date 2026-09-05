# Workspace route isolation — 2026-09-06

## Incident and confirmed causes

An administrator reported temporarily incomplete navigation and unrelated content on the costing page. Before changes, local HEAD, fetched `origin/main`, production `/version`, and the server `.release-sha` were all `e47aa9c647e27e1fe5cf64e6f3877bc184398500`; the API, web and PostgreSQL containers were healthy. This was not a detected release rollback.

Browser reproduction against that baseline confirmed two paths with the same symptoms:

1. Customer filtering called `bootstrapView`, which replaced the entire application with `createCrmShell(controller)` using CRM-only permissions. Commercial/governance navigation, workspaces, profile and initialized navigation were lost.
2. A delayed customer-detail response did the same replacement after the user had already switched to costing.

These reproduce the defect; they do not reconstruct the exact sequence of the user's historical session. Authentication/session initialization already waits for the complete session before mounting the workspace.

## Implementation

- Refresh only `.crm-records`, retaining the application shell, full role permissions, navigation, other business workspaces and their in-progress state. Preserve the active search input and caret.
- Commit only the newest customer selection; ignore obsolete results/errors and display actionable errors for the current request inside its CRM route.
- Apply route visibility before inserting replacement fragments. Rebuild section links against live nodes and reapply list/task enhancements without duplicating them.
- Guard asynchronously inserted route views before paint with a child-list observer. Dispose navigation subscriptions when reinstalling or replacing a shell; detached shells cannot redirect the live application.
- Do not force the user back to quotes when a cost handoff finishes after they leave costing. Guard the deferred quote-dialog opening too.

No database schema, business data, permissions, deployment workflow or backup policy is changed.

## Verification

- Web lint, typecheck, 105 unit tests and production build passed.
- 21 browser regressions passed, covering routing, login/startup, costing-to-quote, document sending/configuration and order evidence.
- New route regressions: menu/workspace identity after CRM filtering; delayed cost results after switching to quotes, sampled each animation frame; delayed customer detail after switching to costing; visible customer-load error without losing navigation.
- New controller tests cover reversed response order and stale versus current request failures.
- Cold-login critical assets remain about 11.1 KB JavaScript + 1.9 KB CSS (gzip); the business workspace remains deferred.

Browser business API requests are isolated fixtures, not writes to production or proof of live administrator authorization. Formal release must pass PR/main CI and `deploy-production.yml`, followed by exact runtime SHA, health/readiness and public asset checks. Historical migration recovery points remain untouched.
