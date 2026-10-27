# Batch7 本地准备交付

本批从 Batch6 `040a5208e9972215c2e464d2b416ab09a4f46d07` 开始，当前分支为 `codex/kt-v1-batch7`。本批没有修改业务代码、数据库迁移或生产配置，新增内容均为审批、集成、验收和运维准备材料。

## 已交付

- [业务规则最终审批表](batch7-business-approval.md)：A1 舍入、A2 成本不可变修订、A3 发运/出库、A4 BOM 冻结、A5 实际利润。全部保持 `BUSINESS_APPROVAL_REQUIRED / DESIGN_ONLY`。
- [累计集成风险矩阵](batch7-integration-risk.md)：绑定 Batch6 基线、远程 main、迁移兼容、API/DataScope、生产差异、回滚和发布停止条件。
- [多岗位与运维准入准备](batch7-uat-ops-readiness.md)：十岗位合成矩阵、拒绝/越权/撤回、独立对账、性能基线方法、备份恢复和监控准入。

## 历史与恢复核验

- Batch6 bundle SHA256 校验通过。
- 在独立临时仓库恢复 Batch6 分支后，最终 tree、文档、迁移 `0071` 和 Git notes 均核对一致。
- 远程 `main` 当前为 `b1ef7a9e7fdbfc0341f29f1cb612504ff47cd41b`；本地候选相对其领先 67 个提交、落后 0 个提交。未执行 fetch、push、PR、合并或部署。

## 远程只读核查

GitHub 当前未发现开放 PR；最近 CI 和生产发布均针对远程 main 的 `b1ef7a9e...` 成功。远程分支保护 API 返回 401，不能据此确认保护状态；需具备仓库权限后由负责人核验。远程没有 Release 记录。

## 当前准入

`BUSINESS_DECISIONS=AWAITING_APPROVAL`。十岗位真实人员签署、正式性能目标、备份恢复演练和监控责任确认尚未完成。未批准规则不得进入正式实现，`PILOT_READINESS=NO_GO`。

## 下一步

负责人逐项批准 A1—A5 后，按独立任务实施并分别完成 PostgreSQL、HTTP、岗位、回滚和历史兼容验收；随后才申请受控远程分支、PR、合并和生产发布审批。
