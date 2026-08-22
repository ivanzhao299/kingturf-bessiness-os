-- Repair the administrator visibility gap introduced with actual manufacturing cost.
-- Both canonical administrator roles need company-scoped access to every new
-- capability so an existing production session can discover and operate the module.

INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT roles.id,permissions.id,NULL,ARRAY['COMPANY']::data_scope[]
FROM roles
CROSS JOIN permissions
WHERE roles.code = ANY(ARRAY['SUPER_ADMIN','SYSTEM_ADMIN']::text[])
  AND permissions.capability = ANY(ARRAY[
    'manufacturing-cost:read',
    'manufacturing-cost:policy',
    'manufacturing-cost:calculate',
    'manufacturing-cost:approve'
  ]::text[])
ON CONFLICT(role_id,permission_id) DO UPDATE
SET data_scopes = CASE
  WHEN 'COMPANY'::data_scope = ANY(role_permission_grants.data_scopes)
    THEN role_permission_grants.data_scopes
  ELSE array_append(role_permission_grants.data_scopes,'COMPANY'::data_scope)
END;
