# docs/index.md（全部文档索引）

[Docker Playwright前置补跑R7授权](tasks/playwright-docker-authorization-2026-10-17.md)：完整人类授权、九旧spec延期裁定、d801237实施收口/真实CI前置及本轮库存/本地通道边界；不代表S4整批人工验收或A/B补跑已通过。

[批次4唯一整体验收包](evidence/security-batch4-acceptance-2026-10-17.md)：S1–S4前后行为、全部必要期望/夹具适配与真实变异总索引、分层计数、配置/生产边界、提交/回滚及台账评分。f114ee0稳定干净HEAD全CI实际0/192524.18ms；本次仅文档收口，最后文档HEAD全CI另跑后交协调，整体人工验收未预填通过。SEC003关闭载体实施项，SEC001强制段/九旧PW义务/TD-TEST-006后继候选保持开放；下方为各小步历史导航。

[S4暂停状态显式退出窄修](evidence/security-batch4-s4-paused-logout-2026-10-17.md)：bfdc4ff、9新增真红绿/实现变异、API17242/Web313及真实DOM原失败链重跑通过；已包含于f114ee0稳定干净HEAD全CI0，整批人工验收待交付。

[S4真实网络与应用CDP](evidence/security-batch4-s4-network-2026-10-17.md)：Node4/SPA DOM8/Chrome Jar受控协议14=26、故障清理9与真实变异通过；f114ee0稳定干净HEAD全CI0/192524.18ms。SEC003载体实施项关闭，整批人工验收待交付；分层/失败史/有限窗口/资源清理边界保留。

[S4前端会话上下文切换](evidence/security-batch4-s4-frontend-2026-10-17.md)：五旧测试文件真红绿、core回调真变异；b38c75c独立全CI0/192629.727ms（Web304、预算11992/1898），后继f114ee0累积全CI0。该小步当时不跑浏览器/PW；后继CDP与当前实施状态见唯一交验包，九旧PW仍未执行。

> **作用**：docs/ 下每个 Markdown 文件都在本索引中，且每个链接可解析（校验：`node scripts/analysis/doc-lint.mjs`）。
> **状态标注**（D4 已裁决，2026-10-12，方案 A 轻触式）：`常驻`＝长期保留并随代码更新（全库共 51 项）；`已归档-只读`＝完成记录/历史快照，原位保留、不再更新、勿删（R5，全库共 54 项）；物理归档（git mv 到 archive/）暂不执行，若未来出现检索痛点再升级。
> **新鲜度**：常驻文档最近核验 2026-10-12（基线 `779dea3`）；归档文档标注原始日期。新增文档必须同步登记到本索引，否则 doc-lint 失败。

## 常驻入口（根与 docs 顶层）

[S4后端会话载体与逐文件期望映射](evidence/security-batch4-s4-backend-2026-10-17.md)：后端/config/机器接口小步的旧→新、六项依据、变异与分层验证；25526c8独立全CI0/203058.579ms，后继f114ee0累积全CI0。原冻结/停协调为当时边界，当前状态见唯一交验包。

[S4自然HTTP Secure Cookie预检](evidence/security-batch4-s4-cookie-http-2026-10-17.md)：隔离真实HTTP/真DOM/两Set-Cookie/浏览器Jar与回传，自有资源正常及4负向清理；fead2d1独立全CI0/205231.486ms。此预检本身不是S4后端或完整CSRF，九旧Playwright不抵销；后继实现见唯一交验包。

[S4正式实施开工R7引用](tasks/harness-batch4-s4-authorization-2026-10-17.md)：2e22837六项已决/原始人类授权亲核；先R7＋明确设计docs停协调只读复核，再直接续已授实施，不重问选型。人类另裁定九旧Playwright本轮不改，适配/逐文件变异/补跑一并为阶段5前硬前置，未执行不标绿/CDP不冲抵。

[S4实现设计与行为表](tasks/harness-batch4-s4-design-2026-10-17.md)：固定设计efae93d已协调确认；原“仅设计/工具、未实施”为历史时点，后继源码实现与验证已完成，当前整批人工验收仍待交付，见唯一交验包。

[S4批准前会话影响报告（历史）](tasks/harness-batch4-s4-session-impact-2026-10-17.md)：420f9ba实际干净HEAD全CI0/207904.734ms，重盘124 API源/123测试及Web/CDP/Playwright/CLI候选、两Cookie CSRF方案、跨tab/迟到Set-Cookie边界；原“待确认/仅报告硬停”保留当时时点，2e22837已六项裁定正式放行实施，当前范围以上方R7为准，不进入阶段5。

