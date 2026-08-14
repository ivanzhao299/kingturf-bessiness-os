# JTF-P0-E16 — Observability and errors

Implemented centralized safe HTTP errors, response correlation headers, liveness/readiness separation, dependency-injected bounded telemetry, structured operational logging, and tenant-qualified outbox state counters. Server startup installs a structured telemetry sink. HTTP labels are deliberately bounded to method, route class, and status; logs contain correlation, status, and duration only. Tests prove request credentials and payloads do not enter telemetry or logs.

The HTTP transport sends both declared-length and streamed-body 413 responses through the same completion boundary. A valid incoming correlation UUID is preserved in the error body and `x-correlation-id`; malformed values are replaced, and the rejection emits bounded request count, timing, and structured completion telemetry without body data.
