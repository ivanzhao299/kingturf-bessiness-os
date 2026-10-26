# ARCHITECTURE.md

**Docker前置当前边界（2026-10-17）**：仅本地环境scripts/e2e-docker真实回环byte forwarding/宿主guard与marker→容器READ ONLY同实例、Chrome自然Cookie/Origin，保原API/Web/SQL/两PW配置。seed只机器登录URL一行，环境只复用已装pgcrypto函数；完整seed生产关单缺已批准实际成本，TD-TEST-011/C7停后继spec，须新业务seed范围裁定，不扩业务源码。[实证与失败史](docs/evidence/playwright-docker-seed-auth-2026-10-17.md)。旧“Docker未启/49台账”为此前历史，现51含两个新测试前置项；不代表S4整批人工验收/一般阶段5完成。

**批次4整体交验现时（2026-10-17）**：S1统一响应头→S2单实例登录失败双窗→S3 API/外层HTML RO（强制false/off）→S4 Cookie签名双提交/Origin及不可变浏览器上下文；保opaque/scrypt/SQL/依赖方向。f114ee0实际稳定干净HEAD全CI0/192524.18ms，真实网络Node4/SPA DOM8/受控Jar14与资源负向9分开，不当全量PW/生产验证。[唯一验收包](docs/evidence/security-batch4-acceptance-2026-10-17.md)含实现/期望/配置默认/回滚总索引；SEC003载体实施项关闭、整体人工验收待交付，SEC001强制/延期PW/TD-TEST-006后继候选开放。当前只文档收口，最终文档HEAD另全CI后停协调，不启Docker/阶段5。以下为历史。

**S4网络工具检查点（2026-10-17）**：独立gateway真实代理API/同源SPA、随机schema双真实API、owned Chrome自然Jar；Node4/DOM8/受控Runtime14与故障9分层，未改旧合成/PW。bfdc4ff仅精确current POST logout豁免本地pause，保原proof/代际/服务端，未新增会话模型。源码/SQL/依赖保护及残余CDP/观察边界见[网络证据](docs/evidence/security-batch4-s4-network-2026-10-17.md)；工具最终干净HEAD全CI待执行，SEC003仍开放。下方为历史。

**S4前端当前候选（2026-10-17）**：首次Cookie restore→静态http-core单一交换/严格DTO；受保护http policy、SessionContext owner/generation/epoch、postlogin watch与workspace按真实阶段加载，entry不再持raw token或认证storage。三域client/文档服务捕获同一上下文，旧闭包不活读新Cookie；仅必要WEB007挂载复核/PERF003缓存同Promise耦合。API/SQL/包依赖/infra不改，Web304及预算11992/1898定向通过，最终提交后另实际稳定干净HEAD全CI再停协调；不是Chrome网络证据/整批完成，SEC003开放。[前端证据](docs/evidence/security-batch4-s4-frontend-2026-10-17.md)，下方为历史检查点。

**批次4 S3现时（2026-10-17）**：共享config纯policy/严格默认false的CSP_ENFORCE→server独立buildApp安全选项→统一complete/rejectOversized新增RO，保S1三头/S2/业务响应。外层nginx独立off开关、隐藏上游两CSP头后统一RO；内层未改，API env不是公网强制开关。行为762e393/oracle a4c2ca3/工具f693ee2实际稳定干净HEAD完整CI0（API123/17184、Web13/266/config29）；无新包/SQL/反向依赖/业务端口。test-only HTML collector及精确合成发送仅本地，无report接收端、不称生产就绪或强制兼容；完成docs另全CI后停协调，S4未实施。[S3证据与回滚](docs/evidence/security-batch4-s3-csp-2026-10-17.md)，下方S2/S1状态为历史。

**批次4 S2现时（2026-10-17）**：server从config装配LoginRateLimiter→buildApp唯一实例→auth validate之后执行双维失败滑窗及持锁退避；真实socket peer/headersDistinct经client-address显式信任链，默认不信任。config共享纯IP规范化器无反向依赖/新增包。业务bdbda0e首次全CI在新端口未分类处失败，必要门禁b8c1212绑定固定源唯一类声明身份，31仓储端口/规则不扩免，实际干净HEAD全CI0（API17175/Web266/config23）。仅登录限流，不是全API防DoS；S1头保持，未改SQL/会话模型。配置、代理部署前核实、资源边界、失败史及回滚见[S2证据](docs/evidence/security-batch4-s2-login-limit-2026-10-17.md)。最终docs另全CI后停协调，S3/S4未实施；下方S1与前端现时段保留历史。