[S3 CSP验证与边界](evidence/security-batch4-s3-csp-2026-10-17.md)：行为762e393/oracle a4c2ca3/工具f693ee2实际稳定干净HEAD全CI0/219878.817ms，API17184/Web266/config29；原29/新CSP3/头矩阵20/工具65及失败史、源码/构建import与配套回滚。完成docs另实际HEAD全CI后停协调，非生产通道就绪/强制兼容声明。

[S3 CSP严格期望逐处清单](evidence/security-batch4-s3-oracle-map-2026-10-17.md)：74c78c3基线122旧API测试全AST守恒，68文件81头对象仅追加CSP字面量；S1固定历史证明保留，S3显式基线/目标，机械追加不输出fixture/补丁正文。

[批次4 S3 CSP先行设计](tasks/harness-batch4-s3-design-2026-10-17.md)：S2协调确认74c78c3后先登记，仅API/外层HTML Report-Only与默认off强制开关；真实Document头/首次导航前脱敏采集、独立精确合成发送DOM场景、旧oracle逐处映射及保护区。现时实现/真实CI见上方S3完成证据，原文保持设计时点。

[批次4 S2登录限流完成证据](evidence/security-batch4-s2-login-limit-2026-10-17.md)：业务bdbda0e首次全CI未分类端口红，独立精确声明身份门禁b8c1212全CI0/194043.303ms；API17175/Web266/config23、49门禁自测、原生入口/并发/代理及资源边界/失败史/回滚。最终证据HEAD另全CI后停协调，不启动S3/S4/阶段5；台账48，新增TD-HYG-002仅登记旧preview Dockerfile遗留COPY。

S2门禁适配：新增登录限流固定源唯一真实类声明身份分类及错类型/来源/改名跨仓拒绝对照，保持业务仓储归属规则；见[Service边界护栏](engineering/service-boundary-guard.md)。bdbda0e首次全CI未分类端口真实红，后继独立门禁b8c1212全CI0；纯名字候选漏报/修正史保留。

[批次4 S2登录限流设计](tasks/harness-batch4-s2-design-2026-10-17.md)：账户/IP独立10失败/15分钟、持锁失败退避、429不续禁、503容量边界、真实peer/显式可信链及配置透传；S1协调通过后先设计，尚未实施S3/S4。

[批次4 S1安全响应头证据](evidence/security-batch4-s1-headers-2026-10-17.md)：R7 bed8b40→业务b02ad55真实全量红→独立期望59f9dfa全CI0，API17114/Web266，逐处映射/保护区/风险及回滚；证据提交后另实际HEAD全CI，停协调续派S2，非批次4人工验收。

[S1响应头严格期望逐处清单](evidence/security-batch4-s1-oracle-map-2026-10-17.md)：76处/65文件仅追加获批三头，保留严格相等、请求夹具及其余断言；保留源码HEAD首次全量红，后继test提交重新全链。

历史时点（R7初始授权）：当时批次1/2含E1/3已人工验收64757d4，正式授权批次4 D1；[R7实施授权与S4硬停止边界](tasks/harness-batch4-authorization-2026-10-17.md)。当时执行步先S1，其它步骤按顺序另派；现时S3状态以上方入口为准。

历史时点（批次3收尾、人工验收前）：当时3a–3f实施与独立复核完成，业务dc3697b干净HEAD全CI0；47台账，原Playwright仍待补跑。[整批验收包](evidence/frontend-batch3-acceptance-2026-10-17.md)汇总实测评分/回滚/保护区和工具证明更正。当时独立工具/文档收尾提交后另全CI，等待用户整批人工验收，不进4/5；此后批次3已验收64757d4，现时S3状态以上方入口为准，下表旧职责时态保留历史。

| 文档                                                                             | 职责                                                             | 状态                    |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------- |
| [AGENTS.md](../AGENTS.md)                                                        | 智能体入口地图（≤100 行）                                        | 常驻                    |
| [ARCHITECTURE.md](../ARCHITECTURE.md)                                            | 领域与包分层、依赖方向规则与验证点                               | 常驻                    |
| [README.md](../README.md)                                                        | 项目简介与本地起步                                               | 常驻                    |
| [CI.md](CI.md)                                                                   | 框架判定（非 Tauri）与 CI 决策记录                               | 常驻                    |
| [GATES.md](GATES.md)                                                             | 门禁清单（11 项 CI 链 + 2 个本地 hook + 豁免机制）               | 常驻                    |
| [RELIABILITY.md](RELIABILITY.md)                                                 | 可靠性机制与发布链路 runbook（逐步对应 deploy-production.yml）   | 常驻                    |
| [QUALITY_SCORE.md](QUALITY_SCORE.md)                                             | 按域质量评分（可复算依据）                                       | 常驻                    |
| [design-docs/core-beliefs.md](design-docs/core-beliefs.md)                       | 核心信念（争议裁决依据）                                         | 常驻                    |
| [exec-plans/active/harness-migration.md](exec-plans/active/harness-migration.md) | 批次4 S1–S3人工验收；S4已授权，先R7/设计docs停协调复核再编码     | 常驻                    |
| [exec-plans/tech-debt-tracker.md](exec-plans/tech-debt-tracker.md)               | 技术债现48项含历史，新增TD-HYG-002旧preview Dockerfile引用仅登记 | 常驻                    |
| [local-acceptance-cleanup.md](local-acceptance-cleanup.md)                       | `.local-acceptance/` 本地产物清理边界与手动脚本说明              | 常驻                    |
| [HARNESS-RULES.md](HARNESS-RULES.md)                                             | 施工规则（竣工验收后按其 §14 归档）                              | 常驻（施工期）          |
| [WORKSPACE_ROUTE_ISOLATION.md](WORKSPACE_ROUTE_ISOLATION.md)                     | 工作区路由隔离说明（2026-09-06）                                 | 已归档-只读（事件复盘） |

