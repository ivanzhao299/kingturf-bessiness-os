INSERT INTO permissions(capability,description) VALUES
  ('executive-dashboard:read','Read server-calculated executive KPIs and governed drilldowns')
ON CONFLICT(capability) DO NOTHING;

INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT r.id,p.id,NULL,ARRAY['COMPANY']::data_scope[]
FROM roles r CROSS JOIN permissions p
WHERE r.code='SUPER_ADMIN' AND p.capability='executive-dashboard:read'
ON CONFLICT(role_id,permission_id) DO NOTHING;