**批次4 S1当前（2026-10-17）**：app.buildApp的统一complete→middleware/security-headers纯函数，所有经此收尾的dispatch及rejectOversized响应加nginx同值三头，原状态/body/关联ID/telemetry顺序保持；server原两处writeHead透传。无auth/SQL/nginx/依赖变化。源码b02ad55原严格头期望失败，独立同步65文件76处后59f9dfa实际干净HEAD全CI0，边界/部署重复头风险/独立回滚见[S1证据](docs/evidence/security-batch4-s1-headers-2026-10-17.md)。完成docs另全CI后停协调续派，不是批次4验收；下方前端“唯一当前”为已人工验收的历史快照。

**批次3历史检查点（2026-10-17，人工验收前）**：当时3a–3f实施与独立复核完成，最后业务dc3697b实际干净HEAD完整CI0/178446.705ms，待整批人工验收。bootstrap→CRM/commercial/governance/shared，store→source/read/route状态模块；已知HTTP/storage→五轻量parser，未知动态JSON不强record。root749/完整158/格式5，全web最大完整函数191/AST5，70公开与原457完整链保持。435条内部静态运行时相对导入边无环（不含动态/外部包）；原始“UI七层职责挤在一文件”已不代表该检查点。3e两证据工具曾漏遍历，已修并固定历史SHA完整重核；见[整批验收包](docs/evidence/frontend-batch3-acceptance-2026-10-17.md)。下方所有“当前/候选/未结清”均为更早历史时点；当时独立工具/文档收尾全CI提交后执行。此后批次3已验收64757d4，本段及下方历史不能覆盖上方S3现时。

当前3f候选：HTTP可选decoder→shared五parser；entry/CRM/commercial/document-service/saved-view在已知wire容器或原存储边界显式解析。unknown动态JSON不全局强record，不宣称泛型T深校验；原引用、缓存/请求顺序及204/abort通知保持，畸形行为已事前登记独立提交。root749/全web完整函数最大191/无静态内部运行时环；266测试/扩展50/原29及修正工具后的完整逆AST已过，源码实际HEAD全CI待补。[3f证据与历史证明更正](docs/evidence/frontend-3f-parsers-2026-10-17.md)。下列旧“现时候选/未结清”为各自历史时点，不覆盖本段。

3e③日期实施验证完成：shared/business-date的date/dateTime/heading三无状态原语服务10消费者13调用，保原Date位置、默认时区、重复getter及Intl先于Date；无缓存/反向依赖。179测试、13逆展开全文件AST、公开70/457链、两红绿和扩展47/原29浏览器齐，源码c0a549f实际稳定干净HEAD完整CI0/177552.922ms，完成docs另全CI，续3f；[日期证据](docs/evidence/frontend-3e-date-2026-10-16.md)。下方3e②及更早为历史检查点。

> 领域与包分层的顶层地图。依赖方向规则与代码现状一致（验证点见文末，可机械复核）。

## 1. 包分层与依赖方向（现状：干净 DAG，禁止破坏）

```text
apps/api (Runtime+Repo) ──→ packages/{config, database, domain, types}
packages/database ──→ pg（唯一外部运行时依赖）
packages/domain ──→ packages/types
packages/{types, config} ──→ 零依赖
```

**规则**：依赖只能沿上述方向；新增依赖边必须先在本文件登记理由。`packages/` 之间除 `domain→types` 外互不依赖；任何包不得反向依赖 `apps/*`。

## 2. 运行时请求流

```text
浏览器 SPA（原生 DOM，无框架）
  └─ apps/web/src/http.ts（统一封装：15s 超时 + AbortController + correlation-id）
      → 生产 nginx（infra/nginx/erp.kingturf.cn.conf，静态 + /api 反代）
          → apps/api/src/app.ts buildApp（路由分发：校验→授权→编排→DTO）
              → apps/api/src/*-repositories.ts（pg 参数化 SQL + DataScope 谓词 + 审计/outbox 双写）
                  → PostgreSQL 17（packages/database 71 个有序迁移）
```