## docs/adr（架构决策记录，10 篇）

[3f解析与证明更正](evidence/frontend-3f-parsers-2026-10-17.md)：已知HTTP/storage轻量schema，266 Web/34工具/50及原29浏览器，三个AST证明工具完整遍历修复与固定SHA重算；源码实际HEAD全CI/整批收尾待补，不替代原Playwright。

[3f前置CDP夹具契约修正](evidence/frontend-3f-cdp-fixture-2026-10-16.md)：用户确认独立补客户360服务端固定unavailableSections，旧红→工具33绿；业务WIP隔离，原UI断言/网络硬闸不动，原29与实际干净HEAD全CI待补。

[3e③日期统一证据](evidence/frontend-3e-date-2026-10-16.md)：全runtime13调用/10消费者收敛三原语；179测试、13逆展开完整AST/旧457链及两种真实红绿，扩展47及原29浏览器/源码c0a549f实际干净HEAD完整CI0/177552.922ms，完成docs另全CI，随后解析3f。

[3e②惰性读取证据](evidence/frontend-3e-lazy-2026-10-16.md)：首次缺失源/已访问复用；21闭包、163测试、8锚点红绿、默认逆AST/70公开457链、原29及新47真实0；overview仍全授权读取，源码580cc72实际干净HEAD完整CI0/179498.691ms，完成docs另全CI后继续，续日期3e→解析3f。

[3e①store守恒证据](evidence/frontend-3e-store-2026-10-16.md)：源码fc14d50稳定干净实际HEAD全CI0/184438.376ms；5runtime全类逆证明/70公开457链/五红绿/原114+六定向120/新41及独立原fixture29齐，root704/160/AST3且撤入口豁免31→29，旧门控/顶层会话疑点仅登记44项；完成docs另全CI后续真正lazy/日期，尚非3e完成。

[3d治理证据](evidence/frontend-3d-governance-2026-10-16.md)：源码041e771稳定干净实际HEAD全CI0/177598.590ms；28新TS≤187/完整函数142/AST5/root997、完整1124行逆展开/70公开457链/27runtime真红还原114/旧新41及正常37/33/29齐；全200不冒称错误排序/写安全矩阵，启动EACCES失败史保留，完成docs另全CI后续3e→3f。

[3c⑪剩余共享证据](evidence/frontend-3c11-remaining-shared-2026-10-16.md)：源码32a277e稳定干净实际HEAD全CI0/179131.066ms；12新TS≤101/完整函数95/AST4/root2545，renderer/service与18声明逆证明/70公开457链/12红绿/新37及正常33/29齐，TD-PERF-003仅登记待核实；完成docs另全CI后继续治理3d→3e→3f。

[3c⑩在线文档证据](evidence/frontend-3c10-document-editor-2026-10-16.md)：源码78d726c稳定干净实际HEAD全CI0/181480.679ms；16TS≤172/完整函数165/AST5/root3066，完整800行14逆展开/70公开457链/15目标红绿、旧新37及正常33/29齐，三轮失败史与TD-WEB-005只登记保留；完成docs另全CI后续共享→3d–3f。

[3c⑨共享列表工具证据](evidence/frontend-3c9-register-tools-2026-10-16.md)：源码8a3b00c稳定干净实际HEAD全CI0/177320.318ms；11TS≤144/完整函数138/AST5/root3880，8逆展开/七live state/profile/70公开457链/十目标红绿/旧新扩展33齐；正常29也绿，完成docs实际HEAD另全CI，editor等共享→3d–3f继续。

[3c⑧基础共享证据](evidence/frontend-3c8-shared-foundations-2026-10-16.md)：源码541376f稳定干净实际HEAD全CI0/183823.324ms；六runtime≤289/完整函数103/AST5/root4520，43声明AST及剩余入口顺序/70公开457链/六红绿/旧新29齐，完成docs实际HEAD另全CI，共享editor/listtools及3d–3f继续。

