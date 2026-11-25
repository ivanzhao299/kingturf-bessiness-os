-- PROC-5（TD-PROC-001，主协调裁定 2026-11-25）：采购单更新守卫放宽一条。
-- 0038 规定「部分收货的采购单只能转为已收货或已取消」。但一张采购单可以分多笔收货：第一笔
-- 之后还有余量时它已是 PARTIALLY_RECEIVED，再收一笔后若仍有余量，状态应当保持不变——这条
-- 「部分收货 → 部分收货」的 UPDATE 被 0038 的守卫拒绝（partially received purchase order has
-- invalid transition）。触发器是产品规则，所以改规则本身，不在仓储里绕开它。
-- 只重定义触发器函数 guard_purchase_order_update：把 PARTIALLY_RECEIVED 那一条从「只能转
-- RECEIVED / CANCELLED」放开为「可以留在 PARTIALLY_RECEIVED，或转 RECEIVED / CANCELLED」；
-- 其余每一条规则、检查顺序与报错文字与 0038 逐字一致（packages/database/test/migrations.test.ts
-- 机械比对：0077 的函数体 = 0038 的函数体恰改这一处）。触发器 purchase_order_update_guard
-- 本身、表与枚举类型都不动，不改任何数据行。
-- CREATE OR REPLACE 可重复执行；语句只替换函数体，不改任何类型或表，可在迁移事务内直接执行。
CREATE OR REPLACE FUNCTION guard_purchase_order_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF (to_jsonb(NEW)-'status'-'ordered_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'ordered_at') THEN RAISE EXCEPTION 'purchase order content is immutable'; END IF;
  IF OLD.status='DRAFT' AND NEW.status NOT IN('ISSUED','CANCELLED') THEN RAISE EXCEPTION 'draft purchase order can only be issued or cancelled'; END IF;
  IF OLD.status='ISSUED' AND NEW.status NOT IN('PARTIALLY_RECEIVED','RECEIVED','CANCELLED') THEN RAISE EXCEPTION 'issued purchase order has invalid transition'; END IF;
  IF OLD.status='PARTIALLY_RECEIVED' AND NEW.status NOT IN('PARTIALLY_RECEIVED','RECEIVED','CANCELLED') THEN RAISE EXCEPTION 'partially received purchase order has invalid transition'; END IF;
  IF OLD.status IN('RECEIVED','CANCELLED') THEN RAISE EXCEPTION 'closed purchase order is immutable'; END IF;
  IF NEW.status='ISSUED' AND (NEW.ordered_at IS NULL OR NOT EXISTS(SELECT 1 FROM purchase_order_lines l WHERE l.purchase_order_id=NEW.id AND l.tenant_id=NEW.tenant_id)) THEN
    RAISE EXCEPTION 'purchase order issue requires timestamp and lines';
  END IF;
  RETURN NEW;
END $$;
