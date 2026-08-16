CREATE TYPE manufacturing_item_type AS ENUM('RAW_MATERIAL','SEMI_FINISHED','FINISHED_GOOD','PACKAGING');
CREATE TYPE manufacturing_version_status AS ENUM('DRAFT','PUBLISHED','RETIRED');

CREATE TABLE manufacturing_items(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES organizations(id),
  sku text NOT NULL,name text NOT NULL,item_type manufacturing_item_type NOT NULL,base_unit_code text NOT NULL REFERENCES commercial_units(code),
  created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,sku),FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE manufacturing_item_versions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,item_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
  status manufacturing_version_status NOT NULL DEFAULT 'DRAFT',specification jsonb NOT NULL CHECK(jsonb_typeof(specification)='object'),
  effective_at timestamptz NOT NULL,canonical_hash char(64) NOT NULL,published_at timestamptz,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,item_id,version),FOREIGN KEY(item_id,tenant_id) REFERENCES manufacturing_items(id,tenant_id),
  FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id),CHECK((status='PUBLISHED')=(published_at IS NOT NULL))
);
CREATE TABLE manufacturing_boms(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,code text NOT NULL,name text NOT NULL,product_item_id uuid NOT NULL,
  created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,tenant_id),UNIQUE(tenant_id,code),
  FOREIGN KEY(product_item_id,tenant_id) REFERENCES manufacturing_items(id,tenant_id),FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE manufacturing_bom_versions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,bom_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
  product_item_version_id uuid NOT NULL,status manufacturing_version_status NOT NULL DEFAULT 'DRAFT',output_quantity numeric(24,6) NOT NULL CHECK(output_quantity>0),
  effective_at timestamptz NOT NULL,canonical_hash char(64) NOT NULL,published_at timestamptz,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,bom_id,version),FOREIGN KEY(bom_id,tenant_id) REFERENCES manufacturing_boms(id,tenant_id),
  FOREIGN KEY(product_item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id),FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id),
  CHECK((status='PUBLISHED')=(published_at IS NOT NULL))
);
CREATE TABLE manufacturing_bom_lines(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,bom_version_id uuid NOT NULL,line_number integer NOT NULL CHECK(line_number>0),
  component_item_version_id uuid NOT NULL,quantity numeric(24,6) NOT NULL CHECK(quantity>0),scrap_basis_points integer NOT NULL DEFAULT 0 CHECK(scrap_basis_points BETWEEN 0 AND 10000),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,bom_version_id,line_number),FOREIGN KEY(bom_version_id,tenant_id) REFERENCES manufacturing_bom_versions(id,tenant_id),
  FOREIGN KEY(component_item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id)
);
CREATE TABLE manufacturing_bom_substitutes(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,bom_line_id uuid NOT NULL,substitute_item_version_id uuid NOT NULL,
  priority integer NOT NULL CHECK(priority>0),conversion_factor numeric(24,6) NOT NULL DEFAULT 1 CHECK(conversion_factor>0),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,bom_line_id,priority),UNIQUE(tenant_id,bom_line_id,substitute_item_version_id),
  FOREIGN KEY(bom_line_id,tenant_id) REFERENCES manufacturing_bom_lines(id,tenant_id),
  FOREIGN KEY(substitute_item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id)
);
CREATE TABLE manufacturing_routings(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,code text NOT NULL,name text NOT NULL,product_item_id uuid NOT NULL,
  created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,tenant_id),UNIQUE(tenant_id,code),
  FOREIGN KEY(product_item_id,tenant_id) REFERENCES manufacturing_items(id,tenant_id),FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id)
);
CREATE TABLE manufacturing_routing_versions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,routing_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
  product_item_version_id uuid NOT NULL,status manufacturing_version_status NOT NULL DEFAULT 'DRAFT',effective_at timestamptz NOT NULL,
  canonical_hash char(64) NOT NULL,published_at timestamptz,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,routing_id,version),FOREIGN KEY(routing_id,tenant_id) REFERENCES manufacturing_routings(id,tenant_id),
  FOREIGN KEY(product_item_version_id,tenant_id) REFERENCES manufacturing_item_versions(id,tenant_id),FOREIGN KEY(created_by,tenant_id) REFERENCES employees(id,company_id),
  CHECK((status='PUBLISHED')=(published_at IS NOT NULL))
);
CREATE TABLE manufacturing_routing_operations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,routing_version_id uuid NOT NULL,sequence integer NOT NULL CHECK(sequence>0),
  operation_code text NOT NULL,name text NOT NULL,work_center_code text NOT NULL,setup_minutes numeric(18,6) NOT NULL CHECK(setup_minutes>=0),
  run_minutes_per_unit numeric(18,6) NOT NULL CHECK(run_minutes_per_unit>=0),instructions jsonb NOT NULL CHECK(jsonb_typeof(instructions)='object'),
  UNIQUE(id,tenant_id),UNIQUE(tenant_id,routing_version_id,sequence),UNIQUE(tenant_id,routing_version_id,operation_code),
  FOREIGN KEY(routing_version_id,tenant_id) REFERENCES manufacturing_routing_versions(id,tenant_id)
);

