-- JTF-P1-E01..E04 reviewer closure: bind command replays and forbid hard deletion.
ALTER TABLE crm_command_results
  ADD COLUMN request_fingerprint text NOT NULL DEFAULT 'legacy-unreplayable'
  CHECK(length(request_fingerprint) BETWEEN 1 AND 512);

CREATE TRIGGER customers_no_hard_delete
  BEFORE DELETE ON customers FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();
CREATE TRIGGER leads_no_hard_delete
  BEFORE DELETE ON leads FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();
