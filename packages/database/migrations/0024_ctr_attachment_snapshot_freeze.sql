-- Freeze the attachment membership of a CTR snapshot at submission.
CREATE FUNCTION validate_ctr_attachment_link_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(
   SELECT 1 FROM ctr_versions v
   WHERE v.id=NEW.ctr_version_id AND v.tenant_id=NEW.tenant_id AND v.status='DRAFT'
 ) THEN RAISE EXCEPTION 'CTR attachments may only be linked to a draft version'; END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER ctr_attachment_links_insert_guard
 BEFORE INSERT ON ctr_attachment_links
 FOR EACH ROW EXECUTE FUNCTION validate_ctr_attachment_link_insert();