CREATE FUNCTION validate_manufacturing_publish() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status<>'DRAFT' THEN RAISE EXCEPTION 'published manufacturing version is immutable'; END IF;
  IF NEW.status<>'PUBLISHED' OR NEW.published_at IS NULL THEN RAISE EXCEPTION 'manufacturing versions only allow DRAFT to PUBLISHED'; END IF;
  IF (to_jsonb(NEW)-'status'-'published_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'published_at') THEN
    RAISE EXCEPTION 'manufacturing publication cannot alter version content';
  END IF;
  IF TG_TABLE_NAME='manufacturing_bom_versions' THEN
    IF NOT EXISTS(SELECT 1 FROM manufacturing_item_versions iv WHERE iv.id=NEW.product_item_version_id AND iv.tenant_id=NEW.tenant_id AND iv.status='PUBLISHED')
       OR NOT EXISTS(SELECT 1 FROM manufacturing_bom_lines l JOIN manufacturing_item_versions iv ON iv.id=l.component_item_version_id AND iv.tenant_id=l.tenant_id WHERE l.bom_version_id=NEW.id AND l.tenant_id=NEW.tenant_id AND iv.status='PUBLISHED')
       OR EXISTS(SELECT 1 FROM manufacturing_bom_lines l JOIN manufacturing_bom_substitutes s ON s.bom_line_id=l.id AND s.tenant_id=l.tenant_id JOIN manufacturing_item_versions iv ON iv.id=s.substitute_item_version_id AND iv.tenant_id=s.tenant_id WHERE l.bom_version_id=NEW.id AND l.tenant_id=NEW.tenant_id AND iv.status<>'PUBLISHED')
    THEN RAISE EXCEPTION 'BOM publication requires published product, component, and substitute versions'; END IF;
  ELSIF TG_TABLE_NAME='manufacturing_routing_versions' THEN
    IF NOT EXISTS(SELECT 1 FROM manufacturing_item_versions iv WHERE iv.id=NEW.product_item_version_id AND iv.tenant_id=NEW.tenant_id AND iv.status='PUBLISHED')
       OR NOT EXISTS(SELECT 1 FROM manufacturing_routing_operations op WHERE op.routing_version_id=NEW.id AND op.tenant_id=NEW.tenant_id)
    THEN RAISE EXCEPTION 'routing publication requires a published product version and operations'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER manufacturing_item_publish_guard BEFORE UPDATE ON manufacturing_item_versions FOR EACH ROW EXECUTE FUNCTION validate_manufacturing_publish();
CREATE TRIGGER manufacturing_bom_publish_guard BEFORE UPDATE ON manufacturing_bom_versions FOR EACH ROW EXECUTE FUNCTION validate_manufacturing_publish();
CREATE TRIGGER manufacturing_routing_publish_guard BEFORE UPDATE ON manufacturing_routing_versions FOR EACH ROW EXECUTE FUNCTION validate_manufacturing_publish();
CREATE FUNCTION protect_published_manufacturing_child() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE published boolean;
BEGIN
  IF TG_TABLE_NAME='manufacturing_bom_lines' THEN SELECT v.status='PUBLISHED' INTO published FROM manufacturing_bom_versions v WHERE v.id=OLD.bom_version_id AND v.tenant_id=OLD.tenant_id;
  ELSIF TG_TABLE_NAME='manufacturing_bom_substitutes' THEN SELECT v.status='PUBLISHED' INTO published FROM manufacturing_bom_substitutes s JOIN manufacturing_bom_lines l ON l.id=s.bom_line_id AND l.tenant_id=s.tenant_id JOIN manufacturing_bom_versions v ON v.id=l.bom_version_id AND v.tenant_id=l.tenant_id WHERE s.id=OLD.id AND s.tenant_id=OLD.tenant_id;
  ELSE SELECT v.status='PUBLISHED' INTO published FROM manufacturing_routing_versions v WHERE v.id=OLD.routing_version_id AND v.tenant_id=OLD.tenant_id; END IF;
  IF published THEN RAISE EXCEPTION 'published manufacturing child rows are immutable'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER manufacturing_bom_line_frozen BEFORE UPDATE OR DELETE ON manufacturing_bom_lines FOR EACH ROW EXECUTE FUNCTION protect_published_manufacturing_child();
CREATE TRIGGER manufacturing_bom_substitute_frozen BEFORE UPDATE OR DELETE ON manufacturing_bom_substitutes FOR EACH ROW EXECUTE FUNCTION protect_published_manufacturing_child();
CREATE TRIGGER manufacturing_routing_operation_frozen BEFORE UPDATE OR DELETE ON manufacturing_routing_operations FOR EACH ROW EXECUTE FUNCTION protect_published_manufacturing_child();

INSERT INTO permissions(capability,description) VALUES
 ('manufacturing-item:read','Read versioned manufacturing items'),('manufacturing-item:manage','Create and publish manufacturing item versions'),
 ('bom:read','Read versioned bills of material'),('bom:manage','Create and publish BOM versions and substitutes'),
 ('routing:read','Read versioned manufacturing routings'),('routing:manage','Create and publish routing versions')
ON CONFLICT(capability) DO NOTHING;
INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT r.id,p.id,NULL,ARRAY['COMPANY']::data_scope[] FROM roles r CROSS JOIN permissions p
WHERE r.code='SUPER_ADMIN' AND p.capability=ANY(ARRAY['manufacturing-item:read','manufacturing-item:manage','bom:read','bom:manage','routing:read','routing:manage']::text[])
ON CONFLICT(role_id,permission_id) DO NOTHING;
