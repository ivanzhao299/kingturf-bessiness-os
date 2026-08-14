-- Reviewer hardening for JTF-P1-E05..E10. Append-only: bind retries and close graph/immutability gaps.
ALTER TABLE commercial_command_results ADD COLUMN actor_id uuid;
ALTER TABLE commercial_command_results ADD COLUMN request_hash char(64);
UPDATE commercial_command_results r
SET actor_id=coalesce((r.payload->>'actorId')::uuid,
  (SELECT e.id FROM employees e WHERE e.company_id=r.tenant_id ORDER BY e.created_at,e.id LIMIT 1)),
    request_hash=encode(sha256(convert_to(r.command_type||':'||r.subject_id::text||':'||r.payload::text,'UTF8')),'hex');
ALTER TABLE commercial_command_results ALTER COLUMN actor_id SET NOT NULL;
ALTER TABLE commercial_command_results ALTER COLUMN request_hash SET NOT NULL;
ALTER TABLE commercial_command_results ADD CONSTRAINT commercial_command_actor_fk
  FOREIGN KEY(actor_id,tenant_id) REFERENCES employees(id,company_id);
ALTER TABLE commercial_command_results ADD CONSTRAINT commercial_command_identity_unique
  UNIQUE(tenant_id,idempotency_key,command_type,subject_id,actor_id,request_hash);

CREATE OR REPLACE FUNCTION validate_technical_solution_ctr_pin() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE
 solution_opportunity uuid; ctr_opportunity uuid;
BEGIN
 SELECT opportunity_id INTO solution_opportunity FROM technical_solutions
  WHERE id=NEW.technical_solution_id AND tenant_id=NEW.tenant_id AND deleted_at IS NULL;
 SELECT c.opportunity_id INTO ctr_opportunity FROM ctr_versions v JOIN ctrs c
  ON c.id=v.ctr_id AND c.tenant_id=v.tenant_id
  WHERE v.id=NEW.ctr_version_id AND v.tenant_id=NEW.tenant_id AND v.status IN('SUBMITTED','APPROVED');
 IF solution_opportunity IS NULL OR ctr_opportunity IS DISTINCT FROM solution_opportunity
 THEN RAISE EXCEPTION 'technical solution CTR must belong to the same opportunity'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION validate_cost_decision_pins() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM cost_model_versions cmv WHERE cmv.id=NEW.cost_model_version_id AND cmv.tenant_id=NEW.tenant_id AND cmv.status='PUBLISHED')
 THEN RAISE EXCEPTION 'cost decision requires published model version'; END IF;
 IF NOT EXISTS(SELECT 1 FROM technical_solution_revisions sr WHERE sr.id=NEW.technical_solution_revision_id AND sr.tenant_id=NEW.tenant_id AND sr.status='FINAL')
 THEN RAISE EXCEPTION 'cost decision requires final solution revision'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION validate_quote_revision_pins() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE
 solution_ctr uuid; evaluation_policy uuid; evaluation_cost uuid; decision_solution uuid;
BEGIN
 SELECT ctr_version_id INTO solution_ctr FROM technical_solution_revisions WHERE id=NEW.technical_solution_revision_id AND tenant_id=NEW.tenant_id;
 SELECT sales_policy_version_id,cost_decision_id INTO evaluation_policy,evaluation_cost FROM sales_policy_evaluations WHERE id=NEW.sales_policy_evaluation_id AND tenant_id=NEW.tenant_id;
 SELECT technical_solution_revision_id INTO decision_solution FROM cost_sheet_decisions WHERE id=NEW.cost_decision_id AND tenant_id=NEW.tenant_id;
 IF solution_ctr IS DISTINCT FROM NEW.ctr_version_id THEN RAISE EXCEPTION 'quote CTR and technical solution pins disagree'; END IF;
 IF decision_solution IS DISTINCT FROM NEW.technical_solution_revision_id THEN RAISE EXCEPTION 'quote cost decision must pin quoted solution'; END IF;
 IF evaluation_policy IS DISTINCT FROM NEW.sales_policy_version_id OR evaluation_cost IS DISTINCT FROM NEW.cost_decision_id THEN RAISE EXCEPTION 'quote policy decision pins disagree'; END IF;
 IF NEW.status='ISSUED' AND (NEW.valid_until<=now() OR NOT EXISTS(SELECT 1 FROM sales_policy_evaluations spe WHERE spe.id=NEW.sales_policy_evaluation_id AND spe.tenant_id=NEW.tenant_id AND spe.passed) OR (EXISTS(SELECT 1 FROM sales_policy_evaluations spe WHERE spe.id=NEW.sales_policy_evaluation_id AND spe.tenant_id=NEW.tenant_id AND spe.approval_required) AND NOT EXISTS(SELECT 1 FROM quote_approvals qa WHERE qa.quote_revision_id=NEW.id AND qa.tenant_id=NEW.tenant_id AND qa.decision='APPROVED'))) THEN RAISE EXCEPTION 'quote issue validity or approval gate failed'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION protect_quote_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'quote revisions cannot be deleted'; END IF;
 IF NEW.id<>OLD.id OR NEW.tenant_id<>OLD.tenant_id OR NEW.quote_id<>OLD.quote_id OR NEW.revision<>OLD.revision
   OR NEW.opportunity_version<>OLD.opportunity_version OR NEW.opportunity_snapshot_id<>OLD.opportunity_snapshot_id
   OR NEW.ctr_version_id<>OLD.ctr_version_id OR NEW.technical_solution_revision_id<>OLD.technical_solution_revision_id
   OR NEW.cost_decision_id<>OLD.cost_decision_id OR NEW.sales_policy_version_id<>OLD.sales_policy_version_id
   OR NEW.sales_policy_evaluation_id<>OLD.sales_policy_evaluation_id OR NEW.currency<>OLD.currency
   OR NEW.subtotal<>OLD.subtotal OR NEW.discount<>OLD.discount OR NEW.total<>OLD.total OR NEW.cost_total<>OLD.cost_total
   OR NEW.margin<>OLD.margin OR NEW.margin_basis_points<>OLD.margin_basis_points OR NEW.valid_until<>OLD.valid_until
   OR NEW.created_at<>OLD.created_at OR NEW.created_by<>OLD.created_by
 THEN RAISE EXCEPTION 'quote revision pins and commercial values are immutable'; END IF;
 IF OLD.status='ISSUED' THEN RAISE EXCEPTION 'issued quote revision is immutable'; END IF;
 RETURN NEW;
END $$;