[3c⑦共享装配证据](evidence/frontend-3c7-commercial-assembly-2026-10-16.md)：源码944a175稳定干净实际HEAD全CI0/185605.700ms，root5203/商业函数160、10逆展开/21导入边/70公开457链/八目标红绿/旧新29齐；TD-TEST-007仅登记40项，完成docs另全CI后续共享→3d–3f。

[3c⑥制造采购质量完成证据](evidence/frontend-3c6-operations-2026-10-16.md)：源码3f77a81/工具830d1fb各实际干净HEAD全CI0，36逆展开/70公开457链/27红绿/旧新11/两次正常28齐；TD006独立收口/完整失败史/旧metrics事后只读重放口径保留，21主视图已迁但共享未结清。

[3c⑤资金风险完成证据](evidence/frontend-3c5-finance-risk-2026-10-16.md)：源码00766d6完整CI0/175184.510ms、完成docs693c42f完整CI0/173041.324ms；八目标红绿/旧新16/组合24齐，后续⑥不重复许可。

[3c④订单履约完成证据](evidence/frontend-3c4-fulfillment-2026-10-16.md)：源码6ade731稳定干净实际HEAD完整CI0/182166.585ms；12模块/21逆展开及原type-predicate/70绑定457链/11目标红绿、旧新展开11与组合19齐。双生产面板/风险槽/旧权限耦合不改，首红与补展开史保持，完成docs另全CI后续⑤。

[3c③信用与合同完成证据](evidence/frontend-3c3-agreements-2026-10-16.md)：源码e401d27稳定干净实际HEAD完整CI0/182693.526ms；四新模块/完整逆展开/70绑定457断言/三目标红绿及旧新9、组合15只读探针齐。TD-WEB-004仅登记不修，文档操作与Playwright不计覆盖；完成状态docs检查点另全CI后续④。

3c②现时：实施与独立复核完成，源码/工具两HEAD全CI0；台账现38项（TD-TEST-006按测试工具边界关闭，旧37历史不改），原Playwright全补跑和3f后整批验收边界保持，完成证据如下。

[3c①线索方案完成证据](evidence/frontend-3c1-sales-2026-10-16.md)：a34df41稳定干净全CI0/167522.718ms，三视图守恒/70绑定457断言/114/真实变异/旧新CDP10与首失败史、共享残留归宿和回滚齐。

[3c②成本政策报价完成证据](evidence/frontend-3c2-pricing-2026-10-16.md)：源码9429a31与独立工具3f3aae7干净HEAD全CI0；12模块/逆展开/70绑定457断言/11目标红绿及两次无trace13齐，旧失败史/有限竞态保留，现归并docs检查点另全CI后续3c③。

[能力门禁静态TS读源修正](evidence/frontend-capability-runtime-graph-2026-10-16.md)：用户授权47a8ee5；入口静态图/原39-19逐文件规则/边界自测及实际新源负向，独立于3b业务候选。

[3b CRM域完成证据](evidence/frontend-3b-crm-2026-10-16.md)：源码487d698干净HEAD完整CI0，controller/records/shell及必要共享模块守恒、70公开绑定/457断言/实际读源变异/CDP与回滚；失败史及旧候选时点保留。

[3a唯一现时检查点](evidence/frontend-3a-checkpoint-2026-10-16.md)：五公共模块/两必要纯类型的现时SHA-CI-回滚总表、全部读取映射/变异与CDP边界；历史小步措辞以本页为准。

[3a navigation](evidence/frontend-3a-navigation-2026-10-16.md)：十声明/完整函数/同一卸载WeakMap及70公开绑定守恒、utility读源映射/真实红绿、七场景CDP。

[3a商业HTTP工厂](evidence/frontend-3a-commercial-http-2026-10-16.md)：完整116行箭头工厂/必要类型/facade守恒，分页源码读取映射与真实变异红绿、web114/预算/分步回滚。

[3a CRM HTTP工厂](evidence/frontend-3a-crm-http-2026-10-16.md)：shared工厂及必要纯类型前置，原公开facade与完整源码逐字守恒；原测试零适配、格式对拍失败/路径纠正保留，逐步验证与回滚。

[3a locale小步](evidence/frontend-3a-locale-2026-10-16.md)：两张纯文案表/完整函数逐字移动、治理查询保持、原web114/预算/七场景CDP及独立回滚；form前步86e7026完整CI已过。

[3a公共form小步](evidence/frontend-3a-form-2026-10-16.md)：完整函数/类型逐字守恒、测试切片绑定与真实变异红绿、旧新表单CDP探头及独立回滚；不等同整批完成。

