CREATE FUNCTION validate_risk_policy_publish() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='DRAFT' AND NEW.status='PUBLISHED' AND NEW.published_at IS NOT NULL
     AND (NEW.policy_id,NEW.tenant_id,NEW.version,NEW.minimum_margin_basis_points,
          NEW.overdue_grace_days,NEW.credit_warning_days,NEW.effective_at,NEW.rules,
          NEW.canonical_hash,NEW.created_by,NEW.created_at)
         IS NOT DISTINCT FROM
         (OLD.policy_id,OLD.tenant_id,OLD.version,OLD.minimum_margin_basis_points,
          OLD.overdue_grace_days,OLD.credit_warning_days,OLD.effective_at,OLD.rules,
          OLD.canonical_hash,OLD.created_by,OLD.created_at) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'risk policy versions only allow DRAFT to PUBLISHED transition';
END $$;
CREATE TRIGGER risk_policy_publish_guard
  BEFORE UPDATE ON risk_policy_versions FOR EACH ROW WHEN (OLD.status='DRAFT')
  EXECUTE FUNCTION validate_risk_policy_publish();

CREATE UNIQUE INDEX risk_policy_one_published_effective_version
  ON risk_policy_versions(tenant_id,policy_id,effective_at)
  WHERE status='PUBLISHED';
