# ADR 0007 — Immutable business-object schemas

Accepted. A tenant owns each stable definition and its append-only versions. Publishing is one-way; PostgreSQL triggers reject update or deletion of published versions. Schemas are data-only, size bounded, allowlisted by field type, and reject executable constructs and prototype paths. Relationship foreign keys include `tenant_id`, preventing cross-tenant targets. Domain-specific sales and manufacturing behavior belongs outside this registry.
