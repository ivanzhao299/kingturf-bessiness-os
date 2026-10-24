# 决策卡 D4：通知收件人组织有效性（SEC007）

状态：待人类决定；保持现有skip行为，不实施强形态。[PG对照](../evidence/harness-final-decision-pg-evidence-2026-10-20.md)。

现状：`notification-repositories.ts:41,101–116`仅通知创建时的收件人校验使用skip，非通知preferences/list全域。共享helper的skip省略隐式typed分支actor_org及最终actorExists的authorized_org校验；其它员工仓储默认validate。

实测：合法独立DEPT anchor/recipient、员工active，仅其TEAM组织由active改inactive时skip/validate为1/0；直接通知repo创建成功；员工inactive时两者0，恢复组织两者1。本例隔离证明最终authorized_org差异，**没有单独实验隐式TEAM分支actor_org JOIN**；这是仓储谓词层，真实认证/HTTP外层可能另挡，不称已证生产可利用。

选项：

1. 通知收件人改validate，统一有效组织前提；停组织后仍active员工的创建将从允许变拒绝，需独立行为合同/并发组织失效与实际鉴权路径核验。
2. 保留skip，将差异认定为通知业务例外，明确外层身份/组织校验依据、停止组织场景与负责边界；仅复合FK及写时grant校验不足以证明运行时组织永远有效。

建议选1，先与组织停用流程和实际鉴权上下文确认兼容，再独立实施；不因与SEC008同属scope就夹带顺修。所需授权：通知create范围、失效组织拒绝语义/错误码、冻结SQL期望适配、两个JOIN各自正负例及真实API验收。SEC007保持P2待裁。
