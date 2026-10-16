# 批次3：只读迁移地图与前置阻断（2026-10-16）

授权310c1e2，人工验收基线b575b9c。先行E1源码d9f43f6、撤例外3231964已经稳定干净HEAD完整ci:local真实退出0（173.927秒），API117文件17099例/web9文件114例/既有13PG通过，结构0硬/31软；随后才执行本只读前端盘点。**3a未实施**，未改web源码/断言/fixtures/浏览器配置，未实现web AST门禁，不冒称新web已AST覆盖。4/5未启动。

## 真实度量与冻结清单

`node scripts/analysis/repo-metrics.mjs`真实退出0，输出/tmp/kingturf-frontend-preflight-metrics.log：非测试TS171文件/52671行；bootstrap.ts16082 split行（含末空段），占30.5%；commercialWorkspaceStructure:1851–10401约8551行；bootstrap格式缩进≥4层8603行、≥7层3893行、最深14；日期格式化12处。与旧38.8%分母不同，bootstrap未下降，不能当作重构成果。metrics脚本是文本估算，不冒称函数200或AST深度已强制。

TypeScript AST核顶层export声明69条：23变量声明语句、22类型别名、19函数、3类、2 reexport；不是69模块/视图。bootstrap.test.ts有28个readFileSync调用，**15个直接读取bootstrap.ts、13个读取其他源/CSS等**，不是28次全读bootstrap。原114web断言/fixtures冻结，整个apps/web基线tree为`5191bff390dcd4e840ca475fe21c782ee54eaf6a`（git rev-parse b575b9c:apps/web）；当前git diff对apps/web/测试/Playwright配置为零，必要迁移import路径尚无任何变更。

现有build实际预算：JS11368/CSS1898 gzip字节，登录工作台deferred，低于12000/4000。真实脚本apps/web/scripts/check-startup-budget.mjs:22–23要求src/bootstrap.ts仍为dynamicEntry且不进登录静态图；不能直接删入口或拉工作台进登录。后续可保留真实facade/reexport/懒加载入口，但不能靠死注释/死代码保源文本字符串。

## 迁移地图（候选，未搬移）

### bootstrap.test具名消费绑定（全部列出，未决定项明确保留）

取bootstrap.test.ts:3–44的真实import，共40个具名绑定（37值/3类型），以下是消费面，不等于已经决定的模块归属；保留真实bootstrap facade可能维持这些导入路径，但不能替代后述读原文夹具处置。

| 候选归属                                                     | 全部具名绑定                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| shared/路由候选                                              | BOOTSTRAP_TITLE、appRouteFromHash、viewportFor、visibleAppRoutes、roleWorkspaceProfile、roleTaskInsight、routeViewSelector、setOperationStatus                                                                                                                                      |
| CRM                                                          | CrmController、createCrmShell、visibleCrmSections、customerStateLabel；类型CrmApi、Customer、Lead                                                                                                                                                                                   |
| commercial/controller/视图                                   | CommercialController、commercialWorkspaceStructure、commercialRevisionPath、visibleCommercialSections、isCommercialPermission、cashRiskSummary、contractOrderReadiness、opportunityPipelineSummary、quoteWorkflowReadiness、technicalSolutionOpportunityId、inventoryLocationOption |
| governance                                                   | GovernanceController、governanceWorkspace、visibleGovernanceSurfaces、governanceChannelLabel、governanceNextAction                                                                                                                                                                  |
| 标签/文档配置待设计判定（shared locale或真实业务域，不预填） | businessEventDetailLabel、businessEventLabel、commissionNextAction、operationsNextAction、qualityStageLabel、riskRuleLabel、shipmentGateLabel、supplyModeLabel、templatesForRoute                                                                                                   |

