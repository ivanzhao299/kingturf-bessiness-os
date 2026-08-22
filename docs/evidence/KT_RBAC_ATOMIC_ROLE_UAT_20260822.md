# KT-RBAC-UAT-01 Atomic Role and Production UAT Acceptance

Date: 2026-08-22 Asia/Shanghai

## Decision

Accepted for production. KingTurf now has a company-scoped atomic business-role catalogue, least-privilege grants, enforced segregation of duties, and an authenticated production UAT result for every atomic role.

## Immutable delivery

- Role catalogue release: `1dfa489a3a13c85593b144316c1ba863aff8bc6f`
- Final segregation release: `0cbe8f203ad3285874a7ce2d9ef643ba50ba8520`
- Final deployment run: <https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/32551349622>
- Production URL: <https://erp.kingturf.cn/>
- Production `/health`: `{"status":"ok"}`
- Production `/ready`: `{"status":"ready"}`
- Production release: `0cbe8f203ad3285874a7ce2d9ef643ba50ba8520`

## Authorization result

- Atomic roles: 38
- Atomic role permission grants: 214
- Hard segregation-of-duties conflicts: 8
- Scope: each operating role is provisioned at COMPANY scope for existing companies; a database trigger provisions the same governed catalogue for future COMPANY organizations.
- Detailed role and permission matrix: `docs/engineering/ATOMIC_ROLE_AND_UAT_MATRIX.md`

The catalogue separates preparation, approval, execution and reconciliation responsibilities. Examples include quote editor versus quote approver, credit analyst versus credit approver, contract specialist versus signatory, cashier versus reconciliation accountant, demand planner versus MRP approver, and quality inspector versus quality manager.

## Production UAT

Thirty-eight temporary single-role identities were provisioned without recording or exposing plaintext credentials. Each identity completed the same authenticated acceptance path against production:

1. Successful login and session establishment.
2. Session permission set exactly matched that role's database grant set.
3. One role-authorized endpoint returned HTTP 200.
4. One endpoint outside the role returned HTTP 403.
5. Logout completed and the session was revoked.

Result: `passed=38`, `failed=0`.

The segregation guard was then tested through the production administration API. Assigning `KT_QUOTE_APPROVER` to an employee already holding `KT_QUOTE_EDITOR` returned HTTP 409 with code `conflict`; no assignment was written.

The existing administrator browser shell was also rechecked at the production URL. Per-role acceptance used real authenticated sessions and production interfaces; it did not retain 38 browser profiles after completion.

## Cleanup and audit

- Active temporary UAT employees: 0
- Active temporary UAT identities: 0
- Temporary sessions: revoked
- Audit events retained: `uat.atomic-roles.provision` and `uat.atomic-roles.cleanup`
- Plaintext test credentials retained: none

## Automated verification

The final full validation passed formatting, lint, type checking, builds and 197 automated tests:

- Database: 40
- API: 111
- Web: 25
- Domain: 14
- Config: 4
- Testing: 1
- Types: 1
- UI: 1

The suite includes future-company role provisioning, database conflict rejection and API conflict-response coverage.

## Rollback

Application rollback may redeploy the previous immutable release. Schema rollback must first remove the two assignment guard triggers and their functions, then remove `atomic_role_conflicts`; the role catalogue tables should only be removed after confirming no employee assignments depend on generated role IDs. Production data must not be deleted merely to roll back application code.

## Feishu closure

- Channel health before delivery: Feishu `ON / OK`; gateway reachable.
- Canonical group: `oc_7c814a358cfe3909f470495d77c4f5c1`
- Delivery receipt: `om_x100b67a60a3f413cb2af657c4bcc68e`
- Receipt confirms `ok: true` and `dryRun: false`.

## Next route

This task does not create a parallel roadmap. The next and only active long task remains `KT-L17`: actual manufacturing cost and variance (64h), followed by `KT-L18` through `KT-L25` in numeric order.