- 组合根唯一：`apps/api/src/server.ts` 实例化全部仓储并注入 `buildApp`；`app.ts` 对仓储只做 type-only import（依赖倒置）。
- 认证：不透明 token，scrypt 哈希 + 服务端只存 sha256(secret+token)（ADR-0003）；授权：default-deny RBAC + SQL 级 DataScope 谓词（ADR-0004，谓词现状为 12 份拷贝，收敛中，见 TD-DUP-001）。
- 事件：审计与领域事件经事务 outbox 落库（ADR-0006）。

## 3. 业务域地图

**后端（apps/api/src，每域一个 \*-repositories.ts）**：

| 域组       | 域                                                                                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 平台基座   | auth/security、组织员工（repositories.ts）、授权（policy.ts、aggregate-authorization.ts）、foundation（通知/附件/业务对象/事件）、platform（规则/工作流/编号）、website-lead-ingest |
| 商机到报价 | crm（线索）、commercial（商机/方案/报价/信用，2,116 行最大域）、qtc（报价到现金台账）、contract-document、business-document                                                         |
| 履约       | production、manufacturing、mrp、procurement、quality、shipment、complaint                                                                                                           |
| 财务与治理 | collection、commission、risk、dashboard、order-360、production-cost                                                                                                                 |

**前端（apps/web/src，批次3小步拆分中）**：登录流（entry/login-flow）→ 懒加载工作台（bootstrap装配→commercial 21主视图已迁，入口仍含共享编辑器/列表工具/装配与governance/controller）；旧基线16,082 split行，3a完成15,243，3b完成13,757，未结清巨石债务。运行依赖单向：`bootstrap→crm/{controller,records,shell-frame}`，records→customer/lead-records→shared/forms/dom；`bootstrap→shared/{forms,locale,navigation,crm-http,commercial-http,document-library,contextual-documents}`。类型经crm/types、commercial/types、shared/shell-types作type-only桥接；bootstrap保留70原公开绑定，shared/CRM不反向import入口，必要plain函数引用ports不提前读取权限/缓存/会话。3b源码487d698已稳定干净HEAD完整CI0；能力读源已由用户授权47a8ee5、独立门禁36b1153改为按排除策略纳入的入口静态运行时TS图，不宣称完整动态调用可达性；各步证据/回滚见计划§4.3及§7。 3c①完成入口12,968 split，三视图经 `bootstrap→commercial/{opportunity-view,ctr-view,solution-view}→shared/forms与dom` 装配，sales-view-ports只结构type描述原controller，不搬God store或复制动态状态；原root rebuild回调仅在原提交后时点调用，模块无反向运行import。源码a34df41稳定干净实际HEAD完整CI0，商业其余18视图及共享残留继续按既定组拆分。

## 4. 目标分层（改造方向，规则 §4.1 存量适配）

3e②现时候选：bootstrap→route-state/route-navigation/route-dom/workspace-frame；state→dependencies/read/owner，原controller→owner/query（类型回指不构成运行时环）。首次route缺失源按权限交集补齐，已加载source/DOM复用，overview全授权源保持；只做网络data lazy。live构建捕获实际workspace/status，canonical组原位替换，回访无新DOM不重装菜单，lazy列表显式复用最近drawer绑定，旧默认安装语义不变。root749/完整158/AST3/格式5，8新runtime≤139/完整106/AST5；163测试、默认逆AST/70公开457链、原29及新47真绿，源码580cc72稳定干净实际HEAD完整CI真实0/179498.691ms，结束HEAD不变/树空；完成docs另全CI后继续。45台账，旧门控/顶层挂载/抽屉候选不修；尚有日期3e与解析3f，见[3e②证据](docs/evidence/frontend-3e-lazy-2026-10-16.md)。

3e①store守恒完成（历史检查点）：源码fc14d50稳定干净实际HEAD完整CI0/184438.376ms；bootstrap直接import/re-export commercial/store/controller同class，controller→{cost-query,readable-sources,load-opportunities,load-views}，后两同步启动原Promise链不新增await，type-only回指不形成运行时环。原279行class三helper逆展开完整AST相等，5runtime≤215/完整函数50/AST5、root704/函数160/AST3/格式5后才撤root豁免31→29；70公开457链/原114+六定向120/五实际红绿/新41及独立原fixture29齐。44台账仅新增两旧门控/顶层挂载待核实项不修；公开load全权限/refresh无权限过滤与原写后刷新范围保持，尚不结清TD-ARCH002或声称真正lazy，完成docs另实际HEAD全CI后继续，见[3e①证据](docs/evidence/frontend-3e-store-2026-10-16.md)。

