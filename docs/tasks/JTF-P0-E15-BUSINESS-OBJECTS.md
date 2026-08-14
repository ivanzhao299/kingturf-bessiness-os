# JTF-P0-E15 — Business Object Registry

Implemented tenant-owned stable definitions, append-only drafts, safe bounded generic fields and relationships, publishing, historical retrieval, transactional audit/events, and database-enforced published immutability.

The definition `version` is its optimistic state revision, distinct from schema-version numbers. Creating a definition starts revision 1. Every successful add-version or publish operation serializes on the tenant/definition transaction lock, advances the revision exactly once, and returns the complete updated definition snapshot. Failed or concurrent losing mutations do not advance it; published schemas and relationship metadata remain immutable.
