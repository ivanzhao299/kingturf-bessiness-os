-- Grant online-document work to the roles that own the corresponding business process.
WITH grants(role_code, capability) AS (VALUES
  ('KT_OPPORTUNITY_OWNER','business-document:read'),('KT_OPPORTUNITY_OWNER','business-document:manage'),
  ('KT_CTR_REVIEWER','business-document:read'),('KT_CTR_REVIEWER','business-document:approve'),
  ('KT_SOLUTION_ENGINEER','business-document:read'),('KT_SOLUTION_ENGINEER','business-document:manage'),
  ('KT_COST_ANALYST','business-document:read'),
  ('KT_QUOTE_EDITOR','business-document:read'),('KT_QUOTE_EDITOR','business-document:manage'),
  ('KT_QUOTE_APPROVER','business-document:read'),('KT_QUOTE_APPROVER','business-document:approve'),
  ('KT_QUOTE_ISSUER','business-document:read'),
  ('KT_CONTRACT_SPECIALIST','business-document:read'),('KT_CONTRACT_SPECIALIST','business-document:manage'),
  ('KT_CONTRACT_SIGNATORY','business-document:read'),('KT_CONTRACT_SIGNATORY','business-document:approve'),
  ('KT_ORDER_OPERATOR','business-document:read'),('KT_ORDER_OPERATOR','business-document:manage'),
  ('KT_RISK_MANAGER','business-document:read'),('KT_RISK_MANAGER','business-document:manage'),
  ('KT_MFG_MASTER_DATA_ENGINEER','business-document:read'),('KT_MFG_MASTER_DATA_ENGINEER','business-document:manage'),
  ('KT_PROCUREMENT_BUYER','business-document:read'),('KT_PROCUREMENT_BUYER','business-document:manage'),
  ('KT_PRODUCTION_PLANNER','business-document:read'),('KT_PRODUCTION_PLANNER','business-document:manage'),
  ('KT_PRODUCTION_SUPERVISOR','business-document:read'),
  ('KT_QUALITY_INSPECTOR','business-document:read'),('KT_QUALITY_INSPECTOR','business-document:manage'),
  ('KT_QUALITY_MANAGER','business-document:read'),('KT_QUALITY_MANAGER','business-document:manage'),('KT_QUALITY_MANAGER','business-document:approve'),
  ('KT_EXECUTIVE_VIEWER','business-document:read'),('KT_SYSTEM_AUDITOR','business-document:read')
)
INSERT INTO atomic_role_template_permissions(role_code,permission_id)
SELECT grants.role_code,permissions.id
FROM grants JOIN permissions ON permissions.capability=grants.capability
ON CONFLICT DO NOTHING;

WITH grants(role_code, capability) AS (VALUES
  ('KT_OPPORTUNITY_OWNER','business-document:read'),('KT_OPPORTUNITY_OWNER','business-document:manage'),
  ('KT_CTR_REVIEWER','business-document:read'),('KT_CTR_REVIEWER','business-document:approve'),
  ('KT_SOLUTION_ENGINEER','business-document:read'),('KT_SOLUTION_ENGINEER','business-document:manage'),
  ('KT_COST_ANALYST','business-document:read'),
  ('KT_QUOTE_EDITOR','business-document:read'),('KT_QUOTE_EDITOR','business-document:manage'),
  ('KT_QUOTE_APPROVER','business-document:read'),('KT_QUOTE_APPROVER','business-document:approve'),
  ('KT_QUOTE_ISSUER','business-document:read'),
  ('KT_CONTRACT_SPECIALIST','business-document:read'),('KT_CONTRACT_SPECIALIST','business-document:manage'),
  ('KT_CONTRACT_SIGNATORY','business-document:read'),('KT_CONTRACT_SIGNATORY','business-document:approve'),
  ('KT_ORDER_OPERATOR','business-document:read'),('KT_ORDER_OPERATOR','business-document:manage'),
  ('KT_RISK_MANAGER','business-document:read'),('KT_RISK_MANAGER','business-document:manage'),
  ('KT_MFG_MASTER_DATA_ENGINEER','business-document:read'),('KT_MFG_MASTER_DATA_ENGINEER','business-document:manage'),
  ('KT_PROCUREMENT_BUYER','business-document:read'),('KT_PROCUREMENT_BUYER','business-document:manage'),
  ('KT_PRODUCTION_PLANNER','business-document:read'),('KT_PRODUCTION_PLANNER','business-document:manage'),
  ('KT_PRODUCTION_SUPERVISOR','business-document:read'),
  ('KT_QUALITY_INSPECTOR','business-document:read'),('KT_QUALITY_INSPECTOR','business-document:manage'),
  ('KT_QUALITY_MANAGER','business-document:read'),('KT_QUALITY_MANAGER','business-document:manage'),('KT_QUALITY_MANAGER','business-document:approve'),
  ('KT_EXECUTIVE_VIEWER','business-document:read'),('KT_SYSTEM_AUDITOR','business-document:read')
)
INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT roles.id,permissions.id,NULL::text[],ARRAY['COMPANY']::data_scope[]
FROM roles
JOIN grants ON grants.role_code=roles.code
JOIN permissions ON permissions.capability=grants.capability
ON CONFLICT(role_id,permission_id) DO NOTHING;

INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT roles.id,permissions.id,NULL::text[],ARRAY['COMPANY']::data_scope[]
FROM roles CROSS JOIN permissions
WHERE roles.code=ANY(ARRAY['SUPER_ADMIN','SYSTEM_ADMIN'])
  AND permissions.capability=ANY(ARRAY[
    'business-document:read','business-document:manage','business-document:approve'
  ])
ON CONFLICT(role_id,permission_id) DO NOTHING;