3d治理完成：源码041e771稳定干净实际HEAD全CI0/177598.590ms；bootstrap→governance/{controller,surfaces,presentation,audit-workbench,workspace→各自然动作/heading/forms/order/card/sources}，workspace-types仅type，prefix经shared/permission-prefix同原绑定共享，无反向入口。28新TS≤187/完整函数142/AST5/root997，完整1124行21helper逆展开/17声明/70公开457链/27runtime真红还原114与旧新41、独立正常37/33/29齐；原views快照、版本解析/receiver/提交后重建及身份五按钮先创建顺序保持。42台账不修，不冒称错误排序/治理写安全矩阵；完成docs实际HEAD另全CI后继续3e→3f，见[3d证据](docs/evidence/frontend-3d-governance-2026-10-16.md)。

3c⑪剩余共享完成：源码32a277e稳定干净实际HEAD全CI0/179131.066ms；bootstrap→shared/{document-read-service,document-connectors→connector-card→configuration,document-bindings,document-html,document-print,shell-presentation,role-insights,route-sections}及crm/customer360-view→shared labels/format。读取factory原位恰一次单Map，renderer私有API getter只在原GET/PUT点取函数裸调；displayTime原体同绑定共享，没做日期收敛或解析收紧。12新TS≤101/完整函数95/AST4/root2545，原renderer完整逆展开/service四声明/18原声明/70公开457链/12目标红绿、新37及正常33/29齐。TD-PERF-003仅登记旧失败删新代缓存的待核实风险、不修，完成docs实际HEAD另全CI后继续治理3d→3e→3f，见[⑪证据](docs/evidence/frontend-3c11-remaining-shared-2026-10-16.md)。

3c⑩编辑器完成：源码78d726c稳定干净实际HEAD全CI0/181480.679ms；bootstrap→shared/online-editor→heading/workspace/pagination/save/review/completion/history/version/translation/send-settings/form/blocked/send/export；online-editor-types仅type，无反向root或共享barrel。原八ports函数ref、五let accessor单权威和成功时才读history getter保持时点；四onSaved仍裸调用，整个原800行14次逆展开AST全等。16TS≤172/完整函数165/AST5/root3066，70公开457链/15目标红绿/旧新扩展37及正常33/29齐，旧长比较遮挡TD-WEB-005仅登记不修、不推论生产。完成docs另实际HEAD全CI后续剩余共享→3d–3f，见[⑩证据](docs/evidence/frontend-3c10-document-editor-2026-10-16.md)。

3c⑨列表工具完成：源码8a3b00c稳定干净实际HEAD全CI0/177320.318ms；bootstrap→shared/workspace-list-tools→profile/drawer/controls/readers/rendering/search/selection/actions/saved-view（register-types仅type）。每install唯一懒drawer、每list七字段plain state单权威，原DOM/Set/数组与函数ref不复制；原guard后纯type契约保两次parent即时读。11TS≤144/完整函数138/AST5/root3880，8helper与state/context逆展开原完整函数AST相等、profile与root剩余顺序/70公开457链/十目标红绿齐。旧新扩展33真0，正常原夹具29也真0；完成docs实际HEAD另全CI，editor等共享及3d–3f继续，见[⑨证据](docs/evidence/frontend-3c9-register-tools-2026-10-16.md)。

3c⑧基础共享完成：源码541376f稳定干净实际HEAD全CI0/183823.324ms；root直接named import/re-export至shared/{document-templates,business-format,business-labels}与commercial/{ctr-fields,quote-print,readiness}；format无依赖、labels→format、print→format/labels、readiness→format，无共享barrel或反向入口。原43声明AST/剩余入口顺序/70公开457链全等，同数组/函数引用及每调用求值保持；六runtime≤289/完整函数103/AST5，root4520。六目标红绿/旧新29及预算11367/1898齐，完成docs实际HEAD另全CI，editor/listtools共享残留未结清，实际date收敛留3e，见[⑧证据](docs/evidence/frontend-3c8-shared-foundations-2026-10-16.md)。

