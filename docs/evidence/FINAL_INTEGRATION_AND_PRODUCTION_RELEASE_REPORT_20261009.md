# FINAL_INTEGRATION_AND_PRODUCTION_RELEASE_REPORT

Date: 2026-10-09 Asia/Singapore. **Release decision: NO_GO.** Engineering fixes and isolated/Hosted verification are complete; required external review, protection, recovery and production-compatibility gates are not complete. No main merge or production deployment occurred. The user's conditional merge/application-deployment authorization is recorded and does not need to be requested again.

[Machine evidence](FINAL_RELEASE_VERIFICATION_20261009.json). Earlier Batch 1–4 reports and immutable checkpoints remain historical evidence, not results for current main.

## A. Initial Git State

Repository `ivanzhao299/kingturf-bessiness-os`, canonical origin GitHub, local `/home/jinhuit/Kingturf/kingturf-bessiness-os`. Initial branch `codex/batch4-runtime-recovery`, clean at `58602af13783d6533443eaac3f38dd13dc952961`. Original runtime code `be6f56bd5db8355e08c5b2d841759dcad92c2cd0` and Batch3 `7562baf`/`23c2764` retained. Existing reports/status and parent/repository AGENTS context reviewed; no repeated Discovery. Current and freshly fetched remote main remain `9d89c7d6739454345b1397fe6b02c945fbe1cb99`.

New execution branch `codex/production-release-preflight` retains the complete previously validated local preview. Source candidate `20ded96e3e7176bb39f3ae036e1890b14e872392` is a feature integration candidate, **not main**. No preexisting user changes were overwritten. No force push, reset, direct main push, database migration or protection mutation.

## B. Independent Review Results

Three separate read-only AI reviewer roles reviewed source; primary performed edits and execution. They did not access secrets, production data, perform external writes or run verification. Their code approvals do not constitute independent GitHub personnel approval.

| Reviewer                  | Scope / evidence                                                                                                                                                                                                     | Code conclusion                                                                  | Production conclusion                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A Architecture & Business | API/Web routing, dependencies, production startup and source authorization. `apps/api/src/server.ts:52`, `packages/database/src/index.ts:97`, `apps/web/vite.config.ts:22`, `infra/docker/Dockerfile.web-preview:17` | APPROVE after startup correction                                                 | BLOCK: actual schema, restore, rollback, human review/protection                           |
| B Security & Database     | Password/session/audit locks (`apps/api/src/repositories.ts:334,441`), Order360 (`apps/api/src/app.ts:2887`, `order-360-repositories.ts:46`), nested legal (`aggregate-authorization.ts:33`)                         | APPROVE; no exploitable P0 confirmed in scope                                    | BLOCK: real compatibility/recovery, human governance, safe single-version cutover/rollback |
| C Release & Operations    | Immutable controls, exact SHA, shared lock, preflight, pinned SSH, backup/marker and preserved resources. `.github/workflows/deploy-production.yml`, `scripts/production_preflight.py`                               | APPROVE, including final public host-pin asset independently fingerprint-checked | BLOCK: external approval/protection/full recovery and runtime acceptance                   |

Reviewer B explicitly corrected an initial stale claim: current `migrationStatus` is SELECT-only; DDL remains only in explicit `migrate`. This report uses the corrected finding.

## C. Review Findings & Fixes

| Finding                                                                  | Severity / root cause                                              | Minimal fix / reproduction evidence                                                                                                                                                                                                                     | Residual risk                                                                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Production startup executed migration DDL; status also prepared registry | P1, unconditional migrate / CREATE / ALTER                         | `ef450cb`, `2fed325`: production calls read-only `assertMigrationsCurrent`; status reads only. SELECT-only role plus default read-only transactions verifies valid startup; missing/pending/drift/future/null/missing-column cases fail without repairs | Production registry still NOT_VERIFIED; legacy rollback startup is unsafe under application-only authorization |
| Deploy verification DB rejected by existing native HTTP test guards      | P1, `kingturf_ci` did not satisfy `_test` policy                   | `7439fe3`: isolated `kingturf_test`, pinned PG17.7, full `pnpm ci:local`                                                                                                                                                                                | Production deploy workflow itself not dispatched                                                               |
| SSH trusted freshly scanned network key                                  | P1, no independently trusted pin                                   | `e2280f3`: public `infra/ssh/production_known_hosts` from approved existing known-host record; immutable control supplies pin before agent; strict host checks and required curve25519 KEX on all SSH/rsync                                             | Host/port secret values cannot be read via GitHub; must match approved IP:22 before release                    |
| Storage could fall back to named volumes / wrong disk                    | P1, optional bind configuration                                    | `7439fe3`: required bind paths; preflight actual `/data` mount/device, approved paths, live healthy singleton services, schema checksums and runtime/marker agreement                                                                                   | Minimum 5 GiB is a floor, not backup sizing; deploy account config access must be proven                       |
| Retired older recovery files and unused rollback images                  | P1, automatic retirement without restore acceptance                | `7439fe3`: preserve all recovery material and images; existing shell assertions verify preservation                                                                                                                                                     | Independent retention/off-host policy and capacity acceptance still required                                   |
| Shared Nginx install/reload exceeded newly clarified boundary            | P1, workflow coupled app deployment to shared ingress modification | `54da1c4`: compare existing reviewed hash before backup/sync and before application update; no install/reload                                                                                                                                           | Mismatch requires separate explicit shared-service approval                                                    |

