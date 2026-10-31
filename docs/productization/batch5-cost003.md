# TD-COST-003 复现与设计

状态：**隔离 PG 已复现，正式算法未修改，P1 候选待业务裁定**。

`production-cost-repositories.ts` 按 BOM 行读取实际数量，但实际数量子查询只按工单和 component_item_version_id 汇总。数据库允许同一 BOM 版本使用相同 component 的多个 line_number。Batch5 临时 PG 样本创建两个相同组件行、一次 ISSUE 8；两行 material_snapshot 都得到 actual_quantity=8，实际材料被计算为两行之和。单行基线和重复行样本均完成生产、成本政策和成本 run，重复样本的计划/实际总额与独立移动台账显示出重复归集。

推荐方案二选一：新 BOM 版本发布时拒绝重复 component；或按 component 汇总实际移动，再按经过批准的可审计规则分摊到计划行。不能静默去重，因为现有计划成本是逐行语义，且生产移动没有 bom_line_id。历史 cost run 保持不可变，新算法必须有 calculation_version、独立 PG 期望表和可回滚的前向迁移方案。

本批不修改金额、舍入、成本审批或历史单据。需要负责人确认：是否禁止新 BOM 重复组件；若允许，实际移动按何种单位/损耗/替代料规则分摊。
