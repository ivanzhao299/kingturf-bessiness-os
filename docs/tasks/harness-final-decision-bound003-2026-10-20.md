# 决策卡 D1：真实日历日期（BOUND003）

状态：待人类决定；本卡不是实施批准。[总R7](harness-final-acceptance-authorization-2026-10-20.md)仅允许影响核验与制卡。

现状：[隔离PG实测](../evidence/harness-final-decision-pg-evidence-2026-10-20.md)中，合法日期POST201；2026-02-30经生产buildApp.dispatch（注入合成授权，非真实HTTP认证）到真实仓储后POST/PATCH500，直接repo22008；factor表仅留合法日期、相关添加审计1。不是PG成功存入非法日期。`app.ts:363` helper只检查形状/Date.parse，后者会归一化溢出日期；路由`cost-matrix-factors.ts:76`仍传原文。

影响：共享calendarDate直接用于MRP需求/周期、RFQ/PO需求、供应商资质与报价、生产计划/产出、成本政策日期；optionalCalendarDate还用于收货制造/到期日。静态搜索范围为apps/api/src/app.ts与routes全部calendarDate/optionalCalendarDate调用；只有因子路径本轮真实PG核验，其余不能据此声称已存坏数据或必然同一响应。

选项：

1. 收紧共享helper为真实公历校验，非法输入提前400；需逐调用点回归/闰年边界/原有效格式与时区保持。改变原接受域，必须独立行为提交。
2. 维持原helper与PG最终拒绝，保留500和开放债务；不把当前数据库防线等同友好/一致API合同，也不宣称已修。

建议选1，先确认共享调用点一次性收紧还是分域迁移，明确旧错误码/客户端重试兼容；不引入新依赖。所需授权：具体helper/调用点、无效日期400合同、对应冻结期望的独立适配及真实PG验收。未批准前不改产品或期待，BOUND003保持开放。
