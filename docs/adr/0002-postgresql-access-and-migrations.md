# ADR 0002: PostgreSQL access and migrations

Status: Accepted

The database package owns a `pg` connection pool, explicit transaction boundary, parameterized-query interface, and ordered SQL migrations. Migrations execute once, in filename order, inside individual transactions and are recorded in `schema_migrations`. HTTP handlers never issue SQL. Integration tests use real PostgreSQL; production schema changes must not use ORM auto-synchronization.

PostgreSQL UUIDs, foreign keys, checks, uniqueness, UTC-aware timestamps, version fields, logical deletion, and actor columns enforce invariants below application code. Organization boundaries reserve BCP-47 locale strings and ISO-4217 currency codes. Sales and manufacturing data are deliberately absent.
