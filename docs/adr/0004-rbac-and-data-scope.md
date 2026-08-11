# ADR 0004: Default-deny RBAC and DataScope

Status: Accepted

Capabilities are stable `resource:action` keys. Role grants contain a nullable field allowlist and one or more of SELF, TEAM, DEPARTMENT, REGION, COMPANY, or GROUP. Missing authentication, capability, fields, scope, or tenant context denies access. Administrative authorization resources require `authorization:read` or `authorization:manage`.

Policy checks are centralized. DataScope becomes a SQL predicate passed into repository queries, so unauthorized rows are never fetched and cross-company identifiers look absent. GROUP is intentionally unrestricted only after the capability and tenant checks succeed.
## Hardening clarification

Organization ancestry is materialized in `organization_scope_relationships`: every organization has a depth-zero self row and all ancestor rows. Database triggers maintain the closure in the same transaction as inserts and re-parenting, recompute the complete moved subtree, and reject cycles and cross-tenant parents.

Scope meanings are exact. `SELF` is the actor employee. `TEAM`, `DEPARTMENT`, and `REGION` select employees below the nearest ancestor of that organization type; if no such ancestor exists the scope contributes no access. `COMPANY` is the authenticated company. `GROUP` means all data admitted by the authenticated tenant boundary and never removes the mandatory company qualification. Explicit typed scope grants carry a same-tenant organization anchor of the matching type.

Role grants compose by unioning scopes and field allowlists. A single unrestricted field grant makes the composed permission unrestricted. Persisted employee scope grants are validated against employee, permission, and organization ownership before being included.
