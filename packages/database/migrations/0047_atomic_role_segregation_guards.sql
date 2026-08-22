-- Prevent high-risk atomic role combinations from being assigned to one employee.
-- Break-glass SYSTEM_ADMIN is governed separately and is not a normal business role.

CREATE TABLE atomic_role_conflicts(
  left_role_code text NOT NULL REFERENCES atomic_role_templates(code),
  right_role_code text NOT NULL REFERENCES atomic_role_templates(code),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(left_role_code,right_role_code),
  CHECK(left_role_code<right_role_code)
);

INSERT INTO atomic_role_conflicts(left_role_code,right_role_code,reason) VALUES
  ('KT_QUOTE_APPROVER','KT_QUOTE_EDITOR','报价编制与审批必须分离'),
  ('KT_QUOTE_EDITOR','KT_QUOTE_ISSUER','报价编制与签发必须分离'),
  ('KT_CREDIT_ANALYST','KT_CREDIT_APPROVER','信用评估与批准必须分离'),
  ('KT_CONTRACT_SIGNATORY','KT_CONTRACT_SPECIALIST','合同编制与签署确认必须分离'),
  ('KT_CASHIER','KT_RECONCILIATION_ACCOUNTANT','收款登记与回款核销必须分离'),
  ('KT_COMMISSION_ACCOUNTANT','KT_COMMISSION_PAYROLL_APPROVER','佣金核算与支付确认必须分离'),
  ('KT_DEMAND_PLANNER','KT_MRP_APPROVER','MRP计算与批准释放必须分离'),
  ('KT_QUALITY_INSPECTOR','KT_QUALITY_MANAGER','质量检验与批次处置必须分离');

CREATE FUNCTION enforce_atomic_role_segregation() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE
  incoming_code text; existing_code text; conflict_reason text;
BEGIN
  SELECT code INTO incoming_code FROM roles WHERE id=NEW.role_id;
  IF incoming_code NOT LIKE 'KT\_%' ESCAPE '\' THEN RETURN NEW; END IF;
  SELECT r.code,c.reason INTO existing_code,conflict_reason
  FROM employee_role_assignments a JOIN roles r ON r.id=a.role_id
  JOIN atomic_role_conflicts c ON
    (c.left_role_code=least(incoming_code,r.code) AND c.right_role_code=greatest(incoming_code,r.code))
  WHERE a.employee_id=NEW.employee_id AND a.role_id<>NEW.role_id LIMIT 1;
  IF conflict_reason IS NOT NULL THEN
    RAISE EXCEPTION 'segregation of duties conflict: % conflicts with % (%)',incoming_code,existing_code,conflict_reason;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER employee_role_assignments_segregation
BEFORE INSERT OR UPDATE ON employee_role_assignments
FOR EACH ROW EXECUTE FUNCTION enforce_atomic_role_segregation();