其他直接消费者：crm-selection.test.ts:2导入CrmController及type CrmApi，实际测试selectCustomer竞态（旧响应/失败不能覆盖最新选择）；commercial-loading.test.ts:2导入CommercialController，测试活跃读取合并、retry/freshness、缓存与权限，不可为分store/惰性改旧断言；workspace-loader.ts:2以Pick<typeof import('./bootstrap'),'mountWorkspace'>钉类型，:5默认动态import('./bootstrap')并消费mountWorkspace，须保持真实懒加载入口/函数契约，不能令登录静态引工作台。createCrmRecords准确符号起点为bootstrap.ts:14103，createCrmShell:13267；下方粗区域不是精确函数跨度。

| 子批           | 当前bootstrap.ts真实锚点/依赖                                                                                                                       | 尚需满足的护栏                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 3a form        | FormField11925–11950，openForm11951，openFileForm12126；online editor11125使用该type                                                                | 真正shared模块≤800/AST≤5/函数实测≤200，文本slice跨边界见阻断                       |
| 3a route       | applyRouteVisibility12286、replaceRouteView12299、setAppRoute12315、installAppNavigation12321–12414、section navigation12416；调用本地化/visibility | 导航源码断言必须真实迁移，不可保旧字符串假通过                                     |
| 3a HTTP/locale | createFetchCommercialApi10403、createFetchCrmApi10520；localizeEnterpriseCopy13249–13265；标签函数899–1237分散，onlineDocumentApi不是纯通用工厂     | 先明确最小新web模块AST范围并机械注入，不能沿用格式缩进冒充AST                      |
| 3b CRM         | CrmController10590、createCrmShell13267、createCrmRecords14103（精确符号起点），需按实际构建函数再细分                                              | 冻结114、p1-demo及workspace-route-isolation本地Chrome E2E                          |
| 3c commercial  | commercialWorkspaceStructure1851–10401单巨函数，21 token1862–1865、commercialRouteTokens10093–10121                                                 | 六组不是现成六模块，不得只搬8551行巨函数                                           |
| 3d governance  | GovernanceController14572、governanceWorkspace14862起                                                                                               | roles E2E仅回环test，不使用生产URL/凭证，不把skip当通过                            |
| 3e store/date  | CommercialController1427起、日期formatter散布12处                                                                                                   | 按视图惰性/锁定时序，竞态与p1 E2E、仅整批实测评分更新                              |
| 3f boundary    | http.ts及entry.ts/sessionStorage、bootstrap.ts/localStorage读取边界                                                                                 | 轻量自研parser，keys/读取顺序及有效输入保持；畸形拒绝行为单独登记/提交，当前未实施 |

3c完整六组21视图（源代码是巨函数内token/工作台映射，不假称现有独立渲染函数）：

| 组  | 全量视图                                                                    | 当前映射/表单锚点                                  |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------- |
| ①   | opportunities / technical-requirements / technical-solutions                | 10096–10098；面板10125–10147                       |
| ②   | costing / sales-policies / quotes                                           | 10099–10100；面板10149–10170；完整token见1862–1865 |
| ③   | credit-review / contracts                                                   | 10101–10102；面板10173–10186                       |
| ④   | sales-orders / order-360 / production-orders / shipments                    | 10103–10104、10113、10115；销售订单10189–10194     |
| ⑤   | receivables / collections / payments / commissions / business-risks         | 10105–10109；资金面板10197–10219                   |
| ⑥   | manufacturing-master / procurement / material-planning / quality-inspection | 10110–10114                                        |

## 冻结约束冲突：完整搬移指定实现＋读取零改＋仅改import路径

- bootstrap.test.ts:128–134同一bootstrap源文本断言shipment endpoint、onlineDocumentReadCache、onlineDocumentRead、permittedRoutes，横跨数据配置/文档/CRM构建；146–165另含register/翻页等；168–179、453–468、909–913钉导航字面。只改导入路径不改变readFileSync的目标文件。

以上不是断言“逻辑上所有拆分都不可能”：sidebarToggle/navGroup实际在createCrmShell，完整迁移主要影响3b；3a导航的utilityContext赋值可设计成真实bootstrap composition回调，HTTP也可能保留真正被调用的endpoint配置/cache。是否可合法保留并达到模块800/函数200/AST5须有具体设计证明，当前未实施，不排除这些小步方案；不能把仅为凑源码测试的死字符串当composition。

