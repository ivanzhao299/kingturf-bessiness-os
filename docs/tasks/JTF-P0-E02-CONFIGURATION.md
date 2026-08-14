# JTF-P0-E02: Typed configuration

Status: Implemented

Contract: parse every API/database/security variable before startup and return immutable typed configuration. Missing, malformed, placeholder, and production-insecure values fail startup. Migration ownership remains with `@kingturf/database`.

Security invariants: secrets are never defaulted or committed; production secrets are at least 32 characters; PostgreSQL TLS cannot be explicitly disabled. Acceptance evidence: config unit tests, `.env.example`, CI ephemeral values, and engineering runbook.
