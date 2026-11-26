-- MG2（TD-MFG-015，项目所有者裁定 2026-11-26）：BOM 发布时组件必须全部已发布。
-- 0036 的 validate_manufacturing_publish 对 BOM 组件检查的是「至少一个组件已发布」，所以同时
-- 含已发布组件和草稿组件的 BOM 也能发布（MFG-7 验收在隔离真库上发布成功）；替代料却要求
-- 全部已发布。两者口径不一致，而且 BOM 一经发布行项即冻结，其中的草稿组件却仍可被改写或续版。
-- 本迁移只重定义这个触发器函数的 BOM 分支：有任何一个组件版本未发布即拒绝；产品与替代料的
-- 检查不变。没有组件的 BOM 仍然不能发布——与 0036 一致（旧条件「至少一个已发布组件」对空
-- BOM 同样拒绝；「全部已发布」对空集恒真，所以这里显式保留，不放宽）。
-- 物料与工艺路线分支、前三条通用检查（只有草稿能发布、只能变成已发布、发布不能改内容）与
-- 0036 逐字一致（packages/database/test/migrations.test.ts 机械比对：0079 的函数体 = 0036 的
-- 函数体恰改这一处）。三个发布触发器、表与数据都不动：迁移之前已发布的混合 BOM 保持已发布、
-- 行项一字不改；存量如何处理由所有者另行裁定，本迁移只管今后的发布。
-- CREATE OR REPLACE 可重复执行；语句只替换函数体，不改任何类型、表或触发器，可在迁移事务内
-- 直接执行。
CREATE OR REPLACE FUNCTION validate_manufacturing_publish() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status<>'DRAFT' THEN RAISE EXCEPTION 'published manufacturing version is immutable'; END IF;
  IF NEW.status<>'PUBLISHED' OR NEW.published_at IS NULL THEN RAISE EXCEPTION 'manufacturing versions only allow DRAFT to PUBLISHED'; END IF;
  IF (to_jsonb(NEW)-'status'-'published_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'published_at') THEN
    RAISE EXCEPTION 'manufacturing publication cannot alter version content';
  END IF;
  IF TG_TABLE_NAME='manufacturing_bom_versions' THEN
    IF NOT EXISTS(SELECT 1 FROM manufacturing_item_versions iv WHERE iv.id=NEW.product_item_version_id AND iv.tenant_id=NEW.tenant_id AND iv.status='PUBLISHED')
       OR NOT EXISTS(SELECT 1 FROM manufacturing_bom_lines l WHERE l.bom_version_id=NEW.id AND l.tenant_id=NEW.tenant_id)
       OR EXISTS(SELECT 1 FROM manufacturing_bom_lines l JOIN manufacturing_item_versions iv ON iv.id=l.component_item_version_id AND iv.tenant_id=l.tenant_id WHERE l.bom_version_id=NEW.id AND l.tenant_id=NEW.tenant_id AND iv.status<>'PUBLISHED')
       OR EXISTS(SELECT 1 FROM manufacturing_bom_lines l JOIN manufacturing_bom_substitutes s ON s.bom_line_id=l.id AND s.tenant_id=l.tenant_id JOIN manufacturing_item_versions iv ON iv.id=s.substitute_item_version_id AND iv.tenant_id=s.tenant_id WHERE l.bom_version_id=NEW.id AND l.tenant_id=NEW.tenant_id AND iv.status<>'PUBLISHED')
    THEN RAISE EXCEPTION 'BOM publication requires published product, component, and substitute versions'; END IF;
  ELSIF TG_TABLE_NAME='manufacturing_routing_versions' THEN
    IF NOT EXISTS(SELECT 1 FROM manufacturing_item_versions iv WHERE iv.id=NEW.product_item_version_id AND iv.tenant_id=NEW.tenant_id AND iv.status='PUBLISHED')
       OR NOT EXISTS(SELECT 1 FROM manufacturing_routing_operations op WHERE op.routing_version_id=NEW.id AND op.tenant_id=NEW.tenant_id)
    THEN RAISE EXCEPTION 'routing publication requires a published product version and operations'; END IF;
  END IF;
  RETURN NEW;
END $$;
