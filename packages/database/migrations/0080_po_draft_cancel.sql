-- TD-PROC-015（PG2，项目所有者裁定 2026-11-26）：草稿采购单可以取消。
-- 0037 的原检查 ((status='DRAFT')=(ordered_at IS NULL)) 保留原文，只追加一个允许分支：
-- 已取消且从未签发（CANCELLED / ordered_at IS NULL）。其它状态与签发时间的组合逐字不变。
-- 只替换这一条表级检查；不改守卫、枚举、列、命令或任何数据，不虚构签发时间。
ALTER TABLE purchase_orders DROP CONSTRAINT purchase_orders_check;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_check CHECK((status='DRAFT')=(ordered_at IS NULL) OR (status='CANCELLED' AND ordered_at IS NULL));
