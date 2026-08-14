# ADR 0003: Opaque session authentication

Status: Accepted

Passwords use Node.js `scrypt`, a memory-hard KDF, with a cryptographically random salt per password and configurable work factors. Passwords and raw session tokens are never persisted or returned by read APIs. Login returns a 256-bit random opaque bearer token; storage contains only a server-secret-bound SHA-256 hash. Every request rechecks expiry, revocation, identity and employee status, active membership, and organization agreement.

Login failures share the same response and perform a dummy password verification to resist enumeration. There are no bootstrap credentials.
