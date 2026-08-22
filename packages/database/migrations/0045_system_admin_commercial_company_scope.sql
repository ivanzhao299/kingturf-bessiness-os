-- Production tenants created by the bootstrap flow use SYSTEM_ADMIN, while the
-- original commercial scope repair only covered the legacy SUPER_ADMIN code.
-- Governed cost and sales-policy catalogs are company-owned, so both canonical
-- administrator roles require COMPANY in addition to any existing scope.

UPDATE role_permission_grants grant_row
SET data_scopes = array_append(grant_row.data_scopes, 'COMPANY'::data_scope)
FROM roles, permissions
WHERE grant_row.role_id = roles.id
  AND grant_row.permission_id = permissions.id
  AND roles.code = ANY(ARRAY['SUPER_ADMIN', 'SYSTEM_ADMIN']::text[])
  AND permissions.capability = ANY(ARRAY[
    'cost-model:read', 'cost-model:manage',
    'sales-policy:read', 'sales-policy:manage'
  ]::text[])
  AND NOT ('COMPANY'::data_scope = ANY(grant_row.data_scopes));
