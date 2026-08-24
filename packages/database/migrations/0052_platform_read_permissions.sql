BEGIN;

INSERT INTO permissions(capability, description)
VALUES
  ('number:read', 'Read number definitions and versions'),
  ('rule:read', 'Read rule definitions and versions'),
  ('workflow:read', 'Read workflow definitions and versions')
ON CONFLICT (capability) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO atomic_role_template_permissions(role_code, permission_id)
SELECT x.role_code, p.id
FROM (VALUES
  ('KT_PLATFORM_OPERATOR', 'number:read'),
  ('KT_PLATFORM_OPERATOR', 'rule:read'),
  ('KT_PLATFORM_OPERATOR', 'workflow:read')
) AS x(role_code, capability)
JOIN permissions p ON p.capability = x.capability
ON CONFLICT DO NOTHING;

INSERT INTO role_permission_grants(role_id, permission_id, field_allowlist, data_scopes)
SELECT r.id, p.id, NULL, ARRAY['COMPANY']::data_scope[]
FROM roles r
JOIN permissions p ON p.capability = ANY(ARRAY['number:read', 'rule:read', 'workflow:read'])
WHERE r.code = ANY(ARRAY['SUPER_ADMIN', 'SYSTEM_ADMIN', 'KT_PLATFORM_OPERATOR'])
ON CONFLICT (role_id, permission_id) DO UPDATE SET data_scopes = EXCLUDED.data_scopes;

COMMIT;
