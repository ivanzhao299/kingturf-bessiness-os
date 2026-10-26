# Batch4证据索引（2026-10-26）

基线f3f0c42aa8493f594076c03d3270f0c21de7ba78；正式代码候选0503d9ed69878bd40bcfa5b4efaac93ea521fde2，后续文档提交不得当作已测最终SHA。最终验收回执规则如下，不借用Batch3结果。

## 已保存材料

- `commits.txt`：从f3起逐组本地提交，至正式代码候选；后续文档提交由Git历史补全，不为更新本文件再造自引用SHA。
- `development-runs.json`：62个已保存命名开发检查的退出码/耗时/当时结束SHA，21个非0，现存日志全部保留。多数在工作树开发状态运行，部分命令末尾才提交，**不是62次固定SHA验收**。每个log字段指本目录同名脱敏原始日志。
- `structure.json`：30个本批涉及源文件，最大618行、最长完整函数200；buildApp160、主dispatch149；G5精确项0。G1/G2其他存量不是本批全部消除。
- `g5-composition-r3.txt`：最终业务区间/根生命周期逆展开、310轨迹、QTC335及认证/时序等相关回归。
- `projected-boundary-gate-r2.txt`：63个CLI自测全部通过及实际service门禁通过。原49自测保留，新增14。首轮伪builder测试期待不符合其未执行callback的实际语义，原失败保留；修正为同一实际pending路径跨仓储的反例，严格S3保持。
- `sec010-pg-r2.txt`、`sec010-http-r2.txt`、`sec010-combined.txt`：3个PG现状样本、3个真实HTTP及48项组合回归；见安全评估。均是未修缺陷刻画，不是安全验收绿。
- `browser-orchestrator.txt`：最终两轮运行器的确切文本；私有目录用于运行，不是云端交接依赖。沿用原P1/spec/seed及配置，随机schema、本地API/preview，只覆盖可拥有资源。
- independent-review.json及independent-nonpg三份日志：固定0503d9e独立源码复核与6文件351项非PG复跑/63项门禁/结构通过，前后工作树干净。未独立复跑PG/完整CI/浏览器。

## 失败与修正

开发失败包括：旧源装载node: URL、时钟与场景总数初猜、ApiDependencies移动触发锚点门禁（已保留原锚点）、TS/lint类型收窄与脚本host接口、AST排版比较及同步终止分支、共享CRM返回后的类型窄化、真实HTTP初次/重放字段名差异、已有connector更新拒绝、依赖门禁尚未识别新路由单元。源码与正确业务断言不为测试变绿而放宽；门禁适配增加S5及委托反例，原S3阈值与来源识别不变。

现存捕获日志全部保留；最早少量交互式工具输出没有独立完整文件，另有g5-crm首轮同名日志被后继覆盖，只能由下述回执摘录、上述归因摘要和会话工具记录复核，不伪造其完整原始日志。g5-crm首轮在4b309f2工作树，exit1/0.26秒，提取器以“range has a non-continuation return”停止，尚未写源文件；同名后继12.11秒版本因缺失同步终止分支的类型窄化失败，现存g5-crm.txt对应后者。后续r3/r4均独立命名，r4通过。当前fixture目录/脚本不读取生产配置或云端资料。

## 最终固定提交回执

最后文档提交完成后，必须在干净HEAD运行完整`pnpm ci:local`，随后同一SHA/同一配置P1两轮。结果写到本地忽略目录 `.test-results/batch4-productization/`，并附加到本地Git notes `refs/notes/kingturf-local-validation`的该提交对象；notes不改变源码HEAD，也不代表远程推送或生产发布。

读取：`git notes --ref=kingturf-local-validation show HEAD` 与 `.test-results/batch4-productization/final-status.json`；核对两者source_sha与当前HEAD一致。最终完整CI、覆盖率、PG、浏览器、独立复跑和资源回收都必须来自实际回执。没有回执或SHA不符时状态保持未验证。该目录中的开发日志不能替代最终证据。

禁止提交临时账号、token、连接串、数据库/附件备份或原始浏览器认证材料；只保存脱敏日志、数值摘要与合成样本。REMOTE_PUSH/MAIN_MERGE/PRODUCTION_DEPLOY=NOT_AUTHORIZED，PILOT_READINESS=NO_GO。

补充正确文件名的库存/迁移/采购/生产/授权专项：inventory-auth-regression.txt，5文件57项通过；真实并发与回滚/0071兼容及19项HTTP授权均包括。与安全组合48项分开记录，最终完整CI另验。
