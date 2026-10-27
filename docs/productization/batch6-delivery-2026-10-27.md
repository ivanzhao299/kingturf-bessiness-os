# Batch6 本地交付

基线 `5f46e70a1f5dea27b9a9ca6c6d8614fd1dd03106`，分支 `codex/kt-v1-batch6`。Batch5安全修复和回执保留。本批最终候选 SHA 以本文件所在提交为准。

## 正式修复

- **TD-COST-003**：`f4c904e`。成本查询新增 `actual_material` 按工单/组件聚合实际 ISSUE/RETURN，重复 BOM 行仍保留逐行计划数量，但实际材料只按唯一组件实际移动计价。新增重复 BOM 行、一次实际 ISSUE、成本 run 的真实 PG 场景；生产成本和基础设施回归 18/18 通过。
- **TD-CONN-001**：`d5b5e2d`。connector 配置从 `INSERT ... SELECT WHERE expectedVersion=0` 改为普通 `VALUES` 插入，保留冲突更新和 CAS version 条件。foundation 新测试验证 0→1→2、旧版本冲突、状态不变，以及同版本并发更新一胜一败、版本只前进一次（`6a55a41`）。

两项均保留历史成本、审计、CAS 失败和事务语义；未新增迁移，未改变未批准的舍入、成本审批、库存、BOM 或利润口径。

## 安全回归接线

Batch5 的 `commission-postgres.integration.test.ts`、`foundation-postgres.integration.test.ts` 和 `sec010-http-postgres.integration.test.ts` 位于 API Vitest 全量发现目录，并由 `pnpm test:coverage`/`pnpm ci:local` 自动执行。Batch6 核对了 package scripts、coverage runner 和测试目录，没有发现需额外接线的测试文件。

## 业务审批与岗位准备

[Batch6审批补充](batch6-decisions.md)只增加可签署的最小规则和待决项，仍为 DESIGN_ONLY。[岗位验收计划](batch6-pilot-acceptance-plan.md)为十类岗位指定角色、数据、上下游单据、拒绝场景、独立对账和签署字段；管理员 P1 不等于岗位 UAT。

## 最终候选验证

- 专项 PostgreSQL：foundation + production 18/18；重复 BOM 行成本对账通过；CAS 串行冲突和真实同版本并发通过。
- 完整 `pnpm ci:local`：PASS；API 17,730，Web 436，packages/config 71、database 68、domain 20、types 5；覆盖率检查报告 inventory 408、overall 38,165/49,414、domain 629/671、repository 9,942/11,566，无 deficit。
- 原 P1 浏览器：同一候选、同一配置两轮各 11/11；固定 Chromium 运行库来自既有镜像摘要，隔离 schema、API、预览和浏览器资源均已回收。安全回归文件由 API Vitest/coverage runner 自动发现并在 CI 执行。
- 独立复核：Batch5 安全修复已有独立源码复核；Batch6 成本/CAS 由主控完成差异审查，未获得新的独立代理复跑，因此不将其标为独立复跑通过。

生产、远程推送、主线合并和部署仍未授权。PILOT_READINESS=NO_GO；五项业务规则和多岗位 UAT 仍待负责人批准与真实岗位签署。
