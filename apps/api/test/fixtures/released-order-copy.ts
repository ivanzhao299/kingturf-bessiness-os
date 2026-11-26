import { randomUUID } from 'node:crypto';
import type { Database } from '@kingturf/database';

/**
 * 复制一张已释放订单（沿用同一商业图的全部钉定与行项），得到同客户的另一张未开票订单。
 * 写法同 mrp-source-postgres.integration.test.ts 的直接 SQL 复制：数据库触发器
 * （validate_qtc_pins / enforce_order_credit_capacity / 合计约束）照常把关。
 */
export async function copyReleasedOrder(
  db: Database,
  source: Readonly<{ orderId: string; companyId: string }>,
  orderNumber: string,
  status: 'RELEASED' | 'CANCELLED' = 'RELEASED',
): Promise<string> {
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.query(
      'INSERT INTO sales_orders(id,tenant_id,customer_id,opportunity_id,order_number,quote_revision_id,quote_snapshot_id,credit_decision_id,contract_revision_id,signature_evidence_id,status,currency,total,canonical_input,canonical_hash,actor_id,correlation_id,idempotency_key) SELECT $1,tenant_id,customer_id,opportunity_id,$2,quote_revision_id,quote_snapshot_id,credit_decision_id,contract_revision_id,signature_evidence_id,$3::sales_order_status,currency,total,canonical_input,canonical_hash,actor_id,$4,$5 FROM sales_orders WHERE id=$6 AND tenant_id=$7',
      [id, orderNumber, status, randomUUID(), randomUUID(), source.orderId, source.companyId],
    );
    await tx.query(
      'INSERT INTO sales_order_lines(tenant_id,sales_order_id,line_number,description,quantity,unit_price,total) SELECT tenant_id,$1,line_number,description,quantity,unit_price,total FROM sales_order_lines WHERE sales_order_id=$2 AND tenant_id=$3',
      [id, source.orderId, source.companyId],
    );
  });
  return id;
}
