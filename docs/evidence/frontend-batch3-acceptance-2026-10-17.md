# 前端3a–3f整批人工验收包（2026-10-17）

状态：实施及独立复核完成，**待用户整批人工验收**；最后业务源码`dc3697b`实际稳定干净HEAD完整CI0/178446.705ms，详见[3f最终源码证据](frontend-3f-parsers-2026-10-17.md)。本收尾提交（仅证明工具/文档、评分，无业务改动）的实际干净HEAD完整CI在提交后执行，不预填结果。没有启动批次4/阶段5、push、部署或workflow变更。

## 结果与可复算范围

| 指标                                 | 旧基线                     | 当前业务源码dc3697b                                                              |
| ------------------------------------ | -------------------------- | -------------------------------------------------------------------------------- |
| bootstrap split行                    | 16082                      | 749                                                                              |
| commercialWorkspaceStructure完整跨度 | 约8551                     | 158                                                                              |
| bootstrap格式缩进层数                | 14                         | 5（AST3）                                                                        |
| 全web非测试TS                        | 单文件巨石为主             | 197文件/22392 split行；最大文件749，最大完整函数191                              |
| 全web非测试AST深度                   | 旧基线不以全树统一重测宣称 | 当前最大5，函数/回调不重置深度                                                   |
| Web测试                              | 原9文件114                 | 13文件266（原114语义保持，新增152）                                              |
| bootstrap公开                        | 70                         | 70：47 value（含4 class）+23 type-only；checker type-side27与47重叠4，勿相加成74 |
| 登录gzip预算                         | 上限JS12000/CSS4000        | 11794/1898，workspace仍deferred                                                  |

当前repo-metrics：357非测试源/57814 split行，150测试/67017行；API4129/buildApp3598不因前端批次改变。全web完整函数扫描含回调，最长`shared/document-library.ts`的appendDocumentLibrary:9–199，191行；启动五文件main/entry/login-flow/workspace-loader/http分别11/225/64/21/85 split，最大完整函数loginView83行。独立复算435条去重内部相对静态运行时import/re-export边，无环；不包括动态import/外部包，不以无环代替全部语义依赖证明。测量使用TypeScript AST与structure-gate同深度算法；repo-metrics行口径为split('\n')，非trimEnd。

bootstrap根文件豁免已在3e①撤销，当前29条其它存量豁免没有新扩。≤200为本批完整AST审计，不谎称已有全仓函数200强制CI；新web范围的文件/AST门禁持续约束。能力读源经独立授权工具调整到真实运行时import图，39能力/19路径阈值未降低。前端评分只在本整批收尾更新，保留原历史及后端/共享包分数；测试/文档分数保守不升级。

## 交付与回滚索引

以下是源码检查点，不替代各证据内更细的读取锚点→新模块/真实红绿/完整CI日志映射。回滚须先核后继依赖，按逆序revert相关源码和适配测试，工具/证据可独立revert；本次没有执行回滚。

| 子步                                        | 源码提交                                    | 证据与读源映射                                                                                                           |
| ------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 3a form/locale/CRM HTTP/商业HTTP/navigation | 86e7026、66a2f2b、1a7c4a9、af97961、4406f3e | [3a五步总表](frontend-3a-checkpoint-2026-10-16.md)                                                                       |
| 3b CRM                                      | 487d698                                     | [CRM](frontend-3b-crm-2026-10-16.md)                                                                                     |
| 3c①销售技术                                 | a34df41                                     | [销售](frontend-3c1-sales-2026-10-16.md)                                                                                 |
| 3c②成本报价                                 | 9429a31                                     | [报价](frontend-3c2-pricing-2026-10-16.md)                                                                               |
| 3c③信用合同                                 | e401d27                                     | [合同](frontend-3c3-agreements-2026-10-16.md)                                                                            |
| 3c④订单履约                                 | 6ade731                                     | [履约](frontend-3c4-fulfillment-2026-10-16.md)                                                                           |
| 3c⑤财务风险                                 | 00766d6                                     | [财务](frontend-3c5-finance-risk-2026-10-16.md)                                                                          |
| 3c⑥制造采购质量                             | 3f77a81                                     | [运营](frontend-3c6-operations-2026-10-16.md)                                                                            |
| 3c⑦装配                                     | 944a175                                     | [装配](frontend-3c7-commercial-assembly-2026-10-16.md)                                                                   |
| 3c⑧基础共享                                 | 541376f                                     | [共享](frontend-3c8-shared-foundations-2026-10-16.md)                                                                    |
| 3c⑨列表工具                                 | 8a3b00c                                     | [列表](frontend-3c9-register-tools-2026-10-16.md)                                                                        |
| 3c⑩编辑器                                   | 78d726c                                     | [编辑器](frontend-3c10-document-editor-2026-10-16.md)                                                                    |
| 3c⑪共享剩余                                 | 32a277e                                     | [剩余共享](frontend-3c11-remaining-shared-2026-10-16.md)                                                                 |
| 3d治理                                      | 041e771                                     | [治理](frontend-3d-governance-2026-10-16.md)                                                                             |
| 3e①store / ②lazy / ③日期                    | fc14d50、580cc72、c0a549f                   | [store](frontend-3e-store-2026-10-16.md)、[lazy](frontend-3e-lazy-2026-10-16.md)、[日期](frontend-3e-date-2026-10-16.md) |
| 3f已知边界行为                              | dc3697b                                     | [边界、负向及证明工具更正](frontend-3f-parsers-2026-10-17.md)                                                            |

