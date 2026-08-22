-- Atomic production role catalog for KingTurf's make-to-order turf business.
-- Roles are composable responsibilities. Critical prepare/approve/release duties
-- remain separate, and every business role is company-scoped by default.

CREATE TABLE atomic_role_templates(
  code text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE atomic_role_template_permissions(
  role_code text NOT NULL REFERENCES atomic_role_templates(code) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id),
  PRIMARY KEY(role_code,permission_id)
);

WITH role_definitions(code,name) AS (VALUES
  ('KT_LEAD_OPERATOR','线索运营专员'),
  ('KT_CUSTOMER_STEWARD','客户资料管理员'),
  ('KT_CUSTOMER_OWNERSHIP_MANAGER','客户归属管理员'),
  ('KT_OPPORTUNITY_OWNER','商机负责人'),
  ('KT_CTR_REVIEWER','客户技术需求复核员'),
  ('KT_SOLUTION_ENGINEER','技术方案工程师'),
  ('KT_COST_ANALYST','成本测算专员'),
  ('KT_SALES_POLICY_ADMIN','销售政策管理员'),
  ('KT_QUOTE_EDITOR','报价编制专员'),
  ('KT_QUOTE_APPROVER','报价审批员'),
  ('KT_QUOTE_ISSUER','报价签发员'),
  ('KT_CREDIT_ANALYST','信用评估专员'),
  ('KT_CREDIT_APPROVER','信用审批员'),
  ('KT_CONTRACT_SPECIALIST','合同编制专员'),
  ('KT_CONTRACT_SIGNATORY','合同签署确认员'),
  ('KT_ORDER_OPERATOR','销售订单专员'),
  ('KT_AR_ACCOUNTANT','应收会计'),
  ('KT_CASHIER','收款登记员'),
  ('KT_RECONCILIATION_ACCOUNTANT','回款核销会计'),
  ('KT_COMMISSION_POLICY_ADMIN','佣金政策管理员'),
  ('KT_COMMISSION_ACCOUNTANT','佣金核算专员'),
  ('KT_COMMISSION_PAYROLL_APPROVER','佣金支付确认员'),
  ('KT_RISK_MANAGER','经营风险管理员'),
  ('KT_MFG_MASTER_DATA_ENGINEER','制造主数据工程师'),
  ('KT_PROCUREMENT_BUYER','采购专员'),
  ('KT_INVENTORY_CONTROLLER','库存控制员'),
  ('KT_DEMAND_PLANNER','需求与MRP计划员'),
  ('KT_MRP_APPROVER','MRP批准与释放员'),
  ('KT_PRODUCTION_PLANNER','生产计划员'),
  ('KT_SHOPFLOOR_OPERATOR','车间执行员'),
  ('KT_PRODUCTION_SUPERVISOR','生产主管'),
  ('KT_QUALITY_PLAN_ENGINEER','质量计划工程师'),
  ('KT_QUALITY_INSPECTOR','质量检验员'),
  ('KT_QUALITY_MANAGER','质量放行经理'),
  ('KT_EXECUTIVE_VIEWER','经营管理驾驶舱查看者'),
  ('KT_SYSTEM_AUDITOR','系统审计员'),
  ('KT_IAM_ADMIN','身份与权限管理员'),
  ('KT_PLATFORM_OPERATOR','平台运维管理员')
)
INSERT INTO atomic_role_templates(code,name)
SELECT code,name FROM role_definitions;