No migration SQL changed against main. No unrelated business rewrite/dependency upgrade/test suppression. Failure replay preserves previous marker and backups; it does not prove automatic rollback or an unchanged runtime after partial service update.

Session contract remains: opaque hashed bearer sessions in PostgreSQL, refresh-token N/A. Password/self-service/admin reset, revocation and successful audit are transactional. Post-commit fresh authentication rejects revoked tokens; requests authenticated before commit may finish. Already authenticated in-flight work is not cancelled. All API instances must use new locking code together; old login instances or rollback to old code reintroduce a credential-verify/session-insert race. One current production API was observed, but safe cutover/rollback still requires acceptance.

Order360 intersects entry, order and each source capability/scope/fields; tenant/company/TEAM/SELF checks remain. Legal nested records, evidence/manifest and returned fields require their own capability. Collection parent LEGAL_PENDING/ACCEPTED is intentionally visible as the permitted parent lifecycle; it is not authorization to read independent legal content. P2 remaining: legal-only roles without collection:read need human workflow UAT. No new P0 confirmed does not establish production authorization acceptance.

## D. PR Merge History and Dependency Convergence

**No PR merged.** Required independent personnel review and protection were absent on final refresh. No unresolved threads were found, but no reviews is not an approval.

| PR / branch                                                                       | Exact current head                       | Base                                                      | Hosted quality                                                                                                | Integration                                                 |
| --------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [#33](https://github.com/ivanzhao299/kingturf-bessiness-os/pull/33) CI recovery   | ab26c6ebff7a4524a205f3a1ec92959a35c97f94 | main9d89                                                  | [37795089674](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/37795089674), prior PASS331   | OPEN, no human review                                       |
| [#31](https://github.com/ivanzhao299/kingturf-bessiness-os/pull/31) release       | f2286f7806feb2cefdd1a1364cd7f7799840174d | main9d89                                                  | [37869370730](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/37869370730), current PASS387 | OPEN, normal fast-forward feature push only                 |
| [#32](https://github.com/ivanzhao299/kingturf-bessiness-os/pull/32) auth          | 8cbe6deb8efcd0d650007972c7b0516ea18cca87 | main9d89                                                  | [37795523187](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/37795523187), prior PASS357   | OPEN, no human review                                       |
| [#34](https://github.com/ivanzhao299/kingturf-bessiness-os/pull/34) authorization | e33e414c1de805714af6641c274723e56ef53482 | PR33ab26                                                  | [37855253180](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/37855253180), prior PASS350   | OPEN, retarget only after33 main integration                |
| Batch4 runtime                                                                    | 444fdfa85992218fa5ebcab2976879c3774672bc | disclosed preview7341f4f729878fb912c6f404d61b49f518455a2d | [37869588268](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/37869588268), current PASS425 | branch published, clean-main PR blocked by base integration |
| Combined feature candidate                                                        | 20ded96e3e7176bb39f3ae036e1890b14e872392 | retained local preview, not main                          | [37869606128](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/37869606128), current PASS443 | quality-only workflow_dispatch, no deploy                   |

Order remains **33 → 31 → 32 → 34 → Batch4**. Repeated historical Web/CAPA fixtures were previously proven identical; new follow-ups do not change them. Latest Batch4 `apps/packages` source equals the combined candidate, and all latest PR31 release/Compose/pin/preflight/test source equals the combined candidate (actual zero-diff comparisons). Batch4 original 8 files plus four startup/DB code-test files remain independently reviewable against its explicit preview base. Publishing a main PR with the entire preview ancestry would duplicate Batch1/2/3 changes; that was avoided. Preserve all original commits; after approved base merges, carry runtime commits from actual new main, resolve only actual conflicts and rerun quality.

After each authorized merge: verify actual HEAD/reviews/threads/latest main/checks, use GitHub HEAD protection, record new main, rerun final tree quality, update remaining branches without force push. AI review or CLEAN mergeability never substitutes for required human approval.

## E. Final Main SHA

`9d89c7d6739454345b1397fe6b02c945fbe1cb99` remains actual main and production. It contains none of the pending Batch1–4 fixes. Final integrated-main verification is **NOT_RUN_BLOCKED_UNINTEGRATED**. Candidate20ded Hosted/local success cannot be reported as final-main success.

## F. Current CI / Tests / Build

| Exact tree / executed check                                                                                                                                   | Result                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate20ded: `pnpm ci:local` with explicitly injected owned loopback `_test` DB                                                                            | PASS frozen install, formatting,118 capability entries, DB guard,70 migration statuses, lint,typecheck,unit/PG/HTTP,build,size budget,audit |
| Candidate tests                                                                                                                                               | **443/443** = API184 + Web114 + shared89 + Node release46 + Python operations10; zero skips/new failures                                    |
| Candidate Hosted37869606128                                                                                                                                   | PASS443, exact20ded, same full CI entry                                                                                                     |
| Batch4444fdfa: full local and Hosted37869588268                                                                                                               | PASS425 = same workspace387 + original release38; this branch excludes new Batch1 operations patches                                        |
| PR31 current Hosted37869370730                                                                                                                                | PASS387 = original workspace331 + release46 + operations10                                                                                  |
| Authorization: `vitest run test/authorization-http-postgres.integration.test.ts test/app.test.ts test/collection-postgres.integration.test.ts --maxWorkers=1` | PASS59/59, including19 native HTTP scenarios                                                                                                |
| Auth native HTTP PG suite in full CI                                                                                                                          | PASS19/19, two API instances, wrong/old/new passwords, reset, token rejection, tenant restriction, rollback/failure/concurrency             |
| Read-only DB status / native production startup                                                                                                               | PASS7/7 +4/4, restricted role, default read-only transactions, missing/pending/drift/unknown metadata failures                              |
| Chromium original6 +session-revocation +source-nested files                                                                                                   | PASS26/26; mock/replay responses, not real business UAT                                                                                     |
| Real runtime browser dev / compiled production-mode API+preview                                                                                               | PASS1/1 each: real login,customer201/query,PG tenant/status,success audit,anonymous401 and no-AR403; no mocked routes                       |
| Workflow static check                                                                                                                                         | PASS actionlint1.7.12 with ShellCheck0.11.0; shell replay tests actually executed                                                           |
| Migration SQL diff vs main / source-scope diff                                                                                                                | empty / expected only; no new migration                                                                                                     |

Local Node24.19, pnpm10.33.4, Vitest3.2.6, Playwright1.62.1, isolated PG17.7; Hosted configured Node24.13. Counts increased from historical414 by DB7 + startupHTTP4 + release8 + operations10 =29. Historical Web/CAPA defects remain repaired, assertions retained; CAPA4 passed. No CI gate downgrade.

One duplicate local Batch4 CI invocation was stopped during lint before tests to allocate a separate owned database; replacement full run passed on `kingturf_runtime_test`. One manual production-mode runtime attempt used the dev attachment-path fixture and correctly failed the production path guard; rerun supplied a conforming isolated configuration, with unchanged guard, and passed. Neither is a remaining code regression.

GitHub hosted schedules, SSH deployment, current-data authorization and rollback were not simulated by the YAML parser. No production deployment workflow was dispatched.

## G. Production Preflight

Approved existing SSH alias `phoenix-prod` only; required curve25519 KEX, strict known-host validation and supplied ED25519 fingerprint matched. No private-key content read/copied, no alternate credential search, no sudo permission assumption. Expected hostname matched. `/data` is an actual ext4 mount on `/dev/nvme1n1`; about91 GiB free (3% used), root about9.4 GiB free. This is a snapshot, not a backup size/RTO guarantee.

Three Kingturf services healthy, restart counts0, API release SHA9d89. Existing database bind `/data/kingturf-erp-data/postgres`, attachment bind `/data/kingturf-erp-data/attachments`; deploy path `/data/kingturf-erp`. Required API configuration presence verified as booleans only. Production environment has all six required secret names; their values/host-port correspondence were not exposed or proven. Current SSH account cannot read `.env.production` or independent backup directory. Do not use Docker privileges to bypass those file boundaries.

Existing shared Nginx configuration hash `2256630d8e1bdccb0d032a3a82d43e1c34ad28c09be6b9cf6fa05ad7fdbeb07a` matches reviewed source; no Nginx/certificate/firewall/systemd change performed. Phoenix `phoenix-v3-db/api/web` were freshly observed running/healthy, with no modifications or cleanup. No daemon/host restart or unknown resource change.

Fresh public HTTPS `/health`200 ok, `/ready`200 ready, `/version`200 SHA9d89/builtAt33996421402. These are the previous version's baseline, not post-deployment evidence; readiness alone does not prove schema/restore.

Read-only production registry queries over the approved channel timed out, including a strict read-only SQL attempt. No production schema checksum result obtained. Bulk transfer of the historical backup also timed out via SSH/SFTP. Initial local Docker-client config permission trouble was avoided only for daemon metadata using its local socket; no credentials were read, permissions changed or service restarted. Daemon ping and sanitized inventories succeeded. Intermittent SSH reads are an access/reliability blocker, not evidence of a database defect or failed containers.

### GitHub governance: final read-only refresh

main protected=false; repository rulesets[] and effective main rules[]; production protection_rules[] / deployment_branch_policy=null. All four PRs reviews[] and unresolved threads0. Connection has push permission, admin=false; Actions default-permissions endpoint403 =NOT_VERIFIED. No protection change made.

Minimum administrator-reviewed configuration: main PR-required, required exact `quality` context with current-base checks, at least one independent qualified personnel approval, stale-approval dismissal, resolved conversations, restricted bypass, force-push/deletion prohibition. Production environment: independent approved reviewer with self-review prevention, main-only deployment branch policy, limited administrators/manual-rerun writers, preserved audit trail; workflow content permission read-only. Review required secret host/port/pinned record correspondence without revealing values. Historical workflow reruns require explicit controls because old workflow code lacks current guards. User deployment authorization does not authorize bypassing these missing gates.

## H. Backup & Restore Evidence

Accessible release backup inventory: one **historical 2026-09-05** custom dump,1,372,272 bytes. Its source filename records pre9d89. `.release-backups` readable; `/data/kingturf-erp-backups` mode750 is **permission-denied**, not verified empty. No attachment/configuration coverage, current recovery point, independent/off-host copies, retention acceptance or accepted RPO/RTO established. Transfer attempts yielded no complete local backup; **no restore was run**, no checksum or file-existence claim promoted to restore PASS.

Release-unblock plan: owner supplies approved current DB+attachment+configuration materials with manifest/checksums and secure access, independently retained copy and capacity/retention evidence. Import only into an owned labelled local PG17.7 container with no external network and no production mounts; restore roles/schema/data without exposing rows/credentials. Reconcile migration checksums, approved fixture/aggregate integrity and file-to-metadata consistency; test the exact candidate against restored existing state. Record elapsed restore time and snapshot age, agreed RTO/RPO, configuration reconstruction and human acceptance. Remove only owned test material afterward. Never restore over production or change Phoenix backups/volumes. A separate production backup-generation operation must follow its approved workflow/ownership procedure; it was not improvised over SSH.

## I. Release GO / NO-GO

```text
ACTION=FORMAL_GITHUB_APPLICATION_DEPLOYMENT_ONLY_IF_GATES_PASS
IMPACT=REPLACE_KINGTURF_API_WEB_KEEP_DATABASE_ATTACHMENTS_AND_SHARED_SERVICES
CURRENT_PRODUCTION_SHA=9d89c7d6739454345b1397fe6b02c945fbe1cb99
TARGET_MAIN_SHA=NOT_AVAILABLE_PENDING_APPROVED_INTEGRATION
DATABASE_SCHEMA_COMPATIBILITY=NOT_VERIFIED_READ_TIMEOUT_NO_SQL_MIGRATION_CHANGED
BACKUP_STATUS=HISTORICAL_DB_DUMP_ONLY_CURRENT_DB_FILES_CONFIG_NOT_VERIFIED
RESTORE_VERIFICATION=NOT_VERIFIED_TRANSFER_TIMEOUT
ROLLBACK_TARGET=NOT_ACCEPTED_OLD_MAIN_HAS_STARTUP_DDL_AND_AUTH_RACE
ROLLBACK_METHOD=CURRENT_FORMAL_WORKFLOW_EXACT_MAIN_HISTORY_SHA_AFTER_COMPATIBILITY_ACCEPTANCE
ROLLBACK_EVIDENCE=NOT_VERIFIED
HEALTH_BASELINE=PASS_PREVIOUS_SHA_ONLY
PROTECTION_STATUS=MISSING_MAIN_AND_PRODUCTION_GATES
REVIEW_STATUS=THREE_AI_CODE_APPROVALS_NO_INDEPENDENT_PERSONNEL_APPROVAL
UAT_STATUS=AUTOMATED_SYNTHETIC_PASS_HUMAN_NOT_VERIFIED
GO_NO_GO=NO_GO
```

## J. Deployment Execution

NOT_RUN. No dispatch of `Deploy KingTurf Production`, no production application/container/configuration/file/secret/database mutation. Only quality workflow dispatches on published feature branches. No local SSH deployment substituted for the formal release chain.

## K. Post-Deploy Verification

NOT_RUN, because no deployment. Previous-version health/ready/version and both Kingturf/Phoenix container snapshots passed as preflight evidence only. Production login/token/session/business authorization and current-record read smoke remain NOT_VERIFIED; no real business write test conducted.

## L. Rollback Status

NOT_READY / NOT_EXECUTED. Source-main-history eligibility and image preservation do not establish safe application rollback. Old9d89 starts migrations and has old authentication locking behavior. Require a previously approved schema-compatible, SELECT-only-startup and session-compatible rollback target; prove replacement, single-version drain and recovery in isolated restored state before release. No unauthorized database rollback/restore.

## M. Business UAT Status

Existing [CORE_BUSINESS_UAT_MATRIX](CORE_BUSINESS_UAT_MATRIX_20261009.md) remains the acceptance scope. Fresh automated evidence covers native auth/revocation/admin reset/audit, CRM persistence, commercial and quote-to-cash PG graph, collections/legal, source/field/data-scope and tenant rejection, and actual dev/built browser customer flow. HUMAN_UAT=NOT_VERIFIED. Financial/legal/order production writes were not performed; mock/replay26 are UI regression only. Actual-role, provider receipt/document/bank, historical-data and physical shipment acceptance remain explicit gaps. Canonical governance requires immutable SHA, authenticated UAT and closure receipt; no message/receipt was fabricated or sent without authorization.

## N. Remaining Risks and Release Blockers

1. P1 governance: qualified personnel reviews and administrator-approved required main/production protections missing.
2. P1 operations: current database/attachment/configuration independent backup and actual isolated restore/RPO/RTO incomplete.
3. P1 compatibility: production migration checksums and restored existing-state compatibility unverified; new API correctly fails closed.
4. P1 rollback/cutover: approved no-DDL/session-safe rollback target and isolated drill missing.
5. P1 acceptance: required human business UAT/provider closure pending; prior acceptance is historical, not a new signed candidate acceptance.
6. Production still runs old main with security gaps until legitimately integrated/deployed. No P0 confirmed within synthetic review scope, no comprehensive security certification.
7. P2 legal-only UI workflow, large source-file debt, other derived statistics, monitoring coverage and provider acceptance remain scoped NEXT items.

## O. Next Engineering Batch / Checkpoint

Obtain independent reviewer and administrator gate configuration; then authorized sequential integration33→31→32→34, recording each protected exact-HEAD merge and fresh main CI. Retarget34 only after33 is main. Prepare independent Batch4 main PR from the clear actual integrated baseline, carrying original runtime and new read-only-startup checkpoints without copying preview ancestry. Revalidate final main, current schema/restore, rollback and human UAT before GO.

Owned test resources and private ephemeral fixtures are cleaned after verification; sanitized metadata/logs remain ignored. This report and state updates form a documentation checkpoint after source20ded; final response records its actual commit. No project restart/discovery next turn: continue from these blockers/NEXT.

Future post-release observation is planned, not completed: inspect containers/restarts,5xx/401/403 trend,login/revocation,DB connectivity/slow queries,audit errors and storage/backup space at deployment+15min/+1h/+24h using approved monitoring ownership. Exact version/health/ready mismatch, restart loops, unauthorized data visibility, audit failure or material elevated errors trigger stop and safe formal application rollback if proven. No background monitor was created and no elapsed observation period is claimed.