3c⑦共享装配完成：源码944a175稳定干净实际HEAD完整CI0/185605.700ms。运行依赖为 bootstrap→commercial/workspace-\*→原各域view，8runtime/1type最大300/完整函数148/AST5、root5203/商业函数160。root ports/rebuild创建点、共享risk槽、两次children读取及legacy listener时点保持；10逆展开/21导入边/70公开457链/八目标红绿与旧新29齐。editor/listtools等共享残留及3d–3f未结清，完成docs全CI后继续，详见[⑦证据](docs/evidence/frontend-3c7-commercial-assembly-2026-10-16.md)。

3c⑥实施与独立复核完成：源码3f77a81实际干净HEAD全CI0/170456.489ms、独立工具830d1fb同口径0/177187.409ms；28新TS≤221/完整函数143/AST5/root5848，36逆展开/70公开457链/27红绿/旧新11/两次无trace28齐，TD006工具收口。21商业主视图已迁不等于共享editor/listtools/装配或3d/3e/3f完成，完成docs全CI后继续共享职责；只读卡不当写矩阵/Playwright，失败史/残余边界及回滚见[⑥证据](docs/evidence/frontend-3c6-operations-2026-10-16.md)，下方⑤段为其时点历史。

3c⑤完成：源码00766d6稳定干净实际HEAD全CI0/175184.510ms，8runtime/1type≤232/完整函数116/AST5，入口8129 split，17/21商业主视图已迁，余四及共享残留续⑥。15helper逆展开/70公开457链/八目标红绿、旧新16与组合24齐；只读合成覆盖不替代真实写矩阵/Playwright，不修TD-WEB-004，详见资金风险证据；下方候选段保留时点历史。

3c⑤候选：资金风险五原分支拆8runtime/1type，沿原`bootstrap→commercial→forms/dom`，root8129 split，file≤232/完整函数116/AST5。原cashRiskSummary早装配、两套逾期判定、渲染快照/点击live数据、佣金/风险政策不同发布链及风险槽同ref不改；实际15helper逆展开/70公开457链/八目标红绿/旧新组合16齐，完整提交后HEAD CI待实跑。见[资金风险证据](docs/evidence/frontend-3c5-finance-risk-2026-10-16.md)，未结清巨石或扩TD-WEB-004修复。

3c④完成：源码6ade731稳定干净实际HEAD全CI0/182166.585ms，11runtime/1type≤231/完整函数165/AST5、入口9046 split，12/21商业主视图已迁（另制造成本残留）、余9及共享残留续⑤。21helper＋原type/predicate逆展开/70公开457链/11目标红绿/旧新展开11与组合19齐，14不同route不泛化全部21视图或Playwright。原权限定界与共享risk槽同ref不改，详见订单履约证据；下方候选段保留历史。

3c④候选：四订单履约主视图及相邻制造成本残留沿`bootstrap→commercial→forms/dom`分为12新TS（11runtime/1type），root9046 split、新file≤231/完整函数165/AST5；order360创建风险槽的root原位赋值与后风险面板消费同ref保持，双生产面板同route/独立权限不改。完整原权限union与isCommercialPermission同置permissions.ts，经root真实运行导入/原名type-value facade，不扩大静态图/前缀，不修TD-WEB-004；首pure-type图排除失败及修正史留证。21处逆展开＋两声明还原/70绑定457链、11目标红绿/旧展开11已绿，新浏览器/实际HEAD全CI待跑，见[订单履约证据](docs/evidence/frontend-3c4-fulfillment-2026-10-16.md)。

3c③完成：信用/合同沿同单向依赖新增3runtime职责模块及type-only端口，root10535 split；新文件≤196/完整函数147/AST5，六原词法函数引用和原controller不复制，实际7处逆展开保持整入口AST。源码e401d27稳定干净实际HEAD全CI0/182693.526ms，旧新9及组合15只读卡片CDP绿，不算文档行/OCR/上传覆盖。TD-WEB-004仅登记，旧权限投影不修；commercial余13主视图及共享残留续④，未结清巨石或搬store，见[信用合同证据](docs/evidence/frontend-3c3-agreements-2026-10-16.md)。

3c②完成快照：成本/政策/报价12模块沿 `bootstrap→commercial→shared/forms/dom`，pricing结构type只描述原controller/静态端口；root10972 split，新模块≤610/完整函数135/AST5，原引用/动态权限/局部重绘/提交顺序及整入口逆展开保持。源码9429a31、独立测试driver3f3aae7均稳定干净HEAD完整CI0；两次无trace合并13/8不同路由不代表全21域或Playwright，原失败史保持。商业其余15主视图及共享残留继续既定组；未结清root巨石或搬God store，见成本政策报价完成证据。

