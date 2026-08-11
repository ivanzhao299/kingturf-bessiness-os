# ADR 0004: Default-deny RBAC and DataScope

Status: Accepted

Capabilities are stable `resource:action` keys. Role grants contain a nullable field allowlist and one or more of SELF, TEAM, DEPARTMENT, REGION, COMPANY, or GROUP. Missing authentication, capability, fields, scope, or tenant context denies access. Administrative authorization resources require `authorization:read` or `authorization:manage`.

Policy checks are centralized. DataScope becomes a SQL predicate passed into repository queries, so unauthorized rows are never fetched and cross-company identifiers look absent. GROUP is intentionally unrestricted only after the capability and tenant checks succeed.