[新web C3最小AST护栏](evidence/frontend-c3-guard-2026-10-16.md)：四新目录及routes子目录真实CLI 29对照、38自测，旧31/G3/G4/其他路径保持；尚未迁移3a，函数200仍独立完整函数计量。

[CDP六场景/五类确定性探头基线](evidence/frontend-cdp-harness-2026-10-16.md)：合成stub/静态白名单隔离、真实click/fill、设备/路由/可见文本/文档溢出、hold竞态及两个真实负向；仅三个业务route，非Playwright/真实API/21视图全覆盖；保留失败史与补跑地图。

[Windows Chrome CDP通道预检](evidence/windows-chrome-cdp-preflight-2026-10-16.md)：ad0435e裁定/02d93f4续派，owned loopback、版本、WSL preview真实DOM/资源200及清理通过；五类harness/Playwright尚未执行，阶段5前真实补跑义务保持。

前端批次3前置地图/历史阻断：[冻结源码断言与Chrome环境](evidence/frontend-batch3-preflight-blockers-2026-10-16.md)（保留历史；ad0435e新裁定允许Windows Chrome CDP临时通道，先连通预检，执行边界见计划§7；Playwright配置/九spec冻结，阶段5前真实补跑）。

E1先行固定证据：[authorization守恒候选/773例旧新探针](evidence/e1-authorization-conservation-2026-10-16.md)（授权310c1e2；先完成E1完整验证，再前端前置地图/冲突停报）。

双线B原规则基线与AST候选：[routes结构扫描基线](evidence/routes-structure-baseline-2026-10-16.md)（授权c75dd7b；116文件原G1/G2/G3、31旧豁免及AST候选逐文件数据；实施前审查材料）。

2e工程护栏说明：[Service边界护栏与库存](engineering/service-boundary-guard.md)（工程历史快照保留；2e已人工验收，源码基线c4ab493、验收5e94439＋924fca9，按护栏＋零迁移证据结案、不扩同仓；2f/3/4/5未授权；静态能力边界不扩大）。

> D4 裁决：常驻原位。架构改动前先读对应 ADR；与 ADR 冲突的改动须新开 ADR。

| 文档                                                                                                | 状态 |
| --------------------------------------------------------------------------------------------------- | ---- |
| [0001-typescript-monorepo-stack](adr/0001-typescript-monorepo-stack.md)                             | 常驻 |
| [0002-postgresql-access-and-migrations](adr/0002-postgresql-access-and-migrations.md)               | 常驻 |
| [0003-opaque-session-authentication](adr/0003-opaque-session-authentication.md)                     | 常驻 |
| [0004-rbac-and-data-scope](adr/0004-rbac-and-data-scope.md)                                         | 常驻 |
| [0005-versioned-platform-engines](adr/0005-versioned-platform-engines.md)                           | 常驻 |
| [0006-transactional-outbox-and-local-adapters](adr/0006-transactional-outbox-and-local-adapters.md) | 常驻 |
| [0007-immutable-business-object-schemas](adr/0007-immutable-business-object-schemas.md)             | 常驻 |
| [0008-p1-crm-compatibility-and-patterns](adr/0008-p1-crm-compatibility-and-patterns.md)             | 常驻 |
| [0009-commercial-revision-graph](adr/0009-commercial-revision-graph.md)                             | 常驻 |
| [0010-immutable-quote-to-cash-ledger](adr/0010-immutable-quote-to-cash-ledger.md)                   | 常驻 |

## docs/agent-memory（智能体记忆库，13 篇）

> D4 裁决：**保留为常驻**。Studio/Codex 工作流的活跃工作记忆（takeover-status 最近更新 2026-10-08），维持其只追加约定；与 exec-plans 体系并行。**历史记忆仅作过程记录——当前事实以 `AGENTS.md`、`ARCHITECTURE.md`、`docs/CI.md`、`docs/RELIABILITY.md` 与 `exec-plans/active/` 为准**，避免旧分支状态误导后续会话。

| 文档                                                                                             | 状态 |
| ------------------------------------------------------------------------------------------------ | ---- |
| [2026-08-17-studio-long-task-heartbeat](agent-memory/2026-08-17-studio-long-task-heartbeat.md)   | 常驻 |
| [2026-08-18-l02-ctr-solution-foundation](agent-memory/2026-08-18-l02-ctr-solution-foundation.md) | 常驻 |
| [CANONICAL_EXECUTION_BASELINE](agent-memory/CANONICAL_EXECUTION_BASELINE.md)                     | 常驻 |
| [README](agent-memory/README.md)                                                                 | 常驻 |
| [decisions](agent-memory/decisions.md)                                                           | 常驻 |
| [evidence](agent-memory/evidence.md)                                                             | 常驻 |
| [execution-boundary](agent-memory/execution-boundary.md)                                         | 常驻 |
| [handoff](agent-memory/handoff.md)                                                               | 常驻 |
| [project-issue-matrix](agent-memory/project-issue-matrix.md)                                     | 常驻 |
| [project-state](agent-memory/project-state.md)                                                   | 常驻 |
| [sessions](agent-memory/sessions.md)                                                             | 常驻 |
| [takeover-status](agent-memory/takeover-status.md)                                               | 常驻 |
| [task-sequence](agent-memory/task-sequence.md)                                                   | 常驻 |

