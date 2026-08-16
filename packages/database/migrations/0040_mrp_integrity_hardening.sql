CREATE TRIGGER mrp_planning_policy_immutable BEFORE UPDATE OR DELETE ON mrp_planning_policies FOR EACH ROW EXECUTE FUNCTION protect_procurement_evidence();
CREATE TRIGGER mrp_demand_signal_immutable BEFORE UPDATE OR DELETE ON mrp_demand_signals FOR EACH ROW EXECUTE FUNCTION protect_procurement_evidence();
CREATE TRIGGER mrp_run_delete_forbidden BEFORE DELETE ON mrp_runs FOR EACH ROW EXECUTE FUNCTION protect_procurement_evidence();

CREATE FUNCTION validate_mrp_proposal_event_run_state() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE run_state mrp_run_status; BEGIN
  SELECT r.status INTO run_state FROM mrp_proposals p JOIN mrp_runs r ON r.id=p.mrp_run_id AND r.tenant_id=p.tenant_id
  WHERE p.id=NEW.proposal_id AND p.tenant_id=NEW.tenant_id;
  IF NEW.sequence>1 AND run_state<>'COMPUTED' THEN RAISE EXCEPTION 'proposal decisions require a computed active MRP run'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER mrp_proposal_run_state_guard BEFORE INSERT ON mrp_proposal_events FOR EACH ROW EXECUTE FUNCTION validate_mrp_proposal_event_run_state();
