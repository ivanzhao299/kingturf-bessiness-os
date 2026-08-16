-- Cost models and sales policies are company-wide governed catalogs. Earlier
-- SUPER_ADMIN grants inherited GROUP scope, which correctly fails the repository's
-- company-scope guard. Add COMPANY without removing any existing scope.

UPDATE role_permission_grants grant_row
SET data_scopes=array_append(grant_row.data_scopes,'COMPANY'::data_scope)
FROM roles,permissions
WHERE grant_row.role_id=roles.id
  AND grant_row.permission_id=permissions.id
  AND roles.code='SUPER_ADMIN'
  AND permissions.capability=ANY(ARRAY[
    'cost-model:read','cost-model:manage',
    'sales-policy:read','sales-policy:manage'
  ]::text[])
  AND NOT ('COMPANY'::data_scope=ANY(grant_row.data_scopes));