## docs/deployment（部署运维，2 篇）

> D4 裁决：常驻。PRODUCTION_PARK_HOST 为生产主机细节 runbook（RELIABILITY.md 引用）；FEISHU 同步为在用流程（最近更新 2026-08-24）。

| 文档                                                               | 状态 |
| ------------------------------------------------------------------ | ---- |
| [FEISHU_CODEX_THREAD_SYNC](deployment/FEISHU_CODEX_THREAD_SYNC.md) | 常驻 |
| [PRODUCTION_PARK_HOST](deployment/PRODUCTION_PARK_HOST.md)         | 常驻 |

## docs/engineering（工程规格，22 篇：常驻 13 + 已归档 9）

> D4 裁决：活跃规格（蓝图/总计划/角色目录/身份授权/基座运营/能力矩阵/成本闭环/业务文档/L19-L20 规格/回归预防等 13 篇）常驻；KT-UI-PROD 系列（9 篇，编号无 04/05）为前端产品化完成记录，已归档-只读（README 仍引用 08/09，原位保留保证链接可达）。

| 文档                                                                                                                  | 状态                    |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| [ATOMIC_ROLE_AND_UAT_MATRIX](engineering/ATOMIC_ROLE_AND_UAT_MATRIX.md)                                               | 常驻                    |
| [BUSINESS_DOCUMENT_COMMUNICATIONS](engineering/BUSINESS_DOCUMENT_COMMUNICATIONS.md)                                   | 常驻                    |
| [COST_QUOTE_ORDER_CLOSED_LOOP](engineering/COST_QUOTE_ORDER_CLOSED_LOOP.md)                                           | 常驻                    |
| [FOUNDATION_OPERATIONS](engineering/FOUNDATION_OPERATIONS.md)                                                         | 常驻                    |
| [FRONTEND_CAPABILITY_PERMISSION_MATRIX](engineering/FRONTEND_CAPABILITY_PERMISSION_MATRIX.md)                         | 常驻                    |
| [IDENTITY_AUTHORIZATION](engineering/IDENTITY_AUTHORIZATION.md)                                                       | 常驻                    |
| [KINGTURF_V2_ATOMIC_OPERATIONS_BLUEPRINT](engineering/KINGTURF_V2_ATOMIC_OPERATIONS_BLUEPRINT.md)                     | 常驻                    |
| [KT-L19_COLLECTIONS_LEGAL_EVIDENCE_SPEC](engineering/KT-L19_COLLECTIONS_LEGAL_EVIDENCE_SPEC.md)                       | 常驻                    |
| [KT-L20_COMPLAINT_NCR_CAPA_SPEC](engineering/KT-L20_COMPLAINT_NCR_CAPA_SPEC.md)                                       | 常驻                    |
| [KT-UI-PROD-01_FRONTEND_PRODUCTION_COMPLETION_PLAN](engineering/KT-UI-PROD-01_FRONTEND_PRODUCTION_COMPLETION_PLAN.md) | 已归档-只读（完成记录） |
| [KT-UI-PROD-02_FRONTEND_REFINEMENT_AUDIT](engineering/KT-UI-PROD-02_FRONTEND_REFINEMENT_AUDIT.md)                     | 已归档-只读（完成记录） |
| [KT-UI-PROD-03_LAYOUT_AND_VISUAL_AUDIT](engineering/KT-UI-PROD-03_LAYOUT_AND_VISUAL_AUDIT.md)                         | 已归档-只读（完成记录） |
| [KT-UI-PROD-06_PROCESS_NAVIGATION](engineering/KT-UI-PROD-06_PROCESS_NAVIGATION.md)                                   | 已归档-只读（完成记录） |
| [KT-UI-PROD-07_COST_WORKBENCH](engineering/KT-UI-PROD-07_COST_WORKBENCH.md)                                           | 已归档-只读（完成记录） |
| [KT-UI-PROD-08_PRODUCT_AUDIT](engineering/KT-UI-PROD-08_PRODUCT_AUDIT.md)                                             | 已归档-只读（完成记录） |
| [KT-UI-PROD-09_STARTUP_DELIVERY](engineering/KT-UI-PROD-09_STARTUP_DELIVERY.md)                                       | 已归档-只读（完成记录） |
| [KT-UI-PROD-10_LOGO_DOCUMENT_SEND](engineering/KT-UI-PROD-10_LOGO_DOCUMENT_SEND.md)                                   | 已归档-只读（完成记录） |
| [KT-UI-PROD-11_DOCUMENT_ACTION_GUIDANCE](engineering/KT-UI-PROD-11_DOCUMENT_ACTION_GUIDANCE.md)                       | 已归档-只读（完成记录） |
| [MASTER_DEVELOPMENT_PLAN](engineering/MASTER_DEVELOPMENT_PLAN.md)                                                     | 常驻                    |
| [OPERATING_MODEL_AND_ROLE_CATALOG](engineering/OPERATING_MODEL_AND_ROLE_CATALOG.md)                                   | 常驻                    |
| [PRODUCT_BLUEPRINT](engineering/PRODUCT_BLUEPRINT.md)                                                                 | 常驻                    |
| [REGRESSION_PREVENTION](engineering/REGRESSION_PREVENTION.md)                                                         | 常驻                    |

