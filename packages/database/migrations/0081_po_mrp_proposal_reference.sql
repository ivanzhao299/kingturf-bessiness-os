-- TD-MFG-013（PG2，项目所有者裁定 2026-11-26）：采购单沿用生产工单的可空建议引用。
-- 不回填存量。复合外键固定租户；采购类校验在建单事务内执行。
-- 主协调追加裁定：工单侧没有该索引；采购单侧为按建议聚合新增非唯一索引，工单侧不动。
ALTER TABLE purchase_orders ADD COLUMN mrp_proposal_id uuid;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_mrp_proposal_fk FOREIGN KEY(mrp_proposal_id,tenant_id) REFERENCES mrp_proposals(id,tenant_id);
CREATE INDEX purchase_orders_mrp_proposal_idx ON purchase_orders(tenant_id,mrp_proposal_id);
