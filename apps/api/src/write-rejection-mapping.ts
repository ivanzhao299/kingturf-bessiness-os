// WF-A（TD-WF-013）：客户创建与信用审批里「数据库拒绝」→「带说明的业务错误」的映射。
// 这是业务知识（哪个约束、哪条守卫对应哪句提示、哪个状态码），供两条 HTTP 轨共用：
//   - POST /api/v1/customers                桥轨 routes/fastify/customers.ts；
//   - POST /api/v1/credit-decisions/:id/approve  legacy 轨 routes/qtc-credit-approval.ts；
//   - PUT  /api/v1/credit-decisions/:id/state    桥轨 routes/fastify/credit-review.ts。
// 财务域（FIN）的守卫映射见文件后半（只被财务域桥轨写端点在调用点使用）。
// 只在端点调用点就地使用，不进任何全局错误处理器（主协调裁定：不做全局映射）。
// 识别规则在 pg-rejections.ts（按约束名 / 按守卫消息精确匹配，不回显数据库原始消息）。
import { DomainError } from '@kingturf/domain';
import { guardRejection, isUniqueViolation } from './pg-rejections.ts';

// 客户表（迁移 0017）上两个会让「新建客户」失败的唯一约束，按约束名分派提示。
const CUSTOMER_UNIQUE_HINTS = {
  // UNIQUE(tenant_id, customer_number)
  customers_tenant_id_customer_number_key: '客户编号已存在',
  // 部分唯一索引：tenant_id + normalized_name，WHERE deleted_at IS NULL
  customers_identity_active_unique: '客户名称已存在',
} as const;

/** 新建客户时的唯一约束冲突 → 409；其余异常原样返回。 */
export const asCustomerConflict = (error: unknown): unknown => {
  for (const [constraint, hint] of Object.entries(CUSTOMER_UNIQUE_HINTS))
    if (isUniqueViolation(error, constraint)) return new DomainError('conflict', hint);
  return error;
};

// 职责分离由触发器 enforce_credit_approval_separation（迁移 0026）强制：评估人审批自己
// 发起的信用决定时它 RAISE EXCEPTION。
const SELF_APPROVAL_MESSAGE =
  '职责分离：发起信用评估的人不能审批这条信用决定，请由另一位审批人处理';

/** 信用审批时评估人自批（触发器拒绝）→ 403；其余异常原样返回。 */
export const asSelfApproval = (error: unknown): unknown => {
  const hint = guardRejection(error, {
    'credit evaluator cannot approve own decision': SELF_APPROVAL_MESSAGE,
  });
  return hint === null ? error : new DomainError('forbidden', hint);
};

// FIN（财务域控制台）：应收过账 / 收款核销 / 催收法务的桥轨写端点（routes/fastify/
// ar-open-items.ts、bank-payments.ts、collection-cases.ts）。legacy 轨不变（双轨并行）。
// 只认守卫触发器里写死的消息，映射成中文；不回显数据库原始消息；未列入的拒绝原样抛出
//（仍是 500，照常留诊断日志）。

/** 应收过账：单据与关联销售订单不一致（触发器 ar_document_governed_graph，迁移 0027）→ 409。 */
export const asArDocumentGuard = (error: unknown): unknown => {
  const hint = guardRejection(error, {
    'AR document is inconsistent with its sales order':
      '应收单据与关联销售订单的客户或币种不一致，请核对后重试',
  });
  return hint === null ? error : new DomainError('conflict', hint);
};

/** 核销分配：只映射台账触发器拒绝（迁移 0026）。 */
export const asAllocationGuard = (error: unknown): unknown => {
  const hint = guardRejection(error, {
    'allocation currency mismatch': '分配币种与收款或应收单的币种不一致',
    'allocation exceeds remaining balance': '分配金额超过剩余余额，请刷新后重试',
  });
  return hint === null ? error : new DomainError('conflict', hint);
};
