-- WF-A（TD-WF-003，主协调裁定 2026-11-24）：询价单更新守卫放宽。
-- 0038 规定「非草稿询价一律不可更新」，「关闭询价」对已签发询价单的 UPDATE 必然被拒。
-- 本迁移改为：已签发（ISSUED）的询价单允许「仅状态」迁移到 CANCELLED（关闭询价即终止
-- 这张询价，不再收报价；系统已有「已取消」终态），内容仍不可变；草稿的迁移规则不变
--（只能签发或取消）；已取消的询价单不可变。
-- 只重定义触发器函数 guard_rfq_update：触发器 procurement_rfq_update_guard 本身、询价
-- 行项的冻结规则（protect_issued_rfq_line）、表与枚举类型都不动，不改任何数据行。
-- CREATE OR REPLACE 可重复执行；语句只替换函数体，不改任何类型或表，可在迁移事务内直接执行。

-- 草稿分支的三项检查、顺序与消息与 0038 逐条一致（行为守恒；签发时 status 与
-- issued_at 之外不得变化）。已签发分支为新增：除 status 外任何列（含 issued_at）变化
-- 即拒绝，目标状态只能是 CANCELLED。
CREATE OR REPLACE FUNCTION guard_rfq_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF OLD.status='DRAFT' THEN
    IF NEW.status NOT IN('ISSUED','CANCELLED') THEN RAISE EXCEPTION 'draft RFQ can only be issued or cancelled'; END IF;
    IF (to_jsonb(NEW)-'status'-'issued_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'issued_at') THEN RAISE EXCEPTION 'RFQ issue cannot alter content'; END IF;
    IF NEW.status='ISSUED' AND (NEW.issued_at IS NULL OR NOT EXISTS(SELECT 1 FROM procurement_rfq_lines l WHERE l.rfq_id=NEW.id AND l.tenant_id=NEW.tenant_id)) THEN
      RAISE EXCEPTION 'RFQ issue requires timestamp and lines';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status='ISSUED' THEN
    IF (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN RAISE EXCEPTION 'issued RFQ content is immutable'; END IF;
    IF NEW.status<>'CANCELLED' THEN RAISE EXCEPTION 'issued RFQ can only be cancelled'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.status='CANCELLED' THEN RAISE EXCEPTION 'cancelled RFQ is immutable'; END IF;
  RAISE EXCEPTION 'RFQ is immutable outside draft and issued statuses';
END $$;
