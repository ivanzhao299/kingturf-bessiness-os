-- JTF-P1-E05..E10 integrity completion. Append-only repair of the commercial revision graph.
CREATE TABLE opportunity_snapshots(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, opportunity_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 snapshot_hash char(64) NOT NULL, captured_at timestamptz NOT NULL DEFAULT now(), captured_by uuid NOT NULL,
 UNIQUE(id,tenant_id), UNIQUE(tenant_id,opportunity_id,version),
 FOREIGN KEY(opportunity_id,tenant_id) REFERENCES opportunities(id,tenant_id),
 FOREIGN KEY(captured_by,tenant_id) REFERENCES employees(id,company_id)
);
ALTER TABLE quote_revisions ADD COLUMN opportunity_snapshot_id uuid;
ALTER TABLE quote_revisions ADD CONSTRAINT quote_revision_opportunity_snapshot_fk
 FOREIGN KEY(opportunity_snapshot_id,tenant_id) REFERENCES opportunity_snapshots(id,tenant_id);

CREATE FUNCTION protect_published_commercial_definition() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.status='PUBLISHED' THEN RAISE EXCEPTION 'published commercial definition is immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION protect_ctr_version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'submitted CTR version is immutable'; END IF;
 IF OLD.status='DRAFT' THEN RETURN NEW; END IF;
 IF OLD.status='SUBMITTED' AND NEW.status IN('APPROVED','REJECTED')
   AND NEW.id=OLD.id AND NEW.tenant_id=OLD.tenant_id AND NEW.ctr_id=OLD.ctr_id AND NEW.version=OLD.version
   AND NEW.title=OLD.title AND NEW.requirements=OLD.requirements AND NEW.snapshot_hash=OLD.snapshot_hash
   AND NEW.submitted_at=OLD.submitted_at AND NEW.created_at=OLD.created_at AND NEW.created_by=OLD.created_by
 THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'submitted CTR version is immutable';
END $$;
CREATE FUNCTION protect_ctr_attachment_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM ctr_versions v WHERE v.id=OLD.ctr_version_id AND v.tenant_id=OLD.tenant_id AND v.status<>'DRAFT')
 THEN RAISE EXCEPTION 'submitted CTR attachment links are immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE FUNCTION validate_ctr_approval_state() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM ctr_versions v WHERE v.id=NEW.ctr_version_id AND v.tenant_id=NEW.tenant_id AND v.status='SUBMITTED')
 THEN RAISE EXCEPTION 'CTR approval requires submitted version'; END IF; RETURN NEW;
END $$;
CREATE FUNCTION protect_quote_child() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE revision_id uuid; BEGIN
 revision_id := CASE WHEN TG_OP='DELETE' THEN OLD.quote_revision_id ELSE NEW.quote_revision_id END;
 IF EXISTS(SELECT 1 FROM quote_revisions r WHERE r.id=revision_id AND r.tenant_id=CASE WHEN TG_OP='DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END AND r.status='ISSUED')
 THEN RAISE EXCEPTION 'issued quote children are immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE FUNCTION validate_quote_opportunity_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE q_opportunity uuid; pinned_version integer; BEGIN
 SELECT opportunity_id INTO q_opportunity FROM quotes WHERE id=NEW.quote_id AND tenant_id=NEW.tenant_id;
 SELECT version INTO pinned_version FROM opportunity_snapshots WHERE id=NEW.opportunity_snapshot_id AND tenant_id=NEW.tenant_id AND opportunity_id=q_opportunity;
 IF pinned_version IS NULL OR pinned_version<>NEW.opportunity_version THEN RAISE EXCEPTION 'quote requires immutable opportunity snapshot'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION validate_quote_revision_pins() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE solution_ctr uuid; evaluation_policy uuid; evaluation_cost uuid; BEGIN
 SELECT ctr_version_id INTO solution_ctr FROM technical_solution_revisions WHERE id=NEW.technical_solution_revision_id AND tenant_id=NEW.tenant_id;
 SELECT sales_policy_version_id,cost_decision_id INTO evaluation_policy,evaluation_cost FROM sales_policy_evaluations WHERE id=NEW.sales_policy_evaluation_id AND tenant_id=NEW.tenant_id;
 IF solution_ctr IS DISTINCT FROM NEW.ctr_version_id THEN RAISE EXCEPTION 'quote CTR and technical solution pins disagree'; END IF;
 IF evaluation_policy IS DISTINCT FROM NEW.sales_policy_version_id OR evaluation_cost IS DISTINCT FROM NEW.cost_decision_id THEN RAISE EXCEPTION 'quote policy decision pins disagree'; END IF;
 IF NEW.status='ISSUED' AND (NEW.valid_until<=now() OR NOT EXISTS(SELECT 1 FROM sales_policy_evaluations spe WHERE spe.id=NEW.sales_policy_evaluation_id AND spe.tenant_id=NEW.tenant_id AND spe.passed) OR (EXISTS(SELECT 1 FROM sales_policy_evaluations spe WHERE spe.id=NEW.sales_policy_evaluation_id AND spe.tenant_id=NEW.tenant_id AND spe.approval_required) AND NOT EXISTS(SELECT 1 FROM quote_approvals qa WHERE qa.quote_revision_id=NEW.id AND qa.tenant_id=NEW.tenant_id AND qa.decision='APPROVED'))) THEN RAISE EXCEPTION 'quote issue validity or approval gate failed'; END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER opportunity_snapshots_immutable BEFORE UPDATE OR DELETE ON opportunity_snapshots FOR EACH ROW EXECUTE FUNCTION protect_commercial_frozen_row();
CREATE TRIGGER cost_model_published_immutable BEFORE UPDATE OR DELETE ON cost_model_versions FOR EACH ROW EXECUTE FUNCTION protect_published_commercial_definition();
CREATE TRIGGER sales_policy_published_immutable BEFORE UPDATE OR DELETE ON sales_policy_versions FOR EACH ROW EXECUTE FUNCTION protect_published_commercial_definition();
CREATE TRIGGER ctr_attachment_links_guard BEFORE UPDATE OR DELETE ON ctr_attachment_links FOR EACH ROW EXECUTE FUNCTION protect_ctr_attachment_link();
CREATE TRIGGER ctr_approval_state_guard BEFORE INSERT ON ctr_approvals FOR EACH ROW EXECUTE FUNCTION validate_ctr_approval_state();
CREATE TRIGGER quote_lines_frozen_guard BEFORE INSERT OR UPDATE OR DELETE ON quote_lines FOR EACH ROW EXECUTE FUNCTION protect_quote_child();
CREATE TRIGGER quote_approvals_frozen_guard BEFORE INSERT OR UPDATE OR DELETE ON quote_approvals FOR EACH ROW EXECUTE FUNCTION protect_quote_child();
CREATE TRIGGER quote_opportunity_snapshot_guard BEFORE INSERT OR UPDATE ON quote_revisions FOR EACH ROW EXECUTE FUNCTION validate_quote_opportunity_snapshot();

CREATE TRIGGER cost_sheet_lines_immutable BEFORE UPDATE OR DELETE ON cost_sheet_lines FOR EACH ROW EXECUTE FUNCTION protect_commercial_frozen_row();
