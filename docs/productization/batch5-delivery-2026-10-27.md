# Batch5 本地交付与待验收

基线 `edc9a8d714a...`，分支 `codex/kt-v1-batch5`，Batch4恢复点保留。正式安全修复提交 `635b59e05b73594dafc102cfd890239d2ab4e719`；未推送、未合并、未部署。

TD-SEC-010 三条路径已在隔离 PG/HTTP 修复并通过仓储17/17、HTTP3/3；同用户合法重放保持，范围收窄、撤权、跨公司、错误主体和字段泄露路径拒绝，无额外业务/审计写入。安全细节见 [Batch5安全整改](batch5-security.md)。

TD-COST-003 已确认重复组件 BOM 行会重复归集同一实际移动，P1 候选仍只做验证/设计；[复现材料](batch5-cost003.md)。TD-CONN-001 已确认 connector 更新 SQL 的 CAS 控制流错误，P2 候选仍只做验证/设计；[复现材料](batch5-conn001.md)。

五类业务规则已转为 [Batch5审批契约](batch5-decisions.md)，全部 DESIGN_ONLY。岗位差距见 [试运行矩阵](batch5-pilot-gap-matrix.md)。管理员合成 P1 仍不能代替十岗位人工验收。

本批正式代码最终验证待同一 SHA 完整 CI、PG/HTTP矩阵、原P1两轮浏览器和独立复核。生产发布、远程推送、主线合并、生产数据和配置写入均未授权。
