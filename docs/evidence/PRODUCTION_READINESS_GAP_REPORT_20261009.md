# PRODUCTION_READINESS_GAP_REPORT

2026-10-09 Asia/Singapore。GOAL：只读核对发布门禁，提供可验收的保护/恢复/UAT准备清单；RESULT：**READY_FOR_PRODUCTION_RELEASE=NO**。只进行了GitHub GET和公开health/ready/version GET，无生产SSH/SQL、迁移、容器重建、发布或保护规则修改。

## Current facts vs missing evidence

| 门禁                               | 当前实际结果                                                                   | 缺口 / 验收证据                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| main/应用版本                      | main9d89c7d；production /version SHA9d89c7d、builtAt33996421402                | 31/32/33/34均未合并；不能声称生产已有新安全控制                                                                |
| 公开health/ready/version           | 200，ok/ready/精确SHA；本轮重新GET                                             | ready只证明DB SELECT1可用，不能证明migrations、backup或完整业务                                                |
| main保护 / required reviews/checks | protected=false、rulesets=[]、effective rules=[]；未由已查询规则覆盖           | 管理员另行批准配置；默认Actions权限GET403 NOT_VERIFIED，不当作缺失/已安全                                      |
| production审批/来源限制            | protection_rules=[]、deployment_branch_policy=null                             | 管理员独立审批/main-only workflow/bypass治理；feature历史run和手工写路径仍需控制                               |
| 正式发布来源                       | 代码正式策略main历史完整SHA，不是tag/ref入口；PR31校验/锁/backup顺序尚未进main | 落实main/环境保护才可信；回滚合法历史SHA保留，需schema兼容审查                                                 |
| 单PR / 组合质量                    | 31/32/33最新Hosted绿；34run37855253180绿350；最终本地整合a83c933完整414        | actual main每次合并后完整CI未执行（未授权合并），不能用预览替代                                                |
| 生产备份状态                       | NOT_VERIFIED：没有当前文件/metadata/checksum/off-host清单读取权限或材料        | 代码会备份不等于当前备份存在/可恢复；单dump不构成灾备                                                          |
| 生产migration状态                  | NOT_VERIFIED：未连接生产DB；代码70项本地通过                                   | 管理员需提供只读schema_migrations/checksum比对、历史约束验证；db:status当前会DDL，不能称纯只读并直接在prod执行 |
| 文件持久化                         | 配置要求专属data/attachments挂载；实际挂载/文件hash NOT_VERIFIED               | runbook及compose配置只证明意图；需mount路径/磁盘/backup覆盖和隔离恢复证据                                      |
| 备份恢复/灾备                      | NOT_VERIFIED                                                                   | 数据库+附件一致恢复、RPO/RTO及异地保留没有实测                                                                 |
| rollback                           | PLAN_ONLY_NOT_VERIFIED                                                         | 合法main历史SHA经同workflow回滚；DB通常前向修复、附件保留；应用/schema/配置兼容及恢复时长未实测                |
| 生产会话撤销兼容                   | NOT_VERIFIED_DEPLOYMENT；运行旧SHA，Batch2未生效                               | 所有API实例需同版本锁协议；旧token仅目标改密撤销，第三方集成重登录；不在生产做改密试验                         |
| 真业务/第三方UAT                   | NOT_VERIFIED                                                                   | 合成HTTP与浏览器不是业务岗位验收；签署、银行凭据、附件/provider消费/receipt待业务证据                          |

## Administrator configuration checklist (not executed)

1. main要求PR；实际GitHub Actions `quality`为required check，需最新main基线验证；至少1名独立人工reviewer、过期审批失效、最后推送独立审批，禁force push/delete，限制bypass并记录应急路径。不要把只manual dispatch的deploy设为required PR check。
2. production设置独立发布审批、阻止发起人自审、仅正式main分支workflow；保留main历史应用SHA回滚策略，不顺带扩大tag/feature来源。审核每次workflow control SHA和candidate SHA；限制旧workflow重跑/人工SSH写路径。
3. 授权管理员读取默认Actions权限/allowlist再定只读默认与最小显式权限。本轮403仅记录，不盲改配置。当前仓库workflow显式contents:read，push/PR没有自动production副作用。
4. 先保护和人工审查，再逐PR获得合并授权33→31→32→34，每次记录实际main SHA、完整CI、重新对齐剩余PR。PR34当前base是33 feature，不能先merge到该feature；基础正常集成后明确retargetmain并重新Hosted。

潜在影响：阻止直接main写入/无审查更改、生产dispatch须独立审批，回滚也走同一审批与兼容检查；reviewer/bypass/environment审批人需由仓库管理员选择。本轮未申请替管理员修改设置。

## Isolated restore drill plan / acceptance gates

- ACTION（未来另行批准）：管理员取得一致的PostgreSQL custom-format dump+对应metadata、附件快照/清单/hash、应用SHA、迁移checksum；通过获批渠道提供脱敏或受控备份副本。不得回显secret/完整连接串或复制原始PII到报告。
- IMPACT：只向新建独立restore数据库/文件目录写入，不挂生产目录、不开外部消息/签署/发信网络；端口loopback，名称有restore_test标记，验证前确认资源身份。生产只读备份采集也应评估一致性/负载与既有审批。
- ROLLBACK：演练失败停止该隔离实例并保留脱敏失败证据；经确认后清理仅演练资源，源备份与生产不变。禁止用旧dump覆盖生产；生产灾难恢复是另一明确授权操作。
- VERIFICATION：校验checksum及备份时间/一致性，pg_restore到隔离target；通过真正只读schema/迁移checksum/关键业务计数/外键与余额核对，不先用startup自动migrate“修好”证据。匹配文件数量/大小/hash抽检，应用部署到同一SHA隔离环境后只读客户/订单/回款/法务与权限验收；记录失败恢复、RPO/RTO实际值、附件覆盖和异地保留。无真实凭据/副本时NOT_VERIFIED。
- 应用回滚演练：冻结候选/旧main SHA，先验证schema兼容与独立备份，然后在非生产相同拓扑模拟失败→旧版本恢复→health/ready/version/核心只读链，核对release marker反映实际版本；记录配置恢复、文件保留与所有实例会话锁协议。通过后再提交生产发布审批，不能用本批shell模拟替代。

生产操作前必须单独确认ACTION/IMPACT/ROLLBACK/VERIFICATION、当前commit、备份、migration、健康及业务验收。NEXT：现有PR人工review/保护配置审批/逐PR整合、独立Batch4 PR/Hosted，再执行明确批准的隔离restore和[业务UAT矩阵](CORE_BUSINESS_UAT_MATRIX_20261009.md)。
