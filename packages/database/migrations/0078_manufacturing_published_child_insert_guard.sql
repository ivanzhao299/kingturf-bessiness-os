-- MG2（TD-MFG-014，项目所有者裁定 2026-11-26）：已发布版本的子行不可变，插入也算改动。
-- 0036 用 protect_published_manufacturing_child 保护已发布版本的子行（BOM 行项、替代料、
-- 工艺路线工序），但三个冻结触发器只在 UPDATE OR DELETE 时触发：向已发布版本直接 INSERT
-- 子行不会被拦下（MFG-7 验收在隔离真库上向已发布工艺路线追加工序成功）。已发布版本的内容
-- 应当冻结，追加一行与改一行、删一行没有区别。
-- 本迁移做两件事，其余都不动：
--   1. 重定义 protect_published_manufacturing_child：以 0036 的定义为底本（0036 之后没有任何
--      迁移重定义过它），只在前面增加 INSERT 分支——父版本（替代料取其所属行项的版本）已发布
--      即拒绝；读父版本时取 FOR SHARE，持锁到事务结束，让并发发布等待插入提交，或让插入
--      等待发布提交后重新检查已发布状态。UPDATE / DELETE 分支逐字不变
--      （packages/database/test/migrations.test.ts 机械比对）。
--   2. 三个冻结触发器改为 BEFORE INSERT OR UPDATE OR DELETE。触发器只能整体重建（PostgreSQL
--      没有「改事件」的语句），名称、表、函数与行级粒度不变。
-- 不改任何存量行、表、约束、枚举或其它触发器；现有写入口只向新草稿插入子行，不受影响。
-- CREATE OR REPLACE FUNCTION 可重复执行；DROP + CREATE TRIGGER 只动触发器目录项，不改表数据，
-- 可在迁移事务内直接执行。
CREATE OR REPLACE FUNCTION protect_published_manufacturing_child() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE published boolean;
BEGIN
  IF TG_OP='INSERT' THEN
    IF TG_TABLE_NAME='manufacturing_bom_lines' THEN SELECT v.status='PUBLISHED' INTO published FROM manufacturing_bom_versions v WHERE v.id=NEW.bom_version_id AND v.tenant_id=NEW.tenant_id FOR SHARE;
    ELSIF TG_TABLE_NAME='manufacturing_bom_substitutes' THEN SELECT v.status='PUBLISHED' INTO published FROM manufacturing_bom_lines l JOIN manufacturing_bom_versions v ON v.id=l.bom_version_id AND v.tenant_id=l.tenant_id WHERE l.id=NEW.bom_line_id AND l.tenant_id=NEW.tenant_id FOR SHARE OF v;
    ELSE SELECT v.status='PUBLISHED' INTO published FROM manufacturing_routing_versions v WHERE v.id=NEW.routing_version_id AND v.tenant_id=NEW.tenant_id FOR SHARE; END IF;
    IF published THEN RAISE EXCEPTION 'published manufacturing versions are immutable, child rows cannot be added, continue with a new draft version instead'; END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME='manufacturing_bom_lines' THEN SELECT v.status='PUBLISHED' INTO published FROM manufacturing_bom_versions v WHERE v.id=OLD.bom_version_id AND v.tenant_id=OLD.tenant_id;
  ELSIF TG_TABLE_NAME='manufacturing_bom_substitutes' THEN SELECT v.status='PUBLISHED' INTO published FROM manufacturing_bom_substitutes s JOIN manufacturing_bom_lines l ON l.id=s.bom_line_id AND l.tenant_id=s.tenant_id JOIN manufacturing_bom_versions v ON v.id=l.bom_version_id AND v.tenant_id=l.tenant_id WHERE s.id=OLD.id AND s.tenant_id=OLD.tenant_id;
  ELSE SELECT v.status='PUBLISHED' INTO published FROM manufacturing_routing_versions v WHERE v.id=OLD.routing_version_id AND v.tenant_id=OLD.tenant_id; END IF;
  IF published THEN RAISE EXCEPTION 'published manufacturing child rows are immutable'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER manufacturing_bom_line_frozen ON manufacturing_bom_lines;
CREATE TRIGGER manufacturing_bom_line_frozen BEFORE INSERT OR UPDATE OR DELETE ON manufacturing_bom_lines FOR EACH ROW EXECUTE FUNCTION protect_published_manufacturing_child();
DROP TRIGGER manufacturing_bom_substitute_frozen ON manufacturing_bom_substitutes;
CREATE TRIGGER manufacturing_bom_substitute_frozen BEFORE INSERT OR UPDATE OR DELETE ON manufacturing_bom_substitutes FOR EACH ROW EXECUTE FUNCTION protect_published_manufacturing_child();
DROP TRIGGER manufacturing_routing_operation_frozen ON manufacturing_routing_operations;
CREATE TRIGGER manufacturing_routing_operation_frozen BEFORE INSERT OR UPDATE OR DELETE ON manufacturing_routing_operations FOR EACH ROW EXECUTE FUNCTION protect_published_manufacturing_child();
