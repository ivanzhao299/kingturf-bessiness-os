# JTF-P0-E17 — Quality gates

`pnpm ci:local` mirrors CI ordering: frozen install, format check, disposable test-database guard,
migration apply/status, lint, strict typecheck, zero-skip tests, build, and a high-severity production
dependency audit. It scopes `NODE_ENV=test` to its child process and does not load or print a secrets
file. The database guard requires a loopback PostgreSQL host and a database name containing `test`.
Every workspace test script uses `vitest run`; PostgreSQL suites require `DATABASE_URL` and cannot
silently fall back or skip when it is absent.

## Current governed evidence — 2026-08-12

These results are from the completed governed acceptance run after the employee-instance attachment
repair in the current worktree. They supersede earlier sandbox-limited repair evidence and record only
the observed command exit status; they do not self-certify an independent review verdict.

| Command                          | Current observed result                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile` | passed; the lockfile and installed dependency graph are frozen                                                                             |
| `pnpm format:check`              | passed                                                                                                                                     |
| `pnpm lint`                      | passed                                                                                                                                     |
| `pnpm typecheck`                 | passed with strict workspace typechecking                                                                                                  |
| `pnpm test`                      | passed against the disposable real PostgreSQL fixture with zero skipped tests                                                              |
| `pnpm build`                     | passed                                                                                                                                     |
| `pnpm ci:local`                  | passed end to end, including the disposable-database guard, migration apply/status, all quality gates, and the production dependency audit |
| `pnpm db:migrate`                | passed; append-only migrations applied successfully                                                                                        |
| `pnpm db:status`                 | passed; migration status is current                                                                                                        |
| `pnpm security:check`            | passed; the production dependency audit found no issue at or above the configured high-severity threshold                                  |
| `git diff --check`               | passed                                                                                                                                     |

Independent Validator and security Reviewer results are not asserted here. Their signed, per-run
Studio artifacts are authoritative and remain pending until those read-only stages execute for this
repair. The reproducible aggregate acceptance command is:

```bash
pnpm ci:local
```
