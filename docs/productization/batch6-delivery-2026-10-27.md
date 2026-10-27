# Batch6 本地交付

基线 `5f46e70a1f5dea27b9a9ca6c6d8614fd1dd03106`，分支 `codex/kt-v1-batch6`。Batch5安全修复和回执保留。

## 正式修复

- **TD-COST-003**：`f4c904e`。成本查询新增 `actual_material` 按工单/组件聚合实际 ISSUE/RETURN，重复 BOM 行仍保留逐行计划数量，但实际材料只按唯一组件实际移动计价。新增重复 BOM 行、一次实际 ISSUE、成本 run 的真实 PG 场景；生产成本和基础设施回归 18/18 通过。
- **TD-CONN-001**：`d5b5e2d`。connector 配置从 `INSERT ... SELECT WHERE expectedVersion=0` 改为普通 `VALUES` 插入，保留冲突更新和 CAS version 条件。foundation 新测试验证 0→1→2、旧版本冲突和状态不变。

两项均保留历史成本、审计、CAS 失败和事务语义；未新增迁移，未改变未批准的舍入、成本审批、库存、BOM 或利润口径。

## 安全回归接线

Batch5 的 `commission-postgres.integration.test.ts`、`foundation-postgres.integration.test.ts` 和 `sec010-http-postgres.integration.test.ts` 位于 API Vitest 全量发现目录，并由 `pnpm test:coverage`/`pnpm ci:local` 自动执行。Batch6 核对了 package scripts、coverage runner 和测试目录，没有发现需额外接线的测试文件。

## 业务审批与岗位准备

[Batch6审批补充](batch6-decisions.md)只增加可签署的最小规则和待决项，仍为 DESIGN_ONLY。[岗位验收计划](batch6-pilot-acceptance-plan.md)为十类岗位指定角色、数据、上下游单据、拒绝场景、独立对账和签署字段；管理员 P1 不等于岗位 UAT。

## 当前验证边界

Batch6 目标修复已完成专项 PG 验证；最终完整 CI、原 P1 浏览器双轮、独立 Batch6 源码复核和本地 Git bundle 校验需在最终 SHA 上完成。生产、远程推送、主线合并和部署仍未授权。PILOT_READINESS=NO_GO。
