# KingTurf V1.0 接管验证证据 2026年10月26日

**2026-10-26 Batch3最新进度**：[验证/交付](batch3-verification-2026-10-26.md)记录INV001、RISK003、SEC009本地修复与独立源码复核；[业务增量设计](batch3-business-design.md)保留未决口径，隔离原型不并入正式候选。G5-Q/F已消除，B/D仍限期开放。最终精确提交完整CI及浏览器两轮只认本地机器回执，不复用Batch2。远程/主线/生产未授权，PILOT_READINESS=NO_GO。以下旧状态保留原时点。

代码基线 `b1ef7a9e7fdbfc0341f29f1cb612504ff47cd41b`。所有运行验证在本地专属 PostgreSQL17.7 测试容器、随机回环端口、临时内存数据目录进行；没有读取本机既有数据库连接配置，没有复用生产/其他项目数据库。容器名 `kt-v1-audit-pg-20261026`，数据库名含独立 `test` 段，NODE_ENV=test，迁移前经过项目既有guard。临时凭据不入仓库、不输出。

## 检查结果

| 检查                   | 结果                                                            | 证据                                                                                                              |
| ---------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 开始Git基线            | main、工作树干净、HEAD/origin-main与GitHub一致                  | takeover-audit和github-state.json                                                                                 |
| 原干净HEAD完整ci:local | exit0，399.93秒；Node24.19.0/pnpm10.33.4/PG17.7                 | [完整脱敏日志](evidence/ci.txt)，未修改代码/测试/配置开始运行                                                     |
| API                    | 135文件、17,297测试通过                                         | ci.txt，含真实PG集成及现状缺陷测试                                                                                |
| Web                    | 27文件、436测试通过                                             | ci.txt；这不是浏览器E2E或人工UAT                                                                                  |
| 其他四包               | config71、database68、domain20、types5通过                      | ci.txt；根工具自测与Python运维护栏另列日志，不混入API数                                                           |
| 覆盖率                 | 整体37,543/48,601，domain629/671，仓储9,838/11,512，deficits=[] | 本轮run `bcf0c3af-e4e7-4141-96e4-bfd4df761fad`；报告本地coverage同run目录                                         |
| 构建/依赖审查          | build通过，pnpm生产依赖audit未报已知漏洞                        | 只支持本轮锁定依赖审查，非应用安全认证                                                                            |
| 重点旧债PG复跑         | 3文件18测试通过，54.56秒                                        | [日志](evidence/known-debts.txt)：procurement、risk、harness-final-decision；测试明确期待缺陷发生/正确回滚        |
| 新探针首轮             | exit1，2个目标断言失败；14个复制旧测试按名称过滤未执行          | [首轮日志](evidence/candidate-probes.txt)，12.82秒；BOM数量红、发运出库目标红；二次发运复用tracking遭唯一约束拒绝 |
| 新探针修正轮           | exit1，3个目标断言失败；14个旧测试过滤未执行，10.69秒           | [第二轮日志](evidence/candidate-probes-r2.txt)，修改探针tracking避免无关唯一键，补来源存在性；未修改业务或原断言  |
| 独立审查               | 后端审查者只读核对公式/表/探针/日志，确认观察与边界             | 结论下列；实施者自检未代替独立核验                                                                                |
| 公网只读探针           | HTTPS GET health200/ok、ready200/ready、version200/sha=基线     | [GitHub与探针摘要](evidence/github-state.json)；无登录、无业务写入                                                |

## 新探针观察和边界

BOM：固定产品需求10，BOM产出基数10，用料2，损耗500 basis points。独立算式 `10÷10×2×1.05=2.1`，真实PG的gross_demand为21。当前 `mrp-repositories.ts:207` 不使用output_quantity，原fixture基数1不暴露此差异；生产计划成本同形公式只是静态关联，未用该探针证明已持久错成本。

发运：现有真实商业与生产fixture产出批次库存10，通过既有独立例外审批获得放行，请求量5。首次dispatch后库存仍10；使用不同shipmentNumber、trackingNumber和key第二次dispatch成功，库存仍10。证明当前发运不自动产生库存扣减，同放行可关联多个发运；不直接证明“业务必须只允许一次发运”，因为分批/独立出库职责需负责人裁定。源原测试也允许同放行新key再次建记录，见 `apps/api/test/shipment-postgres.integration.test.ts:493` 附近。首轮第二次拒绝是承运商+tracking唯一约束，不当作放行额度控制。

来源：真实PG sales_orders中不存在随机UUID，createDemand仍接受 `sourceType=SALES_ORDER` 和该sourceId。证明需求来源存在性未校验；没有证明后续发货门禁已被绕过、未证越权或生产数据污染。

这三条目标断言的红是审计发现，不是项目原完整CI失败；没有通过修断言、降低门禁或改业务去凑绿。第二轮只排除了首轮无关tracking唯一约束，原失败日志完整保留。

## 可重现材料

[source-inventory.csv](evidence/source-inventory.csv) 收录660个相关代码/配置文件、2,537条文件/路由片段/API字面量/仓储符号/表视图定位，210个schema对象；这是静态标识盘点，动态路径/正则匹配仍须读完整定义。业务跨层语义映射由能力矩阵给出，不能把静态片段数当API数量。

[document-register.csv](evidence/document-register.csv) 区分已读入口/定向章节和目录盘点，未把几百篇历史文件假标全读。[debt-status.csv](evidence/debt-status.csv) 保存原63个旧ID及8个新候选的原索引、历史状态和当前处置，不删已解决历史；新增8个候选见台账追加节及整改文档。[checksums.json](evidence/checksums.json) 保留本轮660个代码/配置文件和证据摘要SHA256，方便后续会话发现基线变化。

复现探针时，创建基于精确SHA的独立临时工作区，安装锁定依赖；将原 `mrp-postgres.integration.test.ts`、`shipment-postgres.integration.test.ts` 分别复制为 `v1-audit-mrp.test.ts`、`v1-audit-shipment.test.ts`，在该临时工作区对复制文件应用 [probe-overlay.patch](evidence/probe-overlay.patch)。只给专属回环测试库注入DATABASE_URL和NODE_ENV=test，先guard/migrate，再在API包执行 `vitest run test/v1-audit-mrp.test.ts test/v1-audit-shipment.test.ts -t V1_AUDIT`。预期现代码3个目标断言红；补丁不应应用到主线原测试文件。补丁基于原测试的最小差异，无生产凭据或生产样本。

## 未验证范围

本轮没有执行真实浏览器E2E、生产角色业务写入、当前SHA全岗人工UAT、真实业务持续使用、生产银行/库存对账、负载压测、联合恢复演练、生产CSP强制观察、GitHub环境审批权限、真实外部财务/物流集成。未运行不代表环境不可用，更不能造失败原因。TEST020未本轮重现；制造成本精度/后发布BOM漂移、通用响应丢失重试和全量读容量只作候选。全CI green不能覆盖这些未证内容。

五条只读审查线分别使用独立detached快照，覆盖后端业务链、前端、旧债、运维和官方行业资料。主控负责唯一文档写入与本轮运行验证，后端高风险数量结论另独立只读复核。审查者未运行测试或外写，未虚构并行实施。

最终文档格式/索引/链接/ID与安全检查结果见 [verification.json](evidence/verification.json)。基线全CI发生于本地文档写入前；本轮没有新Git提交，因此不存在“新文档提交已跑全CI”的声称。后续若提交草稿，须对该最终提交重新跑完整门禁；本轮文档校验不替代它。
