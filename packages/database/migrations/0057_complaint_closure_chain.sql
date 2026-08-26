CREATE FUNCTION validate_complaint_closure_chain() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  severity complaint_severity;
  has_ncr boolean;
  chain_closed boolean;
BEGIN
  IF NEW.state<>'CLOSED' THEN RETURN NEW; END IF;
  SELECT c.severity,EXISTS(
    SELECT 1 FROM nonconformance_reports n
    WHERE n.tenant_id=c.tenant_id AND n.complaint_id=c.id
  ) INTO severity,has_ncr
  FROM customer_complaints c
  WHERE c.tenant_id=NEW.tenant_id AND c.id=NEW.complaint_id;

  IF has_ncr OR severity IN('MAJOR','CRITICAL') THEN
    SELECT EXISTS(
      SELECT 1
      FROM nonconformance_reports n
      JOIN ncr_effective_states ns ON ns.tenant_id=n.tenant_id AND ns.ncr_id=n.id
      JOIN capa_cases cp ON cp.tenant_id=n.tenant_id AND cp.ncr_id=n.id
      JOIN capa_effective_states cs ON cs.tenant_id=cp.tenant_id AND cs.capa_id=cp.id
      WHERE n.tenant_id=NEW.tenant_id
        AND n.complaint_id=NEW.complaint_id
        AND ns.state='CLOSED'
        AND cs.state='CLOSED'
    ) INTO chain_closed;
    IF NOT chain_closed THEN
      RAISE EXCEPTION 'complaint closure requires closed NCR and CAPA';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER zz_customer_complaint_closure_chain_guard
BEFORE INSERT ON customer_complaint_events
FOR EACH ROW EXECUTE FUNCTION validate_complaint_closure_chain();
