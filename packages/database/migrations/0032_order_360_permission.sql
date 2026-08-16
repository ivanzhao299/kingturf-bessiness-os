INSERT INTO permissions(capability,description) VALUES
  ('order-360:read','Read permission-bounded Order 360 aggregate and evidence timeline')
ON CONFLICT(capability) DO NOTHING;

INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT r.id,p.id,NULL,ARRAY['COMPANY']::data_scope[]
FROM roles r CROSS JOIN permissions p
WHERE r.code='SUPER_ADMIN' AND p.capability='order-360:read'
ON CONFLICT(role_id,permission_id) DO NOTHING;
