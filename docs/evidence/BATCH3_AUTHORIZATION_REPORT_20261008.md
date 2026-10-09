# BATCH3_AUTHORIZATION_REPORT

日期：2026-10-08，Asia/Singapore。RESULT：本地权限加固与完整质量流程通过，形成可审查 checkpoint；Batch3 尚未推送/创建PR/运行Hosted CI，不能宣称生产已修复。

## GOAL / Initial State

修复 KT-006 Order360 来源范围与 KT-007 法务嵌套可见性，保持生产兼容和最小修改。仓库 `/home/jinhuit/Kingturf/kingturf-bessiness-os`，remote `git@github.com:ivanzhao299/kingturf-bessiness-os.git`。本轮起始 branch Batch2、HEAD01fe23b，工作树干净；e76cb1e/01fe23b 均存在，最新 main 经 fetch/GET 仍为9d89c7d。根、相关目录和父目录未找到AGENTS文件，沿用用户提供的子代理规则，没有重新Discovery。

Batch2 已独立创建 PR32；Batch2.5 PR33 修复两项历史测试。Batch3 分支 `codex/batch3-source-nested-authorization` 明确 BASE_COMMIT=`58fe03930e47f4f24804db88518be3dabb093d6f`，它只包含CI测试修复，不含Batch1发布或Batch2认证代码。该未合并依赖需先通过PR33正常集成main，或后续明确更新基线。权限改动相对58fe039可单独审查；未将CI修复写进权限提交。恢复已有报告仅为治理文档连续性，无跨批源码复制。

## SCOPE / FILES

- API：app.ts、aggregate-authorization.ts、order-360-repositories.ts、collection-repositories.ts；direct commercial/qtc/commission/risk repositories 各修正一处组织谓词，risk列表另修参数偏移。
- Web：bootstrap.ts 的催收读取/法务展示capability一致性。
- 测试：API路由传递来源grant断言、authorization-http-postgres.integration.test.ts、fixtures/released-order-http.ts、浏览器 source-nested-authorization.spec.ts。
- 未修改 workflow、依赖、infra、migration、生产环境或secrets；没有删除历史测试或放宽断言/数据库约束。

## ROOT_CAUSE / Evidence

Order360 入口原先仅将 sales-order:read 范围传给repository，其余对象只在返回时按capability存在/字段过滤。每个来源SQL缺独立scope；timeline同样只有订单范围，anomalies不按来源字段授权。collection列表和订单嵌套会附带独立legal-case事件、evidence、packages/manifest；父级collection事件还复制法务原因/关联ID。普通mutationDto只按读capability/字段投影，写COMPANY+读SELF也可能得到生成证据内容。

真实TEAM场景还暴露旧商业/QTC/commission/risk SQL引用不存在的 `organization_scope_relationships.tenant_id/.scope`；实际 migration0001 定义只有 ancestor_id/descendant_id/depth。按现有CRM组织谓词修正，并修复risk列表只有tenant=$1却将scope参数从$3开始的问题。实际HTTP对直接和聚合接口分别验证，不仅替换字符串。

权限风险为P1；没有从代码可疑直接宣告P0。本轮隔离双tenant合成数据跨租户返回404/空列表，未证明跨生产租户可利用漏洞。没有在生产做越权试验。

## CHANGES / Security Contract

