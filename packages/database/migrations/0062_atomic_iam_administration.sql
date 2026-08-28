-- Split broad authorization administration into daily atomic IAM duties.
INSERT INTO permissions(capability,description) VALUES
 ('identity:read','Read login identity state and session summary'),
 ('identity:manage','Provision, enable, disable, and revoke identity sessions'),
 ('role:read','Read roles and their granted capabilities'),
 ('role:manage','Create and maintain role definitions'),
 ('permission:read','Read the atomic capability catalog'),
 ('permission:manage','Maintain custom atomic capabilities'),
 ('role-assignment:read','Read employee role assignments'),
 ('role-assignment:manage','Assign and revoke employee roles'),
 ('data-scope:read','Read direct employee data-scope grants'),
 ('data-scope:manage','Create and revoke direct employee data-scope grants')
ON CONFLICT(capability) DO NOTHING;

WITH grants(role_code,capability) AS (VALUES
 ('KT_IAM_ADMIN','identity:read'),('KT_IAM_ADMIN','identity:manage'),
 ('KT_IAM_ADMIN','role:read'),('KT_IAM_ADMIN','role:manage'),
 ('KT_IAM_ADMIN','permission:read'),('KT_IAM_ADMIN','permission:manage'),
 ('KT_IAM_ADMIN','role-assignment:read'),('KT_IAM_ADMIN','role-assignment:manage'),
 ('KT_IAM_ADMIN','data-scope:read'),('KT_IAM_ADMIN','data-scope:manage'),
 ('KT_SYSTEM_AUDITOR','identity:read'),('KT_SYSTEM_AUDITOR','role:read'),
 ('KT_SYSTEM_AUDITOR','permission:read'),('KT_SYSTEM_AUDITOR','role-assignment:read'),
 ('KT_SYSTEM_AUDITOR','data-scope:read')
)
INSERT INTO atomic_role_template_permissions(role_code,permission_id)
SELECT g.role_code,p.id FROM grants g JOIN permissions p ON p.capability=g.capability
ON CONFLICT DO NOTHING;

SELECT provision_atomic_business_roles(id) FROM organizations
WHERE organization_type='COMPANY' AND deleted_at IS NULL;

CREATE INDEX audit_events_tenant_time_desc_idx ON audit_events(organization_id,occurred_at DESC,id DESC);
CREATE INDEX audit_events_tenant_actor_time_idx ON audit_events(organization_id,actor_id,occurred_at DESC);
CREATE INDEX audit_events_tenant_action_time_idx ON audit_events(organization_id,action,occurred_at DESC);
