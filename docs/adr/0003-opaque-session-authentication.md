# ADR 0003: Opaque session authentication

Status: Accepted

Passwords use Node.js `scrypt`, a memory-hard KDF, with a cryptographically random salt per password and configurable work factors. Passwords and raw session tokens are never persisted or returned by read APIs. Login returns a 256-bit random opaque bearer token; storage contains only a server-secret-bound SHA-256 hash. Every request rechecks expiry, revocation, identity and employee status, active membership, and organization agreement.

Login failures share the same response and perform a dummy password verification to resist enumeration. There are no bootstrap credentials.

## Password change and reset contract (Batch 2, 2026-10-08)

Self-service `PUT /api/v1/auth/credential` requires `{ currentPassword, password }` and an active bearer session. The password remains at least 12 characters. Incorrect current passwords are rejected without changing credentials or sessions. Password-only callers now receive 400 and must supply `currentPassword`; no self-service client in the repository used the previous password-only body. No password recovery or refresh-token endpoint currently exists.

Successful self-service changes revoke **all** sessions of the target identity, including the current device. The administrator identity provisioning/reset endpoint also revokes all target sessions; resetting a different employee leaves the administrator's session intact. This follows the existing `authorization:manage` and company boundary. A future recovery flow must reuse the same transactional reset/revocation rule.

Password hash changes, session revocations and success audit insertion share one PostgreSQL transaction. An audit or revocation failure rolls back the entire operation. Login success audit and session insertion are also atomic. Login, self-service change and admin reset lock the target employee (`FOR NO KEY UPDATE`), then identity, then credential. Login rechecks the verified hash and active organization membership before issuing a token. Self-service rechecks and locks the invoking session. Failed compare-and-set login retains a failure audit. This prevents a login that verified the old password from issuing a surviving session after a reset.

The token format, server secret and sessions schema are unchanged. Existing sessions remain valid until expiry, explicit logout, account deactivation or their own password change/reset. No migration or global logout is needed. Every instance reads the same database on authentication; no revocation cache delay is introduced. Authentication database errors deny access and return an error rather than granting fallback access. Requests authenticated before a reset commits may finish; this change does not cancel in-flight business operations.

Web requests receiving 401 for the current token clear it and reload to login with an expiry message. A successful self-service password change does so immediately. Delayed 401 responses from an earlier login cannot clear a newer session; 403 permission errors do not sign users out. Reloading discards unsaved workspace input, which is the explicit UX tradeoff for a revoked session. Bearer integrations must reauthenticate after their identity password changes; unchanged identities keep the existing token contract.

Production activation requires all API instances to run the reviewed implementation before claiming the concurrency guarantee. An older instance can still create sessions without the new reset lock. Reverting to old code removes the guarantee but does not restore already revoked tokens. Production deployment, migrations and session cleanup are outside this batch's authorization.