1. 聚合入口与 sales-order 来源范围相交；入口字段策略最后再投影。具有COMPANY订单权限但入口SELF的用户不能读取其他客户所有者订单。默认COMPANY/null角色保持正常行为。
2. 每个来源分别从真实授权上下文取得capability、scopes、anchors和fields；缺grant默认deny。商业来源依据商机owner/org，QTC、commission和risk依据客户owner/org，匹配直接接口；shipment/collection/legal保持现有COMPANY/GROUP要求，不凭created_by擅自发明SELF规则。所有来源保留actor.companyId tenant约束、同tenant关联。
3. 主对象、子数组、timeline UNION分别应用来源谓词。SELF不能继承订单COMPANY。组织anchor校验实际组织tenant/type/active，TEAM depth<=1；直接读取同样采用现有CRM规则。
4. 法务嵌套必须具备独立legal-case:read COMPANY/GROUP，同时遵守父级collection及法务字段策略；无权限时移除legalHandoffs及法务复制事件/证据，不返回manifest、关联元数据或法务时间线。法务时间线还要求父级events/legalHandoffs字段，不通过独立法务权限绕过父级字段限制。
5. 有法务写权限不等于可读生成内容；三条法务mutation响应仅在legal读范围允许时返回其允许字段，否则仅id/version。没有收紧原有写操作授权。
6. 状态编码进timeline.type也受字段限制；有限字段的日期不返回（现有平面字段策略无法安全表达joined/coalesced时间）。risk标签需要severity和score都可读；unknown来源类型默认过滤。LOW_MARGIN/OPEN_AR/CREDIT_EXPIRED仅在相关来源scope/字段可见时返回，避免布尔侧漏。
7. 报价快照writer实证仅冻结quote版本/lines/approvals，是报价自身证据，保持quote授权下可读；没有因误判而要求额外技术/成本权限。其独立technical/cost/policy对象仍分别过滤。
8. UI不再以legal读代替父级collection读来请求collection列表，法务子区域仅在legal读存在时展示。字段/范围拒绝发生在服务端，UI不是安全边界。

## VERIFICATION

Node24.19.0、pnpm10.33.4、Vitest3.2.6、PostgreSQL17.7-alpine3.23、Playwright1.62.1；沿用仓库工具，无升级。

| 实际命令/范围                                               | 结果                                                                                                                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pnpm ci:local（仓库完整CI入口）                             | PASS：frozen install、format、manifest118项/19族、test DB guard、70 migrations/status、8 workspace lint/typecheck、350/350 tests、build/Web启动体积预算、生产依赖audit |
| API权限专项：vitest授权HTTP +app +collectionPG，maxWorkers1 | PASS 59/59：19真实HTTP、39路由、1既有PG法务闭环                                                                                                                        |
| Web所有测试                                                 | PASS110/110（包含Batch2.5新日期/DOM断言）                                                                                                                              |
| API所有测试                                                 | PASS158/158；原CAPA测试保留且通过                                                                                                                                      |
| shared packages                                             | PASS82/82                                                                                                                                                              |
| browser原有6文件                                            | PASS21/21，模拟API                                                                                                                                                     |
| browser新增权限2项                                          | PASS2/2；重新使用真实HTTP返回的合成响应和权限档案回放，证明UI parity，明确不是浏览器直连生产或独立认证强度证据                                                         |
| lint/typecheck最终复查 / diff与credential-pattern检查       | PASS，源码仅预期文件，无生产配置/migration/连接串/私钥                                                                                                                 |
| Batch3 Hosted CI / PR / production                          | NOT_RUN，未push/部署；不借Batch1/2/2.5的CI成功声称Batch3 Hosted PASS                                                                                                   |

19项真实HTTP通过原生server.ts、实际session guard、RBAC、repositories和完整PostgreSQL约束。合成商业链通过正式接口完成客户→商机→CTR→技术方案→成本/政策→报价审批/签发→独立信用审批→合同签署证据→订单→应收→付款核销→commission/risk→催收→独立法务受理/证据生成。签署receipt是本地合成证据，没有外部服务调用；不存在禁用trigger/constraints的seed捷径。

验证授权公司读取、不同customer/opportunity所有者的SELF组合、两种TEAM anchor的直接/聚合一致性、无source capability、独立legal scope/fields、父级字段mask、生成权限不授予read、state/score/derived侧漏、entrySELF/fields、跨tenant/group404、非法legalmutation403/404与拒绝响应无敏感字段。保存的API日志不含测试bearer/secret。

