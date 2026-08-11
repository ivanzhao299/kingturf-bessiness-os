# JTF-P0-E01 — Repository & Monorepo Bootstrap

## Goal

Create the production-grade engineering skeleton for KingTurf Business OS before business feature implementation begins.

## Architectural Direction

Unless a subsequent Architecture Decision Record changes it, bootstrap a TypeScript monorepo suitable for:

- Web application
- API service
- shared domain/types/config packages
- PostgreSQL persistence
- background jobs/events
- test automation
- containerized local development
- CI quality gates

Do not implement CRM/MES business features in this task.

## Required Repository Shape

Target shape (exact tooling may be finalized during implementation):

```text
apps/
  web/
  api/
packages/
  domain/
  ui/
  config/
  types/
  testing/
docs/
  adr/
  engineering/
  tasks/
infra/
  docker/
```

## Required Deliverables

1. Root package/workspace configuration.
2. Web application boots locally.
3. API service boots locally and exposes a health endpoint.
4. PostgreSQL local development service configuration.
5. Environment-variable template with no secrets committed.
6. Shared lint/typecheck/format/test commands.
7. Initial unit/integration test harness.
8. CI workflow that runs install, lint, typecheck, test and build.
9. Docker/local development instructions.
10. Architecture Decision Record documenting selected stack and rationale.
11. Updated root README with exact setup commands.

## Mandatory Constraints

- No production credentials or secrets in repository.
- Strict TypeScript.
- API-first architecture.
- Database migrations must be version-controlled once persistence is introduced.
- Core domain packages must not depend on frontend frameworks.
- No hard-coded sales, credit, commission or approval policies.
- Preserve future multi-company, multi-currency and bilingual capability.

## Acceptance Criteria

- Fresh checkout can be installed from documented commands.
- Web and API start successfully.
- API `/health` returns success.
- Local database starts successfully.
- Lint passes.
- Typecheck passes.
- Tests pass.
- Production builds pass.
- CI executes the same gates.
- No business-domain feature implementation is mixed into bootstrap.

## Definition of Done

Task is complete only after repository structure, stack ADR, development instructions and CI gates are committed and reproducible.

## Next Task

After acceptance, proceed to P0 database/organization/auth/RBAC foundations according to `docs/tasks/ROADMAP.md`.
