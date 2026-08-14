-- Close final mutation paths around submitted CTRs and issued quote economics.
CREATE OR REPLACE FUNCTION protect_ctr_attachment_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_locked boolean; new_locked boolean;
BEGIN
 old_locked := EXISTS(SELECT 1 FROM ctr_versions v WHERE v.id=OLD.ctr_version_id AND v.tenant_id=OLD.tenant_id AND v.status<>'DRAFT');
 new_locked := CASE WHEN TG_OP='DELETE' THEN false ELSE EXISTS(SELECT 1 FROM ctr_versions v WHERE v.id=NEW.ctr_version_id AND v.tenant_id=NEW.tenant_id AND v.status<>'DRAFT') END;
 IF old_locked OR new_locked THEN RAISE EXCEPTION 'submitted CTR attachment links are immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION validate_quote_revision_pins() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE solution_ctr uuid; evaluation_policy uuid; evaluation_cost uuid; decision_solution uuid;
        decision_total numeric(24,6); decision_currency char(3); line_subtotal numeric(24,6);
BEGIN
 SELECT ctr_version_id INTO solution_ctr FROM technical_solution_revisions WHERE id=NEW.technical_solution_revision_id AND tenant_id=NEW.tenant_id;
 SELECT sales_policy_version_id,cost_decision_id INTO evaluation_policy,evaluation_cost FROM sales_policy_evaluations WHERE id=NEW.sales_policy_evaluation_id AND tenant_id=NEW.tenant_id;
 SELECT technical_solution_revision_id,total,currency INTO decision_solution,decision_total,decision_currency
 FROM cost_sheet_decisions WHERE id=NEW.cost_decision_id AND tenant_id=NEW.tenant_id;
 IF solution_ctr IS DISTINCT FROM NEW.ctr_version_id THEN RAISE EXCEPTION 'quote CTR and technical solution pins disagree'; END IF;
 IF decision_solution IS DISTINCT FROM NEW.technical_solution_revision_id THEN RAISE EXCEPTION 'quote cost decision must pin quoted solution'; END IF;
 IF evaluation_policy IS DISTINCT FROM NEW.sales_policy_version_id OR evaluation_cost IS DISTINCT FROM NEW.cost_decision_id THEN RAISE EXCEPTION 'quote policy decision pins disagree'; END IF;
 IF NEW.status='ISSUED' THEN
   SELECT coalesce(sum(total),0) INTO line_subtotal FROM quote_lines WHERE tenant_id=NEW.tenant_id AND quote_revision_id=NEW.id;
   IF EXISTS(SELECT 1 FROM quote_lines l WHERE l.tenant_id=NEW.tenant_id AND l.quote_revision_id=NEW.id AND l.total<>trunc(l.quantity*l.unit_price,6))
      OR line_subtotal IS DISTINCT FROM NEW.subtotal
      OR decision_total IS DISTINCT FROM NEW.cost_total OR decision_currency IS DISTINCT FROM NEW.currency
      OR NEW.total<=0
      OR NEW.total<>NEW.subtotal-NEW.discount OR NEW.margin<>NEW.total-NEW.cost_total
      OR NEW.margin_basis_points<>trunc(NEW.margin/NEW.total*10000)::integer
   THEN RAISE EXCEPTION 'quote line totals or economics disagree'; END IF;
   IF NEW.valid_until<=now() OR NOT EXISTS(SELECT 1 FROM sales_policy_evaluations spe WHERE spe.id=NEW.sales_policy_evaluation_id AND spe.tenant_id=NEW.tenant_id AND spe.passed)
      OR (EXISTS(SELECT 1 FROM sales_policy_evaluations spe WHERE spe.id=NEW.sales_policy_evaluation_id AND spe.tenant_id=NEW.tenant_id AND spe.approval_required)
          AND NOT EXISTS(SELECT 1 FROM quote_approvals qa WHERE qa.quote_revision_id=NEW.id AND qa.tenant_id=NEW.tenant_id AND qa.decision='APPROVED'))
   THEN RAISE EXCEPTION 'quote issue validity or approval gate failed'; END IF;
 END IF;
 RETURN NEW;
END; $$;
