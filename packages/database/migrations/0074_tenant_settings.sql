-- D5（ADR-0013 / TD-ARCH-003）：租户设置中心。
-- 纯加性：稳定身份行 + 追加版本行 + 已发布禁改禁删触发器；不迁移 env/组织列存量。
-- 键目录由代码注册（白名单），未设置的键回落代码默认值——本迁移不造数据行。

INSERT INTO permissions(capability,description) VALUES
  ('tenant-setting:read','Read tenant settings catalog and published values'),
  ('tenant-setting:manage','Draft and publish tenant settings')
ON CONFLICT (capability) DO NOTHING;

-- 平台运维角色（现有实例 + 未来公司模板）获得设置管理；SYSTEM_ADMIN 为运维引导角色一并授权。
WITH grants(role_code,capability) AS (VALUES
  ('KT_PLATFORM_OPERATOR','tenant-setting:read'),
  ('KT_PLATFORM_OPERATOR','tenant-setting:manage')
)
INSERT INTO atomic_role_template_permissions(role_code,permission_id)
SELECT grants.role_code,permissions.id
FROM grants
JOIN permissions ON permissions.capability=grants.capability
ON CONFLICT(role_code,permission_id) DO NOTHING;

INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes)
SELECT roles.id,permissions.id,NULL,ARRAY['COMPANY']::data_scope[]
FROM roles
CROSS JOIN permissions
WHERE roles.code=ANY(ARRAY['SYSTEM_ADMIN','KT_PLATFORM_OPERATOR']::text[])
  AND roles.deleted_at IS NULL
  AND permissions.capability=ANY(ARRAY['tenant-setting:read','tenant-setting:manage']::text[])
ON CONFLICT(role_id,permission_id) DO NOTHING;

CREATE TABLE tenant_settings (
  tenant_id uuid NOT NULL REFERENCES organizations(id),
  key text NOT NULL,
  current_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,key)
);

CREATE TABLE tenant_setting_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id),
  key text NOT NULL,
  version integer NOT NULL CHECK(version>=1),
  value jsonb NOT NULL,
  status text NOT NULL CHECK(status IN ('DRAFT','PUBLISHED')),
  idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 128),
  publish_idempotency_key text CHECK(publish_idempotency_key IS NULL OR length(publish_idempotency_key) BETWEEN 1 AND 128),
  created_by uuid NOT NULL REFERENCES employees(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE(tenant_id,key,version),
  UNIQUE(tenant_id,key,idempotency_key)
);

ALTER TABLE tenant_settings
  ADD CONSTRAINT tenant_settings_current_fk
  FOREIGN KEY(current_version_id) REFERENCES tenant_setting_versions(id) ON DELETE RESTRICT;

CREATE INDEX tenant_setting_versions_lookup_idx ON tenant_setting_versions(tenant_id,key,version DESC);

-- 版本行追加式：唯一允许的 UPDATE 是 DRAFT→PUBLISHED 发布迁移（仅置 status/published_at/
-- publish_idempotency_key）；已发布行禁改禁删；草稿行不允许改写内容（新草稿=新版本行）。
CREATE FUNCTION tenant_setting_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='PUBLISHED' THEN
    RAISE EXCEPTION 'published tenant setting versions are immutable';
  END IF;
  IF TG_OP='UPDATE' AND NOT (
    OLD.status='DRAFT' AND NEW.status='PUBLISHED'
    AND NEW.tenant_id=OLD.tenant_id AND NEW.key=OLD.key AND NEW.version=OLD.version
    AND NEW.value=OLD.value AND NEW.idempotency_key=OLD.idempotency_key
    AND NEW.created_by=OLD.created_by AND NEW.created_at=OLD.created_at
  ) THEN
    RAISE EXCEPTION 'tenant setting versions are append-only; publish is the only transition';
  END IF;
  RETURN COALESCE(NEW,OLD);
END $$;

CREATE TRIGGER tenant_setting_versions_guard
  BEFORE UPDATE OR DELETE ON tenant_setting_versions
  FOR EACH ROW EXECUTE FUNCTION tenant_setting_version_guard();
