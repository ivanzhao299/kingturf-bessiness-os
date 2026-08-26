INSERT INTO permissions(capability,description) VALUES
  ('complaint-sla:read','Read published customer complaint SLA policies'),
  ('complaint-sla:manage','Publish customer complaint SLA policy versions')
ON CONFLICT(capability) DO NOTHING;

INSERT INTO atomic_role_template_permissions(role_code,permission_id)
SELECT x.role_code,p.id FROM (VALUES
  ('KT_COMPLAINT_REGISTRAR','complaint-sla:read'),
  ('KT_COMPLAINT_COORDINATOR','complaint-sla:read'),
  ('KT_QUALITY_MANAGER','complaint-sla:read'),
  ('KT_QUALITY_MANAGER','complaint-sla:manage')
)x(role_code,capability)
JOIN permissions p ON p.capability=x.capability
ON CONFLICT DO NOTHING;

SELECT provision_atomic_business_roles(id)
FROM organizations
WHERE organization_type='COMPANY' AND deleted_at IS NULL;

INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT r.id,p.id,NULL,ARRAY['COMPANY']::data_scope[]
FROM roles r CROSS JOIN permissions p
WHERE r.code=ANY(ARRAY['SUPER_ADMIN','SYSTEM_ADMIN'])
  AND p.capability=ANY(ARRAY['complaint-sla:read','complaint-sla:manage'])
ON CONFLICT DO NOTHING;
