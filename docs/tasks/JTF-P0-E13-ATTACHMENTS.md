# JTF-P0-E13 — Attachment Service

Implemented safe metadata, checksum/size validation, opaque traversal-resistant keys, local upload/finalization, binding, tenant-authorized download, logical deletion, audit, and events. Bytes use only the pluggable temporary-directory adapter.

Creator privilege permits deletion only while an attachment has no active binding. Once bound,
every deletion attempt—including one by the original uploader—must pass current authorization and
DataScope for at least one active bound object.

Attachment object types are validated against published, tenant-owned business-object registry
definitions, then `objectId` is resolved as a concrete domain instance by a registered adapter.
Adapters enforce tenant ownership and the caller's DataScope; unknown adapters or types, missing
instances, draft-only definitions, inactive actors, and cross-tenant instances fail closed. The first
adapter binds actual employee rows through the canonical E01 employee repository. Definition rows are
never valid attachment targets merely because their IDs exist.