WITH grants(role_code,capability) AS (VALUES
  ('KT_LEAD_OPERATOR','lead:read'),('KT_LEAD_OPERATOR','lead:create'),('KT_LEAD_OPERATOR','lead:update'),('KT_LEAD_OPERATOR','lead:lifecycle'),('KT_LEAD_OPERATOR','lead-pool:read'),('KT_LEAD_OPERATOR','lead-pool:claim'),('KT_LEAD_OPERATOR','lead-pool:release'),
  ('KT_CUSTOMER_STEWARD','customer:read'),('KT_CUSTOMER_STEWARD','customer:create'),('KT_CUSTOMER_STEWARD','customer:update'),('KT_CUSTOMER_STEWARD','customer:lifecycle'),('KT_CUSTOMER_STEWARD','customer-360:read'),('KT_CUSTOMER_STEWARD','customer-activity:read'),('KT_CUSTOMER_STEWARD','customer-activity:create'),
  ('KT_CUSTOMER_OWNERSHIP_MANAGER','employee:read'),('KT_CUSTOMER_OWNERSHIP_MANAGER','customer:read'),('KT_CUSTOMER_OWNERSHIP_MANAGER','customer-ownership:read'),('KT_CUSTOMER_OWNERSHIP_MANAGER','customer-ownership:assign'),('KT_CUSTOMER_OWNERSHIP_MANAGER','customer-ownership:reassign'),('KT_CUSTOMER_OWNERSHIP_MANAGER','lead:read'),('KT_CUSTOMER_OWNERSHIP_MANAGER','lead:assign'),('KT_CUSTOMER_OWNERSHIP_MANAGER','lead:reassign'),
  ('KT_OPPORTUNITY_OWNER','customer:read'),('KT_OPPORTUNITY_OWNER','customer-360:read'),('KT_OPPORTUNITY_OWNER','opportunity:read'),('KT_OPPORTUNITY_OWNER','opportunity:create'),('KT_OPPORTUNITY_OWNER','opportunity:update'),('KT_OPPORTUNITY_OWNER','opportunity:lifecycle'),('KT_OPPORTUNITY_OWNER','ctr:read'),('KT_OPPORTUNITY_OWNER','ctr:create'),('KT_OPPORTUNITY_OWNER','ctr:update'),('KT_OPPORTUNITY_OWNER','ctr:submit'),('KT_OPPORTUNITY_OWNER','attachment:read'),('KT_OPPORTUNITY_OWNER','attachment:manage'),
  ('KT_CTR_REVIEWER','opportunity:read'),('KT_CTR_REVIEWER','ctr:read'),('KT_CTR_REVIEWER','ctr:approve'),('KT_CTR_REVIEWER','technical-solution:read'),('KT_CTR_REVIEWER','attachment:read'),
  ('KT_SOLUTION_ENGINEER','opportunity:read'),('KT_SOLUTION_ENGINEER','ctr:read'),('KT_SOLUTION_ENGINEER','technical-solution:read'),('KT_SOLUTION_ENGINEER','technical-solution:create'),('KT_SOLUTION_ENGINEER','technical-solution:update'),('KT_SOLUTION_ENGINEER','attachment:read'),
  ('KT_COST_ANALYST','technical-solution:read'),('KT_COST_ANALYST','cost-model:read'),('KT_COST_ANALYST','cost-model:manage'),('KT_COST_ANALYST','cost:read'),('KT_COST_ANALYST','cost:evaluate'),
  ('KT_SALES_POLICY_ADMIN','sales-policy:read'),('KT_SALES_POLICY_ADMIN','sales-policy:manage'),('KT_SALES_POLICY_ADMIN','sales-policy:evaluate'),('KT_SALES_POLICY_ADMIN','cost:read'),
  ('KT_QUOTE_EDITOR','customer:read'),('KT_QUOTE_EDITOR','opportunity:read'),('KT_QUOTE_EDITOR','technical-solution:read'),('KT_QUOTE_EDITOR','cost:read'),('KT_QUOTE_EDITOR','sales-policy:read'),('KT_QUOTE_EDITOR','quote:read'),('KT_QUOTE_EDITOR','quote:create'),('KT_QUOTE_EDITOR','quote:update'),
  ('KT_QUOTE_APPROVER','quote:read'),('KT_QUOTE_APPROVER','quote:approve'),('KT_QUOTE_APPROVER','cost:read'),('KT_QUOTE_APPROVER','sales-policy:read'),
  ('KT_QUOTE_ISSUER','quote:read'),('KT_QUOTE_ISSUER','quote:issue'),
  ('KT_CREDIT_ANALYST','customer:read'),('KT_CREDIT_ANALYST','quote:read'),('KT_CREDIT_ANALYST','credit:read'),('KT_CREDIT_ANALYST','credit:evaluate'),
  ('KT_CREDIT_APPROVER','customer:read'),('KT_CREDIT_APPROVER','credit:read'),('KT_CREDIT_APPROVER','credit:approve'),
  ('KT_CONTRACT_SPECIALIST','customer:read'),('KT_CONTRACT_SPECIALIST','quote:read'),('KT_CONTRACT_SPECIALIST','credit:read'),('KT_CONTRACT_SPECIALIST','contract:read'),('KT_CONTRACT_SPECIALIST','contract:revise'),
  ('KT_CONTRACT_SIGNATORY','contract:read'),('KT_CONTRACT_SIGNATORY','contract:sign'),('KT_CONTRACT_SIGNATORY','credit:read'),
  ('KT_ORDER_OPERATOR','customer:read'),('KT_ORDER_OPERATOR','quote:read'),('KT_ORDER_OPERATOR','credit:read'),('KT_ORDER_OPERATOR','contract:read'),('KT_ORDER_OPERATOR','sales-order:read'),('KT_ORDER_OPERATOR','sales-order:create'),('KT_ORDER_OPERATOR','order-360:read'),
  ('KT_AR_ACCOUNTANT','sales-order:read'),('KT_AR_ACCOUNTANT','order-360:read'),('KT_AR_ACCOUNTANT','ar:read'),('KT_AR_ACCOUNTANT','ar:post'),
  ('KT_CASHIER','customer:read'),('KT_CASHIER','bank-payment:read'),('KT_CASHIER','bank-payment:intake'),
  ('KT_RECONCILIATION_ACCOUNTANT','ar:read'),('KT_RECONCILIATION_ACCOUNTANT','bank-payment:read'),('KT_RECONCILIATION_ACCOUNTANT','reconciliation:read'),('KT_RECONCILIATION_ACCOUNTANT','reconciliation:run'),('KT_RECONCILIATION_ACCOUNTANT','allocation:create'),
  ('KT_COMMISSION_POLICY_ADMIN','commission-policy:read'),('KT_COMMISSION_POLICY_ADMIN','commission-policy:manage'),
  ('KT_COMMISSION_ACCOUNTANT','sales-order:read'),('KT_COMMISSION_ACCOUNTANT','commission-policy:read'),('KT_COMMISSION_ACCOUNTANT','commission:read'),('KT_COMMISSION_ACCOUNTANT','commission:accrue'),('KT_COMMISSION_ACCOUNTANT','commission:manage'),
  ('KT_COMMISSION_PAYROLL_APPROVER','commission:read'),('KT_COMMISSION_PAYROLL_APPROVER','commission:pay'),
  ('KT_RISK_MANAGER','order-360:read'),('KT_RISK_MANAGER','risk-policy:read'),('KT_RISK_MANAGER','risk-policy:manage'),('KT_RISK_MANAGER','risk:read'),('KT_RISK_MANAGER','risk:evaluate'),('KT_RISK_MANAGER','risk:manage'),
  ('KT_MFG_MASTER_DATA_ENGINEER','manufacturing-item:read'),('KT_MFG_MASTER_DATA_ENGINEER','manufacturing-item:manage'),('KT_MFG_MASTER_DATA_ENGINEER','bom:read'),('KT_MFG_MASTER_DATA_ENGINEER','bom:manage'),('KT_MFG_MASTER_DATA_ENGINEER','routing:read'),('KT_MFG_MASTER_DATA_ENGINEER','routing:manage'),
  ('KT_PROCUREMENT_BUYER','supplier:read'),('KT_PROCUREMENT_BUYER','supplier:manage'),('KT_PROCUREMENT_BUYER','procurement:read'),('KT_PROCUREMENT_BUYER','procurement:manage'),('KT_PROCUREMENT_BUYER','inventory:read'),
  ('KT_INVENTORY_CONTROLLER','inventory:read'),('KT_INVENTORY_CONTROLLER','inventory:move'),('KT_INVENTORY_CONTROLLER','quality:read'),('KT_INVENTORY_CONTROLLER','traceability:read'),
  ('KT_DEMAND_PLANNER','manufacturing-item:read'),('KT_DEMAND_PLANNER','bom:read'),('KT_DEMAND_PLANNER','inventory:read'),('KT_DEMAND_PLANNER','mrp-policy:read'),('KT_DEMAND_PLANNER','mrp-policy:manage'),('KT_DEMAND_PLANNER','mrp:read'),('KT_DEMAND_PLANNER','mrp:run'),
  ('KT_MRP_APPROVER','mrp:read'),('KT_MRP_APPROVER','mrp:approve'),('KT_MRP_APPROVER','mrp:release'),
  ('KT_PRODUCTION_PLANNER','manufacturing-item:read'),('KT_PRODUCTION_PLANNER','bom:read'),('KT_PRODUCTION_PLANNER','routing:read'),('KT_PRODUCTION_PLANNER','mrp:read'),('KT_PRODUCTION_PLANNER','production:read'),('KT_PRODUCTION_PLANNER','production:plan'),
  ('KT_SHOPFLOOR_OPERATOR','production:read'),('KT_SHOPFLOOR_OPERATOR','production:material'),('KT_SHOPFLOOR_OPERATOR','production:report'),('KT_SHOPFLOOR_OPERATOR','inventory:read'),
  ('KT_PRODUCTION_SUPERVISOR','production:read'),('KT_PRODUCTION_SUPERVISOR','production:material'),('KT_PRODUCTION_SUPERVISOR','production:report'),('KT_PRODUCTION_SUPERVISOR','production:close'),('KT_PRODUCTION_SUPERVISOR','inventory:read'),('KT_PRODUCTION_SUPERVISOR','traceability:read'),
  ('KT_QUALITY_PLAN_ENGINEER','manufacturing-item:read'),('KT_QUALITY_PLAN_ENGINEER','quality-plan:read'),('KT_QUALITY_PLAN_ENGINEER','quality-plan:manage'),
  ('KT_QUALITY_INSPECTOR','quality-plan:read'),('KT_QUALITY_INSPECTOR','quality:read'),('KT_QUALITY_INSPECTOR','quality:inspect'),('KT_QUALITY_INSPECTOR','inventory:read'),('KT_QUALITY_INSPECTOR','traceability:read'),
  ('KT_QUALITY_MANAGER','quality-plan:read'),('KT_QUALITY_MANAGER','quality:read'),('KT_QUALITY_MANAGER','quality:disposition'),('KT_QUALITY_MANAGER','inventory:read'),('KT_QUALITY_MANAGER','traceability:read'),
  ('KT_EXECUTIVE_VIEWER','executive-dashboard:read'),('KT_EXECUTIVE_VIEWER','customer:read'),('KT_EXECUTIVE_VIEWER','opportunity:read'),('KT_EXECUTIVE_VIEWER','quote:read'),('KT_EXECUTIVE_VIEWER','contract:read'),('KT_EXECUTIVE_VIEWER','sales-order:read'),('KT_EXECUTIVE_VIEWER','order-360:read'),('KT_EXECUTIVE_VIEWER','ar:read'),('KT_EXECUTIVE_VIEWER','commission:read'),('KT_EXECUTIVE_VIEWER','risk:read'),('KT_EXECUTIVE_VIEWER','production:read'),('KT_EXECUTIVE_VIEWER','quality:read'),('KT_EXECUTIVE_VIEWER','traceability:read'),
  ('KT_SYSTEM_AUDITOR','audit:read'),('KT_SYSTEM_AUDITOR','authorization:read'),('KT_SYSTEM_AUDITOR','business-object:read'),('KT_SYSTEM_AUDITOR','order-360:read'),('KT_SYSTEM_AUDITOR','traceability:read'),
  ('KT_IAM_ADMIN','organization:read'),('KT_IAM_ADMIN','employee:read'),('KT_IAM_ADMIN','employee:create'),('KT_IAM_ADMIN','employee:update'),('KT_IAM_ADMIN','authorization:read'),('KT_IAM_ADMIN','authorization:manage'),('KT_IAM_ADMIN','audit:read'),
  ('KT_PLATFORM_OPERATOR','master-data:read'),('KT_PLATFORM_OPERATOR','master-data:create'),('KT_PLATFORM_OPERATOR','master-data:update'),('KT_PLATFORM_OPERATOR','master-data:delete'),('KT_PLATFORM_OPERATOR','number:create'),('KT_PLATFORM_OPERATOR','number:update'),('KT_PLATFORM_OPERATOR','number:allocate'),('KT_PLATFORM_OPERATOR','rule:create'),('KT_PLATFORM_OPERATOR','rule:update'),('KT_PLATFORM_OPERATOR','rule:evaluate'),('KT_PLATFORM_OPERATOR','workflow:create'),('KT_PLATFORM_OPERATOR','workflow:update'),('KT_PLATFORM_OPERATOR','workflow:start'),('KT_PLATFORM_OPERATOR','notification:read'),('KT_PLATFORM_OPERATOR','notification:manage'),('KT_PLATFORM_OPERATOR','event:operate'),('KT_PLATFORM_OPERATOR','business-object:read'),('KT_PLATFORM_OPERATOR','business-object:manage')
)
INSERT INTO atomic_role_template_permissions(role_code,permission_id)
SELECT g.role_code,p.id FROM grants g JOIN permissions p ON p.capability=g.capability;

CREATE FUNCTION provision_atomic_business_roles(company uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  INSERT INTO roles(organization_id,code,name)
  SELECT company,t.code,t.name FROM atomic_role_templates t
  ON CONFLICT(organization_id,code) DO UPDATE SET name=excluded.name,updated_at=now();
  INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
  SELECT r.id,tp.permission_id,NULL,ARRAY['COMPANY']::data_scope[]
  FROM roles r JOIN atomic_role_template_permissions tp ON tp.role_code=r.code
  WHERE r.organization_id=company AND r.deleted_at IS NULL
  ON CONFLICT(role_id,permission_id) DO UPDATE SET data_scopes=excluded.data_scopes;
END $$;

CREATE FUNCTION provision_atomic_business_roles_on_company() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.organization_type='COMPANY' AND NEW.deleted_at IS NULL THEN PERFORM provision_atomic_business_roles(NEW.id); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER organizations_atomic_roles AFTER INSERT ON organizations
FOR EACH ROW EXECUTE FUNCTION provision_atomic_business_roles_on_company();

SELECT provision_atomic_business_roles(id) FROM organizations
WHERE organization_type='COMPANY' AND deleted_at IS NULL;
