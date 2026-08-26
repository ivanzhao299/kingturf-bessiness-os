INSERT INTO permissions(capability,description) VALUES
  ('ncr:close','Close a verified nonconformance report')
ON CONFLICT(capability) DO NOTHING;

INSERT INTO atomic_role_template_permissions(role_code,permission_id)
SELECT 'KT_QUALITY_MANAGER',p.id
FROM permissions p
WHERE p.capability='ncr:close'
ON CONFLICT DO NOTHING;

SELECT provision_atomic_business_roles(id)
FROM organizations
WHERE organization_type='COMPANY' AND deleted_at IS NULL;

INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT r.id,p.id,NULL,ARRAY['COMPANY']::data_scope[]
FROM roles r CROSS JOIN permissions p
WHERE r.code=ANY(ARRAY['SUPER_ADMIN','SYSTEM_ADMIN'])
  AND p.capability='ncr:close'
ON CONFLICT DO NOTHING;