- 最小可复核反例：用TS AST在内存移除bootstrap.ts的installAppNavigation12321–12414（模拟搬到真实shared模块，不写任何文件），原源码包含`utilityContext.textContent = APP_ROUTE_LABELS[route]`为true，移除后false；bootstrap.test.ts:909–913冻结断言要求其仍在bootstrap文本中。import/reexport facade不会包含函数实现字面，无法满足断言。该只读探针真实退出0/零文件写入，证明冲突而不是提交失败源码。
- bootstrap.test.ts:892–906以source.slice切openOnlineDocumentEditor→type FormField、templateRoutes→sectionHeader。真实源锚点为11125/11925及13785/14133。移动编辑器与FormField会丢两端且正向断言失败；只移结束锚点时indexOf=-1会改变切片语义；第二段只有负向断言，还可能对空/错误切片假通过。不能将测试绿误当冻结保护仍等价。
- **需人工裁定的最小解法（若选择完整搬移上述实现）**：允许逐处登记调整这些测试的真实源码读取路径/跨模块读取组织，保持expect内容与业务fixtures不变；单功能块指向新模块，多功能块按真实归属拆读取变量/断言绑定，slice改为目标模块的有效边界或等价行为护栏。此超出“仅迁移必要import路径”现有许可，当前只提出，不改读取/拼接/断言。若继续绝对冻结读取方式，则完整搬走这些文本覆盖实现不可兼得；另可先设计保留真实composition的小步方案，但不能未经证明声称全部目标已能满足。保留facade解决公共导出/启动预算，不自动解决源码断言。拒绝重复死实现、注释字符串或无业务用途锚点作为解法。

## 阻断二：既定Chrome channel不可启动

playwright.config.ts:7单worker、:14默认http://127.0.0.1:4173、:15 channel='chrome'。主代理实际调用chromium.launch({channel:'chrome',headless:true})退出1：Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome。fs检查Linux Chrome=false，缓存Chromium=true。当前配置origin只以布尔检查确认为回环，未打印环境值/凭证，未打开任何生产URL；缓存Chromium不等于既定Chrome，Windows安装也不证明Linux channel可用。

这只是浏览器launch预检，**没有运行pnpm e2e:p1/workspace-route-isolation/roles E2E**，不把launch或CI单测当E2E。由于必要浏览器已阻断，未播种/修改测试数据，角色账户/数据可用性未继续验证；未读取账户秘密。roles用例本身存在test.skip前置（production-role-uat.spec.ts:246），后续必须在回环环境明确准备数据并确认不是skip，不能复用生产设置。

**需人工/环境处置**：提供或安装本机Linux既定Chrome后保持原channel，重新核本地回环服务/隔离测试库/测试数据及全部必要E2E。当前不自行改channel为缓存Chromium、不改配置/依赖、不安装/请求生产、不跳过E2E。即使解决冻结夹具，Chrome阻断仍独立存在。

## 当前停报状态与诊断史

E1已先完成，不受前端阻断回退；3a及后续全部未实施，bootstrap豁免仍保留。新web AST范围护栏也未实施，不把API routes AST能力移花接木。QUALITY_SCORE、web114断言/fixtures、packages/依赖/SQL/workflow均零改动，BOUND003/004、SEC006/007、D1与N+1修复不动。

诊断：首次定位startup预算误猜根scripts路径，rg后确认实际apps/web/scripts；一次regex对子字符串计数给bootstrapReads=0，随后TS AST完整计数修为15/28。均只读定位失误，不是业务回归。Chrome预检退出1是实测环境阻断；未尝试以缓存浏览器偷偷替代。前端只读独立盘点与主代理最小内存反例相互核证，具体人工选择以上述两项为准，不虚称批次3完成。