## docs/evidence（验收证据，23 篇）

> D4 裁决：已归档-只读（历史验收快照，原位保留）。

| 文档                                                                                                                       | 状态                            |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| [BATCH1_INTEGRATION_REPORT_20261008](evidence/BATCH1_INTEGRATION_REPORT_20261008.md)                                       | 已归档-只读（验收快照）         |
| [BATCH1_RELEASE_SAFETY_REPORT_20261008](evidence/BATCH1_RELEASE_SAFETY_REPORT_20261008.md)                                 | 已归档-只读（验收快照）         |
| [BATCH25_CI_GATE_RECOVERY_REPORT_20261008](evidence/BATCH25_CI_GATE_RECOVERY_REPORT_20261008.md)                           | 已归档-只读（验收快照）         |
| [BATCH2_AUTH_SECURITY_REPORT_20261008](evidence/BATCH2_AUTH_SECURITY_REPORT_20261008.md)                                   | 已归档-只读（验收快照）         |
| [BATCH2_PR_INTEGRATION_REPORT_20261008](evidence/BATCH2_PR_INTEGRATION_REPORT_20261008.md)                                 | 已归档-只读（验收快照）         |
| [BATCH3_AUTHORIZATION_REPORT_20261008](evidence/BATCH3_AUTHORIZATION_REPORT_20261008.md)                                   | 已归档-只读（验收快照）         |
| [GITHUB_PROTECTION_AUDIT_20261008_BATCH1](evidence/GITHUB_PROTECTION_AUDIT_20261008_BATCH1.md)                             | 已归档-只读（验收快照）         |
| [KT-L07_ACCEPTANCE](evidence/KT-L07_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照）         |
| [KT-L08_ACCEPTANCE](evidence/KT-L08_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照）         |
| [KT-L09_ACCEPTANCE](evidence/KT-L09_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照）         |
| [KT-L10_ACCEPTANCE](evidence/KT-L10_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照）         |
| [KT-L11_ACCEPTANCE](evidence/KT-L11_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照）         |
| [KT-L12_ACCEPTANCE](evidence/KT-L12_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照）         |
| [KT-L13_ACCEPTANCE](evidence/KT-L13_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照）         |
| [KT-L14_ACCEPTANCE](evidence/KT-L14_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照）         |
| [KT-L15_ACCEPTANCE](evidence/KT-L15_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照）         |
| [KT-L17_ACTUAL_MANUFACTURING_COST_20260822](evidence/KT-L17_ACTUAL_MANUFACTURING_COST_20260822.md)                         | 已归档-只读（验收快照）         |
| [KT-L18_SHIPMENT_RELEASE_LOGISTICS_POD_20260824](evidence/KT-L18_SHIPMENT_RELEASE_LOGISTICS_POD_20260824.md)               | 已归档-只读（验收快照）         |
| [KT-L19_COLLECTIONS_LEGAL_EVIDENCE_LOCAL_GATE_20260825](evidence/KT-L19_COLLECTIONS_LEGAL_EVIDENCE_LOCAL_GATE_20260825.md) | 已归档-只读（验收快照）         |
| [KT-RG01_PRODUCTION_REACCEPTANCE_20260822](evidence/KT-RG01_PRODUCTION_REACCEPTANCE_20260822.md)                           | 已归档-只读（验收快照）         |
| [KT_RBAC_ATOMIC_ROLE_UAT_20260822](evidence/KT_RBAC_ATOMIC_ROLE_UAT_20260822.md)                                           | 已归档-只读（验收快照）         |
| [PROJECT_TAKEOVER_DEV_TEST_ACCEPTANCE_REPORT_20261010](evidence/PROJECT_TAKEOVER_DEV_TEST_ACCEPTANCE_REPORT_20261010.md)   | 已归档-只读（验收快照）         |
| [PROJECT_TAKEOVER_REPORT_20261008](evidence/PROJECT_TAKEOVER_REPORT_20261008.md)                                           | 已归档-只读（验收快照）         |
| [playwright-docker-channel-2026-10-17](evidence/playwright-docker-channel-2026-10-17.md)                                   | 常驻（Playwright 补跑通道核查） |

## docs/tasks（历史任务档案，23 篇：常驻 2 + 已归档 21）

> D4 裁决：ROADMAP 与 KINGTURF_V2_LONG_TASK_PLAN 常驻（活跃规划，目标 2027-06-30）；JTF-P0/P1 任务档案已归档-只读。

| 文档                                                                          | 状态                    |
| ----------------------------------------------------------------------------- | ----------------------- |
| [JTF-P0-E01-REPOSITORY-BOOTSTRAP](tasks/JTF-P0-E01-REPOSITORY-BOOTSTRAP.md)   | 已归档-只读（任务档案） |
| [JTF-P0-E02-CONFIGURATION](tasks/JTF-P0-E02-CONFIGURATION.md)                 | 已归档-只读（任务档案） |
| [JTF-P0-E03-DATABASE-FOUNDATION](tasks/JTF-P0-E03-DATABASE-FOUNDATION.md)     | 已归档-只读（任务档案） |
| [JTF-P0-E04-ORGANIZATION-EMPLOYEE](tasks/JTF-P0-E04-ORGANIZATION-EMPLOYEE.md) | 已归档-只读（任务档案） |
| [JTF-P0-E05-AUTHENTICATION](tasks/JTF-P0-E05-AUTHENTICATION.md)               | 已归档-只读（任务档案） |
| [JTF-P0-E06-AUTHORIZATION](tasks/JTF-P0-E06-AUTHORIZATION.md)                 | 已归档-只读（任务档案） |
| [JTF-P0-E07-MASTER-DATA](tasks/JTF-P0-E07-MASTER-DATA.md)                     | 已归档-只读（任务档案） |
| [JTF-P0-E08-NUMBERING](tasks/JTF-P0-E08-NUMBERING.md)                         | 已归档-只读（任务档案） |
| [JTF-P0-E09-AUDIT](tasks/JTF-P0-E09-AUDIT.md)                                 | 已归档-只读（任务档案） |
| [JTF-P0-E10-WORKFLOW](tasks/JTF-P0-E10-WORKFLOW.md)                           | 已归档-只读（任务档案） |
| [JTF-P0-E11-RULES](tasks/JTF-P0-E11-RULES.md)                                 | 已归档-只读（任务档案） |
| [JTF-P0-E12-NOTIFICATIONS](tasks/JTF-P0-E12-NOTIFICATIONS.md)                 | 已归档-只读（任务档案） |
| [JTF-P0-E13-ATTACHMENTS](tasks/JTF-P0-E13-ATTACHMENTS.md)                     | 已归档-只读（任务档案） |
| [JTF-P0-E14-EVENTS](tasks/JTF-P0-E14-EVENTS.md)                               | 已归档-只读（任务档案） |
| [JTF-P0-E15-BUSINESS-OBJECTS](tasks/JTF-P0-E15-BUSINESS-OBJECTS.md)           | 已归档-只读（任务档案） |
| [JTF-P0-E16-OBSERVABILITY](tasks/JTF-P0-E16-OBSERVABILITY.md)                 | 已归档-只读（任务档案） |
| [JTF-P0-E17-QUALITY](tasks/JTF-P0-E17-QUALITY.md)                             | 已归档-只读（任务档案） |
| [JTF-P1-E01-E04-SALES-TO-CASH](tasks/JTF-P1-E01-E04-SALES-TO-CASH.md)         | 已归档-只读（任务档案） |
| [JTF-P1-E05-E10-SALES-TO-CASH](tasks/JTF-P1-E05-E10-SALES-TO-CASH.md)         | 已归档-只读（任务档案） |
| [JTF-P1-E11-E17-QUOTE-TO-CASH](tasks/JTF-P1-E11-E17-QUOTE-TO-CASH.md)         | 已归档-只读（任务档案） |
| [JTF-P1-E18-E21-CLOSURE](tasks/JTF-P1-E18-E21-CLOSURE.md)                     | 已归档-只读（任务档案） |
| [KINGTURF_V2_LONG_TASK_PLAN](tasks/KINGTURF_V2_LONG_TASK_PLAN.md)             | 常驻                    |
| [ROADMAP](tasks/ROADMAP.md)                                                   | 常驻                    |

## exec-plans/completed/

（暂无已归档计划；harness 改造竣工后首个归档件为 HARNESS-RULES 拆解产物。）
