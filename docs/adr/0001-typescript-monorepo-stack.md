# ADR 0001: TypeScript monorepo stack

- Status: Accepted
- Date: 2026-08-11

## Context

The repository needs a reproducible foundation for a browser application, an API service, shared code, automated tests, local PostgreSQL, and CI. The foundation must remain neutral: product models, persistence, policies, and workflows are intentionally deferred.

## Decision

Use a pnpm 10 workspace on Node.js 24 with strict TypeScript 5. Applications and packages live only under `apps/*` and `packages/*`.

- `apps/web`: browser-native TypeScript bundled and served by Vite. A framework is deferred until product UI needs justify one.
- `apps/api`: the Node.js HTTP server, with framework-neutral application dispatch separated from the process entry point. Direct dispatch provides network-free integration testing.
- `packages/domain`: framework-independent future domain primitives.
- `packages/types`: framework-independent transport and shared types.
- `packages/ui`: reusable browser UI primitives.
- `packages/config`: reusable TypeScript configuration and environment-neutral defaults.
- `packages/testing`: shared test helpers.
- Vitest provides the shared test runner. Bootstrap behavior is tested without emulating a browser.
- PostgreSQL 17 runs locally from a pinned Docker image with a named volume. No schema or data-access layer is introduced here.
- ESLint, Prettier, strict TypeScript, tests, and production builds are identical local and CI gates.
- GitHub Actions uses pinned major action releases, a pinned Node release, an exact pnpm release, dependency caching, and read-only repository permissions.

Package exports are explicit, and consumers declare `workspace:*` dependencies. Domain and types have no framework dependency. This keeps future organization, locale, currency, events, and persistence choices open without creating speculative abstractions.

## Consequences

The repository has one package manager and one quality-gate entry point. Packages can evolve and publish declarations independently. Development requires Node 24 and pnpm 10. A later ADR is required to add a UI framework, persistence library, background processing, or production deployment architecture.