独立工具回滚点：门禁运行时图36b1153（授权47a8ee5）；CDP取点3f3aae7/830d1fb；360合成契约2f9d316；本收尾proof更正与业务源码分开。E1 d9f43f6/3231964为前端前已验收前置，不归入本批新增后台变更。

## 验证边界与已知保留

协调另独立实际只读运行三份版本化proof（3f显式固定dc3697b）均exit0，并以固定源码纯内存复算197文件/22392行/749最大文件/191最长完整函数/AST5/435边无环，与本表一致；不是只采信主代理日志。候选只读reviewer另核边界、脚本和评分无实质阻塞，未运行测试。工具接入额外ESLint时首次nested目录未命中原Node MJS配置而退出2，随后只为proof目录补同等Node配置并加入原lint命令；第二次两条regex空格规则红，等价改` {2}`后重核。不放宽原TS lint规则，不改业务或依赖。

- 原Web九文件114冻结语义、bootstrap457完整expect链和70公开绑定保持；源码读取仅组织路径/唯一非空切片锚点，每批读源适配/新增runtime绑定都有实际扰动红→还原绿（按各证据分别计数，不能把binding变异当所有业务故障动态覆盖）。3f新增87覆盖畸形边界，原HTTP替回7红/正文破坏6红是行为负向，发生于265例时，最终另加合法大数后266。
- 真实浏览器最后扩展50与原29均通过，分别是旧41+lazy6+boundary3和原只读视图组合；分类/每源请求计数/清理在3f证据。它们不是79个唯一测试或全部业务写操作覆盖。客户360 fixture唯一新增字段已独立授权/提交，不再声称本批CDP fixture字节完全未变。原driver物理命中、3秒预算、未知/写请求硬闸保持。
- 三份临时AST proof曾truthy短路；已登记TD-TEST-009、修void遍历/三个差异自检，按固定580cc72/c0a549f/dc3697b完整重算通过并版本化。旧lazy/date顶部追加更正而不抹历史；仅单表达式if括号归一化，条件/语句/else参与完整比较。详见3f证明更正及脚本；不虚报全仓所有工具审计完毕。
- lazy是网络数据首访按route/权限闭包加载，复访复用snapshot/DOM；overview为保全域洞察仍读取全部授权源，公开load/refresh及旧写后刷新范围不缩，非JS/DOM code-splitting。有限竞态窗口与旧门控/会话顶层挂载/抽屉风险仅登记，未顺手修复。
- dates保native zh-CN/环境默认时区/原Date和Intl构造顺序，非固定时区行为变更。3f只轻量已知wire容器/消费键，未知动态JSON透传，不能宣称任意T/深层业务字段均有运行时证明。会话仍opaque token存原sessionStorage，不是SEC/D1方案实施。
- 原Playwright9spec/config未改且**尚未真实补跑**：阶段5终验前用户提供Linux Chrome或免交互安装权限后运行；CDP是批准的临时通道，不抵销此义务。无覆盖率数字，不预填75/90/70目标；无真实账户安全全矩阵/生产/部署/SQL回归之外新增保证。

保护区核对：58c4dc6→dc3697b的apps/api、packages、.github、lock、原Playwright零diff；package.json只有批准的lint/工具测试链接入，非依赖变更。TD-BOUND003/004、SEC006/007、D1、七N+1修复均未实施。台账47条含历史，新增TD-TEST009为证明工具证据缺陷，已修重核，非新生产bug。

两个本会话stash（93d6aee、b9d080d）均已恢复，保留作可恢复快照，非尚待合入业务；不读取/删除其它stash。验收后才能按另行指示推进，当前停点不扩授权。
