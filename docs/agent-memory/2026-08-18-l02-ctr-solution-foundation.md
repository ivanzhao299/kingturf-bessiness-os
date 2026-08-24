# L02 CTR / Technical Solution Foundation Evidence

- Timestamp: 2026-08-18T01:49:49+08:00
- Task: KT-T2 / L02 CTR and technical-solution foundation
- Runner: Codex sole Worker
- Branch/worktree: `main` at `/Users/mac/Documents/kingturf-bessiness-os`
- Starting evidence: previous Customer 360 opportunity slice `8c5be3b`

## Audit and chosen slice

The repository already contained CTR and technical-solution tables, immutable revisions, submit/approval controls, audited transactional mutations, commercial APIs, and a responsive commercial workspace. The smallest connected gap was the CTR-to-solution handoff: the solution form separately selected an Opportunity and an approved CTR, permitting an inconsistent pair to reach the database guard.

This slice makes the approved CTR version the authoritative source of `opportunityId`, exposes typed CTR/solution references, and adds `GET /api/v1/opportunities/{id}/technical-solutions` for opportunity-scoped drill-through. The read endpoint is default-denied by `technical-solution:read`, passes its server-side DataScope/anchors into the repository, rechecks the parent Opportunity scope, and applies field permissions to the response. Existing create/revision commands retain their transactionally coupled audit and outbox evidence.

## Three-review evidence

- Architecture: one exact approved CTR version determines the Opportunity link; tenant and parent Opportunity scope are enforced server-side before the scoped solution query.
- Enterprise management: removes an avoidable sales-to-technical mismatch before engineering work starts, while retaining technical ownership and immutable revision evidence.
- Frontend/product: removes the duplicate Opportunity choice, gives actionable invalid-handoff feedback, and keeps the field-driven solution workbench usable in desktop and 390px mobile layouts.

## Validation

- `pnpm --filter @kingturf/api exec vitest run test/app.test.ts` — PASS, 32/32.
- `pnpm --filter @kingturf/web test` — PASS, 24/24.
- `pnpm lint` — PASS.
- `pnpm typecheck` — PASS.
- `pnpm build` — PASS.
- `pnpm format:check` — PASS.
- `pnpm --filter @kingturf/api test -- --runInBand` — 69 unit tests PASS; seven PostgreSQL suites fail closed before collection because `DATABASE_URL` is unset. This environment prerequisite is recorded without blocking the code slice or claiming PostgreSQL UAT.
- Deployment was out of scope for this slice and was not touched.

## Rollback

Revert the slice commit. No migration or data rewrite is included.

## Session completion update

- 2026-08-18T02:02:16+08:00: the recorded focused/static gates were independently rerun with the same results. The exact-file commit attempt was blocked before staging because the managed workspace denied creation of `.git/index.lock`; the index remained empty and HEAD stayed at `8c5be3bfc10214ae0fecb551b7569f5de7423497`. No commit SHA is claimed, and the next L02 slice was not started across this unmet gate.
