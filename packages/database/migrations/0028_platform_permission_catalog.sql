-- Complete the permission catalog for platform APIs that predate capability seeding.
-- Existing SUPER_ADMIN roles receive the new capabilities with GROUP scope so an
-- append-only migration cannot silently reduce an administrator's effective access.

INSERT INTO permissions(capability,description) VALUES
  ('organization:read','Read organization hierarchy'),
  ('organization:create','Create organization units'),
  ('organization:update','Update organization units'),
  ('employee:read','Read employee directory'),
  ('employee:create','Create employees'),
  ('employee:update','Update employees'),
  ('authorization:read','Read roles and authorization grants'),
  ('authorization:manage','Manage roles and authorization grants'),
  ('audit:read','Read immutable audit events'),
  ('master-data:read','Read master data'),
  ('master-data:create','Create master data'),
  ('master-data:update','Update master data'),
  ('master-data:delete','Logically delete master data'),
  ('number:create','Create number definitions'),
  ('number:update','Update number definitions'),
  ('number:allocate','Allocate governed numbers'),
  ('rule:create','Create rule definitions'),
  ('rule:update','Update rule definitions'),
  ('rule:evaluate','Evaluate published rules'),
  ('workflow:create','Create workflow definitions'),
  ('workflow:update','Update workflow definitions'),
  ('workflow:start','Start workflow instances'),
  ('workflow:decide','Decide assigned workflow tasks')
ON CONFLICT(capability) DO NOTHING;

INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT roles.id,permissions.id,NULL,ARRAY['GROUP']::data_scope[]
FROM roles
CROSS JOIN permissions
WHERE roles.code='SUPER_ADMIN'
  AND permissions.capability=ANY(ARRAY[
    'organization:read','organization:create','organization:update',
    'employee:read','employee:create','employee:update',
    'authorization:read','authorization:manage','audit:read',
    'master-data:read','master-data:create','master-data:update','master-data:delete',
    'number:create','number:update','number:allocate',
    'rule:create','rule:update','rule:evaluate',
    'workflow:create','workflow:update','workflow:start','workflow:decide'
  ]::text[])
ON CONFLICT(role_id,permission_id) DO NOTHING;

