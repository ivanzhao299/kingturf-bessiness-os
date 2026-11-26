// PG2：采购单写路径的语句与守卫。自 procurement-repositories.ts 移出——那个文件已到结构门禁的
// 800 行上限，本批要在采购单的写路径上加东西（TD-PROC-016 签发前校验供应商状态、TD-MFG-013
// 引用计划建议），所以把采购单的写语句收到这个模块；PostgresProcurementRepository 的对应方法
// 委托到这里。语句、载荷与证据逐字不变（行为守恒）。
import { DomainError } from '@kingturf/domain';
import type { SqlClient } from '@kingturf/database';
import { writeFixedVersionOneEvidence as evidence } from './audit-outbox.ts';
import { company, json, type Context, type Db } from './procurement-read-repositories.ts';

// TD-MFG-013：沿用工单建单时写建议引用的机制；新增引用只接受本租户的采购类建议。
export async function assertPurchaseProposal(
  tx: SqlClient,
  id: string | undefined,
  context: Context,
) {
  if (id === undefined) return;
  const found = await tx.query(
    "SELECT id FROM mrp_proposals WHERE id=$1 AND tenant_id=$2 AND proposal_type='PURCHASE'",
    [id, context.actor.companyId],
  );
  if (!found.rowCount)
    throw new DomainError('conflict', '来源建议必须是本公司的采购类物料需求建议');
}

const SUPPLIER_LABELS: Readonly<Record<string, string>> = {
  ACTIVE: '已启用',
  ON_HOLD: '暂停',
  INACTIVE: '已停用',
};

// TD-PROC-016：与签发共用同一事务并锁住供应商行。setSupplierStatus 的 FOR UPDATE 与本锁互斥，
// 所以状态校验到采购单签发提交之间，供应商不能被另一笔事务暂停或停用。
// 供应商采用 NO KEY UPDATE：与 status 更新互斥，但兼容并发建单外键的 KEY SHARE，避免双建单锁升级死锁。
// 采购单自身仍用 FOR UPDATE 排他锁；不改查询/写入顺序、载荷或证据。
export async function lockActivePurchaseSupplier(tx: SqlClient, id: string, context: Context) {
  const supplier = (
    await tx.query<{ status: string }>(
      `SELECT s.status FROM suppliers s JOIN purchase_orders p ON p.supplier_id=s.id AND p.tenant_id=s.tenant_id
       WHERE p.id=$1 AND p.tenant_id=$2 AND p.status='DRAFT' FOR NO KEY UPDATE OF s FOR UPDATE OF p`,
      [id, context.actor.companyId],
    )
  ).rows[0];
  if (!supplier) throw new DomainError('not_found', 'Draft purchase-order not found');
  if (supplier.status !== 'ACTIVE')
    throw new DomainError(
      'conflict',
      `供应商当前为「${SUPPLIER_LABELS[supplier.status] ?? supplier.status}」，不能签发采购订单；请恢复为已启用后重试`,
    );
}

export function issueDraftPurchaseOrder(
  db: Db,
  id: string,
  context: Context,
  correlationId: string,
) {
  return db.transaction(async (tx) => {
    company(context);
    await lockActivePurchaseSupplier(tx, id, context);
    await tx.query(
      "UPDATE purchase_orders SET status='ISSUED',ordered_at=now() WHERE id=$1 AND tenant_id=$2 AND status='DRAFT'",
      [id, context.actor.companyId],
    );
    const result = json({ id, status: 'ISSUED' });
    await evidence(
      tx,
      'purchase-order.issued',
      'purchase-order',
      id,
      context,
      correlationId,
      result,
    );
    return result;
  });
}

// U3-PROC-3（ADR-0015）：采购单取消写路径（additive；主协调 U3-PROC-3 指令
// 「PUT 审批/发布」状态流转授权的合法迁移之一）——DRAFT/ISSUED → CANCELLED；
// PARTIALLY_RECEIVED/RECEIVED 已入收货状态机不开放取消；独立审批层缺失登记
// TD-PROC-003（schema 无 APPROVED 状态值，如需独立审批须迁移另批）。
export async function cancelOpenPurchaseOrder(
  db: Db,
  id: string,
  context: Context,
  correlationId: string,
) {
  return db.transaction(async (tx) => {
    company(context);
    const row = (
      await tx.query<{ id: string }>(
        `UPDATE purchase_orders SET status='CANCELLED' WHERE id=$1 AND tenant_id=$2 AND status IN('DRAFT','ISSUED') RETURNING id`,
        [id, context.actor.companyId],
      )
    ).rows[0];
    if (!row) throw new DomainError('not_found', 'Open purchase order not found');
    const result = json({ id, status: 'CANCELLED' });
    await evidence(
      tx,
      'purchase-order.cancelled',
      'purchase-order',
      id,
      context,
      correlationId,
      result,
    );
    return result;
  });
}
