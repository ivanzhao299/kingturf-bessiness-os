# KT-UI-PROD-01 Frontend Production Completion Plan

Updated: 2026-08-24 Asia/Shanghai

## Objective

Make `https://erp.kingturf.cn` the single reliable production preview and acceptance surface. Every implemented backend capability must have an intentional frontend disposition, every visible page and action must be driven by atomic permissions, and representative roles must pass authenticated desktop and mobile UAT before the paused roadmap resumes.

## Execution order and countdown

| Gate | Work package                                  | Budget | Exit evidence                                                                                                                                                             |
| ---- | --------------------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0   | Canonical-route cleanup and governance freeze |     8h | One production route in active docs, scripts and workflows; obsolete route assets removed; repository checks pass                                                         |
| P1   | Production preview-test reliability           |    16h | Login, session, health, ready, release identity, page traversal, console/network errors and safe smoke scenario are reproducibly checked                                  |
| P2   | Backend-to-frontend capability inventory      |    16h | API, capability, role, scope, field, menu, page, section and action matrix has no unclassified endpoint                                                                   |
| P3   | System administration and governance center   |    28h | IAM, audit, master data, numbering, rules, workflows, notifications, attachments, registry and operations surfaces are usable or explicitly internal-only                 |
| P4   | Atomic navigation and affordance policy       |    20h | Menu, route, section, action and sensitive field visibility are server-grant driven; direct URL and forbidden-action tests pass                                           |
| P5   | Studio-informed product UI refinement         |    24h | Design tokens, shell, hierarchy, tables, filters, states, forms, feedback, accessibility and responsive layouts pass visual review                                        |
| P6   | Representative-role production UAT            |    24h | Allowed and rejected paths for administration, sales, finance, procurement, production, quality, warehouse, logistics, approval and audit roles pass at desktop and 390px |
| P7   | Exact release and private handoff             |     8h | Clean repository, CI, exact deployment SHA, production health/ready, authenticated browser evidence, rollback notes and private Feishu receipt                            |

Total planned effort: 144 hours. Every package is at least five hours and is executed in order without advancing on self-report.

## Active long-task slice: Round 3 production language and list operations

Execution window: 2026-08-24; planned engineering effort: 24 hours. This slice remains part of P5 and does not create a parallel roadmap.

| Node | Package                         | Budget | Exit condition                                                                                                                                                    |
| ---- | ------------------------------- | -----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R3-1 | Business-language normalization |     6h | Events, lifecycle states, risk levels and money use consistent Chinese business language; raw enums are retained only as accessible technical titles where useful |
| R3-2 | Badge and density refinement    |     5h | Status markers communicate exception/decision/terminal state without dominating titles, identifiers or primary actions                                            |
| R3-3 | List productivity               |     7h | The order evidence list supports category filtering, chronological sorting and safe batch copy without any authorization bypass or server mutation                |
| R3-4 | Regression and exact release    |     6h | Formatting, lint, typecheck, tests, build, clean diff, exact-SHA deployment, desktop/390px authenticated UAT and browser-error review all pass                    |

Round 3 deliberately excludes new backend bulk-write endpoints. Batch operations in this slice are read-only evidence handling; future bulk mutations require dedicated API authorization, idempotency, concurrency, audit and partial-failure design.

## Active long-task slice: Round 4 role workspaces and operational lists

Execution window: 2026-08-24; planned engineering effort: 32 hours. This slice completes the remaining P5 role-facing work and starts the P6 representative-role acceptance gate.

| Node | Package                              | Budget | Exit condition                                                                                                                                              |
| ---- | ------------------------------------ | -----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R4-1 | Atomic role and exposure review      |     6h | Every production role resolves to at least one intentional route; overview, route, section and action visibility remain grant-derived                       |
| R4-2 | Role homepage and action queues      |     8h | Every authenticated business role receives an overview with its responsibility domains and direct links only to authorized workspaces                       |
| R4-3 | Operational list productivity        |     8h | Dense commercial and operations lists provide consistent in-page search, deterministic sorting, reset, visible counts and responsive layouts                |
| R4-4 | Form and state-change feedback       |     5h | Required fields, submitting state, success/failure feedback and sensitive state-change acknowledgement follow one accessible interaction contract           |
| R4-5 | Release-chain and representative UAT |     5h | Current GitHub Actions runtimes, full PostgreSQL CI, exact-SHA deployment, representative permission tests and authenticated desktop/390px browser UAT pass |

Role homepages are usability projections of session grants, not authorization decisions. Server RBAC, DataScope, state machines, segregation-of-duties checks, idempotency and audit remain authoritative.

## Functional exposure rule

Every authenticated backend endpoint is classified as one of:

1. user-facing and exposed in a permission-scoped workspace;
2. supporting API consumed by an exposed workflow;
3. internal-only with an explicit reason and no navigation entry;
4. deprecated and removed through a reviewed migration.

An endpoint may not remain accidentally hidden.

## Permission model

The frontend derives navigation and affordances from the authenticated session grant set. Controls are evaluated at five levels: route, section, action, field and data scope. Frontend hiding is usability only; the API and database remain the authority. Direct-route, forged-request and segregation-of-duties rejection paths remain mandatory.

## UI direction

Reuse Studio design principles rather than Studio business code: semantic design tokens, restrained color system, collapsible navigation, strong information hierarchy, consistent cards and tables, clear state language, accessible focus, empty/loading/error states, responsive workspaces and low-noise operational density. KingTurf retains its own brand and repository boundary.

## Release gate

The insertion task is complete only when the immutable source SHA, CI, deployment SHA, health, readiness, release identity, representative-role authenticated browser UAT, desktop/mobile evidence, rollback plan and private Feishu receipt all agree. `KT-L19` remains paused until this gate is complete.
