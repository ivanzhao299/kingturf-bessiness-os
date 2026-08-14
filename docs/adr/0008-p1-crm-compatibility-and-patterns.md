# ADR 0008: P1 CRM compatibility and shared patterns

Status: Accepted (2026-08-13)

## Decision

KingTurf retains its installed Node 24.x, pnpm 10.33.4, TypeScript 5.9.3, Vite 7.3.6, Vitest 3.2.6, `pg` 8.22.0, and PostgreSQL-compatible SQL line. No second runtime, package manager, database, container engine, or infrastructure service is activated. We reuse jinhu's modular CRM concepts and responsive table/form/card navigation, while retaining KingTurf's tenant-composite constraints, parameterized SQL, immutable audit, optimistic concurrency, idempotency, and transactional outbox.

## Evidence and compatibility

| Component         | KingTurf manifest/lock |              Host |                                jinhusmartpark evidence |                      Phoenix ERP evidence | Decision                                                              |
| ----------------- | ---------------------: | ----------------: | -----------------------------------------------------: | ----------------------------------------: | --------------------------------------------------------------------- |
| Node              |               >=24 <25 |           24.18.0 | root engine is implicit; API types target Node 22.10.1 |                                      >=18 | retain installed 24.x                                                 |
| pnpm              |                10.33.4 |           10.33.4 |                                                 9.12.0 |                                       >=8 | retain locked 10.33.4                                                 |
| TypeScript        |                  5.9.3 | workspace package |                                                 ^5.7.2 |                       ^5.1.3 API / ^5 web | retain locked 5.9.3                                                   |
| API               | Node/parameterized SQL |           Node 24 |                            NestJS 10.4, TypeORM 0.3.20 |                 NestJS 10, TypeORM 0.3.17 | retain installed API; reuse module/domain patterns                    |
| Web               |     Vite 7.3.6, DOM UI |           Node 24 |                        Next 15, React 19, Ant Design 6 | Next 16.2.6, React 19.2.4, Radix/Tailwind | retain installed Vite/DOM line; reuse responsive interaction patterns |
| PostgreSQL client |            `pg` 8.22.0 |      client 16.14 |                                                ^8.13.1 |                                   ^8.11.3 | retain locked 8.22.0 and existing PostgreSQL path                     |

Evidence was read on 2026-08-13 from the actual checkouts at `/Users/mac/Documents/jinhu-smart-park` and `/Users/mac/Documents/phoenix-erp-v3`: each root `package.json` plus `apps/api/package.json` and `apps/web/package.json`. No lockfile-derived or transitive version is invented in this table. Both systems prove the shared practical line: pnpm TypeScript monorepo, NestJS-style modular API, PostgreSQL through `pg`/TypeORM, and a responsive React web client. KingTurf already implements the same practical line with a smaller installed API/DOM layer, so framework replacement would add novelty and violate the host constraint.

jinhusmartpark's lead permissions, pool claim/assign/reclaim actions, status logs, DataScope, and 360-view concepts are adopted as domain patterns. Phoenix ERP independently confirms the NestJS/PostgreSQL and Next/React application split. Exact external framework versions are evidence, not KingTurf dependency requirements.

## Accepted differences

- Framework reuse is conceptual: KingTurf does not add NestJS, TypeORM, Next, React, or Ant Design merely to mimic another repository.
- pnpm 9 and 10 differ; the existing lock and host pin make pnpm 10.33.4 the reproducible choice.
- PostgreSQL server provisioning is external. Acceptance uses an injected loopback test database.

## Rejected alternatives

- Installing or activating alternate Node, pnpm, PostgreSQL, Docker, or another container engine.
- Guessing Phoenix dependencies or versions.
- Weakening P0 transaction, tenancy, authorization, audit, or outbox invariants to match a shared UI/framework.
- Fabricating order or finance sections in Customer 360.
