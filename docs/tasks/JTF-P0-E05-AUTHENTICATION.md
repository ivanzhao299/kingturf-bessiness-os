# JTF-P0-E05: Opaque session authentication

Status: Implemented

Contract: `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/session`, and `PUT /api/v1/auth/credential`. Credential storage accepts scrypt encodings only. Raw opaque tokens are returned once by login and only secret-bound hashes persist.

Security invariants: random salt/token, memory-hard hashing, timing-safe verification, enumeration-resistant failure, expiry/revocation/status/membership validation on every request, and no bootstrap credentials. Acceptance evidence: password/token tests, session SQL, audit records, runbook.