测试库是本轮新建loopback/tmpfs，库名含test并执行assertTestDatabaseTarget；先在随机schema迁移，再仅让测试server search_path访问既有public pgcrypto扩展，避免共享扩展定位造成夹具失败。没有调整生产配置。API进程先终止再删除自身schema，有界清理；最终只读确认auth/authz测试schema残留0，再清理本轮标记的临时数据库容器、私有test.env、预览进程及两处干净文档worktree（保留各分支）；真实HTTP样本只在忽略.test-results用于浏览器回放，不含认证材料。开发阶段的夹具uuid cast、扩展路径、stable key及新增lint问题均已按原标准修正，最终0 skip/0新增失败。

## Hosted Integration / Other Batches

| PR                    | 最新head                                 | Hosted run                                                                                   | quality                   | 状态          |
| --------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------- | ------------- |
| 31 Release guardrails | f7489e77cd059d37e049c70685e4025de0187cb5 | [37790721061](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/37790721061) | PASS369/369，release38/38 | OPEN/unmerged |
| 32 Auth session/audit | 8cbe6deb8efcd0d650007972c7b0516ea18cca87 | [37795523187](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/37795523187) | PASS357/357               | OPEN/unmerged |
| 33 CI gate recovery   | ab26c6ebff7a4524a205f3a1ec92959a35c97f94 | [37795089674](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/37795089674) | PASS331/331               | OPEN/unmerged |

所有head/run/check实际逐项核对，完整build/audit已执行，无跳过质量门禁。旧Batch1 run37770650651、初始Batch2 run37789585670的失败仍保留为历史证据。测试修复正常cherry-pick到各feature branch，没有force push或合并main。PR描述经REST更新，未升级因Projects classic报错的gh客户端。main仍9d89c7d，没有把feature成功宣称main当前验证成功。

## RISKS / Git Checkpoint

- Batch3代码：35efaf0646123804c0e3cd9e4ab6336782abc152、66a348ab249cbcb210d2293b656d9de06242bc69、最终 **7562baf83a0d5b65d12fdedade511607e88136db**；各commit可回滚，报告另为文档checkpoint。工作树最终核对CLEAN。
- 多轮只读独立审查已确认source谓词、参数绑定、法务父/子字段、timeline和mutation响应策略；主代理负责修改和全部执行验证。最后候选补丁及真实HTTP/fullCI均通过。
- 数据/schema/token格式、依赖、生产配置兼容；无migration。严格字段策略会减少受限用户的timeline信息，正常不限字段角色保留完整证据。风险标签/日期被限制时不会编造默认私密值。
- shipment沿用公司范围，验证SELF拒绝与静态来源门禁；本批没有新增实体库存/生产/实际发货全链夹具，不宣称发货业务验收。实际角色UAT、外部集成、backup/restore、迁移运行治理与production readiness仍未验收。
- Batch1/2代码未合并/部署，main仍保留旧发布与认证/权限缺口；B3也未推送。代码COMPLETE/本地PASS不等于已修复生产。

## Governance / NEXT

最后只读GitHub GET：main protected=false、rulesets=[]、effective rules=[]；production protection_rules=[]、deployment_branch_policy=null。未由所查询的branch/ruleset/environment保护覆盖。先前默认Actions权限GET403仍NOT_VERIFIED，本轮没有声称其已安全。仓库workflow显式contents:read、生产只手动dispatch；未执行发布。

建议管理员另行批准：main必须PR、实际quality check、至少1名独立reviewer、过期审批失效、限制bypass、禁止force push/删除；production仅允许正式main来源并独立审批，限制历史run重跑/人工SSH。不要把手动deploy job设成PR required check。未改变任何保护配置。

NEXT：审阅PR33/31/32并按授权顺序正常集成main；Batch3先处理披露的CI baseline依赖，再单独push/PR/Hosted验证。随后恢复本地API dev/start/proxy、迁移/备份恢复/附件与真实岗位业务验收，落实获批准的保护规则。当前 READY_FOR_PR=YES，READY_FOR_PRODUCTION_RELEASE=NO。机器摘要见 [BATCH3_VERIFICATION](BATCH3_VERIFICATION_20261008.json)，持续状态见 [takeover-status](../agent-memory/takeover-status.md)。