3c②现时后补：源码9429a31稳定干净HEAD全CI真实0；自有CDP driver可靠性独立候选不增加业务依赖边，旧红→新driver10/总16及无trace合并13绿，工具HEAD全CI待核。业务源码不随工具修正改动；旧失败与有限竞态保留，详见成本政策报价证据。

3c②候选已将成本/政策/报价沿同方向拆为commercial内12个真实职责/结构type模块，入口10972 split，新模块最大610/完整函数135/AST5；原controller/permissions/cache引用、矩阵局部替换与各提交顺序保留，实际37处逆展开旧入口AST/70绑定/457断言同。局部门禁绿，诊断CDP13绿但无诊断两次导航超时及driver稳定取点待单责闭环；不将候选称整批完成。现时证据：[成本政策报价](docs/evidence/frontend-3c2-pricing-2026-10-16.md)。

```text
Types → Config → Repo → Service → Runtime → UI
```

- 现状缺口：Repo 之上无 Service 层（`buildApp` 单函数 6,442 行内联编排，TD-API-001）；UI 七层职责压进单文件（TD-WEB-001）。
- 逼近路径：批次 2 建立 `apps/api/src/routes/`（声明式路由）+ `services/`；批次 3 建立 `apps/web/src/{shared,crm,commercial,governance}/`。全部子批次与回滚点见 `docs/exec-plans/active/harness-migration.md` §4。

## 5. 依赖方向验证点（≥3，命令可复核）

1. **app.ts 仓储依赖为 type-only**：`grep -n "import type" apps/api/src/app.ts` → 20 个仓储全部 `import type`（依赖倒置成立）。
2. **包级 DAG 无环**：`pnpm why` 或直接查各 `package.json` 的 dependencies——workspace 内仅有 `domain→types`、`api→{config,database,domain,types}`、`web→ui` 四类边，无反向、无环。
3. **web 侧无反向引用**：`grep -n "from './entry'\|from './main'\|from './workspace-loader'" apps/web/src/bootstrap.ts` → 零命中；`grep -n "from './entry'\|from './bootstrap'" apps/web/src/{dom,http,session}.ts` → 零命中（入口链单向：main→entry→workspace-loader→bootstrap，已实测）。
4. **server.ts 是唯一组合根**：`grep -rln "new.*Repository(" apps/api/src --include='*.ts' | grep -v server.ts | grep -v test` → 仅仓储文件自身与测试，无第二处装配。

> 阶段 3 起上述验证点升级为结构测试（依赖方向边白名单），违规提交被机械拦截。

## 6. 关键决策（ADR 索引）

## 7. 竣工后不变量

常驻规则是单向 `apps/api → packages`、`domain → types` 的依赖 DAG；SQL 必须参数化，G3 采用“形状 × 可信根”白名单，路由校验和 service 边界由 `docs/GATES.md` 机械执行。行为守恒与显式变更登记遵循 R1/R2；认证继续使用 ADR-0003 的不透明 token，不引入 JWT。新依赖边、行为变更或 CSP 强制化都须先登记、独立提交并获得相应授权。

2e护栏先行（2026-10-16）：`pnpm service:check`以TypeScript AST/类型检查服务仅依赖已登记仓储端口实现或packages、仓储不得反向依赖Service、Runtime同入口不得跨仓编排；接入ci:local，无业务Service迁移。单仓路由继续直调Repo，不添加透传层。真实库存、静态能力边界及注入验证见[Service边界护栏](docs/engineering/service-boundary-guard.md)；该护栏不代表上述所有历史架构验证点均已机械覆盖，也不修TD-GATE-003。

`docs/adr/0001`~`0010`：TS monorepo 选型、PostgreSQL 与迁移、不透明会话、default-deny RBAC 与 DataScope、版本化平台引擎、事务 outbox、不可变业务对象 schema、P1 CRM 兼容、商务修订图、不可变 Quote-to-Cash 台账。架构改动前先读对应 ADR；与 ADR 冲突的改动须新开 ADR 并经人工确认。

Batch3库存同步元数据与流水权威分离见[ADR0011](docs/adr/0011_inventory_resource_serialization.md)：0071仅本地测试获准，生产执行另授；旧SQL兼容不等于旧binary启动兼容。
