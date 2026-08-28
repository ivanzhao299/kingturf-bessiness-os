-- 0065 targeted the retired SUPER_ADMIN role code. Production companies use
-- SYSTEM_ADMIN, while day-to-day ownership belongs to KT_COST_ANALYST. Repair
-- both existing role instances and the template used for future companies.

WITH grants(role_code,capability) AS (VALUES
  ('KT_COST_ANALYST','cost-matrix:read'),
  ('KT_COST_ANALYST','cost-matrix:manage'),
  ('KT_COST_ANALYST','cost-matrix:calculate')
)
INSERT INTO atomic_role_template_permissions(role_code,permission_id)
SELECT grants.role_code,permissions.id
FROM grants
JOIN permissions ON permissions.capability=grants.capability
ON CONFLICT(role_code,permission_id) DO NOTHING;

INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT roles.id,permissions.id,NULL::text[],ARRAY['COMPANY']::data_scope[]
FROM roles
CROSS JOIN permissions
WHERE roles.code=ANY(ARRAY['SUPER_ADMIN','SYSTEM_ADMIN','KT_COST_ANALYST']::text[])
  AND roles.deleted_at IS NULL
  AND permissions.capability=ANY(ARRAY[
    'cost-matrix:read',
    'cost-matrix:manage',
    'cost-matrix:calculate'
  ]::text[])
ON CONFLICT(role_id,permission_id) DO UPDATE
SET data_scopes=CASE
  WHEN 'COMPANY'::data_scope=ANY(role_permission_grants.data_scopes)
    THEN role_permission_grants.data_scopes
  ELSE array_append(role_permission_grants.data_scopes,'COMPANY'::data_scope)
END;
